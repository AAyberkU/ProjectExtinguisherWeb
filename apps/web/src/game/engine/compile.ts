// Compiles a Puzzle Lab level into index-based tables for the rules engine and solver.

import {
  DIRS,
  DIR_INDEX,
  DIR_VECTORS,
  isDir,
  type Dir,
  type PuzzleLabLevel,
  type TileContent,
  type TileType,
} from './types';

export const MAX_CHAIN = 32;
export const MAX_PLUS = 31;

const EMPTY_DIRS: readonly Dir[] = Object.freeze([]);

/** One authored cell. Indices into `CompiledLevel.cells` are stable for the level's lifetime. */
export interface CompiledCell {
  q: number;
  r: number;
  type: TileType;
  dir?: Dir;
  /** Index of `dir` in `DIRS`, or -1. */
  dirIndex: number;
  color?: number;
  pair?: number;
  value?: number;
  noIn: readonly Dir[];
  noOut: readonly Dir[];
  swap?: number;
}

export interface CompiledLevel {
  readonly id: string;
  readonly name: string;
  /** `grid.size`: cells across the widest row. */
  readonly size: number;
  /** `params.steps`. */
  readonly budget: number;
  readonly level: PuzzleLabLevel;
  readonly cells: readonly CompiledCell[];
  readonly cellCount: number;
  /** neighbors[i][d] = neighbour of cell i in direction DIRS[d], or -1. */
  readonly neighbors: ReadonlyArray<readonly number[]>;
  /** neighbors2[i][d] = cell two steps from i in direction DIRS[d], or -1 (launcher landing). */
  readonly neighbors2: ReadonlyArray<readonly number[]>;
  /** Swap partner of each cell, or -1. */
  readonly swapPartner: readonly number[];
  readonly swapPairs: ReadonlyArray<readonly [number, number]>;
  readonly hasSwap: boolean;
  /** Portal partner of each authored portal cell, or -1. */
  readonly portalPartner: readonly number[];
  readonly portalPairs: ReadonlyArray<readonly [number, number]>;
  /** plus1 bit of each authored cell (0 for non-plus1 cells and for plus1 tiles beyond 31). */
  readonly plusBit: readonly number[];
  readonly plusCount: number;
  readonly startIndex: number;
  /** Authored finish cell (it may move under a swap). -1 when missing. */
  readonly finishIndex: number;
  cellAt(q: number, r: number): number;
}

const key = (q: number, r: number): string => q + ',' + r;

export function compileLevel(level: PuzzleLabLevel): CompiledLevel {
  const cells: CompiledCell[] = [];
  const index = new Map<string, number>();
  for (const t of level.tiles) {
    const k = key(t.q, t.r);
    if (index.has(k)) continue; // duplicates are a validation error; the first one wins (editor)
    index.set(k, cells.length);
    const cell: CompiledCell = {
      q: t.q,
      r: t.r,
      type: t.type,
      dirIndex: isDir(t.dir) ? DIR_INDEX[t.dir] : -1,
      noIn: Array.isArray(t.noIn) ? t.noIn : EMPTY_DIRS,
      noOut: Array.isArray(t.noOut) ? t.noOut : EMPTY_DIRS,
    };
    if (t.dir !== undefined) cell.dir = t.dir;
    if (t.color !== undefined) cell.color = t.color;
    if (t.pair !== undefined) cell.pair = t.pair;
    if (t.value !== undefined) cell.value = t.value;
    if (t.swap !== undefined) cell.swap = t.swap;
    cells.push(cell);
  }
  const n = cells.length;
  const at = (q: number, r: number): number => {
    const j = index.get(key(q, r));
    return j === undefined ? -1 : j;
  };
  const neighbors = cells.map((c) => DIRS.map((d) => at(c.q + DIR_VECTORS[d][0], c.r + DIR_VECTORS[d][1])));
  const neighbors2 = cells.map((c) => DIRS.map((d) => at(c.q + 2 * DIR_VECTORS[d][0], c.r + 2 * DIR_VECTORS[d][1])));

  const plusBit = new Array<number>(n).fill(0);
  let plusCount = 0;
  cells.forEach((c, i) => {
    if (c.type !== 'plus1') return;
    if (plusCount < MAX_PLUS) plusBit[i] = 1 << plusCount;
    plusCount++;
  });

  const group = (pick: (c: CompiledCell) => unknown): Map<unknown, number[]> => {
    const m = new Map<unknown, number[]>();
    cells.forEach((c, i) => {
      const v = pick(c);
      if (v === undefined || v === null || v === '') return;
      const list = m.get(v);
      if (list) list.push(i);
      else m.set(v, [i]);
    });
    return m;
  };

  const swapPartner = new Array<number>(n).fill(-1);
  const swapPairs: Array<[number, number]> = [];
  for (const ids of group((c) => c.swap).values()) {
    if (ids.length !== 2) continue;
    swapPartner[ids[0]] = ids[1];
    swapPartner[ids[1]] = ids[0];
    swapPairs.push([ids[0], ids[1]]);
  }
  const portalPartner = new Array<number>(n).fill(-1);
  const portalPairs: Array<[number, number]> = [];
  for (const ids of group((c) => (c.type === 'portal' ? c.pair : undefined)).values()) {
    if (ids.length !== 2) continue;
    portalPartner[ids[0]] = ids[1];
    portalPartner[ids[1]] = ids[0];
    portalPairs.push([ids[0], ids[1]]);
  }

  const startIndex = cells.findIndex((c) => c.type === 'start');
  if (startIndex < 0) throw new Error(`Level "${level.id}" has no start tile`);

  return {
    id: level.id,
    name: level.name,
    size: level.grid.size,
    budget: level.params.steps,
    level,
    cells,
    cellCount: n,
    neighbors,
    neighbors2,
    swapPartner,
    swapPairs,
    hasSwap: swapPairs.length > 0,
    portalPartner,
    portalPairs,
    plusBit,
    plusCount,
    startIndex,
    finishIndex: cells.findIndex((c) => c.type === 'finish'),
    cellAt: at,
  };
}

/** Index of the authored cell whose content cell `i` shows in `phase`. Its own inverse. */
export function contentIndex(level: CompiledLevel, i: number, phase: number): number {
  const p = level.swapPartner[i];
  return phase && p >= 0 ? p : i;
}

/** The authored cell whose content cell `i` shows in `phase`. */
export function tileAt(level: CompiledLevel, i: number, phase: number): CompiledCell {
  return level.cells[contentIndex(level, i, phase)];
}

/** The content shown on a cell for a swap phase (the swap id stays on the cell). */
export function cellContent(level: CompiledLevel, cellIndex: number, phase: number): TileContent {
  const source = contentIndex(level, cellIndex, phase);
  const c = level.cells[source];
  const out: TileContent = { type: c.type, noIn: c.noIn, noOut: c.noOut, source };
  if (c.dir !== undefined) out.dir = c.dir;
  if (c.color !== undefined) out.color = c.color;
  if (c.pair !== undefined) out.pair = c.pair;
  if (c.value !== undefined) out.value = c.value;
  const swap = level.cells[cellIndex].swap;
  if (swap !== undefined) out.swap = swap;
  return out;
}
