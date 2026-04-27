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

## Immediate Next Steps

1. Replace the temporary state strip with the first real React HUD layer for the five-level run.
2. Add Larry movement animation instead of instant sprite repositioning.
3. Add lightweight level transition feedback so automatic progression does not feel abrupt.
4. Optimize imported PNG assets or move to a more explicit web asset pipeline if bundle size becomes a problem.
5. Add focused unit tests for level validation and core movement rules.

## Notes

- Backend remains out of scope until a specific feature requires it.
- Keep docs compact and update them when the real project state changes.
- Use root commands: `npm run dev`, `npm run typecheck`, `npm run build`, and `npm run preview`.
- Levels 1-5 are now imported and playable through automatic progression with Unity-exported tile and Larry sprite rendering; animation is still pending.
