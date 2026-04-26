import { addAxial, coordKey, getCatapultOffset, isNeighbor } from './hex';
import { getCell, resetGameState, setCellActive, setMoveBonusConsumed } from './gameState';
import type { GameCommand } from './commands';
import type { ActivationRejectReason, AxialCoord, CellState, CommandResult, GameEvent, GameState } from './types';

type ActivationCheck = Readonly<{
  allowed: boolean;
  reason?: ActivationRejectReason;
  cell?: CellState;
}>;

export function canActivateCell(state: GameState, coord: AxialCoord): ActivationCheck {
  if (state.status !== 'playing') {
    return { allowed: false, reason: 'not-playing' };
  }

  if (state.movesRemaining <= 0) {
    return { allowed: false, reason: 'no-moves' };
  }

  const cell = getCell(state, coord);

  if (cell === undefined) {
    return { allowed: false, reason: 'missing-cell' };
  }

  if (!cell.walkable) {
    return { allowed: false, reason: 'not-walkable', cell };
  }

  if (cell.active) {
    return { allowed: false, reason: 'already-active', cell };
  }

  if (state.rules.requireLarryAdjacency && !isNeighbor(state.larryPosition, coord)) {
    return { allowed: false, reason: 'not-adjacent', cell };
  }

  return { allowed: true, cell };
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  switch (command.type) {
    case 'start-level': {
      if (state.status !== 'pregame') {
        return { state, accepted: false, reason: 'not-playing', events: [] };
      }

      const nextState: GameState = { ...state, status: 'playing' };
      return {
        state: nextState,
        accepted: true,
        events: [{ type: 'level-started', levelId: state.level.id }],
      };
    }

    case 'reset-level': {
      const nextState = resetGameState(state);
      return {
        state: nextState,
        accepted: true,
        events: [{ type: 'level-reset', levelId: state.level.id }],
      };
    }

    case 'activate-cell':
      return activateCell(state, command.coord);
  }
}

function activateCell(state: GameState, coord: AxialCoord): CommandResult {
  const activation = canActivateCell(state, coord);

  if (!activation.allowed || activation.cell === undefined) {
    return {
      state,
      accepted: false,
      reason: activation.reason,
      events: [],
    };
  }

  const from = state.larryPosition;
  const targetCell = activation.cell;
  const activatedState = setCellActive(state, targetCell, true);
  const movedState: GameState = {
    ...activatedState,
    movesRemaining: activatedState.movesRemaining - 1,
    larryPosition: targetCell.coord,
  };
  const events: GameEvent[] = [
    { type: 'cell-activated', coord: targetCell.coord, source: 'manual' },
    { type: 'move-spent', amount: 1, remaining: movedState.movesRemaining, source: 'manual' },
    { type: 'larry-moved', from, to: targetCell.coord, source: 'manual' },
  ];

  return finalizeMovement(resolveLandingSequence(movedState, targetCell.coord, events));
}

function resolveLandingSequence(inputState: GameState, landedCoord: AxialCoord, inputEvents: GameEvent[]) {
  let state = inputState;
  let currentCoord = landedCoord;
  let chainCount = 0;
  const events = [...inputEvents];

  while (true) {
    const currentCell = getCell(state, currentCoord);

    if (currentCell === undefined) {
      break;
    }

    if (currentCell.moveBonus > 0 && !currentCell.moveBonusConsumed) {
      state = setMoveBonusConsumed(state, currentCell, true);
      state = {
        ...state,
        movesRemaining: state.movesRemaining + currentCell.moveBonus,
      };
      events.push({
        type: 'move-bonus-consumed',
        coord: currentCell.coord,
        amount: currentCell.moveBonus,
        remaining: state.movesRemaining,
      });
    }

    if (currentCell.catapultDirection === null) {
      break;
    }

    if (chainCount >= state.rules.maxCatapultChainCount) {
      events.push({ type: 'catapult-blocked', coord: currentCell.coord, reason: 'chain-limit' });
      break;
    }

    if (state.movesRemaining <= 0) {
      events.push({ type: 'catapult-blocked', coord: currentCell.coord, reason: 'no-moves' });
      break;
    }

    const landingCoord = addAxial(
      currentCell.coord,
      getCatapultOffset(currentCell.catapultDirection),
      currentCell.catapultDistance,
    );
    const landingCell = getCell(state, landingCoord);

    if (landingCell === undefined) {
      events.push({ type: 'catapult-blocked', coord: currentCell.coord, reason: 'missing-cell' });
      break;
    }

    if (!landingCell.walkable) {
      events.push({ type: 'catapult-blocked', coord: currentCell.coord, reason: 'not-walkable' });
      break;
    }

    const beforeLaunch = currentCell.coord;
    let launchedState = landingCell.active ? state : setCellActive(state, landingCell, true);

    if (!landingCell.active) {
      events.push({ type: 'cell-activated', coord: landingCell.coord, source: 'catapult' });
    }

    launchedState = {
      ...launchedState,
      movesRemaining: launchedState.movesRemaining - 1,
      larryPosition: landingCell.coord,
    };

    state = launchedState;
    currentCoord = landingCell.coord;
    chainCount += 1;
    events.push(
      { type: 'move-spent', amount: 1, remaining: state.movesRemaining, source: 'catapult' },
      { type: 'larry-moved', from: beforeLaunch, to: landingCell.coord, source: 'catapult' },
    );
  }

  return { state, finalCoord: currentCoord, events };
}

function finalizeMovement(input: Readonly<{ state: GameState; finalCoord: AxialCoord; events: GameEvent[] }>): CommandResult {
  const finalCell = getCell(input.state, input.finalCoord);

  if (finalCell?.tileType === 'goal') {
    const nextState: GameState = { ...input.state, status: 'won' };
    return {
      state: nextState,
      accepted: true,
      events: [...input.events, { type: 'level-won', coord: input.finalCoord }],
    };
  }

  if (input.state.movesRemaining === 0) {
    const nextState: GameState = { ...input.state, status: 'lost' };
    return {
      state: nextState,
      accepted: true,
      events: [...input.events, { type: 'level-lost', coord: input.finalCoord }],
    };
  }

  return {
    state: input.state,
    accepted: true,
    events: input.events,
  };
}

export function getOrderedCells(state: GameState): CellState[] {
  return state.cellOrder.map((key) => state.cellsByKey[key]).filter((cell): cell is CellState => cell !== undefined);
}

export function hasCell(state: GameState, coord: AxialCoord): boolean {
  return state.cellsByKey[coordKey(coord)] !== undefined;
}
