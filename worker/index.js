const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });

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

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  }
};

async function listCategories(env) {
  const result = await env.DB.prepare('SELECT * FROM categories ORDER BY name_ku ASC').all();
  return json(result.results || []);
}

async function getCategory(env, slug) {
  const category = await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
  if (!category) return json({ error: 'Category not found' }, 404);

  const prompts = await env.DB.prepare(
    'SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE categories.slug = ? ORDER BY prompts.published_at DESC LIMIT 100'
  ).bind(slug).all();

  return json({ category, prompts: prompts.results || [] });
}

async function listPrompts(env) {
  const result = await env.DB.prepare(
    'SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id ORDER BY prompts.published_at DESC LIMIT 100'
  ).all();
  return json(result.results || []);
}

async function getPrompt(env, slug) {
  const prompt = await env.DB.prepare(
    'SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE prompts.slug = ?'
  ).bind(slug).first();

  if (!prompt) return json({ error: 'Prompt not found' }, 404);

  const tags = await env.DB.prepare(
    'SELECT tags.* FROM tags JOIN prompt_tags ON prompt_tags.tag_id = tags.id WHERE prompt_tags.prompt_id = ? ORDER BY tags.name ASC'
  ).bind(prompt.id).all();

  return json({ ...prompt, tags: tags.results || [] });
}

async function listTags(env) {
  const result = await env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all();
  return json(result.results || []);
}

async function trendingTags(env) {
  const result = await env.DB.prepare('SELECT * FROM tags WHERE is_trending = 1 ORDER BY name ASC LIMIT 30').all();
  return json(result.results || []);
}

async function trendingPrompts(env) {
  const result = await env.DB.prepare(
    'SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id WHERE prompts.is_trending = 1 OR prompts.is_featured = 1 ORDER BY prompts.copies DESC, prompts.views DESC LIMIT 30'
  ).all();
  return json(result.results || []);
}

async function searchPrompts(env, query) {
  const term = `%${query.trim()}%`;
  if (!query.trim()) return listPrompts(env);

  const result = await env.DB.prepare(
    'SELECT DISTINCT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name FROM prompts JOIN categories ON prompts.category_id = categories.id LEFT JOIN prompt_tags ON prompt_tags.prompt_id = prompts.id LEFT JOIN tags ON tags.id = prompt_tags.tag_id WHERE prompts.title_ku LIKE ? OR prompts.title_en LIKE ? OR prompts.title_ar LIKE ? OR prompts.prompt_text LIKE ? OR categories.name_ku LIKE ? OR tags.name LIKE ? ORDER BY prompts.copies DESC, prompts.views DESC LIMIT 100'
  ).bind(term, term, term, term, term, term).all();

  return json(result.results || []);
}

async function increaseCounter(env, id, field) {
  if (!['views', 'copies'].includes(field)) return json({ error: 'Invalid counter' }, 400);
  await env.DB.prepare(`UPDATE prompts SET ${field} = ${field} + 1 WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
