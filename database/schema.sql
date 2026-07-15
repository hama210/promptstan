PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  name_ku TEXT NOT NULL,
  name_en TEXT,
  name_ar TEXT,
  description_ku TEXT,
  description_en TEXT,
  description_ar TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL,
  title_ku TEXT NOT NULL,
  title_en TEXT,
  title_ar TEXT,
  description_ku TEXT,
  description_en TEXT,
  description_ar TEXT,
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT,
  preview_image_url TEXT,
  before_image_url TEXT,
  after_image_url TEXT,
  image_status TEXT DEFAULT 'pending',
  image_error TEXT,
  content_fingerprint TEXT,
  content_origin TEXT DEFAULT 'manual',
  quality_score INTEGER DEFAULT 0,
  rotation_key TEXT,
  difficulty TEXT DEFAULT 'easy',
  rating REAL DEFAULT 0,
  views INTEGER DEFAULT 0,
  copies INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  published_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_prompts_content_fingerprint
ON prompts (content_fingerprint);

CREATE INDEX IF NOT EXISTS idx_prompts_rotation_key
ON prompts (rotation_key);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_trending INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (prompt_id, tag_id),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_ku TEXT NOT NULL,
  title_en TEXT,
  title_ar TEXT,
  description_ku TEXT,
  description_en TEXT,
  description_ar TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_collections (
  prompt_id INTEGER NOT NULL,
  collection_id INTEGER NOT NULL,
  PRIMARY KEY (prompt_id, collection_id),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_prompt_events_campaign
ON prompt_events (campaign_source, campaign_name, created_at);

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
