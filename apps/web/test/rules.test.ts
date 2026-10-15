import { describe, expect, it } from 'vitest';
import {
  DIRS,
  DIR_VECTORS,
  axialToPixel,
  boardRadius,
  carParkedAt,
  cellContent,
  doorOpen,
  initialState,
  isWall,
  legalMoves,
  opposite,
  plusCollected,
  replay,
  step,
  switchPressed,
  type CompiledLevel,
  type Dir,
  type EngineEvent,
  type PlayState,
} from '../src/game/engine';
import { at, build, dirs } from './helpers';

function play(level: CompiledLevel, moves: string, budget?: number): { state: PlayState; events: EngineEvent[][] } {
  let state = initialState(level, budget);
  const events: EngineEvent[][] = [];
  for (const d of dirs(moves)) {
    const r = step(level, state, d);
    if (!r) throw new Error(`illegal move ${d} at move ${events.length + 1}`);
    state = r.state;
    events.push(r.events);
  }
  return { state, events };
}

const types = (events: EngineEvent[]): string[] => events.map((e) => e.type);

describe('geometry and directions', () => {
  it('uses the Puzzle Lab conventions', () => {
    expect(DIRS).toEqual(['E', 'SE', 'SW', 'W', 'NW', 'NE']);
    expect(DIR_VECTORS.SE).toEqual([0, 1]);
    expect(DIR_VECTORS.NE).toEqual([1, -1]);
    expect(DIRS.map(opposite)).toEqual(['W', 'NW', 'NE', 'E', 'SE', 'SW']);
    expect(boardRadius(9)).toBe(4);
    const p = axialToPixel(1, 2, 10);
    expect(p.x).toBeCloseTo(10 * Math.sqrt(3) * 2);
    expect(p.y).toBeCloseTo(30);
  });

  it('compiles a level with stable indices and neighbours', () => {
    const L = build({ '-2,0': 'start', '2,0': 'finish' });
    expect(L.cellCount).toBe(19);
    expect(L.startIndex).toBe(at(L, -2, 0));
    expect(L.finishIndex).toBe(at(L, 2, 0));
    expect(L.cellAt(3, 0)).toBe(-1);
    expect(L.neighbors[at(L, 0, 0)][DIRS.indexOf('SW')]).toBe(at(L, -1, 1));
    expect(L.budget).toBe(5);
  });
});

describe('walking, winning, losing', () => {
  it('wins on the finish even with 0 steps left', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'finish' }, { steps: 2 });
    const { state, events } = play(L, 'E E');
    expect(state.status).toBe('won');
    expect(state.steps).toBe(0);
    expect(state.moveCount).toBe(2);
    expect(events[1]).toEqual([
      { type: 'walk', from: at(L, -1, 0), to: at(L, 0, 0), dir: 'E', cost: 1 },
      { type: 'steps', before: 1, after: 0 },
      { type: 'win' },
    ]);
    expect(step(L, state, 'W')).toBeNull();
    expect(legalMoves(L, state)).toEqual([]);
  });

  it('rejects unknown and prototype-key directions from untyped input', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'finish' }, { steps: 2 });
    const s = initialState(L);
    for (const bad of ['N', 'constructor', 'toString', '__proto__']) {
      expect(step(L, s, bad as Dir)).toBeNull();
    }
  });

  it('loses when steps run out off the finish', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'floor', '1,0': 'finish' }, { steps: 1 });
    const { state, events } = play(L, 'E');
    expect(state.status).toBe('lost');
    expect(state.lossReason).toBe('out-of-steps');
    expect(events[0].at(-1)).toEqual({ type: 'lose', reason: 'out-of-steps' });
    expect(step(L, state, 'E')).toBeNull();
  });

  it('loses as stuck when no geometric move exists', () => {
    const L = build({ '-2,0': 'start', '-1,0': { type: 'launcher', dir: 'E' }, '1,0': 'floor', '0,-2': 'finish' });
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(at(L, 1, 0));
    expect(state.steps).toBe(4);
    expect(state.status).toBe('lost');
    expect(state.lossReason).toBe('stuck');
    expect(types(events[0])).toEqual(['walk', 'launch', 'steps', 'lose']);
  });

  it('checks the start state', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'finish' });
    expect(initialState(L, 0)).toMatchObject({ status: 'lost', lossReason: 'out-of-steps' });
    expect(initialState(L)).toMatchObject({ status: 'playing', steps: 5, phase: 0, mask: 0, sw: 0, moveCount: 0 });
    const boxed = build({ '0,0': 'start', '2,0': 'finish' });
    expect(initialState(boxed)).toMatchObject({ status: 'lost', lossReason: 'stuck' });
  });

  it('allows revisiting cells', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'finish' });
    expect(play(L, 'E W E E').state.status).toBe('won');
  });

  it('legalMoves reports the neighbour walked into', () => {
    const L = build({ '-2,0': 'start', '-1,0': { type: 'launcher', dir: 'E' }, '-2,1': 'floor', '1,0': 'finish' });
    expect(legalMoves(L, initialState(L))).toEqual([
      { dir: 'E', target: at(L, -1, 0) },
      { dir: 'SE', target: at(L, -2, 1) },
    ]);
  });
});

