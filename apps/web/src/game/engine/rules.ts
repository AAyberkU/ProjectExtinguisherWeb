// Hex-steps move resolution (docs/rules.md). Pure functions over a CompiledLevel.

import { MAX_CHAIN, contentIndex, tileAt, type CompiledLevel } from './compile';
import { DIRS, DIR_INDEX, type Dir, type EngineEvent, type LegalMove, type PlayState, type StepResult } from './types';

/** The part of the state the rules and the solver depend on. `steps` may be Infinity (solver). */
export interface CoreState {
  pos: number;
  steps: number;
  mask: number;
  sw: number;
  phase: number;
}

export interface Arrival {
  /** Final cell after the arrival chain. */
  pos: number;
  mask: number;
  sw: number;
  /** Steps gained from plus1 tiles. */
  gain: number;
  /** Refill value when a refill fired, otherwise null. */
  setTo: number | null;
  won: boolean;
  /** The chain hit MAX_CHAIN links (a loop; a validation error). */
  chainLimit: boolean;
}

export interface MoveOutcome {
  /** The neighbour cell walked into. */
  target: number;
  /** Swap phase the move was judged on (the new phase). */
  phase: number;
  cost: number;
  arrival: Arrival;
  /** Steps after the move (Infinity stays Infinity). */
  steps: number;
}

/** Bit of a switch/door colour (1-3), 0 for an invalid colour. */
export function colorBit(color: number | undefined): number {
  return color === 1 || color === 2 || color === 3 ? 1 << (color - 1) : 0;
}

/** Closed for walking, sliding, and landing: a blocker, or a door whose colour is off. */
export function isWallAt(level: CompiledLevel, i: number, phase: number, sw: number): boolean {
  const t = tileAt(level, i, phase);
  return t.type === 'blocker' || (t.type === 'door' && !(sw & colorBit(t.color)));
}

/** May the player walk or slide into cell j moving in direction index di? */
export function canEnter(level: CompiledLevel, j: number, phase: number, sw: number, di: number): boolean {
  if (j < 0 || isWallAt(level, j, phase, sw)) return false;
  const t = tileAt(level, j, phase);
  return !(t.type === 'passage' && t.noIn.includes(DIRS[(di + 3) % 6]));
}

/** Launcher landing from cell i: 2 cells, else 1, else stay. Flies over walls and passage sides. */
export function landOf(level: CompiledLevel, i: number, phase: number, sw: number): number {
  const di = tileAt(level, i, phase).dirIndex;
  if (di < 0) return i;
  const j2 = level.neighbors2[i][di];
  if (j2 >= 0 && !isWallAt(level, j2, phase, sw)) return j2;
  const j1 = level.neighbors[i][di];
  if (j1 >= 0 && !isWallAt(level, j1, phase, sw)) return j1;
  return i;
}

/**
 * Mover slide from cell i over floor-like cells (floor, start, open door, collected plus1).
 * Stops before a cell that cannot be entered, or on the first non-floor-like cell.
 * `path` collects every cell passed, the stop cell included.
 */
export function slideOf(
  level: CompiledLevel,
  i: number,
  phase: number,
  sw: number,
  mask: number,
  path: number[] | null,
): number {
  const di = tileAt(level, i, phase).dirIndex;
  if (di < 0) return i;
  let cur = i;
  for (let guard = 0; guard < level.cellCount + 1; guard++) {
    const nx = level.neighbors[cur][di];
    if (!canEnter(level, nx, phase, sw, di)) return cur;
    cur = nx;
    if (path) path.push(cur);
    const src = contentIndex(level, cur, phase);
    const ty = level.cells[src].type;
    const spent = ty === 'plus1' && (mask & level.plusBit[src]) !== 0;
    if (!(ty === 'floor' || ty === 'start' || ty === 'door' || spent)) return cur;
  }
  return cur;
}

/**
 * The arrival chain on `pos`. Only the final cell of a launch or slide acts.
 * `events` receives renderer events, `trail` every cell touched (pos, landings, slid cells).
 */
