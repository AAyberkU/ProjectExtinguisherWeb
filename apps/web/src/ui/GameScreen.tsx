import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Ref } from 'react';
import { gameAudio } from '../game/audio';
import { legalMoves, type Dir, type EngineEvent, type LossReason } from '../game/engine';
import { CAMPAIGN_IDS, getCampaignLevel, isFinalCampaignLevel, type PlayableLevel } from '../game/levels';
import { continueIndex, nextIndex } from '../game/progress';
import { PixiStage, type PixiStageHandle } from '../game/renderer/PixiStage';
import type { HintAnchor, StageStats } from '../game/renderer/stageController';
import { saveStore } from '../game/save';
import { canUndo, createSession, sessionMove, sessionRestart, sessionUndo, type Session } from '../game/session';
import { CAMPAIGN_HINTS, HINT_TEXT, hintCells, usesHint, type TutorialKind } from '../game/tutorial';
import { Hud } from './Hud';
import { hasModifier, isEditableTarget } from './keys';
import { NextBadge } from './NextBadge';
import { TutorialHint } from './TutorialHint';

const RESTART_INTRO_DELAY_MS = 80;
const HUD_BOARD_GAP_PX = 10;
const DEFAULT_TOP_INSET_PX = 96;

/** `badge` turns true once the celebration's main beat is over and the next badge shows. */
type Outcome = Readonly<{ result: 'won' | 'final'; badge: boolean } | { result: 'lost'; reason: LossReason }>;

export interface GameScreenHandle {
  /** Loads a level at once (no menu transition); ignored until the stage is ready. */
  loadLevel(level: PlayableLevel): void;
  /** Campaign index of the level in play, or null for a development level. */
  levelIndex(): number | null;
  stats(): StageStats | null;
  cellScreenPoint(q: number, r: number): { x: number; y: number } | null;
  /** Cells a tap would move to right now, with their direction; diagnostics only. */
  moveTargets(): Array<{ dir: Dir; q: number; r: number }>;
}

type GameScreenProps = Readonly<{
  ref?: Ref<GameScreenHandle>;
  /** False during the menu transition: the board initializes hidden and the HUD is not rendered. */
  active: boolean;
  /** Level shown on mount; App remounts the screen for every start from the menu. */
  initialLevel: PlayableLevel;
  /** The level select is open over the game: every gameplay input is ignored. */
  paused: boolean;
  music: boolean;
  sfx: boolean;
  onToggleMusic(): void;
  onToggleSfx(): void;
  onReady(): void;
  onLoadError(error: Error): void;
  onOpenLevelSelect(): void;
  /** The badge after the last campaign level: back to the main menu. */
  onFinish(): void;
}>;

function badgeVisible(outcome: Outcome | null): boolean {
  return outcome !== null && outcome.result !== 'lost' && outcome.badge;
}

const NO_HINTS: readonly TutorialKind[] = [];
const subscribeSave = (listener: () => void) => saveStore.subscribe(listener);
const readTutorialsSeen = () => saveStore.data.tutorialsSeen;

/** Tutorial hints of a level that are not saved as seen, in the order they are shown. */
function pendingHints(levelIndex: number, seen: readonly string[]): TutorialKind[] {
  return (CAMPAIGN_HINTS[levelIndex] ?? NO_HINTS).filter((kind) => !seen.includes(kind));
}

function sameAnchor(a: HintAnchor | null, b: HintAnchor | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.radius === b.radius);
}

