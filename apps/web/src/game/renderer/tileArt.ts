// What a cell looks like: the floor tile (or a full start/finish tile), the object art on top, and
// code-drawn glyphs for what has no art yet (refill values, one-way passage arrows, swap markers).
// Pure lookups over the engine; no gameplay decisions.

import { ColorMatrixFilter, Container, Sprite, Text, Texture } from 'pixi.js';
import {
  cellContent,
  doorOpen,
  plusCollected,
  switchPressed,
  type CompiledLevel,
  type Dir,
  type PlayState,
  type TileContent,
  type TileType,
} from '../engine';
import { createGlyph, createSwapMarker, DIR_ANGLE_DEG, type GlyphTile } from './glyphs';
import { TILE_SPRITE_HEIGHT, TILE_VISUAL_RADIUS } from './layout';

/** The parts of the play state that change how tiles look. */
export type VisualState = Pick<PlayState, 'phase' | 'mask' | 'sw'>;

const RAD = Math.PI / 180;
const FLOOR_TEXTURE = 'tile_floor';
/** Full hex tiles drawn instead of the floor. */
const FULL_TILE_TEXTURES: Partial<Record<TileType, string>> = { start: 'tile_start', finish: 'tile_finish' };
/** Art drawn on top of the floor. Switches and doors add their colour and state to the alias. */
const OBJECT_TEXTURES: Partial<Record<TileType, string>> = {
  swamp: 'tile_swamp',
  blocker: 'obj_blocker',
  plus1: 'obj_plus1',
  launcher: 'obj_launcher',
  mover: 'obj_mover',
  portal: 'obj_portal',
  switch: 'obj_switch',
  door: 'obj_door',
};
const PASSAGE_WALL_TEXTURE = 'obj_passage_wall';
/** Editor colours 1-3 map to the art's a (blue), b (pink), and c (green). */
const COLOR_SUFFIXES = ['a', 'b', 'c'];
const SWITCH_BUTTON_LABEL = 'Switch Button';

/** Floor variety: the one floor tile turned in seeded 60-degree steps, so it stays pointy-top. */
const FLOOR_TURNS = 6;

/**
 * Screen headings (degrees, as DIR_ANGLE_DEG) the delivered drawings face, measured from the art:
 * the duck's body axis toward its beak and the car's axis toward its windscreen and longer bonnet
 * (both roughly NW). Turning by (direction - heading) makes them face any direction.
 */
const LAUNCHER_ART_HEADING_DEG = 237;
const MOVER_ART_HEADING_DEG = 238;

/**
 * Portal pairs: hue turns of the rainbow toy, so pair 1 keeps its red centre and pairs 2 and 3 get
 * a green and a blue one. Both ends of a pair look the same; pair ids above 3 repeat the cycle.
 */
const PORTAL_PAIR_HUES = [0, 120, 240];

/** Pressed switch, made in code: the button squashes into its base and darkens. */
const SWITCH_PRESSED_SCALE_Y = 0.62;
const SWITCH_PRESSED_SHADE = 0.7;

/** Distance between a passage crayon and the tile edge, as a share of the tile's apothem. */
const PASSAGE_WALL_INSET = 0.1;

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

export interface TileLook {
  /** Identity of the look; equal keys draw identically. */
  key: string;
  content: TileContent;
  collected: boolean;
  doorOpen: boolean;
  switchPressed: boolean;
  /** Seeded floor turn (0 to FLOOR_TURNS - 1). */
  floorTurn: number;
}

export function tileLook(level: CompiledLevel, cell: number, state: VisualState): TileLook {
  const content = cellContent(level, cell, state.phase);
  const collected = content.type === 'plus1' && plusCollected(level, state, cell);
  const open = doorOpen(level, state, cell);
  const pressed = switchPressed(level, state, cell);
  // Seeded by the authored cell of the content (not the board cell showing it), so a swapped tile
  // keeps its look while it travels.
  const source = level.cells[content.source];

  return {
    key: `${content.source}:${collected ? 1 : 0}${open ? 1 : 0}${pressed ? 1 : 0}`,
    content,
    collected,
    doorOpen: open,
    switchPressed: pressed,
    floorTurn: hashString(`${level.id}:${source.q},${source.r}`) % FLOOR_TURNS,
  };
}

/**
 * Board units per texture unit. All board art shares the floor's drawing scale (the asset build
 * keeps the authored relative sizes), so every piece is placed at its texture size times this.
 */
function artScale(): number {
  return TILE_SPRITE_HEIGHT / Math.max(1, Texture.from(FLOOR_TEXTURE).height);
}

function artSprite(alias: string): Sprite {
  const sprite = Sprite.from(alias);

  sprite.anchor.set(0.5);
  sprite.scale.set(artScale());
  return sprite;
}

function headingRotation(dir: Dir | undefined, artHeading: number): number {
  return (DIR_ANGLE_DEG[dir ?? 'E'] - artHeading) * RAD;
}

const portalFilters = new Map<number, ColorMatrixFilter>();

