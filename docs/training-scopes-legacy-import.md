# Repertoire 2 — Training roles, progress and migration from Repertoire 1

## Training: two independent decisions

1. **Purpose (one of two):** In play / Study.
   - **In play:** the repertoire represents openings you currently play. Game analysis and Insights may check your moves against it.
   - **Study:** you are learning this repertoire with SRS, but it should not be used to grade your real games.
2. **SRS training (on/off):** can be paused for either purpose. Pausing does not erase cards, intervals or review dates; it removes the repertoire from today's session. Resuming restores the existing review schedule.

These are independent dimensions, so a single three-state picker would be misleading. The Home cards now expose a purpose toggle plus a separate SRS checkbox. The original pause/resume menu remains available.

## Dashboard: what each number really means

- **Daily session:** the actual session assembled by the Train engine across every unpaused repertoire (In play and Study), plus enabled mistake cards. This number never changes with the dashboard summary filter.
- **Moves reviewed:** number of prepared player-move SRS cards that have been reviewed at least once divided by total prepared player-move cards. **Not** mastery, retention or win rate. It includes moves temporarily beyond the SRS training-depth setting so a depth change does not distort the denominator.
- **Prepared lines:** number of terminal opening variations stored in the selected repertoires. It measures how much you prepared, not how many moves you memorized.
- **Your progress:** selectable view:
  - **Training now (default):** all unpaused repertoires, regardless of game-use purpose.
  - **In play:** repertoires used for game analysis, including those whose SRS is paused.
  - **Study:** repertoires not used for game analysis, including those whose SRS is paused.
  - **All:** everything, including paused SRS.
- Percentages are calculated from the total *number of moves*, not the simple average of repertoire percentages. Paused repertoires have their own marker.
- The last-seven-days graph counts cards whose **most recent** review was on a day; it is not a full per-day review-event history. An accurate streak and accuracy chart require storing a new event log, proposed separately.

## Repertoire 1 migration

The apps are separate but share browser origin `zeddyfree-art.github.io` when opened in the same browser profile. The original app stores data in IndexedDB `repertoire-data` (store `app`, key `data`), and its games at key `games`. Repertoire 2 uses `repertoire2-data`.

**Safety:**
- The bridge opens the original DB without changing its version, only uses **read-only** transactions and aborts creation if the legacy DB does not exist.
- Never writes to, deletes or upgrades Repertoire 1 data; never reads old Google Drive files.
- Consent preview shows the number of repertoires, SRS cards, reviewed cards and their In play/Study/Paused status.
- User chooses **Import missing data** or **Not now**. Declining is remembered in Repertoire 2 browser storage. Settings → Import from Repertoire 1 remains available at any time.
- A local Repertoire 1 backup JSON from a different browser/device can also be selected in Settings for additive import. It contains repertoire/SRS data, not a separate game-history file.
- Imported repertoires retain original positions, annotations, SRS schedules, card IDs, last-review dates, purpose and paused flags. Existing Repertoire 2 repertoire IDs, profiles and SRS cards are **never overwritten**. Same-named repertoires with different IDs may both appear. Import selects the newly added player's repertoire so the result is visible immediately.
- Optional checkbox adds missing game history and mistakes from the old *same-browser* database; off by default.
- New data enters Repertoire 2's existing independent Google Drive sync, if enabled.
- No automatic migration of browser preferences, OAuth tokens or app identity.

**Future migration gap:** this is a safe one-time/additive migration, **not** an ongoing two-way merge of SRS records with matching repertoire IDs. Users wishing to reconcile divergent SRS histories between both apps need a separate comparison workflow, not silent overwriting.

## Deliberately deferred

1. Announcement in **Repertoire 1**: do **not** change the old app or show a migration message until the owner confirms thorough end-to-end acceptance.
2. Full SRS activity history and genuine accuracy/streak statistics, ideally using append-only review events and a definition of mastery (e.g. stability/estimated retention).
3. Data reconciliation tests with users' actual repertoires and Google Drive across two devices; the functional importer has isolated unit and laptop/phone browser regressions but is still a new feature.
4. Logo assets are generated from the original higher-resolution source images and versioned as `brand3`. They remain raster pictures inside SVG wrappers, not technically vector illustrations; while markedly sharper on retina screens, infinite-resolution vectorization would require a separate artwork rebuild.
