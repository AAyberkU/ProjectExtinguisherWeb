import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { initAssets, loadGameAssets, resolveAssetUrl, subscribeGameAssetProgress } from './game/assets';
import { gameAudio } from './game/audio';
import type { Dir, PuzzleLabLevel } from './game/engine';
import { CAMPAIGN, CAMPAIGN_IDS, createAdHocLevel, getCampaignLevel, type PlayableLevel } from './game/levels';
import { continueIndex, hasProgress, isUnlocked } from './game/progress';
import { setBoardFill } from './game/renderer/layout';
import { saveStore, type SaveData } from './game/save';
import { GameScreen, type GameScreenHandle } from './ui/GameScreen';
import { hasModifier, isEditableTarget } from './ui/keys';
import { LevelSelect, type LevelSelectEntry } from './ui/LevelSelect';
import { MainMenu } from './ui/MainMenu';

type GameShellStyle = CSSProperties & Readonly<{
  '--game-background-image'?: string;
}>;

const MENU_TRANSITION_MS = 900;
const LOAD_ERROR_MESSAGE = 'Some game files could not be loaded.';

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
/** The level select overlay; `currentIndex` is the level in play, or the continue level from the menu. */
type LevelSelectState = Readonly<{ currentIndex: number | null }>;

const subscribeSave = (listener: () => void) => saveStore.subscribe(listener);
const readSave = (): SaveData => saveStore.data;

/** The save does not touch audio; the toggles are applied here at startup and on every change. */
function applySavedAudio() {
  gameAudio.setMusicEnabled(saveStore.data.music);
  gameAudio.setSfxEnabled(saveStore.data.sfx);
}

function toggleMusic() {
  saveStore.setMusic(!saveStore.data.music);
  applySavedAudio();
}

function toggleSfx() {
  saveStore.setSfx(!saveStore.data.sfx);
  applySavedAudio();
}

type DebugApi = Readonly<{
  goTo: (levelNumber: number) => void;
  loadLevel: (level: PuzzleLabLevel) => void;
  stats: () => unknown;
  cellScreenPoint: (q: number, r: number) => { x: number; y: number } | null;
  /** Cells a tap would move to right now (for tap-driven test scripts). */
  moveTargets: () => Array<{ dir: Dir; q: number; r: number }>;
  /** Share of the free area the board fills (0.3-1); returns the applied value. */
  setBoardFill: (value: number) => number;
  /** Marks every campaign level completed. */
  unlockAll: () => void;
  /** Clears the save (progress and audio toggles). */
  resetSave: () => void;
}>;

