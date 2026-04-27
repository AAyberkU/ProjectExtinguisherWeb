# Project Extinguisher Web Port Design

## Goal

Project Extinguisher'ın Unity jam prototipini web-native, hızlı açılan, mobil uyumlu ve portfolio değerine sahip bir tarayıcı oyununa portlamak.

## Recommended Stack

- TypeScript: Web portun ana dili. JavaScript'in tip güvenliği olan hali.
- Pixi.js: Hex board, tile sprite'ları, Larry, background ve animasyonları çizecek 2D render katmanı.
- Vite: Development server ve production build aracı.
- React: Menü, HUD, level select, win/lose ekranı ve settings gibi canvas dışı UI katmanı.
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

- Level 1 loads from JSON.
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
