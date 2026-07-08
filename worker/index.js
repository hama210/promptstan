export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'promptstan-api' });
    }

    if (url.pathname === '/api/categories') {
      const categories = await env.DB.prepare('SELECT * FROM categories ORDER BY id DESC').all();
      return json(categories.results || []);
    }

    if (url.pathname === '/api/prompts') {
      const prompts = await env.DB.prepare(
        'SELECT prompts.*, categories.slug AS category_slug FROM prompts JOIN categories ON prompts.category_id = categories.id ORDER BY prompts.published_at DESC LIMIT 50'
      ).all();
      return json(prompts.results || []);
    }

    return json({ error: 'Not found' }, 404);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  });
}
