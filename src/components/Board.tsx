import { useEffect, useRef } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { DrawBrush, DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { dests, isCheck, keyToFen, turnOfKey, uciToArrow, type Side } from '../lib/chess';

export type Shape = DrawShape;

/** Colours of the arrows the app draws itself. PGN annotations ([%cal]/[%csl] from Lichess, Chessable,
 *  ChessBase) only know green, red, blue and yellow, so the app never uses those: moves are white or black
 *  after the side that plays them and run under the pieces like a trail, so annotations stay on top; the
 *  engine's move is violet, a move you point at in the database is pink, and a gap (a reply you have not
 *  prepared) is the orange-red of the app's gap badges, lighter than the annotations' dark red. */
/** Thin dark edge that keeps white arrows and circles visible on the light squares. */
const WHITE_EDGE = '#6b6252';

const APP_BRUSHES: Record<string, DrawBrush> = {
  moveWhite: { key: 'mw', color: '#ffffff', opacity: 0.85, lineWidth: 12 },
  moveBlack: { key: 'mb', color: '#000000', opacity: 0.55, lineWidth: 12 },
  moveWhiteSoft: { key: 'mws', color: '#ffffff', opacity: 0.5, lineWidth: 12 },
  moveBlackSoft: { key: 'mbs', color: '#000000', opacity: 0.3, lineWidth: 12 },
  engine: { key: 'eng', color: '#7a3db8', opacity: 0.6, lineWidth: 12 },
  pointer: { key: 'ptr', color: '#e0457b', opacity: 0.75, lineWidth: 10 },
  // A gap: an opponent's move people often play that you have not prepared (the colour of the "gap" badges).
  gap: { key: 'gap', color: '#d0502b', opacity: 0.8, lineWidth: 10 },
  gapSoft: { key: 'gaps', color: '#d0502b', opacity: 0.45, lineWidth: 10 },
};

/** A move as an arrow in the colour of the side that plays it. `soft` when the position has annotations
 *  (they should stand out), `onTop` to draw it over the pieces instead of under them. */
export function moveArrow(uci: string, side: Side, opts: { soft?: boolean; width?: number; onTop?: boolean } = {}): Shape {
  const [orig, dest] = uciToArrow(uci);
  const brush = `move${side === 'white' ? 'White' : 'Black'}${opts.soft ? 'Soft' : ''}`;
  return {
    orig,
    dest,
    brush,
    modifiers: { ...(opts.width ? { lineWidth: opts.width } : {}), ...(side === 'white' ? { hilite: WHITE_EDGE } : {}) },
    ...(opts.onTop ? {} : { below: true }),
  } as Shape;
}

/** A gap as a red-orange arrow under the pieces, thicker the more often it is played (`share` 0–1). */
export function gapArrow(uci: string, share: number, opts: { soft?: boolean } = {}): Shape {
  const [orig, dest] = uciToArrow(uci);
  return { orig, dest, brush: opts.soft ? 'gapSoft' : 'gap', modifiers: { lineWidth: Math.round(6 + Math.min(1, share * 2) * 6) }, below: true } as Shape;
}

/** A circle around a square in the colour of a side (e.g. the piece to move, as a hint). */
export function sideCircle(square: string, side: Side): Shape {
  return { orig: square, brush: side === 'white' ? 'moveWhite' : 'moveBlack', modifiers: { hilite: side === 'white' ? WHITE_EDGE : '#ffffff' } } as Shape;
}

interface Props {
  /** Position key (FEN without counters). */
  position: string;
  orientation: Side;
  /** Which side the user may move; null = view only. */
  movable: Side | 'both' | null;
  lastMove?: [string, string] | null;
  /** Helper arrows drawn by the app itself (prepared moves, engine line, hovered move). */
  shapes?: Shape[];
  /** The position's own arrows and circles (the ones stored in the repertoire). */
  drawn?: Shape[];
  /** Every board can be drawn on like on Lichess (right-click and drag for an arrow, right-click a square for a
   *  circle; Shift/Ctrl = red, Alt = blue, both = yellow). Temporary drawings vanish when the position changes.
   *  Pass this to keep them: it is called with everything drawn after each change. */
  onDraw?: (shapes: Shape[]) => void;
  onMove?: (orig: string, dest: string) => void;
  /** A square clicked or a piece picked up. */
  onSelect?: (square: string) => void;
  className?: string;
}

export function Board({ position, orientation, movable, lastMove, shapes, drawn, onDraw, onMove, onSelect, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  // True while the user is drawing (right button or Shift held). Chessground also wipes all drawings when
  // the board is clicked, and reports that as a change; only real drawing may change what is stored.
  const drawing = useRef(false);

  useEffect(() => {
    const board = el.current;
    if (!board) return;
    const down = (e: MouseEvent | TouchEvent) => {
      drawing.current = 'button' in e && (e.button === 2 || e.buttons === 2 || e.shiftKey);
      // Chessground remembers where the board is and only measures again after a resize or a scroll. When something
      // above the board appears or goes (a clock bar, captured pieces, a notice), clicks would land a square off:
      // measure again at every press.
      api.current?.state.dom.bounds.clear();
    };
    const up = () => {
      setTimeout(() => {
        drawing.current = false;
      }, 0);
    };
    board.addEventListener('mousedown', down, true);
    board.addEventListener('touchstart', down, true);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchend', up);
    return () => {
      board.removeEventListener('mousedown', down, true);
      board.removeEventListener('touchstart', down, true);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchend', up);
    };
  }, []);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true },
      coordinates: true,
      // Rank numbers on the left-hand file, so chessground marks each label with the colour of the square it is on.
      ranksPosition: 'left',
      draggable: { showGhost: true },
      drawable: {
        enabled: true,
        visible: true,
        brushes: APP_BRUSHES as never,
        eraseOnMovablePieceClick: false,
        onChange: (all) => {
          if (drawing.current) onDrawRef.current?.([...all]);
          else api.current?.setShapes(drawnRef.current ?? []); // a click on the board: the drawings stay
        },
      },
      movable: { free: false, showDests: true, events: { after: (o, d) => onMoveRef.current?.(o, d) } },
      premovable: { enabled: false },
      events: { select: (sq) => onSelectRef.current?.(sq) },
    });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    const turn = turnOfKey(position);
    const canMove = movable === 'both' || movable === turn;
    api.current?.set({
      fen: keyToFen(position),
      orientation,
      turnColor: turn,
      check: isCheck(position) ? turn : false,
      lastMove: (lastMove as Key[] | null) ?? undefined,
      movable: {
        color: canMove ? turn : undefined,
        dests: canMove ? (dests(position) as Map<Key, Key[]>) : new Map(),
      },
    });
    // By value: a new array with the same squares must not set the board up again (it would drop a picked-up piece).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, orientation, movable, lastMove?.join()]);

  useEffect(() => {
    api.current?.setAutoShapes(shapes ?? []);
  }, [shapes]);

  useEffect(() => {
    api.current?.setShapes(drawn ?? []);
  }, [drawn, position]);

  const wrap = useRef<HTMLDivElement>(null);
  useBoardFit(wrap);

  return (
    <div ref={wrap} className={`board-wrap ${className ?? ''}`}>
      <div ref={el} className="cg-wrap" />
    </div>
  );
}

