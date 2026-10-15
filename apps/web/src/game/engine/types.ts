// Shared types for the hex-steps rules engine (docs/rules.md).
// Puzzle Lab convention: axial (q, r), pointy-top hexes, r grows downward on screen.

export type Dir = 'E' | 'SE' | 'SW' | 'W' | 'NW' | 'NE';

/** Directions in solver order (clockwise on screen from the right). */
export const DIRS: readonly Dir[] = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];

export const DIR_VECTORS: Readonly<Record<Dir, readonly [number, number]>> = {
  E: [1, 0],
  SE: [0, 1],
  SW: [-1, 1],
  W: [-1, 0],
  NW: [0, -1],
  NE: [1, -1],
};

/** Index of each direction in `DIRS`. */
export const DIR_INDEX: Readonly<Record<Dir, number>> = { E: 0, SE: 1, SW: 2, W: 3, NW: 4, NE: 5 };

export function opposite(dir: Dir): Dir {
  return DIRS[(DIR_INDEX[dir] + 3) % 6];
}

export function isDir(value: unknown): value is Dir {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DIR_INDEX, value);
}

export type TileType =
  | 'floor'
  | 'start'
  | 'finish'
  | 'plus1'
  | 'launcher'
  | 'blocker'
  | 'swamp'
  | 'mover'
  | 'portal'
  | 'switch'
  | 'door'
  | 'passage'
  | 'refill';

export const TILE_TYPES: readonly TileType[] = [
  'floor',
  'start',
  'finish',
  'plus1',
  'launcher',
  'blocker',
  'swamp',
  'mover',
  'portal',
  'switch',
  'door',
  'passage',
  'refill',
];

/** A tile exactly as stored in a Puzzle Lab level file. */
export interface RawTile {
  q: number;
  r: number;
  type: TileType;
  dir?: Dir;
  color?: number;
  pair?: number;
  value?: number;
  noIn?: Dir[];
  noOut?: Dir[];
  swap?: number;
}

export interface PuzzleLabSolution {
  solvable: boolean;
  minBudget: number | null;
  solutions: number | null;
  shortest: Dir[] | null;
}

/** A `puzzle-lab/level@1` hex-steps level file. */
export interface PuzzleLabLevel {
  format: 'puzzle-lab/level@1';
  game: 'hex-steps';
  id: string;
  name: string;
  grid: { size: number; type: 'hex'; coords?: 'axial'; orientation?: 'pointy' };
  params: { steps: number };
  tiles: RawTile[];
  meta?: {
    slot?: number;
    author?: string;
    approved?: { by?: string; date?: string; note?: string };
    solution?: PuzzleLabSolution;
    [key: string]: unknown;
  };
}

/** What a cell shows under a given swap phase. The swap id stays on the cell. */
export interface TileContent {
  type: TileType;
  dir?: Dir;
  color?: number;
  pair?: number;
  value?: number;
  noIn: readonly Dir[];
  noOut: readonly Dir[];
  /** Swap pair id of the cell itself (does not travel with the content). */
  swap?: number;
  /** Index of the authored cell whose content is shown here. */
  source: number;
}

export type LossReason = 'out-of-steps' | 'stuck';
export type PlayStatus = 'playing' | 'won' | 'lost';

/** Plain, serializable play state. */
export interface PlayState {
  /** Cell index of the player. */
  pos: number;
  steps: number;
  /** Collected plus1 bits (see `CompiledLevel.plusBit`). */
  mask: number;
  /** Pressed switch colour bits (colour c = bit 1 << (c - 1)). */
  sw: number;
  phase: 0 | 1;
  /**
   * Where each car is (`CompiledLevel.cars` order), as the editor stores it: one character per car,
   * char code 0 = home and unused, otherwise 1 + the cell it is parked on. Empty without movers.
   */
  cars: string;
  status: PlayStatus;
  lossReason?: LossReason;
  moveCount: number;
}

export type EngineEvent =
  | { type: 'swap'; phase: 0 | 1; pairs: Array<[number, number]> }
  | { type: 'walk'; from: number; to: number; dir: Dir; cost: number }
  | { type: 'launch'; from: number; to: number; dir: Dir }
  /**
   * A car ride (rule 15): car `car` drives the player from `from` over `path` (the cells it drove
   * onto, in order) and parks on `parkedAt` (`from` when it could not move). With `drop`, the
   * player is put down on `to`, the next tile, whose arrival chain continues; otherwise the player
   * stays in the car (`to` = `parkedAt`).
   */
  | { type: 'slide'; from: number; to: number; dir: Dir; path: number[]; car: number; parkedAt: number; drop: boolean }
  | { type: 'teleport'; from: number; to: number }
  | { type: 'plus1'; cell: number }
  | { type: 'refill'; cell: number; value: number }
  | { type: 'switch'; cell: number; color: number; doors: number[] }
  | { type: 'steps'; before: number; after: number }
  | { type: 'win' }
  | { type: 'lose'; reason: LossReason };

export interface StepResult {
  state: PlayState;
  events: EngineEvent[];
}

export interface LegalMove {
  dir: Dir;
  /** The neighbour cell walked into (before any launch, slide, or teleport). */
  target: number;
}
