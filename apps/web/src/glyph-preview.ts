import { Application, Container, Graphics, Text } from 'pixi.js';
import { createGlyph, createSwapMarker, hexCorners, type GlyphTile } from './game/renderer/glyphs';

const R = 44;
const items: { name: string; tile?: GlyphTile; swap?: number }[] = [
  { name: 'swamp', tile: { type: 'swamp' } },
  ...(['E', 'SE', 'SW', 'W', 'NW', 'NE'] as const).map((d) => ({ name: `mover ${d}`, tile: { type: 'mover', dir: d } as GlyphTile })),
  ...[1, 2, 3, 4].map((p) => ({ name: `portal ${p}`, tile: { type: 'portal', pair: p } as GlyphTile })),
  ...([1, 2, 3] as const).flatMap((c) => [
    { name: `switch ${c}`, tile: { type: 'switch', color: c } as GlyphTile },
    { name: `switch ${c} on`, tile: { type: 'switch', color: c, switchPressed: true } as GlyphTile },
  ]),
  ...([1, 2, 3] as const).flatMap((c) => [
    { name: `door ${c}`, tile: { type: 'door', color: c } as GlyphTile },
    { name: `door ${c} open`, tile: { type: 'door', color: c, doorOpen: true } as GlyphTile },
  ]),
  { name: 'pass bar E', tile: { type: 'passage', noIn: ['E'], noOut: ['E'] } },
  { name: 'pass bar NW', tile: { type: 'passage', noIn: ['NW'], noOut: ['NW'] } },
  { name: 'noIn E (out)', tile: { type: 'passage', noIn: ['E'] } },
  { name: 'noOut SW (in)', tile: { type: 'passage', noOut: ['SW'] } },
  { name: 'multi', tile: { type: 'passage', noIn: ['E', 'W', 'NE'], noOut: ['E', 'W', 'SE'] } },
  ...[1, 5, 14, 99].map((v) => ({ name: `refill ${v}`, tile: { type: 'refill', value: v } as GlyphTile })),
  { name: 'swap 1', swap: 1 },
  { name: 'swap 2', swap: 2 },
];

const cols = 8;
const cw = R * 2.2, ch = R * 2.4;
const app = new Application();
await app.init({ width: cols * cw + 20, height: Math.ceil(items.length / cols) * ch + 20, background: 0x2a2733, antialias: true, resolution: 1 });
document.body.appendChild(app.canvas);
await document.fonts?.ready;

items.forEach((it, i) => {
  const cell = new Container();
  cell.position.set(10 + (i % cols) * cw + cw / 2, 10 + Math.floor(i / cols) * ch + R * 1.1);
  cell.addChild(new Graphics().poly(hexCorners(R)).fill(0xf1e9fb).stroke({ width: 2, color: 0xb9a8d8 }));
  if (it.tile) {
    const g = createGlyph(it.tile, R);
    if (g) cell.addChild(g);
  }
  if (it.swap !== undefined) cell.addChild(createSwapMarker(it.swap, R));
  const t = new Text({ text: it.name, style: { fontSize: 12, fill: 0xdddddd, fontFamily: 'Arial' } });
  t.anchor.set(0.5, 0);
  t.position.set(0, R + 4);
  cell.addChild(t);
  app.stage.addChild(cell);
});
(window as unknown as { __ready: boolean }).__ready = true;
