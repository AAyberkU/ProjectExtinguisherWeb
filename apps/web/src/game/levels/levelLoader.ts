import { createInitialGameState, validateLevelData } from '../core';
import type { GameState, LevelData, LevelValidationResult } from '../core';
import level001Json from './level-001.json';

export const LEVELS: readonly LevelData[] = [level001Json as LevelData];

export function getLevelData(levelId: string): LevelData {
  const level = LEVELS.find((candidate) => candidate.id === levelId);

  if (level === undefined) {
    throw new Error(`Level '${levelId}' was not found.`);
  }

  return level;
}

export function validateAvailableLevels(): readonly LevelValidationResult[] {
  return LEVELS.map(validateLevelData);
}

export function createLevelGameState(levelId: string): GameState {
  return createInitialGameState(getLevelData(levelId));
}

export function createFirstLevelGameState(): GameState {
  return createInitialGameState(LEVELS[0]);
}
