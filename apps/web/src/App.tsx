import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { gameAudio } from './game/audio';
import { applyCommand } from './game/core';
import type { AxialCoord, GameCommand, GameEvent } from './game/core';
import { createFirstLevelGameState, createNextLevelGameState, getLevelIndex, LEVELS } from './game/levels';
import { PixiStage, preloadPixiAssets } from './game/renderer/PixiStage';

const BACKGROUND_IMAGE_URL = new URL('../../../Art/Background/Background.png', import.meta.url).href;

type GameShellStyle = CSSProperties & Readonly<{
  '--game-background-image': string;
}>;

const GAME_SHELL_STYLE: GameShellStyle = {
  '--game-background-image': `url(${BACKGROUND_IMAGE_URL})`,
};

const MENU_TRANSITION_MS = 900;
const LOAD_ERROR_MESSAGE = 'Some game files could not be loaded.';

let backgroundImagePromise: Promise<void> | null = null;

function preloadBackgroundImage(): Promise<void> {
  if (backgroundImagePromise !== null) {
    return backgroundImagePromise;
  }

  backgroundImagePromise = new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      if (typeof image.decode !== 'function') {
        resolve();
        return;
      }

      image.decode().then(() => resolve(), () => resolve());
    };
    image.onerror = () => reject(new Error(`Failed to load background image: ${BACKGROUND_IMAGE_URL}`));
    image.src = BACKGROUND_IMAGE_URL;
  }).catch((error: unknown) => {
    backgroundImagePromise = null;
    throw error;
  });

  return backgroundImagePromise;
}

type AppPhase = 'menu' | 'starting' | 'playing';
type CompletionState = 'level' | 'game' | 'lost' | null;
type LarryMovedEvent = Extract<GameEvent, Readonly<{ type: 'larry-moved' }>>;

