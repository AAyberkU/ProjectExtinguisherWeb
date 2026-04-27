# Project Extinguisher Web Port Design

## Goal

Project Extinguisher'ın Unity jam prototipini web-native, hızlı açılan, mobil uyumlu ve portfolio değerine sahip bir tarayıcı oyununa portlamak.

## Recommended Stack

- TypeScript: Web portun ana dili. JavaScript'in tip güvenliği olan hali.
- Pixi.js: Hex board, tile sprite'ları, Larry, background ve animasyonları çizecek 2D render katmanı.
- Vite: Development server ve production build aracı.
- React: Menü, HUD, progression, win/lose ekranı ve settings gibi canvas dışı UI katmanı.
- SCSS: UI styling için seçilen ilk stil katmanı.
- JSON: Unity `LevelData.asset` sisteminin web karşılığı level data formatı.
- Cloudflare Pages veya Vercel: İlk public web deploy hedefi.

## Initial Architecture

```txt
ProjectExtinguisherWeb/
  docs/
    design.md
  apps/
    web/
      src/
        game/
          core/
          renderer/
          ui/
          levels/
          assets/
```

## Main Modules

- `game/core`: Renderer'dan bağımsız oyun kuralları.
- `game/renderer`: Pixi.js ile board, tile, Larry ve animasyon çizimi.
- `game/ui`: React ile HUD, menu, buttons, overlays.
- `game/levels`: JSON level dosyaları ve loader.
- `game/assets`: Sprite, audio, atlas ve preload yönetimi.

## Data Pipeline

Unity tarafındaki `LevelData.asset` dosyaları web tarafında JSON'a çevrilecek.

Current web build includes `Level_001.asset` through `Level_005.asset` as JSON files under `apps/web/src/game/levels`.

Example level format:

```json
{
  "id": "level_001",
  "name": "Level 1",
  "moveLimit": 8,
  "start": { "q": -4, "r": 0 },
  "goal": { "q": 4, "r": 0 },
  "cells": [
    {
      "q": -3,
      "r": 2,
      "blocked": false,
      "catapultDirection": null,
      "moveBonus": 0,
      "variant": 1
    }
  ]
}
```

## Asset Pipeline

- Unity-exported art currently lives under root `Art/` and is imported directly by the Vite web app.
- Pixi renders tile art as sprites instead of procedural placeholder hex fills.
- The web renderer maps path, blocked, start, goal, health, Larry, and direction-specific catapult PNGs in `apps/web/src/game/renderer/PixiStage.tsx`.
- Path and blocked tile variants are resolved deterministically so unspecified variants still distribute evenly.
- Catapult art is selected from the same `catapultDirection` value used by gameplay logic.

## Progression Pipeline

- The web version does not use a level-select flow for the current playable slice.
- The app starts on the main menu, not directly in gameplay.
- Pressing Start Game runs a short background zoom-out transition, then mounts Level 1 gameplay.
- `App` owns the active `GameState` and listens for `level-won` events from `game/core`.
- A win stores the completed `GameState` and opens a completion overlay instead of immediately advancing.
- The completion overlay advances through `createNextLevelGameState()` only after the Next Level button is clicked.
- Reset dispatches `reset-level`, which restarts only the currently active level.
- Level 5 completion shows a final overlay and returns to the main menu only after Return to Main Menu is clicked.

## UI Layer

- The old two-column bootstrap layout has been removed.
- Gameplay now uses a full-screen Pixi stage over the Unity background art.
- HUD is a DOM overlay with Moves Left on the top-left, current level centered at the top, and an `R Reset` button on the top-right.
- The `R` key also resets only the current level while gameplay is active.
- Main menu credits match the Unity prototype roles, names, and color grouping.
- Completion overlays show win/final-run messaging plus the `Press R to Reset` reminder.

## Animation Pipeline

