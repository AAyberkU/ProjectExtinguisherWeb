import { describe, expect, it } from 'vitest';
import { continueIndex, hasProgress, isUnlocked, nextIndex } from '../src/game/progress';

const ids = ['a', 'b', 'c', 'd'];
const done = (...x: string[]): ReadonlySet<string> => new Set(x);

describe('isUnlocked', () => {
  it('always unlocks the first level', () => {
    expect(isUnlocked(ids, 0, done())).toBe(true);
  });
  it('unlocks linearly', () => {
    expect(isUnlocked(ids, 1, done())).toBe(false);
    expect(isUnlocked(ids, 1, done('a'))).toBe(true);
    expect(isUnlocked(ids, 2, done('a'))).toBe(false);
  });
  it('keeps a completed level unlocked even when earlier ones are not completed', () => {
    expect(isUnlocked(ids, 3, done('d'))).toBe(true);
  });
  it('rejects out-of-range indexes', () => {
    expect(isUnlocked(ids, -1, done())).toBe(false);
    expect(isUnlocked(ids, 4, done('a', 'b', 'c', 'd'))).toBe(false);
  });
});

describe('continueIndex', () => {
  it('is 0 with empty progress', () => {
    expect(continueIndex(ids, done())).toBe(0);
  });
  it('is the first unlocked uncompleted level', () => {
    expect(continueIndex(ids, done('a', 'b'))).toBe(2);
  });
  it('skips over completed gaps', () => {
    expect(continueIndex(ids, done('b'))).toBe(0);
    expect(continueIndex(ids, done('a', 'c'))).toBe(1);
  });
  it('is null when every level is completed', () => {
    expect(continueIndex(ids, done(...ids))).toBeNull();
  });
  it('is null for an empty campaign', () => {
    expect(continueIndex([], done())).toBeNull();
  });
});

describe('hasProgress', () => {
  it('is false with nothing completed', () => {
    expect(hasProgress(ids, done())).toBe(false);
  });
  it('is true when a campaign level is completed', () => {
    expect(hasProgress(ids, done('c'))).toBe(true);
  });
  it('ignores ids outside the campaign', () => {
    expect(hasProgress(ids, done('zzz'))).toBe(false);
  });
});

describe('nextIndex', () => {
  it('returns index + 1', () => {
    expect(nextIndex(ids, 0)).toBe(1);
    expect(nextIndex(ids, 2)).toBe(3);
  });
  it('is null after the last level', () => {
    expect(nextIndex(ids, 3)).toBeNull();
  });
});
