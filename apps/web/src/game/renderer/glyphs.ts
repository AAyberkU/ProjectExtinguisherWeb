// Code-drawn glyphs for what has no art yet: refill values, one-way passage arrows, and swap
// markers. Everything else on the board is drawn from the artist's art (tileArt.ts).

import { Container, Graphics, Text } from 'pixi.js';

export type GlyphDir = 'E' | 'SE' | 'SW' | 'W' | 'NW' | 'NE';

export interface GlyphTile {
  type: 'passage' | 'refill';
  value?: number;
  noIn?: readonly GlyphDir[];
  noOut?: readonly GlyphDir[];
}

/** Screen angles in degrees (y grows downward). */
export const DIR_ANGLE_DEG: Record<GlyphDir, number> = {
  E: 0, SE: 60, SW: 120, W: 180, NW: 240, NE: 300,
};

const DIRS: GlyphDir[] = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
const RAD = Math.PI / 180;

const COL = {
  purple: 0x9e77dc,
  green: 0x42b079,
  orange: 0xeea743,
  white: 0xffffff,
};

/** Flat [x0,y0,...] pointy-top hex corners (angles -90, -30, 30, 90, 150, 210). */
export function hexCorners(radius: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (-90 + 60 * i) * RAD;
    out.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return out;
}

const GLYPH_TEXT_RESOLUTION = 8;

function label(text: string, size: number, color: number, stroke?: number): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: 'Comic Neue, Arial, sans-serif',
      fontWeight: '900',
      fontSize: Math.max(8, Math.round(size)),
      fill: color,
      ...(stroke !== undefined ? { stroke: { color: stroke, width: Math.max(2, size / 7) } } : {}),
    },
  });
  // Boards scale up to about 3x on small maps and screens render at up to 3x DPR, so glyph text is
  // rasterized at a high resolution to stay sharp.
  t.resolution = GLYPH_TEXT_RESOLUTION;
  t.anchor.set(0.5);
  return t;
}

function dottedCircle(g: Graphics, r: number, dots: number, dotR: number): void {
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    g.circle(Math.cos(a) * r, Math.sin(a) * r, dotR);
  }
}

/**
 * One-way passage sides: an arrow pointing the allowed way. Sides closed both ways are drawn as
 * crayon art by tileArt.ts, not here.
 */
function passageArrows(r: number, noIn: readonly GlyphDir[], noOut: readonly GlyphDir[]): Container | null {
  const sides = DIRS.filter((d) => noIn.includes(d) !== noOut.includes(d));
  if (sides.length === 0) return null;
  const apothem = r * Math.cos(Math.PI / 6);
  const draw = (g: Graphics) => {
    for (const d of sides) {
      const a = DIR_ANGLE_DEG[d] * RAD;
      const nx = Math.cos(a), ny = Math.sin(a);
      const tx = -ny, ty = nx;
      // noIn only -> may only leave (arrow points out); noOut only -> may only enter (arrow points in)
      const sgn = noIn.includes(d) ? 1 : -1;
      const base = apothem - r * 0.42, tip = apothem - r * 0.05;
      const bx = nx * base, by = ny * base, px = nx * tip, py = ny * tip;
      const head = r * 0.18;
      const sx = sgn > 0 ? bx : px, sy = sgn > 0 ? by : py;
      const ex = sgn > 0 ? px : bx, ey = sgn > 0 ? py : by;
      g.moveTo(sx, sy).lineTo(ex, ey);
      g.moveTo(ex - sgn * nx * head + tx * head, ey - sgn * ny * head + ty * head)
        .lineTo(ex, ey)
        .lineTo(ex - sgn * nx * head - tx * head, ey - sgn * ny * head - ty * head);
    }
    return g;
  };
  // A dark outline under the arrows keeps them readable on the purple floor.
  const outline = draw(new Graphics()).stroke({ width: Math.max(5, r * 0.2), color: 0x2b0d4f, alpha: 0.75, cap: 'round', join: 'round' });
  const arrows = draw(new Graphics()).stroke({ width: Math.max(3, r * 0.12), color: COL.orange, cap: 'round', join: 'round' });
  const c = new Container();
  c.addChild(outline, arrows);
  return c;
}

function refill(r: number, value: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, r * 0.52).fill({ color: COL.white, alpha: 0.55 }).stroke({ width: Math.max(3, r * 0.1), color: COL.green });
  c.addChild(g);
  const s = String(value);
  c.addChild(label(s, r * (s.length > 2 ? 0.4 : s.length > 1 ? 0.5 : 0.6), 0x2f7d58, COL.white));
  return c;
}

/** Dotted ring + numbered badge (top-right) for cells carrying a swap id. */
export function createSwapMarker(swapId: number, radius: number): Container {
  const c = new Container();
  const g = new Graphics();
  dottedCircle(g, radius * 0.78, 18, Math.max(1.5, radius * 0.05));
  g.fill({ color: 0xf3ecff, alpha: 0.95 }).stroke({ width: Math.max(1, radius * 0.02), color: COL.purple });
  c.addChild(g);
  const bx = radius * 0.5, by = -radius * 0.55, br = radius * 0.24;
  const b = new Graphics();
  b.circle(bx, by, br).fill({ color: COL.purple }).stroke({ width: Math.max(1.5, radius * 0.04), color: COL.white });
  c.addChild(b);
  const t = label(String(swapId), br * 1.3, COL.white);
  t.position.set(bx, by);
  c.addChild(t);
  return c;
}

/** Build a glyph centred at (0,0) for a pointy-top hex of circumradius `radius`, or null. */
export function createGlyph(tile: GlyphTile, radius: number): Container | null {
  switch (tile.type) {
    case 'passage': return passageArrows(radius, tile.noIn ?? [], tile.noOut ?? []);
    case 'refill': return refill(radius, tile.value ?? 0);
    default: return null;
  }
}
