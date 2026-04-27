import { useState } from 'react';
import { applyCommand } from './game/core';
import type { AxialCoord, GameCommand } from './game/core';
import { createFirstLevelGameState } from './game/levels';
import { PixiStage } from './game/renderer/PixiStage';

export function App() {
  const [gameState, setGameState] = useState(createFirstLevelGameState);

  function dispatchGameCommand(command: GameCommand) {
    setGameState((currentState) => applyCommand(currentState, command).state);
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
          Level 1 now runs through a React-owned game state. Click a neighboring tile to spend a move and guide Larry
          toward the goal.
        </p>

        <div className="state-strip" aria-label="Current level state">
          <span>{gameState.level.name}</span>
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