describe('launcher', () => {
  const base = { '-2,0': 'start', '-1,0': { type: 'launcher', dir: 'E' }, '-2,1': 'floor', '0,-2': 'finish' } as const;

  it('flies two cells over a wall and continues the chain (finish wins)', () => {
    const L = build({ ...base, '1,0': 'finish', '0,-2': 'floor' });
    const { state, events } = play(L, 'E');
    expect(state.status).toBe('won');
    expect(events[0]).toEqual([
      { type: 'walk', from: at(L, -2, 0), to: at(L, -1, 0), dir: 'E', cost: 1 },
      { type: 'launch', from: at(L, -1, 0), to: at(L, 1, 0), dir: 'E' },
      { type: 'steps', before: 5, after: 4 },
      { type: 'win' },
    ]);
  });

  it('lands one cell when the second cell is a wall', () => {
    const L = build({ ...base, '0,0': 'floor' });
    expect(play(L, 'E').state.pos).toBe(at(L, 0, 0));
    const door = build({ ...base, '0,0': 'floor', '1,0': { type: 'door', color: 1 } });
    expect(play(door, 'E').state.pos).toBe(at(door, 0, 0));
  });

  it('stays when both cells are walls', () => {
    const L = build(base);
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(at(L, -1, 0));
    expect(types(events[0])).toEqual(['walk', 'steps']);
  });

  it('flies over a closed door and ignores the landing passage noIn', () => {
    const L = build({ ...base, '0,0': { type: 'door', color: 1 }, '1,0': { type: 'passage', noIn: ['W'] }, '2,0': 'floor' });
    expect(play(L, 'E').state.pos).toBe(at(L, 1, 0));
  });

  it('chains into a launcher and into a portal; the arrival portal does not fire', () => {
    const L = build(
      {
        '-3,0': 'start',
        '-2,0': { type: 'launcher', dir: 'E' },
        '0,0': { type: 'launcher', dir: 'SE' },
        '0,2': { type: 'portal', pair: 1 },
        '-3,2': { type: 'portal', pair: 1 },
        '-2,2': 'floor',
        '-1,2': 'finish',
      },
      { size: 7 },
    );
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(at(L, -3, 2));
    expect(events[0]).toEqual([
      { type: 'walk', from: at(L, -3, 0), to: at(L, -2, 0), dir: 'E', cost: 1 },
      { type: 'launch', from: at(L, -2, 0), to: at(L, 0, 0), dir: 'E' },
      { type: 'launch', from: at(L, 0, 0), to: at(L, 0, 2), dir: 'SE' },
      { type: 'teleport', from: at(L, 0, 2), to: at(L, -3, 2) },
      { type: 'steps', before: 5, after: 4 },
    ]);
    expect(play(L, 'E E E').state.status).toBe('won');
  });

  it('stops a launcher loop at the chain limit', () => {
    const L = build({
      '-2,1': 'start',
      '-1,0': { type: 'launcher', dir: 'E' },
      '1,0': { type: 'launcher', dir: 'W' },
      '2,-2': 'finish',
    });
    const r = step(L, initialState(L), 'NE');
    expect(r?.events.filter((e) => e.type === 'launch')).toHaveLength(32);
    expect(r?.state.pos).toBe(at(L, -1, 0));
  });
});

