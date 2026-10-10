import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { initAssets, loadGameAssets, resolveAssetUrl, subscribeGameAssetProgress } from './game/assets';
import { gameAudio } from './game/audio';
import type { Dir, EngineEvent, LossReason, PuzzleLabLevel } from './game/engine';
import { CAMPAIGN, createAdHocLevel, getCampaignLevel, isFinalCampaignLevel, type PlayableLevel } from './game/levels';
import { PixiStage, type PixiStageHandle } from './game/renderer/PixiStage';
import { canUndo, createSession, sessionMove, sessionRestart, sessionUndo, type Session } from './game/session';

type GameShellStyle = CSSProperties & Readonly<{
  '--game-background-image'?: string;
}>;

const MENU_TRANSITION_MS = 900;
const RESTART_INTRO_DELAY_MS = 80;
const HUD_BOARD_GAP_PX = 10;
const DEFAULT_TOP_INSET_PX = 96;
const LOAD_ERROR_MESSAGE = 'Some game files could not be loaded.';

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  w: 'NW',
  e: 'NE',
  a: 'W',
  arrowleft: 'W',
  d: 'E',
  arrowright: 'E',
  z: 'SW',
  x: 'SE',
};

const LOSS_REASON_TEXT: Readonly<Record<LossReason, string>> = {
  'out-of-steps': 'Out of steps',
  stuck: 'Stuck — no moves left',
};

let backgroundImagePromise: Promise<string> | null = null;

function preloadBackgroundImage(): Promise<string> {
  if (backgroundImagePromise !== null) {
    return backgroundImagePromise;
  }

  backgroundImagePromise = initAssets().then(() => new Promise<string>((resolve, reject) => {
    const url = resolveAssetUrl('background');
    const image = new Image();

    image.onload = () => {
      if (typeof image.decode !== 'function') {
        resolve(url);
        return;
      }

      image.decode().then(() => resolve(url), () => resolve(url));
    };
    image.onerror = () => reject(new Error(`Failed to load background image: ${url}`));
    image.src = url;
  })).catch((error: unknown) => {
    backgroundImagePromise = null;
    throw error;
  });

  return backgroundImagePromise;
}

type AppPhase = 'menu' | 'starting' | 'playing';
type Outcome = Readonly<{ result: 'won' | 'final' } | { result: 'lost'; reason: LossReason }>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function firstSession(): Session {
  return createSession(getCampaignLevel(0));
}

type DebugApi = Readonly<{
  goTo: (levelNumber: number) => void;
  loadLevel: (level: PuzzleLabLevel) => void;
  stats: () => unknown;
  cellScreenPoint: (q: number, r: number) => { x: number; y: number } | null;
}>;

