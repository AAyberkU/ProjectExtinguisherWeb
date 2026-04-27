import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js';
import { axialToPixel, canActivateCell, coordsEqual, getOrderedCells } from '../core';
import type { AxialCoord, CatapultDirection, CellState, GameState, TileType } from '../core';

type PixiStageProps = Readonly<{
  gameState: GameState;
  introKey: number;
  movementPath: readonly AxialCoord[] | null;
  onActivateCell: (coord: AxialCoord) => void;
}>;

const TILE_RADIUS = 42;
const TILE_SPRITE_WIDTH = TILE_RADIUS * 2.1;
const TILE_SPRITE_HEIGHT = TILE_RADIUS * 1.86;
const LARRY_SPRITE_HEIGHT = TILE_RADIUS * 1.55;
const LARRY_MOVE_DURATION_MS = 220;
const LARRY_HOP_HEIGHT = TILE_RADIUS * 0.52;
const TILE_INTRO_DROP_OFFSET = TILE_RADIUS * 9;
const TILE_INTRO_FALL_DURATION_MS = 34;
const TILE_INTRO_LINE_DELAY_MS = 5;

type AnimationCleanup = () => void;

type RenderBoardOptions = Readonly<{
  app: Application;
  previousLarryPosition: AxialCoord | null;
  larryPath: readonly AxialCoord[] | null;
  animateLarry: boolean;
  playTileIntro: boolean;
  registerAnimation: (cleanup: AnimationCleanup) => void;
}>;

const PATH_TILE_TEXTURE_URLS = [
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_01.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_02.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_03.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_04.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_05.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_06.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_07.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_08.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_09.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Path_10.png', import.meta.url).href,
] as const;

const BLOCKED_TILE_TEXTURE_URLS = [
  new URL('../../../../../Art/Tiles/Hex/HexTile_Blocked_01.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Blocked_02.png', import.meta.url).href,
  new URL('../../../../../Art/Tiles/Hex/HexTile_Blocked_03.png', import.meta.url).href,
] as const;

const CATAPULT_TILE_TEXTURE_URLS: Readonly<Record<CatapultDirection, string>> = {
  E: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_E.png', import.meta.url).href,
  NE: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_NE.png', import.meta.url).href,
  NW: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_NW.png', import.meta.url).href,
  W: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_W.png', import.meta.url).href,
  SW: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_SW.png', import.meta.url).href,
  SE: new URL('../../../../../Art/Tiles/Hex/HexTile_Catapult_SE.png', import.meta.url).href,
};

const SINGLE_TILE_TEXTURE_URLS: Readonly<Record<Exclude<TileType, 'path' | 'blocked' | 'catapult'>, string>> = {
  start: new URL('../../../../../Art/Tiles/Hex/HexTile_Start.png', import.meta.url).href,
  goal: new URL('../../../../../Art/Tiles/Hex/HexTile_Goal.png', import.meta.url).href,
  health: new URL('../../../../../Art/Tiles/Hex/HexTile_Health.png', import.meta.url).href,
};

const LARRY_TEXTURE_URL = new URL('../../../../../Art/Characters/Larry/LarrySprite.png', import.meta.url).href;
const TILE_TEXTURE_URLS = [
  ...PATH_TILE_TEXTURE_URLS,
  ...BLOCKED_TILE_TEXTURE_URLS,
  ...Object.values(CATAPULT_TILE_TEXTURE_URLS),
  ...Object.values(SINGLE_TILE_TEXTURE_URLS),
  LARRY_TEXTURE_URL,
];

const VALID_STROKE = 0xffcf7a;
const ACTIVE_STROKE = 0xfff2d6;
const CURRENT_STROKE = 0x35d0ba;

function drawFlatTopHex(graphics: Graphics, radius: number, stroke: number, alpha: number, width = 3) {
  graphics.clear();
  graphics.poly(
    Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index);
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    }).flatMap((point) => [point.x, point.y]),
  );

  if (alpha > 0) {
    graphics.stroke({ color: stroke, width, alpha });
  }
}

