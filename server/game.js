import { randomInt, randomUUID } from 'node:crypto';

export class GameError extends Error {}

export const DEFAULT_RULES = {
  sameNumber: true,
  rummy: false,
  anyCard: true,
  continuation: false,
};

export function deckCount(players) {
  return players <= 3 ? 1 : players <= 5 ? 2 : players <= 8 ? 3 : 4;
}

export function createDeck(count) {
  const cards = [];
  for (let deck = 0; deck < count; deck++) {
    for (const suit of ['clubs', 'diamonds', 'hearts', 'spades']) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push({ id: `${deck}-${suit}-${rank}`, suit, rank });
      }
    }
    for (let joker = 0; joker < 2; joker++) {
      cards.push({ id: `${deck}-joker-${joker}`, suit: 'joker', rank: 0 });
    }
  }
  return cards;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export const handValue = (hand) => hand.reduce((total, card) => total + card.rank, 0);

export function legalPlay(cards, top, rules) {
  if (!cards.length) return false;
  if (cards.length === 1) {
    return Boolean(rules.anyCard
      || (rules.sameNumber && top && cards[0].rank === top.rank)
      || (rules.continuation && top && cards[0].suit === top.suit
        && top.rank > 0 && cards[0].rank === top.rank + 1));
  }
  if (!cards.every((card) => card.rank === cards[0].rank)) return false;
  if (rules.sameNumber) return true;
  if (!rules.rummy || cards.length < 3) return false;
  const set = cards.every((card) => card.rank > 0 && card.rank === cards[0].rank)
    && new Set(cards.map((card) => card.suit)).size === cards.length;
  return set;
}

