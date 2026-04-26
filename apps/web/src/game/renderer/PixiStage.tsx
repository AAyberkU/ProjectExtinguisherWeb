import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { axialToPixel, createInitialGameState, getOrderedCells } from '../core';
import type { LevelData, TileType } from '../core';

const PREVIEW_LEVEL: LevelData = {
  id: 'preview_bootstrap',
  name: 'Bootstrap Preview',
  moveLimit: 8,
  start: { q: -4, r: 0 },
  goal: { q: 4, r: 0 },
  cells: [],
};

const TILE_COLORS: Readonly<Record<TileType, { fill: number; stroke: number }>> = {
  path: { fill: 0x31263d, stroke: 0x806b95 },
  start: { fill: 0x6ee7a8, stroke: 0xfff2d6 },
  goal: { fill: 0xff8a5c, stroke: 0xfff2d6 },
  blocked: { fill: 0x25212a, stroke: 0x6c6472 },
  catapult: { fill: 0x5f4cff, stroke: 0xd9d3ff },
  health: { fill: 0x35d0ba, stroke: 0xdcfff8 },
};

function drawHex(graphics: Graphics, radius: number, fill: number, stroke: number) {
  graphics.clear();
  graphics.poly(
    Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index - 30);
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    }).flatMap((point) => [point.x, point.y]),
  );
  graphics.fill({ color: fill, alpha: 0.9 });
  graphics.stroke({ color: stroke, width: 2, alpha: 0.78 });
}

export function PixiStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const mountHost = host;

    let disposed = false;
    let app: Application | null = null;

    async function mount() {
      const nextApp = new Application();
      await nextApp.init({
        antialias: true,
        backgroundAlpha: 0,
        resizeTo: mountHost,
      });

      if (disposed) {
        nextApp.destroy(true);
        return;
      }

      app = nextApp;
      mountHost.appendChild(nextApp.canvas);

      const board = new Container();
      board.label = 'Hex Board Preview';
      nextApp.stage.addChild(board);

      const tileRadius = 36;
      const previewState = createInitialGameState(PREVIEW_LEVEL);

      for (const cell of getOrderedCells(previewState)) {
        const tile = new Graphics();
        const color = TILE_COLORS[cell.tileType];

        drawHex(tile, tileRadius, color.fill, color.stroke);

        const position = axialToPixel(cell.coord, tileRadius + 2);
        tile.x = position.x;
        tile.y = position.y;
        board.addChild(tile);
      }

      const centerBoard = () => {
        board.x = nextApp.renderer.width / 2;
        board.y = nextApp.renderer.height / 2;
        const fit = Math.min(nextApp.renderer.width / 780, nextApp.renderer.height / 620, 1.08);
        board.scale.set(Math.max(0.52, fit));
      };

      centerBoard();
    }

    void mount();

    return () => {
      disposed = true;

      if (app !== null) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  return <div ref={hostRef} className="pixi-stage" />;
}
