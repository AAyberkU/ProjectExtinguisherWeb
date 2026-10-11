# Bugs and Risks

## Confirmed bugs

- None known in the current build. The end-to-end campaign run and the renderer checks pass.

## Open technical risks

- **Portrait layout:** the board fits portrait screens, but the HUD keeps its landscape arrangement and
  big boards leave large empty areas above and below. Roadmap step 3.
- **Large boards:** 91-cell levels are small on phones in portrait with every wall drawn.
- **Loop validation gap (editor and engine):** a mover/launcher chain can still hit the 32-link limit
  at runtime in rare layouts (collected `+1` between facing movers, or movers swapped onto floor
  cells). No pool level is affected. See `docs/rules.md`; to report to Uğur.
- **Missing rule fixtures:** the GDD's fixture files (`levels/fixtures/*.json`) are not in our tests
  yet.
- **"Stuck" loss** is unreachable in every current campaign level, so its animation is only covered
  by a hand-made test level.
- **Tutorial hint text** covers part of the tile row above (or below) the glowing tile on dense
  boards (taps still reach the board), and the glow pulses again each time it reappears.
- **Level 1 shows two hints in a row** (the goal, then +1), because +1 first appears there.
- **Intro input lock:** input is ignored during the level intro (up to about 0.6 s on 91-cell
  boards). Letting a key press skip the intro would be a small improvement.
- **Release blockers for portals:** fonts load from Google Fonts (`index.html`); there is no portal
  adapter or ad-break pause yet, and saves have no per-portal namespace.
- **Dependencies:** nine packages in `apps/web/package.json` are pinned to `latest` (only the lockfile
  keeps builds reproducible), and build tools sit in `dependencies` instead of `devDependencies`.
- **Vite config shadowing:** `tsc -b` emits `apps/web/vite.config.js`, and Vite prefers
  `vite.config.js` over `vite.config.ts`. A stale emitted file could hide edits to the TS config
  until the next typecheck. (The file is not tracked, but it still exists after builds.)
- **Audio:** each SFX is downloaded twice (Web Audio buffer plus HTMLAudio fallback, about 100 KB);
  iOS Safari ignores `HTMLAudioElement.volume`, so music may play at full volume there; the toggles
  and `setSuspended` stop new sounds but do not cut one already playing (no gain buses); the
  AudioContext is not suspended when the page is hidden; new mechanics have no cues yet.
- **Placeholder art:** the flat-top jam tiles are rotated 30 degrees; final pointy-top art is
  pending. New mechanics use code-drawn glyphs.
- **Bundle:** the JS chunk is about 800 KB minified (about 217 KB gzip), mostly Pixi and React. Vite
  warns above 500 KB. Acceptable for now; revisit with portal size budgets.

## Fixed

- Browser zoom (2026-10-11): zooming in moved the board towards the bottom-right and taps missed.
  Zoom keeps CSS size x pixel ratio constant, so Pixi skipped its resize and kept the old screen
  and canvas size; `StageController.syncSize` now replays the resize, and pixel-ratio-only changes
  (moving between monitors) are caught with a `matchMedia` resolution listener. The fix relies on
  Pixi internals (`resizeCanvas`, the source `resize` event); recheck after a Pixi upgrade.
- Roadmap step 2 review (2026-10-10): a win is saved when the engine reports it, not after its
  animation (leaving mid-animation lost it); Enter or Space during the win celebration no longer
  triggers a focused HUD button; two tabs no longer overwrite each other's progress; the level
  select is a modal dialog with a focus trap; it fits short landscape phones; the credits box is
  opaque.
- Roadmap step 1 (2026-10-10):
  - The game runs the hex-steps rules (the jam rules and their softlock, where a boxed-in player
    with moves left never lost, are gone).
  - Clicks during a hop no longer snap Larry; input is locked while motion plays.
  - Win and loss overlays appear only after the motion finishes.
  - The board is no longer destroyed and rebuilt on every move; the ticker stops when idle; render
    resolution follows the device (1-3x) instead of forcing 2x.
  - "Press R to Reset" text removed; touch players have Undo and Reset buttons.
  - The jam-only catapult-plus-bonus cell combination no longer exists.
  - Portrait is no longer blocked on phones; the board fit adapts to any board size and screen.
  - The engine review fixed `step` reading prototype keys for untyped direction strings and
    `level:check` crashing on a malformed `campaign.json`.
- Asset delivery: full-size PNG and WAV imports replaced by the `npm run assets` pipeline (build
  about 53 MB to 4.7 MB; first gameplay load about 2 MB plus JS). A production-only bug where the
  CSS background URL resolved against the stylesheet was fixed before merge (2026-10-10).
- Start transition: the "Loading Game 100%" panel no longer shows on normal starts (2026-10-10).
- Cold-load startup: waits for background and textures, synchronizes the first intro cue with the
  mounted board, and offers Retry on load failure.
- Music no longer restarts on every pointer or key input.
- SFX moved from per-play `new Audio()` to pre-decoded Web Audio buffers.
- Earlier jam-port fixes: placeholder tiles replaced by Unity art; Unity Levels 1-5 converted; board
  orientation corrected; bootstrap UI replaced by the full-screen menu and HUD.
