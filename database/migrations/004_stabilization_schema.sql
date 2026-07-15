CREATE TABLE IF NOT EXISTS prompt_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER,
  prompt_slug TEXT,
  event_type TEXT NOT NULL,
  event_value TEXT,
  event_label TEXT,
  result_count INTEGER DEFAULT 0,
  referrer_host TEXT,
  campaign_source TEXT,
  campaign_medium TEXT,
  campaign_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_events_type_created
ON prompt_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_prompt_events_slug
ON prompt_events (prompt_slug);

CREATE TABLE IF NOT EXISTS content_scale_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  prompt_id INTEGER,
  candidate_slug TEXT,
  duplicate_of_id INTEGER,
  similarity REAL DEFAULT 0,
  quality_score INTEGER DEFAULT 0,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_scale_events_type_created
ON content_scale_events (event_type, created_at);

CREATE TABLE IF NOT EXISTS automation_settings (
  id INTEGER PRIMARY KEY,
  posting_enabled INTEGER NOT NULL DEFAULT 1,
  posting_hour_local INTEGER NOT NULL DEFAULT 9,
  posting_days TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 180,
  image_batch_enabled INTEGER NOT NULL DEFAULT 0,
  image_batch_hour_local INTEGER NOT NULL DEFAULT 3,
  image_batch_size INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO automation_settings (
  id,
  posting_enabled,
  posting_hour_local,
  posting_days,
  timezone_offset_minutes,
  image_batch_enabled,
  image_batch_hour_local,
  image_batch_size
) VALUES (1, 1, 9, '0,1,2,3,4,5,6', 180, 0, 3, 1);

CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'scheduled',
  local_date TEXT,
  status TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_type_date
ON automation_runs (run_type, local_date, created_at);
