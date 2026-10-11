# Hex Steps Rules

This is the authoritative gameplay specification. The game uses the **hex-steps** ruleset from the
team's Puzzle Lab level editor (<https://bilaxten.art/leveleditor/>, owned by Uğur). All levels are
authored and validated there, so the game must reproduce the editor's rules exactly.

Sources: the editor's core script (`<script id="pl-core">`, hex-steps profile) and Uğur's game
design document (rules table 1-20, received 2026-10-10, copy in `docs/reference/hex-steps-gdd.md`).
The GDD rules and the editor code agree with this document; where wording differs, the code is
authoritative (see the quirks at the end).
On 2026-10-10 an independent simulator built from this specification, and the editor's own core
logic, both reproduced all 180 pool levels: stored shortest solution, `minBudget`, solution count,
and the exact `shortest` path matched 180/180.

> Status: the game runs this ruleset in `apps/web/src/game/engine` (since 2026-10-10). Oracle tests
> reproduce every pool level's stored solution, `minBudget`, and solution count, and an independent
> review fuzzed 2,520 random levels against the editor's own core with zero mismatches.

## Grid

- Axial coordinates `(q, r)`, pointy-top hexes, `r` grows **downward** on screen.
- Pixel centre: `x = s * sqrt(3) * (q + r / 2)`, `y = 1.5 * s * r`.
- Directions and vectors, clockwise on screen from the right:

  | Name | Vector | Screen direction |
  | --- | --- | --- |
  | `E` | (1, 0) | right |
  | `SE` | (0, 1) | down-right |
  | `SW` | (-1, 1) | down-left |
  | `W` | (-1, 0) | left |
  | `NW` | (0, -1) | up-left |
  | `NE` | (1, -1) | up-right |

- The solver tries moves in the order `E, SE, SW, W, NW, NE`, which decides which of several equally
  short paths is stored as `shortest`.
- `grid.size` is the number of cells across the widest row (odd, 3 to 41). Radius
  `R = (size - 1) / 2`; a cell is on the board when `max(|q|, |r|, |q + r|) <= R`; the board has
  `3R(R + 1) + 1` cells. The pool uses sizes 5, 7, 9, and 11 (19, 37, 61, and 91 cells).
- hex-steps maps are **solid**: every board cell has a tile. Impassable cells are `blocker` tiles.
  (Since 2026-10-03 the editor has no empty cells for this ruleset; older levels with holes were
  converted to blockers so they play the same. See `docs/levels.md`.)

## State

`(position, steps, collected +1 mask, switch colour bits 1-3, swap phase 0/1)`.

## A move

The player always starts on the cell authored as `start`, even when `start` is part of a swap pair.

The player picks one of the six directions. A move is resolved in this order:

1. **Swap.** If the level has swap pairs, the global phase flips first. The move is judged on the
   swapped board.
2. **Leaving.** If the current cell's content (under the new phase) is a passage whose `noOut`
   contains the move direction, the move is illegal.
3. **Entering.** The target is the neighbour in that direction. It must exist, must not be a wall
   (`blocker`, or a `door` whose colour is not switched on), and if it is a passage its `noIn` must
   not contain the side you enter through (the opposite of the move direction).
4. **Cost.** 2 steps if the target is a `swamp`, otherwise 1. Only the first cell walked into
   decides the cost.
5. **Arrival chain** on the target (below).
6. **Steps.** `steps = max(0, steps - cost + gain)`. If a refill fired, steps are set to its value
   instead.

An illegal move changes nothing; the swap phase does not flip either.

Revisiting cells is allowed. 60 of the 180 pool solutions step on a cell twice.

## Winning and losing

- No move is possible when steps are 0.
- After each move, in this order: reaching the finish wins (even with 0 steps left); otherwise 0
  steps loses; otherwise, if no geometrically legal move exists, the level is lost. The last check
  ignores step costs.
- The level is lost at the start if the budget is 0 or the start cell has no legal move.
- Reaching the finish ends the level immediately.
- In every pool level the budget equals `minBudget`, so every intended solution ends on exactly
  0 steps.

## Arrival chain

Applied to the cell the player arrives on; launchers and movers can continue it (at most 32 links;
loops are a validation error). Only the final cell acts: cells flown over or slid over are ignored.

| Tile | Effect on arrival |
| --- | --- |
| `finish` | Win. Stop. |
| `plus1` | First time only: +1 step (tracked per tile, also across swaps). Then it behaves like floor. At most 31 per level. Stop. |
| `refill` (`value` 1-99) | Set steps to `value`, even if you had more. Fires on every entry. The move's cost is paid first, so a move that would reach 0 still survives when it ends on a refill. Stop. |
| `switch` (`color` 1-3, shown A/B/C) | Permanently opens every `door` of the same colour. Stop. |
| `portal` (`pair` >= 1) | Teleport to the cell currently holding the partner portal. The arrival portal does not fire. Stop. |
| `launcher` (`dir`) | Fly 2 cells along `dir` if that cell exists and is not a wall; otherwise 1 cell under the same condition; otherwise stay on the launcher without re-triggering it. Flies over walls, closed doors, and passage sides. Continue the chain on the landing cell. |
| `mover` (`dir`) | Slide along `dir` one cell at a time over floor-like cells (floor, start, open door, collected +1). Stop before a cell that cannot be entered (edge, wall, closed door, passage `noIn`); stop on the first non-floor-like cell and continue the chain there. |
| `floor`, `start`, `swamp`, open `door`, `passage` | Nothing. |

