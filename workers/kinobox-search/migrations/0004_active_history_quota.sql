-- Keep deletion markers for import conflict resolution, but charge only live entries.
DROP TRIGGER history_capacity;
DROP TRIGGER history_count_insert;
DROP TRIGGER history_count_delete;
DELETE FROM history_quota;
INSERT INTO history_quota(user_id, item_count)
SELECT user_id, count(*) FROM user_history WHERE deleted = 0 GROUP BY user_id;

CREATE TRIGGER history_capacity BEFORE INSERT ON user_history
WHEN NEW.deleted = 0
 AND NOT EXISTS (SELECT 1 FROM user_history WHERE user_id=NEW.user_id AND kp_id=NEW.kp_id)
 AND COALESCE((SELECT item_count FROM history_quota WHERE user_id=NEW.user_id),0) >= 5000
BEGIN SELECT RAISE(ABORT, 'history_capacity'); END;

CREATE TRIGGER history_revive_capacity BEFORE UPDATE OF deleted ON user_history
WHEN NEW.deleted=0 AND OLD.deleted<>0
 AND COALESCE((SELECT item_count FROM history_quota WHERE user_id=NEW.user_id),0) >= 5000
BEGIN SELECT RAISE(ABORT, 'history_capacity'); END;

CREATE TRIGGER history_count_insert AFTER INSERT ON user_history WHEN NEW.deleted=0
BEGIN
  INSERT INTO history_quota VALUES (NEW.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET item_count=item_count+1;
END;
CREATE TRIGGER history_count_update AFTER UPDATE OF deleted ON user_history WHEN OLD.deleted<>NEW.deleted
BEGIN
  INSERT INTO history_quota VALUES (NEW.user_id, CASE WHEN NEW.deleted=0 THEN 1 ELSE 0 END)
  ON CONFLICT(user_id) DO UPDATE SET item_count=item_count + CASE WHEN NEW.deleted=0 THEN 1 ELSE -1 END;
END;
CREATE TRIGGER history_count_delete AFTER DELETE ON user_history WHEN OLD.deleted=0
BEGIN UPDATE history_quota SET item_count=item_count-1 WHERE user_id=OLD.user_id; END;
