// What a cell looks like: base sprite (jam placeholder art) plus a code-drawn glyph for mechanics
// that have no art yet. Pure lookups over the engine; no gameplay decisions.

import { Container, Sprite, Text } from 'pixi.js';
import {
  cellContent,
  doorOpen,
  plusCollected,
  switchPressed,
  type CompiledLevel,
  type PlayState,
  type TileContent,
} from '../engine';
import { createGlyph, createSwapMarker, type GlyphTile } from './glyphs';
import { PLACEHOLDER_TILE_ROTATION, TILE_SPRITE_HEIGHT, TILE_SPRITE_WIDTH, TILE_VISUAL_RADIUS } from './layout';

/** The parts of the play state that change how tiles look. */
export type VisualState = Pick<PlayState, 'phase' | 'mask' | 'sw'>;

const FLOOR_TEXTURES = Array.from({ length: 10 }, (_, i) => `tile_floor_${String(i + 1).padStart(2, '0')}`);
const BLOCKER_TEXTURES = ['tile_blocker_01', 'tile_blocker_02', 'tile_blocker_03'];
const GLYPH_TYPES = new Set(['swamp', 'mover', 'portal', 'switch', 'door', 'passage', 'refill']);
/** Glyph text is rasterized above the render resolution so it stays sharp on scaled-up boards. */
const GLYPH_TEXT_OVERSAMPLE = 2;

/** FNV-1a hash: stable across sessions and platforms. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Seeded variant of an authored cell. The seed is the authored cell of the content (not the board
 * cell showing it), so a swapped tile keeps its look while it travels.
 */
function variantTexture(level: CompiledLevel, source: number, textures: readonly string[]): string {
  const cell = level.cells[source];
  return textures[hashString(`${level.id}:${cell.q},${cell.r}`) % textures.length];
}

export interface TileLook {
  /** Identity of the look; equal keys draw identically. */
  key: string;
  content: TileContent;
  collected: boolean;
  doorOpen: boolean;
  switchPressed: boolean;
}

export function tileLook(level: CompiledLevel, cell: number, state: VisualState): TileLook {
  const content = cellContent(level, cell, state.phase);
  const collected = content.type === 'plus1' && plusCollected(level, state, cell);
  const open = doorOpen(level, state, cell);
  const pressed = switchPressed(level, state, cell);

  return {
    key: `${content.source}:${collected ? 1 : 0}${open ? 1 : 0}${pressed ? 1 : 0}`,
    content,
    collected,
    doorOpen: open,
    switchPressed: pressed,
  };
}

function baseTexture(level: CompiledLevel, look: TileLook): string {
  const { content } = look;

  switch (content.type) {
    case 'blocker':
      return variantTexture(level, content.source, BLOCKER_TEXTURES);
    case 'start':
      return 'tile_start';
    case 'finish':
      return 'tile_finish';
    case 'plus1':
      return look.collected ? variantTexture(level, content.source, FLOOR_TEXTURES) : 'tile_plus1';
    case 'launcher':
      return `tile_launcher_${(content.dir ?? 'E').toLowerCase()}`;
    default:
      return variantTexture(level, content.source, FLOOR_TEXTURES);
  }
}

export function createTileSprite(texture: string): Sprite {
  const sprite = Sprite.from(texture);

  sprite.anchor.set(0.5);
  sprite.width = TILE_SPRITE_WIDTH;
  sprite.height = TILE_SPRITE_HEIGHT;
  sprite.rotation = PLACEHOLDER_TILE_ROTATION;

  return sprite;
}

function sharpenText(node: Container, resolution: number) {
  for (const child of node.children) {
    if (child instanceof Text) {
      child.resolution = resolution;
    } else {
      sharpenText(child, resolution);
    }
  }
}

/** Multiplies the resolution of every text under `node` (the render resolution changed). */
export function rescaleText(node: Container, ratio: number) {
  for (const child of node.children) {
    if (child instanceof Text) {
      child.resolution *= ratio;
    } else {
      rescaleText(child, ratio);
    }
  }
}

function glyphFor(look: TileLook): GlyphTile | null {
  const { content } = look;

  if (!GLYPH_TYPES.has(content.type)) {
    return null;
  }

  return {
    type: content.type,
    dir: content.dir,
    color: content.color as GlyphTile['color'],
    pair: content.pair,
    value: content.value,
    noIn: [...content.noIn],
    noOut: [...content.noOut],
    doorOpen: look.doorOpen,
    switchPressed: look.switchPressed,
  };
}

/** Base sprite plus glyph for a look, centred at (0, 0). */
export function createTileBase(level: CompiledLevel, look: TileLook, resolution: number): Container {
  const base = new Container();

  base.addChild(createTileSprite(baseTexture(level, look)));

  const glyphTile = glyphFor(look);
  const glyph = glyphTile === null ? null : createGlyph(glyphTile, TILE_VISUAL_RADIUS);

  if (glyph !== null) {
    sharpenText(glyph, resolution * GLYPH_TEXT_OVERSAMPLE);
    base.addChild(glyph);
  }

  return base;
}

/** Swap marker of a board cell (it stays on the cell while contents trade places), or null. */
export function createCellMarker(level: CompiledLevel, cell: number, resolution: number): Container | null {
  const swap = level.cells[cell].swap;

  if (swap === undefined) {
    return null;
  }

  const marker = createSwapMarker(swap, TILE_VISUAL_RADIUS);
  sharpenText(marker, resolution * GLYPH_TEXT_OVERSAMPLE);
  return marker;
}

/** Floating text used by pickup pops. */
export function createPopText(text: string, color: number, resolution: number): Text {
  const label = new Text({
    text,
    style: {
      fontFamily: 'Comic Neue, Comic Sans MS, Arial, sans-serif',
      fontWeight: '900',
      fontSize: 26,
      fill: color,
      stroke: { color: 0xffffff, width: 5 },
    },
  });

  label.anchor.set(0.5);
  label.resolution = resolution * GLYPH_TEXT_OVERSAMPLE;
  return label;
}