describe('mover (car, rule 15)', () => {
  const row = (cells: Record<string, unknown>) =>
    build({ '-3,0': 'start', '-2,0': { type: 'mover', dir: 'E' }, '-1,0': 'floor', '0,0': 'floor', '-3,1': 'finish', ...cells } as never, {
      size: 7,
    });

  it('carries the player over floor and stays parked with the player in it', () => {
    const L = row({});
    expect(initialState(L).cars).toBe(L.carsHome);
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(at(L, 0, 0));
    expect(state.steps).toBe(4);
    expect(carParkedAt(state.cars, 0)).toBe(at(L, 0, 0));
    expect(events[0][1]).toEqual({
      type: 'slide',
      from: at(L, -2, 0),
      to: at(L, 0, 0),
      dir: 'E',
      path: [at(L, -1, 0), at(L, 0, 0)],
      car: 0,
      parkedAt: at(L, 0, 0),
      drop: false,
    });
  });

  it('leaves its home as floor and is a wall once the player steps out', () => {
    const L = row({});
    const { state } = play(L, 'E W W');
    // The home cell no longer rides: the player walked onto it and stays there.
    expect(state.pos).toBe(at(L, -2, 0));
    expect(isWall(L, state, at(L, 0, 0))).toBe(true);
    expect(isWall(L, state, at(L, -2, 0))).toBe(false);
    expect(legalMoves(L, play(L, 'E W').state).map((m) => m.dir)).not.toContain('E');
  });

  it('stops before a closed door and a passage that blocks entry', () => {
    expect(play(row({ '1,0': { type: 'door', color: 2 } }), 'E').state.pos).toBe(at(row({}), 0, 0));
    const p = row({ '1,0': { type: 'passage', noIn: ['W'] } });
    expect(play(p, 'E').state.pos).toBe(at(p, 0, 0));
  });

  it('parks before a tile that acts and drops the player onto it (a swamp at no extra cost)', () => {
    const p = row({ '1,0': { type: 'passage', noIn: ['E'] }, '2,0': 'floor' });
    const passage = play(p, 'E');
    expect(passage.state.pos).toBe(at(p, 1, 0));
    expect(carParkedAt(passage.state.cars, 0)).toBe(at(p, 0, 0));
    expect(passage.events[0][1]).toMatchObject({ type: 'slide', to: at(p, 1, 0), parkedAt: at(p, 0, 0), drop: true });
    const s = row({ '0,0': 'swamp', '1,0': 'floor' });
    const r = play(s, 'E').state;
    expect(r.pos).toBe(at(s, 0, 0));
    expect(r.steps).toBe(4);
    expect(carParkedAt(r.cars, 0)).toBe(at(s, -1, 0));
  });

  it('parks on its home when it cannot move; the home is a wall afterwards', () => {
    const L = build({ '-1,0': 'start', '0,0': { type: 'mover', dir: 'E' }, '0,1': 'floor', '-1,1': 'floor', '2,-2': 'finish' });
    const { state, events } = play(L, 'E SW');
    expect(events[0][1]).toEqual({ type: 'slide', from: at(L, 0, 0), to: at(L, 0, 0), dir: 'E', path: [], car: 0, parkedAt: at(L, 0, 0), drop: false });
    expect(state.pos).toBe(at(L, -1, 1));
    expect(isWall(L, state, at(L, 0, 0))).toBe(true);
  });

  it('drops onto an uncollected plus1 and collects it, and drives over a collected one', () => {
    const L = build(
      {
        '0,-1': 'start',
        '-2,0': { type: 'mover', dir: 'E' },
        '-1,0': 'floor',
        '0,0': 'plus1',
        '1,0': 'floor',
        '2,0': 'floor',
        '3,-3': 'finish',
      },
      { size: 7 },
    );
    const first = play(L, 'SW W');
    expect(first.state.pos).toBe(at(L, 0, 0));
    expect(first.state.steps).toBe(4);
    expect(types(first.events[1])).toEqual(['walk', 'slide', 'plus1', 'steps']);
    const second = play(L, 'SE W W');
    expect(second.state.pos).toBe(at(L, 2, 0));
    expect(second.events[2][1]).toMatchObject({ type: 'slide', path: [at(L, -1, 0), at(L, 0, 0), at(L, 1, 0), at(L, 2, 0)], drop: false });
    expect(plusCollected(L, second.state, at(L, 0, 0))).toBe(true);
  });

  it('a drop continues the chain, and a launcher flies over a parked car but cannot land on it', () => {
    const L = build({
      '-2,0': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': { type: 'launcher', dir: 'NE' },
      '1,-1': 'floor',
      '2,-2': 'floor',
      '-2,1': 'floor',
      '-1,1': 'floor',
      '0,1': 'finish',
    });
    // The car cannot move (the launcher is next), so it parks on its home and drops the player onto the launcher.
    const { state, events } = play(L, 'E');
    expect(types(events[0])).toEqual(['walk', 'slide', 'launch', 'steps']);
    expect(carParkedAt(state.cars, 0)).toBe(at(L, -1, 0));
    expect(state.pos).toBe(at(L, 2, -2));
    // Out of the car at (0, 0), into the SE launcher: it flies over the parked car and lands on (0, 1).
    const fly = build({
      '-2,0': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': 'floor',
      '0,-1': { type: 'launcher', dir: 'SE' },
      '0,1': 'floor',
      '-1,1': 'floor',
      '2,-2': 'finish',
    });
    const over = play(fly, 'E NW');
    expect(over.events[1].find((e) => e.type === 'launch')).toEqual({ type: 'launch', from: at(fly, 0, -1), to: at(fly, 0, 1), dir: 'SE' });
    // With the landing cell taken by the car, the launch falls back to one cell.
    const short = build({
      '-2,0': 'start',
      '-1,0': { type: 'mover', dir: 'E' },
      '0,0': 'floor',
      '0,-1': 'floor',
      '0,-2': { type: 'launcher', dir: 'SE' },
      '1,-2': 'floor',
      '2,-2': 'finish',
    });
    expect(play(short, 'E NW NW').events[2].find((e) => e.type === 'launch')).toMatchObject({ to: at(short, 0, -1) });
  });
});

