# Progress

## Status

- Project has completed the initial web bootstrap and first pure TypeScript game-core pass for the web-native port.
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

## Immediate Next Steps

1. Convert `Level_001` into JSON using the `LevelData` shape in `game/core/types.ts`.
2. Add a level loader that imports JSON and creates the initial `GameState`.
3. Replace the preview board with level-driven Pixi rendering using real cell states.
4. Add click input that dispatches `activate-cell` commands through `applyCommand()`.
5. Add the first React HUD values from live game state: moves, level name, reset, win, and loss.

## Notes

- Backend remains out of scope until a specific feature requires it.
- Keep docs compact and update them when the real project state changes.
- Use root commands: `npm run dev`, `npm run typecheck`, `npm run build`, and `npm run preview`.
- Current core has not been wired into interactive React state yet; Pixi still renders a static preview from a preview level.
