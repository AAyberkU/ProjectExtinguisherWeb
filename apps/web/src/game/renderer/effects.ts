// Outcome effects on the board: the win celebration and the loss feedback. Presentation only: they
// never touch gameplay state or the stage busy flag, every tween runs under one abort signal, and
// `clear` restores the board at once. Distances are board units (they scale with the cell size).

import { Assets, Container, Graphics, GraphicsContext, Sprite } from 'pixi.js';
import type { LossReason } from '../engine';
import { easeInOutSine, easeOutBack, easeOutCubic, linear, type Animator } from './animator';
import type { BoardView, OutcomeRig } from './boardView';
import { hexCorners } from './glyphs';
import { TILE_VISUAL_RADIUS, type Point } from './layout';

export type OutcomeKind = 'celebrate' | 'celebrate-final' | LossReason;

const R = TILE_VISUAL_RADIUS;

// ---------- win ----------

/** Larry's dance; the sum of its phases is the main beat that `celebrate` resolves after. */
const WIN_DANCE: readonly DancePhase[] = [
  crouch(110, 0.18),
  hop(430, R * 1.3, 1),
  land(130, 0.16),
  hop(210, R * 0.45, 0),
  land(120, 0.08),
]; // 1000 ms
const WIN_FINAL_DANCE: readonly DancePhase[] = [
  crouch(120, 0.2),
  hop(520, R * 1.8, 2),
  land(130, 0.18),
  hop(240, R * 0.6, 0),
  land(100, 0.1),
  hop(170, R * 0.3, 0),
  land(90, 0.06),
]; // 1370 ms
/** Reduced motion: no hops; Larry and the finish tile pulse once while bubbles rise. */
const WIN_REDUCED_BEAT_MS = 500;
/** Ambient tail after the beat; bounded so the on-demand ticker stops again. */
const WIN_TAIL_MS = 1400;
const WIN_FINAL_TAIL_MS = 2200;

const WIN_BURST_COUNT = 34;
const WIN_FINAL_BURST_COUNT = 46;
/** Final level: a second volley of small fountains around the finish (count per fountain). */
const WIN_FINAL_VOLLEY_COUNT = 9;
/** Fountain launch speed and gravity, in cell radii per second (squared). */
const WIN_BURST_SPEED = R * 10;
const WIN_FINAL_BURST_SPEED = R * 12;
const PARTICLE_GRAVITY = R * 15;
const WIN_RING_MS = 650;
const WIN_GLOW_MS = 320;
const WIN_TILE_PULSE_MS = 380;
/** Final level: every tile bounces in a wave spreading from the finish, one hex ring per step. */
const RIPPLE_STEP_MS = 55;
const RIPPLE_MS = 320;

const GLOW_FILL = 0xffe27a;
const GLOW_EDGE = 0xfff3b0;
const RING_WATER = 0xbfeaff;
const RING_GOLD = 0xffd84a;

// ---------- loss ----------

const STUCK_SHAKE_MS = 420;
const SLUMP_MS = 560;
const LOSS_DIM_MS = 360;
const LOSS_REDUCED_MS = 300;
/** Calm ended state: the scene dims a little and Larry keeps a muted tint until cleared. */
const LOSS_SCENE_TINT = 0xd2cce0;
const STUCK_FLASH_TINT = 0xff8f8f;
const STUCK_LARRY_TINT = 0xd8bcc6;
const STUCK_RING = 0xff6b6b;
const SLUMP_LARRY_TINT = 0xa6a4b6;
const SLUMP_LARRY_ALPHA = 0.88;

// ---------- particles ----------

export type ParticleKind = 'drop' | 'foam' | 'spark';

/**
 * Optional celebration particle art (docs/art.md "UI art"). When the asset manifest has an alias,
 * its sprite replaces the code-drawn placeholder; code still multiplies and moves them.
 */
export const PARTICLE_ART: Readonly<Record<ParticleKind, string>> = {
  drop: 'fx_drop',
  foam: 'fx_foam',
  spark: 'fx_spark',
};

/** Placeholder particles are drawn at this diameter; views scale from it. */
const PARTICLE_UNIT = 20;