export function createRoom(code, host, options = {}) {
  return {
    code,
    name: options.name || `${host.name}'s table`,
    hostId: host.id,
    capacity: options.capacity || 5,
    pointsToEliminate: options.pointsToEliminate || 201,
    rules: { ...DEFAULT_RULES, ...options.rules },
    players: [{ id: host.id, name: host.name, score: 0, hand: [], eliminated: false, lives: 5 }],
    status: 'waiting',
    round: 0,
    dealerIndex: -1,
    turnId: null,
    completedTurnIds: [],
    drawPile: [],
    discardPile: [],
    lastPlay: [],
    results: [],
    chat: [],
    revision: 0,
    matchId: randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function joinRoom(room, user) {
  if (room.players.some((player) => player.id === user.id && player.left)) throw new GameError('You left this match and cannot rejoin it.');
  if (room.players.some((player) => player.id === user.id)) return;
  if (room.status !== 'waiting') throw new GameError('This match has already started.');
  if (room.players.length >= room.capacity) throw new GameError('This table is full.');
  room.players.push({ id: user.id, name: user.name, score: 0, hand: [], eliminated: false, lives: 5 });
}

export function leaveRoom(room, userId) {
  const player = room.players.find((entry) => entry.id === userId && !entry.left);
  if (!player) throw new GameError('Join a table first.');
  if (room.status === 'waiting') {
    room.players = room.players.filter((entry) => entry.id !== userId);
  } else {
    if (room.status === 'playing' && room.turnId === userId && !player.eliminated) advance(room, player);
    player.left = true;
    if (['playing', 'roundEnd'].includes(room.status)) {
      player.eliminated = true;
      room.completedTurnIds = room.completedTurnIds.filter((id) => id !== userId);
      room.lastAction = `${player.name} left the match.`;
      const survivors = room.players.filter((entry) => !entry.eliminated);
      if (survivors.length <= 1) {
        room.status = 'finished';
        room.turnId = null;
        room.turnDeadline = null;
        room.nextRoundDeadline = null;
        room.winnerId = survivors[0]?.id || null;
        room.winnerIds = survivors.map((entry) => entry.id);
        room.lastAction += survivors.length ? ` ${survivors[0].name} wins the match!` : 'No active players remain.';
      }
    }
  }
  if (room.hostId === userId) room.hostId = room.players.find((entry) => !entry.left)?.id || null;
}

export function startRound(room, userId) {
  if (!room.players.some((player) => player.id === userId && !player.left)) throw new GameError('Join this table before dealing.');
  if (!['waiting', 'roundEnd'].includes(room.status)) throw new GameError('A round cannot start now.');
  const active = room.players.filter((player) => !player.eliminated);
  if (active.length < 2) throw new GameError('At least 2 players are needed to start a round.');
  const deck = shuffle(createDeck(deckCount(active.length)));
  for (const player of room.players) {
    player.hand = player.eliminated ? [] : deck.splice(0, 5);
  }
  room.dealerIndex = (room.dealerIndex + 1) % active.length;
  room.turnId = active[(room.dealerIndex + 1) % active.length].id;
  room.drawPile = deck;
  room.discardPile = [room.drawPile.pop()];
  room.lastPlay = [room.discardPile[0]];
  room.round++;
  room.completedTurnIds = [];
  room.status = 'playing';
  room.lastAction = `Round ${room.round} dealt. ${active[room.dealerIndex].name} is the dealer.`;
}

function currentPlayer(room, userId) {
  if (room.status !== 'playing') throw new GameError('There is no active round.');
  if (room.turnId !== userId) throw new GameError('It is not your turn.');
  const player = room.players.find((entry) => entry.id === userId);
  if (!player || player.eliminated) throw new GameError('You are not active in this round.');
  return player;
}

function draw(room) {
  if (!room.drawPile.length) {
    const visibleIds = new Set(room.lastPlay.map((card) => card.id));
    room.drawPile = shuffle(room.discardPile.filter((card) => !visibleIds.has(card.id)));
    room.discardPile = room.discardPile.filter((card) => visibleIds.has(card.id));
  }
  if (!room.drawPile.length) throw new GameError('No cards are available to draw.');
  return room.drawPile.pop();
}

function advance(room, player) {
  const active = room.players.filter((entry) => !entry.eliminated);
  room.turnId = active[(active.findIndex((entry) => entry.id === player.id) + 1) % active.length].id;
}

export function playTurn(room, userId, cardIds, drawSource = 'drawPile', discardCardId) {
  const player = currentPlayer(room, userId);
  if (!['drawPile', 'discard'].includes(drawSource)) throw new GameError('Choose the draw pile or last discard.');
  if (drawSource !== 'discard' && discardCardId !== undefined) throw new GameError('Choose the discard source to take a visible card.');
  if (drawSource === 'discard' && !room.lastPlay.length) throw new GameError('There is no last discard to take.');
  const pickedDiscard = drawSource === 'discard'
    ? room.lastPlay.find((card) => card.id === (discardCardId ?? room.lastPlay.at(-1)?.id)) : null;
  if (drawSource === 'discard' && !pickedDiscard) throw new GameError('Choose one card from the latest dropped group.');
  if (!Array.isArray(cardIds) || cardIds.length > player.hand.length
    || new Set(cardIds).size !== cardIds.length) throw new GameError('Invalid card selection.');
  const cards = cardIds.map((id) => player.hand.find((card) => card.id === id));
  if (cards.some((card) => !card)) throw new GameError('Select only cards in your hand.');
  if (cards.length && !legalPlay(cards, room.lastPlay.at(-1), room.rules)) {
    throw new GameError('That combination is not a legal play.');
  }
  if (player.hand.length - cards.length + 1 > 5) {
    throw new GameError('Your hand cannot exceed 5 cards. Select cards to drop before drawing.');
  }
  // Reserve the chosen visible card before covering the group with this turn's drop.
  if (pickedDiscard) {
    room.discardPile = room.discardPile.filter((card) => card.id !== pickedDiscard.id);
    room.lastPlay = room.lastPlay.filter((card) => card.id !== pickedDiscard.id);
  }
  if (cards.length) {
    player.hand = player.hand.filter((card) => !cardIds.includes(card.id));
    room.discardPile.push(...cards);
    room.lastPlay = cards;
  }
  if (!pickedDiscard && !room.drawPile.length && room.discardPile.length <= room.lastPlay.length) {
    const active = room.players.filter((entry) => !entry.eliminated);
    const minimum = Math.min(...active.map((entry) => handValue(entry.hand)));
    settleRound(room, {
      showingId: null, clash: false, successful: false, minimum,
      message: 'The pile ran out. Lowest hands score 0; all other hands score +50.',
      penaltyFor: (entry) => handValue(entry.hand) === minimum ? 0 : 50,
    });
    return;
  }
  player.hand.push(pickedDiscard || draw(room));
  if (!room.completedTurnIds.includes(userId)) room.completedTurnIds.push(userId);
  const pickup = pickedDiscard ? 'took one card from the previous last discard group' : 'drew a card from the draw pile';
  room.lastAction = cards.length
    ? `${player.name} dropped ${cards.length} card${cards.length === 1 ? '' : 's'} and ${pickup}.`
    : `${player.name} ${pickup}.`;
  advance(room, player);
}

export function expireTurn(room) {
  const player = currentPlayer(room, room.turnId);
  if (player.lives === 1) {
    advance(room, player);
    player.lives = 0;
    player.eliminated = true;
    room.lastAction = `${player.name} lost their last life after 5 missed turns and is now watching.`;
    const survivors = room.players.filter((entry) => !entry.eliminated);
    if (survivors.length === 1) {
      room.status = 'finished';
      room.turnId = null;
      room.turnDeadline = null;
      room.winnerId = survivors[0].id;
      room.winnerIds = [survivors[0].id];
      room.lastAction += ` ${survivors[0].name} wins the match!`;
    }
    return;
  }
  if (player.hand.length >= 5) {
    if (!room.completedTurnIds.includes(player.id)) room.completedTurnIds.push(player.id);
    room.lastAction = `${player.name}'s turn was skipped without drawing (5-card limit).`;
    advance(room, player);
  } else {
    playTurn(room, player.id, []);
  }
  player.lives--;
  room.lastAction += ` (Turn timer expired.) ${player.lives} ${player.lives === 1 ? 'life' : 'lives'} remaining.`;
}

function settleRound(room, { showingId, clash, successful, minimum, message, penaltyFor }) {
  const active = room.players.filter((player) => !player.eliminated);
  const scores = active.map((player) => {
    const penalty = penaltyFor(player);
    player.score += penalty;
    player.eliminated = player.score >= room.pointsToEliminate;
    return {
      id: player.id, name: player.name, hand: [...player.hand],
      value: handValue(player.hand), penalty, score: player.score, eliminated: player.eliminated,
    };
  });
  const survivors = room.players.filter((player) => !player.eliminated);
  room.status = survivors.length <= 1 ? 'finished' : 'roundEnd';
  room.turnId = null;
  room.lastAction = message;
  const result = {
    round: room.round, showingId, clash, successful, minimum, scores,
    message: room.lastAction,
  };
  room.results.push(result);
  if (room.status === 'finished') room.winnerId = survivors[0]?.id || null;
  return result;
}

export function showHand(room, userId) {
  const showing = currentPlayer(room, userId);
  const value = handValue(showing.hand);
  const active = room.players.filter((player) => !player.eliminated);
  if (!active.every((player) => room.completedTurnIds.includes(player.id))) {
    throw new GameError('Everyone must complete one turn this round before showing.');
  }
  const minimum = Math.min(...active.map((player) => handValue(player.hand)));
  const clash = active.some((player) => player.id !== userId && handValue(player.hand) === value);
  const successful = value === minimum && !clash;
  return settleRound(room, {
    showingId: userId, clash, successful, minimum,
    message: clash ? `${showing.name} clashed! +50 points. Matching hands score 0; others add their hand values.`
      : successful ? `${showing.name} showed the lowest hand!`
        : `${showing.name}'s show was beaten. +50 points.`,
    penaltyFor: (player) => {
      if (player.id === userId) return successful ? 0 : 50;
      if (clash && handValue(player.hand) === value) return 0;
      return handValue(player.hand);
    },
  });
}

export function abortMatch(room, userId) {
  if (room.hostId !== userId) throw new GameError('Only the host can abort a game.');
  if (!['playing', 'roundEnd'].includes(room.status)) throw new GameError('There is no active match to abort.');
  room.status = 'aborted';
  room.turnId = null;
  room.turnDeadline = null;
  room.lastAction = 'The host aborted the game. No scores or match history were saved.';
}

export function finishMatch(room, userId) {
  if (room.hostId !== userId) throw new GameError('Only the host can finish a match.');
  if (room.status !== 'roundEnd') throw new GameError('Finish the current round first.');
  room.status = 'finished';
  const active = room.players.filter((player) => !player.eliminated);
  const minimum = Math.min(...active.map((player) => player.score));
  const winners = active.filter((player) => player.score === minimum);
  room.winnerId = winners.length === 1 ? winners[0].id : null;
  room.winnerIds = winners.map((player) => player.id);
  room.lastAction = `Match finished. ${winners.map((player) => player.name).join(' & ')} win${winners.length === 1 ? 's' : ''}!`;
}

export function roomView(room, viewerId, connectedIds = new Set()) {
  return {
    code: room.code, name: room.name, hostId: room.hostId, capacity: room.capacity,
    pointsToEliminate: room.pointsToEliminate, rules: room.rules, status: room.status, round: room.round, turnId: room.turnId,
    revision: room.revision, nextRoundDeadline: room.nextRoundDeadline ?? null,
    deckCount: deckCount(room.players.filter((p) => !p.eliminated).length),
    showUnlocked: room.status === 'playing' && room.players
      .filter((player) => !player.eliminated)
      .every((player) => room.completedTurnIds.includes(player.id)),
    drawCount: room.drawPile.length, discard: room.lastPlay.at(-1) || null,
    lastPlay: room.lastPlay, lastAction: room.lastAction,
    results: room.results, chat: room.chat,
    winnerIds: room.winnerIds || (room.winnerId ? [room.winnerId] : []),
    winnerHands: room.status === 'finished' ? room.players
      .filter((player) => (room.winnerIds || [room.winnerId]).includes(player.id))
      .map((player) => ({ id: player.id, name: player.name, hand: player.hand })) : [],
    players: room.players.filter((player) => !player.left).map(({ hand, ...player }) => ({
      ...player, cardCount: hand.length, connected: connectedIds.has(player.id),
      ...(player.id === viewerId ? { hand, value: handValue(hand) } : {}),
    })),
  };
}
