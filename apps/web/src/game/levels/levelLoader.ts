import { createInitialGameState, validateLevelData } from '../core';
import type { GameState, LevelData, LevelValidationResult } from '../core';
import level001Json from './level-001.json';
import level002Json from './level-002.json';
import level003Json from './level-003.json';
import level004Json from './level-004.json';
import level005Json from './level-005.json';

export const LEVELS: readonly LevelData[] = [
  level001Json as LevelData,
  level002Json as LevelData,
  level003Json as LevelData,
  level004Json as LevelData,
  level005Json as LevelData,
];

export function getLevelIndex(levelId: string): number {
  const index = LEVELS.findIndex((candidate) => candidate.id === levelId);

  if (index === -1) {
    throw new Error(`Level '${levelId}' was not found.`);
  }

  return index;
}

export function getLevelData(levelId: string): LevelData {
  return LEVELS[getLevelIndex(levelId)];
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

export function createNextLevelGameState(currentLevelId: string): GameState {
  const currentIndex = getLevelIndex(currentLevelId);
  const nextLevel = LEVELS[(currentIndex + 1) % LEVELS.length];

  return createInitialGameState(nextLevel);
}