function centerBoard(app: Application, board: Container) {
  board.x = app.renderer.width / 2;
  board.y = app.renderer.height / 2 + app.renderer.height * 0.03;

  const fit = Math.min(app.renderer.width / 920, app.renderer.height / 760, 1.45);
  board.scale.set(Math.max(0.52, fit));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeIntroDrop(t: number): number {
  return 1 - (1 - t) ** 2.6;
}

function resolveIntroLineSpacing(projections: readonly number[]): number {
  const sorted = [...projections].sort((a, b) => a - b);
  let smallestSpacing = Number.POSITIVE_INFINITY;

  for (let index = 1; index < sorted.length; index += 1) {
    const spacing = sorted[index] - sorted[index - 1];

    if (spacing > 0.01) {
      smallestSpacing = Math.min(smallestSpacing, spacing);
    }
  }

  return Number.isFinite(smallestSpacing) ? smallestSpacing : 1;
}

function resolveVariantIndex(cell: CellState, fallbackIndex: number, variantCount: number): number {
  return positiveModulo(cell.variant ?? fallbackIndex, variantCount);
}

function resolveTileTextureUrl(cell: CellState, pathIndex: number, blockedIndex: number): string {
  switch (cell.tileType) {
    case 'path':
      return PATH_TILE_TEXTURE_URLS[resolveVariantIndex(cell, pathIndex, PATH_TILE_TEXTURE_URLS.length)];
    case 'blocked':
      return BLOCKED_TILE_TEXTURE_URLS[resolveVariantIndex(cell, blockedIndex, BLOCKED_TILE_TEXTURE_URLS.length)];
    case 'catapult':
      return cell.catapultDirection === null
        ? PATH_TILE_TEXTURE_URLS[resolveVariantIndex(cell, pathIndex, PATH_TILE_TEXTURE_URLS.length)]
        : CATAPULT_TILE_TEXTURE_URLS[cell.catapultDirection];
    case 'start':
      return SINGLE_TILE_TEXTURE_URLS.start;
    case 'goal':
      return SINGLE_TILE_TEXTURE_URLS.goal;
    case 'health':
      return SINGLE_TILE_TEXTURE_URLS.health;
  }
}

function resolveTileStroke(gameState: GameState, cell: CellState) {
  const activation = canActivateCell(gameState, cell.coord);

  if (coordsEqual(cell.coord, gameState.larryPosition)) {
    return { color: CURRENT_STROKE, alpha: 0.95, width: 4 };
  }

  if (activation.allowed) {
    return { color: VALID_STROKE, alpha: 0.9, width: 4 };
  }

  if (cell.active) {
    return { color: ACTIVE_STROKE, alpha: 0.58, width: 2 };
  }

  return { color: ACTIVE_STROKE, alpha: 0, width: 0 };
}

function createTileHitArea() {
  const hitArea = new Graphics();

  hitArea.poly(
    Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index);
      return {
        x: Math.cos(angle) * TILE_RADIUS,
        y: Math.sin(angle) * TILE_RADIUS,
      };
    }).flatMap((point) => [point.x, point.y]),
  );
  hitArea.fill({ color: 0xffffff, alpha: 0.001 });

  return hitArea;
}

function createTileSprite(textureUrl: string) {
  const sprite = Sprite.from(textureUrl);

  sprite.anchor.set(0.5);
  sprite.width = TILE_SPRITE_WIDTH;
  sprite.height = TILE_SPRITE_HEIGHT;

  return sprite;
}

function registerTickerAnimation(
  app: Application,
  update: (elapsedMs: number) => boolean,
  registerAnimation: (cleanup: AnimationCleanup) => void,
) {
  const startTime = performance.now();

  function tick() {
    const shouldContinue = update(performance.now() - startTime);

    if (!shouldContinue) {
      app.ticker.remove(tick);
    }
  }

  app.ticker.add(tick);
  registerAnimation(() => app.ticker.remove(tick));
}

function animateTileIntro(
  app: Application,
  tile: Container,
  targetY: number,
  targetAlpha: number,
  delayMs: number,
  registerAnimation: (cleanup: AnimationCleanup) => void,
) {
  const startY = targetY - TILE_INTRO_DROP_OFFSET;

  tile.y = startY;
  tile.alpha = 0;

  registerTickerAnimation(app, (elapsedMs) => {
    if (tile.parent === null) {
      return false;
    }

    const animationElapsed = elapsedMs - delayMs;

    if (animationElapsed < 0) {
      return true;
    }

    const progress = Math.min(animationElapsed / TILE_INTRO_FALL_DURATION_MS, 1);
    const easedProgress = easeIntroDrop(progress);

    tile.y = lerp(startY, targetY, easedProgress);
    tile.alpha = targetAlpha * easedProgress;

    return progress < 1;
  }, registerAnimation);
}

