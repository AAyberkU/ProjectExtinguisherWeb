This file is the entry point and operational guide for any AI agent working on Project Extinguisher. It defines the documentation order, project workflow, and update rules for keeping the living docs aligned with the actual project.

## Documentation Structure

Repository-wide operational rules are defined in this root `AGENTS.md`. Living project documentation is located in the `docs/` directory. Read the files in this order before changing project files or documentation:

1. `AGENTS.md`: Operational rules and agent expectations.
2. `docs/progress.md`: Current state, recent work, and immediate next steps.
3. `docs/roadmap.md`: Product plan, roadmap steps, and the decision log.
4. `docs/game.md`: Product vision, core loop, content, UX goals, and platforms.
5. `docs/rules.md`: Authoritative hex-steps gameplay rules.
6. `docs/levels.md`: Puzzle Lab level format, pool, selection workflow, and level pipeline.
7. `docs/art.md`: Art decisions, asset pipeline, naming, needed art, code animation, and audio.
8. `docs/design.md`: Stack, architecture (current and target), and engineering principles.
9. `docs/bugs.md`: Confirmed bugs, open technical risks, and fixed issues.

Read the task-specific documents in depth; skim the rest. `docs/reference/` holds external source documents (for example Uğur's hex-steps GDD) kept for traceability; the numbered documents above are the project's own spec.

## Project Direction

- Goal: Ship a polished hex puzzle game with about 60 levels, on Coolmath Games (HTML5) first and Steam later.
- Team: an artist delivers all art, a level designer authors levels in the Puzzle Lab editor (owned by Uğur), and this repository integrates them into the game.
- Rules: Puzzle Lab hex-steps (`docs/rules.md`). The old jam rules and jam levels are retired in roadmap step 1.
- Main stack: TypeScript, Pixi.js, React (DOM shell only), SCSS, Vite, AssetPack, and Puzzle Lab JSON levels.
- Static build with no backend.

## Agent Roles & Workflow

- `developer`: Implements the rules engine, Pixi rendering, React UI, level loading, asset pipeline, and build setup.
- `tester`: Verifies rules against the oracle data, browser behavior, mobile input, build output, and regressions.
- `designer`: Reviews gameplay feel, responsive UX/UI, visual clarity, and readability on phones.
- `docs-maintainer`: Updates `.md` files after significant implementation, design, pipeline, or production-state changes.

## Standard Execution Loop

1. Analysis: Read the `docs/` files and inspect the relevant source, assets, configs, and build scripts before making changes.
2. Implementation: Make the smallest correct change when the user asks for code, architecture, content, UI, or pipeline work.
3. Manual Handoff: For gameplay-affecting changes, stop after implementation and let the user manually test before broad QA or follow-up polish.
4. Quality Assurance: When requested or appropriate, run targeted local checks, browser checks, build checks, or a tester pass.
5. Documentation: Update the affected documents (see Update Protocols) to reflect the actual state of the project.
6. Finalization: Commit or push only when the user explicitly requests it. Do not push automatically after documentation-only or implementation work.

Documentation-only sync tasks skip implementation and manual gameplay handoff unless the sync uncovers a blocking bug that requires a separate fix.

## Working Rules

- Small Steps: Prefer incremental, shippable changes over large rewrites.
- User-Centric: Ask only when a decision is ambiguous or conflicts with the agreed direction in `docs/roadmap.md`.
- Rules Fidelity: The game must reproduce the Puzzle Lab editor's hex-steps rules exactly; the oracle data (each level's stored solution, `minBudget`, and solution count) is the test of record.
- Levels Are Editor Data: Use Puzzle Lab exports as-is. Never hand-edit level files here; fixes go back through the editor.
- Art By Alias: Originals go into `art-source/` with canonical names and are built by `npm run assets`; code references aliases only.
- Separation: Keep game rules separate from Pixi rendering and React/DOM UI. Presentation follows engine events and never decides gameplay.
- Deterministic Logic: Keep state updates pure and predictable for tests, undo, replay, and hints.
- Platform Isolation: Keep portal and Steam specifics behind adapters; no external requests in release builds.
- Backend Discipline: Do not add backend infrastructure.
- Performance: Optimize for fast load, phone readability in landscape and portrait, and touch input.
- Operational Memory: New sessions should summarize the current status from `docs/progress.md` before doing substantial work.
- Language: Project documentation and commit messages are in English.
- Commit Messages: When commits are requested, use concise English commit messages that explain the change and reason.

## Update Protocols

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

## Session Start Checklist

1. Read `AGENTS.md`.
2. Read `docs/progress.md` for the last known state and `docs/roadmap.md` for the current step.
3. Read the documents relevant to the task (`rules.md`, `levels.md`, `art.md`, `design.md`, `game.md`).
4. Check `docs/bugs.md` for blockers and technical risks.
5. Inspect the relevant project files before editing; confirm with the user only if the requested task is unclear.
