// Owns the Pixi application for the game board: board loads, move timelines, input mapping, fit,
// and on-demand rendering. Framework-free; PixiStage.tsx wires it into React.

import { Application, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { legalMoves, type CompiledLevel, type Dir, type EngineEvent, type LossReason, type PlayState } from '../engine';
import { Animator } from './animator';
import { BoardView } from './boardView';
import { OutcomeEffects, type OutcomeKind } from './effects';
import { HintGlow } from './hintGlow';
import { boardBounds, cellAtPoint, cellCenter, fitBoard, TILE_VISUAL_RADIUS, type Bounds } from './layout';
import { playTimeline } from './timeline';

export interface StageCallbacks {
  onBusyChange(busy: boolean): void;
  onIntroStart(): void;
  onEventStart(event: EngineEvent): void;
  /** The intro or a move timeline finished; the presented state is now final. */
  onTimelineEnd(): void;
  onMoveRequest(dir: Dir): void;
  /** The board's screen placement changed (load, resize, HUD inset). */
  onLayout(): void;
}

/** Screen placement (CSS pixels within the canvas) of the tutorial hint's anchor cell. */
export interface HintAnchor {
  x: number;
  y: number;
  /** Drawn tile radius on screen. */
  radius: number;
}

export interface StageStats {
  tickerStarted: boolean;
  frames: number;
  busy: boolean;
  /** Outcome effect shown on the board (animating or resting), or null. */
  outcome: OutcomeKind | null;
}

/** An outcome requested while a timeline still runs; it starts when the timeline ends. */
interface PendingOutcome {
  start(): void;
  drop(): void;
}

export class StageController {
  private readonly animator: Animator;
  private board: BoardView | null = null;
  private outcome: OutcomeEffects | null = null;
  private hint: HintGlow | null = null;
  private pendingOutcomes: PendingOutcome[] = [];
  private bounds: Bounds | null = null;
  private state: PlayState | null = null;
  private generation = 0;
  private busy = false;
  private topInset = 0;

  public constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly callbacks: () => StageCallbacks,
    private readonly resolution: () => number,
  ) {
    this.animator = new Animator(app);
    app.stage.eventMode = 'static';
    app.stage.on('pointertap', this.handleTap, this);
    app.stage.on('pointermove', this.handleHover, this);
    this.syncSize();
  }

  public get stats(): StageStats {
    return {
      tickerStarted: this.animator.running,
      frames: this.animator.frames,
      busy: this.busy,
      outcome: this.outcome?.kind ?? null,
    };
  }

  /** Screen point (CSS pixels within the canvas) of a cell centre, or null; diagnostics only. */
  public cellScreenPoint(q: number, r: number): { x: number; y: number } | null {
    const board = this.board;
    const cell = board?.level.cellAt(q, r) ?? -1;

    if (board === null || cell < 0) {
      return null;
    }

    const { x, y } = cellCenter(board.level, cell);
    return { x: board.root.x + x * board.root.scale.x, y: board.root.y + y * board.root.scale.y };
  }

  /**
   * Tutorial glow on `cells` (fades in, pulses three times, then stays steady), or fades it out for
   * null. A level load removes it. Never changes busy or gameplay state.
   */
  public setHint(cells: readonly number[] | null) {
    this.hint?.show(cells);
  }

  /** Where the glowing hint's first cell is on screen, or null when no hint glows. */
  public hintAnchor(): HintAnchor | null {
    const board = this.board;
    const cell = this.hint?.anchorCell ?? -1;

    if (board === null || cell < 0) {
      return null;
    }

    const { x, y } = cellCenter(board.level, cell);
    const scale = board.root.scale.x;

    return { x: board.root.x + x * scale, y: board.root.y + y * board.root.scale.y, radius: TILE_VISUAL_RADIUS * scale };
  }

  public destroy() {
    this.generation += 1;
    this.clearOutcome();
    this.hint?.destroy();
    this.hint = null;
    this.outcome?.destroy();
    this.outcome = null;
    this.animator.destroy();
    this.board?.destroy();
    this.board = null;
  }

  /**
   * Win celebration on the board. Resolves after the main beat (about 1 s; 1.4 s when `final`), or
   * at once if the outcome is cleared first, so callers must still check their own state. Requested
   * during a timeline, it starts when the timeline ends. Never changes busy or gameplay state.
   */
  public celebrate(final: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.whenSettled({
        start: () => void (this.outcome?.celebrate(final) ?? Promise.resolve()).then(resolve),
        drop: resolve,
      });
    });
  }

  /** Loss feedback on the board; the board then rests in a dimmed, ended state until cleared. */
  public showLoss(reason: LossReason) {
    this.whenSettled({ start: () => this.outcome?.showLoss(reason), drop: () => undefined });
  }

  /** Stops and removes any outcome effect at once and restores the normal board. */
  public clearOutcome() {
    const pending = this.pendingOutcomes;

    this.pendingOutcomes = [];

    for (const outcome of pending) {
      outcome.drop();
    }

    this.outcome?.clear();
  }

  /** Builds the board for a level state and plays the intro (level start or restart). */
  public load(level: CompiledLevel, state: PlayState, introDelayMs = 0) {
    const generation = ++this.generation;

    this.clearOutcome();
    this.setBusy(true);
    this.animator.cancelAll();
    this.hint?.destroy();
    this.outcome?.destroy();
    this.board?.destroy();
    this.board = new BoardView(level, state, this.animator, this.resolution());
    this.outcome = new OutcomeEffects(this.board, this.animator);
    this.hint = new HintGlow(this.board.hintRig.layer, this.board.hintRig.tileHome, this.animator);
    this.bounds = boardBounds(level);
    this.state = state;
    this.app.stage.addChild(this.board.root);
    this.applyFit();

    void this.board
      .playIntro(introDelayMs, () => {
        if (generation === this.generation) this.callbacks().onIntroStart();
      })
      .then((finished) => {
        if (finished && generation === this.generation) {
          this.finishTimeline();
        }
      });
  }

  /** Plays a move's events, then settles on `state`. Input stays locked until it ends. */
  public playMove(events: readonly EngineEvent[], state: PlayState) {
    const board = this.board;

    if (board === null) {
      return;
    }

    const generation = ++this.generation;

    this.clearOutcome();
    this.state = state;
    this.setBusy(true);
    board.clearHighlights();
    this.animator.requestRender();

    void playTimeline(board, events, {
      onEventStart: (event) => this.callbacks().onEventStart(event),
      isCurrent: () => generation === this.generation,
    }).then((finished) => {
      if (finished && generation === this.generation) {
        this.finishTimeline();
      }
    });
  }

  /** Shows a state at once (undo). */
  public showState(state: PlayState) {
    if (this.board === null) {
      return;
    }

    this.generation += 1;
    this.clearOutcome();
    this.animator.cancelAll();
    this.state = state;
    this.board.showState(state);
    this.updateHighlights();
    this.setBusy(false);
    this.animator.requestRender();
  }

  public setTopInset(topInset: number) {
    if (Math.abs(topInset - this.topInset) < 0.5) {
      return;
    }

    this.topInset = topInset;
    this.applyFit();
    this.renderIdle();
  }

  /**
   * Matches the renderer to the host size and the current device pixel ratio; renders at once so a
   * resize never shows a blank canvas.
   */
  public syncSize() {
    const { width, height } = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const resolution = this.resolution();
    const renderer = this.app.renderer;
    const source = renderer.view.texture.source;

    renderer.resize(w, h, resolution);

    // Browser zoom changes the CSS size and the pixel ratio together, so the backing pixel size often
    // stays the same. Pixi then skips its resize event and leaves the screen, the root render target,
    // and the canvas CSS size at the old zoom (the board drifts off-centre). Replay the event.
    if (renderer.screen.width !== source.width || renderer.screen.height !== source.height) {
      source.emit('resize', source);
      source.resizeCanvas();
      renderer.resize(w, h, resolution);
    }

    const { screen } = renderer;

    this.app.stage.hitArea = new Rectangle(0, 0, screen.width, screen.height);
    this.board?.setResolution(resolution);
    this.applyFit();
    this.renderIdle();
  }

  private renderIdle() {
    if (!this.animator.running) {
      this.animator.renderNow();
    }
  }

  private applyFit() {
    if (this.board === null || this.bounds === null) {
      return;
    }

    const fit = fitBoard(this.bounds, this.app.screen.width, this.app.screen.height, this.topInset);

    this.board.root.position.set(fit.x, fit.y);
    this.board.root.scale.set(fit.scale);
    this.callbacks().onLayout();
  }

  private finishTimeline() {
    const board = this.board;
    const state = this.state;

    if (board === null || state === null) {
      return;
    }

    board.showState(state);
    this.updateHighlights();
    this.setBusy(false);
    this.animator.requestRender();
    this.startPendingOutcomes();
    this.callbacks().onTimelineEnd();
  }

  private whenSettled(outcome: PendingOutcome) {
    if (this.board === null || this.outcome === null) {
      outcome.drop();
    } else if (this.busy) {
      this.pendingOutcomes.push(outcome);
    } else {
      outcome.start();
    }
  }

  private startPendingOutcomes() {
    const pending = this.pendingOutcomes;

    this.pendingOutcomes = [];

    for (const outcome of pending) {
      outcome.start();
    }
  }

  private updateHighlights() {
    if (this.board === null || this.state === null) {
      return;
    }

    this.board.setHighlights(legalMoves(this.board.level, this.state));
  }

  private setBusy(busy: boolean) {
    if (busy && this.board !== null) {
      this.board.clearHighlights();
    }

    if (this.busy !== busy) {
      this.busy = busy;
      this.host.style.cursor = '';
    }

    // Always report: a fresh load must re-assert busy even if it was already set.
    this.callbacks().onBusyChange(busy);
  }

  private cellUnder(event: FederatedPointerEvent): number {
    const board = this.board;

    if (board === null) {
      return -1;
    }

    const root = board.root;
    const point = {
      x: (event.global.x - root.x) / root.scale.x,
      y: (event.global.y - root.y) / root.scale.y,
    };

    return cellAtPoint(board.level, point);
  }

  private handleTap(event: FederatedPointerEvent) {
    if (this.busy || this.board === null) {
      return;
    }

    const dir = this.board.targetDir(this.cellUnder(event));

    if (dir !== undefined) {
      this.callbacks().onMoveRequest(dir);
    }
  }

  private handleHover(event: FederatedPointerEvent) {
    const target = !this.busy && this.board !== null && this.board.targetDir(this.cellUnder(event)) !== undefined;
    this.host.style.cursor = target ? 'pointer' : '';
  }
}
