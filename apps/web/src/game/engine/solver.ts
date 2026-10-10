// Solver matching the Puzzle Lab editor: BFS shortest solve, minimum budget, solution count.

import type { CompiledLevel } from './compile';
import { moveCore, type CoreState } from './rules';
import { DIRS, type Dir } from './types';

/** The editor gives up above this many states. */
export const STATE_LIMIT = 400000;
const COUNT_CAP = 1e9;
const MAX_BUDGET = 999;

/** (cell, swap phase, +1 mask, switch bits) without steps. */
function stateKey(level: CompiledLevel, s: CoreState): number {
  return ((s.mask * 8 + s.sw) * 2 + s.phase) * level.cellCount + s.pos;
}

export type SearchResult = { path: Dir[]; moves: number } | { aborted: true } | null;

/**
 * Fewest-move win with `budget` (Infinity ignores steps), trying moves in solver order, so the
 * first path found equals the editor's stored `shortest`. For the same (cell, phase, +1s,
 * switches) only the best step count is kept. Returns `{ aborted: true }` above `limit` states.
 */
export function bfsSearch(level: CompiledLevel, budget: number = level.budget, limit: number = STATE_LIMIT): SearchResult {
  if (level.startIndex < 0 || level.finishIndex < 0) return null;
  if (budget !== Infinity && budget <= 0) return null;
  const start: CoreState = { pos: level.startIndex, steps: budget, mask: 0, sw: 0, phase: 0 };
  const nodes: CoreState[] = [start];
  const parent: number[] = [-1];
  const pdir: number[] = [-1];
  const best = new Map<number, number>([[stateKey(level, start), start.steps]]);
  const build = (idx: number, d: number): Dir[] => {
    const path: Dir[] = [DIRS[d]];
    for (let cur = idx; parent[cur] >= 0; cur = parent[cur]) path.push(DIRS[pdir[cur]]);
    return path.reverse();
  };
  let frontier = [0];
  let depth = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const idx of frontier) {
      const s = nodes[idx];
      if (s.steps <= 0) continue;
      for (let d = 0; d < 6; d++) {
        const m = moveCore(level, s, d);
        if (!m) continue;
        if (m.arrival.won) return { moves: depth + 1, path: build(idx, d) };
        if (m.steps <= 0) continue;
        const ns: CoreState = { pos: m.arrival.pos, steps: m.steps, mask: m.arrival.mask, sw: m.arrival.sw, phase: m.phase };
        const k = stateKey(level, ns);
        const b = best.get(k);
        if (b !== undefined && b >= ns.steps) continue;
        best.set(k, ns.steps);
        nodes.push(ns);
        parent.push(idx);
        pdir.push(d);
        next.push(nodes.length - 1);
      }
      if (nodes.length > limit) return { aborted: true };
    }
    frontier = next;
    depth++;
  }
  return null;
}

/** Shortest solution (fewest player moves) with `budget`, or null (unsolvable or aborted). */
export function bfsSolve(
  level: CompiledLevel,
  budget: number = level.budget,
  limit: number = STATE_LIMIT,
): { path: Dir[]; moves: number } | null {
  const r = bfsSearch(level, budget, limit);
  return r && 'path' in r ? r : null;
}

/**
 * Smallest solvable budget (binary search over BFS, as the editor's analysis), with abort info.
 * `value` is null when no budget up to 999 solves the level or the search aborted.
 */
export function minBudgetSearch(level: CompiledLevel, limit: number = STATE_LIMIT): { value: number | null; aborted: boolean; unsolvableAtAnyBudget: boolean } {
  const free = bfsSearch(level, Infinity, limit);
  if (!free) return { value: null, aborted: false, unsolvableAtAnyBudget: true };
  if ('aborted' in free) return { value: null, aborted: true, unsolvableAtAnyBudget: false };
  let lo = 0;
  let hi = free.moves * 2;
  const hiOk = bfsSearch(level, hi, limit);
  if (hiOk && 'aborted' in hiOk) return { value: null, aborted: true, unsolvableAtAnyBudget: false };
  if (!hiOk) {
    hi = MAX_BUDGET;
    const big = bfsSearch(level, hi, limit);
    if (!big) return { value: null, aborted: false, unsolvableAtAnyBudget: false };
    if ('aborted' in big) return { value: null, aborted: true, unsolvableAtAnyBudget: false };
  }
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const r = bfsSearch(level, mid, limit);
    if (r && 'aborted' in r) return { value: null, aborted: true, unsolvableAtAnyBudget: false };
    if (r) hi = mid;
    else lo = mid + 1;
  }
  return { value: lo, aborted: false, unsolvableAtAnyBudget: false };
}

/** Smallest budget that solves the level, or null. */
export function minBudget(level: CompiledLevel): number | null {
  return minBudgetSearch(level).value;
}

