import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, createDeck, deckCount, createRoom, joinRoom, leaveRoom, startRound,
  legalPlay, playTurn, expireTurn, showHand, finishMatch, abortMatch, handValue, roomView,
} from '../server/game.js';

const card = (rank, suit = 'hearts', id = `${suit}-${rank}`) => ({ rank, suit, id });
function fixture(count = 3) {
  const room = createRoom('ABC234', { id: 'p0', name: 'Player 0' }, { capacity: count });
  for (let i = 1; i < count; i++) joinRoom(room, { id: `p${i}`, name: `Player ${i}` });
  startRound(room, 'p0');
  return room;
}
function hands(room, ranks) {
  room.players.forEach((player, index) => {
    player.hand = ranks[index].map((rank, i) => card(rank, 'clubs', `p${index}-${i}`));
  });
  room.turnId = 'p0';
  room.completedTurnIds = room.players.filter((player) => !player.eliminated).map((player) => player.id);
}

test('deck sizing covers every supported table size and includes two jokers per deck', () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map(deckCount), [1, 1, 2, 2, 3, 3, 3, 4, 4]);
  const deck = createDeck(4);
  assert.equal(deck.length, 216);
  assert.equal(new Set(deck.map((entry) => entry.id)).size, 216);
  assert.equal(deck.filter((entry) => entry.rank === 0).length, 8);
});
test('all 2–10 player games deal five cards and reveal one starter', () => {
  for (let count = 2; count <= 10; count++) {
    const room = fixture(count);
    assert.ok(room.players.every((player) => player.hand.length === 5));
    assert.equal(room.discardPile.length, 1);
    assert.equal(room.drawPile.length, deckCount(count) * 54 - count * 5 - 1);
    assert.equal(room.turnId, 'p1');
    assert.equal(room.round, 1);
  }
});
test('two-player turns alternate, showing waits for both, and subsequent rounds rotate dealers', () => {
  const room = fixture(2);
  assert.throws(() => showHand(room, 'p1'), /Everyone must complete/);
  playTurn(room, 'p1', [room.players[1].hand[0].id]);
  assert.equal(room.turnId, 'p0');
  assert.throws(() => showHand(room, 'p0'), /Everyone must complete/);
  playTurn(room, 'p0', [room.players[0].hand[0].id]);
  assert.equal(room.turnId, 'p1');
  hands(room, [[1], [2]]);
  showHand(room, 'p0');
  assert.equal(room.status, 'roundEnd');
  assert.deepEqual(room.players.map((player) => player.score), [0, 2]);
  startRound(room, 'p0');
  assert.equal(room.round, 2);
  assert.equal(room.dealerIndex, 1);
  assert.equal(room.turnId, 'p0');
  room.players[1].lives = 1;
  room.turnId = 'p1';
  expireTurn(room);
  assert.equal(room.status, 'finished');
  assert.equal(room.winnerId, 'p0');
});
test('leaving the current turn advances safely, transfers host, and preserves other hands and scores', () => {
  const room = fixture(4);
  room.turnId = 'p0';
  const others = structuredClone(room.players.slice(1));
  leaveRoom(room, 'p0');
  assert.equal(room.status, 'playing');
  assert.equal(room.hostId, 'p1');
  assert.equal(room.turnId, 'p1');
  assert.equal(room.players[0].left, true);
  assert.equal(room.players[0].eliminated, true);
  assert.deepEqual(room.players.slice(1), others);
  assert.deepEqual(roomView(room, 'p1').players.map((player) => player.id), ['p1', 'p2', 'p3']);
  assert.throws(() => leaveRoom(room, 'p0'), /Join a table/);
});
test('leaving off-turn or while watching does not change the turn or award a premature win', () => {
  const room = fixture(4);
  room.players[3].eliminated = true;
  leaveRoom(room, 'p3');
  assert.equal(room.turnId, 'p1');
  assert.equal(room.status, 'playing');
  leaveRoom(room, 'p2');
  assert.equal(room.turnId, 'p1');
  assert.equal(room.status, 'playing');
  playTurn(room, 'p1', [room.players[1].hand[0].id]);
  assert.equal(room.turnId, 'p0');
});
test('departures between rounds exclude players from future deals and showing requirements', () => {
  const room = fixture(4);
  hands(room, [[1], [2], [3], [4]]);
  showHand(room, 'p0');
  leaveRoom(room, 'p1');
  assert.equal(room.status, 'roundEnd');
  startRound(room, 'p0');
  assert.equal(room.players[1].hand.length, 0);
  assert.equal(room.players[0].hand.length, 5);
  assert.notEqual(room.turnId, 'p1');
  room.completedTurnIds = ['p0', 'p2', 'p3'];
  assert.equal(roomView(room, 'p0').showUnlocked, true);
});
test('a departure awards the sole active survivor a win during play or the round break', () => {
  for (const status of ['playing', 'roundEnd']) {
    const room = fixture(3);
    room.status = status;
    room.nextRoundDeadline = Date.now() + 15_000;
    room.players[2].eliminated = true;
    leaveRoom(room, 'p1');
    assert.equal(room.status, 'finished');
    assert.deepEqual(room.winnerIds, ['p0']);
    assert.equal(room.turnId, null);
    assert.equal(room.nextRoundDeadline, null);
    const scores = room.players.map((player) => player.score);
    leaveRoom(room, 'p0');
    assert.deepEqual(room.winnerIds, ['p0']);
    assert.deepEqual(room.players.map((player) => player.score), scores);
  }
});
test('leaving a waiting table removes its seat and transfers host without ending a match', () => {
  const room = createRoom('ABC234', { id: 'p0', name: 'Host' });
  joinRoom(room, { id: 'p1', name: 'Opponent' });
  leaveRoom(room, 'p0');
  assert.equal(room.status, 'waiting');
  assert.equal(room.hostId, 'p1');
  assert.equal(room.players.length, 1);
  leaveRoom(room, 'p1');
  assert.equal(room.players.length, 0);
  assert.equal(room.hostId, null);
});
test('card values match ranks, with Joker zero and court cards 11–13', () => {
  assert.equal(handValue([0, 1, 7, 11, 12, 13].map((rank) => card(rank))), 44);
});
test('match winning hands are shared with all viewers only after the match finishes', () => {
  const room = fixture();
  hands(room, [[1], [2], [3]]);
  assert.deepEqual(roomView(room, 'p1').winnerHands, []);
  showHand(room, 'p0');
  assert.deepEqual(roomView(room, 'p1').winnerHands, []);
  room.players.forEach((player) => { player.score = 10; });
  finishMatch(room, 'p0');
  for (const viewer of ['p0', 'p1', 'p2']) {
    const view = roomView(room, viewer);
    assert.deepEqual(view.winnerHands, room.players.map(({ id, name, hand }) => ({ id, name, hand })));
    assert.equal(view.players.filter((player) => 'hand' in player).length, 1);
  }
});
test('timeout match winner is revealed without exposing eliminated hands', () => {
  const room = fixture();
  room.players[2].eliminated = true;
  room.players[0].lives = 1;
  room.turnId = 'p0';
  expireTurn(room);
  const view = roomView(room, 'p0');
  assert.equal(view.status, 'finished');
  assert.deepEqual(view.winnerHands.map((player) => player.id), ['p1']);
  assert.deepEqual(view.winnerHands[0].hand, room.players[1].hand);
});
test('any-card rule allows a single card but not arbitrary groups', () => {
  const rules = { anyCard: true };
  assert.equal(legalPlay([card(12)], card(3), rules), true);
  assert.equal(legalPlay([card(12), card(3)], card(3), rules), false);
  assert.equal(legalPlay([], card(3), rules), false);
});
test('same-number groups support duplicate suits across decks and matching single cards', () => {
  const rules = { sameNumber: true };
  assert.equal(legalPlay([card(5), card(5, 'spades'), card(5, 'hearts', 'other-deck')], card(9), rules), true);
  assert.equal(legalPlay([card(5)], card(5, 'clubs'), rules), true);
  assert.equal(legalPlay([card(4)], card(5), rules), false);
});
test('rummy accepts only distinct-suit same-rank sets, not mixed-rank runs', () => {
  const rules = { rummy: true };
  assert.equal(legalPlay([card(3), card(1), card(2)], card(9), rules), false);
  assert.equal(legalPlay([card(6), card(6, 'clubs'), card(6, 'spades')], card(9), rules), true);
  assert.equal(legalPlay([card(6), card(6), card(6, 'spades')], card(9), rules), false);
  assert.equal(legalPlay([card(1), card(2)], card(9), rules), false);
  assert.equal(legalPlay([card(1), card(2, 'clubs'), card(3)], card(9), rules), false);
  assert.equal(legalPlay([card(12), card(13), card(1)], card(9), rules), false);
  assert.equal(legalPlay([card(0), card(1), card(2)], card(9), rules), false);
  assert.equal(legalPlay([card(2), card(2), card(3)], card(9), rules), false);
});
test('continuation allows only the next rank in the same suit, with no wrap or Joker', () => {
  const rules = { continuation: true };
  assert.equal(legalPlay([card(8)], card(7), rules), true);
  assert.equal(legalPlay([card(8, 'clubs')], card(7), rules), false);
  assert.equal(legalPlay([card(1)], card(13), rules), false);
  assert.equal(legalPlay([card(1, 'joker')], card(0, 'joker'), rules), false);
});
test('a legal turn drops a group, draws one, and advances exactly once', () => {
  const room = fixture();
  hands(room, [[4, 4, 9], [2], [3]]);
  const originalCount = room.drawPile.length;
  playTurn(room, 'p0', ['p0-0', 'p0-1']);
  assert.equal(room.players[0].hand.length, 2);
  assert.equal(room.drawPile.length, originalCount - 1);
  assert.equal(room.discardPile.at(-1).rank, 4);
  assert.equal(room.turnId, 'p1');
});
test('mixed-rank drops are rejected even when all house rules are enabled', () => {
  const room = fixture();
  hands(room, [[3, 1, 2], [2], [3]]);
  const before = structuredClone(room);
  assert.throws(() => playTurn(room, 'p0', ['p0-0', 'p0-1', 'p0-2']), /not a legal play/);
  assert.deepEqual(room, before);
});
test('draw-only turn is allowed and never discards another card', () => {
  const room = fixture();
  hands(room, [[1, 2, 3, 4], [2], [3]]);
  const top = room.discardPile.at(-1);
  playTurn(room, 'p0', []);
  assert.equal(room.players[0].hand.length, 5);
  assert.equal(room.discardPile.at(-1), top);
  assert.equal(room.turnId, 'p1');
});
test('five-card hands must drop before taking from either pile, without mutating rejected turns', () => {
  for (const source of ['drawPile', 'discard']) {
    const room = fixture();
    room.turnId = 'p0';
    const before = structuredClone(room);
    assert.throws(() => playTurn(room, 'p0', [], source), /cannot exceed 5 cards/);
    assert.deepEqual(room, before);
    playTurn(room, 'p0', [room.players[0].hand[0].id], source);
    assert.equal(room.players[0].hand.length, 5);
  }
});
test('dropping a matching group reduces the hand and drawing below the limit stops at five', () => {
  const room = fixture();
  hands(room, [[7, 7, 7, 2, 3], [1], [2]]);
  playTurn(room, 'p0', ['p0-0', 'p0-1', 'p0-2']);
  assert.equal(room.players[0].hand.length, 3);
  for (let size = 4; size <= 5; size++) {
    room.turnId = 'p0';
    playTurn(room, 'p0', []);
    assert.equal(room.players[0].hand.length, size);
  }
  room.turnId = 'p0';
  assert.throws(() => playTurn(room, 'p0', []), /cannot exceed 5 cards/);
});
test('expired full-hand turns skip unchanged and count towards unlocking show', () => {
  const room = fixture();
  const players = structuredClone(room.players);
  const drawPile = [...room.drawPile];
  const discardPile = [...room.discardPile];
  for (let i = 0; i < 3; i++) expireTurn(room);
  assert.deepEqual(room.players, players.map((player) => ({ ...player, lives: 4 })));
  assert.deepEqual(room.drawPile, drawPile);
  assert.deepEqual(room.discardPile, discardPile);
  assert.equal(room.turnId, 'p1');
  assert.equal(roomView(room, 'p1').showUnlocked, true);
  assert.match(room.lastAction, /skipped without drawing/);
});
test('expired turns below the limit still draw one card', () => {
  const room = fixture();
  hands(room, [[1, 2, 3, 4], [1], [2]]);
  expireTurn(room);
  assert.equal(room.players[0].hand.length, 5);
  assert.equal(room.players[0].lives, 4);
  assert.equal(room.turnId, 'p1');
  assert.match(room.lastAction, /timer expired/);
});
test('five missed turns eliminate a player, preserve cards, and advance in seat order', () => {
  const room = fixture(4);
  room.turnId = 'p2';
  const hand = [...room.players[2].hand];
  for (let missed = 1; missed <= 5; missed++) {
    room.turnId = 'p2';
    expireTurn(room);
    assert.equal(room.players[2].lives, 5 - missed);
    assert.equal(room.players[2].eliminated, missed === 5);
    assert.equal(room.turnId, 'p3');
    assert.deepEqual(room.players[2].hand, hand);
  }
  assert.equal(room.status, 'playing');
  assert.match(room.lastAction, /now watching/);
  room.turnId = 'p1';
  expireTurn(room);
  assert.equal(room.turnId, 'p3');
  assert.throws(() => playTurn(room, 'p2', []), /not your turn/);
  const view = roomView(room, 'p2');
  assert.equal(view.players[2].lives, 0);
  assert.equal(view.players[2].eliminated, true);
  assert.deepEqual(view.players[2].hand, hand);
});
test('lives carry over legal turns and new rounds without reviving eliminated players', () => {
  const room = fixture(4);
  room.turnId = 'p0';
  expireTurn(room);
  room.turnId = 'p0';
  playTurn(room, 'p0', [room.players[0].hand[0].id]);
  assert.equal(room.players[0].lives, 4);
  room.players[1].lives = 1;
  room.turnId = 'p1';
  expireTurn(room);
  room.status = 'roundEnd';
  startRound(room, 'p0');
  assert.deepEqual(room.players.map((p) => p.lives), [4, 0, 5, 5]);
  assert.deepEqual(room.players[1].hand, []);
  assert.equal(room.players[1].eliminated, true);
});
test('final-life timeout ends the match with the last active player winning', () => {
  const room = fixture();
  room.players[0].eliminated = true;
  room.players[0].lives = 0;
  room.players[1].lives = 1;
  room.players[1].hand = [];
  room.drawPile = [];
  room.discardPile = [];
  room.turnId = 'p1';
  expireTurn(room);
  assert.equal(room.status, 'finished');
  assert.equal(room.turnId, null);
  assert.equal(room.turnDeadline, null);
  assert.deepEqual(room.winnerIds, ['p2']);
  assert.equal(room.winnerId, 'p2');
  assert.equal(room.players[1].lives, 0);
  assert.deepEqual(room.players.map((p) => p.score), [0, 0, 0]);
  assert.throws(() => expireTurn(room), /no active round/);
});
test('taking last discard without dropping removes only the previous top and does not touch draw pile', () => {
  const room = fixture();
  hands(room, [[1, 2, 3, 4], [2], [3]]);
  room.discardPile = [card(5, 'hearts', 'lower'), card(8, 'spades', 'visible')];
  room.lastPlay = [room.discardPile.at(-1)];
  const beforeHandSize = room.players[0].hand.length;
  const drawPile = [...room.drawPile];
  playTurn(room, 'p0', [], 'discard');
  assert.equal(room.players[0].hand.length, beforeHandSize + 1);
  assert.equal(room.players[0].hand.at(-1).id, 'visible');
  assert.deepEqual(room.discardPile.map((entry) => entry.id), ['lower']);
  assert.deepEqual(room.lastPlay, []);
  assert.equal(roomView(room, 'p1').discard, null);
  assert.deepEqual(room.drawPile, drawPile);
  assert.equal(room.turnId, 'p1');
  assert.ok(room.completedTurnIds.includes('p0'));
  assert.match(room.lastAction, /previous last discard/);
});
test('drop and discard pickup takes the old top, leaves dropped cards, and conserves all cards', () => {
  const room = fixture();
  room.turnId = 'p0';
  const originalTop = room.discardPile.at(-1);
  const dropCard = room.players[0].hand[0];
  const drawPile = [...room.drawPile];
  const allIds = (value) => [
    ...value.drawPile, ...value.discardPile, ...value.players.flatMap((p) => p.hand),
  ].map((entry) => entry.id).sort();
  const before = allIds(room);
  playTurn(room, 'p0', [dropCard.id], 'discard');
  assert.equal(room.players[0].hand.length, 5);
  assert.equal(room.players[0].hand.at(-1).id, originalTop.id);
  assert.equal(room.players[0].hand.some((entry) => entry.id === dropCard.id), false);
  assert.equal(room.discardPile.at(-1).id, dropCard.id);
  assert.deepEqual(room.lastPlay, [dropCard]);
  assert.deepEqual(room.drawPile, drawPile);
  assert.deepEqual(allIds(room), before);
});
test('discard pickups validate the drop against the old top before removing it', () => {
  const room = fixture();
  hands(room, [[8], [2], [3]]);
  room.rules = { continuation: true };
  room.discardPile = [card(7, 'clubs', 'old-top')];
  room.lastPlay = [...room.discardPile];
  playTurn(room, 'p0', ['p0-0'], 'discard');
  assert.equal(room.players[0].hand.at(-1).id, 'old-top');
  assert.equal(room.discardPile.at(-1).rank, 8);
});
test('taking the final discard leaves an empty discard safely and a later drop restores it', () => {
  const room = fixture();
  hands(room, [[1], [2], [3]]);
  playTurn(room, 'p0', [], 'discard');
  assert.equal(room.status, 'playing');
  assert.deepEqual(room.discardPile, []);
  assert.equal(roomView(room, 'p1').discard, null);
  assert.deepEqual(room.lastPlay, []);
  assert.equal(legalPlay([card(5)], undefined, { sameNumber: true, continuation: true }), false);
  const before = structuredClone(room);
  assert.throws(() => playTurn(room, 'p1', ['p1-0'], 'discard'), /no last discard/);
  assert.deepEqual(room, before);
  playTurn(room, 'p1', ['p1-0'], 'drawPile');
  assert.equal(room.discardPile.at(-1).id, 'p1-0');
});
test('invalid sources and illegal drops do not remove the discard or change the turn', () => {
  const room = fixture();
  hands(room, [[2, 5], [3], [7]]);
  const before = structuredClone(room);
  for (const action of [
    () => playTurn(room, 'p0', [], 'other'),
    () => playTurn(room, 'p0', ['forged'], 'discard'),
    () => playTurn(room, 'p0', ['p0-0', 'p0-1'], 'discard'),
    () => playTurn(room, 'p1', [], 'discard'),
  ]) {
    assert.throws(action);
    assert.deepEqual(room, before);
  }
});
test('a discard can be taken even with no draw cards or recyclable discards', () => {
  const room = fixture();
  hands(room, [[1], [2], [3]]);
  room.drawPile = [];
  room.discardPile = [card(7, 'spades', 'last')];
  room.lastPlay = [...room.discardPile];
  playTurn(room, 'p0', [], 'discard');
  assert.equal(room.status, 'playing');
  assert.equal(room.results.length, 0);
  assert.equal(room.players[0].hand.at(-1).id, 'last');
  assert.equal(room.turnId, 'p1');
});
test('wrong turn, forged cards, duplicate IDs, and invalid plays are rejected without mutation', () => {
  const room = fixture();
  hands(room, [[3, 6, 9], [2], [3]]);
  const before = structuredClone(room);
  for (const action of [
    () => playTurn(room, 'p1', []),
    () => playTurn(room, 'p0', ['invented']),
    () => playTurn(room, 'p0', ['p0-0', 'p0-0']),
    () => playTurn(room, 'p0', ['p0-0', 'p0-1']),
  ]) {
    assert.throws(action);
    assert.deepEqual(room, before);
  }
});
test('empty draw pile recycles discarded cards but preserves its top card', () => {
  const room = fixture();
  hands(room, [[3], [2], [4]]);
  room.drawPile = [];
  room.discardPile = [card(7, 'spades', 'recycle'), card(9, 'clubs', 'top')];
  room.lastPlay = [room.discardPile.at(-1)];
  playTurn(room, 'p0', []);
  assert.equal(room.players[0].hand.at(-1).id, 'recycle');
  assert.equal(room.discardPile.length, 1);
  assert.equal(room.discardPile[0].id, 'top');
});
test('fully exhausted piles settle lowest hands including ties, without a show penalty', () => {
  const room = fixture();
  hands(room, [[1], [1], [5]]);
  room.drawPile = [];
  room.discardPile = [card(9)];
  room.lastPlay = [...room.discardPile];
  playTurn(room, 'p0', []);
  assert.equal(room.status, 'roundEnd');
  assert.equal(room.turnId, null);
  assert.deepEqual(room.players.map((player) => player.score), [0, 0, 50]);
  assert.equal(room.results[0].showingId, null);
});
test('every card in the latest same-number or rummy group can be chosen exactly once', () => {
  for (const size of [2, 3, 4, 5]) {
    for (let chosen = 0; chosen < size; chosen++) {
      for (const rummyOnly of [false, true]) {
        if (rummyOnly && (size < 3 || size > 4)) continue;
        const room = fixture();
        hands(room, [Array(size).fill(7), [2], [3]]);
        room.players[0].hand.forEach((entry, index) => { entry.suit = ['clubs', 'diamonds', 'hearts', 'spades', 'clubs'][index]; });
        room.rules = rummyOnly ? { rummy: true } : { sameNumber: true };
        const group = [...room.players[0].hand];
        playTurn(room, 'p0', group.map((entry) => entry.id));
        assert.deepEqual(roomView(room, 'p1').lastPlay, group);
        const pile = [...room.drawPile];
        const allIds = () => [...room.drawPile, ...room.discardPile, ...room.players.flatMap((p) => p.hand)]
          .map((entry) => entry.id).sort();
        const before = allIds();
        playTurn(room, 'p1', [], 'discard', group[chosen].id);
        assert.equal(room.players[1].hand.at(-1).id, group[chosen].id);
        assert.equal(room.players[1].hand.length, 2);
        assert.deepEqual(room.lastPlay, group.filter((entry) => entry.id !== group[chosen].id));
        assert.deepEqual(room.drawPile, pile);
        assert.deepEqual(allIds(), before);
      }
    }
  }
});
test('new drops cover older groups and reject covered, forged, multiple, or newly dropped pickup IDs atomically', () => {
  const room = fixture();
  hands(room, [[7, 7, 7], [8, 8], [2]]);
  playTurn(room, 'p0', ['p0-0', 'p0-1', 'p0-2']);
  playTurn(room, 'p1', ['p1-0', 'p1-1'], 'discard', 'p0-0');
  assert.equal(room.players[1].hand.at(-1).id, 'p0-0');
  assert.deepEqual(room.lastPlay.map((entry) => entry.id), ['p1-0', 'p1-1']);
  const before = structuredClone(room);
  for (const id of ['p0-1', 'forged', 'p2-0', ['p1-0', 'p1-1']]) {
    assert.throws(() => playTurn(room, 'p2', ['p2-0'], 'discard', id), /latest dropped group/);
    assert.deepEqual(room, before);
  }
  assert.throws(() => playTurn(room, 'p2', [], 'drawPile', 'p1-0'), /discard source/);
  assert.deepEqual(room, before);
});
test('recycling preserves the entire visible group and only shuffles covered discards', () => {
  const room = fixture();
  hands(room, [[7, 7, 7], [2], [3]]);
  playTurn(room, 'p0', ['p0-0', 'p0-1', 'p0-2']);
  const group = [...room.lastPlay];
  const covered = room.discardPile[0];
  room.drawPile = [];
  playTurn(room, 'p1', []);
  assert.equal(room.players[1].hand.at(-1).id, covered.id);
  assert.deepEqual(room.discardPile, group);
  assert.deepEqual(room.lastPlay, group);
  playTurn(room, 'p2', []);
  assert.equal(room.status, 'roundEnd');
  assert.deepEqual(room.lastPlay, group);
});
test('unique lowest show adds zero to showing player and own hand values to others', () => {
  const room = fixture();
  hands(room, [[1, 2], [4, 5], [8]]);
  const result = showHand(room, 'p0');
  assert.equal(result.successful, true);
  assert.equal(result.clash, false);
  assert.equal(room.status, 'roundEnd');
  assert.deepEqual(room.players.map((player) => player.score), [0, 9, 8]);
  assert.equal(room.turnId, null);
});
test('clash adds 50 to showing player, zero to matching hands and own values to others', () => {
  const room = fixture();
  hands(room, [[1, 2], [3], [9]]);
  const result = showHand(room, 'p0');
  assert.equal(result.clash, true);
  assert.deepEqual(room.players.map((player) => player.score), [50, 0, 9]);
});
test('a beaten show adds 50 to showing player and own values to others even if lowest hands tie', () => {
  const room = fixture();
  hands(room, [[8], [3], [3]]);
  const result = showHand(room, 'p0');
  assert.equal(result.clash, false);
  assert.equal(result.successful, false);
  assert.deepEqual(room.players.map((player) => player.score), [50, 3, 3]);
});
test('show accepts hand values above 10 after opening turns', () => {
  const room = fixture();
  hands(room, [[11], [12], [13]]);
  assert.equal(showHand(room, 'p0').successful, true);
});
test('show locks until every active player completes a turn and resets on each deal', () => {
  const room = fixture();
  room.players.forEach((player) => {
    player.hand = [card(1, 'clubs', player.id)];
  });
  for (let i = 0; i < 3; i++) {
    const before = structuredClone(room);
    assert.equal(roomView(room, room.turnId).showUnlocked, false);
    assert.throws(() => showHand(room, room.turnId), /Everyone must complete one turn/);
    assert.deepEqual(room, before);
    if (i === 0) {
      assert.throws(() => playTurn(room, room.turnId, ['forged']), /Select only cards/);
      assert.deepEqual(room.completedTurnIds, []);
    }
    playTurn(room, room.turnId, []);
  }
  assert.equal(roomView(room, room.turnId).showUnlocked, true);
  assert.equal(room.completedTurnIds.length, 3);
  assert.throws(() => showHand(room, 'p0'), /not your turn/);
  showHand(room, room.turnId);
  startRound(room, 'p0');
  assert.deepEqual(room.completedTurnIds, []);
  assert.equal(roomView(room, room.turnId).showUnlocked, false);
});
test('opening show lock excludes eliminated players', () => {
  const room = fixture(4);
  room.players[3].eliminated = true;
  room.players[3].score = 200;
  room.status = 'roundEnd';
  startRound(room, 'p0');
  for (let i = 0; i < 3; i++) expireTurn(room);
  assert.equal(roomView(room, room.turnId).showUnlocked, true);
  assert.equal(room.completedTurnIds.includes('p3'), false);
});
test('a match to the showing value takes precedence even if a different player is lower', () => {
  const room = fixture(4);
  hands(room, [[8], [8], [3], [12]]);
  room.players.forEach((player) => { player.score = 20; });
  const result = showHand(room, 'p0');
  assert.equal(result.clash, true);
  assert.equal(result.successful, false);
  assert.deepEqual(result.scores.map((entry) => entry.penalty), [50, 0, 3, 12]);
  assert.deepEqual(room.players.map((player) => player.score), [70, 20, 23, 32]);
});
test('all matching opponents score zero, and zero-point rounds preserve cumulative scores', () => {
  const room = fixture(4);
  hands(room, [[4], [4], [4], [9]]);
  room.players.forEach((player) => { player.score = 30; });
  showHand(room, 'p0');
  assert.deepEqual(room.players.map((player) => player.score), [80, 30, 30, 39]);
  startRound(room, 'p0');
  hands(room, [[1], [5], [7], [9]]);
  showHand(room, 'p0');
  assert.deepEqual(room.players.map((player) => player.score), [80, 35, 37, 48]);
});
test('the selected elimination threshold ends a match when one survivor remains', () => {
  const room = fixture();
  room.pointsToEliminate = 201;
  hands(room, [[1], [5], [7]]);
  room.players[1].score = 196;
  room.players[2].score = 194;
  showHand(room, 'p0');
  assert.equal(room.status, 'finished');
  assert.equal(room.winnerId, 'p0');
  assert.deepEqual(room.players.map((player) => player.eliminated), [false, true, true]);
});
test('room creation supports each points-to-eliminate option and defaults to 201', () => {
  const host = { id: 'p0', name: 'Player 0' };
  assert.equal(createRoom('ABC234', host).pointsToEliminate, 201);
  for (const points of [50, 101, 200, 201, 350, 401, 1001]) {
    const room = createRoom('ABC234', host, { pointsToEliminate: points });
    assert.equal(room.pointsToEliminate, points);
    assert.equal(roomView(room, 'p0').pointsToEliminate, points);
  }
});
test('eliminated players neither receive more penalties nor new cards', () => {
  const room = fixture(4);
  hands(room, [[1], [5], [7], []]);
  room.players[3].score = 200;
  room.players[3].eliminated = true;
  showHand(room, 'p0');
  assert.equal(room.results[0].scores.length, 3);
  assert.equal(room.players[3].score, 200);
  startRound(room, 'p0');
  assert.equal(room.players[3].hand.length, 0);
  assert.equal(room.turnId, 'p2');
});
test('room views never reveal opponent hands during an active round', () => {
  const room = fixture();
  const view = roomView(room, 'p0', new Set(['p0']));
  assert.equal(view.players[0].hand.length, 5);
  assert.equal(view.players[0].connected, true);
  assert.equal(view.players[1].connected, false);
  for (const opponent of view.players.slice(1)) {
    assert.equal('hand' in opponent, false);
    assert.equal('value' in opponent, false);
    assert.equal(opponent.cardCount, 5);
  }
  assert.equal('drawPile' in view, false);
  assert.equal('matchId' in view, false);
});
test('table membership, full table, late join, and minimum player count are enforced', () => {
  const room = createRoom('ABC234', { id: 'p0', name: 'Player 0' }, { capacity: 3 });
  assert.throws(() => startRound(room, 'p0'), /2 players/);
  joinRoom(room, { id: 'p1', name: 'Player 1' });
  joinRoom(room, { id: 'p2', name: 'Player 2' });
  assert.throws(() => joinRoom(room, { id: 'p3', name: 'Player 3' }), /full/);
  assert.throws(() => startRound(room, 'p3'), /Join this table/);
  startRound(room, 'p1');
  assert.throws(() => joinRoom(room, { id: 'p3', name: 'Player 3' }), /already started/);
  assert.throws(() => startRound(room, 'p0'), /cannot start/);
  assert.throws(() => finishMatch(room, 'p0'), /current round/);
});
test('a non-host can deal once two players have joined', () => {
  const room = createRoom('ABC234', { id: 'p0', name: 'Player 0' });
  joinRoom(room, { id: 'p1', name: 'Player 1' });
  startRound(room, 'p1');
  assert.equal(room.status, 'playing');
  assert.equal(room.round, 1);
  assert.equal(room.hostId, 'p0');
  assert.ok(room.players.every((player) => player.hand.length === 5));
});
test('finishing between rounds selects all tied lowest-score active players', () => {
  const room = fixture();
  hands(room, [[1], [1], [9]]);
  showHand(room, 'p0');
  assert.throws(() => finishMatch(room, 'p1'), /host/);
  room.players.forEach((player) => { player.score = 50; });
  finishMatch(room, 'p0');
  assert.equal(room.status, 'finished');
  assert.deepEqual(room.winnerIds, ['p0', 'p1', 'p2']);
});
test('scoring does not mutate previously revealed round results', () => {
  const room = fixture();
  hands(room, [[1], [5], [7]]);
  showHand(room, 'p0');
  const previous = structuredClone(room.results[0]);
  startRound(room, 'p0');
  hands(room, [[1], [5], [7]]);
  showHand(room, 'p0');
  assert.deepEqual(room.results[0], previous);
});
test('default house rules enable any card and same number, with other rules opt-in', () => {
  assert.deepEqual(DEFAULT_RULES, {
    sameNumber: true, rummy: false, anyCard: true, continuation: false,
  });
  const host = { id: 'p0', name: 'Host' };
  assert.deepEqual(createRoom('ABC234', host).rules, DEFAULT_RULES);
  assert.deepEqual(createRoom('ABC234', host, { rules: { rummy: true, continuation: true } }).rules, {
    sameNumber: true, rummy: true, anyCard: true, continuation: true,
  });
});

