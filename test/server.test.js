import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message = 'Expected realtime state was not received') {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message);
    await delay(10);
  }
}

test('same-name guests have independent identities and revocable sessions', async () => {
  const store = await createStore();
  const first = await store.createPlayer('Alex');
  const second = await store.createPlayer('Alex');
  assert.notEqual(first.id, second.id);
  const firstToken = await store.session(first);
  const secondToken = await store.session(second);
  assert.deepEqual(await store.authenticate(firstToken), first);
  assert.deepEqual(await store.authenticate(secondToken), second);
  await store.logout(firstToken);
  assert.equal(await store.authenticate(firstToken), null);
  assert.deepEqual(await store.authenticate(secondToken), second);
  await store.close();
});

test('production refuses to start without persistent storage', async () => {
  await assert.rejects(createStore({ production: true }), /DATABASE_URL/);
});

test('timeout elimination broadcasts lives, preserves spectator access, and saves the last survivor as winner', { timeout: 15_000 }, async (t) => {
  const store = await createStore();
  const save = t.mock.method(store, 'saveMatch');
  const server = createApp({ store });
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const clients = [];
  t.after(async () => {
    clients.forEach((client) => client.socket.disconnect());
    await server.close();
  });
  async function connect(token) {
    const socket = io(url, { auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false });
    const client = { socket, room: null, emit: (event, data) => socket.timeout(4000).emitWithAck(event, data) };
    socket.on('room', (room) => { client.room = room; });
    clients.push(client);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return client;
  }
  const users = [];
  const tokens = [];
  const players = [];
  for (let i = 0; i < 3; i++) {
    const user = await store.createPlayer(`Lives Player ${i}`);
    const token = await store.session(user);
    users.push(user); tokens.push(token); players.push(await connect(token));
  }
  assert.equal((await players[0].emit('room:create', { name: 'Lives test', capacity: 3,
    rules: { anyCard: true, sameNumber: true, rummy: true, continuation: true },
  })).ok, true);
  await until(() => players[0].room);
  const code = players[0].room.code;
  for (const player of players.slice(1)) assert.equal((await player.emit('room:join', { code })).ok, true);
  assert.equal((await players[0].emit('game:start', { revision: server.rooms.get(code).revision })).ok, true);
  assert.deepEqual(server.rooms.get(code).players.map((player) => player.lives), [5, 5, 5]);
  for (const index of [1, 0]) {
    const room = server.rooms.get(code);
    room.turnId = users[index].id;
    room.players[index].lives = 1;
    room.turnDeadline = Date.now() - 1;
    await until(() => players.every((player) => player.room?.players[index].lives === 0));
    assert.equal(players[index].room.players[index].eliminated, true);
    const revision = server.rooms.get(code).revision;
    assert.equal((await players[index].emit('game:play', { revision, cardIds: [] })).ok, false);
    assert.equal((await players[index].emit('chat:send', { text: 'Still watching' })).ok, true);
    await until(() => players[2].room.chat.some((message) => message.userId === users[index].id));
    if (index === 1) {
      assert.equal(server.rooms.get(code).status, 'playing');
      assert.equal(save.mock.callCount(), 0);
      players[1].socket.disconnect();
      players[1] = await connect(tokens[1]);
      await until(() => players[1].room?.players[1].lives === 0);
      assert.equal(players[1].room.players[1].eliminated, true);
    }
  }
  assert.equal(server.rooms.get(code).status, 'finished');
  assert.equal(server.rooms.get(code).turnDeadline, null);
  assert.deepEqual(players[2].room.winnerIds, [users[2].id]);
  assert.equal(save.mock.callCount(), 1);
  const history = await store.history(users[2].id);
  assert.equal(history.length, 1);
  assert.equal(history[0].won, true);
});

