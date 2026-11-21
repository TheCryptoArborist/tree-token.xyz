-- Additive leaderboard storage. Existing runs and payment records stay intact.
CREATE TABLE breaker.player_profiles (
 wallet text PRIMARY KEY REFERENCES breaker.accounts(wallet),
 username text NOT NULL CHECK (
  username ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$'
  AND username = btrim(username)
  AND username !~ ' {2,}'
 ),
 updated_at bigint NOT NULL CHECK (updated_at >= 0)
);
CREATE UNIQUE INDEX breaker_profile_username_lower_key
 ON breaker.player_profiles (lower(username));

CREATE TABLE breaker.leaderboard_scores (
 wallet text PRIMARY KEY REFERENCES breaker.accounts(wallet),
 run_id uuid NOT NULL,
 score bigint NOT NULL CHECK (score > 0 AND score <= 9007199254740991),
 level smallint NOT NULL CHECK (level BETWEEN 1 AND 30),
 achieved_at bigint NOT NULL CHECK (achieved_at >= 0),
 FOREIGN KEY (run_id,wallet) REFERENCES breaker.runs(id,wallet)
);
CREATE INDEX breaker_leaderboard_rank_idx
 ON breaker.leaderboard_scores (score DESC,level DESC,achieved_at ASC,wallet ASC);

REVOKE ALL ON TABLE breaker.player_profiles,breaker.leaderboard_scores FROM PUBLIC;
