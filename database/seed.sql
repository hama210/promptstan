-- Promptstan starter seed draft

INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar) VALUES
  ('kurdish-style', '☀️', 'کوردی ستایل', 'Kurdish Style', 'ستايل كردي'),
  ('islamic', '🕌', 'ئیسلامی', 'Islamic', 'إسلامي'),
  ('couples', '👥', 'جووت و خێزان', 'Couples', 'الأزواج'),
  ('movies', '🎞️', 'فیلم و پۆستەر', 'Movies', 'الأفلام'),
  ('characters', '🦸', 'کارەکتەر', 'Characters', 'الشخصيات'),
  ('cars', '🚗', 'ئۆتۆمبێل', 'Cars', 'السيارات');

INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES
  ('kurdishbride', '#KurdishBride', 1),
  ('newroz', '#Newroz', 1),
  ('ramadan', '#Ramadan', 1),
  ('couple', '#Couple', 1),
  ('hug', '#Hug', 1),
  ('twophotos', '#TwoPhotos', 1),
  ('luxurycar', '#LuxuryCar', 1),
  ('movieposter', '#MoviePoster', 1);
