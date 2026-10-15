// Persistent board scene for one level load: tile views built once, then updated in place from the
// play state and animated per engine event. Never rebuilt per move.

import { Container, Graphics, Sprite } from 'pixi.js';
import { carCells, withCar, type CompiledLevel, type Dir, type EngineEvent, type PlayState } from '../engine';
import { easeInOutSine, easeOutBack, easeOutCubic, linear, type Animator } from './animator';
import { hexCorners } from './glyphs';
import { cellCenter, TILE_VISUAL_RADIUS, type Point } from './layout';
import {
  createCarSprite,
  createCellMarker,
  createPopText,
  createPlusGhost,
  createTileBase,
  findSwitchButton,
  rescaleText,
  setSwitchPress,
  tileLook,
  type VisualState,
} from './tileArt';

const LARRY_TEXTURE = 'larry';
const LARRY_SPRITE_HEIGHT = TILE_VISUAL_RADIUS * 1.55;
const LARRY_FOOT_OFFSET = TILE_VISUAL_RADIUS * 0.48;

const WALK_MS = 160;
const WALK_HOP = TILE_VISUAL_RADIUS * 0.52;
const LAUNCH_MS = 240;
const LAUNCH_HOP = TILE_VISUAL_RADIUS * 1.5;
const SLIDE_MS_PER_CELL = 90;
const TELEPORT_MS = 220;
const SWAP_MS = 180;
const PICKUP_MS = 260;
const STATE_FADE_MS = 200;

const INTRO_DROP_OFFSET = TILE_VISUAL_RADIUS * 9;
const INTRO_FALL_MS = 180;
const INTRO_LINE_DELAY_MS = 26;
const INTRO_MAX_SPREAD_MS = 260;
const INTRO_LARRY_MS = 120;

const HIGHLIGHT_COLOR = 0x00ff88;
const SWAP_SOCKET_COLOR = 0x2a1050;
const HIGHLIGHT_ALPHA = 0.85;
const HIGHLIGHT_WIDTH = 2.5;
/** A parked car the player has left is a wall: drawn a little darker so it reads as an obstacle. */
const PARKED_CAR_TINT = 0xa8a0b8;

/**
 * What the outcome effects (effects.ts) may animate. Every handle is restored by
 * `BoardView.restoreOutcomePose`, so effects never leave the board changed.
 */
export interface OutcomeRig {
  /** Tiles, highlights and Larry; offset to shake the board and tinted to dim it. */
  readonly scene: Container;
  /** Board-space layer above the tiles and below Larry (glows). */
  readonly under: Container;
  /** Board-space layer above everything (particles); not dimmed or shaken with the scene. */
  readonly over: Container;
  readonly larry: Sprite;
  readonly larryCell: number;
  /** Larry's resting foot point and scale on his cell. */
  readonly larryRest: Point;
  readonly larryScale: number;
  tileHome(cell: number): Point;
  tileBase(cell: number): Container;
}

