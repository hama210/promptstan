ALTER TABLE prompts ADD COLUMN image_status TEXT DEFAULT 'pending';
ALTER TABLE prompts ADD COLUMN image_error TEXT;