interface ParticleSpec {
  kind: ParticleKind;
  x: number;
  y: number;
  /** Velocity and gravity in board units per second (squared). */
  vx: number;
  vy: number;
  g: number;
  delay: number;
  life: number;
  /** Diameter in board units. */
  size: number;
  spin: number;
}

interface Particle extends ParticleSpec {
  view: Container;
  baseScale: number;
}

interface Run {
  readonly kind: OutcomeKind;
  readonly signal: AbortSignal;
  readonly abort: () => void;
  /** Cells whose tile base an effect moved or scaled. */
  readonly touched: Set<number>;
}

// ---------- dance ----------

interface Pose {
  lift: number;
  sx: number;
  sy: number;
  /** Full turns; Larry turns by flipping his width (a flat toy turning around). */
  turns: number;
}

interface DancePhase {
  readonly ms: number;
  pose(u: number): Pose;
}

function crouch(ms: number, depth: number): DancePhase {
  return {
    ms,
    pose: (u) => {
      const e = easeOutCubic(u);
      return { lift: 0, sx: 1 + depth * 0.6 * e, sy: 1 - depth * e, turns: 0 };
    },
  };
}

function hop(ms: number, height: number, turns: number): DancePhase {
  return {
    ms,
    pose: (u) => {
      const stretch = Math.max(0, 1 - u * 2.5) ** 2;
      return { lift: Math.sin(u * Math.PI) * height, sx: 1 - stretch * 0.07, sy: 1 + stretch * 0.14, turns: turns * easeInOutSine(u) };
    },
  };
}

function land(ms: number, depth: number): DancePhase {
  return {
    ms,
    pose: (u) => {
      const squash = depth * (1 - easeOutBack(u));
      return { lift: 0, sx: 1 + squash * 0.6, sy: 1 - squash, turns: 0 };
    },
  };
}

function danceLength(dance: readonly DancePhase[]): number {
  return dance.reduce((sum, phase) => sum + phase.ms, 0);
}

/** Start time of phase `index`. */
function phaseStart(dance: readonly DancePhase[], index: number): number {
  return danceLength(dance.slice(0, index));
}

function danceAt(dance: readonly DancePhase[], ms: number): Pose {
  let start = 0;

  for (const phase of dance) {
    if (ms < start + phase.ms) {
      return phase.pose((ms - start) / phase.ms);
    }

    start += phase.ms;
  }

  return { lift: 0, sx: 1, sy: 1, turns: 0 };
}

// ---------- helpers ----------

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(from: number, to: number, t: number): number {
  const channel = (shift: number) => Math.round(lerp((from >> shift) & 0xff, (to >> shift) & 0xff, t)) << shift;
  return channel(16) | channel(8) | channel(0);
}

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function hexPath(graphics: Graphics, center: Point, radius: number): Graphics {
  const corners = hexCorners(radius);

  for (let i = 0; i < corners.length; i += 2) {
    corners[i] += center.x;
    corners[i + 1] += center.y;
  }

  return graphics.poly(corners);
}

function random(min: number, max: number): number {
  return lerp(min, max, Math.random());
}

function drawPlaceholder(kind: ParticleKind): GraphicsContext {
  const context = new GraphicsContext();
  const r = PARTICLE_UNIT / 2;

  switch (kind) {
    case 'drop':
      // Tip up; particles rotate so the tip trails their motion.
      context
        .moveTo(0, -r * 1.25)
        .quadraticCurveTo(r * 0.72, -r * 0.2, r * 0.72, r * 0.28)
        .arc(0, r * 0.28, r * 0.72, 0, Math.PI)
        .quadraticCurveTo(-r * 0.72, -r * 0.2, 0, -r * 1.25)
        .closePath()
        .fill(0x5ec8ff)
        .stroke({ width: 1.5, color: 0x2f8fd0, alpha: 0.8 })
        .circle(-r * 0.25, r * 0.3, r * 0.2)
        .fill({ color: 0xffffff, alpha: 0.85 });
      break;
    case 'foam':
      context
        .circle(0, 0, r)
        .fill({ color: 0xffffff, alpha: 0.9 })
        .stroke({ width: 2, color: RING_WATER })
        .circle(-r * 0.35, -r * 0.35, r * 0.25)
        .fill({ color: 0xdff5ff });
      break;
    case 'spark': {
      const points: number[] = [];

      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.36;
        points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }

      context.poly(points).fill(0xffd84a).circle(0, 0, r * 0.22).fill(0xfffbe0);
      break;
    }
  }

  return context;
}

