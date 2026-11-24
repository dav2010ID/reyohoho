CREATE TABLE IF NOT EXISTS tg_users (
  telegram_id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tg_login (
  poll_hash TEXT PRIMARY KEY,
  start_hash TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','consumed')),
  candidate_id TEXT,
  candidate_name TEXT,
  session_hash TEXT
);
CREATE INDEX IF NOT EXISTS tg_login_expiry ON tg_login(expires_at);
CREATE TABLE IF NOT EXISTS tg_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES tg_users(telegram_id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tg_sessions_expiry ON tg_sessions(expires_at);
CREATE INDEX IF NOT EXISTS tg_sessions_user ON tg_sessions(telegram_id, created_at);
CREATE TABLE IF NOT EXISTS account_lists (
  user_id TEXT NOT NULL,
  list_type TEXT NOT NULL,
  kp_id TEXT NOT NULL,
  metadata TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY(user_id, list_type, kp_id)
);
CREATE INDEX IF NOT EXISTS account_lists_date ON account_lists(user_id, list_type, added_at DESC);
CREATE TRIGGER IF NOT EXISTS account_list_capacity BEFORE INSERT ON account_lists
WHEN NOT EXISTS(SELECT 1 FROM account_lists
  WHERE user_id = NEW.user_id AND list_type = NEW.list_type AND kp_id = NEW.kp_id)
 AND (SELECT COUNT(*) FROM account_lists WHERE user_id = NEW.user_id AND list_type = NEW.list_type) >= 1000
BEGIN
  SELECT RAISE(ABORT, 'list_capacity');
END;
