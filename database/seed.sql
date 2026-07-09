-- Promptstan person-edit seed draft

INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar) VALUES
  ('person-edit', '👤', 'دەستکاری کەس', 'Person Edit', 'تعديل الأشخاص'),
  ('kurdish-style', '☀️', 'ستایلی کوردی', 'Kurdish Style', 'ستايل كردي'),
  ('outfit', '👔', 'جل و بەرگ', 'Outfit Style', 'تغيير الملابس'),
  ('movies', '🎞️', 'ستایلی فیلم', 'Movie Style', 'ستايل الأفلام'),
  ('couples', '👥', 'دوو کەس', 'Two People', 'شخصان');

INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES
  ('personedit', '#PersonEdit', 1),
  ('twophotos', '#TwoPhotos', 1),
  ('hug', '#Hug', 1),
  ('couple', '#Couple', 1),
  ('groupphoto', '#GroupPhoto', 1),
  ('portrait', '#Portrait', 1),
  ('facefix', '#FaceFix', 1),
  ('outfit', '#Outfit', 1),
  ('wedding', '#Wedding', 1),
  ('cinematic', '#Cinematic', 1),
  ('kurdish', '#Kurdish', 1),
  ('moviestyle', '#MovieStyle', 1),
  ('suit', '#Suit', 1);

INSERT OR IGNORE INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, prompt_text, difficulty, rating, views, copies, is_featured, is_trending, published_at)
SELECT 'solo-cinematic-portrait', id, 'پۆرترێتی سینەمایی بۆ یەک کەس', 'Solo Cinematic Portrait', 'بورتريه سينمائي لشخص واحد', 'دەستکاری یەک کەس بە ستایلی سینەمایی.', 'Edit one person into a realistic cinematic portrait, warm golden-hour lighting, sharp facial details, natural skin texture, soft background blur, professional photography style, high quality.', 'easy', 5.0, 42000, 12000, 1, 1, CURRENT_TIMESTAMP FROM categories WHERE slug = 'person-edit';

INSERT OR IGNORE INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, prompt_text, difficulty, rating, views, copies, is_featured, is_trending, published_at)
SELECT 'two-photos-warm-hug', id, 'دوو وێنە پێکەوە بە Hug', 'Two Photos Warm Hug', 'صورتان في عناق دافئ', 'پێکەوەکردنی دوو کەس بە شێوەی ڕاستەقینە.', 'Combine two separate people from two photos into one realistic warm hug scene, natural body position, matching lighting and shadows, emotional cinematic photo edit, high quality.', 'easy', 5.0, 39000, 11000, 1, 1, CURRENT_TIMESTAMP FROM categories WHERE slug = 'person-edit';

INSERT OR IGNORE INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, prompt_text, difficulty, rating, views, copies, is_featured, is_trending, published_at)
SELECT 'kurdish-clothes-couple', id, 'دوو کەس بە جل و بەرگی کوردی', 'Kurdish Clothes Couple', 'شخصان بملابس كردية', 'ستایلی کوردی بۆ دوو کەس.', 'Combine two people into one realistic Kurdish style photo, traditional Kurdish clothes, natural couple pose, warm mountain light, matching shadows, cinematic photography.', 'easy', 5.0, 29000, 9000, 1, 1, CURRENT_TIMESTAMP FROM categories WHERE slug = 'person-edit';

INSERT OR IGNORE INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, prompt_text, difficulty, rating, views, copies, is_featured, is_trending, published_at)
SELECT 'movie-star-person-edit', id, 'وێنەی ئەستێرەی فیلم بۆ یەک کەس', 'Movie Star Person Edit', 'تعديل شخص بأسلوب نجم سينما', 'ستایلی فیلم بۆ یەک کەس.', 'Transform one person into a cinematic movie star portrait, dramatic key light, film color grading, confident pose, realistic face preservation, poster-quality photography.', 'medium', 4.9, 27000, 8000, 0, 1, CURRENT_TIMESTAMP FROM categories WHERE slug = 'person-edit';
