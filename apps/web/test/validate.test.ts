/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { validateLevel, type PuzzleLabLevel } from '../src/game/engine';
import { makeLevel } from './helpers';

const pool = import.meta.glob<PuzzleLabLevel>('../levels/pool/*.json', { eager: true, import: 'default' });

const has = (list: string[], text: string): boolean => list.some((m) => m.includes(text));

describe('validateLevel', () => {
  // Pool levels the editor no longer accepts since movers became cars (rule 15, 2026-10-13); the
  // editor reports the same errors and warnings. Their files were re-exported (docs/levels.md).
  const changedByCars: Record<string, { errors: string[]; warnings: string[] }> = {
    'c04-l05-v1': { errors: ['Not solvable with this budget: needs at least 8 steps (budget 7)'], warnings: [] },
    'c05-l03-v1-2': { errors: ['(-2, 1): a mover cannot be part of a swap pair'], warnings: [] },
    'c05-l03': { errors: ['(3, -3): a mover cannot be part of a swap pair', '(4, -1): a mover cannot be part of a swap pair'], warnings: [] },
    'c05-l05-v1-2': { errors: ['(-2, 1): a mover cannot be part of a swap pair'], warnings: [] },
    'c06-l05-v1': { errors: [], warnings: ['Budget is loose: solvable with 7 steps (1 spare)'] },
    'c07-l02': { errors: ['Not solvable with this budget: needs at least 6 steps (budget 5)'], warnings: [] },
    'c10-l02-v1': { errors: [], warnings: ['Budget is loose: solvable with 14 steps (2 spare)'] },
    'c10-l06-v1': { errors: ['(-1, -2): a mover cannot be part of a swap pair', '(-1, 2): a mover cannot be part of a swap pair'], warnings: [] },
  };

  it('accepts every pool level with no errors and no warnings, except those changed by the car rule', () => {
    const files = Object.entries(pool);
    expect(files.length).toBe(180);
    for (const [path, level] of files) {
      expect(validateLevel(level), path).toEqual(changedByCars[level.id] ?? { errors: [], warnings: [] });
    }
  });

  it('rejects non-level input', () => {
    expect(validateLevel(null).errors).toEqual(['Level is not a JSON object']);
    expect(validateLevel([]).errors).toHaveLength(1);
    const wrong = { ...makeLevel({ '-2,0': 'start', '0,0': 'finish' }), format: 'x', game: 'other' };
    const r = validateLevel(wrong);
    expect(has(r.errors, 'Unknown format')).toBe(true);
    expect(has(r.errors, 'Unknown game')).toBe(true);
    expect(validateLevel({ ...wrong, format: 'puzzle-lab/level@1', game: 'hex-steps', grid: { type: 'hex', size: 4 } }).errors).toContain(
      'Grid size must be an odd integer from 3 to 41',
    );
  });

  it('reports field errors', () => {
    const level = makeLevel(
      {
        '-2,0': 'start',
        '-1,0': 'start',
        '0,0': { type: 'refill', value: 0 },
        '1,0': { type: 'portal', pair: 1 },
        '2,0': { type: 'launcher', dir: 'N' as never },
        '-2,1': { type: 'door', color: 4 },
        '-1,1': { type: 'floor', swap: 1 },
        '0,1': { type: 'lava' as never },
        '1,-1': { type: 'passage', noIn: ['X' as never] },
      },
      { steps: 1000 },
    );
    level.id = 'bad id!';
    level.tiles.push({ q: 0, r: 0, type: 'floor' });
    const { errors } = validateLevel(level);
    for (const text of [
      'Level id may only contain',
      'Step budget must be an integer from 0 to 999',
      '(0, 0) is defined twice',
      'unknown tile type "lava"',
      'invalid launcher direction "N"',
      'door colour must be 1-3',
      'refill value must be 1-99',
      'passage noIn sides are invalid',
      'Portal pair 1: 1 portals, expected 2',
      'Swap pair 1: 1 tiles, expected 2',
      '2 start tiles, expected 1',
      'No finish tile',
    ]) {
      expect(has(errors, text), text).toBe(true);
    }
    const pack = makeLevel({ '-2,0': 'start', '0,0': 'finish' });
    pack.id = 'Pack';
    expect(validateLevel(pack).errors).toEqual(['"pack" cannot be used as a level id']);
  });

  it('reports more than 31 plus1 tiles', () => {
    const cells: Record<string, 'plus1' | 'start' | 'finish'> = { '-4,0': 'start', '4,0': 'finish' };
    let n = 0;
    for (let q = -4; q <= 4 && n < 32; q++) {
      for (let r = -4; r <= 4 && n < 32; r++) {
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 4 && r !== 0) {
          cells[`${q},${r}`] = 'plus1';
          n++;
        }
      }
    }
    expect(n).toBe(32);
    expect(has(validateLevel(makeLevel(cells, { size: 9 })).errors, 'At most 31 plus1')).toBe(true);
  });

  it('reports a launcher cycle', () => {
    const level = makeLevel({
      '-2,1': 'start',
      '-1,0': { type: 'launcher', dir: 'E' },
      '1,0': { type: 'launcher', dir: 'W' },
      '2,-2': 'finish',
    });
    expect(validateLevel(level).errors).toEqual(['Launcher cycle: (-1, 0) -> (1, 0) -> (-1, 0)']);
  });

  it('facing movers are no loop: each car moves once (rule 15)', () => {
    const level = makeLevel({
      '-2,1': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': 'floor',
      '1,0': { type: 'mover', dir: 'W' },
      '2,-2': 'finish',
    });
    expect(validateLevel(level, { solver: false }).errors).toEqual([]);
  });

  it('reports a launcher loop that needs a parked car as a wall', () => {
    // (-2, 0) launches E over (-1, 0) onto (0, 0); with the car parked there it lands on (-1, 0),
    // whose W launch is cut short by the blocker on (-3, 0) and returns to (-2, 0).
    const level = makeLevel(
      {
        '-3,1': 'start',
        '-2,0': { type: 'launcher', dir: 'E' },
        '-1,0': { type: 'launcher', dir: 'W' },
        '0,0': 'floor',
        '0,-1': { type: 'mover', dir: 'SE' },
        '-2,1': 'floor',
        '3,-3': 'finish',
      },
      { size: 7 },
    );
    expect(validateLevel(level, { solver: false }).errors).toEqual([
      'Slide loop: the mover/launcher chain from (-2, 0) returns to itself (parked car: (0, 0))',
    ]);
  });

  it('reports a launcher loop that exists only in swap phase 1', () => {
    // At phase 1 the W launcher sits on (0, 0), the landing of the E launcher on (-2, 0).
    const level = makeLevel({
      '-2,1': 'start',
      '-2,0': { type: 'launcher', dir: 'E' },
      '0,0': { type: 'floor', swap: 1 },
      '0,-1': { type: 'launcher', dir: 'W', swap: 1 },
      '2,-2': 'finish',
    });
    expect(validateLevel(level, { solver: false }).errors).toEqual(['Slide loop: the mover/launcher chain from (-2, 0) returns to itself']);
  });

  it('rejects a mover in a swap pair', () => {
    const level = makeLevel({
      '-2,1': 'start',
      '-1,0': { type: 'mover', dir: 'E', swap: 1 },
      '1,0': { type: 'floor', swap: 1 },
      '2,-2': 'finish',
    });
    expect(validateLevel(level).errors).toEqual(['(-1, 0): a mover cannot be part of a swap pair']);
  });

  it('reports warnings', () => {
    const level = makeLevel(
      {
        '-2,0': 'start',
        '-1,0': 'floor',
        '0,0': 'floor',
        '1,0': 'finish',
        '2,0': { type: 'launcher', dir: 'E' },
        '-2,2': { type: 'door', color: 2 },
        '0,2': { type: 'passage', noIn: ['E', 'SE', 'SW', 'W', 'NW', 'NE'] },
      },
      { steps: 6 },
    );
    level.tiles.push({ q: 5, r: 0, type: 'floor' });
    const { errors, warnings } = validateLevel(level);
    expect(errors).toEqual([]);
    for (const text of [
      '(5, 0) is outside the board',
      '(0, 2): passage cannot be entered from any side',
      'Colour 2 door has no switch',
      '(2, 0): launcher cannot launch anywhere',
      'tile(s) cannot be reached by the player',
      'Budget is loose: solvable with 3 steps (3 spare)',
    ]) {
      expect(has(warnings, text), text).toBe(true);
    }
  });

  it('reports unsolvable levels', () => {
    const walled = makeLevel({ '-2,0': 'start', '-1,0': 'floor', '2,0': 'finish' });
    expect(has(validateLevel(walled).errors, 'cannot be reached with any budget')).toBe(true);
    const tight = makeLevel({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'floor', '1,0': 'finish' }, { steps: 2 });
    expect(validateLevel(tight).errors).toEqual(['Not solvable with this budget: needs at least 3 steps (budget 2)']);
    expect(validateLevel(tight, { solver: false })).toMatchObject({ errors: [] });
  });
});
