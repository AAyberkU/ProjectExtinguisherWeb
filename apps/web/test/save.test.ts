import { describe, expect, it, vi } from 'vitest';
import {
  SAVE_KEY,
  SaveStore,
  createLocalStorage,
  createMemoryStorage,
  parseSave,
  saveStore,
  type SaveStorage,
} from '../src/game/save';

const defaults = { version: 1, completed: [], music: true, sfx: true, tutorialsSeen: [] };

describe('parseSave', () => {
  it('returns defaults for null', () => {
    expect(parseSave(null)).toEqual(defaults);
  });
  it('returns defaults for bad JSON, non-objects and wrong version', () => {
    expect(parseSave('{nope')).toEqual(defaults);
    expect(parseSave('[1]')).toEqual(defaults);
    expect(parseSave('42')).toEqual(defaults);
    expect(parseSave('null')).toEqual(defaults);
    expect(parseSave(JSON.stringify({ version: 2, completed: ['a'] }))).toEqual(defaults);
  });
  it('keeps valid parts and defaults wrong-typed ones', () => {
    const raw = JSON.stringify({ version: 1, completed: ['a', 3, 'a', null, 'b'], music: 'no', sfx: false, tutorialsSeen: 'x' });
    expect(parseSave(raw)).toEqual({ version: 1, completed: ['a', 'b'], music: true, sfx: false, tutorialsSeen: [] });
  });
});

describe('SaveStore', () => {
  it('starts with defaults and round-trips through storage', () => {
    const storage = createMemoryStorage();
    const store = new SaveStore(storage);
    expect(store.data).toEqual(defaults);
    store.markCompleted('l1');
    store.setMusic(false);
    store.setSfx(false);
    store.markTutorialSeen('t1');
    const again = new SaveStore(storage);
    expect(again.data).toEqual({ version: 1, completed: ['l1'], music: false, sfx: false, tutorialsSeen: ['t1'] });
    expect(again.isCompleted('l1')).toBe(true);
    expect(again.hasSeenTutorial('t1')).toBe(true);
    expect(again.completedSet().has('l1')).toBe(true);
  });
  it('loads corrupted input as defaults', () => {
    expect(new SaveStore(createMemoryStorage('garbage')).data).toEqual(defaults);
  });
  it('survives a storage whose read throws', () => {
    const storage: SaveStorage = { read: () => { throw new Error('x'); }, write: () => {} };
    expect(new SaveStore(storage).data).toEqual(defaults);
  });
  it('keeps in-memory data when writes fail', () => {
    const storage: SaveStorage = { read: () => null, write: () => { throw new Error('quota'); } };
    const store = new SaveStore(storage);
    expect(() => store.markCompleted('a')).not.toThrow();
    expect(store.isCompleted('a')).toBe(true);
  });
  it('dedupes completions and tutorials, and writes only on change', () => {
    const write = vi.fn();
    const store = new SaveStore({ read: () => null, write });
    store.markCompleted('a');
    store.markCompleted('a');
    store.markTutorialSeen('t');
    store.markTutorialSeen('t');
    store.setMusic(true);
    expect(store.data.completed).toEqual(['a']);
    expect(store.data.tutorialsSeen).toEqual(['t']);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('notifies subscribers until they unsubscribe', () => {
    const store = new SaveStore(createMemoryStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.markCompleted('a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].completed).toEqual(['a']);
    off();
    store.markCompleted('b');
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('markAllCompleted merges without duplicates', () => {
    const store = new SaveStore(createMemoryStorage());
    store.markCompleted('b');
    store.markAllCompleted(['a', 'b', 'c', 'a']);
    expect(store.data.completed).toEqual(['b', 'a', 'c']);
  });
  it('reset restores defaults, persists them and notifies', () => {
    const storage = createMemoryStorage();
    const store = new SaveStore(storage);
    store.markCompleted('a');
    store.setMusic(false);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset();
    expect(store.data).toEqual(defaults);
    expect(parseSave(storage.read())).toEqual(defaults);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('SaveStore with two tabs', () => {
  it('unions progress instead of overwriting it', () => {
    const storage = createMemoryStorage();
    const a = new SaveStore(storage);
    const b = new SaveStore(storage);
    a.markCompleted('l1');
    b.markCompleted('l2');
    b.markTutorialSeen('t2');
    a.markTutorialSeen('t1');
    expect(parseSave(storage.read()).completed).toEqual(['l1', 'l2']);
    expect(parseSave(storage.read()).tutorialsSeen).toEqual(['t2', 't1']);
    expect(a.data.completed).toEqual(['l1', 'l2']);
  });
  it('lets only the changed setting win', () => {
    const storage = createMemoryStorage();
    const a = new SaveStore(storage);
    const b = new SaveStore(storage);
    a.setMusic(false);
    b.setSfx(false);
    expect(parseSave(storage.read())).toMatchObject({ music: false, sfx: false });
    b.markCompleted('x');
    expect(parseSave(storage.read())).toMatchObject({ music: false, sfx: false, completed: ['x'] });
  });
  it('reset still writes the defaults', () => {
    const storage = createMemoryStorage();
    const a = new SaveStore(storage);
    const b = new SaveStore(storage);
    b.markCompleted('l1');
    a.reset();
    expect(parseSave(storage.read())).toEqual(defaults);
  });
  it('adopts a save written by another tab on the storage event', () => {
    const storage = createMemoryStorage();
    let handler: ((event: { key: string | null }) => void) | undefined;
    vi.stubGlobal('window', { addEventListener: (_: string, fn: typeof handler) => { handler = fn; } });
    try {
      const store = new SaveStore(storage);
      const listener = vi.fn();
      store.subscribe(listener);
      storage.write(JSON.stringify({ version: 1, completed: ['z'], music: true, sfx: true, tutorialsSeen: [] }));
      handler?.({ key: 'other' });
      expect(listener).not.toHaveBeenCalled();
      handler?.({ key: SAVE_KEY });
      expect(store.data.completed).toEqual(['z']);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('storage adapters', () => {
  it('memory storage holds the last written value', () => {
    const s = createMemoryStorage('x');
    expect(s.read()).toBe('x');
    s.write('y');
    expect(s.read()).toBe('y');
  });
  it('local storage adapter never throws without a window', () => {
    const s = createLocalStorage();
    expect(s.read()).toBeNull();
    expect(() => s.write('x')).not.toThrow();
  });
  it('local storage adapter swallows a throwing localStorage getter', () => {
    const win = {
      get localStorage(): never {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('window', win);
    try {
      const s = createLocalStorage();
      expect(s.read()).toBeNull();
      expect(() => s.write('x')).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('local storage adapter swallows quota errors', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    try {
      expect(() => createLocalStorage().write('x')).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('local storage adapter reads and writes through window.localStorage', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
      },
    });
    try {
      const s = createLocalStorage();
      s.write('hello');
      expect(map.get(SAVE_KEY)).toBe('hello');
      expect(s.read()).toBe('hello');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('the singleton exists and starts with defaults in node', () => {
    expect(saveStore.data).toEqual(defaults);
  });
});
