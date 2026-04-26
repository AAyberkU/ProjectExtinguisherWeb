import { BOARD_RADIUS, coordKey, coordsEqual, createBoardCoordinates } from './hex';
import { assertValidLevelData } from './level';
import type { CellState, GameRules, GameState, GameStatus, LevelCellData, LevelData, TileType } from './types';

export const DEFAULT_GAME_RULES: GameRules = {
  requireLarryAdjacency: true,
  defaultCatapultDistance: 2,
  maxCatapultChainCount: 8,
};

export function createInitialGameState(
  level: LevelData,
  options: Readonly<{
    status?: GameStatus;
    rules?: Partial<GameRules>;
  }> = {},
): GameState {
  assertValidLevelData(level);

  const radius = level.radius ?? BOARD_RADIUS;
  const cellOverrides = new Map(level.cells.map((cell) => [coordKey(cell), cell]));
  const cellEntries: Array<[string, CellState]> = [];
  const cellOrder: string[] = [];
  const rules = {
    ...DEFAULT_GAME_RULES,
    ...options.rules,
  } satisfies GameRules;

  for (const coord of createBoardCoordinates(radius)) {
    const key = coordKey(coord);
    const override = cellOverrides.get(key);
    const cell = createCellState(level, coord, override, rules);

    cellOrder.push(key);
    cellEntries.push([key, cell]);
  }

  return {
    level,
    status: options.status ?? 'playing',
    movesRemaining: level.moveLimit,
    larryPosition: level.start,
    rules,
    cellOrder,
    cellsByKey: Object.fromEntries(cellEntries),
  };
}

export function resetGameState(state: GameState): GameState {
  return createInitialGameState(state.level, {
    status: 'playing',
    rules: state.rules,
  });
}

export function getCell(state: GameState, coord: Readonly<{ q: number; r: number }>): CellState | undefined {
  return state.cellsByKey[coordKey(coord)];
}

export function setCell(state: GameState, cell: CellState): GameState {
  return {
    ...state,
    cellsByKey: {
      ...state.cellsByKey,
      [coordKey(cell.coord)]: cell,
    },
  };
}

export function setCellActive(state: GameState, cell: CellState, active: boolean): GameState {
  if (cell.active === active) {
    return state;
  }

  return setCell(state, {
    ...cell,
    active,
  });
}

export function setMoveBonusConsumed(state: GameState, cell: CellState, consumed: boolean): GameState {
  if (cell.moveBonusConsumed === consumed) {
    return state;
  }

  return setCell(state, {
    ...cell,
    moveBonusConsumed: consumed,
  });
}

function createCellState(
  level: LevelData,
  coord: Readonly<{ q: number; r: number }>,
  override: LevelCellData | undefined,
  rules: GameRules,
): CellState {
  const isStart = coordsEqual(coord, level.start);
  const isGoal = coordsEqual(coord, level.goal);
  const blocked = override?.blocked ?? false;
  const catapultDirection = override?.catapultDirection ?? null;
  const moveBonus = Math.max(0, override?.moveBonus ?? 0);
  const tileType = resolveTileType({ isStart, isGoal, blocked, catapultDirection, moveBonus });
  const walkable = tileType !== 'blocked';
  const active = isStart ? true : (override?.initiallyActive ?? level.defaultInitialActive ?? false);

  return {
    coord: { q: coord.q, r: coord.r },
    tileType,
    active,
    walkable,
    variant: override?.variant ?? null,
    catapultDirection,
    catapultDistance: Math.max(1, override?.catapultDistance ?? rules.defaultCatapultDistance),
    moveBonus,
    moveBonusConsumed: false,
  };
}

function resolveTileType(input: Readonly<{
  isStart: boolean;
  isGoal: boolean;
  blocked: boolean;
  catapultDirection: CellState['catapultDirection'];
  moveBonus: number;
}>): TileType {
  if (input.isStart) {
    return 'start';
  }

  if (input.isGoal) {
    return 'goal';
  }

  if (input.blocked) {
    return 'blocked';
  }

  if (input.catapultDirection !== null) {
    return 'catapult';
  }

  if (input.moveBonus > 0) {
    return 'health';
  }

  return 'path';
}
