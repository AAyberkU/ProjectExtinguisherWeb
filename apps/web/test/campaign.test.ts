/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import campaign from '../src/game/levels/campaign/campaign.json';

const campaignRaw = import.meta.glob<string>(
  ['../src/game/levels/campaign/*.json', '!../src/game/levels/campaign/campaign.json'],
  { eager: true, query: '?raw', import: 'default' },
);

const byName = (files: Record<string, string>): Map<string, string> =>
  new Map(Object.entries(files).map(([path, text]) => [path.split('/').pop() as string, text]));

describe('campaign (v3 set, pending review)', () => {
  const files = byName(campaignRaw);
  const ids = campaign.chapters.flatMap((ch) => ch.levels);

  it('has 10 chapters of 6 levels with unique ids', () => {
    expect(campaign.chapters).toHaveLength(10);
    campaign.chapters.forEach((ch, i) => {
      expect(ch.id).toBe(`c${String(i + 1).padStart(2, '0')}`);
      expect(ch.levels).toHaveLength(6);
    });
    expect(new Set(ids).size).toBe(60);
  });

  it('has a file for every id and no extra files', () => {
    for (const id of ids) expect(files.has(`${id}.json`), id).toBe(true);
    expect(files.size).toBe(60);
  });

  it('orders levels by their editor slot and file ids match', () => {
    ids.forEach((id, index) => {
      const level = JSON.parse(files.get(`${id}.json`) as string) as { id: string; meta?: { slot?: number } };
      expect(level.id).toBe(id);
      expect(level.meta?.slot, id).toBe(index + 1);
    });
  });
});
