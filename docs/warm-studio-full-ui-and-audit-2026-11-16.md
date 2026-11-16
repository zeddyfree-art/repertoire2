# Repertoire 2 — Warm Studio complete UI pass and audit status

Date: 16 November 2026. Design direction: **A2 Warm Studio**, inspired by the owner's approved editorial chess dashboard. Light, Dark and System modes, with an ivory/sage chessboard and original chess/leaf identity.

## Implemented in this release
- **Play:** Warm Studio header, spacious configuration panel, clear Casual practice vs Rated challenge entry (retaining Maia level, clock, color, openings, hints, game analysis, rating categories and game history).
- **Games:** editorial library; live counts of imported games, completed analysis, games needing analysis and potentially trainable moments; accessible speed filters; game review and Insights inherit consistent surfaces and typography.
- **Check:** contextual header; genuine summaries of saved repertoire gaps, engine flags and line ends (dashes when no run exists); existing actionable gap tours and engine tools retained.
- **Settings:** section shortcuts to Players, Appearance, Sync, Lichess and Backups, better responsive spacing and cards, all original controls retained.
- **About and first-run onboarding:** editorial brand styling, proper project links.
- **Shared shell:** same navigation, header language, responsive layout, cards and typographic system across Home, Build, Train, Tree, Play, Games, Check and Settings.
- **Data safety:** additional localStorage isolation for current Maia game, play preferences, last Lichess import, game filters, analysis preference, per-player repertoire scope, Check preferences and Insights filters. The original /chess/ app is never used as an automatic import source.

## Audited against original steps
- P0 — local browser data / Drive / PWA separation: namespaced main IndexedDB and Drive previously; this pass closes additional previously overlooked UI and active-session keys. Tests check new names.
- P1 — navigation: unified desktop sidebar, phone navigation and consistent workspace contextual headers. Existing menu destinations retained.
- P1 — home: primary training CTA, real repertoire preview board and progress without fabricated data.
- P1 — training and builder: bespoke warm board-focused layouts shipped in earlier release; no change to FSRS/engine/PGN internals in this pass.
- P2 — tree: dedicated atlas and tree tool layout shipped in earlier release.
- P2 — Play, Games, Check and Settings: finished in this release.
- P2 — visual system: scoped tokens across studio.css, workspace.css and studio-finish.css, retaining older CSS for safety.
- P2 — QA: TypeScript, Vitest and production build in CI; desktop and phone Playwright smoke tests now include all major view shells and active controls.

## Known limitations and next phase
1. **Real-life acceptance:** Browser automation is not equivalent to native Safari/Chrome on the owner's laptop and phone. Verify touch targets, focus, scroll, puzzle/engine responsiveness and PWA icon installation.
2. **Data integrity:** Full import/export of the owner's real ~45 KB Slav Black PGN, a complex variation tree and backup roundtrips still need a dedicated functional acceptance pass. This visual pass does not claim that all repertoire records are validated.
3. **Cloud sync:** Separate Google Drive identity is implemented but its two-device end-to-end reconciliation with live data remains untested. Keep original backup safe.
4. **Analytics history:** True review-event history, accuracy and streaks cannot be drawn from only the latest SRS review on each card. A future review-log feature is a product decision.
5. **Performance and dependencies:** The app may load a sizable chess/AI runtime. Split bundles and investigate npm audit warnings; do not treat UI smoke tests as a security audit.
6. **Legacy preferences:** Previously used shared preferences for current Maia game and saved filters are intentionally not auto-migrated from v1, because both apps share one origin. The new v2-specific keys start fresh. Stored repertoire, training and game history stay in the v2 IndexedDB.
7. **Accessibility:** Keyboard, reduced-motion, ARIA labelling and responsive smoke tests improved, but no independent WCAG/assistive-technology audit has been completed.

## Owner decisions (not blockers)
- Whether to extend the dashboard with actual historical review logs, streaks and accuracy.
- Whether to prioritize polishing real-game review interactions / very large tree rendering, after testing the supplied Slav repertoire.
- Whether current app identity and the warm photo should remain the final default in both light and dark modes.

## Release philosophy
Preserve all original chess capabilities. Visual design changes are additive. No speculative metrics; no cross-application data migration; no automatic cloud file mixing.
