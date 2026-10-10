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

## 1. Level pipeline and hex-steps engine (done, merged 2026-10-10)

- [x] hex-steps engine in TypeScript, pure and deterministic, following `docs/rules.md`, with an
  ordered event stream (walk, launch, slide, teleport, swap, pickup, switch, refill, win and loss
  reason) plus undo and restart.
- [x] Switch coordinates to the Puzzle Lab convention (`r` grows downward, `E`/`SE`/... directions).
- [x] Oracle tests: reproduce every level's stored `shortest`, `minBudget`, and solution count
  (180/180 pool, 60/60 campaign); independent fuzz review with zero mismatches.
- [x] Load Puzzle Lab files directly (temporary 60-level campaign until the Final export).
- [x] `npm run level:check` with the editor's validation rules.
- [x] Renderer: variable board size, seeded wall variants, code-drawn placeholder glyphs for new
  tiles, mechanic motion (walk, launch, slide, teleport, swap), steps in the HUD.
- [x] Renderer cleanup: persistent tiles, presentation driven only by engine events, idle ticker,
  device resolution 1-3x, no input during motion, outcome overlays after motion ends.
- [x] Keyboard moves, undo (Backspace and a button), restart, loss reasons.
- [x] Retire the jam ruleset and jam levels 1-5.
- [x] GitHub Actions CI (typecheck, tests, `level:check`).
- [x] End-to-end browser run wins all 60 campaign levels with their stored solutions.
- [ ] Replace the temporary campaign with the Puzzle Lab Final export when it exists.

## 2. Menus and save (next; scope agreed 2026-10-10)

Guiding idea: as few panels as possible, so the game feels like a game and not a web site (the Echo
Rail approach). The full screen and HUD spec is in `docs/game.md` (Screens and HUD).

- [ ] Three screens: main menu, level select, game. No settings screen and no pause menu. Split
  `App.tsx` into screen components.
- [ ] Main menu: Play (no save) or Continue (first unfinished level), Level Select, Credits. Credits
  stays as the current box over the menu for now; its content is rewritten later.
- [ ] Level select: all 60 levels, 10 chapters of 6, on two pages (chapters 1-5 and 6-10). Locked
  levels are visible with a lock; completed levels show a tick. The same screen opens from the main
  menu and from the game (over the board; closing returns to the level in progress). It has a Main
  Menu button.
- [ ] Game HUD: left `Level N`, Undo, Restart; centre a large steps counter (number only); right
  Music on/off, SFX on/off, Menu (opens level select). Keys: `M` music, `V` SFX, `Esc` opens and
  closes level select.
- [ ] No win or loss panels; animations instead:
  - Win: a celebration animation, then a "next" arrow badge in the centre. Tapping it (or Enter)
    loads the next level; there is no auto-advance. Undo and Restart keep working while it waits.
    The last level plays an ending and returns to the main menu.
  - Loss: no panel and no auto-restart. Out of steps: the counter flashes red at 0. Stuck: Larry and
    the board shake. Moves are locked; Undo and Restart pulse to show the way on.
- [ ] Save adapter keyed by stable `levelId` (localStorage on web, Steam Cloud later); store only
  completed level ids plus the music and SFX toggles; finishing a level unlocks the next (GDD).
- [ ] Tutorial, kept very simple as a trial: on the first level of a chapter the new mechanic's
  tile glows and a one-line hint appears next to it; it never blocks play, disappears after the
  mechanic is first used, and is saved as seen. Removed entirely if it does not feel right.
- [x] Touch-friendly copy (no "Press R" text; done in step 1).
- [ ] Console debug command to unlock levels once saving exists. (Dev-only `window.extinguisherDebug`
  with `goTo` and `loadLevel` exists since step 1 and is absent from production builds.)
- Art: all screens start with code-drawn placeholders, so step 2 does not wait for the artist; the
  pieces are in the artist checklist in `docs/art.md`. New sound cues (win, loss, button) are decided later.

## 3. Landscape and portrait

- [x] Board fit computed from the actual board and screen (step 1).
- [x] Remove the mobile "rotate your device" screen (step 1).
- [ ] Two HUD layouts; portrait currently leaves large empty areas above and below the board. Check
  that the step 2 HUD rows fit narrow phones in portrait.
- (Moved to step 2: the large steps counter, now centred, and undo/restart after a win, now through
  the HUD instead of a win panel.)
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
| 2026-10-10 | Temporary campaign: the base alternative of each slot (approved `c01-l01-v1` for the first slot) until the Final export. The 180-level pool lives in the repository as test fixtures. |
| 2026-10-10 | Controls follow the editor: W/E/A/D/Z/X (plus Left/Right arrows), Backspace undo, R restart; tapping a neighbour also moves. One loss panel with a reason line (out of steps or stuck). |
| 2026-10-10 | GitHub Actions runs typecheck, tests, and `level:check` on every push; it reports and never blocks. |
| 2026-10-10 | HUD level label is only `Level N` (campaign order, no chapter or name). Every board fills the same screen area regardless of size; tile art built at 512 px for sharpness. Steps-counter placement (GDD: large, top-right, number only) and undo/restart buttons after a win are agreed but deferred. |
| 2026-10-10 | Step 2 scope: three screens (main menu, level select, game); no settings screen and no pause menu; music and SFX on/off buttons in the HUD (Echo Rail style). HUD: left level, Undo, Restart; centre a large steps counter (deliberately differs from the GDD's top-right); right Music, SFX, Menu. The Menu button and `Esc` open level select, which also has a Main Menu button. Win and loss panels are replaced by animations; win waits for a "next" arrow tap (no auto-advance), loss never auto-restarts, and Undo and Restart work after both. Level select shows all 60 levels on two pages with locked levels visible. Tutorial is a very simple, non-blocking tile glow with one line of text, on trial. Credits keep their current content for now. UI art split: the artist draws static pieces, code does every animation and placeholder. Sound cues are decided later. |
| 2026-10-10 | Uğur's GDD (rules 1-20) adopted as a source next to the editor code; copy in `docs/reference/`. The v1 and GPT sets used empty cells as walls on purpose; "full floor" levels come from the v2 set. Progress saves only completed level ids with linear unlock; no score or stars. |