- Larry's web movement mirrors Unity's `LarryController`: 220 ms horizontal interpolation with a hop-height curve.
- Catapult movement uses the ordered `larry-moved` event path so Larry first hops onto the catapult tile, then hops from that tile to the landing tile.
- Level loads mirror Unity's `LevelLoader` intro: tiles start above the board, drop by diagonal lines using a faster web-tuned fall/line delay, then Larry appears.
- `PixiStage` receives an `introKey` from `App` so fresh level loads and resets can replay the tile drop-in animation.

## Audio Pipeline

- `game/audio.ts` imports all files from root `sound/` and owns music/SFX playback.
- `music.wav` uses a looping `HTMLAudioElement`, starts when the app mounts, and retries on pointer/key interaction if browser autoplay blocks the first attempt.
- Short SFX use Web Audio: files are fetched and decoded into `AudioBuffer`s up front, with preloaded `HTMLAudioElement` fallback for unsupported browsers.
- Gameplay SFX are scheduled from ordered `GameEvent` output so audio follows movement/catapult/health timing with minimal play-time decode delay.
- Manual movement plays `jump.wav` at hop start.
- Catapult launch movement plays `catapult.wav` after Larry has first hopped onto the catapult tile.
- Health pickup plays `heal.wav` after Larry lands on the health tile.
- `passed.mp3`, `lose.wav`, `restart.wav`, and `levelIntro.wav` are bound to level pass, lose, reset, and tile intro flows.

## Coordinate Mapping

- Web axial coordinates use the same `GridIndex` values as Unity `HexCell` objects.
- Unity scene sampling confirmed the layout as `x = q * columnSpacing` and `y = (r + q / 2) * rowSpacing`.
- Browser canvas y increases downward, so web rendering inverts the Unity y projection while keeping gameplay offsets unchanged.
- The web projection is implemented in `game/core/hex.ts` and uses Unity-derived spacing ratios rather than idealized hex math.

## Development Pipeline

1. Setup web project with TypeScript, Vite, Pixi.js, React, and SCSS.
2. Create `game/core` with pure TypeScript board state and movement rules.
3. Convert current Unity levels into JSON.
4. Render the 61-cell hex board with Pixi.js.
5. Add Larry sprite and hop movement.
6. Add click input, adjacency check, move spending, win and fail state.
7. Add blocked, catapult, and health/move-bonus tile behavior.
8. Build React HUD and start/win/lose overlays.
9. Add responsive layout for desktop and mobile web.
10. Deploy static build to Cloudflare Pages or Vercel.

## Milestones

### Milestone 1: Playable Web Slice

- Levels 1-5 load from JSON.
- Board renders in Pixi.js.
- Larry can move by clicking valid neighboring tiles.
- Moves counter, reset, win, and fail work.

### Milestone 2: Full Current Game Port

- Levels 1-5 are available.
- Blocked, catapult, and health tiles work.
- Start menu, level intro, HUD, audio, and outcome overlay are ported.
- Desktop browser version is polished.

### Milestone 3: Mobile Portfolio Polish

- Touch input feels good.
- Portrait and landscape layouts are supported.
- Assets are optimized for fast loading.
- Game can be shared with a public web URL.

### Milestone 4: Optional Backend

Backend is not needed for the first port. Add it only if the project needs:

- Leaderboard
- Daily puzzle
- Analytics
- User accounts
- Shareable replays
- Community level submissions

Recommended backend if needed:

- Node.js for API server.
- PostgreSQL for persistent data.
- Redis only if real-time cache or leaderboard speed becomes necessary.

## Technical Principles

- Keep game rules separate from Pixi rendering.
- Keep UI separate from canvas rendering.
- Store levels as data, not code.
- Load JSON levels through `game/levels` and create runtime state through `game/core`.
- Make the game deterministic so replay, undo, testing, and analytics are easier later.
- Start without backend; add backend only when a feature requires it.
- Optimize for fast load, clear mobile controls, and portfolio readability.

## Current Recommendation

The first real target is a static web build:

```txt
TypeScript + Pixi.js + Vite + React + SCSS + JSON levels
```

This gives the project a clean web-native structure without overbuilding the backend too early.
