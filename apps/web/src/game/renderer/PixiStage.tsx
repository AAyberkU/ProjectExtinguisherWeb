import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Application } from 'pixi.js';
import { getRenderResolution, loadGameAssets } from '../assets';
import type { CompiledLevel, Dir, EngineEvent, PlayState } from '../engine';
import { StageController, type StageCallbacks, type StageStats } from './stageController';

export interface PixiStageHandle {
  /** Plays a move's engine events and settles on `state`. */
  playMove(events: readonly EngineEvent[], state: PlayState): void;
  /** Shows a state at once (undo). */
  showState(state: PlayState): void;
  stats(): StageStats | null;
  /** Screen point of cell (q, r) inside the canvas; diagnostics only. */
  cellScreenPoint(q: number, r: number): { x: number; y: number } | null;
}

type PixiStageProps = Readonly<{
  ref?: Ref<PixiStageHandle>;
  /** While false, Pixi initializes off-screen but the board is not drawn and onReady is not called. */
  active: boolean;
  level: CompiledLevel;
  /** State shown when `loadKey` changes (level start or restart). */
  state: PlayState;
  /** Changing it rebuilds the board for `level`/`state` and plays the intro. */
  loadKey: number;
  introDelayMs: number;
  /** Space reserved above the board for the HUD, in CSS pixels. */
  topInset: number;
  onReady: () => void;
  onLoadError: (error: Error) => void;
  onBusyChange: (busy: boolean) => void;
  onIntroStart: () => void;
  onEventStart: (event: EngineEvent) => void;
  onTimelineEnd: () => void;
  onMoveRequest: (dir: Dir) => void;
}>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Failed to initialize the game board.');
}

export function PixiStage(props: PixiStageProps) {
  const { ref, active, level, state, loadKey, introDelayMs, topInset } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<StageController | null>(null);
  const propsRef = useRef(props);
  const loadedKeyRef = useRef<number | null>(null);
  const readyReportedRef = useRef(false);
  const [pixiReady, setPixiReady] = useState(false);

  propsRef.current = props;

  useImperativeHandle(ref, () => ({
    playMove: (events, nextState) => controllerRef.current?.playMove(events, nextState),
    showState: (nextState) => controllerRef.current?.showState(nextState),
    stats: () => controllerRef.current?.stats ?? null,
    cellScreenPoint: (q, r) => controllerRef.current?.cellScreenPoint(q, r) ?? null,
  }), []);

  useEffect(() => {
    const host = hostRef.current;

    if (host === null) {
      return undefined;
    }

    const mountHost = host;
    let disposed = false;
    let app: Application | null = null;
    let controller: StageController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;

    const callbacks = (): StageCallbacks => ({
      onBusyChange: (busy) => propsRef.current.onBusyChange(busy),
      onIntroStart: () => propsRef.current.onIntroStart(),
      onEventStart: (event) => propsRef.current.onEventStart(event),
      onTimelineEnd: () => propsRef.current.onTimelineEnd(),
      onMoveRequest: (dir) => propsRef.current.onMoveRequest(dir),
    });

    const scheduleResize = () => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;

        if (!disposed) {
          controller?.syncSize();
        }
      });
    };

    async function mount() {
      let initializingApp: Application | null = null;

      try {
        await loadGameAssets();

        if (disposed) {
          return;
        }

        const { width, height } = mountHost.getBoundingClientRect();
        const nextApp = new Application();
        initializingApp = nextApp;
        await nextApp.init({
          antialias: true,
          backgroundAlpha: 0,
          width: Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
          resolution: getRenderResolution(),
          autoDensity: true,
          // Rendering is on demand: the ticker only runs while something animates.
          autoStart: false,
        });

        if (disposed) {
          nextApp.destroy(true, { children: true });
          return;
        }

        initializingApp = null;
        app = nextApp;
        mountHost.appendChild(nextApp.canvas);
        controller = new StageController(nextApp, mountHost, callbacks, getRenderResolution);
        controller.setTopInset(propsRef.current.topInset);
        controllerRef.current = controller;

        resizeObserver = new ResizeObserver(scheduleResize);
        resizeObserver.observe(mountHost);
        window.addEventListener('resize', scheduleResize);
        window.addEventListener('orientationchange', scheduleResize);
        setPixiReady(true);
      } catch (error) {
        if (initializingApp !== null) {
          try {
            initializingApp.destroy(true, { children: true });
          } catch {
            // Pixi may reject before its renderer is initialized enough to destroy.
          }
        }

        if (!disposed) {
          propsRef.current.onLoadError(toError(error));
        }
      }
    }

    void mount();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);

      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

      controller?.destroy();
      controllerRef.current = null;
      app?.destroy(true, { children: true });
    };
  }, []);

  // Layout effect: the board load (and its busy flag) lands in the same commit as the HUD change.
  useLayoutEffect(() => {
    const controller = controllerRef.current;

    if (!pixiReady || !active || controller === null || loadedKeyRef.current === loadKey) {
      return;
    }

    loadedKeyRef.current = loadKey;
    controller.load(level, state, introDelayMs);

    if (!readyReportedRef.current) {
      readyReportedRef.current = true;
      propsRef.current.onReady();
    }
    // The board reloads only when loadKey changes; level and state are read at that moment.
  }, [pixiReady, active, loadKey]);

  useLayoutEffect(() => {
    controllerRef.current?.setTopInset(topInset);
  }, [topInset, pixiReady]);

  return <div ref={hostRef} className="pixi-stage" />;
}
