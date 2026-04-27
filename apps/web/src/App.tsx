import { useState } from 'react';
import { applyCommand } from './game/core';
import type { AxialCoord, GameCommand } from './game/core';
import { createFirstLevelGameState, createNextLevelGameState, getLevelIndex, LEVELS } from './game/levels';
import { PixiStage } from './game/renderer/PixiStage';

export function App() {
  const [gameState, setGameState] = useState(createFirstLevelGameState);
  const currentLevelNumber = getLevelIndex(gameState.level.id) + 1;

  function dispatchGameCommand(command: GameCommand) {
    setGameState((currentState) => {
      const result = applyCommand(currentState, command);
      const completedLevel = result.events.some((event) => event.type === 'level-won');

      return completedLevel ? createNextLevelGameState(currentState.level.id) : result.state;
    });
  }

  function handleActivateCell(coord: AxialCoord) {
    dispatchGameCommand({ type: 'activate-cell', coord });
  }

  function handleResetLevel() {
    dispatchGameCommand({ type: 'reset-level' });
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-label="Project Extinguisher web bootstrap">
        <p className="eyebrow">Playable Slice Bootstrap</p>
        <h1>Project Extinguisher</h1>
        <p className="hero-copy">
          Clear each Unity-authored level to advance automatically. Reset restarts only the current level.
        </p>

        <div className="state-strip" aria-label="Current level state">
          <span>
            {gameState.level.name} / {LEVELS.length}
          </span>
          <span>Stage: {currentLevelNumber}</span>
          <span>Moves: {gameState.movesRemaining}</span>
          <span>Status: {gameState.status}</span>
        </div>

        <button className="reset-button" type="button" onClick={handleResetLevel}>
          Reset Level
        </button>
      </section>

      <section className="game-panel" aria-label="Playable Pixi board">
        <PixiStage gameState={gameState} onActivateCell={handleActivateCell} />
      </section>
    </main>
  );
}
