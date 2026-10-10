// On-demand animation clock. The Pixi ticker runs only while tweens are active; when idle it stops
// and the stage is rendered once per change (`requestRender`), so an idle board costs no frames.

import { UPDATE_PRIORITY, type Application } from 'pixi.js';

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

interface Tween {
  start: number;
  duration: number;
  update: (t: number) => void;
  resolve: (completed: boolean) => void;
}

/** Frames rendered after the last tween ends before the ticker stops (flushes the final pose). */
const IDLE_FRAMES_BEFORE_STOP = 2;

export class Animator {
  private readonly tweens = new Set<Tween>();
  private idleFrames = 0;
  private renderFrame: number | null = null;
  private destroyed = false;
  /** Rendered frames (ticker frames plus on-demand renders); diagnostics only. */
  public frames = 0;

  public constructor(private readonly app: Application) {
    app.ticker.add(this.tick, this, UPDATE_PRIORITY.HIGH);
  }

  public get running(): boolean {
    return this.app.ticker.started;
  }

  public get active(): boolean {
    return this.tweens.size > 0;
  }

  /**
   * Runs `update(t)` with t from 0 to 1 over `durationMs`. Resolves true when finished, false when
   * cancelled. `update(1)` always runs on completion.
   */
  public tween(durationMs: number, update: (t: number) => void, ease: Ease = linear): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const tween: Tween = {
        start: performance.now(),
        duration: Math.max(1, durationMs),
        update: (t) => update(ease(t)),
        resolve,
      };

      tween.update(0);
      this.tweens.add(tween);
      this.idleFrames = 0;

      if (!this.app.ticker.started) {
        this.app.ticker.start();
      }
    });
  }

  public wait(durationMs: number): Promise<boolean> {
    return this.tween(durationMs, () => undefined);
  }

  /** Cancels every running tween (each resolves false) and renders the current pose. */
  public cancelAll() {
    const tweens = [...this.tweens];

    this.tweens.clear();

    for (const tween of tweens) {
      tween.resolve(false);
    }

    this.requestRender();
  }

  /** Renders once on the next frame unless the ticker is already rendering. */
  public requestRender() {
    if (this.destroyed || this.app.ticker.started || this.renderFrame !== null) {
      return;
    }

    this.renderFrame = window.requestAnimationFrame(() => {
      this.renderFrame = null;

      if (!this.destroyed && !this.app.ticker.started) {
        this.renderNow();
      }
    });
  }

  /** Renders synchronously (used after a resize, which clears the canvas). */
  public renderNow() {
    if (this.destroyed) {
      return;
    }

    this.frames += 1;
    this.app.render();
  }

  public destroy() {
    this.cancelAll();
    this.destroyed = true;

    if (this.renderFrame !== null) {
      window.cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }

    this.app.ticker?.remove(this.tick, this);
  }

  private tick() {
    this.frames += 1;

    if (this.tweens.size === 0) {
      this.idleFrames += 1;

      if (this.idleFrames >= IDLE_FRAMES_BEFORE_STOP) {
        this.app.ticker.stop();
      }

      return;
    }

    this.idleFrames = 0;
    const now = performance.now();

    for (const tween of [...this.tweens]) {
      const t = Math.min(1, (now - tween.start) / tween.duration);

      tween.update(t);

      if (t >= 1) {
        this.tweens.delete(tween);
        tween.resolve(true);
      }
    }
  }
}
