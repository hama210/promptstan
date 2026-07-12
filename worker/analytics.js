const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'no-store'
};

export async function recordPromptShare(request, env) {
  await ensureAnalyticsTable(env);
  const body = await readJson(request);
  const promptId = positiveInteger(body.prompt_id);
  const promptSlug = cleanSlug(body.slug, 120);
  const promptTitle = cleanText(body.title, 180);
  const shareSource = cleanSlug(body.source || 'native', 60);
  const campaign = cleanSlug(body.campaign || 'prompt-share', 100);

  if (!promptId && !promptSlug && !promptTitle) {
    return json({ error: 'Prompt identifier is required' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO prompt_events (
      prompt_id,
      prompt_slug,
      event_type,
      event_label,
      referrer_host,
      campaign_source,
      campaign_medium,
      campaign_name
    ) VALUES (?, ?, 'share', ?, ?, ?, 'share', ?)
  `).bind(
    promptId,
    promptSlug || null,
    promptTitle || null,
    referrerHost(request),
    shareSource || 'native',
    campaign || 'prompt-share'
  ).run();

  const analyticsKey = promptSlug || promptTitle;
  const total = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM prompt_events
    WHERE event_type = 'share'
      AND COALESCE(prompt_slug, event_label, '') = ?
  `).bind(analyticsKey).first();

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

export async function recordReferral(request, env) {
  await ensureAnalyticsTable(env);
  const body = await readJson(request);
  const source = cleanSlug(body.source || inferSource(body.referrer || request.headers.get('referer')), 60) || 'direct';
  const medium = cleanSlug(body.medium || inferMedium(source), 60) || 'referral';
  const campaign = cleanSlug(body.campaign || 'prompt-share', 100) || 'prompt-share';
  const promptSlug = cleanSlug(body.slug || body.content, 120);
  const referrer = cleanHost(body.referrer) || referrerHost(request);

  await env.DB.prepare(`
    INSERT INTO prompt_events (
      prompt_slug,
      event_type,
      referrer_host,
      campaign_source,
      campaign_medium,
      campaign_name
    ) VALUES (?, 'referral', ?, ?, ?, ?)
  `).bind(
    promptSlug || null,
    referrer,
    source,
    medium,
    campaign
  ).run();

  return json({ ok: true, source, medium, campaign }, 201);
}

export async function adminAnalytics(request, env) {
  await ensureAnalyticsTable(env);

  const [totals, topShares, topSearches, daily, topSources, topCampaigns, topReferrers] = await Promise.all([
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_type = 'referral' THEN 1 ELSE 0 END) AS referrals,
        SUM(CASE WHEN event_type = 'share' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS shares_7d,
        SUM(CASE WHEN event_type = 'search' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS searches_7d,
        SUM(CASE WHEN event_type = 'referral' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS referrals_7d
      FROM prompt_events
    `).first(),
    env.DB.prepare(`
      SELECT
        COALESCE(prompt_slug, event_label) AS slug,
        MAX(event_label) AS title,
        COUNT(*) AS shares
      FROM prompt_events
      WHERE event_type = 'share'
        AND COALESCE(prompt_slug, event_label, '') != ''
      GROUP BY COALESCE(prompt_slug, event_label)
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
        SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) AS searches,
        SUM(CASE WHEN event_type = 'referral' THEN 1 ELSE 0 END) AS referrals
      FROM prompt_events
      WHERE created_at >= datetime('now', '-14 days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
    `).all(),
    env.DB.prepare(`
      SELECT
        COALESCE(campaign_source, 'direct') AS source,
        COUNT(*) AS referrals
      FROM prompt_events
      WHERE event_type = 'referral'
      GROUP BY COALESCE(campaign_source, 'direct')
      ORDER BY referrals DESC, MAX(created_at) DESC
      LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT
        COALESCE(campaign_name, 'uncategorized') AS campaign,
        COUNT(*) AS referrals
      FROM prompt_events
      WHERE event_type = 'referral'
      GROUP BY COALESCE(campaign_name, 'uncategorized')
      ORDER BY referrals DESC, MAX(created_at) DESC
      LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT
        referrer_host AS host,
        COUNT(*) AS referrals
      FROM prompt_events
      WHERE event_type = 'referral'
        AND referrer_host IS NOT NULL
        AND referrer_host != ''
      GROUP BY referrer_host
      ORDER BY referrals DESC, MAX(created_at) DESC
      LIMIT 8
    `).all()
  ]);

  return json({
    totals: {
      shares: Number(totals?.shares || 0),
      searches: Number(totals?.searches || 0),
      referrals: Number(totals?.referrals || 0),
      shares_7d: Number(totals?.shares_7d || 0),
      searches_7d: Number(totals?.searches_7d || 0),
      referrals_7d: Number(totals?.referrals_7d || 0)
    },
    top_shares: topShares.results || [],
    top_searches: topSearches.results || [],
    top_sources: topSources.results || [],
    top_campaigns: topCampaigns.results || [],
    top_referrers: topReferrers.results || [],
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
      campaign_source TEXT,
      campaign_medium TEXT,
      campaign_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  for (const statement of [
    'ALTER TABLE prompt_events ADD COLUMN campaign_source TEXT',
    'ALTER TABLE prompt_events ADD COLUMN campaign_medium TEXT',
    'ALTER TABLE prompt_events ADD COLUMN campaign_name TEXT'
  ]) {
    try { await env.DB.prepare(statement).run(); } catch {}
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_type_created
      ON prompt_events (event_type, created_at)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_slug
      ON prompt_events (prompt_slug)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_campaign
      ON prompt_events (campaign_source, campaign_name, created_at)
    `).run();
  } catch {}
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    try {
      const text = await request.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
}

function referrerHost(request) {
  return cleanHost(request.headers.get('referer') || request.headers.get('referrer'));
}

function cleanHost(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return cleanText(new URL(raw).hostname, 120) || null;
  } catch {
    return cleanText(raw, 120) || null;
  }
}

function inferSource(value) {
  const host = cleanHost(value) || '';
  if (/whatsapp|wa\.me/i.test(host)) return 'whatsapp';
  if (/telegram|t\.me/i.test(host)) return 'telegram';
  if (/facebook|fb\.com|l\.facebook/i.test(host)) return 'facebook';
  if (/instagram/i.test(host)) return 'instagram';
  if (/tiktok/i.test(host)) return 'tiktok';
  if (/x\.com|twitter|t\.co/i.test(host)) return 'x';
  if (/google/i.test(host)) return 'google';
  return host ? 'other-referral' : 'direct';
}

function inferMedium(source) {
  return ['whatsapp', 'telegram', 'facebook', 'instagram', 'tiktok', 'x'].includes(source)
    ? 'social'
    : source === 'copy'
      ? 'copy'
      : source === 'native'
        ? 'native-share'
        : 'referral';
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

function cleanSlug(value, maximumLength) {
  return cleanText(value, maximumLength)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}
