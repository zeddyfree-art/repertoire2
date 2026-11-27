// The endgame study path: stages → sections → drills, plus puzzle tests (Lichess puzzle themes).
//
// Every fixed position here was checked against the Lichess 7-piece tablebase (the breakthrough, with eight pieces,
// against Stockfish): the side you play reaches the goal with best play, and the computer defends perfectly.
// Levels follow the "Mates & Endgames to Know Cold" checklist: L1 automatic (do these first), L2 required, L3 for
// 1500–1800.

import type { Side } from '../chess';

export type Level = 1 | 2 | 3;

/** What counts as solving a drill.
 *  - mate: give checkmate.
 *  - promote: make a queen while the position stays won.
 *  - win: mate, promote, or win everything but a bare king (with mating material left) — the rest is a basic mate.
 *  - draw: reach a drawn end (stalemate, too little material, repetition) or hold the draw for `hold` moves. */
export type Goal = 'mate' | 'promote' | 'win' | 'draw';

/** Material for positions set up at random (a new one each time, so you learn the method, not a position). */
export type RandomSetup = 'KQvK' | 'KRvK' | 'KRRvK' | 'KQRvK' | 'KBBvK';

export interface Drill {
  id: string;
  title: string;
  /** Start position (full FEN). Absent for random drills. */
  fen?: string;
  random?: RandomSetup;
  /** The side you play. If the other side is to move, the computer moves first. */
  side: Side;
  goal: Goal;
  /** For draw goals: your moves to survive (default 12). */
  hold?: number;
  /** Ask first: "win or draw?" — the rule drills. The answer is about the position with best play. */
  verdict?: 'win' | 'draw';
  /** Seconds for the "automatic" badge (and three stars) on the basic mates. */
  targetSec?: number;
  /** One line, shown before you start. */
  task: string;
  /** Shown when you ask for a hint, before the move itself. */
  hint: string;
}

export interface LearnLink {
  label: string;
  url: string;
}

export interface Section {
  id: string;
  title: string;
  level: Level;
  /** What you must be able to do, in one or two sentences (the rule or method). */
  rule: string;
  drills: Drill[];
  /** Watch / read: YouTube searches and Lichess Practice, from the checklist. */
  learn: LearnLink[];
  /** Lichess puzzle themes that train the same thing. */
  puzzles?: string[];
}

export interface Stage {
  id: string;
  title: string;
  lead: string;
  sections: Section[];
}

export interface PuzzleTest {
  theme: string;
  title: string;
  level: Level;
  /** How many puzzles make the test, and how many must be solved at the first try (80%). */
  size: number;
  /** One line on what the pattern is. */
  about: string;
  /** Narrows the Lichess theme down to this pattern (see endgames/puzzles.ts). */
  filter?: import('./puzzles').PuzzleFilter;
}

export interface PuzzleGroup {
  id: string;
  title: string;
  lead: string;
  tests: PuzzleTest[];
}

