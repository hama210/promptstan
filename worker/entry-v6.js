import app from './entry.js';
import { ensurePromptImageColumns, ensurePromptImages, getPromptById, getConfiguredImageProvider } from './auto-images.js';
import {
  CONTENT_SCALE_VERSION,
  ROTATION_COUNT,
  ensureContentScaleSchema,
  getContentScaleStatus,
  getNextRotationCandidate,
  preparePromptMetadata,
  recordContentScaleEvent,
  scanExistingDuplicates
} from './content-scale.js';
import {
  AUTOMATION_VERSION,
  getAutomationHistory,
  getAutomationSettings,
  getImageQueueStatus,
  getLocalScheduleParts,
  getNextScheduledPosting,
  hasAutomationRun,
  processImageBatch,
  recordAutomationRun,
  saveAutomationSettings,
  shouldRunImageBatch,
  shouldRunPosting
} from './automation.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-promptstan-bootstrap',
  'cache-control': 'no-store'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'promptstan-api',
        image_provider: getConfiguredImageProvider(env) || 'missing',
        image_pipeline: 'flux2-klein-sync-v7',
        launch_phase: 'shareable-prompts-v1',
        growth_phase: 'privacy-analytics-v1',
        content_scale: CONTENT_SCALE_VERSION,
        rotation_count: ROTATION_COUNT,
        automation: AUTOMATION_VERSION
      });
    }

    if (url.pathname === '/api/admin/content-scale/status' && request.method === 'GET') {
      return adminOnly(request, env, async () => json(await getContentScaleStatus(env)));
    }

    if (url.pathname === '/api/admin/content-scale/scan' && request.method === 'POST') {
      return adminOnly(request, env, async () => json(await scanExistingDuplicates(env)));
    }

    if (url.pathname === '/api/admin/automation/settings' && request.method === 'GET') {
      return adminOnly(request, env, async () => {
        const settings = await getAutomationSettings(env);
        return json({
          ok: true,
          version: AUTOMATION_VERSION,
          settings,
          next_posting: getNextScheduledPosting(settings)
        });
      });
    }

    if (url.pathname === '/api/admin/automation/settings' && request.method === 'PUT') {
      return adminOnly(request, env, async () => {
        const body = await readJson(request);
        const settings = await saveAutomationSettings(env, body);
        return json({
          ok: true,
          version: AUTOMATION_VERSION,
          settings,
          next_posting: getNextScheduledPosting(settings)
        });
      });
    }

    if (url.pathname === '/api/admin/automation/history' && request.method === 'GET') {
      return adminOnly(request, env, async () => json({
        ok: true,
        history: await getAutomationHistory(env, Number(url.searchParams.get('limit') || 20))
      }));
    }

    if (url.pathname === '/api/admin/images/queue' && request.method === 'GET') {
      return adminOnly(request, env, async () => json({
        ok: true,
        queue: await getImageQueueStatus(env)
      }));
    }

    if (url.pathname === '/api/admin/images/batch' && request.method === 'POST') {
      return adminOnly(request, env, async () => {
        const body = await readJson(request);
        const settings = await getAutomationSettings(env);
        const limit = Number(body.limit || settings.image_batch_size || 1);
        return json(await processImageBatch(env, limit, { source: 'manual' }));
      });
    }

    if (url.pathname === '/api/admin/daily/run' && request.method === 'POST') {
      return adminOnly(request, env, async () => {
        const settings = await getAutomationSettings(env);
        const local = getLocalScheduleParts(settings);
        return json(await publishScaledDailyPrompt(env, {
          dateKey: local.date,
          source: 'manual'
        }));
      });
    }

    if (url.pathname === '/api/admin/prompts' && request.method === 'POST') {
      return protectPromptWrite(request, env, ctx, null);
    }

    const updateMatch = url.pathname.match(/^\/api\/admin\/prompts\/(\d+)$/);
    if (updateMatch && request.method === 'PUT') {
      return protectPromptWrite(request, env, ctx, Number(updateMatch[1]));
    }

    return app.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (env.DAILY_POST_ENABLED === 'false') return;
    const now = event?.scheduledTime ? new Date(event.scheduledTime) : new Date();
    ctx.waitUntil(runScheduledAutomation(env, now));
  }
};