// ---------- effects ----------

export class OutcomeEffects {
  private run: Run | null = null;
  private readonly placeholders = new Map<ParticleKind, GraphicsContext>();

  public constructor(
    private readonly board: BoardView,
    private readonly animator: Animator,
  ) {}

  /** The outcome currently shown (animating or resting), or null. */
  public get kind(): OutcomeKind | null {
    return this.run?.kind ?? null;
  }

  /**
   * Win: Larry hops (and spins), water drops, foam and sparks burst from the finish, the finish tile
   * pulses and keeps a soft glow. Resolves after the main beat, or at once when cleared earlier.
   */
  public celebrate(final: boolean): Promise<void> {
    const run = this.begin(final ? 'celebrate-final' : 'celebrate');
    const rig = this.board.outcomeRig;
    const home = rig.tileHome(rig.larryCell);

    if (prefersReducedMotion()) {
      return this.celebrateReduced(run, rig, final);
    }

    const dance = final ? WIN_FINAL_DANCE : WIN_DANCE;
    const takeoff = phaseStart(dance, 1);
    const landing = phaseStart(dance, 2);
    const burstCount = final ? WIN_FINAL_BURST_COUNT : WIN_BURST_COUNT;
    const burstSpeed = final ? WIN_FINAL_BURST_SPEED : WIN_BURST_SPEED;

    this.after(run, takeoff, () => {
      this.particles(run, rig, this.fountain(home, burstCount, burstSpeed));
      this.ring(run, rig, home, final ? 2.6 : 1.6, RING_WATER);
      this.glow(run, rig, home, WIN_GLOW_MS);
    });

    this.after(run, landing, () => {
      this.pulseTile(run, rig, rig.larryCell, 0.14);

      if (final) {
        this.ripple(run, rig);
        this.ring(run, rig, home, 3.4, RING_GOLD);
      }
    });

    if (final) {
      this.after(run, phaseStart(dance, 4), () => {
        const volley = Array.from({ length: 6 }, (_, i) => {
          const angle = (i * Math.PI) / 3 + Math.PI / 6;
          const point = { x: home.x + Math.cos(angle) * R * 1.8, y: home.y + Math.sin(angle) * R * 1.8 };
          return this.fountain(point, WIN_FINAL_VOLLEY_COUNT, burstSpeed * 0.6);
        });
        this.particles(run, rig, volley.flat());
      });
    }

    const beat = this.animator.tween(danceLength(dance), (t) => {
      this.poseLarry(rig, danceAt(dance, t * danceLength(dance)));
    }, linear, run.signal);

    return beat.then((done) => {
      if (done && !run.signal.aborted) {
        this.poseLarry(rig, { lift: 0, sx: 1, sy: 1, turns: 0 });
        this.particles(run, rig, this.tail(home, final));
      }
    });
  }

  /** Loss: 'stuck' shakes the board and Larry; 'out-of-steps' makes Larry slump and grey. Both then rest dimmed. */
  public showLoss(reason: LossReason) {
    const run = this.begin(reason);
    const rig = this.board.outcomeRig;
    const reduced = prefersReducedMotion();

    if (reason === 'stuck') {
      this.stuck(run, rig, reduced);
    } else {
      this.slump(run, rig, reduced);
    }
  }

  /** Stops every outcome tween and restores the board at once. No-op when nothing is shown. */
  public clear() {
    const run = this.run;

    if (run === null) {
      return;
    }

    this.run = null;
    run.abort();
    this.board.restoreOutcomePose(run.touched);
    this.animator.requestRender();
  }

  public destroy() {
    this.clear();

    for (const context of this.placeholders.values()) {
      context.destroy();
    }

    this.placeholders.clear();
  }

  // ---------- runs ----------

  private begin(kind: OutcomeKind): Run {
    this.clear();

    const controller = new AbortController();
    const run: Run = { kind, signal: controller.signal, abort: () => controller.abort(), touched: new Set() };

    this.run = run;
    return run;
  }

  private after(run: Run, delayMs: number, action: () => void) {
    if (delayMs <= 0) {
      action();
      return;
    }

    void this.animator.wait(delayMs, run.signal).then((done) => {
      if (done && !run.signal.aborted) action();
    });
  }

