// Level validation matching the Puzzle Lab editor's validate() + analyze() checks (docs/rules.md).

import { compileLevel, tileAt, type CompiledLevel } from './compile';
import { onBoard } from './hex';
import { moveCore, landOf, resolveArrival, withCar, type CoreState } from './rules';
import { minBudgetSearch, STATE_LIMIT } from './solver';
import { DIRS, TILE_TYPES, isDir, type PuzzleLabLevel } from './types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface ValidateOptions {
  /** Run the solver checks (unsolvable budget, unreachable tiles, loose budget). Default true. */
  solver?: boolean;
}

const MAX_PLUS = 31;
const MAX_COLOR = 3;
const MAX_VALUE = 99;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const at = (q: unknown, r: unknown): string => `(${String(q)}, ${String(r)})`;

/** Cells the player can ever stand on or pass through (steps and +1s ignored), as the editor. */
export function reachableCells(level: CompiledLevel): Uint8Array {
  const seen = new Uint8Array(level.cellCount);
  const key = (s: CoreState): number | string => {
    const k = (s.sw * 2 + s.phase) * level.cellCount + s.pos;
    return level.cars.length ? k + '|' + s.cars : k;
  };
  const s0: CoreState = { pos: level.startIndex, steps: Infinity, mask: 0, sw: 0, phase: 0, cars: level.carsHome };
  const visited = new Set<number | string>([key(s0)]);
  const stack = [s0];
  seen[level.startIndex] = 1;
  while (stack.length) {
    const s = stack.pop() as CoreState;
    for (let d = 0; d < 6; d++) {
      const trail: number[] = [];
      const m = moveCore(level, s, d, null, trail);
      if (!m) continue;
      for (const x of trail) seen[x] = 1;
      seen[m.target] = 1;
      if (m.arrival.won) continue;
      const ns: CoreState = { pos: m.arrival.pos, steps: Infinity, mask: 0, sw: m.arrival.sw, phase: m.phase, cars: m.arrival.cars };
      const k = key(ns);
      if (!visited.has(k)) {
        visited.add(k);
        stack.push(ns);
      }
      if (visited.size > STATE_LIMIT) return seen;
    }
  }
  return seen;
}

/** Launcher cycles on the authored layout with every door closed (the editor's static check). */
function launcherCycles(level: CompiledLevel): number[][] {
  const { cells } = level;
  const land = cells.map((c, i) => (c.type === 'launcher' ? landOf(level, i, 0, 0) : i));
  const cycles: number[][] = [];
  const inCycle = new Set<number>();
  cells.forEach((c, i) => {
    if (c.type !== 'launcher' || inCycle.has(i)) return;
    const seen: number[] = [];
    let p = i;
    while (cells[p].type === 'launcher' && land[p] !== p) {
      const idx = seen.indexOf(p);
      if (idx >= 0) {
        const cyc = seen.slice(idx);
        if (!cyc.some((x) => inCycle.has(x))) {
          cyc.forEach((x) => inCycle.add(x));
          cycles.push(cyc);
        }
        break;
      }
      seen.push(p);
      p = land[p];
    }
  });
  return cycles;
}

/**
 * Validates a raw level object. Errors make a level unusable; warnings mark a level the editor
 * would not accept as a finished variant. Structural checks on format/game/grid/tiles are added
 * on top of the editor's checks because the game loads raw files without the editor's normalizer.
 */