describe('swamp, plus1, refill', () => {
  it('costs 2 to walk into a swamp; entering with 1 step is legal but loses', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'swamp', '0,0': 'finish' });
    const { state, events } = play(L, 'E');
    expect(state.steps).toBe(3);
    expect(events[0][0]).toMatchObject({ type: 'walk', cost: 2 });
    const short = play(L, 'E', 1).state;
    expect(short).toMatchObject({ status: 'lost', lossReason: 'out-of-steps', steps: 0 });
  });

  it('counts an unaffordable swamp as a legal move for the stuck check', () => {
    const L = build({ '-2,0': 'start', '-1,0': { type: 'passage', noOut: ['W'] }, '0,0': 'swamp', '1,0': 'finish' }, { steps: 2 });
    const { state } = play(L, 'E');
    expect(state).toMatchObject({ status: 'playing', steps: 1 });
    expect(legalMoves(L, state)).toEqual([{ dir: 'E', target: at(L, 0, 0) }]);
    expect(play(L, 'E E').state).toMatchObject({ status: 'lost', lossReason: 'out-of-steps' });
  });

  it('plus1 gives +1 once, then plays as floor', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'plus1', '0,0': 'floor', '2,0': 'finish' });
    const { state, events } = play(L, 'E E W');
    expect(events[0]).toContainEqual({ type: 'plus1', cell: at(L, -1, 0) });
    expect(events[0]).toContainEqual({ type: 'steps', before: 5, after: 5 });
    expect(types(events[2])).toEqual(['walk', 'steps']);
    expect(state.steps).toBe(3);
    expect(plusCollected(L, state, at(L, -1, 0))).toBe(true);
  });

  it('refill sets steps to its value on every entry, even downward', () => {
    const L = build({ '-2,0': 'start', '-1,0': { type: 'refill', value: 3 }, '0,0': 'floor', '2,0': 'finish' }, { steps: 9 });
    const { state, events } = play(L, 'E E W');
    expect(events[0]).toEqual([
      { type: 'walk', from: at(L, -2, 0), to: at(L, -1, 0), dir: 'E', cost: 1 },
      { type: 'refill', cell: at(L, -1, 0), value: 3 },
      { type: 'steps', before: 9, after: 3 },
    ]);
    expect(events[1]).toContainEqual({ type: 'steps', before: 3, after: 2 });
    expect(events[2]).toContainEqual({ type: 'steps', before: 2, after: 3 });
    expect(state.steps).toBe(3);
  });
});

