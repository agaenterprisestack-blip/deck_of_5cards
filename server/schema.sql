CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  name VARCHAR(24) NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Preserve existing player IDs and match history while allowing name-only guests.
ALTER TABLE players ALTER COLUMN email DROP NOT NULL;
ALTER TABLE players ALTER COLUMN password_hash DROP NOT NULL;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  room_code TEXT NOT NULL,
  results JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS match_players (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL,
  won BOOLEAN NOT NULL,
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS match_players_player_idx ON match_players(player_id);
