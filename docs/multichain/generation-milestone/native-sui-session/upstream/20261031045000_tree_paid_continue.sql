-- Additive migration for the isolated TREE FORCE development database only.
-- Authenticated browser checkpoints preserve gameplay, not reward entitlement.
ALTER TABLE tree_game_sessions
  ADD COLUMN IF NOT EXISTS continue_offer_id TEXT,
  ADD COLUMN IF NOT EXISTS continue_offer_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS continue_offer_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS continue_offer_checkpoint TEXT,
  ADD COLUMN IF NOT EXISTS continue_snapshot JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS tree_game_sessions_continue_offer_idx
  ON tree_game_sessions(continue_offer_id) WHERE continue_offer_id IS NOT NULL;
ALTER TABLE tree_continue_redemptions
  ADD COLUMN IF NOT EXISTS offer_id TEXT,
  ADD COLUMN IF NOT EXISTS snapshot JSONB,
  ADD COLUMN IF NOT EXISTS payment_timestamp_ms BIGINT,
  ADD COLUMN IF NOT EXISTS checkpoint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tree_continue_redemptions_offer_idx
  ON tree_continue_redemptions(offer_id) WHERE offer_id IS NOT NULL;
