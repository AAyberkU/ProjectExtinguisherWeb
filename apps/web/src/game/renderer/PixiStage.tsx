import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { getRenderResolution, loadGameAssets } from '../assets';
import { axialToPixel, canActivateCell, coordsEqual, getOrderedCells } from '../core';
import type { AxialCoord, CatapultDirection, CellState, GameState, TileType } from '../core';

type PixiStageProps = Readonly<{
  gameState: GameState;
  introKey: number;
  movementPath: readonly AxialCoord[] | null;
  onActivateCell: (coord: AxialCoord) => void;
  onLoadError: (error: Error) => void;
  onReady: () => void;
}>;

const TILE_LAYOUT_RADIUS = 40;
const TILE_VISUAL_RADIUS = 36.5;
const TILE_SPRITE_WIDTH = TILE_VISUAL_RADIUS * 2.1;
const TILE_SPRITE_HEIGHT = TILE_VISUAL_RADIUS * 1.86;
// The jam tile art is flat-top; rotating it 30 degrees clockwise fits the pointy-top board until
// pointy-top art replaces it. Set to 0 for art drawn pointy-top.
const PLACEHOLDER_TILE_ROTATION = Math.PI / 6;
const HEX_CORNER_ANGLE_OFFSET_DEGREES = 30;
const BOARD_FIT_WIDTH = 990;
const BOARD_FIT_HEIGHT = 680;
const LARRY_SPRITE_HEIGHT = TILE_VISUAL_RADIUS * 1.55;
const LARRY_MOVE_DURATION_MS = 220;
const LARRY_HOP_HEIGHT = TILE_VISUAL_RADIUS * 0.52;
const TILE_INTRO_DROP_OFFSET = TILE_VISUAL_RADIUS * 9;
const TILE_INTRO_FALL_DURATION_MS = 180;
const TILE_INTRO_LINE_DELAY_MS = 8;

type AnimationCleanup = () => void;

type RenderBoardOptions = Readonly<{
  app: Application;
  previousLarryPosition: AxialCoord | null;
  larryPath: readonly AxialCoord[] | null;
  animateLarry: boolean;
  playTileIntro: boolean;
  registerAnimation: (cleanup: AnimationCleanup) => void;
}>;

const PATH_TILE_TEXTURES = Array.from(
  { length: 10 },
  (_, index) => `tile_path_${String(index + 1).padStart(2, '0')}`,
);
const BLOCKED_TILE_TEXTURES = ['tile_blocked_01', 'tile_blocked_02', 'tile_blocked_03'] as const;

const CATAPULT_TILE_TEXTURES: Readonly<Record<CatapultDirection, string>> = {
  right: 'tile_catapult_right',
  up_right: 'tile_catapult_up_right',
  up_left: 'tile_catapult_up_left',
  left: 'tile_catapult_left',
  down_left: 'tile_catapult_down_left',
  down_right: 'tile_catapult_down_right',
};

const SINGLE_TILE_TEXTURES: Readonly<Record<Exclude<TileType, 'path' | 'blocked' | 'catapult'>, string>> = {
  start: 'tile_start',
  goal: 'tile_goal',
  health: 'tile_health',
};

const LARRY_TEXTURE = 'larry';

function getHexCornerPoints(radius: number): number[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index + HEX_CORNER_ANGLE_OFFSET_DEGREES);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }).flat();
}

function drawHexOutline(graphics: Graphics, radius: number, color: number, alpha: number, width: number) {
  graphics.clear();
  graphics.poly(getHexCornerPoints(radius));

  if (alpha > 0) {
    graphics.stroke({ color, width, alpha });
  }
}

function centerBoard(app: Application, board: Container) {
  board.x = app.renderer.width / 2;
  board.y = app.renderer.height / 2 + app.renderer.height * 0.03;

  const fit = Math.min(app.renderer.width / BOARD_FIT_WIDTH, app.renderer.height / BOARD_FIT_HEIGHT, 1.45);
  board.scale.set(Math.max(0.52, fit));
}

function syncRendererSize(app: Application, host: HTMLElement, board: Container) {
  const { width, height } = host.getBoundingClientRect();

  app.renderer.resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), getRenderResolution());
  centerBoard(app, board);
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

function resolveTileTexture(cell: CellState, pathIndex: number, blockedIndex: number): string {
  switch (cell.tileType) {
    case 'path':
      return PATH_TILE_TEXTURES[resolveVariantIndex(cell, pathIndex, PATH_TILE_TEXTURES.length)];
    case 'blocked':
      return BLOCKED_TILE_TEXTURES[resolveVariantIndex(cell, blockedIndex, BLOCKED_TILE_TEXTURES.length)];
    case 'catapult':
      return cell.catapultDirection === null
        ? PATH_TILE_TEXTURES[resolveVariantIndex(cell, pathIndex, PATH_TILE_TEXTURES.length)]
        : CATAPULT_TILE_TEXTURES[cell.catapultDirection];
    case 'start':
      return SINGLE_TILE_TEXTURES.start;
    case 'goal':
      return SINGLE_TILE_TEXTURES.goal;
    case 'health':
      return SINGLE_TILE_TEXTURES.health;
  }
}



function createTileHitArea() {
  const hitArea = new Graphics();

  hitArea.poly(getHexCornerPoints(TILE_VISUAL_RADIUS));
  hitArea.fill({ color: 0xffffff, alpha: 0.001 });

  return hitArea;
}

