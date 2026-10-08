CREATE TABLE IF NOT EXISTS user_history (
  user_id TEXT NOT NULL,
  kp_id TEXT NOT NULL,
  metadata TEXT NOT NULL,
  added_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kp_id)
);
CREATE INDEX IF NOT EXISTS history_user_date ON user_history(user_id, deleted, added_at DESC);

-- Constant-time capacity checks, including tombstones. No per-import COUNT scans.
CREATE TABLE IF NOT EXISTS history_quota (
  user_id TEXT PRIMARY KEY,
  item_count INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS history_capacity BEFORE INSERT ON user_history
WHEN NOT EXISTS (SELECT 1 FROM user_history WHERE user_id = NEW.user_id AND kp_id = NEW.kp_id)
 AND COALESCE((SELECT item_count FROM history_quota WHERE user_id = NEW.user_id), 0) >= 5000
BEGIN
  SELECT RAISE(ABORT, 'history_capacity');
END;
CREATE TRIGGER IF NOT EXISTS history_count_insert AFTER INSERT ON user_history
BEGIN
  INSERT INTO history_quota(user_id, item_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET item_count = item_count + 1;
END;
CREATE TRIGGER IF NOT EXISTS history_count_delete AFTER DELETE ON user_history
BEGIN
  UPDATE history_quota SET item_count = item_count - 1 WHERE user_id = OLD.user_id;
END;
