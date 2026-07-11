import app from './index.js';
import { adminUpdatePrompt, adminRetryPromptImages } from './admin-extra.js';
import {
  ensurePromptImageColumns,
  ensurePromptImages,
  getConfiguredImageProvider,
  getPromptById
} from './auto-images.js';

const IMAGE_PIPELINE_VERSION = 'flux2-klein-sync-v7';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'promptstan-api',
        image_provider: getConfiguredImageProvider(env) || 'missing',
        image_pipeline: IMAGE_PIPELINE_VERSION
      });
    }

    if (url.pathname === '/api/health/images') {
      return imageJobHealth(env);
    }

    if (url.pathname === '/api/admin/system') {
      return adminOnly(request, env, adminSystemStatus);
    }

    const retryMatch = url.pathname.match(/^\/api\/admin\/prompts\/(\d+)\/images\/retry$/);
    if (retryMatch && request.method === 'POST') {
      return adminOnly(request, env, (req, bindings) => adminRetryPromptImages(bindings, retryMatch[1], ctx));
    }

    const updateMatch = url.pathname.match(/^\/api\/admin\/prompts\/(\d+)$/);
    if (updateMatch && request.method === 'PUT') {
      return adminOnly(request, env, (req, bindings) => adminUpdatePrompt(req, bindings, updateMatch[1], ctx));
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

async function imageJobHealth(env) {
  try {
    await ensurePromptImageColumns(env);
    let health = await readImageHealth(env);

    const repairCandidate = health.recent.find((row) => {
      if (row.has_after) return false;
      if (row.is_stale_generating) return true;

      const errorText = String(row.image_error || '');
      return row.image_status === 'failed' && (
        errorText.includes('input tensor `image` is not present in the model')
        || errorText.includes('Input prompt contains NSFW content')
        || errorText.includes('Could not load image: 404')
        || errorText.includes('Could not load R2 image:')
      );
    });

    let repairResult = null;
    if (repairCandidate && getConfiguredImageProvider(env) === 'workers-ai') {
      if (repairCandidate.image_status === 'generating') {
        await env.DB.prepare(`
          UPDATE prompts
          SET image_status = 'failed', image_error = 'Recovered stale image generation job', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(repairCandidate.id).run();
      }

      const prompt = await getPromptById(env, repairCandidate.id);
      if (prompt) {
        const errorText = String(repairCandidate.image_error || '');
        const regenerateBefore = !repairCandidate.has_before
          || errorText.includes('input tensor `image` is not present in the model')
          || errorText.includes('Input prompt contains NSFW content')
          || errorText.includes('Could not load image: 404')
          || errorText.includes('Could not load R2 image:');

        repairResult = await ensurePromptImages(env, prompt, {
          force: true,
          regenerateBefore
        });
        health = await readImageHealth(env);
      }
    }

    return json({
      ok: true,
      image_provider: getConfiguredImageProvider(env) || 'missing',
      image_pipeline: IMAGE_PIPELINE_VERSION,
      repair_completed: Boolean(repairResult),
      repair_result: repairResult,
      totals: health.totals,
      recent: health.recent
    }, 200, { 'cache-control': 'no-store' });
  } catch (error) {
    return json({
      ok: false,
      image_pipeline: IMAGE_PIPELINE_VERSION,
      error: sanitizeDiagnosticError(error?.message || error)
    }, 500, { 'cache-control': 'no-store' });
  }
}

async function readImageHealth(env) {
  const [totalsResult, recentResult] = await Promise.all([
    env.DB.prepare(`
      SELECT COALESCE(image_status, 'null') AS image_status, COUNT(*) AS total
      FROM prompts
      GROUP BY image_status
      ORDER BY total DESC
    `).all(),
    env.DB.prepare(`
      SELECT
        id,
        COALESCE(image_status, 'null') AS image_status,
        substr(COALESCE(image_error, ''), 1, 400) AS image_error,
        CASE WHEN before_image_url IS NULL OR before_image_url = '' THEN 0 ELSE 1 END AS has_before,
        CASE WHEN after_image_url IS NULL OR after_image_url = '' THEN 0 ELSE 1 END AS has_after,
        CASE
          WHEN image_status = 'generating' AND updated_at < datetime('now', '-2 minutes') THEN 1
          ELSE 0
        END AS is_stale_generating,
        updated_at
      FROM prompts
      ORDER BY id DESC
      LIMIT 12
    `).all()
  ]);

  return {
    totals: totalsResult.results || [],
    recent: (recentResult.results || []).map((row) => ({
      ...row,
      image_error: sanitizeDiagnosticError(row.image_error)
    }))
  };
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
    admin_token: Boolean(env.ADMIN_TOKEN),
    daily_post_enabled: env.DAILY_POST_ENABLED !== 'false'
  };

  return json({
    ok: status.database && status.r2 && Boolean(status.image_provider) && status.admin_token,
    status,
    database_error: databaseError
  });
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

function sanitizeDiagnosticError(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted-key]')
    .slice(0, 400);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
