// Dev-only preview of every tile look (glyph-preview.html; vite builds only index.html): the board
// art with its code-made variants (floor turns, headings, portal pairs, pressed switches, passage
// crayons) and the code-drawn glyphs. Query: ?zoom=<scale> (default 1.4).

import { Application, Container, Graphics, Text } from 'pixi.js';
import { getRenderResolution, initAssets, loadGameAssets } from './game/assets';
import type { Dir, TileContent } from './game/engine';
import { hexCorners } from './game/renderer/glyphs';
import { TILE_LAYOUT_RADIUS } from './game/renderer/layout';
import { createCellMarker, createTileBase, type TileLook } from './game/renderer/tileArt';

const DIRS: Dir[] = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
const zoom = Number(new URLSearchParams(window.location.search).get('zoom') ?? '1.4') || 1.4;

interface Item {
  name: string;
  content?: Partial<TileContent>;
  look?: Partial<TileLook>;
  swap?: number;
}

const sections: Array<{ title: string; items: Item[] }> = [
  {
    title: 'Tiles',
    items: [
      ...[0, 1, 2, 3, 4, 5].map((turn) => ({ name: `floor turn ${turn}`, look: { floorTurn: turn } })),
      { name: 'start', content: { type: 'start' } },
      { name: 'finish', content: { type: 'finish' } },
      { name: 'swamp', content: { type: 'swamp' } },
      { name: 'blocker', content: { type: 'blocker' } },
      { name: 'plus1', content: { type: 'plus1' } },
      { name: 'plus1 collected', content: { type: 'plus1' }, look: { collected: true } },
    ],
  },
  { title: 'Launcher', items: DIRS.map((dir) => ({ name: `launcher ${dir}`, content: { type: 'launcher', dir } })) },
  { title: 'Mover', items: DIRS.map((dir) => ({ name: `mover ${dir}`, content: { type: 'mover', dir } })) },
  {
    title: 'Portal, switch, door',
    items: [
      ...[1, 2, 3].map((pair) => ({ name: `portal ${pair}`, content: { type: 'portal' as const, pair } })),
      ...[1, 2, 3].flatMap((color) => [
        { name: `switch ${color}`, content: { type: 'switch' as const, color } },
        { name: `switch ${color} pressed`, content: { type: 'switch' as const, color }, look: { switchPressed: true } },
      ]),
      ...[1, 2, 3].flatMap((color) => [
        { name: `door ${color}`, content: { type: 'door' as const, color } },
        { name: `door ${color} open`, content: { type: 'door' as const, color }, look: { doorOpen: true } },
      ]),
    ],
  },
  {
    title: 'Passage, refill, swap',
    items: [
      ...DIRS.map((dir) => ({ name: `closed ${dir}`, content: { type: 'passage' as const, noIn: [dir], noOut: [dir] } })),
      { name: 'closed all', content: { type: 'passage', noIn: DIRS, noOut: DIRS } },
      { name: 'noIn E (out)', content: { type: 'passage', noIn: ['E'] } },
      { name: 'noOut SW (in)', content: { type: 'passage', noOut: ['SW'] } },
      { name: 'mixed', content: { type: 'passage', noIn: ['E', 'W', 'NE'], noOut: ['E', 'W', 'SE'] } },
      ...[1, 5, 14, 99].map((value) => ({ name: `refill ${value}`, content: { type: 'refill' as const, value } })),
      { name: 'swap 1', swap: 1 },
      { name: 'swap 2 launcher', swap: 2, content: { type: 'launcher', dir: 'SE' } },
    ],
  },
];

await initAssets();
await loadGameAssets();
await document.fonts?.ready;

const cols = 8;
const cw = TILE_LAYOUT_RADIUS * 2.2 * zoom;
const ch = TILE_LAYOUT_RADIUS * 2.6 * zoom;
const titleHeight = 28;
const rows = sections.reduce((sum, section) => sum + Math.ceil(section.items.length / cols), 0);
const resolution = getRenderResolution();
const app = new Application();
await app.init({
  width: cols * cw + 20,
  height: rows * ch + sections.length * titleHeight + 20,
  background: 0xf4dfe9,
  antialias: true,
  resolution,
  autoDensity: true,
});
document.body.appendChild(app.canvas);

let y = 10;

for (const section of sections) {
  const title = new Text({ text: section.title, style: { fontSize: 16, fontWeight: '700', fill: 0x3a2350, fontFamily: 'Arial' } });
  title.position.set(14, y + 4);
  app.stage.addChild(title);
  y += titleHeight;

  section.items.forEach((item, i) => {
    const cell = new Container();
    const tile = new Container();
    const content: TileContent = { type: 'floor', noIn: [], noOut: [], source: 0, ...item.content };
    const look: TileLook = {
      key: item.name,
      content,
      collected: false,
      doorOpen: false,
      switchPressed: false,
      carGone: false,
      floorTurn: i % 6,
      ...item.look,
    };

    cell.position.set(10 + (i % cols) * cw + cw / 2, y + Math.floor(i / cols) * ch + TILE_LAYOUT_RADIUS * zoom);
    tile.scale.set(zoom);
    tile.addChild(new Graphics().poly(hexCorners(TILE_LAYOUT_RADIUS)).stroke({ width: 1, color: 0xc9a8c0 }));
    tile.addChild(createTileBase(look, resolution * zoom));

    if (item.swap !== undefined) {
      // The marker belongs to a board cell; a one-cell stand-in level carries the swap id.
      const marker = createCellMarker({ cells: [{ q: 0, r: 0, swap: item.swap }] } as never, 0, resolution * zoom);
      if (marker !== null) tile.addChild(marker);
    }

    const label = new Text({ text: item.name, style: { fontSize: 12, fill: 0x3a2350, fontFamily: 'Arial' } });
    label.anchor.set(0.5, 0);
    label.position.set(0, TILE_LAYOUT_RADIUS * zoom + 2);
    cell.addChild(tile, label);
    app.stage.addChild(cell);
  });

  y += Math.ceil(section.items.length / cols) * ch;
}

(window as unknown as { __ready: boolean }).__ready = true;
