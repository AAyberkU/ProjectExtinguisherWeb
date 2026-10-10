import { Container, Graphics, Text } from 'pixi.js';

export type GlyphDir = 'E' | 'SE' | 'SW' | 'W' | 'NW' | 'NE';

export interface GlyphTile {
  type:
    | 'swamp' | 'mover' | 'portal' | 'switch' | 'door' | 'passage' | 'refill'
    | 'plus1' | 'launcher' | 'finish' | 'start' | 'floor' | 'blocker';
  dir?: GlyphDir;
  color?: 1 | 2 | 3;
  pair?: number;
  value?: number;
  noIn?: GlyphDir[];
  noOut?: GlyphDir[];
  swap?: number;
  doorOpen?: boolean;
  switchPressed?: boolean;
  collected?: boolean;
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
  wall: 0x524f5a,
  white: 0xffffff,
  swamp: 0x6f7f3a,
};
const SWITCH_COLORS: Record<number, number> = { 1: 0xe5577f, 2: 0x3ea6c8, 3: 0xe8b53a };
const PAIR_COLORS = [0xe5577f, 0x3ea6c8, 0x7bc043, 0xb86ad9, 0xf0883e];
const LETTER = ['', 'A', 'B', 'C'];

/** Flat [x0,y0,...] pointy-top hex corners (angles -90, -30, 30, 90, 150, 210). */
export function hexCorners(radius: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (-90 + 60 * i) * RAD;
    out.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return out;
}

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
  t.anchor.set(0.5);
  return t;
}

function dashedPoly(g: Graphics, pts: number[], dash: number, gap: number): void {
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1];
    const x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(d + dash, len);
      g.moveTo(x0 + ux * d, y0 + uy * d).lineTo(x0 + ux * e, y0 + uy * e);
    }
  }
}

function dottedCircle(g: Graphics, r: number, dots: number, dotR: number): void {
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    g.circle(Math.cos(a) * r, Math.sin(a) * r, dotR);
  }
}

function chevron(g: Graphics, cx: number, s: number): void {
  g.moveTo(cx - s * 0.5, -s).lineTo(cx + s * 0.5, 0).lineTo(cx - s * 0.5, s);
}

function swamp(r: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.poly(hexCorners(r * 0.94)).fill({ color: COL.swamp, alpha: 0.5 });
  c.addChild(g);
  const w = new Graphics();
  for (const dy of [-0.3, 0, 0.3]) {
    const y = dy * r, half = r * 0.25, amp = r * 0.09;
    w.moveTo(-half * 2, y);
    for (let k = 0; k < 2; k++) {
      const x0 = -half * 2 + k * half * 2;
      w.bezierCurveTo(x0 + half * 0.5, y - amp * 2.5, x0 + half, y - amp * 2.5, x0 + half, y)
        .bezierCurveTo(x0 + half, y + amp * 2.5, x0 + half * 1.5, y + amp * 2.5, x0 + half * 2, y);
    }
  }
  w.stroke({ width: Math.max(2, r * 0.07), color: 0xe9f2b8, alpha: 0.9, cap: 'round', join: 'round' });
  c.addChild(w);
  return c;
}

function mover(r: number, dir: GlyphDir): Container {
  const c = new Container();
  const s = r * 0.3;
  const w = Math.max(3, r * 0.13);
  // Dark outline under light chevrons: readable on light editor tiles and on the dark jam floor.
  const outline = new Graphics();
  chevron(outline, -s * 0.9, s);
  chevron(outline, s * 0.9, s);
  outline.stroke({ width: w + Math.max(3, r * 0.1), color: 0x2b0d4f, alpha: 0.85, cap: 'round', join: 'round' });
  const g = new Graphics();
  chevron(g, -s * 0.9, s);
  chevron(g, s * 0.9, s);
  g.stroke({ width: w, color: 0xf3ecff, cap: 'round', join: 'round' });
  c.addChild(outline, g);
  c.rotation = DIR_ANGLE_DEG[dir] * RAD;
  return c;
}

function portal(r: number, pair: number): Container {
  const c = new Container();
  const col = PAIR_COLORS[(Math.max(1, pair) - 1) % PAIR_COLORS.length];
  const g = new Graphics();
  g.circle(0, 0, r * 0.62).fill({ color: col, alpha: 0.18 }).stroke({ width: Math.max(2, r * 0.09), color: col });
  g.circle(0, 0, r * 0.42).stroke({ width: Math.max(2, r * 0.07), color: col });
  c.addChild(g);
  c.addChild(label(String(pair), r * 0.55, col, COL.white));
  return c;
}

