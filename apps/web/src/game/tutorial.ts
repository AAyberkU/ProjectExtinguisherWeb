// Tutorial trial (docs/game.md "Screens and HUD"): a non-blocking tile glow and one line of text on
// the level that introduces a mechanic. Pure: which level introduces which mechanic is derived from
// the campaign data, and "used" is read from engine events. The UI owns showing and saving.

import { contentIndex, type CompiledLevel, type EngineEvent, type PlayState } from './engine';
import { CAMPAIGN } from './levels';

/** A tutorial hint. Mechanic kinds use the tile type; `basics` is the first level's goal hint. */
export type TutorialKind =
  | 'basics'
  | 'plus1'
  | 'launcher'
  | 'swamp'
  | 'mover'
  | 'swap'
  | 'portal'
  | 'switch'
  | 'passage'
  | 'refill';

/** Mechanic kinds in the order hints are shown when one level introduces several. */
export const MECHANIC_KINDS: readonly TutorialKind[] = [
  'plus1',
  'launcher',
  'swamp',
  'mover',
  'swap',
  'portal',
  'switch',
  'passage',
  'refill',
];

/** One short, plain line per hint (docs/rules.md). The kind is also the save key. */
export const HINT_TEXT: Readonly<Record<TutorialKind, string>> = {
  basics: 'Reach the goal before your steps run out',
  plus1: '+1 tiles give you one extra step',
  launcher: 'Launchers fling you 2 tiles, even over walls',
  swamp: 'Swamps cost 2 steps to walk into',
  mover: 'Cars carry you once, then park as walls',
  swap: 'Marked tiles trade places with every move',
  portal: 'Portals send you to their twin',
  switch: 'Switches open doors of the same color',
  passage: 'Passages only let you through open sides',
  refill: 'Refills set your steps to their number',
};

/** The mechanic kind a cell's authored tile belongs to (a door belongs to its switch), or null. */
function tileKind(type: string): TutorialKind | null {
  if (type === 'door') return 'switch';
  return (MECHANIC_KINDS as readonly string[]).includes(type) ? (type as TutorialKind) : null;
}

/** Mechanic kinds present in a level, in `MECHANIC_KINDS` order. */
export function levelKinds(level: CompiledLevel): TutorialKind[] {
  const present = new Set<TutorialKind>();

  for (const cell of level.cells) {
    const kind = tileKind(cell.type);
    if (kind !== null) present.add(kind);
    if (cell.swap !== undefined) present.add('swap');
  }

  return MECHANIC_KINDS.filter((kind) => present.has(kind));
}

/**
 * Hints per campaign level (same order as `levels`): a kind is introduced on the first level where
 * it appears, whether that is a chapter's first level or a later one. The first level also gets
 * `basics`, shown before its own mechanics.
 */
export function deriveIntroductions(levels: readonly CompiledLevel[]): TutorialKind[][] {
  const seen = new Set<TutorialKind>();

  return levels.map((level, index) => {
    const introduced = levelKinds(level).filter((kind) => !seen.has(kind));

    for (const kind of introduced) seen.add(kind);

    return index === 0 ? ['basics', ...introduced] : introduced;
  });
}

/** Hints of each campaign level by index, derived once from the campaign data. */
export const CAMPAIGN_HINTS: readonly (readonly TutorialKind[])[] = deriveIntroductions(CAMPAIGN.map((level) => level.compiled));

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Cells that glow for a hint in a state: the cells showing the mechanic now (swap marks stay on
 * their cells; uncollected +1 only; doors after their switches). The first cell anchors the text:
 * the main tile nearest the start, so it stays put while Larry moves.
 */
export function hintCells(level: CompiledLevel, kind: TutorialKind, state: Pick<PlayState, 'phase' | 'mask'>): number[] {
  const main: number[] = [];
  const extra: number[] = [];

  for (let cell = 0; cell < level.cellCount; cell += 1) {
    const source = contentIndex(level, cell, state.phase);
    const type = level.cells[source].type;

    switch (kind) {
      case 'basics':
        if (type === 'finish') main.push(cell);
        break;
      case 'swap':
        if (level.cells[cell].swap !== undefined) main.push(cell);
        break;
      case 'plus1':
        if (type === 'plus1' && (state.mask & level.plusBit[source]) === 0) main.push(cell);
        break;
      case 'switch':
        if (type === 'switch') main.push(cell);
        else if (type === 'door') extra.push(cell);
        break;
      default:
        if (type === kind) main.push(cell);
    }
  }

  const start = level.cells[level.startIndex];
  const distance = (cell: number) => hexDistance(level.cells[cell], start);

  main.sort((a, b) => distance(a) - distance(b) || a - b);
  return [...main, ...extra];
}

/**
 * Whether an engine event uses a hint's mechanic. `phase` is the swap phase the move was judged on
 * (the new state's phase); it decides what a cell shows.
 */
export function usesHint(level: CompiledLevel, kind: TutorialKind, event: EngineEvent, phase: number): boolean {
  switch (kind) {
    case 'basics':
      return event.type === 'walk';
    case 'swamp':
      // Walking in is what costs 2; arriving by launch, slide, or teleport is free.
      return event.type === 'walk' && event.cost > 1;
    case 'passage': {
      const isPassage = (cell: number) => level.cells[contentIndex(level, cell, phase)].type === 'passage';

      if (event.type === 'walk') return isPassage(event.from) || isPassage(event.to);
      if (event.type === 'launch' || event.type === 'slide' || event.type === 'teleport') return isPassage(event.to);
      return false;
    }
    case 'plus1':
      return event.type === 'plus1';
    case 'launcher':
      return event.type === 'launch';
    case 'mover':
      return event.type === 'slide';
    case 'swap':
      return event.type === 'swap';
    case 'portal':
      return event.type === 'teleport';
    case 'switch':
      return event.type === 'switch';
    case 'refill':
      return event.type === 'refill';
  }
}