export function validateLevel(raw: unknown, options: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(raw)) return { errors: ['Level is not a JSON object'], warnings };

  if (raw.format !== 'puzzle-lab/level@1') errors.push(`Unknown format ${JSON.stringify(raw.format)} (expected "puzzle-lab/level@1")`);
  if (raw.game !== 'hex-steps') errors.push(`Unknown game ${JSON.stringify(raw.game)} (expected "hex-steps")`);
  const grid = raw.grid;
  if (!isObject(grid) || grid.type !== 'hex') {
    errors.push('Grid must be a hex grid');
    return { errors, warnings };
  }
  const size = grid.size;
  const sizeOk = isInt(size) && size >= 3 && size <= 41 && size % 2 === 1;
  if (!sizeOk) errors.push('Grid size must be an odd integer from 3 to 41');
  if (!Array.isArray(raw.tiles)) {
    errors.push('Tiles must be an array');
    return { errors, warnings };
  }

  const id = raw.id;
  if (typeof id !== 'string' || !id) errors.push('Level id is empty');
  else if (!ID_PATTERN.test(id)) errors.push('Level id may only contain letters, digits, - and _ (it becomes a file name)');
  else if (id.toLowerCase() === 'pack') errors.push('"pack" cannot be used as a level id');

  const steps = isObject(raw.params) ? raw.params.steps : undefined;
  if (!isInt(steps) || steps < 0 || steps > 999) errors.push('Step budget must be an integer from 0 to 999');

  const tiles = raw.tiles as unknown[];
  const seen = new Set<string>();
  let starts = 0;
  let finishes = 0;
  let plus = 0;
  const portalPairs = new Map<unknown, number>();
  const swapIds = new Map<unknown, number>();
  const switchColors = new Set<unknown>();
  const doorColors = new Set<unknown>();
  tiles.forEach((t, i) => {
    if (!isObject(t)) {
      errors.push(`Tile #${i + 1} is not an object`);
      return;
    }
    const { q, r, type } = t;
    if (!isInt(q) || !isInt(r)) {
      errors.push(`Tile #${i + 1}: coordinates (q, r) are not integers`);
      return;
    }
    const where = at(q, r);
    const k = q + ',' + r;
    if (seen.has(k)) errors.push(`${where} is defined twice`);
    seen.add(k);
    if (!TILE_TYPES.includes(type as never)) errors.push(`${where}: unknown tile type "${String(type)}"`);
    if (type === 'start') starts++;
    if (type === 'finish') finishes++;
    if (type === 'plus1') plus++;
    if (sizeOk && !onBoard(q, r, size as number)) warnings.push(`${where} is outside the board`);
    if ((type === 'launcher' || type === 'mover') && !isDir(t.dir)) {
      errors.push(`${where}: invalid ${type} direction "${String(t.dir)}" (${DIRS.join('/')})`);
    }
    if ((type === 'switch' || type === 'door') && !(isInt(t.color) && t.color >= 1 && t.color <= MAX_COLOR)) {
      errors.push(`${where}: ${type} colour must be 1-${MAX_COLOR}`);
    }
    if (type === 'switch') switchColors.add(t.color);
    if (type === 'door') doorColors.add(t.color);
    if (type === 'refill' && !(isInt(t.value) && t.value >= 1 && t.value <= MAX_VALUE)) {
      errors.push(`${where}: refill value must be 1-${MAX_VALUE}`);
    }
    if (type === 'portal') {
      if (!(isInt(t.pair) && t.pair >= 1)) errors.push(`${where}: portal has no pair number`);
      if (t.pair !== undefined) portalPairs.set(t.pair, (portalPairs.get(t.pair) ?? 0) + 1);
    }
    if (type === 'passage') {
      for (const f of ['noIn', 'noOut'] as const) {
        const v = t[f];
        if (v !== undefined && !(Array.isArray(v) && v.every((d) => isDir(d)))) {
          errors.push(`${where}: passage ${f} sides are invalid (${DIRS.join('/')})`);
        }
      }
      const noIn = t.noIn;
      if (Array.isArray(noIn) && DIRS.every((d) => noIn.includes(d))) warnings.push(`${where}: passage cannot be entered from any side`);
    }
    if (t.swap !== undefined) {
      if (!(isInt(t.swap) && t.swap >= 1)) errors.push(`${where}: invalid swap pair id`);
      swapIds.set(t.swap, (swapIds.get(t.swap) ?? 0) + 1);
      // A car is a thing on the board, not cell content: it cannot trade places (rule 15).
      if (type === 'mover') errors.push(`${where}: a mover cannot be part of a swap pair`);
    }
  });
  for (const [pair, c] of portalPairs) if (c !== 2) errors.push(`Portal pair ${String(pair)}: ${c} portals, expected 2`);
  for (const [sid, c] of swapIds) if (c !== 2) errors.push(`Swap pair ${String(sid)}: ${c} tiles, expected 2`);
  for (const col of doorColors) if (!switchColors.has(col)) warnings.push(`Colour ${String(col)} door has no switch; it can never open`);
  if (starts !== 1) errors.push(starts === 0 ? 'No start tile' : `${starts} start tiles, expected 1`);
  if (finishes !== 1) errors.push(finishes === 0 ? 'No finish tile' : `${finishes} finish tiles, expected 1`);
  if (plus > MAX_PLUS) errors.push(`At most ${MAX_PLUS} plus1 tiles are supported (found ${plus})`);
  if (errors.length) return { errors, warnings };

  // Structurally valid: compile and check the dynamic rules.
  const level = compileLevel(raw as unknown as PuzzleLabLevel);
  const { cells } = level;
  const cycles = launcherCycles(level);
  for (const cyc of cycles) {
    errors.push('Launcher cycle: ' + cyc.concat(cyc[0]).map((i) => at(cells[i].q, cells[i].r)).join(' -> '));
  }
  cells.forEach((c, i) => {
    if (c.type === 'launcher' && landOf(level, i, 0, 0) === i) warnings.push(`${at(c.q, c.r)}: launcher cannot launch anywhere`);
  });
  // Loops the static check cannot see: after a swap, with doors open, or with a parked car as a new
  // wall (cars move once, so a loop is always made of launchers). Every switch combination and both
  // swap phases; parked cars one at a time, on every cell its ray could reach. One error per loop.
  if (!cycles.length) {
    const inLoop = new Set<number>();
    const phases = level.hasSwap ? [0, 1] : [0];
    const parks: Array<[string, number]> = [[level.carsHome, -1]];
    const parkable = (type: string): boolean =>
      type === 'floor' || type === 'start' || type === 'door' || type === 'plus1' || type === 'mover';
    level.cars.forEach((home, k) => {
      const di = cells[home].dirIndex;
      if (di < 0) return;
      for (let p = home, g = 0; p >= 0 && g <= level.cellCount; g++) {
        parks.push([withCar(level.carsHome, k, p), p]);
        p = level.neighbors[p][di];
        if (p >= 0 && !(parkable(tileAt(level, p, 0).type) || parkable(tileAt(level, p, 1).type))) break;
      }
    });
    cells.forEach((c, i) => {
      if ((c.type !== 'mover' && c.type !== 'launcher') || inLoop.has(i)) return;
      for (const [cars, parked] of c.type === 'launcher' ? parks : parks.slice(0, 1)) {
        for (const phase of phases) {
          for (let sw = 0; sw < 8; sw++) {
            if (parked === i) continue;
            const trail: number[] = [];
            const r = resolveArrival(level, i, 0, phase, sw, cars, null, trail);
            if (r.chainLimit) {
              trail.forEach((x) => inLoop.add(x));
              const open = [1, 2, 3].filter((col) => sw & (1 << (col - 1))).map((col) => 'ABC'[col - 1]);
              errors.push(
                `Slide loop: the mover/launcher chain from ${at(c.q, c.r)} returns to itself` +
                  (open.length ? ` (open doors: ${open.join(', ')})` : '') +
                  (parked >= 0 ? ` (parked car: ${at(cells[parked].q, cells[parked].r)})` : ''),
              );
              return;
            }
          }
        }
      }
    });
  }
  if (errors.length || options.solver === false) return { errors, warnings };

  // Editor analysis checks.
  const reach = reachableCells(level);
  const alwaysBlocker = (i: number): boolean =>
    cells[i].type === 'blocker' && (level.swapPartner[i] < 0 || cells[level.swapPartner[i]].type === 'blocker');
  let unreachable = 0;
  cells.forEach((_, i) => {
    if (!reach[i] && !alwaysBlocker(i)) unreachable++;
  });
  if (unreachable) warnings.push(`${unreachable} tile(s) cannot be reached by the player`);

  const mb = minBudgetSearch(level);
  if (mb.aborted) warnings.push('The level is too large for the solver; analysis incomplete');
  else if (mb.unsolvableAtAnyBudget) errors.push('The finish cannot be reached with any budget');
  else if (mb.value === null) errors.push('Not solvable even with 999 steps');
  else if (mb.value > level.budget) errors.push(`Not solvable with this budget: needs at least ${mb.value} steps (budget ${level.budget})`);
  else if (mb.value < level.budget) warnings.push(`Budget is loose: solvable with ${mb.value} steps (${level.budget - mb.value} spare)`);
  return { errors, warnings };
}
