export type AxialCoord = Readonly<{
  q: number;
  r: number;
}>;

export type CatapultDirection = 'E' | 'NE' | 'NW' | 'W' | 'SW' | 'SE';

export type TileType = 'path' | 'start' | 'goal' | 'blocked' | 'catapult' | 'health';

export type GameStatus = 'pregame' | 'playing' | 'won' | 'lost';

export type LevelCellData = Readonly<
  AxialCoord & {
    blocked?: boolean;
    initiallyActive?: boolean;
    catapultDirection?: CatapultDirection | null;
    catapultDistance?: number;
    moveBonus?: number;
    variant?: number;
  }
>;

export type LevelData = Readonly<{
  id: string;
  name: string;
  radius?: number;
  moveLimit: number;
  start: AxialCoord;
  goal: AxialCoord;
  defaultInitialActive?: boolean;
  cells: readonly LevelCellData[];
}>;

export type CellState = Readonly<{
  coord: AxialCoord;
  tileType: TileType;
  active: boolean;
  walkable: boolean;
  variant: number | null;
  catapultDirection: CatapultDirection | null;
  catapultDistance: number;
  moveBonus: number;
  moveBonusConsumed: boolean;
}>;

export type GameRules = Readonly<{
  requireLarryAdjacency: boolean;
  defaultCatapultDistance: number;
  maxCatapultChainCount: number;
}>;

export type GameState = Readonly<{
  level: LevelData;
  status: GameStatus;
  movesRemaining: number;
  larryPosition: AxialCoord;
  rules: GameRules;
  cellOrder: readonly string[];
  cellsByKey: Readonly<Record<string, CellState>>;
}>;

export type ActivationRejectReason =
  | 'not-playing'
  | 'no-moves'
  | 'missing-cell'
  | 'not-walkable'
  | 'already-active'
  | 'not-adjacent';

export type GameEvent =
  | Readonly<{ type: 'level-started'; levelId: string }>
  | Readonly<{ type: 'level-reset'; levelId: string }>
  | Readonly<{ type: 'cell-activated'; coord: AxialCoord; source: 'manual' | 'catapult' }>
  | Readonly<{ type: 'move-spent'; amount: number; remaining: number; source: 'manual' | 'catapult' }>
  | Readonly<{ type: 'larry-moved'; from: AxialCoord; to: AxialCoord; source: 'manual' | 'catapult' }>
  | Readonly<{ type: 'move-bonus-consumed'; coord: AxialCoord; amount: number; remaining: number }>
  | Readonly<{ type: 'catapult-blocked'; coord: AxialCoord; reason: 'no-moves' | 'missing-cell' | 'not-walkable' | 'chain-limit' }>
  | Readonly<{ type: 'level-won'; coord: AxialCoord }>
  | Readonly<{ type: 'level-lost'; coord: AxialCoord }>;

export type CommandResult = Readonly<{
  state: GameState;
  accepted: boolean;
  reason?: ActivationRejectReason;
  events: readonly GameEvent[];
}>;
