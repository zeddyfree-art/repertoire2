# Warm Studio A2 — implementation handoff

Reference: the user's approved warm-ivory desktop dashboard mock-up shared in the conversation (16 November 2026). This note records the intended design and honest remaining differences.

## Implemented in this UI iteration
- Desktop sidebar with Home / Train / Build / Tree / Play / Games / Check and Settings; same underlying app views, no removed modes.
- Mobile bottom navigation to keep seven main destinations in reach.
- Editorial greeting with a soft chess-piece motif, warm ivory surfaces, green daily-training hero, serif display titles and sage accents. Dark mode remains supported.
- Three-way header theme pill: Light / Follow system / Dark; the existing Settings control also remains. Theme preference remains isolated to Repertoire 2.
- Working selected-repertoire chessboard, using the app's real Chessground board and stored repertoire main line. Previous/next, timed play/pause and Open in builder are functional. Never substitutes a made-up opening for missing repertoire data.
- Today's session is linked to the real `trainToday()` action.
- Three metric tiles: today's actual card count, reviewed-card learning percentage and prepared-line count.
- Progress card: real SRS-card counts and per-repertoire learned percentages. Chart counts only the **latest recorded review** per card during the last seven days. It is not total daily reviews, total accuracy or a streak.
- Direct actions for Build, Play vs Maia and Games analysis.
- Existing repertoire library preserved (reordering, pause/study, menu, PGN, Build/Tree/Train).
- Auto/unit/browser tests cover underlying summary calculations, live board, theme toggle and desktop/phone layouts.

## Deliberate fidelity/functional trade-offs
1. **Header illustration.** The approved mockup shows photographic blurred ivory chess pieces. Current implementation uses an unobtrusive typographic chess motif, so the site remains fast, crisp and asset-free. A bespoke illustration is still a visual enhancement opportunity.
2. **Graph truthfulness.** The current data model stores each card's latest review, not a complete review event history; therefore the mini chart is explicitly labeled and does not invent trends. A proper event log is required for daily reviews, accuracy chart and true training streak.
3. **Mainline preview.** The display follows the first stored move per position up to 16 plies, preventing cycles in transpositions. Choosing a variation from the board is not yet provided; Build/Tree remain the full tools.
4. **Non-dashboard screens.** Build/Tree/Train/Play/Games/Check retain their established functional layouts and the shared Warm Studio palette. A dedicated workspace redesign for each remains.
5. **Mobile polish.** The phone navigation and stacking are implemented and browser-smoke-tested, but real-device touch, Safari and tablet QA remain valuable.

## Product choices to revisit later (not release blockers)
- Should the header retain the quiet typographic chess motif, or commission/create a high-quality warm photographic chess header as in the mockup?
- Do we want a true training-streak and complete review-history log? That is a separate product/data-model feature, not a styling change.
- Should the initial dashboard board follow the repertoire's main line, the last-studied position, or user-pinned positions? Main line is the safe default.
- For the next full-screen redesign, prioritize **Build** (editing workspace) versus **Train** (focused training session). The dashboard already points clearly to both.

## QA / non-goals
- Maintain independence from the original `/chess/` app's data, Google Drive roles, browser caches and tokens.
- Do not claim static reference-image metrics were real (e.g. 86% accuracy, 7-day streak or 1,248 mastered positions).
- Never remove backup/PGN/export/undo/engine or training options in pursuit of visual consistency.
- Review npm dependency-audit warnings separately before considering a security clean bill.