interface TileView {
  readonly cell: number;
  readonly container: Container;
  readonly home: Point;
  base: Container;
  key: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export class BoardView {
  public readonly root = new Container();
  private readonly scene = new Container();
  private readonly outcomeUnder = new Container();
  private readonly outcomeOver = new Container();
  private readonly tileLayer = new Container();
  /**
   * Cars that left their home tile (or parked for good on it); unused cars are part of their tile.
   * Above the tile effects, so a car parked on a swap cell stays visible while the contents trade.
   */
  private readonly carLayer = new Container();
  private readonly cars = new Map<number, Sprite>();
  private readonly hintLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly highlight = new Graphics();
  private readonly larryLayer = new Container();
  private readonly popLayer = new Container();
  private readonly tiles: TileView[] = [];
  private readonly larry: Sprite;
  private readonly larryScale: number;
  private visual: VisualState;
  private larryCell: number;
  /** Legal targets of the current state: target cell -> direction. */
  private targets = new Map<number, Dir>();
  /** Set on destroy; async effects stop touching the scene once the board is gone. */
  private destroyed = false;

  public constructor(
    public readonly level: CompiledLevel,
    state: PlayState,
    private readonly animator: Animator,
    private resolution: number,
  ) {
    this.root.label = 'Hex Board';
    this.scene.label = 'Scene';
    this.outcomeUnder.label = 'Outcome Glow';
    this.outcomeOver.label = 'Outcome Effects';
    this.tileLayer.label = 'Tiles';
    this.carLayer.label = 'Cars';
    this.hintLayer.label = 'Tutorial Hint';
    this.fxLayer.label = 'Tile Effects';
    this.highlight.label = 'Move Highlights';
    this.larryLayer.label = 'Larry';
    this.popLayer.label = 'Pops';
    this.scene.addChild(this.tileLayer, this.hintLayer, this.fxLayer, this.carLayer, this.outcomeUnder, this.highlight, this.larryLayer, this.popLayer);
    this.root.addChild(this.scene, this.outcomeOver);
    this.visual = { phase: state.phase, mask: state.mask, sw: state.sw, cars: state.cars };
    this.larryCell = state.pos;

    // Lower rows draw over the rows above them, as with the jam art.
    const order = Array.from({ length: level.cellCount }, (_, i) => i).sort((a, b) => {
      const pa = cellCenter(level, a);
      const pb = cellCenter(level, b);
      return pa.y - pb.y || pa.x - pb.x;
    });

    for (let cell = 0; cell < level.cellCount; cell += 1) {
      const home = cellCenter(level, cell);
      const look = tileLook(level, cell, this.visual);
      const container = new Container();
      const base = createTileBase(look, resolution);
      const marker = createCellMarker(level, cell, resolution);

      container.label = `Hex ${level.cells[cell].q},${level.cells[cell].r}`;
      container.position.set(home.x, home.y);
      container.addChild(base);

      if (marker !== null) {
        container.addChild(marker);
      }

      this.tiles[cell] = { cell, container, home, base, key: look.key };
    }

    for (const cell of order) {
      this.tileLayer.addChild(this.tiles[cell].container);
    }

    this.larry = Sprite.from(LARRY_TEXTURE);
    this.larry.anchor.set(0.5, 0.95);
    this.larryScale = LARRY_SPRITE_HEIGHT / Math.max(1, this.larry.texture.height);
    this.larry.scale.set(this.larryScale);
    this.larryLayer.addChild(this.larry);
    this.placeLarry(state.pos);
    this.syncCars();
  }

  public destroy() {
    this.destroyed = true;
    this.root.destroy({ children: true });
  }

  /** Re-rasterizes the board's text for a new render resolution (browser zoom, another screen). */
  public setResolution(resolution: number) {
    if (resolution === this.resolution) {
      return;
    }

    rescaleText(this.root, resolution / this.resolution);
    this.resolution = resolution;
  }

  /** Legal target cell under a board point, with its direction. */
  public targetDir(cell: number): Dir | undefined {
    return this.targets.get(cell);
  }

  // ---------- state sync ----------

  /** Snaps every tile and Larry to a state (undo, timeline end). */
  public showState(state: PlayState) {
    this.visual = { phase: state.phase, mask: state.mask, sw: state.sw, cars: state.cars };
    this.refreshTiles();
    this.placeLarry(state.pos);
    this.syncCars();
    this.resetLarryLook();
  }

  // ---------- cars ----------

  private carSprite(car: number): Sprite {
    let sprite = this.cars.get(car);

    if (sprite === undefined) {
      sprite = createCarSprite(this.level.cells[this.level.cars[car]].dir);
      this.cars.set(car, sprite);
      this.carLayer.addChild(sprite);
    }

    return sprite;
  }

  /** Places every used car on its cell (unused cars are drawn by their home tile) and darkens the parked ones. */
  private syncCars() {
    for (const [index, { at, used }] of carCells(this.level, this.visual).entries()) {
      if (!used) {
        this.cars.get(index)?.destroy();
        this.cars.delete(index);
        continue;
      }

      const sprite = this.carSprite(index);
      const { x, y } = this.tiles[at].home;
      sprite.position.set(x, y);
    }

    this.tintCars();
  }

  /** The car Larry sits in looks normal; every other used car is parked for good. */
  private tintCars() {
    for (const [index, { at }] of carCells(this.level, this.visual).entries()) {
      const sprite = this.cars.get(index);
      if (sprite !== undefined) sprite.tint = at === this.larryCell ? 0xffffff : PARKED_CAR_TINT;
    }
  }

  // ---------- tutorial hint ----------

  /** Board-space layer above the tiles and below the move highlights and Larry (tutorial glow). */
  public get hintRig(): { readonly layer: Container; tileHome(cell: number): Point } {
    const tiles = this.tiles;

    return { layer: this.hintLayer, tileHome: (cell) => tiles[cell].home };
  }

  // ---------- outcome effects ----------

  public get outcomeRig(): OutcomeRig {
    const tiles = this.tiles;

    return {
      scene: this.scene,
      under: this.outcomeUnder,
      over: this.outcomeOver,
      larry: this.larry,
      larryCell: this.larryCell,
      larryRest: this.larryPoint(this.larryCell),
      larryScale: this.larryScale,
      tileHome: (cell) => tiles[cell].home,
      tileBase: (cell) => tiles[cell].base,
    };
  }

  /** Undoes every outcome effect change: Larry's pose, the scene offset and dim, tile bounces, effect layers. */
  public restoreOutcomePose(touchedCells: Iterable<number>) {
    if (this.destroyed) return;

    for (const layer of [this.outcomeUnder, this.outcomeOver]) {
      for (const child of layer.removeChildren()) {
        child.destroy({ children: true });
      }
    }

    for (const cell of touchedCells) {
      const base = this.tiles[cell]?.base;
      base?.position.set(0, 0);
      base?.scale.set(1);
    }

    this.scene.position.set(0, 0);
    this.scene.tint = 0xffffff;
    this.placeLarry(this.larryCell);
    this.resetLarryLook();
  }

  private resetLarryLook() {
    this.larry.alpha = 1;
    this.larry.tint = 0xffffff;
    this.larry.rotation = 0;
    this.larry.scale.set(this.larryScale);
  }

  public setVisual(patch: Partial<VisualState>) {
    this.visual = { ...this.visual, ...patch };
  }

  public get visualState(): VisualState {
    return this.visual;
  }

  public setHighlights(targets: ReadonlyArray<{ dir: Dir; target: number }>) {
    this.targets = new Map(targets.map((move) => [move.target, move.dir]));
    this.highlight.clear();

    for (const cell of this.targets.keys()) {
      const { x, y } = this.tiles[cell].home;
      const corners = hexCorners(TILE_VISUAL_RADIUS);

      for (let i = 0; i < corners.length; i += 2) {
        corners[i] += x;
        corners[i + 1] += y;
      }

      this.highlight.poly(corners);
    }

    if (this.targets.size > 0) {
      this.highlight.stroke({ color: HIGHLIGHT_COLOR, width: HIGHLIGHT_WIDTH, alpha: HIGHLIGHT_ALPHA });
    }
  }

  public clearHighlights() {
    this.setHighlights([]);
  }

  /**
   * Rebuilds the base of every tile whose look changed. With `fadeMs`, the old base fades out over
   * the new one, except on `pressedCell`, whose switch button presses in instead. Resolves when the
   * animation ends.
   */
  public refreshTiles(fadeMs = 0, pressedCell = -1): Promise<boolean> {
    const fades: Array<Promise<boolean>> = [];

    for (const tile of this.tiles) {
      const look = tileLook(this.level, tile.cell, this.visual);

      if (look.key === tile.key) {
        continue;
      }

      const previous = tile.base;
      const next = createTileBase(look, this.resolution);
      const button = fadeMs > 0 && tile.cell === pressedCell ? findSwitchButton(next) : null;

      tile.container.addChildAt(next, 0);
      tile.base = next;
      tile.key = look.key;

      if (fadeMs <= 0 || button !== null) {
        previous.destroy({ children: true });
      }

      if (button !== null) {
        setSwitchPress(button, 0);
        fades.push(
          this.animator
            .tween(fadeMs, (t) => setSwitchPress(button, t), easeOutBack)
            .then((done) => {
              if (this.destroyed) return false;
              setSwitchPress(button, 1);
              return done;
            }),
        );
        continue;
      }

      if (fadeMs <= 0) {
        continue;
      }

      tile.container.addChildAt(previous, 1);
      fades.push(
        this.animator
          .tween(fadeMs, (t) => {
            previous.alpha = 1 - t;
          }, easeInOutSine)
          .then((done) => {
            if (this.destroyed) return false;
            previous.destroy({ children: true });
            return done;
          }),
      );
    }

    return fades.length === 0 ? Promise.resolve(true) : Promise.all(fades).then((r) => r.every(Boolean));
  }

  // ---------- intro ----------

  /** Tiles drop in by diagonal lines, then Larry appears. `onStart` fires when the drop begins. */
  public async playIntro(delayMs: number, onStart: () => void): Promise<boolean> {
    const lineOf = (cell: number) => this.level.cells[cell].q + this.level.cells[cell].r;
    let minLine = Infinity;
    let maxLine = -Infinity;

    for (const tile of this.tiles) {
      minLine = Math.min(minLine, lineOf(tile.cell));
      maxLine = Math.max(maxLine, lineOf(tile.cell));
    }

    const lines = Math.max(1, maxLine - minLine);
    const lineDelay = Math.min(INTRO_LINE_DELAY_MS, INTRO_MAX_SPREAD_MS / lines);
    const delays = this.tiles.map((tile) => (lineOf(tile.cell) - minLine) * lineDelay);
    const total = lines * lineDelay + INTRO_FALL_MS;

    this.larry.alpha = 0;
    this.carLayer.alpha = 0;

    for (const tile of this.tiles) {
      tile.container.alpha = 0;
    }

    if (delayMs > 0 && (!(await this.animator.wait(delayMs)) || this.destroyed)) {
      return false;
    }

    onStart();

    const dropped = await this.animator.tween(total, (t) => {
      const elapsed = t * total;

      for (const tile of this.tiles) {
        const p = easeOutCubic(clamp01((elapsed - delays[tile.cell]) / INTRO_FALL_MS));
        tile.container.y = tile.home.y - INTRO_DROP_OFFSET * (1 - p);
        tile.container.alpha = p;
      }
    });

    if (!dropped || this.destroyed) {
      return false;
    }

    return this.animator.tween(INTRO_LARRY_MS, (t) => {
      this.larry.alpha = t;
      this.carLayer.alpha = t;
    }, easeOutCubic);
  }

  // ---------- Larry motion ----------

  private larryPoint(cell: number): Point {
    const { x, y } = this.tiles[cell].home;
    return { x, y: y + LARRY_FOOT_OFFSET };
  }

  private placeLarry(cell: number) {
    const point = this.larryPoint(cell);
    this.larryCell = cell;
    this.larry.position.set(point.x, point.y);
    this.tintCars();
  }

  private async arc(to: number, durationMs: number, height: number): Promise<boolean> {
    const start = this.larryPoint(this.larryCell);
    const end = this.larryPoint(to);
    const done = await this.animator.tween(durationMs, (t) => {
      this.larry.x = lerp(start.x, end.x, easeInOutSine(t));
      this.larry.y = lerp(start.y, end.y, easeInOutSine(t)) - Math.sin(t * Math.PI) * height;
    });
    if (this.destroyed) return false;
    this.placeLarry(to);
    return done;
  }

  public walk(to: number): Promise<boolean> {
    return this.arc(to, WALK_MS, WALK_HOP);
  }

  public launch(to: number): Promise<boolean> {
    return this.arc(to, LAUNCH_MS, LAUNCH_HOP);
  }

  /**
   * A car ride: the home tile turns to floor, the car drives Larry along the path and parks; with a
   * drop, Larry hops off onto the next tile.
   */
  public async ride(event: Extract<EngineEvent, { type: 'slide' }>): Promise<boolean> {
    this.visual = { ...this.visual, cars: withCar(this.visual.cars, event.car, event.parkedAt) };
    await this.refreshTiles();

    if (this.destroyed) return false;

    const car = this.carSprite(event.car);
    const cells = [event.from, ...event.path];
    const segments = cells.length - 1;

    car.tint = 0xffffff;
    car.position.set(this.tiles[event.from].home.x, this.tiles[event.from].home.y);

    let done = true;

    if (segments > 0) {
      const carPoints = cells.map((cell) => this.tiles[cell].home);
      const larryPoints = cells.map((cell) => this.larryPoint(cell));

      done = await this.animator.tween(segments * SLIDE_MS_PER_CELL, (t) => {
        const position = t * segments;
        const index = Math.min(segments - 1, Math.floor(position));
        const local = position - index;
        car.position.set(lerp(carPoints[index].x, carPoints[index + 1].x, local), lerp(carPoints[index].y, carPoints[index + 1].y, local));
        this.larry.x = lerp(larryPoints[index].x, larryPoints[index + 1].x, local);
        this.larry.y = lerp(larryPoints[index].y, larryPoints[index + 1].y, local);
      }, linear);

      if (this.destroyed) return false;
    }

    this.placeLarry(event.parkedAt);
    this.syncCars();
    return event.drop ? (await this.walk(event.to)) && done : done;
  }

  public async teleport(to: number): Promise<boolean> {
    const half = TELEPORT_MS / 2;
    const out = await this.animator.tween(half, (t) => {
      this.larry.alpha = 1 - t;
      this.larry.scale.set(this.larryScale * (1 - 0.8 * t));
    }, easeInOutSine);

    if (this.destroyed) return false;
    this.placeLarry(to);

    const back = out && await this.animator.tween(half, (t) => {
      this.larry.alpha = t;
      this.larry.scale.set(this.larryScale * (0.2 + 0.8 * t));
    }, easeOutCubic);

    if (this.destroyed) return false;
    this.larry.alpha = 1;
    this.larry.scale.set(this.larryScale);
    return back;
  }

  // ---------- tile effects ----------

  /** Swap pairs trade their contents visibly; the swap markers stay on their cells. */
  public async swap(pairs: ReadonlyArray<readonly [number, number]>, phase: 0 | 1): Promise<boolean> {
    const moving = pairs.flatMap(([a, b]) => [
      { from: this.tiles[a], to: this.tiles[b], side: 1 },
      { from: this.tiles[b], to: this.tiles[a], side: -1 },
    ]);

    // Sockets keep the vacated cells from showing the background while contents travel.
    const sockets = new Graphics();

    for (const item of moving) {
      const corners = hexCorners(TILE_VISUAL_RADIUS * 0.96);

      for (let i = 0; i < corners.length; i += 2) {
        corners[i] += item.from.home.x;
        corners[i + 1] += item.from.home.y;
      }

      sockets.poly(corners);
    }

    sockets.fill({ color: SWAP_SOCKET_COLOR, alpha: 0.9 });
    this.fxLayer.addChild(sockets);

    for (const item of moving) {
      this.fxLayer.addChild(item.from.base);
      item.from.base.position.set(item.from.home.x, item.from.home.y);
    }

    const done = await this.animator.tween(SWAP_MS, (t) => {
      for (const { from, to, side } of moving) {
        const dx = to.home.x - from.home.x;
        const dy = to.home.y - from.home.y;
        const length = Math.hypot(dx, dy) || 1;
        const bend = Math.sin(t * Math.PI) * Math.min(length * 0.22, TILE_VISUAL_RADIUS * 1.2) * side;
        from.base.x = from.home.x + dx * t - (dy / length) * bend;
        from.base.y = from.home.y + dy * t + (dx / length) * bend;
        from.base.scale.set(1 - Math.sin(t * Math.PI) * 0.18);
      }
    }, easeInOutSine);

    if (this.destroyed) return false;
    sockets.destroy();

    // Hand each base to the cell it moved to; keys travel with the content.
    const handoff = moving.map(({ from, to }) => ({ to, base: from.base, key: from.key }));

    for (const { to, base, key } of handoff) {
      base.position.set(0, 0);
      base.scale.set(1);
      to.container.addChildAt(base, 0);
      to.base = base;
      to.key = key;
    }

    this.visual = { ...this.visual, phase };
    await this.refreshTiles();
    return done;
  }

  /** +1 pickup: the tile turns into floor while a ghost of the pickup pops and fades. */
  public async pickupPlus(cell: number, bit: number): Promise<boolean> {
    const home = this.tiles[cell].home;
    const ghost = createPlusGhost();
    const label = createPopText('+1', 0x2f9e5b, this.resolution);

    ghost.position.set(home.x, home.y);
    this.fxLayer.addChild(ghost);
    this.popLayer.addChild(label);
    this.visual = { ...this.visual, mask: this.visual.mask | bit };
    await this.refreshTiles();

    if (this.destroyed) return false;

    const baseWidth = ghost.width;
    const baseHeight = ghost.height;
    const done = await this.animator.tween(PICKUP_MS, (t) => {
      ghost.width = baseWidth * (1 + 0.35 * t);
      ghost.height = baseHeight * (1 + 0.35 * t);
      ghost.alpha = 1 - t;
      label.position.set(home.x, home.y - TILE_VISUAL_RADIUS * (0.6 + 1.1 * easeOutCubic(t)));
      label.scale.set(easeOutBack(Math.min(1, t * 2.5)));
      label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    });

    if (this.destroyed) return false;
    ghost.destroy();
    label.destroy();
    return done;
  }

  /** Refill fires: the tile pulses and its value pops up. */
  public async pickupRefill(cell: number, value: number): Promise<boolean> {
    const tile = this.tiles[cell];
    const label = createPopText(String(value), 0x2f7d58, this.resolution);

    this.popLayer.addChild(label);

    const done = await this.animator.tween(PICKUP_MS, (t) => {
      tile.base.scale.set(1 + Math.sin(t * Math.PI) * 0.14);
      label.position.set(tile.home.x, tile.home.y - TILE_VISUAL_RADIUS * (0.6 + 1.1 * easeOutCubic(t)));
      label.scale.set(easeOutBack(Math.min(1, t * 2.5)));
      label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    });

    if (this.destroyed) return false;
    tile.base.scale.set(1);
    label.destroy();
    return done;
  }

  /** Switch press: the switch shows pressed and matching doors fade open. */
  public pressSwitch(cell: number, colorBit: number): Promise<boolean> {
    this.visual = { ...this.visual, sw: this.visual.sw | colorBit };
    return this.refreshTiles(STATE_FADE_MS, cell);
  }
}