  // ---------- win pieces ----------

  private celebrateReduced(run: Run, rig: OutcomeRig, final: boolean): Promise<void> {
    const home = rig.tileHome(rig.larryCell);
    const bubbles = final ? 10 : 6;
    const specs: ParticleSpec[] = Array.from({ length: bubbles }, (_, i) => ({
      kind: final && i % 2 === 1 ? 'spark' : 'foam',
      x: home.x + random(-0.7, 0.7) * R,
      y: home.y - random(0.2, 0.9) * R,
      vx: random(-0.1, 0.1) * R,
      vy: -random(0.5, 0.8) * R,
      g: 0,
      delay: random(0, 250),
      life: random(700, 1000),
      size: random(0.26, 0.4) * R,
      spin: 0,
    }));

    this.glow(run, rig, home, WIN_REDUCED_BEAT_MS);
    this.particles(run, rig, specs);

    return this.animator.tween(WIN_REDUCED_BEAT_MS, (t) => {
      const pulse = Math.sin(t * Math.PI) * 0.06;
      this.poseLarry(rig, { lift: 0, sx: 1 + pulse, sy: 1 + pulse, turns: 0 });
    }, easeInOutSine, run.signal).then(() => undefined);
  }

  private poseLarry(rig: OutcomeRig, pose: Pose) {
    rig.larry.position.set(rig.larryRest.x, rig.larryRest.y - pose.lift);
    rig.larry.scale.set(rig.larryScale * pose.sx * Math.cos(pose.turns * Math.PI * 2), rig.larryScale * pose.sy);
  }

  /** Soft glow on the finish tile; it stays as the resting "won" state until cleared. */
  private glow(run: Run, rig: OutcomeRig, home: Point, fadeMs: number) {
    const glow = hexPath(new Graphics(), home, R * 0.92)
      .fill({ color: GLOW_FILL, alpha: 0.32 })
      .stroke({ width: 3, color: GLOW_EDGE, alpha: 0.9 });

    rig.under.addChild(glow);
    void this.animator.tween(fadeMs, (t) => {
      glow.alpha = t;
    }, easeOutCubic, run.signal);
  }

  private ring(run: Run, rig: OutcomeRig, home: Point, reach: number, color: number) {
    const ring = new Graphics();

    rig.over.addChild(ring);
    void this.animator.tween(WIN_RING_MS, (t) => {
      ring.clear();
      hexPath(ring, home, R * (1 + (reach - 1) * easeOutCubic(t))).stroke({ width: 4, color, alpha: 0.9 * (1 - t) });
    }, linear, run.signal).then((done) => {
      if (done && !ring.destroyed) ring.destroy();
    });
  }

  private pulseTile(run: Run, rig: OutcomeRig, cell: number, amount: number) {
    const base = rig.tileBase(cell);

    run.touched.add(cell);
    void this.animator.tween(WIN_TILE_PULSE_MS, (t) => {
      base.scale.set(1 + Math.sin(t * Math.PI) * amount);
    }, easeOutCubic, run.signal);
  }

  private ripple(run: Run, rig: OutcomeRig) {
    const { level } = this.board;
    const origin = level.cells[rig.larryCell];
    const distances = level.cells.map((cell) => hexDistance(cell, origin));
    const total = Math.max(...distances) * RIPPLE_STEP_MS + RIPPLE_MS;

    distances.forEach((distance, cell) => {
      if (distance > 0) run.touched.add(cell);
    });

    void this.animator.tween(total, (t) => {
      const elapsed = t * total;

      distances.forEach((distance, cell) => {
        if (distance === 0) return;

        const u = Math.min(1, Math.max(0, (elapsed - distance * RIPPLE_STEP_MS) / RIPPLE_MS));
        const wave = Math.sin(u * Math.PI) / (1 + distance * 0.12);
        const base = rig.tileBase(cell);

        base.y = -wave * R * 0.2;
        base.scale.set(1 + wave * 0.05);
      });
    }, linear, run.signal);
  }

