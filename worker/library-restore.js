import { listFallbackPrompts } from './fallback-prompts.js';

const CATEGORY = {
  slug: 'person-edit',
  icon: '👤',
  name_ku: 'دەستکاری کەس',
  name_en: 'Person Edit',
  name_ar: 'تعديل الأشخاص'
};

export async function restoreKnownLibrary(env) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    CATEGORY.slug,
    CATEGORY.icon,
    CATEGORY.name_ku,
    CATEGORY.name_en,
    CATEGORY.name_ar
  ).run();

  const category = await env.DB.prepare(
    'SELECT id FROM categories WHERE slug = ? LIMIT 1'
  ).bind(CATEGORY.slug).first();

  if (!category?.id) throw new Error('Could not create or load the prompt category');

  const prompts = listFallbackPrompts();
  let inserted = 0;
  let existing = 0;
  let tagsAttached = 0;

  for (const prompt of prompts) {
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO prompts (
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
        views,
        copies,
        is_featured,
        is_trending,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'easy', ?, 0, 0, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      prompt.slug,
      category.id,
      prompt.title_ku,
      prompt.title_en || null,
      prompt.title_ar || null,
      prompt.description_ku || null,
      prompt.description_en || null,
      prompt.description_ar || null,
      prompt.prompt_text,
      Number(prompt.rating || 4.8),
      prompt.is_featured ? 1 : 0,
      prompt.is_trending ? 1 : 0
    ).run();

    if (Number(result?.meta?.changes || 0) > 0) inserted += 1;
    else existing += 1;

    const storedPrompt = await env.DB.prepare(
      'SELECT id FROM prompts WHERE slug = ? LIMIT 1'
    ).bind(prompt.slug).first();

    if (!storedPrompt?.id) continue;

    for (const tagName of prompt.tags || []) {
      const name = String(tagName || '').replace(/^#+/, '').trim();
      if (!name) continue;
      const slug = slugify(name);

      await env.DB.prepare(`
        INSERT OR IGNORE INTO tags (slug, name, is_trending)
        VALUES (?, ?, 1)
      `).bind(slug, `#${name}`).run();

      const tag = await env.DB.prepare(
        'SELECT id FROM tags WHERE slug = ? LIMIT 1'
      ).bind(slug).first();

      if (!tag?.id) continue;

      const tagResult = await env.DB.prepare(`
        INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id)
        VALUES (?, ?)
      `).bind(storedPrompt.id, tag.id).run();

      tagsAttached += Number(tagResult?.meta?.changes || 0);
    }
  }

  const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM prompts').first();

  return {
    ok: true,
    known_prompts: prompts.length,
    inserted,
    existing,
    tags_attached: tagsAttached,
    total_prompts: Number(total?.count || 0)
  };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || `tag-${crypto.randomUUID()}`;
}
