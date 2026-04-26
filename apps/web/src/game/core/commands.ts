import type { AxialCoord } from './types';

export type GameCommand =
  | Readonly<{ type: 'start-level' }>
  | Readonly<{ type: 'reset-level' }>
  | Readonly<{ type: 'activate-cell'; coord: AxialCoord }>;
