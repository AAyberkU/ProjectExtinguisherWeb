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
  .github/workflows/   GitHub Actions CI
  docs/                living documentation (see AGENTS.md for the reading order)
  art-source/          original art and audio (Git, no LFS)
    images/tiles/  images/characters/  images/backgrounds/  audio/
  apps/web/            the game (npm workspace)
    levels/pool/       the 180-level Puzzle Lab pool (test fixtures, not bundled)
    scripts/           build-assets.mjs, level-check.ts
    test/              Vitest suites (oracle, rules, validation, campaign)
    public/            static files; public/game-assets/ is generated
    glyph-preview.html dev-only glyph preview page
    fx-preview.html    dev-only outcome effect preview page
    src/
      main.tsx, App.tsx          React entry and app shell
      ui/                        GameScreen, Hud, NextBadge, MainMenu, LevelSelect, TutorialHint, icons
      styles/                    main.scss plus _hud, _menus, _tutorial partials
      game/
        engine/                  hex-steps rules, solver, validation (pure TypeScript)
        levels/                  campaign loader; campaign/ holds the shipped level files
        renderer/                Pixi stage, board view, timeline, layout, art, glyphs
        session.ts               play session and undo history
        assets.ts                asset manifest loading and URL resolution
        audio.ts                 music and SFX with on/off toggles
        save.ts, progress.ts     save adapter and unlock / continue logic
        tutorial.ts              tutorial hints derived from the campaign
```

## Current architecture

- **Engine** (`game/engine/`): hex-steps rules, pure and deterministic (`docs/rules.md`).
  `compileLevel`, `initialState`, `step` (returns the next state and ordered events), `legalMoves`,
  `cellContent`, solver (`bfsSolve`, `minBudget`, `countSolutions`), and `validateLevel`.
- **Levels** (`game/levels/campaign.ts`): loads and compiles the campaign (`docs/levels.md`).
- **Session** (`game/session.ts`): current level, play state, and undo history; every change goes
  through the engine. Undo also works after a loss; restart returns to the initial state.
- **App** (`App.tsx`): phase state machine (`menu`, `starting`, `playing`), start transition and
  loading, main menu, the level select overlay, global keys (`Esc`, `M`, `V`), audio toggles, and the
  dev-only `window.extinguisherDebug` API (`goTo`, `loadLevel`, `stats`, `cellScreenPoint`,
  `setBoardFill`, `unlockAll`, `resetSave`).
- **GameScreen** (`ui/GameScreen.tsx`): session, Pixi stage, HUD, next badge, tutorial hint,
  outcomes, and gameplay keys. A win is saved as soon as the engine reports it; presentation follows.
- **Save** (`game/save.ts`, `game/progress.ts`): `SaveStore` over a storage adapter (localStorage on
  web, memory in tests); completed level ids, music and SFX toggles, seen tutorials; merges with the
  stored data on every write so two tabs do not overwrite each other. Unlock is linear.
- **Renderer** (`game/renderer/`):
  - `PixiStage.tsx`: React wrapper; `stageController.ts`: the Pixi application and resize.
  - `layout.ts`: board bounds from all cells, fitted below the measured HUD height with no maximum
    scale, so every board (19 to 91 cells) fills the same area and smaller boards get bigger hexes.
    The board fills 78% of that area (`DEFAULT_BOARD_FILL`) to leave room around it; dev builds can
    try other values with `extinguisherDebug.setBoardFill(0.7)`.
  - `boardView.ts`: persistent tile views built once per level load or restart, updated in place;
    Larry, legal-move highlights, and every event animation.
  - `timeline.ts`: plays engine events in order and calls audio cues as each animation starts.
  - `animator.ts`: runs the Pixi ticker only while something animates; otherwise renders on demand.
  - `tileArt.ts`: base sprites and seeded floor and wall variants (seeded by level id and the cell
    whose content is shown, so swapped tiles keep their look); `glyphs.ts`: placeholder glyphs.
- **Input**: tap or click a highlighted neighbour, or keys `W` (NW), `E` (NE), `A`/Left (W), `D`/Right
  (E), `Z` (SW), `X` (SE); `Backspace` undo; `R` restart. Input is locked while motion plays
  (`data-busy` on `.game-panel`) and during the level intro.
- **HUD** (`ui/Hud.tsx`): left `Level N`, Undo, Restart; centre the steps counter; right Music, SFX,
  Menu. There are no win or loss panels: after motion ends the stage plays `celebrate(final)` or
  `showLoss(reason)` (`renderer/effects.ts`) and the HUD flashes the counter or pulses Undo and
  Restart; after a win the next badge appears. Test hooks: `.game-panel[data-busy][data-outcome]
  [data-loss-reason]`, `.game-hud[data-level-id][data-steps]`, `.next-badge[data-action]`.
- **Tutorial**: `renderer/hintGlow.ts` draws the glow (`setHint`), `ui/TutorialHint.tsx` places the
  text next to the cell (`hintAnchor`, `onLayout`).
- Render resolution is the device pixel ratio clamped to 1-3.

## Start and loading flow

- On mount the app warms the asset manifest, the gameplay atlas, the background, and audio.
- Start Game switches to `starting`: the menu disappears and the background zooms for 900 ms while
  `PixiStage` mounts hidden (`active={false}`) and initializes WebGL in parallel.
- When the phase becomes `playing`, the board is drawn and the intro plays; `onReady` then shows the
  HUD and plays the intro cue.
- The loading panel only appears while assets are still downloading, while the stage is not ready
  after the transition, or on failure. It fades in after 300 ms, so fast starts never show it.
  Retry remounts the stage.

## Target architecture (roadmap steps 3-6)

- **Input**: one action layer fed by pointer, touch, keyboard, and later gamepad (today the keyboard
  and pointer paths live in `App.tsx` and `boardView.ts`).
- **Save**: a separate save namespace per portal build; Steam Cloud behind the same adapter later.
- **Platform adapters**: Coolmath (ad-break pause and mute hooks, SDK after acceptance) and Steam
  (wrapper, achievements, cloud save) behind one interface, so the game code stays platform-free.
- **Responsive layout**: separate HUD layouts for landscape and portrait (the board already fits any
  screen).

## Technical principles

- Rules stay separate from rendering and UI; rendering never decides gameplay.
- Levels are data from the editor, never code, and never hand-edited here.
- Deterministic engine; replay, undo, oracle tests, and hints build on it.
- Assets are referenced by alias only and built by `npm run assets`.
- Fast first load: about 2 MB for gameplay assets today; keep it small for portals.
- No external requests in release builds (fonts self-hosted before the Coolmath release).
- Small, verified steps; gameplay-affecting changes get a manual play check before merging.

## Build and run

- Root commands: `npm run assets`, `npm run dev`, `npm run typecheck`, `npm test`,
  `npm run level:check`, `npm run build`, `npm run preview`. `dev` and `build` run `assets` first.
- Tests use Vitest (`apps/web/test/`, config `apps/web/vitest.config.ts`); `level:check` runs with tsx
  (`apps/web/scripts/level-check.ts`).
- GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, tests, and `level:check` on every push
  and pull request. It reports results; it never blocks a push.
- `apps/web/public/manifest.json` and icons provide basic PWA install metadata; there is no service
  worker. Portrait is no longer blocked on phones.
- The fonts currently load from Google Fonts (`index.html`); this must be self-hosted before a
  Coolmath or Steam release.