test('host abort broadcasts cancellation, saves nothing, survives reconnect, and releases every seat', { timeout: 15_000 }, async (t) => {
  const store = await createStore();
  const save = t.mock.method(store, 'saveMatch');
  const server = createApp({ store });
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const clients = [];
  t.after(async () => {
    clients.forEach((client) => client.socket.disconnect());
    await server.close();
  });
  async function connect(token) {
    const socket = io(url, { auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false });
    const state = { room: null };
    socket.on('room', (room) => { state.room = room; });
    const client = { socket, state, emit: (event, data) => socket.timeout(4000).emitWithAck(event, data) };
    clients.push(client);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return client;
  }
  const users = [];
  const tokens = [];
  const players = [];
  for (let i = 0; i < 3; i++) {
    const user = await store.createPlayer(`Abort Player ${i}`);
    const token = await store.session(user);
    users.push(user); tokens.push(token); players.push(await connect(token));
  }
  const options = { name: 'Abort test', capacity: 3, rules: {
    anyCard: true, sameNumber: true, rummy: true, continuation: true,
  } };
  for (const stage of ['playing', 'roundEnd']) {
    assert.equal((await players[0].emit('room:create', options)).ok, true);
    await until(() => players[0].state.room);
    const code = players[0].state.room.code;
    for (const player of players.slice(1)) assert.equal((await player.emit('room:join', { code })).ok, true);
    assert.equal((await players[0].emit('game:start', { revision: server.rooms.get(code).revision })).ok, true);
    if (stage === 'roundEnd') {
      for (let i = 0; i < 3; i++) {
        const current = server.rooms.get(code);
        const player = players[users.findIndex((user) => user.id === current.turnId)];
        const ownHand = current.players.find((p) => p.id === current.turnId).hand;
        assert.equal((await player.emit('game:play', { revision: current.revision, cardIds: [ownHand[0].id] })).ok, true);
      }
      const room = server.rooms.get(code);
      room.turnId = users[0].id;
      room.players.forEach((player, index) => {
        player.hand = [{ id: `abort-card-${index}`, suit: 'clubs', rank: index + 1 }];
      });
      assert.equal((await players[0].emit('game:show', { revision: room.revision })).ok, true);
    }
    const before = structuredClone(server.rooms.get(code));
    assert.equal((await players[1].emit('game:abort', { revision: before.revision })).ok, false);
    assert.equal((await players[0].emit('game:abort', { revision: before.revision - 1 })).ok, false);
    assert.deepEqual(server.rooms.get(code), before);
    assert.equal((await players[0].emit('game:abort', { revision: before.revision })).ok, true);
    await until(() => players.every((player) => player.state.room?.status === 'aborted'));
    const aborted = server.rooms.get(code);
    assert.equal(aborted.turnId, null);
    assert.equal(aborted.turnDeadline, null);
    assert.deepEqual(aborted.players, before.players);
    assert.deepEqual(aborted.results, before.results);
    assert.equal(save.mock.callCount(), 0);
    assert.equal((await players[0].emit('game:finish', { revision: aborted.revision })).ok, false);
    assert.equal((await players[0].emit('game:start', { revision: aborted.revision })).ok, false);
    assert.equal((await players[0].emit('game:play', { revision: aborted.revision, cardIds: [] })).ok, false);
    players[2].socket.disconnect();
    players[2] = await connect(tokens[2]);
    await until(() => players[2].state.room?.status === 'aborted');
    for (let i = 0; i < players.length; i++) {
      assert.deepEqual(await store.history(users[i].id), []);
      assert.equal((await players[i].emit('room:leave', {})).ok, true);
      await until(() => players[i].state.room === null);
    }
    assert.equal(server.rooms.has(code), false);
    assert.deepEqual(await store.leaderboard(), []);
  }
});

