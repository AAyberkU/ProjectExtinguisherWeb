export function isUnlocked(ids: readonly string[], index: number, completed: ReadonlySet<string>): boolean {
  if (index < 0 || index >= ids.length) return false;
  if (index === 0) return true;
  return completed.has(ids[index]) || completed.has(ids[index - 1]);
}

export function continueIndex(ids: readonly string[], completed: ReadonlySet<string>): number | null {
  for (let i = 0; i < ids.length; i++) {
    if (!completed.has(ids[i]) && isUnlocked(ids, i, completed)) return i;
  }
  return null;
}

export function hasProgress(ids: readonly string[], completed: ReadonlySet<string>): boolean {
  return ids.some((id) => completed.has(id));
}

export function nextIndex(ids: readonly string[], index: number): number | null {
  return index + 1 < ids.length ? index + 1 : null;
}
