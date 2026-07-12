-- Keep the live library usable after a fresh database or accidental full cleanup.
INSERT OR IGNORE INTO categories (
  slug,
  icon,
  name_ku,
  name_en,
  name_ar,
  description_ku,
  description_en,
  description_ar
) VALUES (
  'person-edit',
  '👤',
  'دەستکاری کەس',
  'Person Edit',
  'تعديل الأشخاص',
  'پرۆمپتی دەستکاری وێنەی کەس',
  'AI prompts for editing people in photos',
  'موجهات لتعديل الأشخاص في الصور'
);

INSERT INTO prompts (
  slug,
  category_id,
  title_ku,
  title_en,
  title_ar,
  description_ku,
  description_en,
  description_ar,
  prompt_text,
  image_status,
  difficulty,
  rating,
  is_featured,
  is_trending,
  published_at
)
SELECT
  'starter-solo-cinematic-portrait',
  categories.id,
  'پۆرترێتی سینەمایی بۆ یەک کەس',
  'Solo Cinematic Portrait',
  'بورتريه سينمائي لشخص واحد',
  'پرۆمپتێکی ئامادە بۆ دروستکردنی پۆرترێتێکی سینەمایی و ڕاستەقینە.',
  'A ready-to-use prompt for a realistic cinematic portrait.',
  'موجه جاهز لإنشاء صورة شخصية سينمائية واقعية.',
  'Edit one person into a realistic cinematic portrait, warm golden-hour lighting, sharp facial details, natural skin texture, soft background blur, professional photography style, high quality.',
  'pending',
  'easy',
  5.0,
  1,
  1,
  CURRENT_TIMESTAMP
FROM categories
WHERE categories.slug = 'person-edit'
  AND NOT EXISTS (SELECT 1 FROM prompts)
LIMIT 1;

INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES
  ('personedit', '#PersonEdit', 1),
  ('portrait', '#Portrait', 1),
  ('cinematic', '#Cinematic', 1);

INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id)
SELECT prompts.id, tags.id
FROM prompts
JOIN tags ON tags.slug IN ('personedit', 'portrait', 'cinematic')
WHERE prompts.slug = 'starter-solo-cinematic-portrait';
