// The campaign: Puzzle Lab level files from ./campaign, ordered by ./campaign/campaign.json.
// Level files are editor exports used as-is (docs/levels.md); this module only orders and compiles.

import { compileLevel, type CompiledLevel, type PuzzleLabLevel } from '../engine';
import campaignOrder from './campaign/campaign.json';

/** A level the game can play: a campaign entry or (in development) an ad-hoc level. */
export interface PlayableLevel {
  /** Campaign index (0-based), or -1 for a level outside the campaign. */
  readonly index: number;
  readonly id: string;
  readonly name: string;
  /** HUD label, for example "1-1 · İlk engel". */
  readonly label: string;
  readonly compiled: CompiledLevel;
}

export interface CampaignLevel extends PlayableLevel {
  /** Chapter number, 1-based. */
  readonly chapter: number;
  readonly chapterId: string;
  /** Position inside the chapter, 1-based. */
  readonly position: number;
}

interface CampaignOrder {
  chapters: ReadonlyArray<{ id: string; levels: readonly string[] }>;
}

const levelFiles = import.meta.glob<PuzzleLabLevel>(
  ['./campaign/*.json', '!./campaign/campaign.json'],
  { eager: true, import: 'default' },
);

function buildCampaign(): readonly CampaignLevel[] {
  const byId = new Map<string, PuzzleLabLevel>();

  for (const level of Object.values(levelFiles)) {
    byId.set(level.id, level);
  }

  const out: CampaignLevel[] = [];

  (campaignOrder as CampaignOrder).chapters.forEach((chapter, chapterIndex) => {
    chapter.levels.forEach((id, positionIndex) => {
      const level = byId.get(id);

      if (level === undefined) {
        throw new Error(`Campaign level '${id}' has no level file.`);
      }

      const chapterNumber = chapterIndex + 1;
      const position = positionIndex + 1;

      out.push({
        index: out.length,
        chapter: chapterNumber,
        chapterId: chapter.id,
        position,
        id,
        name: level.name,
        label: `${chapterNumber}-${position} · ${level.name}`,
        compiled: compileLevel(level),
      });
    });
  });

  return out;
}

export const CAMPAIGN: readonly CampaignLevel[] = buildCampaign();

export function getCampaignLevel(index: number): CampaignLevel {
  const level = CAMPAIGN[index];

  if (level === undefined) {
    throw new Error(`Campaign level ${index} does not exist.`);
  }

  return level;
}

export function isFinalCampaignLevel(level: PlayableLevel): boolean {
  return level.index === CAMPAIGN.length - 1;
}

/** Wraps a level outside the campaign (development tooling). */
export function createAdHocLevel(level: PuzzleLabLevel): PlayableLevel {
  return { index: -1, id: level.id, name: level.name, label: `dev · ${level.name}`, compiled: compileLevel(level) };
}
