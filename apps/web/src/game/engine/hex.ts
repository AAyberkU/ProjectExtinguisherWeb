// Hex geometry in the Puzzle Lab convention (pointy-top, axial, r grows downward).

const SQRT3 = Math.sqrt(3);

/** Board radius R = (size - 1) / 2 for `grid.size` cells across the widest row. */
export function boardRadius(size: number): number {
  return (size - 1) / 2;
}

/** Hex distance of (q, r) from the board centre. */
export function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

export function onBoard(q: number, r: number, size: number): boolean {
  return hexDistance(q, r) <= boardRadius(size);
}

/** Number of cells on a board of the given size: 3R(R + 1) + 1. */
export function boardCellCount(size: number): number {
  const R = boardRadius(size);
  return 3 * R * (R + 1) + 1;
}

/** Every board coordinate, sorted by r then q (the export order). */
export function boardCoords(size: number): Array<[number, number]> {
  const R = boardRadius(size);
  const out: Array<[number, number]> = [];
  for (let r = -R; r <= R; r++) {
    for (let q = -R; q <= R; q++) {
      if (hexDistance(q, r) <= R) out.push([q, r]);
    }
  }
  return out;
}

/** Pixel centre of cell (q, r) for hex circumradius `size`. */
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return { x: size * SQRT3 * (q + r / 2), y: 1.5 * size * r };
}