/** Boards that are pictures inside a card (the tree's preview, Home's preview) keep their own size. */
const NOT_FITTED = '.mini-board, .studio-preview-stage';

/** The height a playing board may take: the window from the board's top down to the bottom (minus the phone's bottom
 *  bar), so the whole board is in view. If that leaves too little (much above the board), the board takes most of the
 *  window and the page scrolls to it once. Kept in --board-hmax, which every board size in the CSS respects. */
function useBoardFit(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || el.closest(NOT_FITTED)) return;
    const root = document.documentElement;
    const bottomBar = () => {
      const nav = document.querySelector<HTMLElement>('.topbar .nav');
      if (!nav || getComputedStyle(nav).position !== 'fixed') return 0;
      const r = nav.getBoundingClientRect();
      // Only a bar along the bottom (phone) takes height; the laptop's sidebar does not.
      return r.top > window.innerHeight / 2 ? r.height : 0;
    };
    // The bar at the top stays on screen (sticky): nothing under it is in view.
    const topBar = () => {
      const bar = document.querySelector<HTMLElement>('.topbar');
      if (!bar || !['sticky', 'fixed'].includes(getComputedStyle(bar).position)) return 0;
      return Math.max(0, bar.getBoundingClientRect().bottom);
    };
    const view = () => window.innerHeight - bottomBar();
    const apply = () => {
      const tb = topBar();
      root.style.setProperty('--sticky-top', `${Math.round(tb)}px`);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const room = view() - top - 12;
      const full = view() - tb - 16;
      const h = Math.max(220, Math.min(full, Math.max(room, Math.round(full * 0.75))));
      root.style.setProperty('--board-hmax', `${h}px`);
    };
    apply();
    // Narrow screens: the board sticks to the top, so whatever the page scrolls to (a focused button, a message) must
    // land under it, not behind it.
    const sticky = el.closest<HTMLElement>('.train > .board-area, .train > .board-col, .build > div:first-child, .review > .review-board');
    const pad = () => {
      const on = !!sticky && window.matchMedia('(max-width: 900px)').matches && getComputedStyle(sticky).position === 'sticky';
      root.style.scrollPaddingTop = on ? `${Math.round(topBar() + sticky!.getBoundingClientRect().height + 8)}px` : '';
    };
    pad();
    const ro = typeof ResizeObserver !== 'undefined' && sticky ? new ResizeObserver(pad) : null;
    if (ro && sticky) ro.observe(sticky);
    // Once, after the view has settled: bring the whole board into view with the smallest scroll.
    const t = setTimeout(() => {
      apply();
      const r = el.getBoundingClientRect();
      const bottom = view() - 8;
      const ceiling = topBar() + 8;
      let delta = r.bottom > bottom ? r.bottom - bottom : r.top < ceiling ? r.top - ceiling : 0;
      if (r.top - delta < ceiling) delta = r.top - ceiling;
      // A training session on a narrow screen: the board (and what sits above it) to the top, the panel right under it.
      const session = el.closest<HTMLElement>('.train > .board-area, .train > .board-col');
      if (session && window.matchMedia('(max-width: 900px)').matches) delta = session.getBoundingClientRect().top - topBar();
      if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: 'smooth' });
    }, 120);
    const onResize = () => {
      apply();
      pad();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      ro?.disconnect();
      root.style.scrollPaddingTop = '';
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      root.style.removeProperty('--board-hmax');
      root.style.removeProperty('--sticky-top');
    };
  }, [ref]);
}
