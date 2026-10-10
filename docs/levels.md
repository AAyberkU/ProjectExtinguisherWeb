# Level Pipeline

How levels are authored, chosen, and brought into the game. Rules live in `docs/rules.md`.

## Who does what

- **Level designer** authors levels in the Puzzle Lab editor (<https://bilaxten.art/leveleditor/>,
  team accounts, owned by Uğur). The editor plays, analyses, and solves levels, and generates
  variants with AI authors.
- **Selection and approval happen in the editor**, not in the game. The editor's Pool and Final
  workspaces hold every level with its chapter, slot, review state, and reviewer.
- **We (integration)** take the editor's Final export and put it in the game as-is. Level data is
  never hand-edited in this repository; fixes go back through the editor and a new export.

## Format: `puzzle-lab/level@1`

```json
{
  "format": "puzzle-lab/level@1",
  "game": "hex-steps",
  "id": "c01-l01-v1",
  "name": "İlk engel",
  "grid": { "size": 5, "type": "hex", "coords": "axial", "orientation": "pointy" },
  "params": { "steps": 5 },
  "tiles": [
    { "q": -1, "r": -1, "type": "start" },
    { "q": 1, "r": -1, "type": "finish" },
    { "q": -1, "r": 1, "type": "plus1" },
    { "q": 0, "r": 0, "type": "blocker" },
    { "q": -3, "r": 2, "type": "launcher", "dir": "E" }
  ],
  "meta": {
    "slot": 1,
    "author": "Lumen (Claude)",
    "approved": { "by": "Uğur", "date": "2026-09-27", "note": "Son sürümde kullanılacak" },
    "solution": { "solvable": true, "minBudget": 5, "solutions": 1, "shortest": ["SW", "SE", "E", "E", "NE", "NW"] }
  }
}
```

- `tiles` lists every board cell (solid map). Extra tile fields are described in `docs/rules.md`.
- `meta.slot = (chapter - 1) * 6 + position`.
- A pack (`puzzle-lab/pack@1`) wraps levels: `{ format, game, name, count, levels: [...] }`.
- Exports sort tiles by `r` then `q`.

## Coordinate convention

The game uses the Puzzle Lab convention directly: pointy-top axial coordinates with `r` growing
downward and compass direction names (`E`, `SE`, `SW`, `W`, `NW`, `NE`), so exports load without
conversion. On-screen meaning: `E` right, `SE` down-right, `SW` down-left, `W` left, `NW` up-left,
`NE` up-right.

## Current pool (received 2026-10-10, not canon)

- `havuz.zip` from the level designer: 180 level files plus `pack.json` with the same 180 levels.
  The same data is on the editor server (submitted 2026-10-03, state `pending`).
- 10 chapters x 6 slots x 3 alternatives. Each slot's alternatives come from three AI authors:
  `GPT` (`-v1-2` ids), `Lumen (Claude)` (`-v1` ids), and `Lumen v2 (Claude)` (base ids).
- Only `c01-l01-v1` is marked approved ("Son sürümde kullanılacak"). No alternative is final; whole
  slots may be replaced with new levels.
- All 180 are structurally valid, solvable, have exactly one solution, and use budget = `minBudget`.
- Board sizes: 5 (12 levels), 7 (50), 9 (82), 11 (36). Alternatives of one slot often use different
  sizes.
- Steps 2-18 (median 6); shortest solutions 3-24 moves (median 7).

Chapter plan (each chapter introduces one mechanic, chapter 10 mixes them):

| Chapter | New mechanic |
| --- | --- |
| c01 | `plus1` (with floor, blocker, start, finish) |
| c02 | `launcher` |
| c03 | `swamp` |
| c04 | `mover` |
| c05 | `swap` |
| c06 | `portal` |
| c07 | `switch` / `door` |
| c08 | `passage` |
| c09 | `refill` |
| c10 | mixed |

All mechanics are planned for the game. If one is cancelled, a replacement mechanic takes its slot.

## Edge blockers are walls (decided 2026-10-10)

Large boards are mostly blockers: size-11 levels play on a median of about 30 of 91 cells. Before
2026-10-03 the editor allowed empty cells; it then made hex-steps maps solid and converted old holes
to blockers (`solidify(level, 'blocker')`, "an old level with holes plays the same with walls").
Uğur confirmed the AI authors defined those cells as walls.

Decision: keep the data as exported. Blockers are walls. Turning edge-connected blockers into floor
would open shortcuts in 87 of the 129 levels that have them (the approved `c01-l01-v1` would drop
from 5 to 2 steps). The game reads tile types from data, so if the editor ever changes a cell, a new
export carries the change and the oracle tests re-verify it.

All blockers are drawn (see `docs/art.md`).

## In-game pipeline

- **Pool** `apps/web/levels/pool/`: all 180 pool levels, byte-for-byte as exported. Used as oracle
  test fixtures and as the source for picking levels. Not bundled into the game.
- **Campaign** `apps/web/src/game/levels/campaign/`: the levels the game ships (copies of exported
  files, never edited) plus `campaign.json` (chapters and order). `campaign.ts` loads them with
  `import.meta.glob`, compiles them with the engine, and exposes the ordered list.
- **Current campaign is temporary** (`campaign.json` status `temporary`): the base alternative
  (`Lumen v2`) of every slot, except `c01-l01`, which uses the approved `c01-l01-v1`.
- **When the Final export arrives:** replace the files in `campaign/` with the export and rewrite
  `campaign.json` from its slot data (`meta.slot`; the export may need a small script if it lacks an
  order), then run `npm run level:check` and `npm test`.
- **`npm run level:check -- [files or folders]`** (default: pool and campaign): the editor's validation
  errors and warnings, solver consistency (solvable within steps, solution count, `minBudget` versus
  steps), a check that `meta.solution` matches the computed values, file name equals level id, and
  `campaign.json` integrity. Exit code 1 on any error.
- **`npm test`**: oracle tests on every pool and campaign level, focused rule tests, validation tests,
  and campaign integrity. GitHub Actions runs typecheck, tests, and `level:check` on every push.
- **Developer access:** in dev builds only, `window.extinguisherDebug` offers `goTo(n)`,
  `loadLevel(json)`, `stats()`, and `cellScreenPoint(q, r)`. It is absent from production builds.
- The jam levels and the jam ruleset were removed on 2026-10-10.
- Level names come straight from the export (for example `v2 · Halka`); final names should be set in
  the editor.

