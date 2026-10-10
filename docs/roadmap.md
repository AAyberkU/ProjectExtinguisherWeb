# Roadmap

The product plan for turning the jam port into a full release. Current state and the latest work log
live in `docs/progress.md`; decisions are recorded at the end of this file.

## Goal

Ship Project Extinguisher as a polished hex puzzle game with about 60 levels on Coolmath Games
(HTML5) first and on Steam later. Art comes from the artist, levels from the level designer through
the Puzzle Lab editor; this repository integrates them into the game.

## Done

- [x] Board orientation: pointy-top cells, board with flat top and bottom edges (2026-10-10).
- [x] Asset pipeline: `art-source/` + `npm run assets`, WebP atlas, MP3 audio, alias loading; build
  from about 53 MB to 4.7 MB (2026-10-10).
- [x] Start transition: Pixi initializes during the menu zoom; no loading panel on normal starts
  (2026-10-10).

## 1. Level pipeline and hex-steps engine (next)

- [ ] hex-steps engine in TypeScript, pure and deterministic, following `docs/rules.md`, with an
  ordered event stream (walk, launch, slide, teleport, swap, pickup, switch, refill, win and loss
  reason) plus undo and restart.
- [ ] Switch coordinates to the Puzzle Lab convention (`r` grows downward, `E`/`SE`/... directions).
- [ ] Oracle tests: reproduce every level's stored `shortest`, `minBudget`, and solution count.
- [ ] Load Puzzle Lab files directly; campaign order from the Final export's slot data.
- [ ] `npm run level:check` with the editor's validation rules.
- [ ] Renderer: variable board size, seeded wall variants, code-drawn placeholder glyphs for new
  tiles, mechanic motion (walk, launch, slide, teleport, swap), steps in the HUD.
- [ ] Renderer cleanup: persistent tiles instead of rebuilding the board on every move, presentation
  driven only by engine events, no endless ticker, honest device resolution, no input during
  motion, win or loss overlay after motion ends.
- [ ] Retire the jam ruleset and jam levels 1-5.

## 2. Menus and save

- [ ] Screen system (menu, chapter and level select, game, settings); split `App.tsx`.
- [ ] Save adapter keyed by stable `levelId` (localStorage on web, Steam Cloud later).
- [ ] Settings with separate music and SFX volume, pause, undo button.
- [ ] A short tutorial at the start of each chapter for its new mechanic.
- [ ] Touch-friendly copy (no "Press R" on touch devices).
- [ ] Console debug command to unlock and jump to levels, disabled in release builds.

## 3. Landscape and portrait

- [ ] Board fit computed from the actual board and screen.
- [ ] Two HUD layouts; remove the mobile "rotate your device" screen.
- [ ] Check 91-cell boards on phones in portrait; quieter edge walls if needed.

## 4. Art integration and code polish (continuous, as art arrives)

- [ ] Pointy-top tiles replace the rotated jam placeholders (`PLACEHOLDER_TILE_ROTATION = 0`).
- [ ] New mechanic art replaces placeholder glyphs; layered tiles combined in the renderer.
- [ ] Code polish animations (see `docs/art.md`).
- [ ] Audio cues for new mechanics; master, music, and SFX buses.

## 5. Coolmath readiness

- [ ] Self-host the font; no external requests, links, or tracking.
- [ ] Portal adapter with ad-break pause and mute; separate save namespace per portal build.
- [ ] Release checklist and immutable release artifacts; Coolmath SDK after acceptance.

## 6. Steam (later)

- [ ] Desktop wrapper (Electron + steamworks.js is the leading option; to be researched).
- [ ] Achievements, cloud save through the save adapter.
- [ ] Gamepad and keyboard hex selection (Steam Deck), high-resolution asset profile.

## Continuous

- Tests and CI, pinned dependency versions (several are `latest`), build tools in
  `devDependencies`, small debts listed in `docs/bugs.md`.
- Commits and pushes only on the user's request (see `AGENTS.md`).

## Decision log

| Date | Decision |
| --- | --- |
| 2026-10-10 | Keep Pixi.js for rendering (sprite art from an artist suits it; Echo Rail dropped Pixi only for AI-drawn vector art) and React for the DOM shell only. |
| 2026-10-10 | Board uses pointy-top cells with flat top and bottom board edges. |
| 2026-10-10 | Original art stays in Git without LFS; build outputs are not tracked. The integrator names and places art. |
| 2026-10-10 | Art is static and drawn in layers; all animation is code. No Spine. Layered versus flattened delivery is decided near final art. |
| 2026-10-10 | Support both landscape and portrait. Steam work comes later, but save, input, and offline readiness are respected from the start. |
| 2026-10-10 | Gameplay rules are Puzzle Lab hex-steps; the jam rules and jam levels are retired. All mechanics are planned; a cancelled one gets a replacement. |
| 2026-10-10 | Levels come from the Puzzle Lab editor as-is; selection and approval happen in the editor; the game uses the Final export. No in-game level browser; a console debug command covers developer access. |
| 2026-10-10 | Edge blockers stay walls; every blocker is drawn with a seeded variant. Board size varies per level. |
| 2026-10-10 | Code polish animations are a roadmap item tied to art integration; their prerequisites (persistent tiles, event-driven presentation) are part of step 1. |