  private fountain(home: Point, count: number, speed: number): ParticleSpec[] {
    return Array.from({ length: count }, (_, i): ParticleSpec => {
      const kind: ParticleKind = i % 5 < 2 ? 'drop' : i % 5 < 4 ? 'foam' : 'spark';
      const angle = -Math.PI / 2 + random(-0.95, 0.95);
      const power = speed * random(0.55, 1) * (kind === 'foam' ? 0.7 : 1);

      return {
        kind,
        x: home.x + random(-0.2, 0.2) * R,
        y: home.y - 0.1 * R,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        g: kind === 'foam' ? PARTICLE_GRAVITY * 0.45 : PARTICLE_GRAVITY,
        delay: random(0, 80),
        life: random(750, 1050),
        size: (kind === 'foam' ? random(0.26, 0.44) : kind === 'drop' ? random(0.32, 0.42) : random(0.34, 0.48)) * R,
        spin: kind === 'spark' ? random(-8, 8) : 0,
      };
    });
  }

  /** Bounded ambient tail: foam floats up (and sparks twinkle on the final level), then the ticker rests. */
  private tail(home: Point, final: boolean): ParticleSpec[] {
    const duration = final ? WIN_FINAL_TAIL_MS : WIN_TAIL_MS;
    const count = final ? 22 : 7;
    const spread = final ? 2.6 : 0.8;

    return Array.from({ length: count }, (_, i): ParticleSpec => {
      const life = random(800, 1300);
      const kind: ParticleKind = final && i % 3 !== 0 ? 'spark' : 'foam';

      return {
        kind,
        x: home.x + random(-spread, spread) * R,
        y: home.y - random(0.1, final ? 2 : 1) * R,
        vx: random(-0.15, 0.15) * R,
        vy: -random(0.35, 0.8) * R,
        g: 0,
        delay: random(0, duration - life),
        life,
        size: random(0.22, 0.36) * R,
        spin: kind === 'spark' ? random(-3, 3) : 0,
      };
    });
  }

  // ---------- loss pieces ----------

  private stuck(run: Run, rig: OutcomeRig, reduced: boolean) {
    const home = rig.tileHome(rig.larryCell);
    const ring = new Graphics();

    rig.over.addChild(ring);

    if (reduced) {
      void this.animator.tween(LOSS_REDUCED_MS, (t) => {
        rig.scene.tint = lerpColor(0xffffff, LOSS_SCENE_TINT, t);
        rig.larry.tint = lerpColor(0xffffff, STUCK_LARRY_TINT, t);
        ring.clear();
        hexPath(ring, home, R).stroke({ width: 3, color: STUCK_RING, alpha: 0.8 * Math.sin(t * Math.PI) });
      }, easeInOutSine, run.signal);
      return;
    }

    void this.animator.tween(STUCK_SHAKE_MS, (t) => {
      const decay = 1 - t;
      rig.scene.x = Math.sin(t * Math.PI * 7) * decay * R * 0.14;
      rig.larry.x = rig.larryRest.x + Math.sin(t * Math.PI * 9) * decay * R * 0.08;
      rig.larry.rotation = Math.sin(t * Math.PI * 9) * decay * 0.16;
      rig.larry.tint = lerpColor(STUCK_FLASH_TINT, STUCK_LARRY_TINT, easeOutCubic(t));
      ring.clear();
      hexPath(ring, home, R * (1 + 0.15 * t)).stroke({ width: 4, color: STUCK_RING, alpha: 0.85 * decay });
    }, linear, run.signal).then((done) => {
      if (!done || run.signal.aborted) return;

      rig.scene.x = 0;
      rig.larry.position.set(rig.larryRest.x, rig.larryRest.y);
      rig.larry.rotation = 0;
      ring.destroy();
      this.dimScene(run, rig);
    });
  }