function resolveLarrySpritePosition(coord: AxialCoord) {
  const position = axialToPixel(coord, TILE_RADIUS);

  return {
    x: position.x,
    y: position.y + TILE_RADIUS * 0.48,
  };
}

function drawLarry(board: Container, gameState: GameState, options: RenderBoardOptions, introLarryDelayMs: number) {
  const larry = Sprite.from(LARRY_TEXTURE_URL);
  const targetPosition = resolveLarrySpritePosition(gameState.larryPosition);
  const scale = LARRY_SPRITE_HEIGHT / larry.texture.height;
  const larryPath = options.larryPath;

  larry.anchor.set(0.5, 0.95);
  larry.scale.set(scale);
  larry.x = targetPosition.x;
  larry.y = targetPosition.y;
  larry.label = 'Larry';
  board.addChild(larry);

  if (options.playTileIntro) {
    larry.alpha = 0;
    registerTickerAnimation(options.app, (elapsedMs) => {
      if (larry.parent === null) {
        return false;
      }

      const animationElapsed = elapsedMs - introLarryDelayMs;

      if (animationElapsed < 0) {
        return true;
      }

      const progress = Math.min(animationElapsed / 120, 1);
      larry.alpha = easeOutCubic(progress);

      return progress < 1;
    }, options.registerAnimation);
    return;
  }

  if (options.animateLarry && larryPath !== null && larryPath.length > 1) {
    const pathPositions = larryPath.map(resolveLarrySpritePosition);
    const segmentCount = pathPositions.length - 1;
    const totalDurationMs = segmentCount * LARRY_MOVE_DURATION_MS;
    const firstPosition = pathPositions[0];

    larry.x = firstPosition.x;
    larry.y = firstPosition.y;

    registerTickerAnimation(options.app, (elapsedMs) => {
      if (larry.parent === null) {
        return false;
      }

      const clampedElapsed = Math.min(elapsedMs, totalDurationMs);
      const segmentIndex = Math.min(Math.floor(clampedElapsed / LARRY_MOVE_DURATION_MS), segmentCount - 1);
      const segmentElapsed = clampedElapsed - segmentIndex * LARRY_MOVE_DURATION_MS;
      const progress = Math.min(segmentElapsed / LARRY_MOVE_DURATION_MS, 1);
      const startPosition = pathPositions[segmentIndex];
      const endPosition = pathPositions[segmentIndex + 1];
      const horizontalProgress = easeOutCubic(progress);
      const verticalLift = Math.sin(progress * Math.PI) * LARRY_HOP_HEIGHT;

      larry.x = lerp(startPosition.x, endPosition.x, horizontalProgress);
      larry.y = lerp(startPosition.y, endPosition.y, horizontalProgress) - verticalLift;

      return elapsedMs < totalDurationMs;
    }, options.registerAnimation);
  }
}