function portalFilter(pair: number | undefined): ColorMatrixFilter | null {
  const hue = PORTAL_PAIR_HUES[(Math.max(1, pair ?? 1) - 1) % PORTAL_PAIR_HUES.length];

  if (hue === 0) {
    return null;
  }

  let filter = portalFilters.get(hue);

  if (filter === undefined) {
    // 'inherit' renders the filter at the board's resolution, so the portal stays sharp.
    filter = new ColorMatrixFilter({ resolution: 'inherit', antialias: 'inherit' });
    filter.hue(hue, false);
    portalFilters.set(hue, filter);
  }

  return filter;
}

/** Sets how far a switch button is pressed in (0 up, 1 pressed); the press animation tweens it. */
export function setSwitchPress(button: Sprite, amount: number) {
  const scale = artScale();
  const shade = Math.round(255 * (1 - (1 - SWITCH_PRESSED_SHADE) * amount));

  button.scale.set(scale, scale * (1 - (1 - SWITCH_PRESSED_SCALE_Y) * amount));
  button.tint = (shade << 16) | (shade << 8) | shade;
}

/** The switch button of a tile base built by `createTileBase`, or null. */
export function findSwitchButton(base: Container): Sprite | null {
  const button = base.getChildByLabel(SWITCH_BUTTON_LABEL);
  return button instanceof Sprite ? button : null;
}

function objectSprite(look: TileLook): Sprite | null {
  const { content } = look;
  const alias = OBJECT_TEXTURES[content.type];

  if (alias === undefined || (content.type === 'plus1' && look.collected)) {
    return null;
  }

  const color = COLOR_SUFFIXES[(content.color ?? 1) - 1] ?? COLOR_SUFFIXES[0];

  switch (content.type) {
    case 'launcher': {
      const sprite = artSprite(alias);
      sprite.rotation = headingRotation(content.dir, LAUNCHER_ART_HEADING_DEG);
      return sprite;
    }
    case 'mover': {
      const sprite = artSprite(alias);
      sprite.rotation = headingRotation(content.dir, MOVER_ART_HEADING_DEG);
      return sprite;
    }
    case 'portal': {
      const sprite = artSprite(alias);
      const filter = portalFilter(content.pair);
      if (filter !== null) sprite.filters = [filter];
      return sprite;
    }
    case 'switch': {
      // Anchored at the bottom so a press squashes the button down into its base.
      const sprite = artSprite(`${alias}_${color}`);
      sprite.label = SWITCH_BUTTON_LABEL;
      sprite.anchor.set(0.5, 1);
      sprite.y = (sprite.texture.height * artScale()) / 2;
      setSwitchPress(sprite, look.switchPressed ? 1 : 0);
      return sprite;
    }
    case 'door':
      return artSprite(`${alias}_${color}_${look.doorOpen ? 'open' : 'closed'}`);
    default:
      return artSprite(alias);
  }
}

/** A crayon along every side closed both ways, just inside the tile edge. */
function passageWalls(content: TileContent): Sprite[] {
  const scale = artScale();
  // The floor art is pointy-top, so its width spans two apothems.
  const apothem = (Texture.from(FLOOR_TEXTURE).width * scale) / 2;
  const walls: Sprite[] = [];

  for (const dir of content.noIn) {
    if (!content.noOut.includes(dir)) {
      continue;
    }

    const wall = artSprite(PASSAGE_WALL_TEXTURE);
    const angle = DIR_ANGLE_DEG[dir];
    const distance = apothem * (1 - PASSAGE_WALL_INSET) - (wall.texture.width * scale) / 2;

    wall.position.set(Math.cos(angle * RAD) * distance, Math.sin(angle * RAD) * distance);
    // The crayon is drawn upright, along the E and W sides. Turning it by the side's angle folded
    // into -90..90 degrees lays it along any side and keeps its label from reading upside down.
    wall.rotation = ((((angle + 90) % 180) - 90) * RAD);
    walls.push(wall);
  }

  return walls;
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

function glyphFor(content: TileContent): GlyphTile | null {
  switch (content.type) {
    case 'refill':
      return { type: 'refill', value: content.value };
    case 'passage':
      return { type: 'passage', noIn: content.noIn, noOut: content.noOut };
    default:
      return null;
  }
}

/** Tile, object art, and glyph for a look, centred at (0, 0). */
export function createTileBase(look: TileLook, resolution: number): Container {
  const base = new Container();
  const { content } = look;
  const fullTile = FULL_TILE_TEXTURES[content.type];

  if (fullTile !== undefined) {
    base.addChild(artSprite(fullTile));
  } else {
    const floor = artSprite(FLOOR_TEXTURE);
    floor.rotation = look.floorTurn * 60 * RAD;
    base.addChild(floor);
  }

  const object = objectSprite(look);

  if (object !== null) {
    base.addChild(object);
  }

  if (content.type === 'passage') {
    for (const wall of passageWalls(content)) {
      base.addChild(wall);
    }
  }

  const glyphTile = glyphFor(content);
  const glyph = glyphTile === null ? null : createGlyph(glyphTile, TILE_VISUAL_RADIUS);

  if (glyph !== null) {
    sharpenText(glyph, resolution * GLYPH_TEXT_OVERSAMPLE);
    base.addChild(glyph);
  }

  return base;
}

/** The +1 object alone (no floor), for the pickup ghost. */
export function createPlusGhost(): Sprite {
  return artSprite(OBJECT_TEXTURES.plus1 ?? 'obj_plus1');
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