describe('switch and door', () => {
  it('a door is a wall until its switch is pressed, then opens permanently', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': { type: 'door', color: 1 }, '1,0': 'finish', '-2,1': { type: 'switch', color: 1 } }, { steps: 6 });
    const door = at(L, 0, 0);
    let { state } = play(L, 'E');
    expect(isWall(L, state, door)).toBe(true);
    expect(doorOpen(L, state, door)).toBe(false);
    expect(step(L, state, 'E')).toBeNull();
    const pressed = play(L, 'E SW');
    expect(pressed.events[1]).toContainEqual({ type: 'switch', cell: at(L, -2, 1), color: 1, doors: [door] });
    state = pressed.state;
    expect(doorOpen(L, state, door)).toBe(true);
    expect(switchPressed(L, state, at(L, -2, 1))).toBe(true);
    expect(isWall(L, state, door)).toBe(false);
    // Pressing again reports nothing new.
    expect(types(play(L, 'E SW NE SW').events[3])).toEqual(['walk', 'steps']);
    expect(play(L, 'E SW NE E E').state.status).toBe('won');
  });

  it('a switch is pressed by a launch landing', () => {
    const L = build({
      '-2,0': 'start',
      '-1,0': { type: 'launcher', dir: 'E' },
      '1,0': { type: 'switch', color: 3 },
      '2,0': 'floor',
      '2,-1': { type: 'door', color: 3 },
      '2,-2': 'finish',
    });
    const { state, events } = play(L, 'E');
    expect(state.sw).toBe(4);
    expect(types(events[0])).toEqual(['walk', 'launch', 'switch', 'steps']);
    expect(play(L, 'E E NW NW', 9).state.status).toBe('won');
  });
});

describe('passage', () => {
  it('noIn blocks entering through that side; noOut blocks leaving in that direction', () => {
    const blocked = build({ '-2,0': 'start', '-1,0': { type: 'passage', noIn: ['W'] }, '-2,1': 'floor', '0,0': 'finish' });
    const s0 = initialState(blocked);
    expect(step(blocked, s0, 'E')).toBeNull();
    expect(legalMoves(blocked, s0).map((m) => m.dir)).toEqual(['SE']);
    const open = build({ '-2,0': 'start', '-1,0': { type: 'passage', noIn: ['E'], noOut: ['E'] }, '0,0': 'finish' });
    const { state } = play(open, 'E');
    expect(state.pos).toBe(at(open, -1, 0));
    expect(step(open, state, 'E')).toBeNull();
    expect(legalMoves(open, state).map((m) => m.dir)).toEqual(['W']);
  });
});

describe('portal', () => {
  it('teleports to the partner, which does not send the player back', () => {
    const L = build(
      { '-3,0': 'start', '-2,0': { type: 'portal', pair: 1 }, '2,0': { type: 'portal', pair: 1 }, '3,0': 'floor', '1,0': 'floor', '0,-3': 'finish' },
      { size: 7 },
    );
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(at(L, 2, 0));
    expect(events[0]).toContainEqual({ type: 'teleport', from: at(L, -2, 0), to: at(L, 2, 0) });
    // Walking off and back onto the arrival portal teleports again.
    const back = play(L, 'E E W').state;
    expect(back.pos).toBe(at(L, -2, 0));
  });
});

