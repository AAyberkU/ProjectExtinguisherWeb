# Progress

Current state and work log. The plan is in `docs/roadmap.md`; read this file first in every session.

## Status (2026-10-16)

- The project is moving from the jam web port to the full product (about 60 levels, Coolmath first,
  Steam later). See `docs/roadmap.md`.
- **Roadmap step 1 is done and merged to `main`** after the user's play test: the game runs the
  Puzzle Lab hex-steps rules with a rewritten renderer.
- **Campaign (branch `levels-v3`, 2026-10-16):** Uğur's v3 set (60 levels, submitted for review in
  the editor on 2026-10-14, not approved) replaced the temporary campaign. Movers now follow the
  editor's car rule (rule 15, 2026-10-13): a car carries the player once, then stays parked as a wall.
- The jam rules and the 5 jam levels are gone. Placeholder art is still the rotated jam art plus
  code-drawn glyphs.
- A pool of 180 candidate levels lives in `apps/web/levels/pool/` (none final; selection happens in
  the editor).
- **Roadmap step 2 is done and merged to `main`** after the user's play test: main menu, level
  select, saved progress, the new HUD with music and SFX toggles, tap-only moves, win and loss
  animations instead of panels, and the tutorial hint trial.
- **Next:** the user's play test of the v3 campaign and the cars; then roadmap step 3 (landscape and
  portrait layouts).

## Recent work (2026-10-10 to 2026-10-16)

- v3 campaign (2026-10-16, branch `levels-v3`): the 60 v3 files replace the temporary campaign as
  exported (ids `level-01`-`level-60`, chapter order from `meta.slot`; byte-identical to the editor's
  Export, an extra trailing blank line from the first copy was removed); `campaign.json` status
  `pending-review`; the old campaign files stay in the pool. Campaign test now checks slot order
  instead of pool copies; the oracle's "ends on 0 steps" check skips refill levels (level 55 ends on
  1 in the editor too); a test covers old saves (their ids are not v3 ids, so v3 starts fresh).
  Tutorial hints still land on each chapter's first level. First result: 14 mover levels failed the
  oracle (50/60 won end to end) because the editor had changed the mover rule.
- Cars (2026-10-16): movers follow the editor's rule 15. The car state is part of the play state and
  the solver key; the home cell becomes floor; a parked car is a wall that launchers fly over; a ride
  either keeps the player in the car or parks and drops them onto the next acting tile; movers cannot
  be swap tiles; loop validation tries each car parked on its ray. The renderer drives the car with
  Larry, keeps used cars on their own layer (parked ones darker), and draws an emptied home as floor;
  undo and restart restore them. 8 pool files were re-exported through the editor's export path
  (`docs/levels.md`); the hint line now says "Cars carry you once, then park as walls".
  Verification: 346 tests pass; `level:check` campaign 60/60 ok (it now checks only the campaign by
  default; `levels/pool` reports the 6 levels the editor now rejects); a differential check against the editor's core (240 pool and v3 levels plus
  10,000 random variants, about 2 million compared steps; 6,632 of the levels have movers) found no
  mismatch; end-to-end run 60/60 on the dev server and 60/60 on the production build (fresh save,
  linear flow with the next badge); undo after rides is pixel-identical to reaching the same state
  directly.
- First final art: Larry from the artist (2026-10-11), delivered on an A4 page; the asset pipeline
  now crops stand-alone images (characters) to their visible pixels before resizing.
- First art batch integrated (2026-10-11): floor, start, finish, swamp, wall, +1, launcher, mover,
  portal, three-colour switches and doors, and the closed passage side. Shared-box cropping for
  aligned sets, one drawing scale from the floor, seeded floor rotation, rotated duck and car,
  hue-shifted portal pairs, code-made pressed switch. Jam tiles removed; build about 7 MB to 5.1 MB.
  340 tests and the 60-level click-through run pass.

Roadmap step 2 (merged to `main` on 2026-10-11 after the user's play test):

- Three screens: main menu (title placeholder, Play/Continue, Level Select, Credits box), level
  select (10 chapters on two pages, locked levels visible, modal with focus trap, opens over the
  game), and the game. No settings screen and no pause menu.
- Save (`src/game/save.ts`, `src/game/progress.ts`): completed level ids, music and SFX toggles,
  and seen tutorials in localStorage; linear unlock; Continue goes to the first unfinished level;
  a win is saved as soon as the engine reports it; saves merge across tabs; play continues when
  storage is blocked.
- HUD: left level, Undo, Restart; centre a large steps counter; right Music, SFX, Menu. Keys M, V,
  Esc; Enter or Space on the next badge.
- After the first play test (2026-10-11): keyboard movement removed (taps only); `Z` undoes and
  Backspace no longer does; browser zoom no longer pushes the board off-centre. The end-to-end run
  now plays all 60 levels by clicking cells (60/60).
- Win: celebration on the board, then a next badge (no auto-advance; Undo and Restart still work).
  Loss: shake (stuck) or slump (out of steps), red counter, pulsing Undo and Restart; no panel.
- Tutorial trial: the first level of each mechanic glows its tile with one line of text; it
  disappears on first use and is saved as seen.
- Built by subagents in four phases with an independent review; its findings (win saved only after
  the animation, Enter during the celebration, two-tab save overwrite, dialog accessibility) and two
  layout issues were fixed.
- Verification: 340 Vitest tests; end-to-end run wins all 60 levels through the new UI on the dev
  server and on the production build with no console errors; 34 extra flow checks pass on both.

Step 2 planning (2026-10-10): agreed screens, HUD, win and loss feedback, level select, tutorial
trial, and the UI art split with the user (the artist checklist in `docs/art.md` now lists every
piece to draw); recorded in `docs/roadmap.md`, `docs/game.md`,
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

1. Roadmap step 3: landscape and portrait layouts (`docs/roadmap.md`).
2. Send the artist the artist checklist in `docs/art.md`; report the loop-validation gap
   (`docs/rules.md`) to Uğur and ask for the GDD's rule fixtures.
3. Replace v3 with the editor's Final export when it exists (`docs/levels.md`).

## Notes

- Root commands: `npm run assets`, `npm run dev`, `npm run typecheck`, `npm test`,
  `npm run level:check`, `npm run build`, `npm run preview`. `dev` and `build` run `assets` first.
- Level pool source: `havuz.zip` from the level designer (2026-10-10), the same data as the editor's
  Pool workspace; stored in `apps/web/levels/pool/`.
- No backend.