export function resolveArrival(
  level: CompiledLevel,
  pos: number,
  mask: number,
  phase: number,
  sw: number,
  events: EngineEvent[] | null,
  trail: number[] | null,
): Arrival {
  let gain = 0;
  let setTo: number | null = null;
  let won = false;
  let chainLimit = false;
  if (trail) trail.push(pos);
  for (let chain = 0; ; chain++) {
    const cid = contentIndex(level, pos, phase);
    const c = level.cells[cid];
    const ty = c.type;
    if (ty === 'finish') {
      won = true;
      break;
    }
    if (ty === 'plus1') {
      const bit = level.plusBit[cid];
      if (bit && !(mask & bit)) {
        mask |= bit;
        gain++;
        if (events) events.push({ type: 'plus1', cell: pos });
      }
      break;
    }
    if (ty === 'refill') {
      setTo = c.value ?? null;
      if (events) events.push({ type: 'refill', cell: pos, value: c.value ?? 0 });
      break;
    }
    if (ty === 'switch') {
      const bit = colorBit(c.color);
      const fresh = (sw & bit) === 0 && bit !== 0;
      sw |= bit;
      if (events && fresh) {
        const doors: number[] = [];
        for (let i = 0; i < level.cellCount; i++) {
          const t = tileAt(level, i, phase);
          if (t.type === 'door' && colorBit(t.color) === bit) doors.push(i);
        }
        events.push({ type: 'switch', cell: pos, color: c.color ?? 0, doors });
      }
      break;
    }
    if (ty === 'portal') {
      const pid = level.portalPartner[cid];
      if (pid < 0) break;
      const to = contentIndex(level, pid, phase); // the cell holding the partner portal now
      if (events) events.push({ type: 'teleport', from: pos, to });
      pos = to;
      if (trail) trail.push(pos);
      break; // the arrival portal does not fire
    }
    if (ty === 'launcher' || ty === 'mover') {
      const path: number[] | null = ty === 'mover' && (events || trail) ? [] : null;
      const to = ty === 'launcher' ? landOf(level, pos, phase, sw) : slideOf(level, pos, phase, sw, mask, path);
      if (to === pos) break;
      if (chain >= MAX_CHAIN) {
        chainLimit = true;
        break;
      }
      const dir = c.dir as Dir;
      if (events) {
        if (ty === 'launcher') events.push({ type: 'launch', from: pos, to, dir });
        else events.push({ type: 'slide', from: pos, to, dir, path: path ?? [to] });
      }
      if (trail) {
        if (path) trail.push(...path);
        else trail.push(to);
      }
      pos = to;
      continue;
    }
    break;
  }
  return { pos, mask, sw, gain, setTo, won, chainLimit };
}

/**
 * Resolves a move in direction index `di`, or returns null when it is illegal.
 * The swap phase flips first and the move is judged on the swapped board.
 * With `events`, pushes swap, walk, and the arrival-chain events (not steps/win/lose).
 */
export function moveCore(
  level: CompiledLevel,
  s: CoreState,
  di: number,
  events: EngineEvent[] | null = null,
  trail: number[] | null = null,
): MoveOutcome | null {
  const phase = level.hasSwap ? 1 - s.phase : 0;
  const here = tileAt(level, s.pos, phase);
  if (here.type === 'passage' && here.noOut.includes(DIRS[di])) return null;
  const target = level.neighbors[s.pos][di];
  if (!canEnter(level, target, phase, s.sw, di)) return null;
  const cost = tileAt(level, target, phase).type === 'swamp' ? 2 : 1;
  if (events) {
    if (level.hasSwap) {
      events.push({
        type: 'swap',
        phase: phase as 0 | 1,
        pairs: level.swapPairs.map(([a, b]) => [a, b] as [number, number]),
      });
    }
    events.push({ type: 'walk', from: s.pos, to: target, dir: DIRS[di], cost });
  }
  const arrival = resolveArrival(level, target, s.mask, phase, s.sw, events, trail);
  let steps = s.steps === Infinity ? Infinity : s.steps - cost + arrival.gain;
  if (arrival.setTo !== null && s.steps !== Infinity) steps = arrival.setTo;
  return { target, phase, cost, arrival, steps: Math.max(0, steps) };
}

/** Whether any geometrically legal move exists (step costs ignored). */
export function hasMove(level: CompiledLevel, s: CoreState): boolean {
  const free: CoreState = { pos: s.pos, steps: Infinity, mask: s.mask, sw: s.sw, phase: s.phase };
  for (let d = 0; d < 6; d++) if (moveCore(level, free, d)) return true;
  return false;
}

