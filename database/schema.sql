-- Promptstan D1 schema draft
-- This will be used when we connect Cloudflare D1.

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
