import { listFallbackPrompts } from './fallback-prompts.js';

export async function serveSitemap(request, env) {
  let prompts;
  try {
    const visibility = await publicVisibilityCondition(env);
    const result = await env.DB.prepare(`
      SELECT slug, COALESCE(updated_at, published_at, created_at) AS last_modified
      FROM prompts
      WHERE slug IS NOT NULL
        AND slug != ''
        AND ${visibility}
      ORDER BY published_at DESC
      LIMIT 5000
    `).all();
    prompts = result.results || [];
  } catch {
    prompts = listFallbackPrompts().map((prompt) => ({ slug: prompt.slug, last_modified: null }));
  }

  const requestUrl = new URL(request.url);
  const baseUrl = String(env.PUBLIC_BASE_URL || requestUrl.origin).replace(/\/$/, '');
  const promptUrls = prompts.map((prompt) => {
    const location = `${baseUrl}/prompt/${encodeURIComponent(prompt.slug)}`;
    const lastModified = prompt.last_modified ? `<lastmod>${escapeXml(toIsoDate(prompt.last_modified))}</lastmod>` : '';
    return `<url><loc>${escapeXml(location)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(`${baseUrl}/`)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>${promptUrls}</urlset>`;

  return new Response(request.method === 'HEAD' ? null : xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}

async function publicVisibilityCondition(env) {
  try {
    const row = await env.DB.prepare(`
      SELECT name FROM pragma_table_info('prompts')
      WHERE name = 'moderation_status'
      LIMIT 1
    `).first();
    return row?.name ? "COALESCE(moderation_status, 'published') = 'published'" : '1 = 1';
  } catch {
    return '1 = 1';
  }
}

function toIsoDate(value) {
  const normalized = String(value || '').replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString();
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