test('only the host can abort playing or between rounds, without changing scores or results', () => {
  for (const status of ['playing', 'roundEnd']) {
    const room = fixture();
    room.status = status;
    room.players[0].score = 75;
    room.turnDeadline = Date.now() + 90_000;
    const before = structuredClone(room);
    assert.throws(() => abortMatch(room, 'p1'), /Only the host/);
    assert.deepEqual(room, before);
    abortMatch(room, 'p0');
    assert.equal(room.status, 'aborted');
    assert.equal(room.turnId, null);
    assert.equal(room.turnDeadline, null);
    assert.deepEqual(room.players, before.players);
    assert.deepEqual(room.results, before.results);
    assert.throws(() => playTurn(room, 'p0', []), /active round/);
    assert.throws(() => showHand(room, 'p0'), /active round/);
    assert.throws(() => startRound(room, 'p0'), /cannot start/);
    assert.throws(() => finishMatch(room, 'p0'), /current round/);
    assert.throws(() => abortMatch(room, 'p0'), /no active match/);
  }
});

test('waiting and completed matches cannot be aborted', () => {
  for (const status of ['waiting', 'finished']) {
    const room = fixture();
    room.status = status;
    const before = structuredClone(room);
    assert.throws(() => abortMatch(room, 'p0'), /no active match/);
    assert.deepEqual(room, before);
  }
});
