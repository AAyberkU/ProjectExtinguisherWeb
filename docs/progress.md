# Progress

Current state and work log. The plan is in `docs/roadmap.md`; read this file first in every session.

## Status (2026-10-10)

- The project is moving from the jam web port to the full product (about 60 levels, Coolmath first,
  Steam later). See `docs/roadmap.md`.
- The playable build is still the jam port: 5 jam levels on the old jam rules, a main menu, HUD,
  completion overlays, music and SFX, on the new pointy-top board and the new asset pipeline.
- The gameplay rules are decided: Puzzle Lab **hex-steps** (`docs/rules.md`), verified against all
  180 pool levels with an independent simulator.
- A pool of 180 candidate levels exists (10 chapters x 6 slots x 3 alternatives), none final
  (`docs/levels.md`).
- **Next: roadmap step 1**, the hex-steps engine with oracle tests, Puzzle Lab level loading,
  `level:check`, and the new renderer.

## Recent work (2026-10-10)

- Reviewed the port against the PuzzlePanic (Echo Rail) experience; kept Pixi.js and React; agreed
  the roadmap and decisions (`docs/roadmap.md`).
- Rotated the board to pointy-top cells so the board's flat edges face up and down; catapult
  directions renamed to on-screen names; jam levels 3-5 converted; flat-top jam tiles rotated 30
  degrees as placeholders.
- Added the `art-source/` asset pipeline (`npm run assets`): resize, WebP atlas, MP3 audio, Pixi
  manifest, alias-based loading with a loading percentage. Build about 53 MB to 4.7 MB. Build outputs
  (dist zip, tsbuildinfo, emitted Vite config) are no longer tracked.
- Start transition: Pixi initializes during the menu zoom; normal starts reach the board in about
  0.9 s with no loading panel; the panel only shows for slow downloads or failures.
- Analysed the level designer's pool and the Puzzle Lab editor: format, mechanics, board sizes,
  exact hex-steps rules, the edge-blocker question (decided: walls), and the selection workflow.
- Rewrote the documentation around the new plan (this file, `game.md`, `design.md`, `bugs.md`,
  README, AGENTS) and added `rules.md`, `levels.md`, `art.md`, and `roadmap.md`.

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

1. Roadmap step 1: hex-steps engine and oracle tests first, then level loading and `level:check`,
   then the renderer.
2. Tell the artist the new tile list in `docs/art.md` early.
3. Push the local `main` commits when the user asks (several commits are not on `origin` yet).

## Notes

- Root commands: `npm run assets`, `npm run dev`, `npm run typecheck`, `npm run build`,
  `npm run preview`. `dev` and `build` run `assets` first.
- Level pool source: `havuz.zip` from the level designer (2026-10-10), the same data as the editor's
  Pool workspace. It is not in the repository yet; Final exports will be added in step 1.
- No backend.