async function runScheduledAutomation(env, now = new Date()) {
  const settings = await getAutomationSettings(env);
  const local = getLocalScheduleParts(settings, now);
  const result = {
    ok: true,
    local,
    posting: null,
    image_batch: null
  };

  if (shouldRunPosting(settings, now)) {
    const alreadyRan = await hasAutomationRun(env, 'posting', local.date);
    if (!alreadyRan) {
      const posting = await publishScaledDailyPrompt(env, {
        dateKey: local.date,
        source: 'scheduled'
      });
      result.posting = posting;
      await recordAutomationRun(
        env,
        'posting',
        'scheduled',
        local.date,
        posting.ok ? (posting.skipped ? 'completed' : 'completed') : 'partial',
        {
          processed: posting.prompt_id ? 1 : 0,
          succeeded: posting.ok ? 1 : 0,
          failed: posting.ok ? 0 : 1,
          slug: posting.slug || null,
          reason: posting.reason || null,
          quality_score: posting.quality_score || 0
        }
      );
    } else {
      result.posting = { ok: true, skipped: true, reason: 'Posting automation already ran for this local date' };
    }
  }

  if (shouldRunImageBatch(settings, now)) {
    const alreadyRan = await hasAutomationRun(env, 'image_batch', local.date);
    if (!alreadyRan) {
      result.image_batch = await processImageBatch(env, settings.image_batch_size, {
        source: 'scheduled',
        local_date: local.date
      });
    } else {
      result.image_batch = { ok: true, skipped: true, reason: 'Image batch already ran for this local date' };
    }
  }

  return result;
}

