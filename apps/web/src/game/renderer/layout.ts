// Board geometry in board units and the fit of the board into the stage.
// Puzzle Lab convention: pointy-top hexes, axial (q, r), r grows downward (docs/rules.md).

import { axialToPixel, type CompiledLevel } from '../engine';

/** Distance unit between cell centres (hex circumradius of the layout grid). */
export const TILE_LAYOUT_RADIUS = 40;
/** Drawn hex radius; slightly smaller than the layout radius so tiles keep a small gap. */
export const TILE_VISUAL_RADIUS = 36.5;
export const TILE_SPRITE_WIDTH = TILE_VISUAL_RADIUS * 2.1;
export const TILE_SPRITE_HEIGHT = TILE_VISUAL_RADIUS * 1.86;
/**
 * The jam tile art is flat-top; rotating it 30 degrees clockwise fits the pointy-top board until
 * pointy-top art replaces it. Set to 0 for art drawn pointy-top. Glyphs are never rotated.
 */
export const PLACEHOLDER_TILE_ROTATION = Math.PI / 6;
/** Half extents of a drawn tile around its centre (the rotated sprite is a pointy-top hex). */
const TILE_HALF_WIDTH = (TILE_SPRITE_WIDTH / 2) * Math.cos(Math.PI / 6);
const TILE_HALF_HEIGHT = TILE_SPRITE_WIDTH / 2;

/** Largest board scale: small boards stay readable without turning comically large. */
const MAX_BOARD_SCALE = 1.6;
const SIDE_MARGIN = 16;
const BOTTOM_MARGIN = 16;

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BoardFit {
  x: number;
  y: number;
  scale: number;
}

export function cellCenter(level: CompiledLevel, cell: number): Point {
  const c = level.cells[cell];
  return axialToPixel(c.q, c.r, TILE_LAYOUT_RADIUS);
}

/** Bounds of every drawn tile in board units. */
export function boardBounds(level: CompiledLevel): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  for (let i = 0; i < level.cellCount; i += 1) {
    const { x, y } = cellCenter(level, i);
    bounds.minX = Math.min(bounds.minX, x - TILE_HALF_WIDTH);
    bounds.maxX = Math.max(bounds.maxX, x + TILE_HALF_WIDTH);
    bounds.minY = Math.min(bounds.minY, y - TILE_HALF_HEIGHT);
    bounds.maxY = Math.max(bounds.maxY, y + TILE_HALF_HEIGHT);
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: -TILE_HALF_WIDTH, minY: -TILE_HALF_HEIGHT, maxX: TILE_HALF_WIDTH, maxY: TILE_HALF_HEIGHT };
  }

  return bounds;
}

/**
 * Fits the board bounds into a stage of `width` x `height` CSS pixels, leaving `topInset` for the
 * HUD and small side and bottom margins.
 */
export function fitBoard(bounds: Bounds, width: number, height: number, topInset: number): BoardFit {
  const top = Math.min(Math.max(0, topInset), height * 0.4);
  const availableWidth = Math.max(1, width - SIDE_MARGIN * 2);
  const availableHeight = Math.max(1, height - top - BOTTOM_MARGIN);
  const boardWidth = bounds.maxX - bounds.minX;
  const boardHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(availableWidth / boardWidth, availableHeight / boardHeight, MAX_BOARD_SCALE);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    scale,
    x: width / 2 - centerX * scale,
    y: top + availableHeight / 2 - centerY * scale,
  };
}

/** The board cell under a board-space point, or -1. */
export function cellAtPoint(level: CompiledLevel, point: Point): number {
  const qf = ((Math.sqrt(3) / 3) * point.x - point.y / 3) / TILE_LAYOUT_RADIUS;
  const rf = ((2 / 3) * point.y) / TILE_LAYOUT_RADIUS;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);

  if (dq > dr && dq > ds) {
    q = -r - s;
  } else if (dr > ds) {
    r = -q - s;
  }

  return level.cellAt(q, r);
}
