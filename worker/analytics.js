const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'no-store'
};

export async function recordPromptShare(request, env) {
  await ensureAnalyticsTable(env);
  const body = await readJson(request);
  const promptId = positiveInteger(body.prompt_id);
  const promptSlug = cleanText(body.slug, 120);
  const promptTitle = cleanText(body.title, 180);

  if (!promptId && !promptSlug) return json({ error: 'Prompt identifier is required' }, 400);

  await env.DB.prepare(`
    INSERT INTO prompt_events (
      prompt_id,
      prompt_slug,
      event_type,
      event_label,
      referrer_host
    ) VALUES (?, ?, 'share', ?, ?)
  `).bind(
    promptId,
    promptSlug || null,
    promptTitle || null,
    referrerHost(request)
  ).run();

  const total = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM prompt_events
    WHERE event_type = 'share'
      AND COALESCE(prompt_slug, '') = COALESCE(?, '')
      AND COALESCE(prompt_id, 0) = COALESCE(?, 0)
  `).bind(promptSlug || null, promptId).first();

  return json({ ok: true, shares: Number(total?.count || 0) }, 201);
}

export async function recordSearch(request, env) {
  await ensureAnalyticsTable(env);
  const body = await readJson(request);
  const query = cleanText(body.query, 100).replace(/^#+/, '');
  const resultCount = boundedInteger(body.result_count, 0, 10000);

  if (query.length < 2) return json({ ok: true, skipped: true });

  await env.DB.prepare(`
    INSERT INTO prompt_events (
      event_type,
      event_value,
      result_count,
      referrer_host
    ) VALUES ('search', ?, ?, ?)
  `).bind(query, resultCount, referrerHost(request)).run();

  return json({ ok: true }, 201);
}

export async function adminAnalytics(request, env) {
  await ensureAnalyticsTable(env);

  const [totals, topShares, topSearches, daily] = await Promise.all([
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_type = 'share' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS shares_7d,
        SUM(CASE WHEN event_type = 'search' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS searches_7d
      FROM prompt_events
    `).first(),
    env.DB.prepare(`
      SELECT
        prompt_slug AS slug,
        MAX(event_label) AS title,
        COUNT(*) AS shares
      FROM prompt_events
      WHERE event_type = 'share'
      GROUP BY prompt_slug
      ORDER BY shares DESC, MAX(created_at) DESC
      LIMIT 8
    `).all(),
    env.DB.prepare(`
      SELECT
        LOWER(event_value) AS query,
        COUNT(*) AS searches,
        MAX(result_count) AS result_count
      FROM prompt_events
      WHERE event_type = 'search'
        AND event_value IS NOT NULL
        AND event_value != ''
      GROUP BY LOWER(event_value)
      ORDER BY searches DESC, MAX(created_at) DESC
      LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT
        substr(created_at, 1, 10) AS day,
        SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) AS searches
      FROM prompt_events
      WHERE created_at >= datetime('now', '-14 days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
    `).all()
  ]);

  return json({
    totals: {
      shares: Number(totals?.shares || 0),
      searches: Number(totals?.searches || 0),
      shares_7d: Number(totals?.shares_7d || 0),
      searches_7d: Number(totals?.searches_7d || 0)
    },
    top_shares: topShares.results || [],
    top_searches: topSearches.results || [],
    daily: daily.results || []
  });
}

async function ensureAnalyticsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS prompt_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id INTEGER,
      prompt_slug TEXT,
      event_type TEXT NOT NULL,
      event_value TEXT,
      event_label TEXT,
      result_count INTEGER DEFAULT 0,
      referrer_host TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_type_created
      ON prompt_events (event_type, created_at)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_slug
      ON prompt_events (prompt_slug)
    `).run();
  } catch {}
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function referrerHost(request) {
  const value = request.headers.get('referer') || request.headers.get('referrer') || '';
  if (!value) return null;
  try {
    return cleanText(new URL(value).hostname, 120) || null;
  } catch {
    return null;
  }
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function boundedInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function cleanText(value, maximumLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}