  private slump(run: Run, rig: OutcomeRig, reduced: boolean) {
    if (reduced) {
      void this.animator.tween(LOSS_REDUCED_MS, (t) => {
        rig.scene.tint = lerpColor(0xffffff, LOSS_SCENE_TINT, t);
        rig.larry.tint = lerpColor(0xffffff, SLUMP_LARRY_TINT, t);
        rig.larry.alpha = lerp(1, SLUMP_LARRY_ALPHA, t);
      }, easeInOutSine, run.signal);
      return;
    }

    // A small breath in, then the slump: Larry squashes, leans and sinks a little as he greys.
    void this.animator.tween(SLUMP_MS, (t) => {
      const inhale = t < 0.25 ? Math.sin((t / 0.25) * Math.PI) * 0.05 : 0;
      const s = easeOutCubic(Math.max(0, (t - 0.2) / 0.8));

      rig.larry.scale.set(rig.larryScale * (1 + s * 0.06), rig.larryScale * (1 + inhale - s * 0.14));
      rig.larry.rotation = s * 0.09;
      rig.larry.y = rig.larryRest.y + s * R * 0.05;
      rig.larry.tint = lerpColor(0xffffff, SLUMP_LARRY_TINT, s);
      rig.larry.alpha = lerp(1, SLUMP_LARRY_ALPHA, s);
    }, linear, run.signal);

    // The sigh: a few grey puffs drift up from Larry's head.
    this.after(run, SLUMP_MS * 0.3, () => {
      const head = { x: rig.larryRest.x, y: rig.larryRest.y - R * 1.45 };
      const puffs = Array.from({ length: 3 }, (_, i): ParticleSpec => ({
        kind: 'foam',
        x: head.x + (i - 1) * R * 0.18,
        y: head.y,
        vx: (i - 1) * R * 0.12,
        vy: -R * random(0.5, 0.7),
        g: 0,
        delay: i * 90,
        life: 800,
        size: R * (0.22 + i * 0.05),
        spin: 0,
      }));

      this.particles(run, rig, puffs, 0x9c9aae);
    });

    this.dimScene(run, rig);
  }

  private dimScene(run: Run, rig: OutcomeRig) {
    void this.animator.tween(LOSS_DIM_MS, (t) => {
      rig.scene.tint = lerpColor(0xffffff, LOSS_SCENE_TINT, t);
    }, easeInOutSine, run.signal);
  }

  // ---------- particles ----------

  private particleView(kind: ParticleKind): { view: Container; baseScale: number } {
    const alias = PARTICLE_ART[kind];

    if (Assets.cache.has(alias)) {
      const sprite = Sprite.from(alias);
      sprite.anchor.set(0.5);
      return { view: sprite, baseScale: PARTICLE_UNIT / Math.max(1, sprite.texture.width, sprite.texture.height) };
    }

    let context = this.placeholders.get(kind);

    if (context === undefined) {
      context = drawPlaceholder(kind);
      this.placeholders.set(kind, context);
    }

    return { view: new Graphics(context), baseScale: 1 };
  }

  /** Runs one batch of particles in a single tween; each particle follows a ballistic path. */
  private particles(run: Run, rig: OutcomeRig, specs: readonly ParticleSpec[], tint = 0xffffff) {
    if (specs.length === 0) return;

    const particles: Particle[] = specs.map((spec) => {
      const { view, baseScale } = this.particleView(spec.kind);
      view.visible = false;
      view.tint = tint;
      rig.over.addChild(view);
      return { ...spec, view, baseScale };
    });
    const total = Math.max(...specs.map((spec) => spec.delay + spec.life));

    void this.animator.tween(total, (t) => {
      const elapsed = t * total;

      for (const p of particles) {
        const local = elapsed - p.delay;

        if (local < 0 || local >= p.life) {
          p.view.visible = false;
          continue;
        }

        const s = local / 1000;
        const u = local / p.life;
        const vy = p.vy + p.g * s;
        let scale = p.size / PARTICLE_UNIT;

        p.view.visible = true;
        p.view.position.set(p.x + p.vx * s, p.y + p.vy * s + 0.5 * p.g * s * s);
        p.view.alpha = Math.min(1, local / 60) * (u < 0.65 ? 1 : (1 - u) / 0.35);

        if (p.kind === 'drop') {
          p.view.rotation = Math.atan2(vy, p.vx) - Math.PI / 2;
        } else if (p.kind === 'foam') {
          scale *= 0.6 + 0.5 * easeOutCubic(u);
        } else {
          p.view.rotation = p.spin * s;
          scale *= 0.75 + 0.25 * Math.sin(local / 45);
        }

        p.view.scale.set(scale * p.baseScale);
      }
    }, linear, run.signal).then(() => {
      for (const p of particles) {
        if (!p.view.destroyed) p.view.destroy();
      }
    });
  }
}
