# Game Brief

This document defines what Project Extinguisher is as a game. Agents should read it before implementing mechanics, UI, levels, or polish.

## One-Liner

Project Extinguisher is a short, hex-based puzzle game where the player guides Larry across a dangerous board by opening adjacent tiles before running out of moves.

## Player Fantasy

The player is not controlling Larry freely. They are preparing safe steps for him under pressure, choosing the next tile carefully and reacting to special board effects.

## Core Loop

1. Open on the main menu.
2. Press Start Game.
3. Read the board, move limit, start, goal, and special tiles.
4. Click a valid neighboring tile.
5. Larry hops to that tile and spends a move.
6. Resolve special tile effects.
7. Repeat until Larry reaches the goal or moves run out.

## Core Rules

- The board is a 61-cell axial hex grid displayed as a vertical, corner-up map silhouette.
- Larry starts on the level start tile.
- The goal is to reach the goal tile within the move limit.
- The player may only activate a tile adjacent to Larry's current tile.
- A valid manual activation spends 1 move.
- Blocked tiles cannot be entered.
- The level is won when Larry reaches the goal.
- The level is lost when moves reach 0 and Larry is not on the goal.
- Reset restarts the current level.
- Completing a level opens a win panel; Next Level must be clicked to load the next level.
- Completing Level 5 opens a final panel; Return to Main Menu must be clicked before a new run starts.

## Special Tiles

- Path Tile: Normal walkable tile.
- Start Tile: Larry's spawn tile.
- Goal Tile: Win target.
- Blocked Tile: Non-walkable obstacle.
- Catapult Tile: Launches Larry 2 cells in its configured direction if the landing tile is valid and a move is available.
- Health Tile: Grants extra moves once, then becomes consumed until reset.

## Web Art Mapping

- Path tiles use `HexTile_Path_01` through `HexTile_Path_10` with an even fallback distribution when a level cell does not specify `variant`.
- Blocked tiles use `HexTile_Blocked_01` through `HexTile_Blocked_03` with an even fallback distribution.
- Catapult tiles use the art matching their `catapultDirection`: `E`, `NE`, `NW`, `W`, `SW`, or `SE`.
- Start, goal, health, and Larry use their dedicated Unity-exported PNG assets from `Art/`.

## Current Content

- The current Unity prototype has 5 playable levels.
- The shared board has 61 hex cells.
- Levels 1-5 are data-driven JSON ports of the Unity `LevelData.asset` files.
- Current mechanics include adjacency movement, move limit, reset, win/fail, blocked tiles, catapults, health tiles, start menu, level intro, HUD, and audio feedback.

## Level Design Intent

- Levels should be readable at a glance.
- Early levels teach movement and move limits.
- Later levels combine obstacles, catapults, and health tiles.
- Catapults should feel clever, not random.
- Health tiles should create route decisions, not simply make levels easier.
- Every level should be solvable without hidden knowledge.

## UX Goals

- The game opens on the Unity-style main menu with Start Game and credits.
- Main menu music starts on page load and loops continuously during menu and gameplay.
- Starting the game removes the menu overlay, clears the dark background filter, zooms the background out, and then shows Level 1.
- Returning to the main menu zooms the background in and restores the dark filter.
- Level loading drops tiles in from above using a diagonal line cascade.
- Larry moves between tiles with a short hop instead of instant teleporting.
- Movement, catapult launches, health pickups, level pass, lose, restart, and level intro each have dedicated SFX.
- Input should feel immediate and clear.
- Valid next choices should be visually readable.
- Movement should feel toy-like and satisfying.
- Failure should feel fast to retry.
- The game should work well on desktop and mobile browsers.

## Portfolio Goals

- Show a clean Unity-to-web port.
- Show data-driven puzzle design.
- Show custom TypeScript game logic.
- Show Pixi.js rendering and responsive web UI.
- Keep the first web version small, fast, and polished.

## Non-Goals For First Web Version

- No multiplayer.
- No account system.
- No backend dependency.
- No procedural level generation.
- No complex physics engine.
