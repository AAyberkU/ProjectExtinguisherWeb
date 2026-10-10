# Bugs and Risks

## Confirmed bugs (jam build)

- Clicks are accepted while Larry is still hopping; the running animation is cancelled and Larry
  snaps to the new tile.
- The win or loss overlay is set in the same dispatch as the move, so it can appear before Larry
  lands.
- Jam rules softlock: loss only triggers at 0 moves, and visited tiles cannot be re-entered, so a
  boxed-in player with moves left gets no loss state. (Goes away with the hex-steps engine, which
  loses when no legal move exists.)
- A jam level cell may carry both a catapult and a move bonus; it renders as a catapult but also
  grants the bonus. (Jam format only.)
- The completion overlays say "Press R to Reset" on touch devices.

## Open technical risks

- **Rules mismatch:** the shipped engine runs the jam rules, not hex-steps. Roadmap step 1.
- **Renderer:** the board is destroyed and rebuilt on every state change; idle hover animations keep
  the ticker rendering at 60 fps forever; render resolution is forced to at least 2x even on 1x
  screens. All three are scheduled in roadmap step 1.
- **Portrait:** phones in portrait see a "rotate your device" screen (`main.scss`); the board fit is
  hard-coded for the 61-cell board (`BOARD_FIT_WIDTH`/`HEIGHT` in `PixiStage.tsx`). Roadmap step 3.
- **Release blockers for portals:** fonts load from Google Fonts (`index.html`); there is no portal
  adapter, ad-break pause, or save system yet.
- **No automated tests, lint, or CI.** Typecheck and build are the only gates. Oracle tests arrive in
  step 1.
- **Dependencies:** nine packages in `apps/web/package.json` are pinned to `latest` (only the lockfile
  keeps builds reproducible), and build tools sit in `dependencies` instead of `devDependencies`.
- **Vite config shadowing:** `tsc -b` emits `apps/web/vite.config.js`, and Vite prefers
  `vite.config.js` over `vite.config.ts`. A stale emitted file could hide edits to the TS config
  until the next typecheck. (The file is no longer tracked, but it still exists after builds.)
- **Audio:** each SFX is downloaded twice (Web Audio buffer plus HTMLAudio fallback, about 100 KB);
  iOS Safari ignores `HTMLAudioElement.volume`, so music may play at full volume there; there is no
  gain-bus structure for settings or ad pauses; the AudioContext is not suspended when the page is
  hidden. Autoplay may still block music until the first input.
- **Large boards:** 91-cell levels may be hard to read on phones in portrait with every wall drawn.
- **Placeholder art:** the flat-top jam tiles are rotated 30 degrees; final pointy-top art is
  pending.
- **Bundle:** the JS chunk is about 680 KB minified (about 200 KB gzip), mostly Pixi and React. Vite
  warns above 500 KB. Acceptable for now; revisit with portal size budgets.

## Fixed

- Asset delivery: full-size PNG and WAV imports replaced by the `npm run assets` pipeline (build
  about 53 MB to 4.7 MB; first gameplay load about 2 MB plus JS). A production-only bug where the
  CSS background URL resolved against the stylesheet was fixed before merge (2026-10-10).
- Start transition: the "Loading Game 100%" panel no longer shows on normal starts (2026-10-10).
- Cold-load startup: waits for background and textures, synchronizes the first intro cue with the
  mounted board, and offers Retry on load failure.
- Music no longer restarts on every pointer or key input.
- SFX moved from per-play `new Audio()` to pre-decoded Web Audio buffers.
- Catapult movement animates through the catapult tile.
- Earlier jam-port fixes: placeholder tiles replaced by Unity art; Unity Levels 1-5 converted; board
  orientation corrected; bootstrap UI replaced by the full-screen menu and HUD.
