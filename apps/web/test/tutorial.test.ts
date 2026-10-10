import { describe, expect, it } from 'vitest';
import { initialState, step, type CompiledLevel, type Dir, type EngineEvent, type PlayState } from '../src/game/engine';
import { CAMPAIGN } from '../src/game/levels';
import {
  CAMPAIGN_HINTS,
  HINT_TEXT,
  MECHANIC_KINDS,
  deriveIntroductions,
  hintCells,
  levelKinds,
  usesHint,
  type TutorialKind,
} from '../src/game/tutorial';
import { at, build } from './helpers';

const ALL_KINDS: readonly TutorialKind[] = ['basics', ...MECHANIC_KINDS];

/** Plays `dirs` from the start and returns every event plus the final state. */
function play(level: CompiledLevel, dirs: readonly Dir[]): { events: EngineEvent[]; state: PlayState } {
  let state = initialState(level);
  const events: EngineEvent[] = [];

  for (const dir of dirs) {
    const result = step(level, state, dir);
    if (result === null) throw new Error(`illegal move ${dir}`);
    state = result.state;
    events.push(...result.events);
  }

  return { events, state };
}

/** Kinds that the events of `dirs` use. */
function usedBy(level: CompiledLevel, dirs: readonly Dir[]): TutorialKind[] {
  const { events, state } = play(level, dirs);
  return ALL_KINDS.filter((kind) => events.some((event) => usesHint(level, kind, event, state.phase)));
}

describe('tutorial introductions', () => {
  it('lists the mechanic kinds of a level; doors count as switches and swap marks as swap', () => {
    const level = build({
      '0,0': 'start',
      '1,0': { type: 'door', color: 1 },
      '2,0': 'finish',
      '0,1': { type: 'launcher', dir: 'E' },
      '-1,1': { type: 'floor', swap: 1 },
      '-1,0': { type: 'swamp', swap: 1 },
    });

    expect(levelKinds(level)).toEqual(['launcher', 'swamp', 'swap', 'switch']);
  });

  it('introduces each kind on its first level, also mid-chapter, and basics on the first level', () => {
    const plain = build({ '0,0': 'start', '1,0': 'finish' });
    const plus = build({ '0,0': 'start', '1,0': 'plus1', '2,0': 'finish' });
    const launcher = build({ '0,0': 'start', '1,0': { type: 'launcher', dir: 'E' }, '-1,0': 'finish' });
    const both = build({
      '0,0': 'start',
      '1,0': { type: 'portal', pair: 1 },
      '-1,0': { type: 'portal', pair: 1 },
      '0,1': { type: 'refill', value: 3 },
      '2,0': 'finish',
    });

    expect(deriveIntroductions([plain, plus, launcher, plus, both, launcher])).toEqual([
      ['basics'],
      ['plus1'],
      ['launcher'],
      [],
      ['portal', 'refill'],
      [],
    ]);
    expect(deriveIntroductions([plus, plain])).toEqual([['basics', 'plus1'], []]);
    expect(deriveIntroductions([])).toEqual([]);
  });

  it('gives the current campaign one hint per chapter start (level 1 also gets basics)', () => {
    const hinted = CAMPAIGN_HINTS.flatMap((kinds, index) => (kinds.length > 0 ? [{ level: index + 1, kinds }] : []));

    expect(CAMPAIGN_HINTS).toHaveLength(CAMPAIGN.length);
    expect(hinted).toEqual([
      { level: 1, kinds: ['basics', 'plus1'] },
      { level: 7, kinds: ['launcher'] },
      { level: 13, kinds: ['swamp'] },
      { level: 19, kinds: ['mover'] },
      { level: 25, kinds: ['swap'] },
      { level: 31, kinds: ['portal'] },
      { level: 37, kinds: ['switch'] },
      { level: 43, kinds: ['passage'] },
      { level: 49, kinds: ['refill'] },
    ]);
  });

  it('every hinted campaign level has a cell to glow', () => {
    CAMPAIGN_HINTS.forEach((kinds, index) => {
      const level = CAMPAIGN[index].compiled;
      for (const kind of kinds) expect(hintCells(level, kind, initialState(level)).length, `${index + 1} ${kind}`).toBeGreaterThan(0);
    });
  });

  it('keeps every hint line short', () => {
    for (const kind of ALL_KINDS) expect(HINT_TEXT[kind].length, kind).toBeLessThanOrEqual(45);
  });
});

