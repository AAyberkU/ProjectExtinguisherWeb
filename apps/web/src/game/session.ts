// Play session: the current level, its play state, and the undo history. Pure and immutable; every
// gameplay change goes through the engine (`step`, `initialState`).

import { initialState, step, type Dir, type EngineEvent, type PlayState } from './engine';
import type { PlayableLevel } from './levels';

export interface Session {
  readonly level: PlayableLevel;
  readonly state: PlayState;
  /** States before each accepted move, oldest first. */
  readonly history: readonly PlayState[];
}

export interface SessionMove {
  readonly session: Session;
  readonly events: readonly EngineEvent[];
}

export function createSession(level: PlayableLevel): Session {
  return { level, state: initialState(level.compiled), history: [] };
}

/** Applies one move, or returns null when the engine rejects it (nothing changes). */
export function sessionMove(session: Session, dir: Dir): SessionMove | null {
  const result = step(session.level.compiled, session.state, dir);

  if (result === null) {
    return null;
  }

  return {
    session: { level: session.level, state: result.state, history: [...session.history, session.state] },
    events: result.events,
  };
}

/** Undo stays available after a loss and after a win (the win badge waits; there is no auto-advance). */
export function canUndo(session: Session): boolean {
  return session.history.length > 0;
}

/** Returns to the state before the last move (also after a win or a loss), or null when nothing to undo. */
export function sessionUndo(session: Session): Session | null {
  if (!canUndo(session)) {
    return null;
  }

  const history = session.history.slice(0, -1);

  return { level: session.level, state: session.history[session.history.length - 1], history };
}

export function sessionRestart(session: Session): Session {
  return createSession(session.level);
}
