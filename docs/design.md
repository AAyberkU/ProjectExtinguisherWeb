# Technical Design

Architecture, stack, and engineering rules. Gameplay rules are in `docs/rules.md`, level data in
`docs/levels.md`, art and audio in `docs/art.md`, and the plan in `docs/roadmap.md`.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript | Strict typecheck via `tsc -b`. |
| Rendering | Pixi.js 8 | Board, tiles, Larry, motion. Kept on 2026-10-10: sprite art from an artist suits Pixi's batching; Echo Rail (PuzzlePanic) moved to Canvas2D only because its art was AI-drawn vector code. |
| UI shell | React 19 + SCSS | Menus, HUD, overlays as DOM. React never runs in the per-frame loop. |
| Build | Vite 8 | `base: './'` so the build works from any sub-path (portals, sub-directories). |
| Assets | AssetPack 1.7 + sharp | See `docs/art.md`. |
| Data | Puzzle Lab JSON | See `docs/levels.md`. |

No backend. Hosting is a static build (Coolmath upload, any static host, or a desktop wrapper later).

## Repository layout

```txt
ProjectExtinguisherWeb/
  AGENTS.md            agent workflow and documentation rules
  README.md
  docs/                living documentation (see AGENTS.md for the reading order)
  art-source/          original art and audio (Git, no LFS)
    images/tiles/  images/characters/  images/backgrounds/  audio/
  apps/web/            the game (npm workspace)
    scripts/build-assets.mjs
    public/            static files; public/game-assets/ is generated
    src/
      main.tsx, App.tsx          React entry and app shell
      styles/main.scss
      game/
        core/                    rules engine (pure TypeScript, no DOM or Pixi)
        levels/                  level files and loader
        renderer/PixiStage.tsx   Pixi board renderer
        assets.ts                asset manifest loading and URL resolution
        audio.ts                 music and SFX
        ui/                      (empty; screens land here in roadmap step 2)
```

## Current architecture (jam port, until roadmap step 1)

- `game/core` is a pure, immutable reducer: `applyCommand(state, command)` returns the new state,
  whether it was accepted, and an ordered `GameEvent[]`. Events drive both animation and audio.
- It implements the **jam rules** (tile activation, no revisits, catapult with an extra move cost).
  These rules are retired in step 1 and replaced by hex-steps (`docs/rules.md`).
- `App.tsx` owns the phase state machine (`menu`, `starting`, `playing`), the game state, the HUD,
  overlays, keyboard reset, and audio triggers.
- `PixiStage` receives the game state as props and renders the board and Larry. It currently
  rebuilds every tile on each state change and runs ad-hoc ticker animations.
- Coordinates: pointy-top cells with `r` growing upward (`x = s*sqrt(3)*(q + r/2)`, `y = -1.5*s*r`)
  and on-screen direction names (`right`, `up_right`, ...). Step 1 switches to the Puzzle Lab
  convention (`r` downward, `E`/`SE`/...).

## Start and loading flow

- On mount the app warms the asset manifest, the gameplay atlas, the background, and audio.
- Start Game switches to `starting`: the menu disappears and the background zooms for 900 ms while
  `PixiStage` mounts hidden (`active={false}`) and initializes WebGL in parallel.
- When the phase becomes `playing`, the board is drawn and the intro plays; `onReady` then shows the
  HUD and plays the intro cue.
- The loading panel only appears while assets are still downloading, while the stage is not ready
  after the transition, or on failure. It fades in after 300 ms, so fast starts never show it.
  Retry remounts the stage.

## Target architecture (roadmap steps 1-3)

- **Engine** (`game/core`): hex-steps rules, pure and deterministic. State is plain data; a move
  returns the next state and an ordered event list (walk, launch, slide, teleport, swap, pickup,
  switch, refill, win or loss reason). Undo is a history of states. The same engine powers tests,
  `level:check`, and hints.
- **Presentation**: persistent tile objects updated from events, never rebuilt per move. Animation
  timelines consume events; the engine never waits for animation. Input is locked while motion
  plays. Win or loss overlays appear after motion ends.
- **Input**: one action layer ("move in direction D" or "select neighbour cell") fed by pointer,
  touch, keyboard, and later gamepad.
- **Screens**: menu, chapter and level select, game, settings, as separate components instead of a
  single `App.tsx`.
- **Save**: an adapter (`get`/`set`) keyed by stable `levelId`. localStorage on web with a namespace
  per portal build; Steam Cloud later. Play continues without saving if storage is unavailable.
- **Platform adapters**: Coolmath (ad-break pause and mute hooks, SDK after acceptance) and Steam
  (wrapper, achievements, cloud save) behind one interface, so the game code stays platform-free.
- **Responsive layout**: board fit computed from the actual board bounds and screen; separate HUD
  layouts for landscape and portrait.

## Technical principles

- Rules stay separate from rendering and UI; rendering never decides gameplay.
- Levels are data from the editor, never code, and never hand-edited here.
- Deterministic engine; replay, undo, oracle tests, and hints build on it.
- Assets are referenced by alias only and built by `npm run assets`.
- Fast first load: about 2 MB for gameplay assets today; keep it small for portals.
- No external requests in release builds (fonts self-hosted before the Coolmath release).
- Small, verified steps; gameplay-affecting changes get a manual play check before merging.

## Build and run

- Root commands: `npm run assets`, `npm run dev`, `npm run typecheck`, `npm run build`,
  `npm run preview`. `dev` and `build` run `assets` first.
- `apps/web/public/manifest.json` and icons provide basic PWA install metadata; there is no service
  worker. The CSS currently blocks portrait on phones (`main.scss`); step 3 removes this.
- The fonts currently load from Google Fonts (`index.html`); this must be self-hosted before a
  Coolmath or Steam release.
