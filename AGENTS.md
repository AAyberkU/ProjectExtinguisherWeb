# AGENTS.md

Operational guide for agents working on Project Extinguisher. Living docs are in `docs/`.

## Project Direction

- Goal: ship a polished hex puzzle game with about 60 levels, on Coolmath Games (HTML5) first and Steam later.
- Team: an artist delivers all art, a level designer authors levels in the Puzzle Lab editor (owned by Uğur), and this repository integrates them.
- Rules: Puzzle Lab hex-steps (`docs/rules.md`). The old jam rules and jam levels are retired in roadmap step 1.
- Stack: TypeScript, Pixi.js, React (DOM shell only), SCSS, Vite, AssetPack, Puzzle Lab JSON levels. Static build, no backend.

## Which Doc To Read

Default: `docs/progress.md` (current state) and `docs/roadmap.md` (current step, decision log). Read others only when the task needs them. `docs/reference/` holds external source documents kept for traceability (for example Uğur's hex-steps GDD); the docs below are the project's own spec.

| Task | Read |
| --- | --- |
| Gameplay rules (authoritative hex-steps) | `docs/rules.md` |
| Level format, pool, selection workflow, pipeline | `docs/levels.md` |
| Art decisions, asset pipeline, naming, animation, audio | `docs/art.md` |
| Product vision, core loop, content, UX, platforms | `docs/game.md` |
| Stack, architecture (current and target), engineering principles | `docs/design.md` |
| Blockers, open risks, fixed issues | `docs/bugs.md` |

## Workflow

- Inspect the relevant source, assets, configs, and build scripts before changing them. Ask only when a decision is ambiguous or conflicts with `docs/roadmap.md`.
- After a gameplay-affecting change, stop and let the user test manually before broad QA or polish.
- Commit or push only when the user explicitly asks. Never push automatically. Commits and project documentation are in English; commit messages are concise and explain change and reason.
- Documentation-only sync tasks skip implementation and manual handoff unless the sync finds a blocking bug.

## Working Rules

- Rules fidelity: the game must reproduce the Puzzle Lab editor's hex-steps rules exactly. The oracle data (each level's stored solution, `minBudget`, and solution count) is the test of record.
- Levels are editor data: use Puzzle Lab exports as-is. Never hand-edit level files here; fixes go back through the editor.
- Art by alias: originals go into `art-source/` with canonical names and are built by `npm run assets`; code references aliases only.
- Separation: keep game rules separate from Pixi rendering and React/DOM UI. Presentation follows engine events and never decides gameplay.
- Deterministic logic: keep state updates pure and predictable for tests, undo, replay, and hints.
- Platform isolation: keep portal and Steam specifics behind adapters; no external requests in release builds.
- No backend infrastructure.

## Update Protocols

Update docs last, in the order the row lists them.

| Trigger | Action |
| --- | --- |
| Gameplay rule changed (editor or decision) | Update `docs/rules.md`, the oracle data, and `docs/progress.md`. |
| Level format, pool, or selection workflow changed | Update `docs/levels.md` and `docs/progress.md`. |
| Art, asset pipeline, naming, or animation plan changed | Update `docs/art.md` and `docs/progress.md`. |
| Product vision, content, or UX changed | Update `docs/game.md` and `docs/progress.md`. |
| Stack or architecture changed | Update `docs/design.md` and `docs/progress.md`. |
| Decision made or roadmap step finished | Update `docs/roadmap.md` (checkboxes and decision log) and `docs/progress.md`. |
| Bug or technical risk identified | Log it in `docs/bugs.md`. |
| Bug resolved | Move or summarize it under `docs/bugs.md` fixed items. |
| Documentation sync | Cross-check docs against project reality and update every affected doc. |

If you notice other problems while working, mention them briefly in your report.
