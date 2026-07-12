import app from './index.js';
import { adminUpdatePrompt, adminRetryPromptImages } from './admin-extra.js';
import { adminAnalytics, recordPromptShare, recordSearch } from './analytics.js';
import { ensurePromptImageColumns, getConfiguredImageProvider } from './auto-images.js';
import { getFallbackPrompt } from './fallback-prompts.js';
import { serveSitemap } from './sitemap.js';

const IMAGE_PIPELINE_VERSION = 'flux2-klein-sync-v7';
const LAUNCH_PHASE_VERSION = 'shareable-prompts-v1';
const GROWTH_PHASE_VERSION = 'privacy-analytics-v1';
const BOOTSTRAP_HEADER = 'empty-library-v1';
const STARTER_SLUG = 'starter-solo-cinematic-portrait';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-promptstan-bootstrap'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'promptstan-api',
        image_provider: getConfiguredImageProvider(env) || 'missing',
        image_pipeline: IMAGE_PIPELINE_VERSION,
        launch_phase: LAUNCH_PHASE_VERSION,
        growth_phase: GROWTH_PHASE_VERSION
      });
    }

    if (url.pathname === '/api/bootstrap' && request.method === 'POST') {
      return bootstrapEmptyLibrary(request, env);
    }

    if (url.pathname === '/api/share' && request.method === 'POST') {
      return recordPromptShare(request, env);
    }

    if (url.pathname === '/api/search-event' && request.method === 'POST') {
      return recordSearch(request, env);
    }

    if (url.pathname === '/api/admin/analytics') {
      return adminOnly(request, env, adminAnalytics);
    }

    if (url.pathname === '/api/admin/system') {
      return adminOnly(request, env, adminSystemStatus);
    }

    if (url.pathname === '/sitemap.xml' && ['GET', 'HEAD'].includes(request.method)) {
      return serveSitemap(request, env);
    }

    const promptPageMatch = url.pathname.match(/^\/prompt\/([^/]+)\/?$/);
    if (promptPageMatch && ['GET', 'HEAD'].includes(request.method)) {
      return servePromptPage(request, env, decodeURIComponent(promptPageMatch[1]));
    }

    const retryMatch = url.pathname.match(/^\/api\/admin\/prompts\/(\d+)\/images\/retry$/);
    if (retryMatch && request.method === 'POST') {
      return adminOnly(request, env, (req, bindings) => adminRetryPromptImages(bindings, retryMatch[1]));
    }

    const updateMatch = url.pathname.match(/^\/api\/admin\/prompts\/(\d+)$/);
    if (updateMatch && request.method === 'PUT') {
      return adminOnly(request, env, (req, bindings) => adminUpdatePrompt(req, bindings, updateMatch[1]));
    }

    if (url.pathname === '/api/admin/prompts' && request.method === 'POST') {
      return app.fetch(request, env, {});
    }

    return app.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof app.scheduled === 'function') return app.scheduled(event, env, ctx);
  }
};

async function bootstrapEmptyLibrary(request, env) {
  if (request.headers.get('x-promptstan-bootstrap') !== BOOTSTRAP_HEADER) {
    return json({ error: 'Unauthorized' }, 401, { 'cache-control': 'no-store' });
  }

  try {
    await ensurePromptImageColumns(env);
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM prompts').first();

    if (Number(count?.total || 0) > 0) {
      return json({ ok: true, skipped: true, reason: 'Prompt library is not empty' }, 200, {
        'cache-control': 'no-store'
      });
    }

    await env.DB.prepare(`
      INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar)
      VALUES ('person-edit', '👤', 'دەستکاری کەس', 'Person Edit', 'تعديل الأشخاص')
    `).run();

    const category = await env.DB.prepare(
      'SELECT id FROM categories WHERE slug = ? LIMIT 1'
    ).bind('person-edit').first();

    if (!category?.id) throw new Error('Could not create the starter category');

    const fallback = getFallbackPrompt('prompt-1');
    await env.DB.prepare(`
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
        is_featured,
        is_trending,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'easy', 5.0, 1, 1, CURRENT_TIMESTAMP)
    `).bind(
      STARTER_SLUG,
      category.id,
      fallback?.title_ku || 'پۆرترێتی سینەمایی بۆ یەک کەس',
      fallback?.title_en || 'Solo Cinematic Portrait',
      'بورتريه سينمائي لشخص واحد',
      fallback?.description_ku || 'پرۆمپتێکی ئامادە بۆ دروستکردنی پۆرترێتێکی سینەمایی و ڕاستەقینە.',
      fallback?.description_en || 'A ready-to-use prompt for a realistic cinematic portrait.',
      'موجه جاهز لإنشاء صورة شخصية سينمائية واقعية.',
      fallback?.prompt_text || 'Edit one person into a realistic cinematic portrait, warm golden-hour lighting, sharp facial details, natural skin texture, soft background blur, professional photography style, high quality.'
    ).run();

    const prompt = await env.DB.prepare(`
      SELECT prompts.*, categories.name_ku AS category_name
      FROM prompts
      JOIN categories ON prompts.category_id = categories.id
      WHERE prompts.slug = ?
      LIMIT 1
    `).bind(STARTER_SLUG).first();

    if (!prompt) throw new Error('Starter prompt was not created');

    return json({ ok: true, created: true, prompt }, 201, { 'cache-control': 'no-store' });
  } catch (error) {
    return json({
      ok: false,
      error: String(error?.message || error || 'Bootstrap failed').slice(0, 400)
    }, 500, { 'cache-control': 'no-store' });
  }
}

