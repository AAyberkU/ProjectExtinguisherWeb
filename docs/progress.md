# Progress

## Status

- Project has completed the initial web bootstrap, first pure TypeScript game-core pass, Unity-to-JSON import for Levels 1-5, interactive state wiring, automatic level progression, and first Unity art integration for the web-native port.
- Current target stack is TypeScript, Pixi.js, Vite, React, SCSS, and JSON levels.
- First milestone remains a static playable web slice with no backend.

## Completed

- Created compact web-port documentation structure.
- Defined the game brief in `docs/game.md`.
- Defined the web pipeline in `docs/design.md`.
- Updated agent workflow to require `progress.md` and `bugs.md` maintenance.
- Initialized a root npm workspace with the web app under `apps/web`.
- Added Vite, TypeScript, React, Pixi.js, and SCSS dependencies.
- Created the initial `game/core`, `game/renderer`, `game/ui`, `game/levels`, and `game/assets` folders.
- Added a minimal React shell and Pixi board-preview stage using generated 61-cell axial hex coordinates.
- Verified `npm run typecheck` and `npm run build` pass.
- Added renderer-independent `game/core` models for axial coordinates, level data, cells, game state, commands, and game events.
- Added level validation for required fields, board bounds, duplicate overrides, move limits, catapult distance, and move-bonus values.
- Added deterministic state creation/reset helpers and immutable cell update helpers.
- Added command reducer support for starting, resetting, and activating cells.
- Added movement rules for adjacency, walkability, already-active rejection, move spending, Larry position updates, win/loss resolution, health tile bonuses, and catapult chains.
- Updated the Pixi board preview to read generated cells from `createInitialGameState()` instead of directly generating coordinates in the renderer.
- Re-ran `npm run typecheck` and `npm run build`; both pass.
- Converted Unity `Level_001.asset` into `apps/web/src/game/levels/level-001.json` using the current `LevelData` shape.
- Added `game/levels/levelLoader.ts` with `LEVELS`, `getLevelData()`, `validateAvailableLevels()`, `createLevelGameState()`, and `createFirstLevelGameState()`.
- Updated Pixi board preview to create state from imported `Level_001` JSON instead of an inline preview level.
- Re-ran `npm run typecheck` and `npm run build`; both pass after the JSON loader change.
- Moved Level 1 `GameState` ownership into React `App` with command dispatch through `applyCommand()`.
- Updated `PixiStage` to receive `gameState` and `onActivateCell` props instead of creating static state internally.
- Added Pixi pointer input on tiles; clicks dispatch `activate-cell` commands and core rules accept or reject the move.
- Added live board redraw from current `GameState`, including active tile tinting and valid-neighbor stroke highlighting.
- Added a placeholder Larry marker driven by `gameState.larryPosition`.
- Added a compact temporary state strip and reset button in React for manual Level 1 testing.
- Re-ran `npm run typecheck` and `npm run build`; both pass after interactive state wiring.
- Updated hex coordinate-to-pixel layout so the full board displays as a vertical, corner-up map silhouette.
- Replaced procedural tile placeholder fills with Pixi sprites loaded from root `Art/Tiles/Hex`.
- Added deterministic path tile art selection across `HexTile_Path_01` through `HexTile_Path_10`.
- Added deterministic blocked tile art selection across `HexTile_Blocked_01` through `HexTile_Blocked_03`.
- Added direction-specific catapult art selection from `catapultDirection` using `HexTile_Catapult_E`, `NE`, `NW`, `W`, `SW`, and `SE`.
- Replaced the Larry placeholder marker with `Art/Characters/Larry/LarrySprite.png`.
- Added validation that level cell `variant` values must be non-negative integers.
- Re-ran `npm run build`; it passes after art integration and variant validation.
- Converted Unity `Level_002.asset` through `Level_005.asset` into JSON web levels.
- Simplified path-only visual overrides so normal path and blocked art variants use the renderer's deterministic even distribution.
- Registered all five JSON levels in `LEVELS` and added `getLevelIndex()` plus `createNextLevelGameState()`.
- Updated React game-state dispatch so `level-won` immediately advances to the next level, and Level 5 loops back to Level 1.
- Kept reset scoped to the current level via the existing `reset-level` command.
- Added runtime validation for `catapultDirection` values.
- Re-ran `npm run build`; it passes after the Level 1-5 import and progression change.
- Connected to the Unity scene through MCP and sampled all 61 `HexCell` `GridIndex`/world-position pairs from `GameplayScene`.
- Updated web `axialToPixel()` to match Unity's `x = q * columnSpacing`, `y = (r + q / 2) * rowSpacing` layout, including browser canvas y-axis inversion.
- Re-ran `npm run build`; it passes after the Unity coordinate mapping correction.
- Removed the temporary two-column bootstrap UI and made the game full-screen.
- Added the Unity background art as the page background with menu zoom/filter states.
- Added a Unity-style main menu with Start Game and credits.
- Added Start Game transition: menu content disappears, dark filter fades out, background zooms out, then Level 1 gameplay mounts.
- Updated final-level progression so completing Level 5 returns to the main menu instead of immediately looping into Level 1 gameplay.
- Added gameplay HUD with top-left moves, top-center level text, top-right `R Reset` button, and `R` keyboard reset.
- Re-ran `npm run build`; it passes after the main menu and HUD update.
- Changed level completion flow so wins open an overlay instead of advancing immediately.
- Added regular win overlay with `You Won`, `Press R to Reset`, and Next Level button.
- Added final-level overlay with final-run messaging and Return to Main Menu button.
- Added Larry tile-to-tile hop animation in Pixi using Unity `LarryController` timing/curve intent.
- Added level/reset tile drop-in animation in Pixi using Unity `LevelLoader` intro line-delay and fall-duration settings from `GridRoot`.
- Re-ran `npm run build`; it passes after completion overlays and animations.
- Tuned the level tile drop-in animation to run much faster by shortening the web fall duration and line-delay cascade.
- Fixed catapult movement animation to use the full `larry-moved` event path, so Larry hops to the catapult tile first and then hops to the catapult destination.
- Re-ran `npm run build`; it passes after the animation fixes.
- Added `game/audio.ts` with looping music and scheduled one-shot SFX playback from files under root `sound/`.
- Wired `music.wav` to start on app mount and loop continuously, with pointer/key retry for browser autoplay restrictions.
- Wired `jump.wav`, `catapult.wav`, and `heal.wav` according to movement event order so catapult/health sounds happen after Larry lands on the triggering tile.
- Wired `passed.mp3`, `lose.wav`, `restart.wav`, and `levelIntro.wav` to level completion, loss, reset, and tile-intro flows.
- Re-ran `npm run build`; it passes after audio integration.
- Reworked SFX playback from per-play `new Audio()` creation to Web Audio preload/decode buffers to reduce intermittent sound latency.
- Kept `music.wav` on looping HTMLAudio and retained pointer/key unlock retry for autoplay policy.
- Fixed background music continually resetting on every pointer/keyboard interaction.
- Added 'Out of Moves' overlay panel with 'Try Again' button when a level is lost.
- Adjusted default music volume down to 0.4.
- Reworked tile rendering: disabled dimming transparency across all tiles. Replaced with a gray tint specifically for unvisited path tiles so that special tiles (catapult, health, blocked) always render vividly.
- Separated `TILE_LAYOUT_RADIUS` and `TILE_VISUAL_RADIUS` to introduce a margin between tiles on the grid while maintaining coordinate accuracy.
- Removed all colored tile outlines for a cleaner aesthetic.
- Implemented a synchronous fake 3D hover animation: the currently active tile, along with Larry, smoothly scales up and floats upwards (negative Y) in an endless sine wave cycle.
- Added a minimal outline back (adjusted to 85% opacity, color changed to bright green `0x00ff88` for contrast) exclusively for accessible destination tiles to guide UX subtly.
- Remapped the HUD to be fully scalable for any future number of levels. HUD text now displays as "Level: X" instead of a hardcoded fraction, and the "Return to Main Menu" game-completion logic dynamically detects the final level size via `LEVELS.length`.
- Enlarged HUD text (Level display and R-to-Reset button) for better readability.
- Eliminated the initial game board rendering delay by preloading PixiJS textures globally when `App.tsx` first mounts.
- Slowed down the initial "tile drop" board intro animation to synchronize perfectly with the startup sound effect.
- Set 'passed' goal audio sequence delay to zero to provide an immediate auditory reward completely synced with the final user input.

## Immediate Next Steps

1. Add lightweight polish for win/final overlay copy and visual treatment after manual play review.
2. Tune remaining animation/audio timing if browser feel differs from Unity after manual play review.
3. Compress `music.wav` and large PNG assets or move to a more explicit web asset pipeline if bundle size becomes a problem.
4. Add focused unit tests for level validation and core movement rules.
5. Prepare deployment settings once manual play review is complete.

## Notes

- Backend remains out of scope until a specific feature requires it.
- Keep docs compact and update them when the real project state changes.
- Use root commands: `npm run dev`, `npm run typecheck`, `npm run build`, and `npm run preview`.
- Levels 1-5 are now imported and playable from a Unity-style main menu with full-screen background, HUD, completion overlays, Unity-exported tile art, Larry hop movement, tile intro animation, music, and gameplay SFX.
