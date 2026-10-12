-- Standard hosted SUPABASE_DB_URL can explicitly assume existing permission
-- roles. It inherits no new automatic privilege. Custom app logins stay disabled.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.commerce_policy WHERE singleton
  AND NOT new_orders_enabled AND NOT settlement_enabled AND deployment IS NULL
  AND total_limit_raw=0 AND reserved_raw=0) THEN
  RAISE EXCEPTION 'platform_setup_requires_paused_checkout';
 END IF;
END $$;
GRANT tree_continue_orders,tree_continue_settlement,tree_continue_storage,
 tree_continue_delivery,tree_continue_recovery TO postgres WITH SET TRUE;
