-- The Worker adds the four prompt moderation columns idempotently through its
-- D1 binding. Keeping them out of this migration lets authenticated Wrangler
-- deployments remain compatible after a repository-managed Worker bootstrap.

CREATE TABLE IF NOT EXISTS product_operations_settings (
  id INTEGER PRIMARY KEY,
  retention_enabled INTEGER NOT NULL DEFAULT 0,
  analytics_retention_days INTEGER NOT NULL DEFAULT 90,
  operational_retention_days INTEGER NOT NULL DEFAULT 180,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO product_operations_settings (
  id,
  retention_enabled,
  analytics_retention_days,
  operational_retention_days
) VALUES (1, 0, 90, 180);

CREATE TABLE IF NOT EXISTS operation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_events_action_created
ON operation_events (action, created_at);
