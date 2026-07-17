ALTER TABLE prompts ADD COLUMN image_quality_status TEXT DEFAULT 'pending';
ALTER TABLE prompts ADD COLUMN image_quality_score INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN image_quality_reason TEXT;
ALTER TABLE prompts ADD COLUMN image_subject_type TEXT;
ALTER TABLE prompts ADD COLUMN image_model_used TEXT;

CREATE INDEX IF NOT EXISTS idx_prompts_image_quality
ON prompts (image_quality_status, image_status, id);
