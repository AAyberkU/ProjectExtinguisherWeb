// Hex-steps rules engine (docs/rules.md): pure, deterministic, no DOM/Pixi/React/Node.

export {
  DIRS,
  DIR_INDEX,
  DIR_VECTORS,
  TILE_TYPES,
  isDir,
  opposite,
  type Dir,
  type EngineEvent,
  type LegalMove,
  type LossReason,
  type PlayState,
  type PlayStatus,
  type PuzzleLabLevel,
  type PuzzleLabSolution,
  type RawTile,
  type StepResult,
  type TileContent,
  type TileType,
} from './types';
export { axialToPixel, boardCellCount, boardCoords, boardRadius, hexDistance, onBoard } from './hex';
export {
  MAX_CHAIN,
  MAX_PLUS,
  cellContent,
  compileLevel,
  contentIndex,
  type CompiledCell,
  type CompiledLevel,
} from './compile';
export {
  colorBit,
  doorOpen,
  hasMove,
  initialState,
  isWall,
  legalMoves,
  plusCollected,
  replay,
  step,
  switchPressed,
} from './rules';
export {
  STATE_LIMIT,
  bfsSearch,
  bfsSolve,
  countSolutions,
  minBudget,
  minBudgetSearch,
  type SearchResult,
  type SolutionCount,
} from './solver';
export { reachableCells, validateLevel, type ValidateOptions, type ValidationResult } from './validate';