function renderBoard(gameState: GameState, board: Container, onActivateCell: (coord: AxialCoord) => void, options: RenderBoardOptions) {
  const children = board.removeChildren();

  for (const child of children) {
    child.destroy({ children: true });
  }

  const orderedCells = getOrderedCells(gameState)
    .map((cell) => ({
      cell,
      position: axialToPixel(cell.coord, TILE_RADIUS),
      projection: 0,
    }))
    .map((entry) => ({
      ...entry,
      projection: entry.position.x - entry.position.y,
    }))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const projections = orderedCells.map((entry) => entry.projection);
  const minimumProjection = Math.min(...projections);
  const lineSpacing = resolveIntroLineSpacing(projections);
  let maxIntroDelay = 0;
  let pathIndex = 0;
  let blockedIndex = 0;

  for (const { cell, position, projection } of orderedCells) {
    const tile = new Container();
    const textureUrl = resolveTileTextureUrl(cell, pathIndex, blockedIndex);
    const sprite = createTileSprite(textureUrl);
    const stroke = resolveTileStroke(gameState, cell);
    const outline = new Graphics();
    const targetAlpha = cell.active || canActivateCell(gameState, cell.coord).allowed || coordsEqual(cell.coord, gameState.larryPosition) ? 1 : 0.62;

    drawFlatTopHex(outline, TILE_RADIUS, stroke.color, stroke.alpha, stroke.width);
    tile.addChild(sprite, createTileHitArea(), outline);
    tile.x = position.x;
    tile.y = position.y;
    tile.alpha = targetAlpha;
    tile.eventMode = 'static';
    tile.cursor = 'pointer';
    tile.label = `Hex ${cell.coord.q},${cell.coord.r}`;
    tile.on('pointertap', () => onActivateCell(cell.coord));
    board.addChild(tile);

    if (options.playTileIntro) {
      const lineIndex = Math.max(0, Math.round((projection - minimumProjection) / lineSpacing));
      const delayMs = lineIndex * TILE_INTRO_LINE_DELAY_MS;

      maxIntroDelay = Math.max(maxIntroDelay, delayMs);
      animateTileIntro(options.app, tile, position.y, targetAlpha, delayMs, options.registerAnimation);
    }

    if (cell.tileType === 'path') {
      pathIndex += 1;
    }

    if (cell.tileType === 'blocked') {
      blockedIndex += 1;
    }
  }

  drawLarry(board, gameState, options, maxIntroDelay + TILE_INTRO_FALL_DURATION_MS);
}

export function PixiStage({ gameState, introKey, movementPath, onActivateCell }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardRef = useRef<Container | null>(null);
  const gameStateRef = useRef(gameState);
  const onActivateCellRef = useRef(onActivateCell);
  const previousLarryPositionRef = useRef<AxialCoord | null>(null);
  const lastIntroKeyRef = useRef<number | null>(null);
  const animationCleanupsRef = useRef<AnimationCleanup[]>([]);

  function stopAnimations() {
    for (const cleanup of animationCleanupsRef.current) {
      cleanup();
    }

    animationCleanupsRef.current = [];
  }

  function registerAnimation(cleanup: AnimationCleanup) {
    animationCleanupsRef.current.push(cleanup);
  }

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onActivateCellRef.current = onActivateCell;
  }, [onActivateCell]);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const mountHost = host;

    let disposed = false;
    let app: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function mount() {
      await Assets.load(TILE_TEXTURE_URLS);

      if (disposed) {
        return;
      }

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
      appRef.current = nextApp;
      mountHost.appendChild(nextApp.canvas);

      const board = new Container();
      board.label = 'Live Hex Board';
      boardRef.current = board;
      nextApp.stage.addChild(board);

      renderBoard(gameStateRef.current, board, (coord) => onActivateCellRef.current(coord), {
        app: nextApp,
        previousLarryPosition: null,
        larryPath: null,
        animateLarry: false,
        playTileIntro: true,
        registerAnimation,
      });
      previousLarryPositionRef.current = gameStateRef.current.larryPosition;
      lastIntroKeyRef.current = introKey;
      centerBoard(nextApp, board);

      resizeObserver = new ResizeObserver(() => centerBoard(nextApp, board));
      resizeObserver.observe(mountHost);
    }

    void mount();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      stopAnimations();
      boardRef.current = null;
      appRef.current = null;

      if (app !== null) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const board = boardRef.current;

    if (app === null || board === null) {
      return;
    }

    stopAnimations();

    const previousLarryPosition = previousLarryPositionRef.current;
    const playTileIntro = lastIntroKeyRef.current !== introKey;
    const hasMovementPath = movementPath !== null && movementPath.length > 1;
    const fallbackMovementPath = previousLarryPosition === null ? null : [previousLarryPosition, gameState.larryPosition];
    const larryPath = hasMovementPath ? movementPath : fallbackMovementPath;
    const animateLarry = !playTileIntro && previousLarryPosition !== null && !coordsEqual(previousLarryPosition, gameState.larryPosition);

    renderBoard(gameState, board, (coord) => onActivateCellRef.current(coord), {
      app,
      previousLarryPosition,
      larryPath,
      animateLarry,
      playTileIntro,
      registerAnimation,
    });
    previousLarryPositionRef.current = gameState.larryPosition;
    lastIntroKeyRef.current = introKey;
    centerBoard(app, board);
  }, [gameState, introKey, movementPath]);

  return <div ref={hostRef} className="pixi-stage" />;
}
