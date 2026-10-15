/// <reference types="vite/client" />
// Oracle: the engine must reproduce every level's stored editor analysis (docs/rules.md).
import { describe, expect, it } from 'vitest';
import {
  DIRS,
  bfsSolve,
  boardCellCount,
  compileLevel,
  countSolutions,
  initialState,
  legalMoves,
  minBudget,
  step,
  validateLevel,
  type PuzzleLabLevel,
} from '../src/game/engine';

const pool = import.meta.glob<PuzzleLabLevel>('../levels/pool/*.json', { eager: true, import: 'default' });
const campaignFiles = import.meta.glob<PuzzleLabLevel>(
  ['../src/game/levels/campaign/*.json', '!../src/game/levels/campaign/campaign.json'],
  { eager: true, import: 'default' },
);

const entries = (files: Record<string, PuzzleLabLevel>): Array<[string, PuzzleLabLevel]> =>
  Object.entries(files)
    .map(([path, level]): [string, PuzzleLabLevel] => [path.split('/').pop() as string, level])
    .sort(([a], [b]) => a.localeCompare(b));

/** Stored solutions that end with steps left, as in the editor's replay. */
const STEPS_LEFT: Record<string, number> = {
  'level-55': 1, // a refill late in the solution
  'c10-l02-v1': 2, // budget 16, minBudget 14 since the car rule
};

const sets: Array<[string, Array<[string, PuzzleLabLevel]>, number]> = [
  ['pool', entries(pool), 180],
  ['campaign', entries(campaignFiles), 60],
];

for (const [setName, levels, expected] of sets) {
  describe(`oracle: ${setName}`, () => {
    it(`has ${expected} levels`, () => {
      expect(levels.length).toBe(expected);
    });

    it.each(levels)('%s', (_file, raw) => {
      const sol = raw.meta?.solution;
      expect(sol).toBeDefined();
      if (!sol) throw new Error('missing meta.solution');

      // Levels the editor rejects export an empty analysis (pool levels broken by the car rule, docs/levels.md).
      if (validateLevel(raw, { solver: false }).errors.length) {
        expect(sol).toEqual({ solvable: false, minBudget: null, solutions: null, shortest: null });
        return;
      }

      const level = compileLevel(raw);
      expect(level.cellCount).toBe(boardCellCount(level.size));
      expect(minBudget(level)).toBe(sol.minBudget);
      // The campaign follows the editor's design rule: one solution, budget = minBudget.
      if (setName === 'campaign') expect([level.budget, sol.solutions]).toEqual([sol.minBudget, 1]);
      if (!sol.solvable) {
        // Solvable only with more steps than the budget.
        expect(bfsSolve(level, level.budget)).toBeNull();
        expect(sol).toMatchObject({ solutions: null, shortest: null });
        return;
      }
      if (!sol.shortest) throw new Error('missing meta.solution.shortest');

      // Replaying the stored shortest solution wins, every move legal, and ends on 0 steps except where
      // the editor's own replay ends with steps left (STEPS_LEFT).
      let state = initialState(level);
      expect(state.status).toBe('playing');
      for (const dir of sol.shortest) {
        // legalMoves agrees with step for every direction.
        const legal = new Set(legalMoves(level, state).map((m) => m.dir));
        for (const d of DIRS) {
          const r = step(level, state, d);
          expect(r !== null).toBe(legal.has(d));
        }
        expect(legal.has(dir)).toBe(true);
        const r = step(level, state, dir);
        if (!r) throw new Error(`illegal move ${dir}`);
        state = r.state;
      }
      expect(state.status).toBe('won');
      expect(state.moveCount).toBe(sol.shortest.length);
      expect(state.steps).toBe(STEPS_LEFT[raw.id] ?? 0);

      expect(countSolutions(level, level.budget).count).toBe(sol.solutions);
      expect(bfsSolve(level, level.budget)?.path).toEqual(sol.shortest);
    });
  });
}