describe('swap', () => {
  // Row: S(-2,0)  A(-1,0) blocker swap 1  B(0,0)  C(1,0) floor swap 1  finish(2,0)
  const L = build({
    '-2,0': 'start',
    '-1,0': { type: 'blocker', swap: 1 },
    '0,0': 'floor',
    '1,0': { type: 'floor', swap: 1 },
    '2,0': 'finish',
  });
  const A = at(L, -1, 0);
  const C = at(L, 1, 0);

  it('flips the phase before the move is judged', () => {
    const { state, events } = play(L, 'E');
    expect(state.pos).toBe(A);
    expect(state.phase).toBe(1);
    expect(events[0][0]).toEqual({ type: 'swap', phase: 1, pairs: [[A, C]] });
    expect(events[0][1]).toMatchObject({ type: 'walk', to: A });
  });

  it('an illegal move changes nothing and does not flip the phase', () => {
    const { state } = play(L, 'E E');
    expect(state.phase).toBe(0);
    expect(isWall(L, state, C)).toBe(false); // floor now, but a blocker after the next swap
    expect(step(L, state, 'E')).toBeNull();
    expect(legalMoves(L, state)).toEqual([{ dir: 'W', target: A }]);
    expect(state.phase).toBe(0);
  });

  it('cellContent trades content but keeps the swap mark on the cell', () => {
    expect(cellContent(L, A, 0)).toMatchObject({ type: 'blocker', swap: 1, source: A });
    expect(cellContent(L, A, 1)).toMatchObject({ type: 'floor', swap: 1, source: C });
    expect(cellContent(L, C, 1)).toMatchObject({ type: 'blocker', swap: 1, source: A });
    expect(cellContent(L, at(L, 0, 0), 1)).toEqual({ type: 'floor', noIn: [], noOut: [], source: at(L, 0, 0) });
  });

  it('a finish swapping under the player does not win', () => {
    // S(-2,0) A(-1,0) X(0,0) floor swap 1, B(1,0), Y(2,0) finish swap 1
    const F = build(
      { '-2,0': 'start', '-1,0': 'floor', '0,0': { type: 'floor', swap: 1 }, '1,0': 'floor', '2,0': { type: 'finish', swap: 1 } },
      { steps: 10 },
    );
    const X = at(F, 0, 0);
    const onX = play(F, 'E E').state;
    expect(onX).toMatchObject({ pos: X, phase: 0, status: 'playing' });
    expect(cellContent(F, X, 1).type).toBe('finish');
    const away = play(F, 'E E E').state;
    expect(away).toMatchObject({ pos: at(F, 1, 0), phase: 1, status: 'playing' });
    expect(play(F, 'E E E E').state.status).toBe('won');
  });

  it('tracks a plus1 per tile across swaps', () => {
    // P(-1,0) plus1 swap 1 <-> Q(1,0) floor swap 1; triangle F(0,0), (0,1), (-1,1) changes parity.
    const P = build(
      {
        '-2,0': 'start',
        '-1,0': { type: 'plus1', swap: 1 },
        '0,0': 'floor',
        '1,0': { type: 'floor', swap: 1 },
        '0,1': 'floor',
        '-1,1': 'floor',
        '2,-2': 'finish',
      },
      { steps: 10 },
    );
    const collected = play(P, 'E E E');
    expect(collected.events[2]).toContainEqual({ type: 'plus1', cell: at(P, 1, 0) });
    expect(plusCollected(P, collected.state, at(P, 1, 0))).toBe(true);
    const { state, events } = play(P, 'E E E W SE W NE W');
    expect(state.pos).toBe(at(P, -1, 0));
    expect(state.phase).toBe(0);
    expect(cellContent(P, state.pos, state.phase).type).toBe('plus1');
    expect(plusCollected(P, state, state.pos)).toBe(true);
    expect(events[7].some((e) => e.type === 'plus1')).toBe(false);
    expect(state.steps).toBe(3);
  });

  it('a launcher lands relative to the cell it currently sits on', () => {
    // The launcher at (-1,1) swaps with the floor at (-1,0); at phase 1 it sits on (-1,0).
    const S = build({
      '-2,0': 'start',
      '-1,0': { type: 'floor', swap: 1 },
      '-1,1': { type: 'launcher', dir: 'E', swap: 1 },
      '1,0': 'finish',
      '1,1': 'floor',
    });
    const { state, events } = play(S, 'E');
    expect(events[0]).toContainEqual({ type: 'launch', from: at(S, -1, 0), to: at(S, 1, 0), dir: 'E' });
    expect(state.status).toBe('won');
  });
});

describe('replay helper', () => {
  it('reports the first illegal move', () => {
    const L = build({ '-2,0': 'start', '-1,0': 'floor', '0,0': 'finish' });
    const r = replay(L, ['E', 'NE', 'E'] as Dir[]);
    expect(r.applied).toBe(1);
    expect(r.illegalAt).toBe(1);
    expect(r.state.pos).toBe(at(L, -1, 0));
  });
});