export function App() {
  const save = useSyncExternalStore(subscribeSave, readSave);
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [startIndex, setStartIndex] = useState(0);
  const [levelSelect, setLevelSelect] = useState<LevelSelectState | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [assetProgress, setAssetProgress] = useState(0);
  const [gameMountKey, setGameMountKey] = useState(0);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitionResolveRef = useRef<(() => void) | null>(null);
  const startRequestRef = useRef(0);
  const stageReadyRef = useRef(false);
  const phaseRef = useRef<AppPhase>('menu');
  const levelSelectRef = useRef<LevelSelectState | null>(null);
  const gameRef = useRef<GameScreenHandle | null>(null);
  const assetsReady = assetProgress >= 1 && backgroundUrl !== null;
  // The board initializes hidden during the menu transition; the panel only covers real waits.
  const showLoadingOverlay = loadError !== null
    || (phase === 'starting' && !assetsReady)
    || (phase === 'playing' && !stageReady);
  const gameShellStyle: GameShellStyle = backgroundUrl === null ? {} : { '--game-background-image': `url(${backgroundUrl})` };
  const completed = useMemo(() => new Set(save.completed), [save.completed]);
  const levelEntries = useMemo<readonly LevelSelectEntry[]>(() => CAMPAIGN.map((level) => ({
    index: level.index,
    label: level.label,
    chapter: level.chapter,
    position: level.position,
    unlocked: isUnlocked(CAMPAIGN_IDS, level.index, completed),
    completed: completed.has(level.id),
  })), [completed]);

  phaseRef.current = phase;
  levelSelectRef.current = levelSelect;

  function commitLevelSelect(next: LevelSelectState | null) {
    levelSelectRef.current = next;
    setLevelSelect(next);
  }

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
      // Starting the game owns the visible retry state.
    });
    void loadGameAssets().catch(() => {
      // Starting the game owns the visible retry state. This attempt only warms the cache.
    });
  }, []);

  useEffect(() => {
    // The saved toggles must be in place before music first starts.
    applySavedAudio();
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

  function isGameReady(): boolean {
    return phaseRef.current === 'playing' && stageReadyRef.current;
  }

  function openLevelSelect() {
    if (phaseRef.current === 'menu') {
      commitLevelSelect({ currentIndex: continueIndex(CAMPAIGN_IDS, saveStore.completedSet()) });
    } else if (isGameReady()) {
      commitLevelSelect({ currentIndex: gameRef.current?.levelIndex() ?? null });
    }
  }

  function closeLevelSelect() {
    commitLevelSelect(null);
  }

  function returnToMenu() {
    clearTransitionTimeout();
    commitLevelSelect(null);
    stageReadyRef.current = false;
    setStageReady(false);
    setPhase('menu');
  }

  /** In game a level loads at once, like the next badge; from the menu it starts with the transition. */
  function handleSelectLevel(index: number) {
    commitLevelSelect(null);

    if (phaseRef.current === 'menu') {
      void startGame(index);
    } else if (isGameReady()) {
      gameRef.current?.loadLevel(getCampaignLevel(index));
    }
  }

  function handleLevelSelectMainMenu() {
    if (phaseRef.current === 'menu') {
      closeLevelSelect();
    } else {
      returnToMenu();
    }
  }

  function handlePlay() {
    const index = continueIndex(CAMPAIGN_IDS, saveStore.completedSet());

    // Every level is completed: there is nothing to continue, so the player picks one.
    if (index === null) {
      openLevelSelect();
    } else {
      void startGame(index);
    }
  }

  // Shell keys work on every screen: Esc for the level select, M and V for the audio toggles.
  const shellKeysRef = useRef({ openLevelSelect, closeLevelSelect });
  shellKeysRef.current = { openLevelSelect, closeLevelSelect };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || hasModifier(event) || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const shell = shellKeysRef.current;

      if (key === 'escape') {
        event.preventDefault();

        if (levelSelectRef.current !== null) {
          shell.closeLevelSelect();
        } else if (phaseRef.current === 'playing') {
          shell.openLevelSelect();
        }
      } else if (key === 'm') {
        event.preventDefault();
        toggleMusic();
      } else if (key === 'v') {
        event.preventDefault();
        toggleSfx();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /** Debug level loads work from the game only; an open level select closes. */
  function debugLoadLevel(level: PlayableLevel) {
    if (!isGameReady()) {
      return;
    }

    commitLevelSelect(null);
    gameRef.current?.loadLevel(level);
  }

  // Developer access to any level and to the save (docs/levels.md); not part of release builds.
  const debugHandlersRef = useRef({ loadLevel: debugLoadLevel });
  debugHandlersRef.current = { loadLevel: debugLoadLevel };

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const api: DebugApi = {
      goTo: (levelNumber) => debugHandlersRef.current.loadLevel(getCampaignLevel(levelNumber - 1)),
      loadLevel: (level) => debugHandlersRef.current.loadLevel(createAdHocLevel(level)),
      stats: () => gameRef.current?.stats() ?? null,
      cellScreenPoint: (q, r) => gameRef.current?.cellScreenPoint(q, r) ?? null,
      moveTargets: () => gameRef.current?.moveTargets() ?? [],
      setBoardFill: (value) => {
        const applied = setBoardFill(value);
        window.dispatchEvent(new Event('resize'));
        return applied;
      },
      unlockAll: () => saveStore.markAllCompleted(CAMPAIGN_IDS),
      resetSave: () => {
        saveStore.reset();
        applySavedAudio();
      },
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

  async function startGame(index: number) {
    const requestId = startRequestRef.current + 1;

    startRequestRef.current = requestId;
    clearTransitionTimeout();
    setLoadError(null);
    stageReadyRef.current = false;
    setStageReady(false);
    commitLevelSelect(null);
    setStartIndex(index);
    // A fresh game screen per start: new session, new stage.
    setGameMountKey((key) => key + 1);
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
    void startGame(startIndex);
  }

  return (
    <main className={`app-shell app-shell--${phase}`} style={gameShellStyle}>
      {phase !== 'menu' ? (
        <GameScreen
          key={gameMountKey}
          ref={gameRef}
          active={phase === 'playing'}
          initialLevel={getCampaignLevel(startIndex)}
          paused={levelSelect !== null}
          music={save.music}
          sfx={save.sfx}
          onToggleMusic={toggleMusic}
          onToggleSfx={toggleSfx}
          onReady={handleStageReady}
          onLoadError={handleStageLoadError}
          onOpenLevelSelect={openLevelSelect}
          onFinish={returnToMenu}
        />
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
        <MainMenu hasProgress={hasProgress(CAMPAIGN_IDS, completed)} onPlay={handlePlay} onLevelSelect={openLevelSelect} />
      ) : null}

      {levelSelect !== null ? (
        <LevelSelect
          entries={levelEntries}
          currentIndex={levelSelect.currentIndex}
          onSelect={handleSelectLevel}
          onClose={closeLevelSelect}
          onMainMenu={handleLevelSelectMainMenu}
        />
      ) : null}
    </main>
  );
}
