// Tutorial hint glow (docs/game.md "Tutorial (trial)"): a soft ring on the hinted tiles that fades
// in, pulses three times and then stays steady, so the on-demand ticker stops again. Presentation
// only: it never touches gameplay state, the busy flag, or input.

import { Container, Graphics } from 'pixi.js';
import { easeOutCubic, linear, type Animator } from './animator';
import { hexCorners } from './glyphs';
import { TILE_VISUAL_RADIUS, type Point } from './layout';

const R = TILE_VISUAL_RADIUS;
const FADE_IN_MS = 300;
const PULSE_MS = 900;
const PULSES = 3;
const FADE_OUT_MS = 220;
const PULSE_DIM = 0.5;
const PULSE_GROW = 0.06;

const HALO_COLOR = 0xffe27a;
const RING_COLOR = 0xfff6c8;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function hexAt(graphics: Graphics, radius: number): Graphics {
  return graphics.poly(hexCorners(radius));
}

function sameCells(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell === b[i]);
}

interface Shown {
  readonly view: Container;
  readonly cells: readonly number[];
  readonly abort: AbortController;
}

export class HintGlow {
  private current: Shown | null = null;
  private leaving: Shown | null = null;
  private destroyed = false;

  public constructor(
    private readonly layer: Container,
    private readonly tileHome: (cell: number) => Point,
    private readonly animator: Animator,
  ) {}

  /** The cell the hint text is anchored to (the first hinted cell), or -1 when nothing glows. */
  public get anchorCell(): number {
    return this.current?.cells[0] ?? -1;
  }

  /**
   * Glows `cells`, or fades the glow out for null or an empty list. A new glow pulses; changing the
   * cells of a visible glow redraws it steady. The same cells again change nothing.
   */
  public show(cells: readonly number[] | null) {
    if (this.destroyed) {
      return;
    }

    if (cells === null || cells.length === 0) {
      this.hide();
      return;
    }

    if (this.current !== null && sameCells(this.current.cells, cells)) {
      return;
    }

    const steady = this.current !== null || prefersReducedMotion();

    this.drop(this.current);
    this.drop(this.leaving);
    this.leaving = null;

    const shown: Shown = { view: this.build(cells), cells: [...cells], abort: new AbortController() };

    this.current = shown;
    this.layer.addChild(shown.view);

    if (steady) {
      shown.view.alpha = 1;
      this.animator.requestRender();
      return;
    }

    this.pulse(shown);
  }

  public destroy() {
    this.destroyed = true;
    this.drop(this.current);
    this.drop(this.leaving);
    this.current = null;
    this.leaving = null;
  }

  private hide() {
    const shown = this.current;

    if (shown === null) {
      return;
    }

    this.current = null;
    shown.abort.abort();

    if (prefersReducedMotion()) {
      this.drop(shown);
      this.animator.requestRender();
      return;
    }

    this.drop(this.leaving);

    const fade: Shown = { ...shown, abort: new AbortController() };
    const from = shown.view.alpha;

    this.leaving = fade;
    void this.animator.tween(FADE_OUT_MS, (t) => {
      if (!fade.view.destroyed) fade.view.alpha = from * (1 - t);
    }, easeOutCubic, fade.abort.signal).then(() => {
      // Finished, aborted, or cancelled by the stage (undo): the glow is gone either way.
      this.drop(fade);

      if (this.leaving === fade) {
        this.leaving = null;
      }

      this.animator.requestRender();
    });
  }

  /** Fade in, three soft pulses, then steady. A cancelled pulse (undo) also ends steady. */
  private pulse(shown: Shown) {
    const total = FADE_IN_MS + PULSES * PULSE_MS;
    const rings = shown.view.children;

    void this.animator.tween(total, (t) => {
      const elapsed = t * total;

      if (elapsed < FADE_IN_MS) {
        shown.view.alpha = easeOutCubic(elapsed / FADE_IN_MS);
        return;
      }

      const wave = Math.sin((((elapsed - FADE_IN_MS) % PULSE_MS) / PULSE_MS) * Math.PI);

      shown.view.alpha = 1 - PULSE_DIM * wave * wave;

      for (const ring of rings) {
        ring.scale.set(1 + PULSE_GROW * wave);
      }
    }, linear, shown.abort.signal).then(() => {
      if (this.current !== shown || shown.view.destroyed) {
        return;
      }

      shown.view.alpha = 1;

      for (const ring of rings) {
        ring.scale.set(1);
      }

      this.animator.requestRender();
    });
  }

  private build(cells: readonly number[]): Container {
    const view = new Container();

    view.label = 'Hint Glow';
    view.alpha = 0;

    for (const cell of cells) {
      const ring = new Graphics();
      const home = this.tileHome(cell);

      hexAt(ring, R * 0.9).fill({ color: HALO_COLOR, alpha: 0.16 });
      hexAt(ring, R * 0.97).stroke({ width: 9, color: HALO_COLOR, alpha: 0.35 });
      hexAt(ring, R * 0.9).stroke({ width: 3.5, color: RING_COLOR, alpha: 0.95 });
      ring.position.set(home.x, home.y);
      view.addChild(ring);
    }

    return view;
  }

  private drop(shown: Shown | null) {
    if (shown === null) {
      return;
    }

    shown.abort.abort();

    if (!shown.view.destroyed) {
      shown.view.destroy({ children: true });
    }
  }
}