describe('tutorial hint cells', () => {
  it('basics glows the finish', () => {
    const level = build({ '0,0': 'start', '1,0': 'floor', '2,0': 'finish' });
    expect(hintCells(level, 'basics', initialState(level))).toEqual([at(level, 2, 0)]);
  });

  it('anchors on the tile nearest the start and lists doors after switches', () => {
    const level = build({
      '0,0': 'start',
      '2,-2': { type: 'door', color: 1 },
      '-2,0': { type: 'switch', color: 1 },
      '1,0': { type: 'switch', color: 2 },
      '0,2': { type: 'door', color: 2 },
      '2,0': 'finish',
    });

    expect(hintCells(level, 'switch', initialState(level))).toEqual([
      at(level, 1, 0),
      at(level, -2, 0),
      at(level, 2, -2),
      at(level, 0, 2),
    ]);
  });

  it('skips collected +1 tiles and follows swapped content', () => {
    const level = build({
      '0,0': 'start',
      '1,0': 'plus1',
      '-1,0': 'plus1',
      '0,1': { type: 'launcher', dir: 'E', swap: 1 },
      '0,-1': { type: 'floor', swap: 1 },
      '2,0': 'finish',
    });
    const fresh = initialState(level);
    const { state } = play(level, ['E']);

    // Equally near the start: authored order decides.
    expect(hintCells(level, 'plus1', fresh)).toEqual([at(level, 1, 0), at(level, -1, 0)].sort((a, b) => a - b));
    expect(hintCells(level, 'plus1', state)).toEqual([at(level, -1, 0)]);
    expect(hintCells(level, 'launcher', fresh)).toEqual([at(level, 0, 1)]);
    expect(hintCells(level, 'launcher', state)).toEqual([at(level, 0, -1)]);
    // Swap marks stay on their cells.
    expect(hintCells(level, 'swap', state)).toEqual([at(level, 0, 1), at(level, 0, -1)].sort((a, b) => a - b));
  });
});

describe('tutorial hint used detection', () => {
  it('basics: any move', () => {
    const level = build({ '0,0': 'start', '1,0': 'floor', '2,0': 'finish' });
    expect(usedBy(level, ['E'])).toEqual(['basics']);
  });

  it('plus1, refill: picking the tile up', () => {
    const level = build({ '0,0': 'start', '1,0': 'plus1', '-1,0': { type: 'refill', value: 5 }, '2,0': 'finish' }, { steps: 9 });
    expect(usedBy(level, ['E'])).toEqual(['basics', 'plus1']);
    expect(usedBy(level, ['W'])).toEqual(['basics', 'refill']);
  });

  it('launcher, mover, portal: the launch, slide and teleport', () => {
    const level = build({
      '0,0': 'start',
      '1,0': { type: 'launcher', dir: 'SE' },
      '-1,0': { type: 'mover', dir: 'NW' },
      '0,1': { type: 'portal', pair: 1 },
      '2,-2': { type: 'portal', pair: 1 },
      '1,1': 'floor',
      '1,2': 'floor',
      '-1,-1': 'floor',
      '-1,-2': 'finish',
    }, { size: 7, steps: 9 });

    expect(usedBy(level, ['E'])).toEqual(['basics', 'launcher']);
    expect(usedBy(level, ['W'])).toEqual(['basics', 'mover']);
    expect(usedBy(level, ['SE'])).toEqual(['basics', 'portal']);
  });

  it('switch: pressing it', () => {
    const level = build({ '0,0': 'start', '1,0': { type: 'switch', color: 1 }, '-1,0': { type: 'door', color: 1 }, '2,0': 'finish' });
    expect(usedBy(level, ['E'])).toEqual(['basics', 'switch']);
  });

  it('swamp: walking in (2 steps), not landing by launch', () => {
    const level = build({
      '0,0': 'start',
      '1,0': 'swamp',
      '-1,0': { type: 'launcher', dir: 'W' },
      '-2,0': 'floor',
      '-3,0': 'swamp',
      '2,0': 'finish',
    }, { size: 7, steps: 9 });

    expect(usedBy(level, ['E'])).toEqual(['basics', 'swamp']);
    expect(usedBy(level, ['W'])).toEqual(['basics', 'launcher']);
  });

  it('swap: the first move flips the phase', () => {
    const level = build({ '0,0': 'start', '1,0': 'floor', '0,1': { type: 'floor', swap: 1 }, '0,-1': { type: 'plus1', swap: 1 }, '2,0': 'finish' });
    expect(usedBy(level, ['E'])).toEqual(['basics', 'swap']);
  });

  it('passage: walking onto or off a passage, judged on the swapped board', () => {
    const level = build({
      '0,0': 'start',
      '1,0': { type: 'passage', noIn: ['NE'] },
      '2,0': 'floor',
      '-1,0': 'floor',
      '2,-1': 'finish',
    }, { steps: 9 });

    expect(usedBy(level, ['W'])).toEqual(['basics']);
    expect(usedBy(level, ['E'])).toEqual(['basics', 'passage']);

    const { events, state } = play(level, ['E', 'E']);
    const last = events.filter((event) => event.type === 'walk').at(-1) as EngineEvent;
    expect(usesHint(level, 'passage', last, state.phase)).toBe(true);
  });

  it('only the matching events count', () => {
    const level = build({ '0,0': 'start', '1,0': 'finish' });
    const steps: EngineEvent = { type: 'steps', before: 3, after: 2 };
    for (const kind of ALL_KINDS) expect(usesHint(level, kind, steps, 0), kind).toBe(false);
    expect(usesHint(level, 'swamp', { type: 'walk', from: 0, to: 1, dir: 'E', cost: 1 }, 0)).toBe(false);
  });
});
