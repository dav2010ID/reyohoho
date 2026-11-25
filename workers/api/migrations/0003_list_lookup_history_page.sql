-- Local migration only: apply through the normal reviewed release process.
-- Membership probes constrain user_id and kp_id across list types.
CREATE INDEX IF NOT EXISTS account_lists_membership ON account_lists(user_id, kp_id, list_type);
-- Cover the history cursor ordering, including equal viewing timestamps.
CREATE INDEX IF NOT EXISTS user_history_page ON user_history(user_id, deleted, added_at DESC, kp_id DESC);
