# Warm Studio A2 — Build / Train / Tree and brand (16 Nov 2026)

## Shipped changes
- Build, Train and Tree each have a consistent Warm Studio workspace header, a contextual repertoire chip and quick Home action. The underlying builder, training algorithm, Maia, tree pan/zoom, move editing, annotations, Lichess/engine, import/export and backups were not rewritten.
- Scoped workspace CSS adds a focused chessboard surface, calmer section cards, more legible toolbars, subdued explorer tabs and coordinated training feedback/progress.
- Desktop board width accounts for the new sidebar; mobile and mid-width breakpoints adapt without removing features.
- An original **laurel knight** SVG replaces the generic old knight. It is used in the app's navigation, favicon and PWA vector identity. Deployment rasterizes the new SVG to PNG icons at 192/512/180 px for PWA/Apple.
- The approved photographic ivory chess queen is a small optimized hero JPEG in `public/warm-studio-hero.jpg`, visible in the dashboard heading in light mode, subtle in dark mode. A gradient mask protects legibility.
- Theme mode remains Light/System/Dark. Browser-storage isolation from the original app remains unchanged.
- Automated browser regressions now cover Build, Tree and Train (laptop and phone), navigation to Home, visible controls, image availability and horizontal overflow.

## Follow-up / quality checks
- Review visual rendering with the user's actual Slav Black PGN on laptop and phone, especially the Tree on large repertoires and nested branch variation.
- Validate preservation of real repertoire data/import/export separately; this change is presentation-scoped and does not assert complete PGN fidelity.
- Some legacy PNG assets in the Git repository remain unchanged as sources; **deployed** PNG icons are regenerated from the SVG by GitHub Pages. Check installation/update on Android/iOS because installed PWA icon caches may persist.
- Full UI redesign of sub-tools within Build, Train and Tree (e.g. moving explorer tabs, additional collapsible settings) is deferred intentionally; this release keeps every function discoverable and minimizes regression risk.
- GitHub Actions deployment has an additional dependency, `librsvg2-bin`, for raster icon generation; monitor deployment and keep a fallback if package availability changes.
- The repository's npm audit warnings and full run of legacy Playwright E2E suite remain separate technical follow-ups.

## Suggested manual acceptance
1. On laptop, inspect Home greeting photograph, logo, Build with Lichess/Engine tab, Train Today's session, and Tree zoom/focus.
2. On phone, switch Light/Dark, open Build board, verify move arrows and horizontal scrolling, Train a review card, then Tree portrait navigation.
3. Optionally re-install PWA to refresh its home-screen icon after verifying data is backed up (do not remove installation casually if it contains local-only data).

Source of product/design decisions: approved Warm Studio A2 mockup and the follow-up request for logo, hero, Build, Train and Tree polish.