function createTileSprite(texture: string) {
  const sprite = Sprite.from(texture);

  sprite.anchor.set(0.5);
  sprite.width = TILE_SPRITE_WIDTH;
  sprite.height = TILE_SPRITE_HEIGHT;
  sprite.rotation = PLACEHOLDER_TILE_ROTATION;

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
  const position = axialToPixel(coord, TILE_LAYOUT_RADIUS);

  return {
    x: position.x,
    y: position.y + TILE_VISUAL_RADIUS * 0.48,
  };
}

function drawLarry(board: Container, gameState: GameState, options: RenderBoardOptions, introLarryDelayMs: number) {
  const larry = Sprite.from(LARRY_TEXTURE);
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

      if (elapsedMs < totalDurationMs) {
        const clampedElapsed = elapsedMs;
        const segmentIndex = Math.min(Math.floor(clampedElapsed / LARRY_MOVE_DURATION_MS), segmentCount - 1);
        const segmentElapsed = clampedElapsed - segmentIndex * LARRY_MOVE_DURATION_MS;
        const progress = Math.min(segmentElapsed / LARRY_MOVE_DURATION_MS, 1);
        const startPosition = pathPositions[segmentIndex];
        const endPosition = pathPositions[segmentIndex + 1];
        const horizontalProgress = easeOutCubic(progress);
        const verticalLift = Math.sin(progress * Math.PI) * LARRY_HOP_HEIGHT;

        larry.x = lerp(startPosition.x, endPosition.x, horizontalProgress);
        larry.y = lerp(startPosition.y, endPosition.y, horizontalProgress) - verticalLift;
      } else {
        const targetPos = pathPositions[pathPositions.length - 1];
        larry.x = targetPos.x;
        
        const cycle = Math.sin((elapsedMs * Math.PI * 2) / 1200);
        larry.y = targetPos.y + (cycle - 1) * 1.5;
        larry.scale.set(scale * (1.0 + (cycle + 1) * 0.01));
      }

      return true;
    }, options.registerAnimation);
  } else {
    // Idle 3D hover animation matching the tile underneath
    const baseY = targetPosition.y;
    
    registerTickerAnimation(options.app, (elapsedMs) => {
      if (larry.parent === null) return false;
      
      const cycle = Math.sin((elapsedMs * Math.PI * 2) / 1200);
      larry.y = baseY + (cycle - 1) * 1.5;
      larry.scale.set(scale * (1.0 + (cycle + 1) * 0.01));
      
      return true;
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
      position: axialToPixel(cell.coord, TILE_LAYOUT_RADIUS),
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
    const sprite = createTileSprite(resolveTileTexture(cell, pathIndex, blockedIndex));
    const targetAlpha = 1;
    const isLarryTile = coordsEqual(cell.coord, gameState.larryPosition);
    const activation = canActivateCell(gameState, cell.coord);

    if (cell.tileType === 'path' && !cell.active) {
      sprite.tint = 0x888888;
    }

    const outline = new Graphics();
    if (activation.allowed && !isLarryTile) {
      drawHexOutline(outline, TILE_VISUAL_RADIUS, 0x00ff88, 0.85, 2.5);
    }

    if (isLarryTile) {
      registerTickerAnimation(options.app, (elapsedMs) => {
        if (sprite.parent === null) return false;
        
        const cycle = Math.sin((elapsedMs * Math.PI * 2) / 1200);
        sprite.y = (cycle - 1) * 1.5;
        
        const scaleMod = 1.0 + (cycle + 1) * 0.01;
        sprite.width = TILE_SPRITE_WIDTH * scaleMod;
        sprite.height = TILE_SPRITE_HEIGHT * scaleMod;
        
        return true;
      }, options.registerAnimation);
    }

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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Failed to initialize the game board.');
}

export function PixiStage({ gameState, introKey, movementPath, onActivateCell, onLoadError, onReady }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardRef = useRef<Container | null>(null);
  const gameStateRef = useRef(gameState);
  const onActivateCellRef = useRef(onActivateCell);
  const onLoadErrorRef = useRef(onLoadError);
  const onReadyRef = useRef(onReady);
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
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const mountHost = host;

    let disposed = false;
    let app: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let scheduleResizeSync: (() => void) | null = null;
    let initializingApp: Application | null = null;

    const handleViewportResize = () => scheduleResizeSync?.();

    async function mount() {
      try {
        await loadGameAssets();

        if (disposed) {
          return;
        }

        const nextApp = new Application();
        initializingApp = nextApp;
        await nextApp.init({
          antialias: true,
          backgroundAlpha: 0,
          resizeTo: mountHost,
          resolution: getRenderResolution(),
          autoDensity: true,
        });

        if (disposed) {
          nextApp.destroy(true);
          initializingApp = null;
          return;
        }

        app = nextApp;
        initializingApp = null;
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
        syncRendererSize(nextApp, mountHost, board);

        scheduleResizeSync = () => {
          if (resizeFrame !== null) {
            window.cancelAnimationFrame(resizeFrame);
          }

          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = null;

            if (!disposed) {
              syncRendererSize(nextApp, mountHost, board);
            }
          });
        };

        resizeObserver = new ResizeObserver(handleViewportResize);
        resizeObserver.observe(mountHost);
        window.addEventListener('resize', handleViewportResize);
        window.addEventListener('orientationchange', handleViewportResize);
        scheduleResizeSync();
        onReadyRef.current();
      } catch (error) {
        if (initializingApp !== null) {
          try {
            initializingApp.destroy(true, { children: true });
          } catch {
            // Pixi may reject before its renderer is initialized enough to destroy.
          }
          initializingApp = null;
        }

        if (!disposed) {
          onLoadErrorRef.current(toError(error));
        }
      }
    }

    void mount();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleViewportResize);

      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

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
