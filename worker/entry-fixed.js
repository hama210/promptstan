import app from './entry-v6.js';
import { recordReferral } from './analytics.js';
import { ensurePromptImageColumns } from './auto-images.js';
import {
  GROWTH_INTELLIGENCE_VERSION,
  getGrowthIntelligence,
  recordConversionEvent
} from './growth-intelligence.js';
import { restoreKnownLibrary } from './library-restore.js';

const BOOTSTRAP_HEADER = 'empty-library-v1';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-promptstan-bootstrap',
  'access-control-max-age': '86400'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      const response = await app.fetch(request, env, ctx);
      let data = {};
      try { data = await response.json(); } catch {}
      return json({ ...data, growth_intelligence: GROWTH_INTELLIGENCE_VERSION });
    }

    if (url.pathname === '/api/referral-event' && request.method === 'POST') {
      return recordReferral(request, env);
    }

    if (url.pathname === '/api/conversion-event' && request.method === 'POST') {
      return recordConversionEvent(request, env);
    }

    if (url.pathname === '/api/admin/growth-intelligence' && request.method === 'GET') {
      if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      try {
        const days = Number(url.searchParams.get('days') || 30);
        return json(await getGrowthIntelligence(env, days));
      } catch (error) {
        return json({
          error: String(error?.message || error || 'Growth intelligence failed').slice(0, 500)
        }, 500);
      }
    }

    if (url.pathname === '/api/bootstrap' && request.method === 'POST') {
      if (request.headers.get('x-promptstan-bootstrap') !== BOOTSTRAP_HEADER) {
        return json({ error: 'Unauthorized' }, 401);
      }

      return restoreLibrary(env);
    }

    if (url.pathname === '/api/admin/library/restore' && request.method === 'POST') {
      if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      return restoreLibrary(env);
    }

    return app.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (typeof app.scheduled === 'function') return app.scheduled(event, env, ctx);
  }
};

async function restoreLibrary(env) {
  try {
    await ensurePromptImageColumns(env);
    const result = await restoreKnownLibrary(env);
    return json(result, result.inserted > 0 ? 201 : 200);
  } catch (error) {
    return json({
      ok: false,
      error: String(error?.message || error || 'Library restoration failed').slice(0, 500)
    }, 500);
  }
}

function requireAdmin(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      'cache-control': 'no-store'
    }
  });
}
