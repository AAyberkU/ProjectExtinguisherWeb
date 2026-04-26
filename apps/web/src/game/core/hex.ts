import type { AxialCoord, CatapultDirection } from './types';

export const BOARD_RADIUS = 4;

export const AXIAL_DIRECTIONS: Readonly<Record<CatapultDirection, AxialCoord>> = {
  E: { q: 1, r: 0 },
  NE: { q: 1, r: -1 },
  NW: { q: 0, r: -1 },
  W: { q: -1, r: 0 },
  SW: { q: -1, r: 1 },
  SE: { q: 0, r: 1 },
};

export function createBoardCoordinates(radius = BOARD_RADIUS): AxialCoord[] {
  const coordinates: AxialCoord[] = [];

  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);

    for (let r = rMin; r <= rMax; r += 1) {
      coordinates.push({ q, r });
    }
  }

  return coordinates;
}

export function axialToPixel(coord: AxialCoord, size: number): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (coord.q + coord.r / 2);
  const y = size * 1.5 * coord.r;

  return { x, y };
}

export function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function coordsEqual(a: AxialCoord, b: AxialCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function addAxial(a: AxialCoord, b: AxialCoord, multiplier = 1): AxialCoord {
  return {
    q: a.q + b.q * multiplier,
    r: a.r + b.r * multiplier,
  };
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;

  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function isNeighbor(a: AxialCoord, b: AxialCoord): boolean {
  return axialDistance(a, b) === 1;
}

export function getCatapultOffset(direction: CatapultDirection): AxialCoord {
  return AXIAL_DIRECTIONS[direction];
}
