import { ensurePromptImageColumns, getPromptById, ensurePromptImages } from './auto-images.js';

export async function adminListPrompts(env) {
  await ensurePromptImageColumns(env);
  const result = await env.DB.prepare(
    'SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id ORDER BY prompts.id DESC LIMIT 200'
  ).all();
  return json(result.results || []);
}

export async function adminUpdatePrompt(request, env, id) {
  await ensurePromptImageColumns(env);
  const body = await request.json();
  const category = await getOrCreateCategory(env, body.category_slug || 'person-edit');
  const previewImageUrl = cleanImageUrl(body.preview_image_url);
  const beforeImageUrl = cleanImageUrl(body.before_image_url);
  const afterImageUrl = cleanImageUrl(body.after_image_url);
  const imageStatus = beforeImageUrl && afterImageUrl ? 'ready' : 'pending';

  const updateResult = await env.DB.prepare(
    'UPDATE prompts SET category_id = ?, title_ku = ?, title_en = ?, title_ar = ?, description_ku = ?, description_en = ?, description_ar = ?, prompt_text = ?, negative_prompt = ?, preview_image_url = ?, before_image_url = ?, after_image_url = ?, image_status = ?, image_error = NULL, difficulty = ?, rating = ?, is_featured = ?, is_trending = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(
    category.id,
    body.title_ku,
    body.title_en || null,
    body.title_ar || null,
    body.description_ku || null,
    body.description_en || null,
    body.description_ar || null,
    body.prompt_text,
    body.negative_prompt || null,
    previewImageUrl,
    beforeImageUrl,
    afterImageUrl,
    imageStatus,
    body.difficulty || 'easy',
    body.rating || 4.8,
    body.is_featured ? 1 : 0,
    body.is_trending ? 1 : 0,
    id
  ).run();

  if (!Number(updateResult.meta?.changes || 0)) return json({ error: 'Prompt not found' }, 404);

  await env.DB.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').bind(id).run();
  await attachTags(env, id, body.tags || []);

  let imageResult = null;
  if (!beforeImageUrl || !afterImageUrl) {
    const prompt = await getPromptById(env, id);
    imageResult = await ensurePromptImages(env, prompt, { force: true });
  }

  return json({
    ok: imageResult ? imageResult.ok : true,
    id,
    preview_image_url: previewImageUrl,
    before_image_url: imageResult?.before_image_url || beforeImageUrl,
    after_image_url: imageResult?.after_image_url || afterImageUrl,
    image_status: imageResult ? (imageResult.ok ? 'ready' : 'failed') : imageStatus,
    image_error: imageResult?.error || null
  }, imageResult && !imageResult.ok ? 500 : 200);
}

export async function adminRetryPromptImages(env, id) {
  const prompt = await getPromptById(env, id);
  if (!prompt) return json({ error: 'Prompt not found' }, 404);

  const result = await ensurePromptImages(env, prompt, { force: true });
  return json({
    id,
    ...result,
    image_status: result.ok ? 'ready' : 'failed'
  }, result.ok ? 200 : 500);
}

export async function adminDeletePrompt(env, id) {
  const prompt = await getPromptById(env, id);
  if (!prompt) return json({ error: 'Prompt not found' }, 404);

  await deleteManagedImage(env, prompt.before_image_url);
  await deleteManagedImage(env, prompt.after_image_url);
  await deleteManagedImage(env, prompt.preview_image_url);
  await env.DB.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM prompt_collections WHERE prompt_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM prompts WHERE id = ?').bind(id).run();
  return json({ ok: true, id });
}

async function deleteManagedImage(env, value) {
  if (!env.PROMPT_IMAGES || !value) return;
  const image = String(value);
  const marker = '/uploads/';
  const markerIndex = image.indexOf(marker);
  if (markerIndex < 0) return;
  const key = decodeURIComponent(image.slice(markerIndex + marker.length));
  if (!key) return;
  try {
    await env.PROMPT_IMAGES.delete(key);
  } catch (error) {
    console.warn(JSON.stringify({ event: 'prompt_image_delete_failed', key, error: String(error?.message || error) }));
  }
}

function cleanImageUrl(value) {
  const image = String(value || '').trim();
  if (!image || image.includes('/api/preview/')) return null;
  return image;
}

async function getOrCreateCategory(env, slug) {
  const existing = await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
  if (existing) return existing;

  const names = {
    'person-edit': ['👤', 'دەستکاری کەس', 'Person Edit', 'تعديل الأشخاص'],
    'kurdish-style': ['☀️', 'ستایلی کوردی', 'Kurdish Style', 'ستايل كردي'],
    outfit: ['👔', 'جل و بەرگ', 'Outfit Style', 'تغيير الملابس'],
    movies: ['🎞️', 'ستایلی فیلم', 'Movie Style', 'ستايل الأفلام'],
    couples: ['👥', 'دوو کەس', 'Two People', 'شخصان'],
    islamic: ['🕌', 'ئیسلامی', 'Islamic', 'إسلامي'],
    cars: ['🚗', 'ئۆتۆمبێل', 'Cars', 'السيارات'],
    characters: ['🦸', 'کارەکتەر', 'Characters', 'الشخصيات']
  };
  const data = names[slug] || ['👤', 'دەستکاری کەس', 'Person Edit', 'تعديل الأشخاص'];
  await env.DB.prepare('INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar) VALUES (?, ?, ?, ?, ?)').bind(slug, ...data).run();
  return env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
}

async function attachTags(env, promptId, tags) {
  for (const rawTag of tags) {
    const slug = slugify(rawTag);
    if (!slug) continue;
    const name = String(rawTag).startsWith('#') ? rawTag : `#${rawTag}`;
    await env.DB.prepare('INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES (?, ?, 1)').bind(slug, name).run();
    const tag = await env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first();
    if (tag) await env.DB.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)').bind(promptId, tag.id).run();
  }
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/#/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  });
}
