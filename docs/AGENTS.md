This file is the entry point and operational guide for any AI agent joining the Project Extinguisher web port. It defines the documentation order, project workflow, and update rules for keeping the living docs aligned with the actual web pipeline.

## Documentation Structure

All project documentation is located in the `docs/` directory. Read the files in this order before changing project files or documentation:

1. `AGENTS.md`: Operational rules and sub-agent expectations.
2. `game.md`: Game vision, player experience, mechanics, content, and UX goals.
3. `design.md`: Web architecture, stack, milestones, and porting pipeline.
4. `progress.md`: Current project state, completed work, immediate next steps, and session notes.
5. `bugs.md`: Confirmed bugs, open technical risks, and fixed issues.

## Project Direction

- Goal: Port the Unity jam prototype into a web-native, mobile-friendly portfolio game.
- Main stack: TypeScript, Pixi.js, Vite, React, SCSS, and JSON levels.
- First target: Static web build with no backend.
- Backend is optional and should only be added for leaderboard, daily puzzle, analytics, accounts, replays, or community levels.

## Agent Roles & Workflow

- `developer`: Implements TypeScript game logic, Pixi rendering, React UI, data loading, and build setup.
- `tester`: Verifies gameplay parity, browser behavior, mobile input, build output, and regressions.
- `designer`: Reviews gameplay feel, responsive UX/UI, visual clarity, and portfolio presentation.
- `docs-maintainer`: Updates `.md` files after significant implementation, design, pipeline, or production-state changes.

## Standard Execution Loop

1. Analysis: Read the `docs/` files and inspect the relevant source, assets, configs, and build scripts before making changes.
2. Implementation: Make the smallest correct change when the user asks for code, architecture, content, UI, or pipeline work.
3. Manual Handoff: For gameplay-affecting changes, stop after implementation and let the user manually test before broad QA or follow-up polish.
4. Quality Assurance: When requested or appropriate, run targeted local checks, browser checks, build checks, or a tester pass.
5. Documentation: Update `docs/game.md`, `docs/design.md`, `docs/progress.md`, and `docs/bugs.md` to reflect the actual state of the web project.
6. Finalization: Commit or push only when the user explicitly requests it. Do not push automatically after documentation-only or implementation work.

Documentation-only sync tasks skip implementation and manual gameplay handoff unless the sync uncovers a blocking bug that requires a separate fix.

## Working Rules

- Small Steps: Prefer incremental, shippable changes over large rewrites.
- User-Centric: Ask only when a decision is ambiguous or conflicts with the agreed web port direction.
- Web-Native: Build around TypeScript, Pixi.js, Vite, React, SCSS, and JSON levels unless the docs are explicitly changed.
- Separation: Keep game rules separate from Pixi rendering and React/DOM UI.
- Data-Driven: Store levels as JSON data, not hardcoded TypeScript.
- Deterministic Logic: Prefer pure, predictable game-state updates for testing, replay, undo, and analytics.
- Backend Discipline: Do not add backend infrastructure until a feature clearly requires it.
- Performance: Optimize for fast load, mobile readability, touch input, and portfolio clarity.
- Operational Memory: New sessions should summarize the current status from `docs/progress.md` before doing substantial work.
- Commit Messages: When commits are requested, use concise English commit messages that explain the change and reason.

## Update Protocols

| Trigger | Action |
| --- | --- |
| Game rule or content changed | Update `docs/game.md` and `docs/progress.md`. |
| Stack, architecture, or pipeline changed | Update `docs/design.md` and `docs/progress.md`. |
| Milestone or operational progress changed | Update `docs/progress.md`. |
| Bug or technical risk identified | Log it in `docs/bugs.md`. |
| Bug resolved | Move or summarize it under `docs/bugs.md` fixed items. |
| Documentation sync | Cross-check docs against project reality and update every affected doc. |

## Session Start Checklist

1. Read `docs/AGENTS.md`.
2. Read `docs/progress.md` for the last known state.
3. Read `docs/game.md` for game rules, content, and UX goals.
4. Cross-reference `docs/design.md` for stack, architecture, and pipeline constraints.
5. Check `docs/bugs.md` for blockers and technical risks.
6. Inspect the relevant project files before editing; confirm with the user only if the requested task is unclear.
