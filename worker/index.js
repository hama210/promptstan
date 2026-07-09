import { adminListPrompts, adminUpdatePrompt, adminDeletePrompt } from './admin-extra.js';
import { uploadPromptImage, servePromptImage } from './r2-images.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization'
};

const DAILY_PROMPTS = [
  { slug: 'daily-kurdish-bride-cinematic', category: 'kurdish-style', title_ku: 'بووکی کوردی بە ستایلی سینەمایی', title_en: 'Cinematic Kurdish Bride', title_ar: 'عروس كردية سينمائية', description_ku: 'پرۆمپتی ڕۆژانە بۆ وێنەی بووکی کوردی.', prompt_text: 'Kurdish bride wearing traditional colorful Kurdish dress, elegant jewelry, mountain background, warm cinematic light, realistic photography, ultra detailed, professional portrait, 8K.', difficulty: 'easy', rating: 4.9, is_featured: 1, is_trending: 1, tags: ['kurdishbride', 'kurdish', 'portrait'] },
  { slug: 'daily-ramadan-mosque-glow', category: 'islamic', title_ku: 'مزگەوتی ڕەمەزان بە ڕۆشنایی گەرم', title_en: 'Ramadan Mosque Glow', title_ar: 'مسجد رمضان بإضاءة دافئة', description_ku: 'پرۆمپتی ڕۆژانە بۆ دیمەنی ئیسلامی.', prompt_text: 'Beautiful mosque during Ramadan night, glowing lanterns, crescent moon, peaceful atmosphere, warm cinematic lighting, Islamic architecture, realistic wallpaper style, high quality.', difficulty: 'easy', rating: 4.9, is_featured: 0, is_trending: 1, tags: ['ramadan', 'islamic', 'mosque'] },
  { slug: 'daily-two-photos-warm-hug', category: 'couples', title_ku: 'دوو وێنە پێکەوە بە Hug', title_en: 'Two Photos Warm Hug', title_ar: 'صورتان في عناق دافئ', description_ku: 'پرۆمپتی ڕۆژانە بۆ پێکەوەکردنی دوو کەس.', prompt_text: 'Combine two separate people from two photos into one realistic warm hug scene, natural body position, matching lighting and shadows, emotional cinematic photo edit, high quality.', difficulty: 'easy', rating: 4.8, is_featured: 1, is_trending: 1, tags: ['couple', 'hug', 'twophotos'] },
  { slug: 'daily-luxury-car-night-ad', category: 'cars', title_ku: 'ئۆتۆمبێلی لاکژەری لە شەودا', title_en: 'Luxury Car Night Ad', title_ar: 'سيارة فاخرة ليلاً', description_ku: 'پرۆمپتی ڕۆژانە بۆ کار و ڕیکلام.', prompt_text: 'Luxury car photography at night, neon street reflections, cinematic rain, sharp details, premium advertising look, dramatic lighting, ultra realistic, high quality.', difficulty: 'medium', rating: 4.8, is_featured: 0, is_trending: 1, tags: ['luxurycar', 'cars', 'cinematic'] }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
    if (url.pathname.startsWith('/uploads/')) return servePromptImage(request, env);

    if (url.pathname === '/api/health') return json({ ok: true, service: 'promptstan-api' });
    if (url.pathname === '/api/categories') return listCategories(env);
    if (url.pathname.startsWith('/api/categories/')) return getCategory(env, url.pathname.split('/').pop());
    if (url.pathname === '/api/tags') return listTags(env);
    if (url.pathname === '/api/tags/trending') return trendingTags(env);
    if (url.pathname === '/api/trending') return trendingPrompts(env);
    if (url.pathname === '/api/search') return searchPrompts(env, url.searchParams.get('q') || '');
    if (url.pathname === '/api/prompts') return listPrompts(env);
    if (url.pathname.startsWith('/api/prompts/')) return getPrompt(env, url.pathname.split('/').pop());
    if (request.method === 'POST' && url.pathname.startsWith('/api/view/')) return increaseCounter(env, url.pathname.split('/').pop(), 'views');
    if (request.method === 'POST' && url.pathname.startsWith('/api/copy/')) return increaseCounter(env, url.pathname.split('/').pop(), 'copies');

    if (url.pathname === '/api/admin/dashboard') return adminOnly(request, env, adminDashboard);
    if (url.pathname === '/api/admin/daily/run') return adminOnly(request, env, runDailyPostNow);
    if (url.pathname === '/api/admin/upload' && request.method === 'POST') return adminOnly(request, env, uploadPromptImage);
    if (url.pathname === '/api/admin/prompts' && request.method === 'GET') return adminOnly(request, env, (req, e) => adminListPrompts(e));
    if (url.pathname === '/api/admin/prompts' && request.method === 'POST') return adminOnly(request, env, createPromptFromRequest);
    if (url.pathname.startsWith('/api/admin/prompts/') && request.method === 'PUT') return adminOnly(request, env, (req, e) => adminUpdatePrompt(req, e, url.pathname.split('/').pop()));
    if (url.pathname.startsWith('/api/admin/prompts/') && request.method === 'DELETE') return adminOnly(request, env, (req, e) => adminDeletePrompt(e, url.pathname.split('/').pop()));

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    if (env.DAILY_POST_ENABLED === 'false') return;
    ctx.waitUntil(publishDailyPrompt(env));
  }
};

