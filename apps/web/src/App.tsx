import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { applyCommand } from './game/core';
import type { AxialCoord, GameCommand } from './game/core';
import { createFirstLevelGameState, createNextLevelGameState, getLevelIndex, LEVELS } from './game/levels';
import { PixiStage } from './game/renderer/PixiStage';

const BACKGROUND_IMAGE_URL = new URL('../../../Art/Background/Background.png', import.meta.url).href;

type GameShellStyle = CSSProperties & Readonly<{
  '--game-background-image': string;
}>;

const GAME_SHELL_STYLE: GameShellStyle = {
  '--game-background-image': `url(${BACKGROUND_IMAGE_URL})`,
};

const MENU_TRANSITION_MS = 900;

type AppPhase = 'menu' | 'starting' | 'playing';

function resetLevelState(currentState: ReturnType<typeof createFirstLevelGameState>) {
  return applyCommand(currentState, { type: 'reset-level' }).state;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [gameState, setGameState] = useState(createFirstLevelGameState);
  const transitionTimeoutRef = useRef<number | null>(null);
  const currentLevelNumber = getLevelIndex(gameState.level.id) + 1;
  const movesLeftLabel = String(gameState.movesRemaining).padStart(2, '0');

  function clearTransitionTimeout() {
    if (transitionTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
  }

  useEffect(() => clearTransitionTimeout, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (phase !== 'playing') {
        return;
      }

      if (event.key.toLowerCase() !== 'r' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setGameState(resetLevelState);
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  function handleStartGame() {
    clearTransitionTimeout();
    setGameState(createFirstLevelGameState());
    setPhase('starting');

    transitionTimeoutRef.current = window.setTimeout(() => {
      transitionTimeoutRef.current = null;
      setPhase('playing');
    }, MENU_TRANSITION_MS);
  }

  function dispatchGameCommand(command: GameCommand) {
    const result = applyCommand(gameState, command);
    const completedLevel = result.events.some((event) => event.type === 'level-won');

    if (!completedLevel) {
      setGameState(result.state);
      return;
    }

    if (currentLevelNumber === LEVELS.length) {
      setGameState(createFirstLevelGameState());
      setPhase('menu');
      return;
    }

    setGameState(createNextLevelGameState(gameState.level.id));
  }

  function handleActivateCell(coord: AxialCoord) {
    if (phase !== 'playing') {
      return;
    }

    dispatchGameCommand({ type: 'activate-cell', coord });
  }

  function handleResetLevel() {
    if (phase !== 'playing') {
      return;
    }

    setGameState(resetLevelState);
  }

  return (
    <main className={`app-shell app-shell--${phase}`} style={GAME_SHELL_STYLE}>
      {phase === 'playing' ? (
        <section className="game-panel" aria-label="Playable Project Extinguisher board">
          <PixiStage gameState={gameState} onActivateCell={handleActivateCell} />
        </section>
      ) : null}

      {phase === 'menu' ? (
        <section className="main-menu" aria-label="Main menu">
          <button className="menu-start-button" type="button" onClick={handleStartGame}>
            Start Game
          </button>

          <div className="credits-card" aria-label="Credits">
            <p className="credit-role">Artist</p>
            <p className="credit-name credit-name--artist">Elif Ilgin Tilev</p>
            <p className="credit-role">Designer</p>
            <p className="credit-name credit-name--designer">Defne Gurcu</p>
            <p className="credit-role">Developer</p>
            <p className="credit-name credit-name--developer">Ahmet Ayberk Uzun</p>
            <p className="credit-role">Music</p>
            <p className="credit-name credit-name--music">Onurhan Karabag</p>
          </div>
        </section>
      ) : null}

      {phase === 'playing' ? (
        <header className="game-hud" aria-label="Game HUD">
          <p className="hud-moves">Moves Left: {movesLeftLabel}</p>
          <p className="hud-level">
            {gameState.level.name} / {LEVELS.length}
          </p>
          <button className="hud-reset" type="button" onClick={handleResetLevel} aria-label="Reset current level">
            R Reset
          </button>
        </header>
      ) : null}
    </main>
  );
}
