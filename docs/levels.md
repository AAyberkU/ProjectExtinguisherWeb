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
- When received, all 180 were valid, solvable, had exactly one solution, and used budget = `minBudget`.
- **Re-exported for the car rule (2026-10-16):** movers became cars in the editor on 2026-10-13
  (rule 15), which changed the analysis of 8 pool levels. Their files were regenerated through the
  editor's own export path (`PL.stringify(PL.exportLevel(level, PL.analyze({ ...level, id: 'x' })))`
  with the editor core fetched on 2026-10-16), equivalent to a fresh Export; only `meta.solution` changed.
  Regenerated the same way, the other 172 files are byte-identical (line endings normalized), so
  they were left alone. Now invalid: `c05-l03`, `c05-l03-v1-2`, `c05-l05-v1-2`, and `c10-l06-v1` (a
  mover in a swap pair), `c04-l05-v1` and `c07-l02` (need 8 and 6 steps, budgets 7 and 5). Now a
  loose budget with many solutions: `c06-l05-v1` (17) and `c10-l02-v1` (28).
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

## v3 set (authored 2026-10-14, the current campaign)

- Uğur authored a complete new 60-level set in the editor on 2026-10-14 (names start with `v3 · `)
  and submitted all of it for review (editor state `pending`, not approved; `meta` has no
  `approved`). Exported with the editor's own export code, byte-identical to its Export button.
- Ids are `level-01` to `level-60`; `meta.slot` equals the id number, so chapter `cNN` holds slots
  `6(NN-1)+1` to `6NN` in order. The campaign test checks that `meta.slot` matches the position.
- Editor analysis: no errors or warnings, exactly one solution each, `params.steps = minBudget`.
  Boards are size 5 (36 levels) and 7 (24); budgets 1-10. In refill levels the stored solution
  can end with steps left (level 55 ends on 1; the editor's replay agrees).
- Mechanics follow the chapter plan above: each first appears on its chapter's first level (level 1
  `plus1`, 7 `launcher`, 13 `swamp`, 19 `mover`, 25 `swap`, 31 `portal`, 37 `switch`/`door`, 43
  `passage`, 49 `refill`), and later chapters reuse earlier mechanics. `swap` is a tile field, not a
  tile type: 16 levels use it (25-30, 35, 38, 44, 53-57, 59, 60).
- The editor also holds an alternative for slot 23 ("Level 23 alternatif — Taksiye atla") with the
  same id `level-23`. It is not used; the campaign has the main `level-23` ("v3 · Basamak araba").
- **Cars:** the set was made after the editor's mover rule changed (2026-10-13, a mover is a car that
  carries the player once and then stays parked as a wall; `docs/rules.md`). The engine follows it
  since 2026-10-16; before that, 14 of the 60 levels failed the oracle.
- Not kept as separate fixtures: the campaign folder is the set, byte for byte, and is already
  oracle-tested; Git history keeps it if a later export replaces it.

## Edge blockers are walls (decided 2026-10-10)

History (from Uğur, 2026-10-10):

- The **Lumen v1** set (`-v1` ids) and the **GPT** set (`-v1-2` ids) were designed on maps with empty
  cells. Empty cells and blockers behave identically (no walking or landing on them, slides stop in
  front of them, launches fly over them), so the designers used empty cells as walls on purpose.
  There was no bug.
- Then the rule "maps contain no empty cells" came (2026-10-03). Filling the v1 holes with floor
  opened shortcuts in 58 of its 60 levels (our own test found 87 of the 129 pool levels with edge
  blockers), so the holes were converted to blockers and gameplay stayed exactly the same. The editor
  also fills holes with blockers automatically when GPT-set levels are saved.
- The **Lumen v2** set (base ids) was made from scratch for the no-holes rule: a full hexagon of floor,
  no padding blockers, every blocker has a purpose. The data agrees: only 17 of v2's 50 blockers touch
  the board edge (in 9 levels), against about 95% of the blockers in the other two sets.
- Conclusion: v1 and GPT levels keep their blockers; a level that should be "full floor" is picked
  from v2. The former temporary campaign used v2 for every slot except the approved `c01-l01-v1`.

Decision: keep the data as exported; blockers are walls. The game reads tile types from data, so any
editor change arrives with a new export and is re-verified by the oracle tests. All blockers are drawn
(see `docs/art.md`).

## Level design rules (from the GDD and the editor)

- Every level has exactly one solution, and its budget equals the minimum needed (`minBudget`).
- The chapter's mechanic must be necessary to solve the level.
- The first level of each chapter introduces its mechanic; difficulty rises from level 1 to 6.
- A swap pair should not bring a `passage` with a closed side onto the player's current cell: the
  engine allows it, but the player meets a restriction they could not see (Uğur, 2026-09-27).
- Uğur's GDD also lists rule fixtures (`levels/fixtures/*.json` in the editor repository, with
  `expect.moves`, `expect.result`, `expect.stepsLeft`, `expect.at`) as acceptance tests. We do not
  have them yet; when they arrive they should join our Vitest suite.

## In-game pipeline

- **Pool** `apps/web/levels/pool/`: all 180 pool levels, byte-for-byte as exported (8 re-exported for
  the car rule, see above). Used as oracle test fixtures and as the source for picking levels. Not
  bundled into the game.
- **Campaign** `apps/web/src/game/levels/campaign/`: the levels the game ships (copies of exported
  files, never edited) plus `campaign.json` (chapters and order). `campaign.ts` loads them with
  `import.meta.glob`, compiles them with the engine, and exposes the ordered list.
- **Current campaign: Uğur's v3 set, pending review** (`campaign.json` status `pending-review`, since
  2026-10-16; see "v3 set" below). It is not the approved Final export. Until 2026-10-16 the
  campaign was a temporary pick from the pool (the `Lumen v2` base alternative of every slot, plus
  the approved `c01-l01-v1`); those files are still in the pool.
- **When the Final export arrives:** replace the files in `campaign/` with the export and rewrite
  `campaign.json` from its slot data (`meta.slot`; the export may need a small script if it lacks an
  order), then run `npm run level:check` and `npm test`.
- **`npm run level:check -- [files or folders]`** (default: the campaign folder; pass `levels/pool`
  to check the pool, which reports the 6 levels the editor rejects since the car rule): the editor's
  validation errors and warnings, solver consistency (solvable within steps, solution count,
  `minBudget` versus steps), a check that `meta.solution` matches the computed values, file name
  equals level id, and `campaign.json` integrity. Exit code 1 on any error.
- **`npm test`**: oracle tests on every pool and campaign level (levels the editor rejects must carry
  its empty analysis), focused rule tests, validation tests (the pool's expected editor verdicts),
  and campaign integrity. GitHub Actions runs typecheck, tests, and `level:check` (campaign) on every
  push.
- **Developer access:** in dev builds only, `window.extinguisherDebug` offers `goTo(n)`,
  `loadLevel(json)`, `stats()`, and `cellScreenPoint(q, r)`. It is absent from production builds.
- The jam levels and the jam ruleset were removed on 2026-10-10.
- Level names from the export (for example `v2 · Halka`) are not shown in the game; the HUD shows
  only `Level N`, the level's position in the campaign.