async function publishDailyPrompt(env) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await env.DB.prepare('SELECT id FROM prompts WHERE slug LIKE ? LIMIT 1').bind(`daily-${today}-%`).first();
  if (existing) return { ok: true, skipped: true, reason: 'Already published today' };
  const dayNumber = Math.floor(Date.now() / 86400000);
  const template = DAILY_PROMPTS[dayNumber % DAILY_PROMPTS.length];
  const slug = `daily-${today}-${template.slug}`;
  const category = await getOrCreateCategory(env, template.category);
  const result = await env.DB.prepare('INSERT INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, prompt_text, difficulty, rating, is_featured, is_trending, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(slug, category.id, template.title_ku, template.title_en, template.title_ar, template.description_ku, template.prompt_text, template.difficulty, template.rating, template.is_featured, template.is_trending).run();
  const promptId = result.meta.last_row_id;
  await attachTags(env, promptId, template.tags);
  return { ok: true, prompt_id: promptId, slug };
}

async function runDailyPostNow(request, env) { return json(await publishDailyPrompt(env)); }

async function adminDashboard(request, env) {
  const [prompts, categories, tags] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(views),0) AS views, COALESCE(SUM(copies),0) AS copies FROM prompts').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM categories').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM tags').first()
  ]);
  return json({ prompts, categories, tags });
}

async function createPromptFromRequest(request, env) {
  const body = await request.json();
  const category = await getOrCreateCategory(env, body.category_slug || 'kurdish-style');
  const slug = body.slug || slugify(body.title_en || body.title_ku || `prompt-${Date.now()}`);
  const result = await env.DB.prepare('INSERT INTO prompts (slug, category_id, title_ku, title_en, title_ar, description_ku, description_en, description_ar, prompt_text, negative_prompt, preview_image_url, difficulty, rating, is_featured, is_trending, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(slug, category.id, body.title_ku, body.title_en || null, body.title_ar || null, body.description_ku || null, body.description_en || null, body.description_ar || null, body.prompt_text, body.negative_prompt || null, body.preview_image_url || null, body.difficulty || 'easy', body.rating || 4.8, body.is_featured ? 1 : 0, body.is_trending ? 1 : 0).run();
  const promptId = result.meta.last_row_id;
  await attachTags(env, promptId, body.tags || []);
  return json({ ok: true, id: promptId, slug }, 201);
}

async function getOrCreateCategory(env, slug) {
  const existing = await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
  if (existing) return existing;
  const names = { 'kurdish-style': ['☀️', 'کوردی ستایل', 'Kurdish Style', 'ستايل كردي'], islamic: ['🕌', 'ئیسلامی', 'Islamic', 'إسلامي'], couples: ['👥', 'جووت و خێزان', 'Couples', 'الأزواج'], cars: ['🚗', 'ئۆتۆمبێل', 'Cars', 'السيارات'], movies: ['🎞️', 'فیلم و پۆستەر', 'Movies', 'الأفلام'], characters: ['🦸', 'کارەکتەر', 'Characters', 'الشخصيات'] };
  const data = names[slug] || ['📂', slug, slug, slug];
  await env.DB.prepare('INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar) VALUES (?, ?, ?, ?, ?)').bind(slug, ...data).run();
  return env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
}

async function attachTags(env, promptId, tags) {
  for (const rawTag of tags) {
    const slug = slugify(rawTag);
    const name = String(rawTag).startsWith('#') ? rawTag : `#${rawTag}`;
    await env.DB.prepare('INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES (?, ?, 1)').bind(slug, name).run();
    const tag = await env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first();
    if (tag) await env.DB.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)').bind(promptId, tag.id).run();
  }
}

