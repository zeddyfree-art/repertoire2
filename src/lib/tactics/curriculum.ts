// The tactics path and the calculation ladders.
//
// How the path is built, and why:
// 1. Learn — one motif at a time (blocked practice), easier than your rating so most puzzles succeed. New skills are
//    acquired fastest when practice is focused and success is high (around 85%).
// 2. Mix — the motifs of the module shuffled, theme hidden, and after each puzzle you name the motif. Interleaving is
//    harder while practising but teaches you to tell the motifs apart: in a game nobody tells you which one it is.
// 3. Combine — puzzles in which two or more motifs work together, at your own rating.
// 4. Woodpecker — the whole module again, three cycles, each faster than the last: the patterns become automatic.
// Every miss also goes into a review queue with growing intervals (spaced retrieval), as with the endgame drills.

export interface Motif {
  theme: string;
  name: string;
  /** What to look for, one line. */
  lookFor: string;
}

export interface Module {
  id: string;
  title: string;
  lead: string;
  motifs: Motif[];
}

const m = (theme: string, name: string, lookFor: string): Motif => ({ theme, name, lookFor });

export const MODULES: Module[] = [
  {
    id: 'foundations',
    title: 'Foundations: loose pieces and double attacks',
    lead: 'Most games below 2000 are decided by these. “Loose pieces drop off.”',
    motifs: [
      m('hangingPiece', 'Hanging piece', 'Which pieces are undefended, or attacked more often than defended?'),
      m('fork', 'Fork', 'One piece attacking two targets: look at knight jumps and queen checks first.'),
      m('pin', 'Pin', 'A piece that cannot move without exposing something bigger behind it. Attack the pinned piece.'),
      m('skewer', 'Skewer', 'A pin the other way round: the big piece in front must move and the one behind falls.'),
      m('discoveredAttack', 'Discovered attack', 'Move one piece out of the way and the piece behind it attacks — best of all with a threat of its own.'),
      m('trappedPiece', 'Trapped piece', 'A piece with no safe square left: attack it.'),
    ],
  },
  {
    id: 'king',
    title: 'Attacking the king',
    lead: 'Checks first, every time: forcing moves leave the opponent no time.',
    motifs: [
      m('backRankMate', 'Back rank', 'A king shut in behind its own pawns: is the back rank defended enough?'),
      m('mateIn2', 'Mate in 2', 'All checks, all captures, all threats — and every reply.'),
      m('attackingF2F7', 'Attack on f2/f7', 'The weakest square at the start, guarded only by the king.'),
      m('exposedKing', 'Exposed king', 'A king without pawn cover: bring pieces with tempo.'),
      m('doubleCheck', 'Double check', 'Two checks at once: only a king move helps. Look for the discovered check that also checks.'),
      m('sacrifice', 'Sacrifice', 'Give material to rip the king open or to reach mate. Count what you get back.'),
    ],
  },
  {
    id: 'defenders',
    title: 'Removing the defender',
    lead: 'When the target is defended, deal with the defender first.',
    motifs: [
      m('capturingDefender', 'Capture the defender', 'Take the piece that guards the target, then take the target.'),
      m('deflection', 'Deflection', 'Force a defender away from the square or piece it guards.'),
      m('attraction', 'Attraction', 'Lure a piece (often the king) onto a square where it gets forked, mated or skewered.'),
      m('interference', 'Interference', 'Put a piece between a defender and what it defends.'),
      m('clearance', 'Clearance', 'Move your own piece off a square or line so another piece can use it.'),
      m('xRayAttack', 'X-ray', 'A piece that attacks or defends through another piece on the same line.'),
    ],
  },
  {
    id: 'subtle',
    title: 'Subtle moves',
    lead: 'The moves a quick look misses: the in-between move, the quiet move, the defence.',
    motifs: [
      m('intermezzo', 'In-between move', 'Before recapturing: is there a check or a bigger threat first?'),
      m('quietMove', 'Quiet move', 'No check, no capture — but it creates a threat that cannot be met.'),
      m('defensiveMove', 'Defensive move', 'The only move that saves you. What does the opponent threaten?'),
      m('advancedPawn', 'Advanced pawn', 'A pawn close to promotion is worth a piece: push, deflect, promote.'),
    ],
  },
];

export const ALL_MOTIFS: Motif[] = MODULES.flatMap((mod) => mod.motifs);
const motifIndex = new Map(ALL_MOTIFS.map((x) => [x.theme, x]));
export const motifByTheme = (theme: string) => motifIndex.get(theme);

/** Themes that count as a tactical motif when deciding whether a puzzle combines several. */
export const COMBINATION_THEMES = new Set([
  ...ALL_MOTIFS.map((x) => x.theme),
  'discoveredCheck',
  'overloading',
  'mateIn3',
  'mateIn4',
  'smotheredMate',
  'promotion',
  'underPromotion',
]);

/** Sizes and difficulty of the phases. Rating offsets are added to your tactics rating when a set is made. */
export const PHASES = {
  learn: { size: 8, pass: 7, offset: -300 },
  mix: { size: 24, pass: 0.8, offset: -150 },
  combine: { size: 16, pass: 0.7, offset: 0 },
  woodpecker: { cycles: 3, pass: 0.85, speedup: 0.6 },
} as const;

export type PhaseId = 'learn' | 'mix' | 'combine' | 'woodpecker';

export const PHASE_INFO: Record<PhaseId, { title: string; why: string }> = {
  learn: {
    title: 'Learn',
    why: 'One motif at a time, a little below your rating, with the motif named. Focused practice with a high success rate builds the pattern.',
  },
  mix: {
    title: 'Mix',
    why: 'The motifs shuffled and hidden; afterwards you name the motif. Harder while practising, but it teaches you to recognise them — in a game nobody tells you.',
  },
  combine: {
    title: 'Combine',
    why: 'Two or more motifs working together, at your own rating: what real combinations look like.',
  },
  woodpecker: {
    title: 'Woodpecker',
    why: 'The whole module again, three times, each cycle faster: from knowing the patterns to seeing them at once.',
  },
};

// ---------- Calculation ----------

export interface Rung {
  theme: string;
  title: string;
  /** Your moves in the solution. */
  depth: number;
}

/** The mate ladder: the board stays still while you calculate the whole line. */
export const MATE_LADDER: Rung[] = [
  { theme: 'mateIn2', title: 'Mate in 2', depth: 2 },
  { theme: 'mateIn3', title: 'Mate in 3', depth: 3 },
  { theme: 'mateIn4', title: 'Mate in 4', depth: 4 },
  { theme: 'mateIn5', title: 'Mate in 5', depth: 5 },
];

export const MAX_GHOST_DEPTH = 10;
/** Move up a rung or a depth at 8 of the last 10 at the first try. */
export const LADDER_WINDOW = 10;
export const LADDER_PASS = 8;
/** Calculation puzzles come a little below your tactics rating: the board does not help you here. */
export const CALC_OFFSET = -250;