function switchGlyph(r: number, color: number, pressed: boolean): Container {
  const c = new Container();
  const col = SWITCH_COLORS[color] ?? SWITCH_COLORS[1];
  if (pressed) {
    const dots = new Graphics();
    dottedCircle(dots, r * 0.4, 12, Math.max(1.5, r * 0.05));
    dots.fill({ color: col, alpha: 0.9 });
    c.addChild(dots);
    c.addChild(label(LETTER[color] ?? 'A', r * 0.4, col));
    c.alpha = 0.8;
  } else {
    const g = new Graphics();
    g.circle(0, 0, r * 0.42).fill({ color: col }).stroke({ width: Math.max(2, r * 0.07), color: COL.white });
    c.addChild(g);
    c.addChild(label(LETTER[color] ?? 'A', r * 0.5, COL.white));
  }
  return c;
}

function door(r: number, color: number, open: boolean): Container {
  const c = new Container();
  const col = SWITCH_COLORS[color] ?? SWITCH_COLORS[1];
  const g = new Graphics();
  if (open) {
    dashedPoly(g, hexCorners(r * 0.86), r * 0.14, r * 0.1);
    g.stroke({ width: Math.max(2, r * 0.06), color: COL.wall, alpha: 0.8 });
    c.addChild(g);
    const t = label(LETTER[color] ?? 'A', r * 0.6, col);
    t.alpha = 0.4;
    c.addChild(t);
  } else {
    g.poly(hexCorners(r * 0.92)).fill({ color: COL.wall });
    g.roundRect(-r * 0.62, -r * 0.4, r * 1.24, r * 0.8, r * 0.14)
      .fill({ color: 0x3b3942 }).stroke({ width: Math.max(2, r * 0.06), color: col });
    c.addChild(g);
    c.addChild(label(LETTER[color] ?? 'A', r * 0.6, col, 0x2b2a31));
  }
  return c;
}

function passage(r: number, noIn: GlyphDir[], noOut: GlyphDir[]): Container | null {
  const bars = new Graphics();
  const arrows = new Graphics();
  const apothem = r * Math.cos(Math.PI / 6);
  const w = Math.max(3, r * 0.14);
  let any = false;
  for (const d of DIRS) {
    const i = noIn.includes(d), o = noOut.includes(d);
    if (!i && !o) continue;
    any = true;
    const a = DIR_ANGLE_DEG[d] * RAD;
    const nx = Math.cos(a), ny = Math.sin(a);
    const tx = -ny, ty = nx;
    if (i && o) {
      const e = r * 0.42, inset = apothem - w * 0.6;
      bars.moveTo(nx * inset - tx * e, ny * inset - ty * e).lineTo(nx * inset + tx * e, ny * inset + ty * e);
    } else {
      // noIn only -> may only leave (arrow points out); noOut only -> may only enter (arrow points in)
      const sgn = i ? 1 : -1;
      const base = apothem - r * 0.42, tip = apothem - r * 0.05;
      const bx = nx * base, by = ny * base, px = nx * tip, py = ny * tip;
      const head = r * 0.18;
      const sx = sgn > 0 ? bx : px, sy = sgn > 0 ? by : py;
      const ex = sgn > 0 ? px : bx, ey = sgn > 0 ? py : by;
      arrows.moveTo(sx, sy).lineTo(ex, ey);
      arrows.moveTo(ex - sgn * nx * head + tx * head, ey - sgn * ny * head + ty * head)
        .lineTo(ex, ey)
        .lineTo(ex - sgn * nx * head - tx * head, ey - sgn * ny * head - ty * head);
    }
  }
  if (!any) return null;
  bars.stroke({ width: w, color: COL.wall, cap: 'round' });
  arrows.stroke({ width: Math.max(3, r * 0.12), color: COL.orange, cap: 'round', join: 'round' });
  const c = new Container();
  c.addChild(bars, arrows);
  return c;
}

function refill(r: number, value: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, r * 0.52).fill({ color: COL.green, alpha: 0.25 }).stroke({ width: Math.max(3, r * 0.1), color: COL.green });
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
    case 'swamp': return swamp(radius);
    case 'mover': return mover(radius, tile.dir ?? 'E');
    case 'portal': return portal(radius, tile.pair ?? 1);
    case 'switch': return switchGlyph(radius, tile.color ?? 1, !!tile.switchPressed);
    case 'door': return door(radius, tile.color ?? 1, !!tile.doorOpen);
    case 'passage': return passage(radius, tile.noIn ?? [], tile.noOut ?? []);
    case 'refill': return refill(radius, tile.value ?? 0);
    default: return null;
  }
}
