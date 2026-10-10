/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { validateLevel, type PuzzleLabLevel } from '../src/game/engine';
import { makeLevel } from './helpers';

const pool = import.meta.glob<PuzzleLabLevel>('../levels/pool/*.json', { eager: true, import: 'default' });

const has = (list: string[], text: string): boolean => list.some((m) => m.includes(text));

describe('validateLevel', () => {
  it('accepts every pool level with no errors and no warnings', () => {
    const files = Object.entries(pool);
    expect(files.length).toBe(180);
    for (const [path, level] of files) {
      expect(validateLevel(level), path).toEqual({ errors: [], warnings: [] });
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

  it('reports a mover loop', () => {
    const level = makeLevel({
      '-2,1': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': 'floor',
      '1,0': { type: 'mover', dir: 'W' },
      '2,-2': 'finish',
    });
    const { errors } = validateLevel(level);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Slide loop: the mover\/launcher chain from \(-1, 0\)/);
  });

  it('reports a loop that needs a door open', () => {
    const level = makeLevel(
      {
        '-3,1': 'start',
        '-2,0': { type: 'mover', dir: 'E' },
        '-1,0': 'floor',
        '0,0': { type: 'door', color: 1 },
        '1,0': { type: 'mover', dir: 'W' },
        '-3,2': { type: 'switch', color: 1 },
        '3,-3': 'finish',
      },
      { size: 7 },
    );
    const { errors } = validateLevel(level);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('(open doors: A)');
  });

  it('reports a loop that exists only in swap phase 1', () => {
    // At phase 1 the W mover sits on (1,0), next to the E mover's slide path.
    const level = makeLevel({
      '-2,1': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': 'floor',
      '1,0': { type: 'floor', swap: 1 },
      '1,-1': { type: 'mover', dir: 'W', swap: 1 },
      '2,-2': 'finish',
    });
    const { errors } = validateLevel(level);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('(swap phase 1)');
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