const yt = (q: string): LearnLink => ({ label: `Video: ${q}`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` });
const practice = (label: string): LearnLink => ({ label: `Lichess Practice: ${label}`, url: 'https://lichess.org/practice' });

export const STAGES: Stage[] = [
  {
    id: 'mates',
    title: 'Basic mates',
    lead: 'Techniques you carry out, not positions you recognise. They must work with ten seconds on the clock.',
    sections: [
      {
        id: 'queen-mate',
        title: 'King and queen against king',
        level: 1,
        rule:
          'Shrink the box with the queen a knight’s move from the king, then bring your own king. The king does the last part of the work, not the queen. Before every queen move ask: does he still have a square?',
        learn: [yt('king and queen checkmate box method'), yt('avoid stalemate king and queen endgame'), practice('Piece Checkmates I')],
        drills: [
          {
            id: 'kq-centre',
            title: 'Queen mate from the centre',
            fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 60,
            task: 'Mate the king. Shrink the box, then bring your king.',
            hint: 'Put the queen a knight’s move away from the king and follow it as it moves.',
          },
          {
            id: 'kq-stalemate',
            title: 'Stalemate alarm',
            fen: 'k7/2Q5/8/1K6/8/8/8/8 w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 30,
            task: 'Mate quickly — but nine of your 31 moves here are stalemate.',
            hint: 'The king has no square at all. Your next move must give it one, or give check.',
          },
          {
            id: 'kq-random',
            title: 'Queen mate from anywhere',
            random: 'KQvK',
            side: 'white',
            goal: 'mate',
            targetSec: 60,
            task: 'A new position every time: mate the king.',
            hint: 'Knight’s move away with the queen, shrink the box, then walk your king up.',
          },
        ],
      },
      {
        id: 'rook-mate',
        title: 'King and rook against king',
        level: 1,
        rule:
          'The rook fences the king in, your king takes the opposition, the rook checks when the kings face each other. A rook waiting move wins the tempo.',
        learn: [yt('king and rook checkmate'), practice('Piece Checkmates I')],
        drills: [
          {
            id: 'kr-centre',
            title: 'Rook mate from the centre',
            fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 90,
            task: 'Mate the king with king and rook.',
            hint: 'Cut the king off with the rook, then bring your king to face his.',
          },
          {
            id: 'kr-random',
            title: 'Rook mate from anywhere',
            random: 'KRvK',
            side: 'white',
            goal: 'mate',
            targetSec: 90,
            task: 'A new position every time: mate the king.',
            hint: 'Fence, opposition, check. If the kings do not face each other, make a waiting move with the rook.',
          },
        ],
      },
      {
        id: 'ladder',
        title: 'Ladder mate: two rooks, queen and rook',
        level: 1,
        rule:
          'The two pieces take turns: one holds a rank, the other checks on the next. If the king attacks a rook, swing it to the far side.',
        learn: [yt('ladder checkmate two rooks'), practice('Piece Checkmates I')],
        drills: [
          {
            id: 'ladder-rooks',
            title: 'Two rooks',
            fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 30,
            task: 'Mate with the two rooks. Your king can stay at home.',
            hint: 'One rook holds a rank, the other checks on the next one. Keep them away from the king.',
          },
          {
            id: 'ladder-queen-rook',
            title: 'Queen and rook',
            fen: '8/8/8/3k4/8/8/8/Q3K2R w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 30,
            task: 'Mate with queen and rook.',
            hint: 'Take turns: one piece holds a rank, the other checks on the next.',
          },
          {
            id: 'ladder-random',
            title: 'Two rooks from anywhere',
            random: 'KRRvK',
            side: 'white',
            goal: 'mate',
            targetSec: 30,
            task: 'A new position every time: the ladder.',
            hint: 'If the king attacks a rook, swing it to the far side of the board.',
          },
        ],
      },
    ],
  },
  {
    id: 'pawn-basics',
    title: 'Pawn essentials',
    lead: 'The rules every pawn ending is built on. Say win or draw before you move.',
    sections: [
      {
        id: 'square',
        title: 'The rule of the square',
        level: 1,
        rule:
          'Draw the square from the pawn to its promotion rank. If the defending king can step into it, it catches the pawn. Remember the double step from the second rank.',
        learn: [yt('rule of the square chess endgame')],
        drills: [
          {
            id: 'square-wtm',
            title: 'Square: White to move',
            fen: '8/8/8/6k1/1P6/8/8/7K w - - 0 1',
            side: 'white',
            goal: 'promote',
            verdict: 'win',
            task: 'White to move. Can the black king catch the pawn?',
            hint: 'After b5 the square runs b5–e8. Is the king inside it?',
          },
          {
            id: 'square-btm',
            title: 'Square: Black to move',
            fen: '8/8/8/6k1/1P6/8/8/7K b - - 0 1',
            side: 'black',
            goal: 'draw',
            verdict: 'draw',
            task: 'Black to move. Can the king catch the pawn? Play it.',
            hint: 'Step into the square: the f-file is inside it.',
          },
        ],
      },
      {
        id: 'opposition',
        title: 'Opposition',
        level: 1,
        rule:
          'Kings face each other with one square between them: whoever does not have to move has the opposition. Attacker: king first, pawn second. Defender: step straight back and take the opposition when the king comes forward.',
        learn: [yt('opposition king and pawn endgame'), practice('Pawn Endgames › Opposition')],
        drills: [
          {
            id: 'opp-wtm',
            title: 'Opposition: White to move',
            fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1',
            side: 'black',
            goal: 'draw',
            verdict: 'draw',
            hold: 14,
            task: 'White to move. Win or draw? Then defend with Black.',
            hint: 'Answer every king move by facing the white king again, straight in front of it.',
          },
          {
            id: 'opp-btm',
            title: 'Opposition: Black to move',
            fen: '8/8/8/4k3/8/4K3/4P3/8 b - - 0 1',
            side: 'white',
            goal: 'promote',
            verdict: 'win',
            task: 'Black to move. Win or draw? Then play White.',
            hint: 'King first, pawn second: keep your king in front of the pawn and take the opposition.',
          },
          {
            id: 'opp-defend',
            title: 'Defend king and pawn',
            fen: '8/4k3/8/8/4P3/8/4K3/8 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Hold the draw against king and pawn.',
            hint: 'Stay in front of the pawn. When the white king comes forward, take the opposition.',
          },
        ],
      },
      {
        id: 'kp-finish',
        title: 'King and pawn: the finish',
        level: 1,
        rule:
          'Your king on the sixth rank in front of its pawn always wins. A pawn that reaches the seventh without check wins; with check it is a draw.',
        learn: [yt('king and pawn vs king endgame king on the sixth')],
        drills: [
          {
            id: 'kp-sixth',
            title: 'King on the sixth',
            fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn. Only two moves win here.',
            hint: 'Do not push yet: step to the side with the king.',
          },
          {
            id: 'kp-sixth-btm',
            title: 'King on the sixth, Black to move',
            fen: '3k4/8/3K4/8/3P4/8/8/8 b - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Black moves first. Queen the pawn.',
            hint: 'Keep the opposition, and push only when the pawn reaches the seventh without check.',
          },
        ],
      },
      {
        id: 'rook-pawn',
        title: 'The rook pawn',
        level: 1,
        rule:
          'A rook pawn does not win if the defender reaches the corner, or shuts your king in on the rook file in front of its own pawn.',
        learn: [yt('rook pawn king and pawn endgame draw')],
        drills: [
          {
            id: 'rp-shut-in',
            title: 'Shut the king in',
            fen: 'K7/P1k5/8/8/8/8/8/8 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 8,
            task: 'Keep the white king locked in the corner. Only one move does it.',
            hint: 'Stay on c7 or c8 — never give the king b8 or b7.',
          },
          {
            id: 'rp-corner',
            title: 'Run to the corner',
            fen: '8/8/8/2k5/8/8/P7/1K6 w - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 14,
            task: 'White moves first. Hold the draw against the rook pawn.',
            hint: 'Head for a8, or keep the white king away from b7/b8.',
          },
        ],
      },
      {
        id: 'two-pawns',
        title: 'Two pawns against the king',
        level: 1,
        rule:
          'Connected pawns protect each other, and so do split pawns one file apart: bring the king, do not rush. With doubled pawns the rear pawn is a spare tempo.',
        learn: [yt('king and two pawns vs king endgame')],
        drills: [
          {
            id: 'tp-connected',
            title: 'Connected pawns',
            fen: '8/8/8/4k3/8/8/3PP3/4K3 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen a pawn without losing one.',
            hint: 'Bring the king up beside the pawns; push them side by side.',
          },
          {
            id: 'tp-split',
            title: 'Split pawns',
            fen: '8/8/4k3/8/3P1P2/8/8/4K3 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen a pawn. Pawns one file apart defend each other.',
            hint: 'If the king takes one pawn, the other runs. Bring your king first.',
          },
          {
            id: 'tp-split-2',
            title: 'Split pawns from the second rank',
            fen: '8/8/8/3k4/8/8/2P1P3/3K4 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen a pawn.',
            hint: 'Keep the pawns where the king cannot take one without letting the other run.',
          },
        ],
      },
    ],
  },
  {
    id: 'pawn-endings',
    title: 'Pawn endings',
    lead: 'The most important endgame of all. Read the board in this order: kings, opposition, key squares, pawn, promotion square.',
    sections: [
      {
        id: 'key-squares',
        title: 'Key squares',
        level: 2,
        rule:
          'A pawn on ranks 2–4 has three key squares two ranks ahead of it; from the fifth rank the three squares directly ahead count too. Your king on a key square wins, whoever is to move.',
        learn: [yt('key squares pawn endgame'), practice('Pawn Endgames › Key Squares')],
        puzzles: ['pawnEndgame'],
        drills: [
          {
            id: 'ks-1',
            title: 'Reach a key square',
            fen: '8/8/3k4/8/8/4K3/4P3/8 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn. Three of your seven moves throw the win away.',
            hint: 'The key squares of e2 are d4, e4 and f4. Get there before the pawn moves.',
          },
          {
            id: 'ks-2',
            title: 'Outflank the king',
            fen: '8/8/8/2k5/8/4K3/4P3/8 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn.',
            hint: 'King in front of the pawn, on the side away from the black king.',
          },
          {
            id: 'ks-3',
            title: 'From far away',
            fen: '4k3/8/8/8/2K5/8/4P3/8 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn. The king goes first.',
            hint: 'Race your king to the key squares (d5, e5, f5 once the pawn is on e4).',
          },
        ],
      },
      {
        id: 'passed-pawns',
        title: 'Passed pawns and the decoy',
        level: 2,
        rule:
          'An outside passed pawn is a decoy: let it be taken — it costs their king the time your king needs on the other wing.',
        learn: [yt('outside passed pawn endgame'), yt('pawn majority create passed pawn endgame')],
        puzzles: ['pawnEndgame', 'advancedPawn'],
        drills: [
          {
            id: 'pp-decoy',
            title: 'The far pawn',
            fen: '8/5kp1/8/P7/8/6P1/5K2/8 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win. The a-pawn pulls the black king away.',
            hint: 'Push the a-pawn; while the king chases it, your king eats the g-pawn.',
          },
          {
            id: 'pp-majority',
            title: 'Outside passed pawn',
            fen: '8/p4k2/6p1/8/8/6P1/P4K1P/8 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win with the extra pawn on the kingside.',
            hint: 'Make a passed pawn with h4 and g4, use it as a decoy, and go for the a-pawn.',
          },
        ],
      },
      {
        id: 'breakthrough',
        title: 'Pawn breakthrough',
        level: 3,
        rule: 'Three against three on the fifth rank: the middle pawn goes first.',
        learn: [yt('pawn breakthrough endgame three pawns')],
        puzzles: ['pawnEndgame'],
        drills: [
          {
            id: 'bt-classic',
            title: 'The classic breakthrough',
            fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Make a queen. The kings are too far away to help.',
            hint: 'The middle pawn goes first: b6!',
          },
        ],
      },
      {
        id: 'queen-v-pawn',
        title: 'Queen against a pawn on the seventh',
        level: 2,
        rule:
          'Against a centre or knight pawn: check closer until the king must step in front of its pawn, bring your king one step nearer, repeat. Against a rook or bishop pawn it is a draw by stalemate, unless your king is already close.',
        learn: [yt('queen vs pawn on the seventh rank endgame'), yt('queen vs rook pawn bishop pawn seventh rank draw stalemate')],
        puzzles: ['queenEndgame'],
        drills: [
          {
            id: 'qp-centre',
            title: 'Against a centre pawn',
            fen: '8/8/8/8/8/K7/3pk3/7Q w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win the pawn (or mate). Only four of 26 moves keep the win.',
            hint: 'Check so the king has to step in front of its pawn, then bring your king one step closer.',
          },
          {
            id: 'qp-knight',
            title: 'Against a knight pawn',
            fen: '8/8/8/8/8/K7/1pk5/7Q w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win against the b-pawn.',
            hint: 'Same method: force the king onto b1, then take a step with your king.',
          },
          {
            id: 'qp-rook-near',
            title: 'Rook pawn, king near',
            fen: '8/8/8/8/2K5/8/p1k5/7Q w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Your king is close enough: win.',
            hint: 'Stop the pawn first, then mate with king and queen together.',
          },
          {
            id: 'qp-rook-draw',
            title: 'Rook pawn: the stalemate defence',
            fen: '8/8/8/8/8/6K1/p7/1k5Q b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 10,
            task: 'Defend with Black. Only one move draws.',
            hint: 'Go to the corner next to your pawn: taking the pawn would be stalemate.',
          },
          {
            id: 'qp-bishop-draw',
            title: 'Bishop pawn: the stalemate defence',
            fen: '8/8/8/8/8/6K1/2p5/1k5Q b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 10,
            task: 'Defend with Black against the queen.',
            hint: 'If the queen pins or blocks, go to the corner: taking the pawn there is stalemate.',
          },
        ],
      },
    ],
  },
  {
    id: 'rook-endings',
    title: 'Rook endings',
    lead: 'The most common endgame by far — this is where the half-points are. Learn Lucena and Philidor as a pair: the first wins, the second draws.',
    sections: [
      {
        id: 'lucena',
        title: 'Lucena: building the bridge',
        level: 2,
        rule:
          'Pawn on the seventh, your king in front of it, their king cut off: rook to the fourth rank, king out, and the rook blocks the last check.',
        learn: [yt('Lucena position building a bridge'), practice('Rook Endgames › Basic Rook Endgames')],
        puzzles: ['rookEndgame'],
        drills: [
          {
            id: 'lucena-b',
            title: 'Lucena with the b-pawn',
            fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn: build the bridge.',
            hint: 'First push the black king one more file away with a check, then rook to the fourth rank.',
          },
          {
            id: 'lucena-c',
            title: 'Lucena with the c-pawn',
            fen: '2K5/2P1k3/8/8/8/8/1r6/5R2 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn.',
            hint: 'Check the king away (Re1+), then bring the rook to the fourth rank and walk out.',
          },
        ],
      },
      {
        id: 'philidor',
        title: 'Philidor: the third-rank defence',
        level: 2,
        rule:
          'Defender: keep the rook on your third rank until the pawn steps onto it, then drop to the far end and check from behind.',
        learn: [yt('Philidor position rook endgame third rank defence'), practice('Rook Endgames › Basic Rook Endgames')],
        puzzles: ['rookEndgame'],
        drills: [
          {
            id: 'philidor-d',
            title: 'Philidor against the d-pawn',
            fen: '3k4/7R/r7/3PK3/8/8/8/8 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Hold the draw with Black.',
            hint: 'Rook stays on the sixth rank. When the pawn goes to d6, rook to the first rank and check from behind.',
          },
          {
            id: 'philidor-e',
            title: 'Philidor against the e-pawn',
            fen: '4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Hold the draw with Black.',
            hint: 'Wait on the third rank (the sixth). Once e6 is played, check from behind.',
          },
        ],
      },
      {
        id: 'rook-v-pawn',
        title: 'Rook against pawn',
        level: 2,
        rule:
          'Bring your king in front of the pawn. If their king is still on its third rank, cut it off along your fifth.',
        learn: [yt('rook vs pawn endgame cut off fifth rank')],
        puzzles: ['rookEndgame'],
        drills: [
          {
            id: 'rvp-1',
            title: 'Stop the c-pawn',
            fen: '8/8/8/8/2k5/8/2p5/K6R w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win the pawn. About half your moves let it through.',
            hint: 'Your king must help: it covers b1/b2 while the rook takes the promotion square.',
          },
          {
            id: 'rvp-2',
            title: 'Rook from behind',
            fen: '7R/8/8/8/8/1pk5/8/K7 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win against the b-pawn.',
            hint: 'Check the king away from its pawn, then attack the pawn.',
          },
          {
            id: 'rvp-hold',
            title: 'The pawn holds',
            fen: 'R7/8/8/8/1k6/2p5/8/7K w - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'White moves first; their king is far away. Hold the draw with king and pawn.',
            hint: 'King and pawn together: shield the pawn with your king and push when you can.',
          },
        ],
      },
      {
        id: 'rook-technique',
        title: 'Cutting off the king, checks from the side',
        level: 3,
        rule:
          'A king cut off by files from the pawn is the attacker’s main weapon. When Philidor is no longer possible, the defending king goes to the short side so the rook has the long side for checks.',
        learn: [yt('cutting off the king rook endgame'), yt('short side defence rook endgame')],
        puzzles: ['rookEndgame'],
        drills: [
          {
            id: 'rt-convert',
            title: 'King cut off: convert',
            fen: '8/8/8/8/1k6/8/4PK2/7R w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'The black king is cut off. Queen the pawn without letting it back in.',
            hint: 'Put the rook on the d-file as a wall, then walk the pawn up with your king beside it.',
          },
          {
            id: 'rt-side-check',
            title: 'The only defence: check from the side',
            fen: 'r4k2/8/5K2/5P2/8/8/8/1R6 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Black to move. Passive defence loses against the f-pawn: one move holds.',
            hint: 'Check from the side, from far away, before the white king and pawn get organised.',
          },
        ],
      },
    ],
  },
  {
    id: 'minor-pieces',
    title: 'Minor pieces and material',
    lead: 'Bishop and knight endings, a piece against a pawn, and how to cash in an extra exchange.',
    sections: [
      {
        id: 'bishop-pawn',
        title: 'Bishop and pawn: the wrong bishop',
        level: 2,
        rule:
          'Bishop and pawn normally win. The exception: a rook pawn whose promotion corner the bishop does not control is a draw once the defending king reaches that corner. As defender, steer for it.',
        learn: [yt('wrong bishop rook pawn draw endgame')],
        puzzles: ['bishopEndgame'],
        drills: [
          {
            id: 'bp-wrong',
            title: 'Reach the corner',
            fen: '8/8/8/4k3/7P/8/2B5/6K1 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 14,
            task: 'White has the wrong bishop. Reach h8 and stay there.',
            hint: 'The bishop runs on light squares, h8 is dark: go for the corner.',
          },
          {
            id: 'bp-right',
            title: 'The right bishop',
            fen: '8/8/4k3/8/7P/8/8/2B3K1 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Your bishop controls h8: win.',
            hint: 'Bring the king to support the pawn; the bishop covers h8 from afar.',
          },
        ],
      },
      {
        id: 'knight-pawn',
        title: 'Knight and pawn',
        level: 2,
        rule:
          'Normally a win. The exception: a rook pawn on the seventh guarded by the knight does not win if their king is in the corner. Keep it on the sixth until your king arrives.',
        learn: [yt('knight and pawn vs king endgame rook pawn')],
        puzzles: ['knightEndgame'],
        drills: [
          {
            id: 'np-centre',
            title: 'Knight and centre pawn',
            fen: '8/8/8/3k4/8/3NP3/8/4K3 w - - 0 1',
            side: 'white',
            goal: 'promote',
            task: 'Queen the pawn with king and knight.',
            hint: 'King in front, knight guarding the pawn from behind.',
          },
          {
            id: 'np-rook-pawn',
            title: 'Rook pawn on the seventh',
            fen: '7k/P7/8/1N6/8/8/8/K7 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'The king is not in the corner yet: win.',
            hint: 'Make sure the queen survives — or keep the king away from a8 first.',
          },
        ],
      },
      {
        id: 'piece-v-pawn',
        title: 'A piece against a pawn',
        level: 2,
        rule:
          'The piece only has to control one square on the pawn’s path. A knight struggles most against a rook pawn.',
        learn: [yt('bishop vs pawn endgame knight vs pawn endgame')],
        drills: [
          {
            id: 'pvp-bishop',
            title: 'Bishop stops the pawn',
            fen: '8/8/8/8/1k6/8/p7/4K1B1 w - - 0 1',
            side: 'white',
            goal: 'draw',
            hold: 10,
            task: 'Stop the a-pawn. Only one move holds.',
            hint: 'Take control of a1 along the long diagonal.',
          },
          {
            id: 'pvp-knight',
            title: 'King and knight stop the pawn',
            fen: '8/8/8/8/8/1k6/2p5/3K1N2 w - - 0 1',
            side: 'white',
            goal: 'draw',
            hold: 10,
            task: 'Stop the c-pawn. Only one move holds.',
            hint: 'The knight cannot reach c1 in time: the king must.',
          },
        ],
      },
      {
        id: 'bishop-endings',
        title: 'Bishop endings',
        level: 3,
        rule:
          'Same colour: a draw if the defending king stands in front of the pawn on a square the bishop cannot attack. Opposite colours: blockade on the squares the other bishop cannot touch — one extra pawn is rarely enough.',
        learn: [yt('bishop and pawn vs bishop same colour endgame'), yt('opposite colored bishops endgame')],
        puzzles: ['bishopEndgame'],
        drills: [
          {
            id: 'be-same',
            title: 'Same-coloured bishops',
            fen: '8/8/4k3/8/3PK3/8/2B5/5b2 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Hold the draw with Black.',
            hint: 'Get your king to d6, a dark square in front of the pawn that the white bishop can never attack.',
          },
          {
            id: 'be-opposite',
            title: 'Opposite-coloured bishops',
            fen: '8/8/3kb3/8/3PK3/8/5B2/8 b - - 0 1',
            side: 'black',
            goal: 'draw',
            hold: 15,
            task: 'Hold the draw with Black.',
            hint: 'Blockade d5 (a light square) and never let the king through.',
          },
        ],
      },
      {
        id: 'material',
        title: 'Winning with extra material',
        level: 2,
        rule:
          'Trade into a won ending, keep your pawns protected, and use the extra piece to cut off their king. An extra exchange usually wins once a pawn becomes passed.',
        learn: [yt('winning with an extra exchange endgame technique')],
        puzzles: ['endgame'],
        drills: [
          {
            id: 'mat-rook-bishop',
            title: 'Rook and pawn against bishop',
            fen: '8/5k2/8/8/4K3/2bP4/8/R7 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win: the exchange plus a pawn.',
            hint: 'Use the rook to drive the bishop off the pawn, then push with king support.',
          },
          {
            id: 'mat-rook-knight',
            title: 'Rook and pawn against knight',
            fen: '8/8/8/3k4/8/2n5/4KP2/4R3 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win: keep the knight away from your pawn.',
            hint: 'King next to the pawn, rook cutting off the black king.',
          },
          {
            id: 'mat-queen-rook',
            title: 'Queen and pawn against rook',
            fen: '8/8/8/4k3/8/8/1r2PK2/4Q3 w - - 0 1',
            side: 'white',
            goal: 'win',
            task: 'Win: watch out for rook checks and skewers.',
            hint: 'First safeguard your king and pawn from the rook; then push.',
          },
        ],
      },
    ],
  },
  {
    id: 'mastery',
    title: 'Mastery (1500–1800)',
    lead: 'When the rest is easy: the harder mates and the famous studies.',
    sections: [
      {
        id: 'two-bishops',
        title: 'Two bishops mate',
        level: 3,
        rule: 'The bishops stand side by side and build a wall, the king pushes, mate comes in the corner.',
        learn: [yt('two bishops checkmate'), practice('Piece Checkmates II')],
        drills: [
          {
            id: 'bb-centre',
            title: 'Two bishops from the centre',
            fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
            side: 'white',
            goal: 'mate',
            targetSec: 120,
            task: 'Mate with the two bishops.',
            hint: 'Bishops side by side form a wall; your king takes the opposition to push.',
          },
          {
            id: 'bb-random',
            title: 'Two bishops from anywhere',
            random: 'KBBvK',
            side: 'white',
            goal: 'mate',
            targetSec: 120,
            task: 'A new position every time: mate with the two bishops.',
            hint: 'Wall, push, corner. Watch out for stalemate in the corner.',
          },
        ],
      },
      {
        id: 'reti',
        title: 'Réti’s idea',
        level: 3,
        rule: 'A diagonal king step can chase their pawn and support your own at the same time.',
        learn: [yt('Reti endgame study king and pawn')],
        puzzles: ['zugzwang'],
        drills: [
          {
            id: 'reti-study',
            title: 'The Réti study',
            fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
            side: 'white',
            goal: 'draw',
            hold: 6,
            task: 'White to move draws. It looks impossible — only one move does it.',
            hint: 'Walk diagonally: towards the h-pawn and towards your own pawn at once.',
          },
        ],
      },
    ],
  },
];

export const PUZZLE_GROUPS: PuzzleGroup[] = [
  {
    id: 'patterns-1',
    title: 'Mating patterns · L1',
    lead: 'See them at a glance. With every enemy king ask: which flight squares are gone, which of my pieces can join, which checks are there?',
    tests: [
      { theme: 'mateIn1', filter: 'supportedQueenMate', title: 'Supported-queen mate', level: 1, size: 20, about: 'The queen lands next to the king, protected by another piece, and takes every flight square.' },
      { theme: 'backRankMate', title: 'Back-rank mate', level: 1, size: 20, about: 'A rook or queen mates on the back rank because the king is shut in by its own pawns.' },
      { theme: 'smotheredMate', title: 'Smothered mate', level: 1, size: 20, about: 'A knight mates a king walled in by its own pieces.' },
    ],
  },
  {
    id: 'patterns-2',
    title: 'Mating patterns · L2',
    lead: 'The named mates from the checklist, and those added in review.',
    tests: [
      { theme: 'arabianMate', title: 'Arabian mate', level: 2, size: 20, about: 'A knight and a rook trap the king in a corner: the rook mates next to it, the knight guards the rook and the last square.' },
      { theme: 'anastasiaMate', title: 'Anastasia’s mate', level: 2, size: 20, about: 'A knight and a rook or queen trap the king between the edge of the board and one of its own pieces.' },
      { theme: 'epauletteMate', title: 'Epaulette mate', level: 2, size: 20, about: 'The two squares beside the checked king are blocked by its own pieces (the “epaulettes”).' },
      { theme: 'bodenMate', title: 'Boden’s mate', level: 2, size: 20, about: 'Two bishops on criss-crossing diagonals mate a king boxed in by its own pieces.' },
      { theme: 'cornerMate', title: 'Corner mate', level: 2, size: 20, about: 'A rook or queen confines the king to the corner; a knight gives the mate.' },
      { theme: 'hookMate', title: 'Hook mate', level: 2, size: 20, about: 'Rook, knight and pawn mate together, with one of the king’s own pawns taking its escape.' },
      { theme: 'operaMate', title: 'Opera mate', level: 2, size: 20, about: 'A rook checks the king and a bishop defends the rook.' },
      { theme: 'dovetailMate', title: 'Dovetail mate', level: 2, size: 20, about: 'The queen mates right next to the king; its only two escape squares are blocked by its own pieces.' },
      { theme: 'swallowstailMate', title: 'Swallow’s tail mate', level: 2, size: 20, about: 'A V shape: the queen mates from in front of the king, the squares behind it blocked by its own pieces.' },
      { theme: 'blindSwineMate', title: 'Blind swine mate', level: 2, size: 20, about: 'Two rooks mate the king inside a 2×2 corner area, usually from the seventh rank.' },
    ],
  },
  {
    id: 'patterns-3',
    title: 'Mating patterns · L3',
    lead: 'The extended set, for when the rest is easy.',
    tests: [
      { theme: 'doubleBishopMate', title: 'Double bishop mate', level: 3, size: 20, about: 'Two bishops on adjacent diagonals mate a king boxed in by its own pieces.' },
      { theme: 'morphysMate', title: 'Morphy’s mate', level: 3, size: 20, about: 'The bishop checks the king while a rook confines it.' },
      { theme: 'pillsburysMate', title: 'Pillsbury’s mate', level: 3, size: 20, about: 'The rook gives mate while the bishop helps to confine the king.' },
      { theme: 'killBoxMate', title: 'Kill box mate', level: 3, size: 20, about: 'A rook next to the king, supported by the queen: together they trap the king in a 3×3 box.' },
      { theme: 'triangleMate', title: 'Triangle mate', level: 3, size: 20, about: 'Queen and rook on the same line, one square from the king and one square apart: a triangle with the king.' },
      { theme: 'vukovicMate', title: 'Vuković mate', level: 3, size: 20, about: 'A rook and a knight: the rook mates, supported by a third piece, and the knight covers the escape squares.' },
      { theme: 'balestraMate', title: 'Balestra mate', level: 3, size: 20, about: 'A bishop gives the mate while the queen blocks the remaining escape squares.' },
    ],
  },
  {
    id: 'endgame-tests',
    title: 'Endgame puzzle tests',
    lead: 'Nobody tells you which rule applies. That is the point.',
    tests: [
      { theme: 'pawnEndgame', title: 'Pawn endings', level: 2, size: 30, about: 'Mixed king-and-pawn positions from real games.' },
      { theme: 'rookEndgame', title: 'Rook endings', level: 2, size: 30, about: 'Rook endings are the most common endgame by far.' },
      { theme: 'queenEndgame', title: 'Queen endings', level: 3, size: 20, about: 'Centralise the queen and look for perpetual check.' },
      { theme: 'bishopEndgame', title: 'Bishop endings', level: 3, size: 20, about: 'Mixed bishop positions from real games.' },
      { theme: 'knightEndgame', title: 'Knight endings', level: 3, size: 20, about: 'Mixed knight positions from real games.' },
      { theme: 'zugzwang', title: 'Zugzwang', level: 3, size: 20, about: 'Spare tempi, triangulation, mutual zugzwang: whoever has to move loses.' },
      { theme: 'promotion', title: 'Pawn races and promotion', level: 2, size: 20, about: 'Count both sides’ moves; who queens with check?' },
    ],
  },
];

/** Share of first-try solves a puzzle test asks for. */
export const PUZZLE_PASS = 0.8;

export const ALL_SECTIONS: Section[] = STAGES.flatMap((s) => s.sections);
export const ALL_DRILLS: Drill[] = ALL_SECTIONS.flatMap((s) => s.drills);
export const ALL_TESTS: PuzzleTest[] = PUZZLE_GROUPS.flatMap((g) => g.tests);

const drillIndex = new Map(ALL_DRILLS.map((d) => [d.id, d]));
const sectionOfDrill = new Map(ALL_SECTIONS.flatMap((s) => s.drills.map((d) => [d.id, s] as const)));

export function drillById(id: string): Drill | undefined {
  return drillIndex.get(id);
}

export function sectionOf(drillId: string): Section | undefined {
  return sectionOfDrill.get(drillId);
}

export function testByTheme(theme: string): PuzzleTest | undefined {
  return ALL_TESTS.find((t) => t.theme === theme);
}

export const LEVEL_LABEL: Record<Level, string> = { 1: 'L1 · automatic', 2: 'L2 · required', 3: 'L3 · 1500–1800' };

export function goalText(goal: Goal, side: Side, hold?: number): string {
  const who = side === 'white' ? 'White' : 'Black';
  switch (goal) {
    case 'mate':
      return `${who}: give mate`;
    case 'promote':
      return `${who}: queen a pawn and keep the win`;
    case 'win':
      return `${who}: win (mate, a safe queen, or only their king left)`;
    case 'draw':
      return `${who}: hold the draw${hold ? ` for ${hold} moves` : ''}`;
  }
}