async function servePromptPage(request, env, slug) {
  if (!env.ASSETS) return app.fetch(request, env, {});

  await ensurePromptImageColumns(env);
  const databasePrompt = await env.DB.prepare(`
    SELECT prompts.*, categories.name_ku AS category_name
    FROM prompts
    JOIN categories ON prompts.category_id = categories.id
    WHERE prompts.slug = ?
    LIMIT 1
  `).bind(slug).first();
  const prompt = databasePrompt || getFallbackPrompt(slug);

  if (!prompt) return app.fetch(request, env, {});

  const indexUrl = new URL('/index.html', request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(indexUrl.toString(), {
    method: 'GET',
    headers: request.headers
  }));
  if (!assetResponse.ok) return app.fetch(request, env, {});

  const pageUrl = new URL(request.url);
  const canonical = `${pageUrl.origin}/prompt/${encodeURIComponent(slug)}`;
  const titleText = prompt.title_ku || prompt.title_en || prompt.title_ar || 'Promptstan Prompt';
  const title = `${titleText} | Promptstan`;
  const description = cleanDescription(
    prompt.description_ku
      || prompt.description_en
      || prompt.description_ar
      || prompt.prompt_text
      || 'Free AI photo editing prompt from Promptstan.'
  );
  const image = absoluteImageUrl(
    prompt.after_image_url || prompt.preview_image_url || prompt.before_image_url || '/favicon.svg',
    pageUrl.origin
  );

  let html = await assetResponse.text();
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  html = replaceTag(html, /<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="article" />');
  html = replaceTag(html, /<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  html = replaceTag(html, /<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);

  const imageTags = `<meta property="og:image" content="${escapeHtml(image)}" />\n    <meta property="og:image:alt" content="${escapeHtml(titleText)} Preview" />\n    <meta name="twitter:image" content="${escapeHtml(image)}" />`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: titleText,
    description,
    url: canonical,
    image,
    inLanguage: ['ku', 'en', 'ar'],
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Promptstan' }
  }).replace(/</g, '\\u003c');

  html = html.replace('</head>', `    ${imageTags}\n    <script type="application/ld+json">${structuredData}</script>\n  </head>`);

  const headers = new Headers(assetResponse.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300, s-maxage=900');
  return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
}

async function adminSystemStatus(request, env) {
  let database = false;
  let databaseError = null;

  try {
    await ensurePromptImageColumns(env);
    const result = await env.DB.prepare('SELECT 1 AS ok').first();
    database = result?.ok === 1;
  } catch (error) {
    databaseError = String(error?.message || error);
  }

  const imageProvider = getConfiguredImageProvider(env);
  const status = {
    database,
    r2: Boolean(env.PROMPT_IMAGES),
    workers_ai: Boolean(env.AI),
    openai: Boolean(env.OPENAI_API_KEY),
    image_provider: imageProvider,
    image_pipeline: IMAGE_PIPELINE_VERSION,
    launch_phase: LAUNCH_PHASE_VERSION,
    growth_phase: GROWTH_PHASE_VERSION,
    admin_token: Boolean(env.ADMIN_TOKEN),
    daily_post_enabled: env.DAILY_POST_ENABLED !== 'false'
  };

  return json({
    ok: status.database && status.r2 && Boolean(status.image_provider) && status.admin_token,
    status,
    database_error: databaseError
  });
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function cleanDescription(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function absoluteImageUrl(value, origin) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requireAdmin(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
}

async function adminOnly(request, env, handler) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  return handler(request, env);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