async function protectPromptWrite(request, env, ctx, editingId) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);

  let body;
  try {
    body = await request.clone().json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const candidate = {
    slug: body.slug || slugify(body.title_en || body.title_ku || ''),
    category: body.category_slug || 'person-edit',
    title_ku: body.title_ku,
    title_en: body.title_en,
    title_ar: body.title_ar,
    description_ku: body.description_ku,
    description_en: body.description_en,
    description_ar: body.description_ar,
    prompt_text: body.prompt_text,
    tags: Array.isArray(body.tags) ? body.tags : []
  };

  const metadata = await preparePromptMetadata(env, candidate, {
    excludeId: editingId,
    origin: editingId ? 'edited' : 'manual'
  });

  if (metadata.duplicate) {
    await recordContentScaleEvent(env, 'duplicate_blocked', {
      candidate_slug: candidate.slug,
      duplicate_of_id: metadata.duplicate_of?.id,
      similarity: metadata.similarity,
      quality_score: metadata.quality.score,
      details: metadata.reason
    });

    return json({
      error: 'Duplicate or near-duplicate prompt blocked',
      code: 'DUPLICATE_PROMPT',
      similarity: metadata.similarity,
      reason: metadata.reason,
      duplicate_of: metadata.duplicate_of,
      quality: metadata.quality
    }, 409);
  }

  const response = await app.fetch(request, env, ctx);
  const responseText = await response.text();
  let data = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch {}

  if (response.ok) {
    const promptId = Number(editingId || data.id || 0);
    if (promptId) {
      await ensureContentScaleSchema(env);
      await env.DB.prepare(`
        UPDATE prompts
        SET content_fingerprint = ?,
            quality_score = ?,
            content_origin = CASE
              WHEN ? IS NULL THEN COALESCE(content_origin, 'manual')
              ELSE COALESCE(content_origin, ?)
            END
        WHERE id = ?
      `).bind(
        metadata.fingerprint,
        metadata.quality.score,
        editingId,
        metadata.content_origin,
        promptId
      ).run();

      await recordContentScaleEvent(env, editingId ? 'manual_updated' : 'manual_published', {
        prompt_id: promptId,
        candidate_slug: data.slug || candidate.slug,
        quality_score: metadata.quality.score,
        details: JSON.stringify({ issues: metadata.quality.issues })
      });
    }

    data = {
      ...data,
      quality_score: metadata.quality.score,
      quality_passed: metadata.quality.passed,
      quality_issues: metadata.quality.issues,
      duplicate_checked: true
    };
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  return new Response(JSON.stringify(data), { status: response.status, headers });
}

export async function publishScaledDailyPrompt(env, options = {}) {
  await Promise.all([ensurePromptImageColumns(env), ensureContentScaleSchema(env)]);
  const dateKey = normalizeDateKey(options.dateKey) || new Date().toISOString().slice(0, 10);
  const existingToday = await env.DB.prepare(
    'SELECT id, slug FROM prompts WHERE slug LIKE ? LIMIT 1'
  ).bind(`daily-${dateKey}-%`).first();

  if (existingToday) {
    return {
      ok: true,
      skipped: true,
      reason: 'Already published for this scheduled date',
      prompt_id: existingToday.id,
      slug: existingToday.slug
    };
  }

  const candidate = await getNextRotationCandidate(env);
  if (!candidate) {
    await recordContentScaleEvent(env, 'rotation_exhausted', {
      details: `No safe candidate found across ${ROTATION_COUNT} combinations`
    });
    return {
      ok: false,
      skipped: true,
      reason: 'No unique high-quality rotation candidate is currently available'
    };
  }

  const category = await getOrCreateCategory(env, candidate.category);
  const slug = `daily-${dateKey}-${candidate.rotation_key}`;
  const analysis = candidate.analysis;

  const result = await env.DB.prepare(`
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
      negative_prompt,
      preview_image_url,
      before_image_url,
      after_image_url,
      image_status,
      difficulty,
      rating,
      is_featured,
      is_trending,
      content_fingerprint,
      content_origin,
      quality_score,
      rotation_key,
      published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'pending', ?, ?, ?, ?, ?, 'bot', ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    slug,
    category.id,
    candidate.title_ku,
    candidate.title_en,
    candidate.title_ar,
    candidate.description_ku,
    candidate.description_en,
    candidate.description_ar,
    candidate.prompt_text,
    candidate.negative_prompt,
    candidate.difficulty,
    candidate.rating,
    candidate.is_featured,
    candidate.is_trending,
    analysis.fingerprint,
    analysis.quality.score,
    candidate.rotation_key
  ).run();

  const promptId = Number(result.meta?.last_row_id || 0);
  await attachTags(env, promptId, candidate.tags);
  await recordContentScaleEvent(env, 'bot_published', {
    prompt_id: promptId,
    candidate_slug: slug,
    quality_score: analysis.quality.score,
    details: JSON.stringify({
      rotation_key: candidate.rotation_key,
      searched: candidate.searched,
      source: options.source || 'manual'
    })
  });

  const prompt = await getPromptById(env, promptId);
  const imageResult = await ensurePromptImages(env, prompt);

  return {
    ok: imageResult.ok,
    prompt_id: promptId,
    slug,
    scheduled_date: dateKey,
    rotation_key: candidate.rotation_key,
    quality_score: analysis.quality.score,
    duplicate_checked: true,
    searched_candidates: candidate.searched,
    ...imageResult
  };
}

async function getOrCreateCategory(env, slug) {
  const existing = await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
  if (existing) return existing;

  const names = {
    'person-edit': ['👤', 'دەستکاری کەس', 'Person Edit', 'تعديل الأشخاص'],
    'kurdish-style': ['☀️', 'ستایلی کوردی', 'Kurdish Style', 'ستايل كردي'],
    outfit: ['👔', 'جل و بەرگ', 'Outfit Style', 'تغيير الملابس'],
    movies: ['🎞️', 'ستایلی فیلم', 'Movie Style', 'ستايل الأفلام'],
    couples: ['👥', 'دوو کەس', 'Two People', 'شخصان']
  };
  const data = names[slug] || names['person-edit'];
  await env.DB.prepare(
    'INSERT OR IGNORE INTO categories (slug, icon, name_ku, name_en, name_ar) VALUES (?, ?, ?, ?, ?)'
  ).bind(slug, ...data).run();
  return env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first();
}

async function attachTags(env, promptId, tags) {
  if (!promptId) return;
  const statements = [];

  for (const rawTag of tags || []) {
    const slug = slugify(rawTag);
    if (!slug) continue;
    const name = String(rawTag).startsWith('#') ? String(rawTag) : `#${rawTag}`;
    await env.DB.prepare(
      'INSERT OR IGNORE INTO tags (slug, name, is_trending) VALUES (?, ?, 1)'
    ).bind(slug, name).run();
    const tag = await env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first();
    if (tag?.id) {
      statements.push(env.DB.prepare(
        'INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)'
      ).bind(promptId, tag.id));
    }
  }

  if (statements.length) await env.DB.batch(statements);
}

function requireAdmin(request, env) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  return Boolean(env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);
}

async function adminOnly(request, env, handler) {
  if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    return await handler();
  } catch (error) {
    return json({ error: String(error?.message || error || 'Content scale operation failed').slice(0, 500) }, 500);
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeDateKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || `prompt-${Date.now()}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