export function App() {
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [session, setSession] = useState<Session>(firstSession);
  const [hudSteps, setHudSteps] = useState(() => session.state.steps);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [introDelayMs, setIntroDelayMs] = useState(0);
  const [topInset, setTopInset] = useState(DEFAULT_TOP_INSET_PX);
  const [stageReady, setStageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [assetProgress, setAssetProgress] = useState(0);
  const [stageMountKey, setStageMountKey] = useState(0);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitionResolveRef = useRef<(() => void) | null>(null);
  const startRequestRef = useRef(0);
  const stageReadyRef = useRef(false);
  const phaseRef = useRef<AppPhase>('menu');
  const sessionRef = useRef<Session>(session);
  const busyRef = useRef(true);
  const panelRef = useRef<HTMLElement | null>(null);
  const hudRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<PixiStageHandle | null>(null);
  const assetsReady = assetProgress >= 1 && backgroundUrl !== null;
  // The board initializes hidden during the menu transition; the panel only covers real waits.
  const showLoadingOverlay = loadError !== null
    || (phase === 'starting' && !assetsReady)
    || (phase === 'playing' && !stageReady);
  const gameShellStyle: GameShellStyle = backgroundUrl === null ? {} : { '--game-background-image': `url(${backgroundUrl})` };

  phaseRef.current = phase;

  function commitSession(next: Session) {
    sessionRef.current = next;
    setSession(next);
  }

  /** Written straight to the DOM so input locks and tests see it in the same task as the input. */
  function markBusy(busy: boolean) {
    busyRef.current = busy;
    panelRef.current?.setAttribute('data-busy', busy ? 'true' : 'false');
  }

  const attachPanel = useCallback((element: HTMLElement | null) => {
    panelRef.current = element;
    element?.setAttribute('data-busy', busyRef.current ? 'true' : 'false');
  }, []);

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

  useEffect(() => subscribeGameAssetProgress(setAssetProgress), []);

  useEffect(() => {
    void preloadBackgroundImage().then(setBackgroundUrl, () => {
      // Start Game owns the visible retry state.
    });
    void loadGameAssets().catch(() => {
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
    };
  }, []);

  // The board fit reserves the HUD's actual height (it differs between landscape and portrait).
  useLayoutEffect(() => {
    const hud = hudRef.current;
    const panel = panelRef.current;

    if (phase !== 'playing' || hud === null || panel === null) {
      return undefined;
    }

    const measure = () => {
      const inset = hud.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + HUD_BOARD_GAP_PX;
      setTopInset(Math.max(0, Math.round(inset)));
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(hud);
    observer.observe(panel);

    return () => observer.disconnect();
  }, [phase]);

  function isPlayable(): boolean {
    return phaseRef.current === 'playing' && stageReadyRef.current && stageRef.current !== null;
  }

  function handleMove(dir: Dir) {
    if (!isPlayable() || busyRef.current) {
      return;
    }

    const moved = sessionMove(sessionRef.current, dir);

    if (moved === null) {
      return;
    }

    commitSession(moved.session);
    markBusy(true);
    stageRef.current?.playMove(moved.events, moved.session.state);
  }

  function handleUndo() {
    if (!isPlayable() || busyRef.current) {
      return;
    }

    const previous = sessionUndo(sessionRef.current);

    if (previous === null) {
      return;
    }

    commitSession(previous);
    setOutcome(null);
    setHudSteps(previous.state.steps);
    stageRef.current?.showState(previous.state);
  }

  function loadSession(next: Session, delayMs: number) {
    commitSession(next);
    setOutcome(null);
    setHudSteps(next.state.steps);
    setIntroDelayMs(delayMs);
    setLoadKey((key) => key + 1);
    markBusy(true);
  }

  function handleRestart() {
    if (!isPlayable()) {
      return;
    }

    gameAudio.play('restart');
    loadSession(sessionRestart(sessionRef.current), RESTART_INTRO_DELAY_MS);
  }

  function handleLoadLevel(level: PlayableLevel) {
    if (!isPlayable()) {
      return;
    }

    loadSession(createSession(level), 0);
  }

  function handleNextLevel() {
    if (outcome?.result !== 'won') {
      return;
    }

    const nextIndex = sessionRef.current.level.index + 1;
    handleLoadLevel(getCampaignLevel(nextIndex < CAMPAIGN.length ? nextIndex : 0));
  }

  function handleReturnToMenu() {
    clearTransitionTimeout();
    commitSession(firstSession());
    setOutcome(null);
    stageReadyRef.current = false;
    setStageReady(false);
    markBusy(true);
    setPhase('menu');
  }

  function handleTimelineEnd() {
    const { level, state } = sessionRef.current;

    setHudSteps(state.steps);

    if (state.status === 'won') {
      setOutcome({ result: isFinalCampaignLevel(level) ? 'final' : 'won' });
    } else if (state.status === 'lost') {
      setOutcome({ result: 'lost', reason: state.lossReason ?? 'stuck' });
    }
  }

  function handleEventStart(event: EngineEvent) {
    gameAudio.playEvent(event);

    if (event.type === 'steps') {
      setHudSteps(event.after);
    }
  }

  // Keyboard: one listener; handlers are read through a ref so it always sees the current state.
  const keyHandlersRef = useRef({ handleMove, handleUndo, handleRestart });
  keyHandlersRef.current = { handleMove, handleUndo, handleRestart };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (phaseRef.current !== 'playing' || event.repeat) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const dir = KEY_DIRS[key];
      const handlers = keyHandlersRef.current;

      if (dir !== undefined) {
        event.preventDefault();
        handlers.handleMove(dir);
      } else if (key === 'backspace') {
        event.preventDefault();
        handlers.handleUndo();
      } else if (key === 'r') {
        event.preventDefault();
        handlers.handleRestart();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Developer access to any level (docs/levels.md); not part of release builds.
  const debugHandlersRef = useRef({ handleLoadLevel });
  debugHandlersRef.current = { handleLoadLevel };

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const api: DebugApi = {
      goTo: (levelNumber) => debugHandlersRef.current.handleLoadLevel(getCampaignLevel(levelNumber - 1)),
      loadLevel: (level) => debugHandlersRef.current.handleLoadLevel(createAdHocLevel(level)),
      stats: () => stageRef.current?.stats() ?? null,
      cellScreenPoint: (q, r) => stageRef.current?.cellScreenPoint(q, r) ?? null,
    };
    const target = window as unknown as { extinguisherDebug?: DebugApi };

    target.extinguisherDebug = api;

    return () => {
      delete target.extinguisherDebug;
    };
  }, []);

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
    markBusy(true);
    commitSession(firstSession());
    setOutcome(null);
    setHudSteps(sessionRef.current.state.steps);
    setIntroDelayMs(0);
    setLoadKey((key) => key + 1);
    setStageMountKey((key) => key + 1);
    setPhase('starting');

    try {
      const [loadedBackgroundUrl] = await Promise.all([preloadBackgroundImage(), loadGameAssets(), waitForMenuTransition()]);

      if (startRequestRef.current !== requestId) {
        return;
      }

      setBackgroundUrl(loadedBackgroundUrl);
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
    stageReadyRef.current = true;
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

  const level = session.level;
  const lost = outcome?.result === 'lost' ? outcome : null;

  return (
    <main className={`app-shell app-shell--${phase}`} style={gameShellStyle}>
      {phase !== 'menu' ? (
        <section
          ref={attachPanel}
          className={phase === 'playing' ? 'game-panel' : 'game-panel game-panel--pending'}
          aria-label="Playable Project Extinguisher board"
          aria-hidden={phase !== 'playing'}
        >
          <PixiStage
            key={stageMountKey}
            ref={stageRef}
            active={phase === 'playing'}
            level={level.compiled}
            state={session.state}
            loadKey={loadKey}
            introDelayMs={introDelayMs}
            topInset={topInset}
            onReady={handleStageReady}
            onLoadError={handleStageLoadError}
            onBusyChange={markBusy}
            onIntroStart={() => gameAudio.play('levelIntro')}
            onEventStart={handleEventStart}
            onTimelineEnd={handleTimelineEnd}
            onMoveRequest={handleMove}
          />
        </section>
      ) : null}

      {showLoadingOverlay ? (
        <section className="loading-overlay" role="status" aria-live="polite" aria-label="Game loading status">
          <div className="loading-panel">
            <p className="loading-title">{loadError === null ? 'Loading Game' : 'Loading Failed'}</p>
            <p className="loading-copy">
              {loadError === null ? `Preparing the board... ${Math.round(assetProgress * 100)}%` : loadError}
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

      {phase === 'playing' ? (
        <header
          ref={hudRef}
          className={stageReady ? 'game-hud' : 'game-hud game-hud--hidden'}
          aria-label="Game HUD"
          data-level-id={level.id}
          data-steps={hudSteps}
        >
          <p className="hud-steps">Steps: {hudSteps}</p>
          <p className="hud-level">{level.label}</p>
          <div className="hud-actions">
            <button
              className="hud-button hud-undo"
              type="button"
              onClick={handleUndo}
              disabled={!canUndo(session)}
              aria-label="Undo last move"
            >
              Undo
            </button>
            <button className="hud-button hud-reset" type="button" onClick={handleRestart} aria-label="Reset current level">
              R Reset
            </button>
          </div>
        </header>
      ) : null}

      {phase === 'playing' && stageReady && outcome !== null ? (
        <section
          className="completion-overlay"
          data-result={outcome.result}
          aria-label={outcome.result === 'lost' ? 'Level failed' : 'Level complete'}
        >
          <div className="completion-panel">
            {lost !== null ? (
              <>
                <p className="completion-title">Level Failed</p>
                <p className="completion-copy">{LOSS_REASON_TEXT[lost.reason]}</p>
                <div className="completion-actions">
                  <button className="completion-button completion-button--secondary" type="button" data-action="undo" onClick={handleUndo}>
                    Undo
                  </button>
                  <button className="completion-button" type="button" data-action="retry" onClick={handleRestart}>
                    Try Again
                  </button>
                </div>
              </>
            ) : outcome.result === 'final' ? (
              <>
                <p className="completion-title">You Finished The Game</p>
                <button className="completion-button" type="button" data-action="menu" onClick={handleReturnToMenu}>
                  Return to Main Menu
                </button>
              </>
            ) : (
              <>
                <p className="completion-title">You Won</p>
                <button className="completion-button" type="button" data-action="next" onClick={handleNextLevel}>
                  Next Level
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
