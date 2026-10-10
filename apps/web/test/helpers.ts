/// <reference types="vite/client" />
import {
  boardCoords,
  compileLevel,
  type CompiledLevel,
  type Dir,
  type PuzzleLabLevel,
  type RawTile,
  type TileType,
} from '../src/game/engine';

export type TileSpec = Omit<RawTile, 'q' | 'r' | 'type'> & { type: TileType };

/**
 * Builds a solid hex-steps level: `cells` maps "q,r" to a tile; every other board cell is a
 * blocker (or `fill`).
 */
export function makeLevel(
  cells: Record<string, TileType | TileSpec>,
  opts: { size?: number; steps?: number; id?: string; fill?: TileType } = {},
): PuzzleLabLevel {
  const size = opts.size ?? 5;
  const tiles: RawTile[] = [];
  const used = new Set<string>();
  for (const [q, r] of boardCoords(size)) {
    const k = `${q},${r}`;
    const spec = cells[k];
    used.add(k);
    if (spec === undefined) tiles.push({ q, r, type: opts.fill ?? 'blocker' });
    else if (typeof spec === 'string') tiles.push({ q, r, type: spec });
    else tiles.push({ q, r, ...spec });
  }
  for (const k of Object.keys(cells)) if (!used.has(k)) throw new Error(`cell ${k} is off the board`);
  return {
    format: 'puzzle-lab/level@1',
    game: 'hex-steps',
    id: opts.id ?? 'test-level',
    name: 'Test',
    grid: { size, type: 'hex', coords: 'axial', orientation: 'pointy' },
    params: { steps: opts.steps ?? 5 },
    tiles,
  };
}

export function build(cells: Record<string, TileType | TileSpec>, opts: Parameters<typeof makeLevel>[1] = {}): CompiledLevel {
  return compileLevel(makeLevel(cells, opts));
}

/** Cell index of (q, r), throwing when missing. */
export function at(level: CompiledLevel, q: number, r: number): number {
  const i = level.cellAt(q, r);
  if (i < 0) throw new Error(`no cell (${q}, ${r})`);
  return i;
}

export const dirs = (s: string): Dir[] => s.split(/\s+/).filter(Boolean) as Dir[];