export interface SolutionCount {
  /** Distinct winning move sequences that never repeat a full state (capped at 1e9). */
  count: number;
  /** A refill loop exists on a still-winnable state (such loops are not counted). */
  looped: boolean;
  capped: boolean;
  /** The state space was too large; `count` is 0 and meaningless. */
  aborted: boolean;
  /** Reachable states (including steps) explored by the forward pass. */
  states: number;
}

/**
 * Counts distinct move sequences that win with `budget` without repeating a full state
 * (cell, steps, +1s, switches, phase), as the editor does. Only states from which a win is
 * reachable are walked; states on a loop are not memoised.
 */
export function countSolutions(level: CompiledLevel, budget: number = level.budget): SolutionCount {
  const aborted = (states: number): SolutionCount => ({ count: 0, looped: false, capped: false, aborted: true, states });
  if (level.startIndex < 0 || level.finishIndex < 0 || !(budget > 0)) {
    return { count: 0, looped: false, capped: false, aborted: false, states: 1 };
  }
  // Full-state key including steps. Numeric when it fits in a double, otherwise a string.
  const radix = Math.max(budget, 99) + level.plusCount + 1;
  const maxKey = ((2 ** Math.min(level.plusCount, 31) * 8 + 7) * 2 + 1) * level.cellCount;
  const numeric = maxKey * radix < Number.MAX_SAFE_INTEGER;
  const sk = numeric
    ? (s: CoreState): number | string => stateKey(level, s) * radix + s.steps
    : (s: CoreState): number | string => stateKey(level, s) + ',' + s.steps;

  // Forward exploration + reverse reachability: the set of states that can still win.
  const s0: CoreState = { pos: level.startIndex, steps: budget, mask: 0, sw: 0, phase: 0 };
  const ids = new Map<number | string, number>([[sk(s0), 0]]);
  const list: CoreState[] = [s0];
  const pred: number[][] = [[]];
  const wins: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.steps <= 0) continue;
    for (let d = 0; d < 6; d++) {
      const m = moveCore(level, s, d);
      if (!m) continue;
      if (m.arrival.won) {
        wins.push(i);
        continue;
      }
      if (m.steps <= 0) continue;
      const ns: CoreState = { pos: m.arrival.pos, steps: m.steps, mask: m.arrival.mask, sw: m.arrival.sw, phase: m.phase };
      const k = sk(ns);
      let j = ids.get(k);
      if (j === undefined) {
        j = list.length;
        ids.set(k, j);
        list.push(ns);
        pred.push([]);
      }
      pred[j].push(i);
    }
    if (list.length > STATE_LIMIT) return aborted(list.length);
  }
  const ok = new Uint8Array(list.length);
  const queue = [...new Set(wins)];
  for (const i of queue) ok[i] = 1;
  while (queue.length) {
    for (const p of pred[queue.pop() as number]) {
      if (!ok[p]) {
        ok[p] = 1;
        queue.push(p);
      }
    }
  }
  const good = new Set<number | string>();
  list.forEach((s, i) => {
    if (ok[i]) good.add(sk(s));
  });

  const memo = new Map<number | string, number>();
  const onPath = new Map<number | string, number>();
  const loopKeys = new Set<number | string>();
  const winning = new Set<number | string>();
  let hit = Infinity;
  let calls = 0;
  const ABORT = new Error('count aborted');

  const rec = (s: CoreState, depth: number): number => {
    if (s.steps <= 0) return 0;
    const k = sk(s);
    if (!good.has(k)) return 0;
    const onPathDepth = onPath.get(k);
    if (onPathDepth !== undefined) {
      loopKeys.add(k);
      hit = Math.min(hit, onPathDepth);
      return 0;
    }
    const cached = memo.get(k);
    if (cached !== undefined) return cached;
    if (memo.size > STATE_LIMIT || ++calls > 4 * STATE_LIMIT) throw ABORT;
    onPath.set(k, depth);
    const outer = hit;
    hit = Infinity;
    let total = 0;
    for (let d = 0; d < 6; d++) {
      const m = moveCore(level, s, d);
      if (!m) continue;
      const c = m.arrival.won
        ? 1
        : rec({ pos: m.arrival.pos, steps: m.steps, mask: m.arrival.mask, sw: m.arrival.sw, phase: m.phase }, depth + 1);
      if (c > 0) total += c;
    }
    onPath.delete(k);
    total = Math.min(total, COUNT_CAP);
    if (hit > depth) memo.set(k, total); // on no loop: the count is the same from every path
    if (total > 0) winning.add(k);
    hit = Math.min(outer, hit);
    return total;
  };

  try {
    const count = rec(s0, 0);
    let looped = false;
    if (count > 0) for (const k of loopKeys) if (winning.has(k)) looped = true;
    return { count, looped, capped: count >= COUNT_CAP, aborted: false, states: list.length };
  } catch (e) {
    if (e === ABORT) return aborted(list.length);
    throw e;
  }
}
