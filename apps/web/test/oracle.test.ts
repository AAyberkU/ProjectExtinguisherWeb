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
      if (!sol || !sol.shortest) throw new Error('missing meta.solution.shortest');
      const level = compileLevel(raw);
      expect(level.cellCount).toBe(boardCellCount(level.size));
      expect(level.budget).toBe(sol.minBudget);

      // Replaying the stored shortest solution wins, every move legal, ending on 0 steps.
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
      expect(state.steps).toBe(0);

      expect(minBudget(level)).toBe(sol.minBudget);
      expect(countSolutions(level, level.budget).count).toBe(sol.solutions);
      expect(bfsSolve(level, level.budget)?.path).toEqual(sol.shortest);
    });
  });
}
