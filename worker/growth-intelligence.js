export const GROWTH_INTELLIGENCE_VERSION = 'conversion-intelligence-v1';

const ALLOWED_CONVERSIONS = new Set(['view', 'copy', 'favorite']);
const DEFAULT_DAYS = 30;
const MAX_DAYS = 180;

export async function recordConversionEvent(request, env) {
  await ensureGrowthIntelligenceSchema(env);
  const body = await readJson(request);
  const eventType = cleanToken(body.event_type || body.action);
  const promptSlug = cleanToken(body.slug || body.prompt_slug);
  const promptTitle = cleanText(body.title || body.prompt_title, 180);
  const source = cleanToken(body.source || 'direct') || 'direct';
  const medium = cleanToken(body.medium || 'organic') || 'organic';
  const campaign = cleanToken(body.campaign || 'uncategorized') || 'uncategorized';

  if (!ALLOWED_CONVERSIONS.has(eventType)) {
    return json({ error: 'Unsupported conversion event' }, 400);
  }
  if (!promptSlug && !promptTitle) {
    return json({ error: 'Prompt identifier is required' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO prompt_events (
      prompt_slug,
      event_type,
      event_label,
      referrer_host,
      campaign_source,
      campaign_medium,
      campaign_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    promptSlug || null,
    eventType,
    promptTitle || null,
    referrerHost(request),
    source,
    medium,
    campaign
  ).run();

  return json({
    ok: true,
    event_type: eventType,
    slug: promptSlug || null,
    source,
    campaign
  }, 201);
}

export async function getGrowthIntelligence(env, requestedDays = DEFAULT_DAYS) {
  await ensureGrowthIntelligenceSchema(env);
  const days = clampInteger(requestedDays, DEFAULT_DAYS, 1, MAX_DAYS);
  const since = `-${days} days`;

  const [totals, campaignRows, promptRows, categoryRows, searchRows, recentConversions, timezoneRow] = await Promise.all([
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN event_type = 'referral' THEN 1 ELSE 0 END) AS referrals,
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_type = 'copy' THEN 1 ELSE 0 END) AS copies,
        SUM(CASE WHEN event_type = 'favorite' THEN 1 ELSE 0 END) AS favorites,
        SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
        COUNT(*) AS total_events
      FROM prompt_events
      WHERE created_at >= datetime('now', ?)
    `).bind(since).first(),
    env.DB.prepare(`
      SELECT
        COALESCE(campaign_source, 'direct') AS source,
        COALESCE(campaign_medium, 'organic') AS medium,
        COALESCE(campaign_name, 'uncategorized') AS campaign,
        SUM(CASE WHEN event_type = 'referral' THEN 1 ELSE 0 END) AS referrals,
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_type = 'copy' THEN 1 ELSE 0 END) AS copies,
        SUM(CASE WHEN event_type = 'favorite' THEN 1 ELSE 0 END) AS favorites,
        SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares
      FROM prompt_events
      WHERE created_at >= datetime('now', ?)
        AND event_type IN ('referral', 'view', 'copy', 'favorite', 'share')
      GROUP BY
        COALESCE(campaign_source, 'direct'),
        COALESCE(campaign_medium, 'organic'),
        COALESCE(campaign_name, 'uncategorized')
    `).bind(since).all(),
    env.DB.prepare(`
      SELECT
        events.prompt_slug AS slug,
        MAX(COALESCE(events.event_label, prompts.title_ku, prompts.title_en, prompts.title_ar, events.prompt_slug)) AS title,
        MAX(COALESCE(categories.slug, 'uncategorized')) AS category,
        MAX(COALESCE(categories.name_ku, categories.name_en, categories.slug, 'Uncategorized')) AS category_name,
        MAX(COALESCE(prompts.rotation_key, '')) AS rotation_key,
        SUM(CASE WHEN events.event_type = 'referral' THEN 1 ELSE 0 END) AS referrals,
        SUM(CASE WHEN events.event_type = 'view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN events.event_type = 'copy' THEN 1 ELSE 0 END) AS copies,
        SUM(CASE WHEN events.event_type = 'favorite' THEN 1 ELSE 0 END) AS favorites,
        SUM(CASE WHEN events.event_type = 'share' THEN 1 ELSE 0 END) AS shares
      FROM prompt_events AS events
      LEFT JOIN prompts ON prompts.slug = events.prompt_slug
      LEFT JOIN categories ON categories.id = prompts.category_id
      WHERE events.created_at >= datetime('now', ?)
        AND events.prompt_slug IS NOT NULL
        AND events.prompt_slug != ''
        AND events.event_type IN ('referral', 'view', 'copy', 'favorite', 'share')
      GROUP BY events.prompt_slug
      ORDER BY
        (SUM(CASE WHEN events.event_type = 'copy' THEN 5 ELSE 0 END)
        + SUM(CASE WHEN events.event_type = 'favorite' THEN 3 ELSE 0 END)
        + SUM(CASE WHEN events.event_type = 'share' THEN 4 ELSE 0 END)
        + SUM(CASE WHEN events.event_type = 'view' THEN 1 ELSE 0 END)) DESC
      LIMIT 20
    `).bind(since).all(),
    env.DB.prepare(`
      SELECT
        COALESCE(categories.slug, 'uncategorized') AS category,
        MAX(COALESCE(categories.name_ku, categories.name_en, categories.slug, 'Uncategorized')) AS category_name,
        SUM(CASE WHEN events.event_type = 'view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN events.event_type = 'copy' THEN 1 ELSE 0 END) AS copies,
        SUM(CASE WHEN events.event_type = 'favorite' THEN 1 ELSE 0 END) AS favorites,
        SUM(CASE WHEN events.event_type = 'share' THEN 1 ELSE 0 END) AS shares
      FROM prompt_events AS events
      JOIN prompts ON prompts.slug = events.prompt_slug
      LEFT JOIN categories ON categories.id = prompts.category_id
      WHERE events.created_at >= datetime('now', ?)
        AND events.event_type IN ('view', 'copy', 'favorite', 'share')
      GROUP BY COALESCE(categories.slug, 'uncategorized')
    `).bind(since).all(),
    env.DB.prepare(`
      SELECT
        LOWER(event_value) AS query,
        COUNT(*) AS searches,
        ROUND(AVG(COALESCE(result_count, 0)), 1) AS average_results,
        MAX(COALESCE(result_count, 0)) AS max_results
      FROM prompt_events
      WHERE event_type = 'search'
        AND created_at >= datetime('now', ?)
        AND event_value IS NOT NULL
        AND event_value != ''
      GROUP BY LOWER(event_value)
      ORDER BY searches DESC, average_results ASC
      LIMIT 30
    `).bind(since).all(),
    env.DB.prepare(`
      SELECT event_type, created_at
      FROM prompt_events
      WHERE event_type IN ('copy', 'favorite', 'share')
        AND created_at >= datetime('now', ?)
      ORDER BY id DESC
      LIMIT 1000
    `).bind(since).all(),
    env.DB.prepare(`
      SELECT timezone_offset_minutes
      FROM automation_settings
      WHERE id = 1
      LIMIT 1
    `).first().catch(() => null)
  ]);

  const campaigns = rankCampaignRows(campaignRows.results || []);
  const prompts = rankPromptRows(promptRows.results || []);
  const categories = rankCategoryRows(categoryRows.results || []);
  const contentGaps = rankContentGaps(searchRows.results || []);
  const timezoneOffsetMinutes = Number(timezoneRow?.timezone_offset_minutes ?? 180);
  const bestHours = rankLocalHours(recentConversions.results || [], timezoneOffsetMinutes);
  const normalizedTotals = normalizeTotals(totals || {});
  const preference = buildGrowthPreference({ prompts, categories, contentGaps });
  const recommendations = buildRecommendationCards({
    totals: normalizedTotals,
    campaigns,
    prompts,
    categories,
    contentGaps,
    bestHours,
    preference
  });

  return {
    ok: true,
    version: GROWTH_INTELLIGENCE_VERSION,
    period_days: days,
    timezone_offset_minutes: timezoneOffsetMinutes,
    totals: normalizedTotals,
    funnel: buildFunnel(normalizedTotals),
    campaigns,
    prompts,
    categories,
    content_gaps: contentGaps,
    best_hours: bestHours,
    preference,
    recommendations
  };
}

export async function getGrowthPreference(env, days = DEFAULT_DAYS) {
  const report = await getGrowthIntelligence(env, days);
  return report.preference;
}

export async function ensureGrowthIntelligenceSchema(env) {
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
      CREATE INDEX IF NOT EXISTS idx_prompt_events_conversion
      ON prompt_events (event_type, campaign_source, campaign_name, created_at)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_prompt_events_prompt_conversion
      ON prompt_events (prompt_slug, event_type, created_at)
    `).run();
  } catch {}
}

export function normalizeTotals(row = {}) {
  const referrals = number(row.referrals);
  const views = number(row.views);
  const copies = number(row.copies);
  const favorites = number(row.favorites);
  const shares = number(row.shares);
  const conversions = copies + favorites;
  return {
    referrals,
    views,
    copies,
    favorites,
    shares,
    conversions,
    total_events: number(row.total_events),
    landing_rate: rate(views, referrals),
    copy_rate: rate(copies, views),
    favorite_rate: rate(favorites, views),
    conversion_rate: rate(conversions, views || referrals)
  };
}

export function rankCampaignRows(rows = []) {
  return rows
    .map((row) => {
      const referrals = number(row.referrals);
      const views = number(row.views);
      const copies = number(row.copies);
      const favorites = number(row.favorites);
      const shares = number(row.shares);
      const conversions = copies + favorites;
      const base = views || referrals;
      const score = conversions * 8 + shares * 4 + views * 1.5 + referrals;
      return {
        source: cleanToken(row.source) || 'direct',
        medium: cleanToken(row.medium) || 'organic',
        campaign: cleanToken(row.campaign) || 'uncategorized',
        referrals,
        views,
        copies,
        favorites,
        shares,
        conversions,
        landing_rate: rate(views, referrals),
        conversion_rate: rate(conversions, base),
        score: round(score)
      };
    })
    .sort((left, right) => right.score - left.score || right.conversion_rate - left.conversion_rate);
}

export function rankPromptRows(rows = []) {
  return rows
    .map((row) => {
      const views = number(row.views);
      const copies = number(row.copies);
      const favorites = number(row.favorites);
      const shares = number(row.shares);
      const referrals = number(row.referrals);
      const conversions = copies + favorites;
      const score = copies * 5 + favorites * 3 + shares * 4 + views + referrals * 2;
      return {
        slug: cleanToken(row.slug),
        title: cleanText(row.title, 200) || cleanToken(row.slug),
        category: cleanToken(row.category) || 'uncategorized',
        category_name: cleanText(row.category_name, 120) || row.category || 'Uncategorized',
        rotation_key: cleanToken(row.rotation_key),
        referrals,
        views,
        copies,
        favorites,
        shares,
        conversions,
        copy_rate: rate(copies, views),
        conversion_rate: rate(conversions, views || referrals),
        score: round(score)
      };
    })
    .sort((left, right) => right.score - left.score || right.conversion_rate - left.conversion_rate);
}

export function rankCategoryRows(rows = []) {
  return rows
    .map((row) => {
      const views = number(row.views);
      const copies = number(row.copies);
      const favorites = number(row.favorites);
      const shares = number(row.shares);
      const conversions = copies + favorites;
      return {
        category: cleanToken(row.category) || 'uncategorized',
        category_name: cleanText(row.category_name, 120) || row.category || 'Uncategorized',
        views,
        copies,
        favorites,
        shares,
        conversions,
        conversion_rate: rate(conversions, views),
        score: round(conversions * 7 + shares * 4 + views)
      };
    })
    .sort((left, right) => right.score - left.score || right.conversion_rate - left.conversion_rate);
}

export function rankContentGaps(rows = []) {
  return rows
    .map((row) => {
      const searches = number(row.searches);
      const averageResults = Number(row.average_results || 0);
      const gapScore = searches * Math.max(1, 6 - Math.min(5, averageResults));
      return {
        query: cleanText(row.query, 100),
        searches,
        average_results: round(averageResults),
        max_results: number(row.max_results),
        gap_score: round(gapScore)
      };
    })
    .filter((row) => row.query)
    .sort((left, right) => right.gap_score - left.gap_score || right.searches - left.searches)
    .slice(0, 12);
}

export function rankLocalHours(rows = [], timezoneOffsetMinutes = 180) {
  const counts = new Map();
  for (const row of rows) {
    const raw = String(row.created_at || '').replace(' ', 'T');
    const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
    if (Number.isNaN(date.getTime())) continue;
    const local = new Date(date.getTime() + Number(timezoneOffsetMinutes || 0) * 60000);
    const hour = local.getUTCHours();
    counts.set(hour, (counts.get(hour) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([hour, conversions]) => ({ hour, conversions }))
    .sort((left, right) => right.conversions - left.conversions || left.hour - right.hour)
    .slice(0, 6);
}

export function buildGrowthPreference({ prompts = [], categories = [], contentGaps = [] } = {}) {
  const tokenWeights = new Map();
  const categoryWeights = new Map();
  const reasons = [];

  for (const prompt of prompts.slice(0, 6)) {
    const weight = Math.max(1, prompt.score || 0) + prompt.conversions * 5;
    addTokens(tokenWeights, `${prompt.title} ${prompt.rotation_key}`, weight);
    if (prompt.category) categoryWeights.set(prompt.category, (categoryWeights.get(prompt.category) || 0) + weight);
  }

  for (const category of categories.slice(0, 5)) {
    const weight = Math.max(1, category.score || 0) + category.conversions * 5;
    categoryWeights.set(category.category, (categoryWeights.get(category.category) || 0) + weight);
  }

  for (const gap of contentGaps.slice(0, 6)) {
    addTokens(tokenWeights, gap.query, gap.gap_score * 2);
  }

  const tokens = [...tokenWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([token, weight]) => ({ token, weight: round(weight) }));
  const preferredCategories = [...categoryWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([category, weight]) => ({ category, weight: round(weight) }));

  if (preferredCategories[0]) reasons.push(`Top converting category: ${preferredCategories[0].category}`);
  if (tokens[0]) reasons.push(`Strongest demand signal: ${tokens[0].token}`);
  if (contentGaps[0]) reasons.push(`Search gap: ${contentGaps[0].query}`);

  const signalCount = prompts.reduce((sum, item) => sum + item.views + item.conversions, 0)
    + contentGaps.reduce((sum, item) => sum + item.searches, 0);

  return {
    active: signalCount >= 5,
    confidence: signalCount >= 100 ? 'high' : signalCount >= 25 ? 'medium' : signalCount >= 5 ? 'low' : 'collecting-data',
    signal_count: signalCount,
    tokens,
    categories: preferredCategories,
    reasons
  };
}

export function buildRecommendationCards({ totals, campaigns, prompts, categories, contentGaps, bestHours, preference } = {}) {
  const cards = [];
  const bestCampaign = campaigns?.find((item) => item.referrals >= 2 || item.views >= 3) || campaigns?.[0];
  const weakCampaign = [...(campaigns || [])]
    .filter((item) => item.referrals >= 3 && item.conversion_rate < 10)
    .sort((left, right) => right.referrals - left.referrals)[0];
  const bestPrompt = prompts?.[0];
  const bestCategory = categories?.[0];
  const gap = contentGaps?.[0];
  const hour = bestHours?.[0];

  if (bestPrompt) {
    cards.push({
      type: 'content-winner',
      priority: 'high',
      title: 'Create more like the top prompt',
      detail: `${bestPrompt.title} has the strongest weighted engagement score (${bestPrompt.score}).`,
      action: `Keep ${bestPrompt.category_name} in the next bot rotations.`,
      slug: bestPrompt.slug
    });
  }

  if (gap) {
    cards.push({
      type: 'content-gap',
      priority: gap.average_results <= 2 ? 'high' : 'medium',
      title: `Fill the search gap: ${gap.query}`,
      detail: `${gap.searches} search(es) returned about ${gap.average_results} result(s) on average.`,
      action: `Publish a distinct prompt targeting “${gap.query}”.`
    });
  }

  if (bestCampaign) {
    cards.push({
      type: 'campaign-winner',
      priority: 'medium',
      title: `Best campaign: ${bestCampaign.campaign}`,
      detail: `${bestCampaign.source} produced ${bestCampaign.conversions} conversion(s) at ${bestCampaign.conversion_rate}%.`,
      action: `Reuse this campaign structure for the next strong prompt.`
    });
  }

  if (weakCampaign) {
    cards.push({
      type: 'campaign-fix',
      priority: 'medium',
      title: `Improve ${weakCampaign.campaign}`,
      detail: `${weakCampaign.referrals} visits but only ${weakCampaign.conversion_rate}% converted.`,
      action: 'Test a clearer preview image and stronger copy button text.'
    });
  }

  if (bestCategory) {
    cards.push({
      type: 'category',
      priority: 'medium',
      title: `Winning category: ${bestCategory.category_name}`,
      detail: `${bestCategory.conversions} conversion(s) from ${bestCategory.views} prompt view(s).`,
      action: 'Increase this category’s share of the next rotation while preserving variety.'
    });
  }

  if (hour) {
    cards.push({
      type: 'timing',
      priority: 'low',
      title: `Strong engagement hour: ${formatHour(hour.hour)}`,
      detail: `${hour.conversions} conversion event(s) happened around this local hour.`,
      action: 'Consider testing scheduled posting one hour before this peak.'
    });
  }

  if (!cards.length || !preference?.active) {
    cards.push({
      type: 'data',
      priority: 'low',
      title: 'Collect more conversion data',
      detail: `${totals?.total_events || 0} relevant event(s) are available in this period.`,
      action: 'Keep sharing tracked links and let visitors view and copy prompts.'
    });
  }

  return cards.slice(0, 8);
}

function buildFunnel(totals) {
  return [
    { stage: 'referrals', label: 'Referral visits', value: totals.referrals, rate: 100 },
    { stage: 'views', label: 'Prompt views', value: totals.views, rate: rate(totals.views, totals.referrals) },
    { stage: 'copies', label: 'Prompt copies', value: totals.copies, rate: rate(totals.copies, totals.views) },
    { stage: 'favorites', label: 'Favorites', value: totals.favorites, rate: rate(totals.favorites, totals.views) }
  ];
}

function addTokens(map, value, weight) {
  const stopWords = new Set([
    'prompt', 'style', 'person', 'people', 'photo', 'image', 'edit', 'with', 'from', 'the',
    'and', 'for', 'one', 'two', 'three', 'at', 'in', 'of', 'a', 'an', 'لە', 'بە'
  ]);
  const tokens = String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  for (const token of new Set(tokens)) map.set(token, (map.get(token) || 0) + Number(weight || 1));
}

function referrerHost(request) {
  const raw = request.headers.get('referer') || request.headers.get('referrer') || '';
  if (!raw) return null;
  try { return cleanText(new URL(raw).hostname, 120) || null; } catch { return cleanText(raw, 120) || null; }
}

async function readJson(request) {
  try { return await request.json(); } catch {
    try {
      const text = await request.text();
      return text ? JSON.parse(text) : {};
    } catch { return {}; }
  }
}

function rate(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return round((top / bottom) * 100);
}

function number(value) {
  return Number(value || 0);
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function clampInteger(value, fallback, minimum, maximum) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numberValue)));
}

function cleanText(value, maximumLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function cleanToken(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatHour(hour) {
  const normalized = Number(hour || 0) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const twelve = normalized % 12 || 12;
  return `${String(twelve).padStart(2, '0')}:00 ${suffix}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    }
  });
}