test('HTTP and Socket.IO support name-only entry, rooms, private hands, chat, reconnect and completed matches', { timeout: 30_000 }, async (t) => {
  const store = await createStore();
  const server = createApp({ store });
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const clients = [];
  t.after(async () => {
    clients.forEach((client) => client.disconnect());
    await server.close();
  });
  async function api(path, { token, data, method = 'GET' } = {}) {
    const response = await fetch(`${url}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  async function connect(account) {
    const socket = io(url, { auth: { token: account.token }, transports: ['websocket'], autoConnect: false, reconnection: false });
    const state = { room: null, lobby: [] };
    socket.on('room', (room) => { state.room = room; });
    socket.on('lobby', (rooms) => { state.lobby = rooms; });
    clients.push(socket);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return { socket, state, emit: (event, data) => socket.timeout(4000).emitWithAck(event, data) };
  }
  assert.equal((await api('/health')).data.storage, 'memory');
  assert.equal((await api('/me')).status, 401);
  for (const name of ['', '   ', 'x'.repeat(25), 123, null]) {
    assert.equal((await api('/guest', { method: 'POST', data: { name } })).status, 400);
  }
  const accounts = [];
  for (let index = 0; index < 4; index++) {
    const result = await api('/guest', { method: 'POST', data: { name: `  Player ${index}  ` } });
    assert.equal(result.status, 201);
    assert.equal('email' in result.data.user, false);
    assert.equal('password_hash' in result.data.user, false);
    assert.equal(result.data.user.name, `Player ${index}`);
    accounts.push(result.data);
  }
  const sameName = await api('/guest', { method: 'POST', data: { name: 'Player 0' } });
  assert.equal(sameName.status, 201);
  assert.notEqual(sameName.data.user.id, accounts[0].user.id);
  assert.notEqual(sameName.data.token, accounts[0].token);
  assert.equal((await api('/guest', { method: 'POST', data: { name: 'A' } })).status, 201);
  assert.equal((await api('/auth/login', { method: 'POST', data: { name: 'Player 0' } })).status, 404);
  assert.deepEqual((await api('/me', { token: accounts[0].token })).data.user, accounts[0].user);
  const unauth = io(url, { auth: { token: 'invalid' }, transports: ['websocket'], reconnection: false });
  clients.push(unauth);
  await new Promise((resolve, reject) => {
    unauth.once('connect_error', (error) => { assert.match(error.message, /session/); resolve(); });
    unauth.once('connect', () => reject(new Error('Unauthenticated client connected')));
  });
  const players = [];
  for (const account of accounts) players.push(await connect(account));
  const options = { name: 'Friday friends', capacity: 3, rules: {
    anyCard: true, sameNumber: true, rummy: true, continuation: true,
  }, pointsToEliminate: 401 };
  assert.equal((await players[0].emit('room:create', options)).ok, true);
  await until(() => players[0].state.room);
  assert.equal(players[0].state.room.pointsToEliminate, 401);
  const code = players[0].state.room.code;
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal((await players[1].emit('room:join', { code: code.toLowerCase() })).ok, true);
  assert.equal((await players[2].emit('room:join', { code })).ok, true);
  assert.equal((await players[3].emit('room:join', { code })).ok, false);
  assert.equal((await players[3].emit('room:create', { ...options, name: 'Separate table' })).ok, true);
  await until(() => players[3].state.room?.name === 'Separate table');
  assert.equal(players[3].state.room.pointsToEliminate, 401);
  assert.equal((await players[3].emit('room:create', { ...options, pointsToEliminate: 200 })).ok, false);
  assert.notEqual(players[3].state.room.code, code);
  assert.equal((await players[0].emit('room:create', options)).ok, false);
  await until(() => players[0].state.room.players.length === 3);
  let revision = players[0].state.room.revision;
  assert.equal((await players[1].emit('game:start', { revision })).ok, false);
  assert.equal((await players[0].emit('game:start', { revision })).ok, true);
  await until(() => players.every((player, index) => index === 3 || player.state.room?.status === 'playing'));
  const startDeadline = players[0].state.room.turnDeadline;
  assert.ok(startDeadline - Date.now() <= 30_000 && startDeadline - Date.now() > 28_000);
  assert.equal(players[3].state.room.name, 'Separate table');
  assert.equal(JSON.stringify(players[3].state.lobby).includes('"hand"'), false);
  for (let index = 0; index < 3; index++) {
    const view = players[index].state.room;
    assert.equal(view.players.find((player) => player.id === accounts[index].user.id).hand.length, 5);
    assert.equal(view.players.filter((player) => 'hand' in player).length, 1);
    assert.equal('drawPile' in view, false);
  }
  assert.equal((await players[0].emit('room:leave', {})).ok, false);
  const currentIndex = accounts.findIndex((account) => account.user.id === players[0].state.room.turnId);
  revision = players[currentIndex].state.room.revision;
  const fullHandBefore = structuredClone(server.rooms.get(code));
  for (const drawSource of ['drawPile', 'discard']) {
    const blocked = await players[currentIndex].emit('game:play', { revision, cardIds: [], drawSource });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /cannot exceed 5 cards/);
    assert.deepEqual(server.rooms.get(code), fullHandBefore);
  }
  assert.equal(players[currentIndex].state.room.showUnlocked, false);
  const earlyShow = await players[currentIndex].emit('game:show', { revision });
  assert.equal(earlyShow.ok, false);
  assert.match(earlyShow.error, /Everyone must complete one turn/);
  const hand = players[currentIndex].state.room.players.find((p) => p.id === accounts[currentIndex].user.id).hand;
  assert.equal((await players[currentIndex].emit('game:play', { revision, cardIds: [hand[0].id] })).ok, true);
  assert.equal((await players[currentIndex].emit('game:play', { revision, cardIds: [] })).ok, false);
  const beforePickup = structuredClone(server.rooms.get(code));
  const pickupIndex = accounts.findIndex((account) => account.user.id === beforePickup.turnId);
  const pickedId = beforePickup.discardPile.at(-1).id;
  const droppedId = beforePickup.players[pickupIndex].hand[0].id;
  const invalidSource = await players[pickupIndex].emit('game:play', {
    revision: beforePickup.revision, cardIds: [], drawSource: 'invalid',
  });
  assert.equal(invalidSource.ok, false);
  assert.deepEqual(server.rooms.get(code), beforePickup);
  assert.equal((await players[pickupIndex].emit('game:play', {
    revision: beforePickup.revision, cardIds: [droppedId], drawSource: 'discard',
  })).ok, true);
  await until(() => players[pickupIndex].state.room.revision > beforePickup.revision);
  const ownPickupHand = players[pickupIndex].state.room.players.find((p) => p.id === accounts[pickupIndex].user.id).hand;
  assert.equal(ownPickupHand.at(-1).id, pickedId);
  assert.equal(players[pickupIndex].state.room.discard.id, droppedId);
  assert.deepEqual(server.rooms.get(code).drawPile, beforePickup.drawPile);
  assert.equal((await players[0].emit('chat:send', { text: '  Good luck, everyone!  ' })).ok, true);
  await until(() => players[1].state.room.chat.length === 1);
  assert.equal(players[1].state.room.chat[0].text, 'Good luck, everyone!');
  assert.equal(players[3].state.room.chat.length, 0);
  const previousId = accounts[1].user.id;
  players[1].socket.disconnect();
  await until(() => players[0].state.room.players.find((p) => p.id === previousId).connected === false);
  players[1] = await connect(accounts[1]);
  await until(() => players[1].state.room?.code === code);
  assert.equal(players[1].state.room.players.find((p) => p.id === previousId).hand.length > 0, true);
  const timedRoom = server.rooms.get(code);
  const timedPlayer = timedRoom.players.find((p) => p.id === timedRoom.turnId);
  const timedHandSize = timedPlayer.hand.length;
  const timedRevision = timedRoom.revision;
  timedRoom.turnDeadline = Date.now() - 1;
  await until(() => server.rooms.get(code).revision > timedRevision, 'Expired turn did not advance');
  assert.equal(server.rooms.get(code).players.find((p) => p.id === timedPlayer.id).hand.length, timedHandSize);
  assert.deepEqual(server.rooms.get(code).players.find((p) => p.id === timedPlayer.id).hand, timedPlayer.hand);
  assert.deepEqual(server.rooms.get(code).drawPile, timedRoom.drawPile);
  assert.deepEqual(server.rooms.get(code).discardPile, timedRoom.discardPile);
  assert.match(server.rooms.get(code).lastAction, /timer expired/);
  assert.equal(server.rooms.get(code).completedTurnIds.includes(timedPlayer.id), true);
  assert.equal(server.rooms.get(code).players.find((p) => p.id === timedPlayer.id).lives, 4);
  await until(() => players[0].state.room.players.find((p) => p.id === timedPlayer.id).lives === 4);
  while (!server.rooms.get(code).players.every((p) => server.rooms.get(code).completedTurnIds.includes(p.id))) {
    const current = server.rooms.get(code);
    const player = players[accounts.findIndex((account) => account.user.id === current.turnId)];
    const ownHand = current.players.find((p) => p.id === current.turnId).hand;
    assert.equal((await player.emit('game:play', { revision: current.revision, cardIds: [ownHand[0].id] })).ok, true);
  }
  await until(() => players[0].state.room.showUnlocked);
  // Deterministic server-side hands let the integration test reach scoring without peeking in the UI.
  const active = server.rooms.get(code);
  active.turnId = accounts[0].user.id;
  active.players.forEach((player, index) => { player.hand = [{ id: `final-${index}`, suit: 'hearts', rank: index + 11 }]; });
  assert.equal((await players[0].emit('game:show', { revision: active.revision })).ok, true);
  await until(() => players[0].state.room.status === 'roundEnd');
  assert.deepEqual(players[0].state.room.results[0].scores.map((p) => p.penalty), [0, 12, 13]);
  const roundEndRevision = players[0].state.room.revision;
  const saveMatch = store.saveMatch;
  store.saveMatch = async () => { throw new Error('Simulated database write failure'); };
  const errorLog = t.mock.method(console, 'error', () => {});
  const failedFinish = await players[0].emit('game:finish', { revision: roundEndRevision });
  assert.equal(failedFinish.ok, false);
  assert.match(failedFinish.error, /could not save/);
  assert.equal(server.rooms.get(code).status, 'roundEnd');
  assert.equal(server.rooms.get(code).revision, roundEndRevision);
  assert.equal((await api('/history', { token: accounts[0].token })).data.length, 0);
  assert.equal(errorLog.mock.callCount(), 1);
  errorLog.mock.restore();
  store.saveMatch = saveMatch;
  assert.equal((await players[0].emit('game:finish', { revision: players[0].state.room.revision })).ok, true);
  await until(() => players[0].state.room.status === 'finished');
  const history = await api('/history', { token: accounts[0].token });
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].won, true);
  assert.equal(history.data[0].score, 0);
  assert.deepEqual((await api('/history', { token: sameName.data.token })).data, []);
  const leaderboard = await api('/leaderboard', { token: accounts[0].token });
  assert.equal(leaderboard.data.length, 3);
  assert.equal(leaderboard.data[0].wins, 1);
  assert.equal((await players[0].emit('room:leave', {})).ok, true);
  await until(() => players[0].state.room === null);
  assert.equal((await api('/logout', { method: 'POST', token: accounts[0].token })).status, 200);
  assert.equal((await api('/me', { token: accounts[0].token })).status, 401);
  assert.equal((await api('/history', { token: accounts[3].token })).data.length, 0);
  await store.logout(accounts[3].token);
  const expiredAction = await players[3].emit('chat:send', { text: 'Expired session' });
  assert.equal(expiredAction.code, 'AUTH_REQUIRED');
});
