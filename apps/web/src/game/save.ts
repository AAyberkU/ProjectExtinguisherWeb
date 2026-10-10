export const SAVE_KEY = 'project-extinguisher.save.v1';

export interface SaveData {
  readonly version: 1;
  readonly completed: readonly string[];
  readonly music: boolean;
  readonly sfx: boolean;
  readonly tutorialsSeen: readonly string[];
}

export interface SaveStorage {
  read(): string | null;
  write(value: string): void;
}

const DEFAULT_SAVE: SaveData = { version: 1, completed: [], music: true, sfx: true, tutorialsSeen: [] };

export function createLocalStorage(key: string = SAVE_KEY): SaveStorage {
  // Even reading the `localStorage` getter can throw (blocked site data), so every access is wrapped.
  return {
    read() {
      try {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
      } catch {
        // Private mode or quota: the session continues with in-memory data.
      }
    },
  };
}

export function createMemoryStorage(initial: string | null = null): SaveStorage {
  let value = initial;
  return {
    read: () => value,
    write: (next) => {
      value = next;
    },
  };
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function parseSave(raw: string | null): SaveData {
  if (raw === null) return DEFAULT_SAVE;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SAVE;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_SAVE;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) return DEFAULT_SAVE;
  return {
    version: 1,
    completed: uniqueStrings(obj.completed),
    music: typeof obj.music === 'boolean' ? obj.music : true,
    sfx: typeof obj.sfx === 'boolean' ? obj.sfx : true,
    tutorialsSeen: uniqueStrings(obj.tutorialsSeen),
  };
}

export class SaveStore {
  private current: SaveData;
  private readonly listeners = new Set<(data: SaveData) => void>();

  constructor(private readonly storage: SaveStorage) {
    let raw: string | null = null;
    try {
      raw = storage.read();
    } catch {
      raw = null;
    }
    this.current = parseSave(raw);
  }

  get data(): SaveData {
    return this.current;
  }

  isCompleted(levelId: string): boolean {
    return this.current.completed.includes(levelId);
  }

  completedSet(): ReadonlySet<string> {
    return new Set(this.current.completed);
  }

  markCompleted(levelId: string): void {
    if (this.isCompleted(levelId)) return;
    this.commit({ ...this.current, completed: [...this.current.completed, levelId] });
  }

  setMusic(on: boolean): void {
    if (this.current.music === on) return;
    this.commit({ ...this.current, music: on });
  }

  setSfx(on: boolean): void {
    if (this.current.sfx === on) return;
    this.commit({ ...this.current, sfx: on });
  }

  hasSeenTutorial(key: string): boolean {
    return this.current.tutorialsSeen.includes(key);
  }

  markTutorialSeen(key: string): void {
    if (this.hasSeenTutorial(key)) return;
    this.commit({ ...this.current, tutorialsSeen: [...this.current.tutorialsSeen, key] });
  }

  markAllCompleted(levelIds: readonly string[]): void {
    const completed = uniqueStrings([...this.current.completed, ...levelIds]);
    if (completed.length === this.current.completed.length) return;
    this.commit({ ...this.current, completed });
  }

  reset(): void {
    this.commit(DEFAULT_SAVE);
  }

  subscribe(listener: (data: SaveData) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: SaveData): void {
    this.current = next;
    try {
      this.storage.write(JSON.stringify(next));
    } catch {
      // In-memory data stays correct for the session.
    }
    for (const listener of [...this.listeners]) listener(next);
  }
}

export const saveStore = new SaveStore(createLocalStorage());
