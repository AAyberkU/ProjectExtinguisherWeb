# Project Extinguisher 🚒

A hex puzzle game: guide Larry from the start to the finish on a tight step budget, using launchers,
movers, portals, switches, and other mechanics. Every level has exactly one solution that uses
exactly the given steps.

Project Extinguisher started as a Unity game-jam prototype and was ported to the web. It is now
being built into a full release of about 60 levels for Coolmath Games, with Steam to follow.

## Status

The game runs the hex-steps rules on a temporary 60-level campaign picked from the level designer's
pool, with placeholder art. Next up are menus, level select, and saving. See
`docs/progress.md` and `docs/roadmap.md`.

## How it is made

- **Levels** are authored and approved in the team's Puzzle Lab editor and used in the game as
  exported (`docs/levels.md`).
- **Rules** follow the editor's hex-steps ruleset exactly, verified against every level's stored
  solution (`docs/rules.md`).
- **Art** is drawn by the team artist and built into atlases by `npm run assets`; all animation is
  done in code (`docs/art.md`).

## Tech stack

- TypeScript game logic, Pixi.js rendering, React + SCSS for the UI shell, Vite build.
- AssetPack + sharp asset pipeline (WebP atlas, MP3 audio, Pixi manifest).
- Static build, no backend; relative base path so the build runs from any sub-directory or portal.

## Getting started

Requires Node.js 20 or newer. From the repository root:

```bash
npm install
npm run dev        # builds game assets from art-source/, then starts Vite
```

Other commands:

```bash
npm run assets     # rebuild game assets after adding or changing art in art-source/
npm run typecheck
npm test           # rules, oracle (every level's stored solution), validation, campaign
npm run level:check  # validate level files with the editor's rules
npm run build      # assets + typecheck + production build in apps/web/dist
npm run preview
```

Controls: tap or click a highlighted cell to move. Z undoes, R restarts, M and V toggle
music and sound effects, Esc opens the level select.

## Documentation and agent workflow

The project is developed with AI agents guided by the root `AGENTS.md` and the living documentation
in `docs/`. Each session starts from `docs/progress.md`, follows the plan in `docs/roadmap.md`, and
updates the documents after every meaningful change.

| Document | Contents |
| --- | --- |
| `docs/progress.md` | Current state and work log |
| `docs/roadmap.md` | Plan and decision log |
| `docs/game.md` | Product brief |
| `docs/rules.md` | hex-steps rules |
| `docs/levels.md` | Level format and pipeline |
| `docs/art.md` | Art, assets, animation, audio |
| `docs/design.md` | Architecture and engineering principles |
| `docs/bugs.md` | Bugs and risks |