function requireAdmin(request, env) { const token = request.headers.get('authorization')?.replace('Bearer ', '') || ''; return Boolean(env.ADMIN_TOKEN && token === env.ADMIN_TOKEN); }
async function adminOnly(request, env, handler) { if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401); return handler(request, env); }
async function listCategories(env) { const result = await env.DB.prepare('SELECT * FROM categories ORDER BY name_ku ASC').all(); return json(result.results || []); }
async function getCategory(env, slug) { const category = await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first(); if (!category) return json({ error: 'Category not found' }, 404); const prompts = await env.DB.prepare('SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE categories.slug = ? ORDER BY prompts.published_at DESC LIMIT 100').bind(slug).all(); return json({ category, prompts: prompts.results || [] }); }
async function listPrompts(env) { const result = await env.DB.prepare('SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id ORDER BY prompts.published_at DESC LIMIT 100').all(); return json(result.results || []); }
async function getPrompt(env, slug) { const prompt = await env.DB.prepare('SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE prompts.slug = ?').bind(slug).first(); if (!prompt) return json({ error: 'Prompt not found' }, 404); const tags = await env.DB.prepare('SELECT tags.* FROM tags JOIN prompt_tags ON prompt_tags.tag_id = tags.id WHERE prompt_tags.prompt_id = ? ORDER BY tags.name ASC').bind(prompt.id).all(); return json({ ...prompt, tags: tags.results || [] }); }
async function listTags(env) { const result = await env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all(); return json(result.results || []); }
async function trendingTags(env) { const result = await env.DB.prepare('SELECT * FROM tags WHERE is_trending = 1 ORDER BY name ASC LIMIT 30').all(); return json(result.results || []); }
async function trendingPrompts(env) { const result = await env.DB.prepare('SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE prompts.is_trending = 1 OR prompts.is_featured = 1 ORDER BY prompts.copies DESC, prompts.views DESC LIMIT 30').all(); return json(result.results || []); }
async function searchPrompts(env, query) { const term = `%${query.trim().replace('#', '')}%`; if (!query.trim()) return listPrompts(env); const result = await env.DB.prepare('SELECT DISTINCT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id LEFT JOIN prompt_tags ON prompt_tags.prompt_id = prompts.id LEFT JOIN tags ON tags.id = prompt_tags.tag_id WHERE prompts.title_ku LIKE ? OR prompts.title_en LIKE ? OR prompts.title_ar LIKE ? OR prompts.prompt_text LIKE ? OR categories.name_ku LIKE ? OR tags.name LIKE ? OR tags.slug LIKE ? ORDER BY prompts.copies DESC, prompts.views DESC LIMIT 100').bind(term, term, term, term, term, term, term).all(); return json(result.results || []); }
async function increaseCounter(env, id, field) { if (!['views', 'copies'].includes(field)) return json({ error: 'Invalid counter' }, 400); await env.DB.prepare(`UPDATE prompts SET ${field} = ${field} + 1 WHERE id = ?`).bind(id).run(); return json({ ok: true }); }
function slugify(value) { return String(value || '').toLowerCase().replace(/#/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prompt-${Date.now()}`; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
