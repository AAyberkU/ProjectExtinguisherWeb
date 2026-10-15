// Plays one move's engine events as a sequential timeline on the board. Presentation follows the
// events only; the engine has already resolved the move and never waits for this.

import { colorBit, contentIndex, type EngineEvent } from '../engine';
import type { BoardView } from './boardView';

export interface TimelineHooks {
  /** Called when an event's animation starts (audio cues, HUD step count). */
  onEventStart(event: EngineEvent): void;
  /** False once the timeline was superseded (restart, level change, unmount). */
  isCurrent(): boolean;
}

function presentEvent(board: BoardView, event: EngineEvent): Promise<boolean> {
  switch (event.type) {
    case 'swap':
      return board.swap(event.pairs, event.phase);
    case 'walk':
      return board.walk(event.to);
    case 'launch':
      return board.launch(event.to);
    case 'slide':
      return board.ride(event);
    case 'teleport':
      return board.teleport(event.to);
    case 'plus1': {
      const { level } = board;
      const source = contentIndex(level, event.cell, board.visualState.phase);
      return board.pickupPlus(event.cell, level.plusBit[source]);
    }
    case 'refill':
      return board.pickupRefill(event.cell, event.value);
    case 'switch':
      return board.pressSwitch(event.cell, colorBit(event.color));
    // The outcome effects (StageController.celebrate / showLoss) start once the timeline ends.
    case 'win':
    case 'lose':
    case 'steps':
      return Promise.resolve(true);
  }
}

/** Resolves true when every event played, false when superseded. */
export async function playTimeline(board: BoardView, events: readonly EngineEvent[], hooks: TimelineHooks): Promise<boolean> {
  for (const event of events) {
    if (!hooks.isCurrent()) {
      return false;
    }

    hooks.onEventStart(event);
    await presentEvent(board, event);
  }

  return hooks.isCurrent();
}