export function GameScreen(props: GameScreenProps) {
  const { ref, active, initialLevel, paused, music, sfx, onToggleMusic, onToggleSfx, onOpenLevelSelect } = props;
  const [session, setSession] = useState<Session>(() => createSession(initialLevel));
  const [hudSteps, setHudSteps] = useState(() => session.state.steps);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [introDelayMs, setIntroDelayMs] = useState(0);
  const [topInset, setTopInset] = useState(DEFAULT_TOP_INSET_PX);
  const [stageReady, setStageReady] = useState(false);
  // Hints appear once the board settles (after the intro, or after the move that used a hint).
  const [hintSettled, setHintSettled] = useState(false);
  const [hintAnchor, setHintAnchor] = useState<HintAnchor | null>(null);
  const tutorialsSeen = useSyncExternalStore(subscribeSave, readTutorialsSeen);
  const propsRef = useRef(props);
  const activeRef = useRef(active);
  const pausedRef = useRef(paused);
  const sessionRef = useRef<Session>(session);
  const outcomeRef = useRef<Outcome | null>(outcome);
  // Bumped whenever an outcome starts or is cleared, so a late celebration cannot show a stale badge.
  const outcomeTokenRef = useRef(0);
  const stageReadyRef = useRef(false);
  const busyRef = useRef(true);
  const panelRef = useRef<HTMLElement | null>(null);
  const hudRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<PixiStageHandle | null>(null);

  propsRef.current = props;
  activeRef.current = active;
  pausedRef.current = paused;
  outcomeRef.current = outcome;

  function commitSession(next: Session) {
    sessionRef.current = next;
    setSession(next);
  }

  function commitOutcome(next: Outcome | null) {
    outcomeRef.current = next;
    setOutcome(next);
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

  // The board fit reserves the HUD's actual height (it differs between landscape and portrait).
  useLayoutEffect(() => {
    const hud = hudRef.current;
    const panel = panelRef.current;

    if (!active || hud === null || panel === null) {
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
  }, [active]);

  function isPlayable(): boolean {
    return activeRef.current && stageReadyRef.current && stageRef.current !== null;
  }

  /** Player input (keys, HUD, board taps) also waits for the level select to close. */
  function acceptsInput(): boolean {
    return isPlayable() && !pausedRef.current;
  }

  function clearOutcome() {
    outcomeTokenRef.current += 1;
    commitOutcome(null);
    stageRef.current?.clearOutcome();
  }

  function startWin() {
    const { level } = sessionRef.current;
    const result = isFinalCampaignLevel(level) ? 'final' : 'won';
    const token = outcomeTokenRef.current + 1;

    outcomeTokenRef.current = token;

    commitOutcome({ result, badge: false });
    void (stageRef.current?.celebrate(result === 'final') ?? Promise.resolve()).then(() => {
      if (outcomeTokenRef.current === token) {
        commitOutcome({ result, badge: true });
      }
    });
  }

  function startLoss(reason: LossReason) {
    outcomeTokenRef.current += 1;
    commitOutcome({ result: 'lost', reason });
    stageRef.current?.showLoss(reason);
  }

  function handleMove(dir: Dir) {
    if (!acceptsInput() || busyRef.current) {
      return;
    }

    const moved = sessionMove(sessionRef.current, dir);

    if (moved === null) {
      return;
    }

    commitSession(moved.session);

    // Saved at once, not after the celebration: restarting, leaving or closing the tab must not lose the win.
    const { level } = moved.session;

    if (moved.session.state.status === 'won' && level.index >= 0) {
      saveStore.markCompleted(level.id);
    }

    markBusy(true);
    stageRef.current?.playMove(moved.events, moved.session.state);
  }

  function handleUndo() {
    if (!acceptsInput() || busyRef.current) {
      return;
    }

    const previous = sessionUndo(sessionRef.current);

    if (previous === null) {
      return;
    }

    commitSession(previous);
    clearOutcome();
    setHudSteps(previous.state.steps);
    stageRef.current?.showState(previous.state);
  }

  function loadSession(next: Session, delayMs: number) {
    commitSession(next);
    clearOutcome();
    setHudSteps(next.state.steps);
    setIntroDelayMs(delayMs);
    setLoadKey((key) => key + 1);
    setHintSettled(false);
    markBusy(true);
  }

  function handleRestart() {
    if (!acceptsInput()) {
      return;
    }

    gameAudio.play('restart');
    loadSession(sessionRestart(sessionRef.current), RESTART_INTRO_DELAY_MS);
  }

  function loadLevel(level: PlayableLevel) {
    if (!isPlayable()) {
      return;
    }

    loadSession(createSession(level), 0);
  }

  function handleBadge() {
    const current = outcomeRef.current;

    if (!acceptsInput() || current === null || current.result === 'lost' || !current.badge) {
      return;
    }

    if (current.result === 'final') {
      propsRef.current.onFinish();
      return;
    }

    const { level } = sessionRef.current;
    // A development level has no campaign successor; it continues where the save left off.
    const target = level.index >= 0
      ? nextIndex(CAMPAIGN_IDS, level.index)
      : continueIndex(CAMPAIGN_IDS, saveStore.completedSet());

    loadLevel(getCampaignLevel(target ?? 0));
  }

  function handleBadgeKey(event: KeyboardEvent) {
    const current = outcomeRef.current;

    if (current === null || current.result === 'lost') {
      // Enter and Space keep their normal meaning (activating a focused button).
      return;
    }

    if (!current.badge) {
      // The celebration is playing: a focused HUD button must not be activated (Undo would revert the win).
      event.preventDefault();
      return;
    }

    if (event.target instanceof Element && event.target.closest('.next-badge') !== null) {
      // The focused badge activates itself through its click.
      return;
    }

    // Enter means "next" while the badge waits, even if another button kept the focus.
    event.preventDefault();
    handleBadge();
  }

  function handleTimelineEnd() {
    const { state } = sessionRef.current;

    setHudSteps(state.steps);
    setHintSettled(true);

    if (state.status === 'won') {
      startWin();
    } else if (state.status === 'lost') {
      startLoss(state.lossReason ?? 'stuck');
    }
  }

  /** A hint is saved as seen as soon as its mechanic is used (also one queued behind another hint). */
  function markUsedHints(event: EngineEvent) {
    const { level, state } = sessionRef.current;
    const used = pendingHints(level.index, saveStore.data.tutorialsSeen)
      .filter((kind) => usesHint(level.compiled, kind, event, state.phase));

    for (const kind of used) {
      saveStore.markTutorialSeen(kind);
    }

    if (used.length > 0) {
      // A following hint waits until this move has played.
      setHintSettled(false);
    }
  }

  function handleEventStart(event: EngineEvent) {
    gameAudio.playEvent(event);
    markUsedHints(event);

    if (event.type === 'steps') {
      setHudSteps(event.after);
    }
  }

  function handleStageReady() {
    stageReadyRef.current = true;
    setStageReady(true);
    propsRef.current.onReady();
  }

  function refreshHintAnchor() {
    const next = stageRef.current?.hintAnchor() ?? null;
    setHintAnchor((current) => (sameAnchor(current, next) ? current : next));
  }

  function handleStageLoadError(error: Error) {
    stageReadyRef.current = false;
    setStageReady(false);
    propsRef.current.onLoadError(error);
  }

  // Handlers are read through a ref so the long-lived listener and handle always see the current state.
  const handlersRef = useRef({ handleMove, handleUndo, handleRestart, handleBadgeKey, loadLevel, refreshHintAnchor });
  handlersRef.current = { handleMove, handleUndo, handleRestart, handleBadgeKey, loadLevel, refreshHintAnchor };

  useImperativeHandle(ref, () => ({
    loadLevel: (level) => handlersRef.current.loadLevel(level),
    levelIndex: () => {
      const { index } = sessionRef.current.level;
      return index >= 0 ? index : null;
    },
    stats: () => stageRef.current?.stats() ?? null,
    cellScreenPoint: (q, r) => stageRef.current?.cellScreenPoint(q, r) ?? null,
    moveTargets: () => {
      const { level: current, state } = sessionRef.current;

      return legalMoves(current.compiled, state).map(({ dir, target }) => {
        const { q, r } = current.compiled.cells[target];
        return { dir, q, r };
      });
    },
  }), []);

  // Gameplay keys. Esc, M and V are shell keys owned by App (they also work outside the game).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!activeRef.current || pausedRef.current || event.repeat || hasModifier(event) || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const handlers = handlersRef.current;

      // Moves are taps or clicks on the board only; keyboard movement was dropped as unintuitive.
      if (key === 'z') {
        event.preventDefault();
        handlers.handleUndo();
      } else if (key === 'r') {
        event.preventDefault();
        handlers.handleRestart();
      } else if (key === 'enter' || key === ' ') {
        handlers.handleBadgeKey(event);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const level = session.level;
  const lossReason = outcome?.result === 'lost' ? outcome.reason : null;
  const hintKind = pendingHints(level.index, tutorialsSeen)[0] ?? null;
  const { phase, mask } = session.state;
  const hintCellList = useMemo(
    () => (hintKind === null ? [] : hintCells(level.compiled, hintKind, { phase, mask })),
    [level, hintKind, phase, mask],
  );
  // Never shown over the level select or a win or loss; it comes back after undo or restart.
  const hintShown = active && stageReady && hintSettled && !paused && outcome === null && hintCellList.length > 0;
  const hintKey = hintShown ? hintCellList.join(',') : '';

  // The handler ref is read inside, so this runs only when the glowing cells change.
  useLayoutEffect(() => {
    stageRef.current?.setHint(hintKey === '' ? null : hintKey.split(',').map(Number));
    handlersRef.current.refreshHintAnchor();
  }, [hintKey]);

  return (
    <>
      <section
        ref={attachPanel}
        className={active ? 'game-panel' : 'game-panel game-panel--pending'}
        aria-label="Playable Project Extinguisher board"
        aria-hidden={!active}
        data-outcome={outcome?.result}
        data-loss-reason={lossReason ?? undefined}
      >
        <PixiStage
          ref={stageRef}
          active={active}
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
          onLayout={refreshHintAnchor}
        />
        <TutorialHint
          text={hintShown && hintKind !== null ? HINT_TEXT[hintKind] : null}
          anchor={hintShown ? hintAnchor : null}
          minTop={topInset}
        />
        <NextBadge
          visible={active && stageReady && badgeVisible(outcome)}
          final={outcome?.result === 'final'}
          onActivate={handleBadge}
        />
      </section>

      {active ? (
        <Hud
          ref={hudRef}
          levelLabel={level.label}
          levelId={level.id}
          steps={hudSteps}
          canUndo={canUndo(session)}
          music={music}
          sfx={sfx}
          hidden={!stageReady}
          lossReason={lossReason}
          onUndo={handleUndo}
          onRestart={handleRestart}
          onToggleMusic={onToggleMusic}
          onToggleSfx={onToggleSfx}
          onMenu={() => {
            if (acceptsInput()) {
              onOpenLevelSelect();
            }
          }}
        />
      ) : null}
    </>
  );
}
