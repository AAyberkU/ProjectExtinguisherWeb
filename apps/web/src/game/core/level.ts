import { BOARD_RADIUS, coordKey, createBoardCoordinates } from './hex';
import type { LevelData } from './types';

export type LevelValidationResult = Readonly<{
  valid: boolean;
  errors: readonly string[];
}>;

export function validateLevelData(level: LevelData): LevelValidationResult {
  const errors: string[] = [];
  const radius = level.radius ?? BOARD_RADIUS;
  const boardKeys = new Set(createBoardCoordinates(radius).map(coordKey));
  const seenCellKeys = new Set<string>();

  if (level.id.trim().length === 0) {
    errors.push('Level id is required.');
  }

  if (level.name.trim().length === 0) {
    errors.push('Level name is required.');
  }

  if (!Number.isInteger(level.moveLimit) || level.moveLimit <= 0) {
    errors.push('Level moveLimit must be a positive integer.');
  }

  if (!boardKeys.has(coordKey(level.start))) {
    errors.push(`Level start ${coordKey(level.start)} is outside the board.`);
  }

  if (!boardKeys.has(coordKey(level.goal))) {
    errors.push(`Level goal ${coordKey(level.goal)} is outside the board.`);
  }

  if (coordKey(level.start) === coordKey(level.goal)) {
    errors.push('Level start and goal cannot use the same coordinate.');
  }

  for (const cell of level.cells) {
    const key = coordKey(cell);

    if (!boardKeys.has(key)) {
      errors.push(`Cell override ${key} is outside the board.`);
    }

    if (seenCellKeys.has(key)) {
      errors.push(`Duplicate cell override ${key}.`);
    }

    seenCellKeys.add(key);

    if (cell.catapultDistance !== undefined && (!Number.isInteger(cell.catapultDistance) || cell.catapultDistance <= 0)) {
      errors.push(`Cell ${key} catapultDistance must be a positive integer.`);
    }

    if (cell.moveBonus !== undefined && (!Number.isInteger(cell.moveBonus) || cell.moveBonus < 0)) {
      errors.push(`Cell ${key} moveBonus must be a non-negative integer.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidLevelData(level: LevelData): void {
  const result = validateLevelData(level);

  if (!result.valid) {
    throw new Error(`Invalid level data '${level.id}': ${result.errors.join(' ')}`);
  }
}