Arriving on a swamp by launch, slide, or teleport costs nothing extra. Landing on a switch presses
it. A launch can chain into a portal.

## Tiles

| Type | Fields | Meaning |
| --- | --- | --- |
| `floor` | | Plain walkable cell. |
| `start` | | Player spawn; exactly one. Plain floor afterwards. |
| `finish` | | Goal; exactly one. |
| `blocker` | | Wall. Cannot be entered or landed on; launchers fly over it. |
| `plus1` | | +1 step once. |
| `launcher` | `dir` | Costs 1 to enter, then a free 2-cell launch. |
| `swamp` | | Costs 2 to walk into. Entering with 1 step left is legal but loses. |
| `mover` | `dir` | Costs 1 to enter, then a free slide. |
| `portal` | `pair` | Exactly two portals per pair id. |
| `switch` | `color` | Opens same-colour doors permanently. |
| `door` | `color` | Wall until its switch is pressed. |
| `passage` | `noIn`, `noOut` | Arrays of sides. `noIn: [X]` blocks entering through side X; `noOut: [X]` blocks leaving in direction X. Launches ignore passage sides. |
| `refill` | `value` | Sets steps to `value` on every entry. |
| any type | `swap` | Swap pair id (exactly two tiles per id). |

### Swap

- One global phase flips on every legal move; all swap pairs share it. Phase 0 is the authored
  layout, so the first move is already judged on the swapped board.
- The two cells trade their content (type, dir, colour, pair, value, sides, collected state). The
  swap mark stays on the cell.
- The player is never moved by a swap, and nothing fires on the player's own cell (a finish swapping
  under the player does not win).
- A launcher's landing is measured from the cell it currently sits on.

## Solver and stored metadata

- `meta.solution.shortest` lists only the player's input directions. Launches, slides, and
  teleports are not encoded.
- `minBudget`: the smallest budget that is solvable (binary search over a BFS solve).
- `solutions`: distinct move sequences that never repeat a full state. Back-and-forth beside a
  refill is reported as `looped` and not counted (28 pool levels in chapters 9-10 carry this flag).
- The editor considers a variant valid only with no errors or warnings, exactly one solution, and
  budget equal to `minBudget`.

## Validation rules (from the editor)

Errors: level id must match `^[A-Za-z0-9][A-Za-z0-9_-]*$` and not be `pack`; steps an integer
0-999; integer coordinates; no duplicate cells; known tile types; exactly one start and one finish;
at most 31 `plus1`; valid `dir`; colour 1-3; refill value 1-99; portal pair an integer >= 1 with
exactly two per pair; valid passage sides; swap an integer >= 1 with exactly two per id; no launcher
cycles or mover/launcher slide loops (checked for every switch combination and both phases).

Warnings: tile outside the board; passage closed on all sides; door without a switch; launcher that
cannot launch; unreachable tiles; budget looser than `minBudget`.

## Editor presentation reference

Useful defaults until our own art and tuning exist:

- Animation timing: walk 110 ms, launch 190 ms, slide 160 ms, teleport instant.
- Keyboard in the editor (pointy; our game moves by tap only): `d`/Right = E, `x` = SE, `z` = SW, `a`/Left = W, `w` = NW, `e` = NE;
  Backspace undoes; restart is available.
- HUD messages: "Won! N moves, K steps left", "Out of steps", "No moves left".
- Placeholder glyphs: start ring; finish ring with dot; plus1 "+1"; launcher arrow; blocker cross;
  swamp "≈"; mover "»" chevrons; portal double ring with pair number; refill ring with value;
  switch dot with letter; door rectangle with letter; passage bars (both ways closed) and arrows
  (one-way, pointing the allowed way); swap dotted ring with a numbered badge.

## Known editor quirks (the code is authoritative)

- The editor's rules text says movers obey passage sides, but only `noIn` is checked during a slide.
- A launch landing ignores the landing passage's `noIn`.
- The "no moves left" check ignores step cost, so a swamp neighbour you cannot afford still counts
  as a legal move.
- Loop validation has gaps (same in the editor and in our engine): it only starts from cells authored
  as movers or launchers and only with no `+1` collected. A chain can therefore still hit the 32-link
  limit at runtime, for example when a collected `+1` lets two movers face each other, or when swap
  phase 1 brings movers onto cells authored as floor. The player then simply stops where the chain
  limit leaves them. No pool level is affected; worth reporting to Uğur.
