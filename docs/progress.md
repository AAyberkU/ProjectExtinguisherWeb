# Progress

Current state and work log. The plan is in `docs/roadmap.md`; read this file first in every session.

## Status (2026-10-10)

- The project is moving from the jam web port to the full product (about 60 levels, Coolmath first,
  Steam later). See `docs/roadmap.md`.
- **Roadmap step 1 is done and merged to `main`** after the user's play test: the game runs the
  Puzzle Lab hex-steps rules on a temporary 60-level campaign with a rewritten renderer.
- The jam rules and the 5 jam levels are gone. Placeholder art is still the rotated jam art plus
  code-drawn glyphs.
- A pool of 180 candidate levels lives in `apps/web/levels/pool/` (none final; selection happens in
  the editor).
- **Next:** roadmap step 2 (menus and save). Its scope was agreed on 2026-10-10 (three screens, no
  settings or pause, HUD layout, animations instead of win and loss panels, simple tutorial trial);
  implementation has not started.

## Recent work (2026-10-10)

Step 2 planning (2026-10-10): agreed screens, HUD, win and loss feedback, level select, tutorial
trial, and the UI art split with the user; recorded in `docs/roadmap.md`, `docs/game.md`,
`docs/art.md`, and `docs/design.md`.

Roadmap step 1 (merged to `main` on 2026-10-10 after the user's play test):

- Imported the 180-level pool as fixtures and a temporary campaign (base alternative per slot,
  approved `c01-l01-v1` first); renamed placeholder art to the Puzzle Lab vocabulary
  (`tile_floor_*`, `tile_blocker_*`, `tile_launcher_<dir>`, `tile_finish`, `tile_plus1`).
- hex-steps engine (`apps/web/src/game/engine/`): rules, solver, validation, ordered events.
- Tests: 289 Vitest tests in about 2 s; oracle 180/180 pool and 60/60 campaign; mechanic and quirk
  tests; validation and campaign tests. `npm run level:check`: 0 errors, 0 warnings.
- Independent review: 2,520 random levels compared with the editor's own core, about 4 million step
  comparisons, zero mismatches. Fixed two robustness issues it found (prototype-key directions in
  `step`, malformed `campaign.json` in `level:check`); documented a loop-validation gap shared with
  the editor (`docs/rules.md`).
- Renderer rewrite (`apps/web/src/game/renderer/`): persistent tiles, event timeline, idle ticker,
  board fit for 19-91 cells in both orientations, seeded variants, placeholder glyphs
  (`/glyph-preview.html` in dev), mechanic animations, input lock, overlays after motion.
- Controls: tap a highlighted neighbour; W/E/A/D/Z/X and Left/Right arrows; Backspace or the Undo
  button; R or the Reset button. Loss panel with a reason (out of steps or stuck) and Undo.
- Removed the jam core, jam levels, old loader, and the portrait block. Dev-only
  `window.extinguisherDebug` (`goTo`, `loadLevel`, `stats`, `cellScreenPoint`).
- GitHub Actions workflow: typecheck, tests, `level:check` on every push.
- End-to-end browser run: all 60 campaign levels won with their stored solutions via the keyboard,
  no page errors.

- HUD shows only `Level N` (campaign position). Boards now fill the same screen area at every size
  (no maximum scale, 78% of the free area so the background stays visible); tile art is built at
  512 px to stay sharp; glyph text renders at high resolution; the asset script prunes stale outputs.
  End-to-end run still 60/60.
- Received Uğur's GDD and level-set history: rules 1-20 match the engine; added the GDD as a
  reference copy and recorded the v1/GPT/v2 history, design rules, and progress rules.

Earlier the same day:

- Reviewed the port against the PuzzlePanic (Echo Rail) experience; kept Pixi.js and React; agreed
  the roadmap and decisions (`docs/roadmap.md`).
- Rotated the board to pointy-top cells; added the `art-source/` asset pipeline (build about 53 MB to
  4.7 MB); start transition without a loading panel.
- Analysed the level designer's pool and the Puzzle Lab editor (format, mechanics, board sizes, exact
  rules, edge-blocker decision, selection workflow) and rewrote the documentation around the plan.

## Jam port history (before 2026-10-10)

- Web bootstrap: npm workspace with `apps/web`, Vite, TypeScript, React, Pixi.js, SCSS.
- Pure TypeScript core: axial coordinates, level validation, immutable state, command reducer,
  movement rules (adjacency, walkability, no re-entry, move spending, win/loss, health bonus,
  catapult chains), ordered game events.
- Levels 1-5 converted from Unity `LevelData.asset` to JSON; level loader and progression with a win
  overlay, Next Level, and return to menu after the last level.
- Unity scene coordinates sampled to match the jam board layout (later replaced by the pointy-top
  layout).
- Full-screen Unity background, main menu with credits, Start Game zoom transition, HUD with moves,
  level name, and `R` reset; win, final, and "Out of Moves" overlays.
- Pixi tile sprites from Unity art with deterministic variants; Larry sprite with a hop animation
  following Unity `LarryController`; tile drop-in intro following Unity `LevelLoader`; idle hover on
  Larry's tile; green outline on valid destinations.
- Audio: looping music (volume 0.4) with autoplay retry; Web Audio SFX buffers scheduled from game
  events.
- Web delivery: relative base path, PWA manifest and icons, landscape-only CSS on phones, Comic Neue
  from Google Fonts, high-DPI rendering, embedded in the Astro portfolio site as a sub-directory.
- Startup robustness: background and texture preload gate, loading state with Retry.

## Next steps

1. Roadmap step 2 as agreed in `docs/roadmap.md`: three screens, save adapter, HUD with music and
   SFX toggles, win and loss animations, tutorial trial.
2. Tell the artist the tile list and the UI art list in `docs/art.md`; report the loop-validation gap
   (`docs/rules.md`) to Uğur and ask for the GDD's rule fixtures.
3. Replace the temporary campaign when the editor's Final export exists (`docs/levels.md`).

## Notes

- Root commands: `npm run assets`, `npm run dev`, `npm run typecheck`, `npm test`,
  `npm run level:check`, `npm run build`, `npm run preview`. `dev` and `build` run `assets` first.
- Level pool source: `havuz.zip` from the level designer (2026-10-10), the same data as the editor's
  Pool workspace; stored in `apps/web/levels/pool/`.
- No backend.
