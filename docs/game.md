# Game Brief

What Project Extinguisher is as a product. Read this before working on mechanics, UI, levels, or
polish. Exact rules are in `docs/rules.md`; the plan is in `docs/roadmap.md`.

## One-liner

A hex puzzle game where Larry crosses the board to the finish on a tight step budget, using
launchers, movers, portals, switches, and other mechanics. Every level has exactly one solution that
uses exactly the given steps.

## Origin and direction

- Started as a Unity game-jam prototype (`ProjectExtinguisher`, 5 levels, fixed 61-cell board).
- This repository first ported the jam game to the web. It is now becoming the full product: about
  60 levels in 10 chapters, released on Coolmath Games first and Steam later.
- Team: an artist (all art), a level designer (levels in the Puzzle Lab editor), Uğur (Puzzle Lab
  editor and its rules), and Ayberk (integration and game code).

## Core loop

1. Pick a level (chapter and level select, roadmap step 2).
2. Read the board: start, finish, step budget, special tiles.
3. Move Larry one neighbouring cell at a time (tap or click a neighbour, or use the keyboard).
4. Each move spends steps; special tiles launch, slide, teleport, refill, open doors, or swap cells.
5. Reach the finish before the steps run out, or retry, undo, and rethink.

## Rules summary (hex-steps)

- Moving to a neighbour costs 1 step (2 into a swamp). Revisiting cells is allowed.
- Win by reaching the finish, even with 0 steps left. Lose when steps reach 0 elsewhere, or when no
  legal move exists.
- Walls (blockers) cannot be entered; launchers fly over them.
- Mechanics: +1 step, launcher, swamp, mover, swap pairs, portals, switches and doors, one-way
  passages, refill. Full details in `docs/rules.md`.

## Content

- 10 chapters x 6 levels. Each chapter introduces one mechanic and chapter 10 mixes them (plan in
  `docs/levels.md`).
- Board size varies per level (19, 37, 61, or 91 cells).
- Levels are authored and approved in the Puzzle Lab editor and used as exported.
- Current state: a pool of 180 candidate levels (3 alternatives per slot), none final yet. The game
  plays a temporary 60-level campaign (one alternative per slot) on the hex-steps rules.

## Level design intent

- One clear idea per level; the budget makes the intended route the only route.
- Early chapters teach each mechanic in isolation; later levels combine them.
- No hidden knowledge: every rule is visible from the board.
- Puzzles should feel clever, never random.

## Progress and scoring (from the GDD)

- Only completed level ids are saved (localStorage on web). Finishing a level unlocks the next one.
- No score and no stars.

## UX goals

- Open on a main menu; music starts on load and loops.
- Start Game zooms the background out and drops the board in; no loading panel on normal starts.
- Movement feels toy-like: Larry hops between cells; launches, slides, and teleports are readable.
- Valid moves are visually clear; failure is fast to retry; undo is always available.
- Works on desktop and mobile browsers, in landscape and portrait.
- Every new mechanic gets a short tutorial at the start of its chapter.

## Platforms

- Coolmath Games (HTML5, iframe, no external requests or links, family-friendly).
- Steam (desktop wrapper, achievements, cloud save, gamepad; later).
- Static web build; no backend.

## Non-goals

- No multiplayer, accounts, or backend.
- No procedural levels in the game (variant generation stays in the editor).
- No physics engine.
- No in-game level editor or level browser.
