-- STAGED ONLY. Not under netlify/database/migrations to avoid automatic
-- provisioning or schema changes before branch database is configured.
-- Review and copy to netlify/database/migrations only after approval.
CREATE TABLE IF NOT EXISTS tree_wallet_challenges (
  challenge_hash CHAR(64) PRIMARY KEY,
  wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tree_wallet_logins (
  token_hash CHAR(64) PRIMARY KEY,
  wallet TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tree_wallet_logins_wallet_idx ON tree_wallet_logins(wallet);
CREATE TABLE IF NOT EXISTS tree_game_sessions (
  session_id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  session_token_hash CHAR(64) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  run_id TEXT NOT NULL UNIQUE,
  wave INTEGER NOT NULL DEFAULT 0 CHECK(wave >= 0),
  continuation_number INTEGER NOT NULL DEFAULT 0 CHECK(continuation_number >= 0),
  game_over BOOLEAN NOT NULL DEFAULT FALSE,
  cleared BOOLEAN NOT NULL DEFAULT FALSE,
  continue_pending BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tree_continue_redemptions (
  digest TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tree_game_sessions(session_id),
  continuation_number INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  run_id TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id,continuation_number)
);
CREATE INDEX IF NOT EXISTS tree_game_sessions_wallet_idx ON tree_game_sessions(wallet);
-- Note: browser-only Game Over reports must not update game_over or
-- continue_pending. Those columns require a separately reviewed trust policy.
