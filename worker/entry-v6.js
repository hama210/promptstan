import app from './entry.js';
import { recordReferral } from './analytics.js';
import { isAdminRequest } from './auth.js';
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
import {
  GROWTH_INTELLIGENCE_VERSION,
  getGrowthIntelligence,
  recordConversionEvent
} from './growth-intelligence.js';
import { restoreKnownLibrary } from './library-restore.js';
import { exportProjectData } from './operations.js';
import {
  PRODUCT_OPERATIONS_VERSION,
  RETENTION_CONFIRMATION,
  ensureProductOperationsSchema,
  getOperationsStatus,
  getProductOperationsSchemaStatus,
  getRetentionSettings,
  hasRetentionCleanup,
  listModerationPrompts,
  moderatePrompt,
  previewRetentionCleanup,
  repairStaleImageJobs,
  runRestoreDrill,
  runRetentionCleanup,
  saveRetentionSettings
} from './product-operations.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'cache-control': 'no-store'
};
const USER_REQUESTED_PURGE_CUTOFF = '2026-07-17T12:45:00.000Z';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (url.pathname === '/api/health') {
      let operationsSchema = await getProductOperationsSchemaStatus(env);
      if (!operationsSchema.ready) {
        try {
          await ensureProductOperationsSchema(env);
        } catch (error) {
          console.error(JSON.stringify({
            event: 'product_operations_schema_bootstrap_failed',
            error: String(error?.message || error).slice(0, 500)
          }));
        }
        operationsSchema = await getProductOperationsSchemaStatus(env);
      }
      return json({
        ok: true,
        service: 'promptstan-api',
        image_provider: getConfiguredImageProvider(env) || 'missing',
        image_pipeline: 'flux2-klein-sync-v7',
        launch_phase: 'shareable-prompts-v1',
        growth_phase: 'privacy-analytics-v1',
        content_scale: CONTENT_SCALE_VERSION,
        rotation_count: ROTATION_COUNT,
        automation: AUTOMATION_VERSION,
        growth_intelligence: GROWTH_INTELLIGENCE_VERSION,
        stabilization: 'single-source-v1',
        image_quality: 'phase10-v1',
        product_operations: PRODUCT_OPERATIONS_VERSION,
        product_operations_schema: operationsSchema.ready ? 'ready' : 'pending'
      });
    }

    if (url.pathname === '/api/referral-event' && request.method === 'POST') {
      return recordReferral(request, env);
    }

    if (url.pathname === '/api/conversion-event' && request.method === 'POST') {
      return recordConversionEvent(request, env);
    }

    if (url.pathname === '/api/admin/growth-intelligence' && request.method === 'GET') {
      return adminOnly(request, env, async () => {
        const days = Number(url.searchParams.get('days') || 30);
        return json(await getGrowthIntelligence(env, days));
      });
    }

    if (url.pathname === '/api/bootstrap' && request.method === 'POST') {
      return adminOnly(request, env, async () => restoreLibrary(env));
    }

    if (url.pathname === '/api/admin/library/restore' && request.method === 'POST') {
      return adminOnly(request, env, async () => restoreLibrary(env));
    }

    if (url.pathname === '/api/admin/export' && request.method === 'GET') {
      return adminOnly(request, env, async () => json(await exportProjectData(env)));
    }

    if (url.pathname === '/api/admin/operations/status' && request.method === 'GET') {
      return adminOnly(request, env, async () => json(await getOperationsStatus(env)));
    }

    if (url.pathname === '/api/admin/operations/moderation' && request.method === 'GET') {
      return adminOnly(request, env, async () => json({
        ok: true,
        prompts: await listModerationPrompts(
          env,
          url.searchParams.get('status') || 'all',
          Number(url.searchParams.get('limit') || 50)
        )
      }));
    }

    const moderationMatch = url.pathname.match(/^\/api\/admin\/operations\/prompts\/(\d+)$/);
    if (moderationMatch && request.method === 'PATCH') {
      return adminOnly(request, env, async () => {
        const result = await moderatePrompt(env, Number(moderationMatch[1]), await readJson(request));
        const status = result.ok ? 200 : result.code === 'PROMPT_NOT_FOUND' ? 404 : 400;
        return json(result, status);
      });
    }

    if (url.pathname === '/api/admin/operations/retention' && request.method === 'GET') {
      return adminOnly(request, env, async () => json({ ok: true, settings: await getRetentionSettings(env) }));
    }

    if (url.pathname === '/api/admin/operations/retention' && request.method === 'PUT') {
      return adminOnly(request, env, async () => json({
        ok: true,
        settings: await saveRetentionSettings(env, await readJson(request))
      }));
    }

    if (url.pathname === '/api/admin/operations/retention/preview' && request.method === 'POST') {
      return adminOnly(request, env, async () => json(await previewRetentionCleanup(env, await readJson(request))));
    }

    if (url.pathname === '/api/admin/operations/retention/run' && request.method === 'POST') {
      return adminOnly(request, env, async () => {
        const result = await runRetentionCleanup(env, await readJson(request));
        return json(result, result.ok ? 200 : 400);
      });
    }

    if (url.pathname === '/api/admin/operations/restore-drill' && request.method === 'POST') {
      return adminOnly(request, env, async () => {
        const result = await runRestoreDrill(env, await readJson(request));
        return json(result, result.ok ? 200 : 400);
      });
    }

    if (url.pathname === '/api/admin/operations/images/recover-stale' && request.method === 'POST') {
      return adminOnly(request, env, async () => json(await repairStaleImageJobs(env)));
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
  const purge = await purgeExistingPrompts(env, USER_REQUESTED_PURGE_CUTOFF);
  const settings = await getAutomationSettings(env);
  const local = getLocalScheduleParts(settings, now);
  const result = {
    ok: true,
    purge,
    local,
    posting: null,
    image_batch: null,
    image_recovery: null,
    retention: null
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

  // Repair at most one missing or failed image set per local day. The daily
  // cap keeps recovery automatic without allowing an unbounded AI-cost loop.
  const recoveryAlreadyRan = await hasAutomationRun(env, 'image_recovery', local.date);
  result.image_recovery = recoveryAlreadyRan
    ? { ok: true, skipped: true, reason: 'Image recovery already ran for this local date' }
    : await processImageBatch(env, 1, {
        source: 'scheduled-recovery',
        run_type: 'image_recovery',
        local_date: local.date
      });

  try {
    const retentionSettings = await getRetentionSettings(env);
    if (retentionSettings.retention_enabled) {
      const alreadyRan = await hasRetentionCleanup(env, local.date);
      result.retention = alreadyRan
        ? { ok: true, skipped: true, reason: 'Retention cleanup already ran for this local date' }
        : await runRetentionCleanup(env, {
            confirm: RETENTION_CONFIRMATION,
            source: 'scheduled',
            local_date: local.date
          });
    }
  } catch (error) {
    result.retention = { ok: false, error: String(error?.message || error).slice(0, 500) };
    console.error(JSON.stringify({ event: 'scheduled_retention_failed', error: result.retention.error }));
  }

  return result;
}

async function purgeExistingPrompts(env, cutoffIso) {
  await ensurePromptImageColumns(env);
  const alreadyCompleted = await env.DB.prepare(`
    SELECT id FROM operation_events
    WHERE action = 'user_requested_prompt_purge'
      AND status = 'completed'
      AND target_id = ?
    LIMIT 1
  `).bind(cutoffIso).first();
  if (alreadyCompleted) return { ok: true, skipped: true, reason: 'Requested purge already completed' };

  const cutoff = cutoffIso.replace('T', ' ').replace('.000Z', '');
  const rows = await env.DB.prepare(`
    SELECT id, slug, preview_image_url, before_image_url, after_image_url
    FROM prompts
    WHERE COALESCE(created_at, published_at) <= ?
    ORDER BY id
  `).bind(cutoff).all();
  const prompts = rows.results || [];
  const ids = prompts.map((prompt) => Number(prompt.id)).filter(Boolean);
  const keys = [...new Set(prompts.flatMap((prompt) => [
    prompt.preview_image_url,
    prompt.before_image_url,
    prompt.after_image_url
  ]).map(r2KeyFromUrl).filter(Boolean))];

  if (keys.length && env.PROMPT_IMAGES) await env.PROMPT_IMAGES.delete(keys);

  for (const id of ids) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').bind(id),
      env.DB.prepare('DELETE FROM prompt_collections WHERE prompt_id = ?').bind(id),
      env.DB.prepare('DELETE FROM prompt_events WHERE prompt_id = ?').bind(id),
      env.DB.prepare('DELETE FROM content_scale_events WHERE prompt_id = ? OR duplicate_of_id = ?').bind(id, id),
      env.DB.prepare('DELETE FROM prompts WHERE id = ?').bind(id)
    ]);
  }

  await env.DB.prepare(`
    INSERT INTO operation_events (action, target_type, target_id, status, details)
    VALUES ('user_requested_prompt_purge', 'prompt_cutoff', ?, 'completed', ?)
  `).bind(cutoffIso, JSON.stringify({ prompts_deleted: ids.length, r2_objects_deleted: keys.length })).run();

  console.log(JSON.stringify({
    event: 'user_requested_prompt_purge',
    cutoff: cutoffIso,
    prompts_deleted: ids.length,
    r2_objects_deleted: keys.length
  }));
  return { ok: true, prompts_deleted: ids.length, r2_objects_deleted: keys.length };
}

function r2KeyFromUrl(value) {
  const image = String(value || '').trim();
  if (!image.includes('/uploads/')) return null;
  const encoded = image.split('/uploads/').pop().split(/[?#]/)[0];
  try { return decodeURIComponent(encoded); } catch { return encoded; }
}

async function restoreLibrary(env) {
  await ensurePromptImageColumns(env);
  const result = await restoreKnownLibrary(env);
  return json(result, result.inserted > 0 ? 201 : 200);
}

async function protectPromptWrite(request, env, ctx, editingId) {
  if (!(await isAdminRequest(request, env))) return json({ error: 'Unauthorized' }, 401);

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

async function adminOnly(request, env, handler) {
  if (!(await isAdminRequest(request, env))) return json({ error: 'Unauthorized' }, 401);
  try {
    return await handler();
  } catch (error) {
    const message = String(error?.message || error || 'Admin operation failed').slice(0, 500);
    console.error(JSON.stringify({ event: 'admin_operation_failed', path: new URL(request.url).pathname, error: message }));
    return json({ error: message }, 500);
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