function resetLevelState(currentState: ReturnType<typeof createFirstLevelGameState>) {
  return applyCommand(currentState, { type: 'reset-level' }).state;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function createMovementPath(events: readonly GameEvent[]): readonly AxialCoord[] | null {
  const movementEvents = events.filter((event): event is LarryMovedEvent => event.type === 'larry-moved');

  if (movementEvents.length === 0) {
    return null;
  }

  return [movementEvents[0].from, ...movementEvents.map((event) => event.to)];
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [gameState, setGameState] = useState(createFirstLevelGameState);
  const [movementPath, setMovementPath] = useState<readonly AxialCoord[] | null>(null);
  const [completion, setCompletion] = useState<CompletionState>(null);
  const [stageIntroKey, setStageIntroKey] = useState(0);
  const [stageReady, setStageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitionResolveRef = useRef<(() => void) | null>(null);
  const startRequestRef = useRef(0);
  const stageReadyRef = useRef(false);
  const currentLevelNumber = getLevelIndex(gameState.level.id) + 1;
  const movesLeftLabel = String(gameState.movesRemaining).padStart(2, '0');
  const completedFinalLevel = completion === 'game';

  function clearTransitionTimeout() {
    if (transitionTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
    transitionResolveRef.current?.();
    transitionResolveRef.current = null;
  }

  useEffect(() => () => {
    startRequestRef.current += 1;
    clearTransitionTimeout();
  }, []);

  useEffect(() => {
    void Promise.all([preloadBackgroundImage(), preloadPixiAssets()]).catch(() => {
      // Start Game owns the visible retry state. This attempt only warms the cache.
    });
  }, []);

  useEffect(() => {
    gameAudio.startMusic();

    function unlockAudio() {
      gameAudio.startMusic();
    }

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      gameAudio.cancelScheduledSfx();
    };
  }, []);

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
      gameAudio.cancelScheduledSfx();
      gameAudio.play('restart');
      gameAudio.schedule('levelIntro', 80);
      setCompletion(null);
      setMovementPath(null);
      setStageIntroKey((currentKey) => currentKey + 1);
      setGameState(resetLevelState);
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  function waitForMenuTransition(): Promise<void> {
    return new Promise((resolve) => {
      transitionResolveRef.current = resolve;
      transitionTimeoutRef.current = window.setTimeout(() => {
        transitionTimeoutRef.current = null;
        transitionResolveRef.current = null;
        resolve();
      }, MENU_TRANSITION_MS);
    });
  }

  async function handleStartGame() {
    const requestId = startRequestRef.current + 1;

    startRequestRef.current = requestId;
    clearTransitionTimeout();
    setLoadError(null);
    stageReadyRef.current = false;
    setStageReady(false);
    setCompletion(null);
    setMovementPath(null);
    setStageIntroKey((currentKey) => currentKey + 1);
    setGameState(createFirstLevelGameState());
    setPhase('starting');

    try {
      await Promise.all([preloadBackgroundImage(), preloadPixiAssets(), waitForMenuTransition()]);

      if (startRequestRef.current !== requestId) {
        return;
      }

      setPhase('playing');
    } catch (error) {
      if (startRequestRef.current !== requestId) {
        return;
      }

      console.error(error);
      setLoadError(LOAD_ERROR_MESSAGE);
    }
  }

  function handleStageReady() {
    if (!stageReadyRef.current) {
      stageReadyRef.current = true;
      gameAudio.play('levelIntro');
    }

    setStageReady(true);
  }

  function handleStageLoadError(error: Error) {
    console.error(error);
    stageReadyRef.current = false;
    setStageReady(false);
    setLoadError(LOAD_ERROR_MESSAGE);
  }

  function handleRetryLoad() {
    void handleStartGame();
  }

  function dispatchGameCommand(command: GameCommand) {
    const result = applyCommand(gameState, command);
    const completedLevel = result.events.some((event) => event.type === 'level-won');
    const lostLevel = result.events.some((event) => event.type === 'level-lost');
    const nextMovementPath = createMovementPath(result.events);

    if (result.accepted) {
      gameAudio.cancelScheduledSfx();
      gameAudio.scheduleGameplayEvents(result.events);
    }

    if (!completedLevel && !lostLevel) {
      setMovementPath(nextMovementPath);
      setGameState(result.state);
      return;
    }

    setMovementPath(nextMovementPath);
    setGameState(result.state);
    
    if (completedLevel) {
      setCompletion(currentLevelNumber === LEVELS.length ? 'game' : 'level');
    } else if (lostLevel) {
      setCompletion('lost');
    }
  }

  function handleActivateCell(coord: AxialCoord) {
    if (phase !== 'playing' || completion !== null) {
      return;
    }

    dispatchGameCommand({ type: 'activate-cell', coord });
  }

  function handleResetLevel() {
    if (phase !== 'playing') {
      return;
    }

    setCompletion(null);
    gameAudio.cancelScheduledSfx();
    gameAudio.play('restart');
    gameAudio.schedule('levelIntro', 80);
    setMovementPath(null);
    setStageIntroKey((currentKey) => currentKey + 1);
    setGameState(resetLevelState);
  }

  function handleContinueAfterWin() {
    if (completion === 'level') {
      setCompletion(null);
      gameAudio.cancelScheduledSfx();
      gameAudio.play('levelIntro');
      setMovementPath(null);
      setStageIntroKey((currentKey) => currentKey + 1);
      setGameState(createNextLevelGameState(gameState.level.id));
      return;
    }

    if (completion === 'game') {
      clearTransitionTimeout();
      gameAudio.cancelScheduledSfx();
      setCompletion(null);
      setMovementPath(null);
      setGameState(createFirstLevelGameState());
      setPhase('menu');
    }
  }

  return (
    <main className={`app-shell app-shell--${phase}`} style={GAME_SHELL_STYLE}>
      {phase === 'playing' ? (
        <section className="game-panel" aria-label="Playable Project Extinguisher board">
          <PixiStage
            gameState={gameState}
            introKey={stageIntroKey}
            movementPath={movementPath}
            onActivateCell={handleActivateCell}
            onLoadError={handleStageLoadError}
            onReady={handleStageReady}
          />
        </section>
      ) : null}

      {phase === 'starting' || (phase === 'playing' && !stageReady) ? (
        <section className="loading-overlay" role="status" aria-live="polite" aria-label="Game loading status">
          <div className="loading-panel">
            <p className="loading-title">{loadError === null ? 'Loading Game' : 'Loading Failed'}</p>
            <p className="loading-copy">
              {loadError === null ? 'Preparing the board...' : loadError}
            </p>
            {loadError !== null ? (
              <button className="loading-retry" type="button" onClick={handleRetryLoad}>
                Retry
              </button>
            ) : null}
          </div>
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

      {phase === 'playing' && stageReady ? (
        <header className="game-hud" aria-label="Game HUD">
          <p className="hud-moves">Moves Left: {movesLeftLabel}</p>
          <p className="hud-level">
            {gameState.level.name}
          </p>
          <button className="hud-reset" type="button" onClick={handleResetLevel} aria-label="Reset current level">
            R Reset
          </button>
        </header>
      ) : null}

      {phase === 'playing' && stageReady && completion !== null ? (
        <section className="completion-overlay" aria-label={completion === 'lost' ? 'Level failed' : 'Level complete'}>
          <div className="completion-panel">
            <p className="completion-title">
              {completion === 'lost' ? 'Out of Moves' : completedFinalLevel ? 'You Finished The Game' : 'You Won'}
            </p>
            <p className="completion-copy">Press R to Reset</p>
            {completion === 'lost' ? (
              <button className="completion-button" type="button" onClick={handleResetLevel}>
                Try Again
              </button>
            ) : (
              <button className="completion-button" type="button" onClick={handleContinueAfterWin}>
                {completedFinalLevel ? 'Return to Main Menu' : 'Next Level'}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