/** Start state. Lost at once when the budget is 0 or the start has no legal move. */
export function initialState(level: CompiledLevel, budget: number = level.budget): PlayState {
  const st: PlayState = { pos: level.startIndex, steps: budget, mask: 0, sw: 0, phase: 0, status: 'playing', moveCount: 0 };
  if (budget <= 0) {
    st.status = 'lost';
    st.lossReason = 'out-of-steps';
  } else if (!hasMove(level, st)) {
    st.status = 'lost';
    st.lossReason = 'stuck';
  }
  return st;
}

/** One player move, or null when it is illegal (state unchanged, no phase flip). */
export function step(level: CompiledLevel, state: PlayState, dir: Dir): StepResult | null {
  if (state.status !== 'playing' || state.steps <= 0) return null;
  const di = DIR_INDEX[dir];
  if (di === undefined) return null;
  const events: EngineEvent[] = [];
  const m = moveCore(level, state, di, events);
  if (!m) return null;
  const a = m.arrival;
  const next: PlayState = {
    pos: a.pos,
    steps: m.steps,
    mask: a.mask,
    sw: a.sw,
    phase: m.phase as 0 | 1,
    status: 'playing',
    moveCount: state.moveCount + 1,
  };
  events.push({ type: 'steps', before: state.steps, after: m.steps });
  if (a.won) {
    next.status = 'won';
    events.push({ type: 'win' });
  } else if (next.steps <= 0) {
    next.status = 'lost';
    next.lossReason = 'out-of-steps';
  } else if (!hasMove(level, next)) {
    next.status = 'lost';
    next.lossReason = 'stuck';
  }
  if (next.lossReason) events.push({ type: 'lose', reason: next.lossReason });
  return { state: next, events };
}

/** Directions that are legal right now, judged exactly as `step` judges them. */
export function legalMoves(level: CompiledLevel, state: PlayState): LegalMove[] {
  const out: LegalMove[] = [];
  if (state.status !== 'playing' || state.steps <= 0) return out;
  for (let d = 0; d < 6; d++) {
    const m = moveCore(level, state, d);
    if (m) out.push({ dir: DIRS[d], target: m.target });
  }
  return out;
}

/** Replays input directions from the start. Stops at the first illegal move. */
export function replay(
  level: CompiledLevel,
  moves: readonly Dir[],
  budget: number = level.budget,
): { state: PlayState; applied: number; illegalAt: number } {
  let state = initialState(level, budget);
  let applied = 0;
  for (const d of moves) {
    const r = step(level, state, d);
    if (!r) return { state, applied, illegalAt: applied };
    state = r.state;
    applied++;
  }
  return { state, applied, illegalAt: -1 };
}

// ---------- renderer helpers ----------

/** The cell currently acts as a wall (blocker, or closed door). */
export function isWall(level: CompiledLevel, state: Pick<PlayState, 'phase' | 'sw'>, cellIndex: number): boolean {
  return isWallAt(level, cellIndex, state.phase, state.sw);
}

/** The cell currently shows a door whose colour is switched on. */
export function doorOpen(level: CompiledLevel, state: Pick<PlayState, 'phase' | 'sw'>, cellIndex: number): boolean {
  const t = tileAt(level, cellIndex, state.phase);
  return t.type === 'door' && (state.sw & colorBit(t.color)) !== 0;
}

/** The cell currently shows a switch whose colour is pressed. */
export function switchPressed(level: CompiledLevel, state: Pick<PlayState, 'phase' | 'sw'>, cellIndex: number): boolean {
  const t = tileAt(level, cellIndex, state.phase);
  return t.type === 'switch' && (state.sw & colorBit(t.color)) !== 0;
}

/** The cell currently shows a plus1 that has been collected (it plays as floor). */
export function plusCollected(level: CompiledLevel, state: Pick<PlayState, 'phase' | 'mask'>, cellIndex: number): boolean {
  const src = contentIndex(level, cellIndex, state.phase);
  return level.cells[src].type === 'plus1' && (state.mask & level.plusBit[src]) !== 0;
}
