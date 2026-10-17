import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const publicUser = (user) => ({ id: user.id, name: user.name });

export async function createStore({ databaseUrl, sslMode = 'disable', production = false } = {}) {
  if (production && !databaseUrl) throw new Error('DATABASE_URL is required in production.');
  if (!['disable', 'verify-full'].includes(sslMode)) throw new Error('DATABASE_SSL must be disable or verify-full.');
  const pool = databaseUrl ? new pg.Pool({
    connectionString: databaseUrl,
    ...(sslMode === 'verify-full' ? { ssl: { rejectUnauthorized: true } } : {}),
    max: 10,
  }) : null;
  if (pool) {
    pool.on('error', (error) => console.error('PostgreSQL pool error:', error));
    await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  }
  const sessions = new Map();
  const matches = new Map();
  return {
    persistent: Boolean(pool),
    async createPlayer(name) {
      const user = { id: randomUUID(), name };
      if (pool) {
        await pool.query('INSERT INTO players (id, name) VALUES ($1,$2)', [user.id, name]);
      }
      return publicUser(user);
    },
    async session(user) {
      const token = randomBytes(32).toString('hex');
      const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
      if (pool) {
        await pool.query('INSERT INTO sessions (token_hash,player_id,expires_at) VALUES ($1,$2,$3)',
          [hashToken(token), user.id, new Date(expires)]);
      } else {
        for (const [key, value] of sessions) {
          if (value.expires <= Date.now()) sessions.delete(key);
        }
        sessions.set(hashToken(token), { user, expires });
      }
      return token;
    },
    async authenticate(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
      if (pool) {
        const { rows } = await pool.query(
          'SELECT p.id,p.name FROM players p JOIN sessions s ON s.player_id=p.id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
          [hashToken(token)]);
        return rows[0] || null;
      }
      const session = sessions.get(hashToken(token));
      return session && session.expires > Date.now() ? session.user : null;
    },
    async logout(token) {
      if (pool) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
      else sessions.delete(hashToken(token));
    },
    async saveMatch(room) {
      const winners = room.winnerIds || (room.winnerId ? [room.winnerId] : []);
      if (!pool) {
        matches.set(room.matchId, {
          id: room.matchId, room_code: room.code, results: structuredClone(room.results),
          completed_at: new Date().toISOString(),
          players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score, won: winners.includes(p.id) })),
        });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO matches (id,room_code,results) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
          [room.matchId, room.code, JSON.stringify(room.results)]);
        for (const player of room.players) {
          await client.query(
            'INSERT INTO match_players (match_id,player_id,score,won) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [room.matchId, player.id, player.score, winners.includes(player.id)]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async leaderboard() {
      if (pool) return (await pool.query(
        `SELECT p.id,p.name,COUNT(*)::int AS played,
         COUNT(*) FILTER (WHERE m.won)::int AS wins,ROUND(AVG(m.score))::int AS average
         FROM match_players m JOIN players p ON p.id=m.player_id
         GROUP BY p.id,p.name ORDER BY wins DESC,average ASC LIMIT 20`)).rows;
      const stats = new Map();
      for (const match of matches.values()) {
        for (const player of match.players) {
          const entry = stats.get(player.id) || { id: player.id, name: player.name, played: 0, wins: 0, total: 0 };
          entry.played++;
          entry.wins += Number(player.won);
          entry.total += player.score;
          stats.set(player.id, entry);
        }
      }
      return [...stats.values()].map(({ total, ...entry }) => ({ ...entry, average: Math.round(total / entry.played) }))
        .sort((a, b) => b.wins - a.wins || a.average - b.average).slice(0, 20);
    },
    async history(userId) {
      if (pool) return (await pool.query(
        `SELECT m.id,m.room_code,m.completed_at,p.score,p.won,m.results FROM matches m
         JOIN match_players p ON p.match_id=m.id WHERE p.player_id=$1 ORDER BY m.completed_at DESC LIMIT 20`,
        [userId])).rows;
      return [...matches.values()].reverse().filter((m) => m.players.some((p) => p.id === userId))
        .slice(0, 20).map((m) => {
          const player = m.players.find((p) => p.id === userId);
          return { id: m.id, room_code: m.room_code, completed_at: m.completed_at, score: player.score, won: player.won, results: m.results };
        });
    },
    async close() { if (pool) await pool.end(); },
  };
}
