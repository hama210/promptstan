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
  const promptSlugs = prompts.map((prompt) => prompt.slug);
  const existingRows = await selectByValues(
    env,
    'SELECT slug FROM prompts WHERE slug IN',
    promptSlugs
  );
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  const promptStatements = prompts.map((prompt) => env.DB.prepare(`
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
  ));

  if (promptStatements.length) await env.DB.batch(promptStatements);

  const storedPrompts = await selectByValues(
    env,
    'SELECT id, slug FROM prompts WHERE slug IN',
    promptSlugs
  );
  const promptIds = new Map(storedPrompts.map((row) => [row.slug, row.id]));

  const tagDefinitions = new Map();
  for (const prompt of prompts) {
    for (const rawTag of prompt.tags || []) {
      const name = String(rawTag || '').replace(/^#+/, '').trim();
      if (!name) continue;
      const slug = slugify(name);
      tagDefinitions.set(slug, { slug, name: `#${name}` });
    }
  }

  const tagStatements = [...tagDefinitions.values()].map((tag) => env.DB.prepare(`
    INSERT OR IGNORE INTO tags (slug, name, is_trending)
    VALUES (?, ?, 1)
  `).bind(tag.slug, tag.name));
  if (tagStatements.length) await env.DB.batch(tagStatements);

  const storedTags = await selectByValues(
    env,
    'SELECT id, slug FROM tags WHERE slug IN',
    [...tagDefinitions.keys()]
  );
  const tagIds = new Map(storedTags.map((row) => [row.slug, row.id]));

  const relationStatements = [];
  for (const prompt of prompts) {
    const promptId = promptIds.get(prompt.slug);
    if (!promptId) continue;

    for (const rawTag of prompt.tags || []) {
      const name = String(rawTag || '').replace(/^#+/, '').trim();
      if (!name) continue;
      const tagId = tagIds.get(slugify(name));
      if (!tagId) continue;

      relationStatements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id)
        VALUES (?, ?)
      `).bind(promptId, tagId));
    }
  }
  if (relationStatements.length) await env.DB.batch(relationStatements);

  const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM prompts').first();
  const inserted = prompts.filter((prompt) => !existingSlugs.has(prompt.slug)).length;

  return {
    ok: true,
    known_prompts: prompts.length,
    inserted,
    existing: prompts.length - inserted,
    tag_relations_checked: relationStatements.length,
    total_prompts: Number(total?.count || 0)
  };
}

async function selectByValues(env, prefix, values) {
  if (!values.length) return [];
  const placeholders = values.map(() => '?').join(',');
  const result = await env.DB.prepare(`${prefix} (${placeholders})`).bind(...values).all();
  return result.results || [];
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || `tag-${crypto.randomUUID()}`;
}
