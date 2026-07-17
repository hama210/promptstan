import { ensurePromptImageColumns, ensurePromptImages, getConfiguredImageProvider } from './auto-images.js';

export const AUTOMATION_VERSION = 'dynamic-schedule-v1';
export const DEFAULT_AUTOMATION_SETTINGS = Object.freeze({
  posting_enabled: true,
  posting_hour_local: 9,
  posting_days: [0, 1, 2, 3, 4, 5, 6],
  timezone_offset_minutes: 180,
  image_batch_enabled: false,
  image_batch_hour_local: 3,
  image_batch_size: 1
});

export async function ensureAutomationSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS automation_settings (
      id INTEGER PRIMARY KEY,
      posting_enabled INTEGER NOT NULL DEFAULT 1,
      posting_hour_local INTEGER NOT NULL DEFAULT 9,
      posting_days TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
      timezone_offset_minutes INTEGER NOT NULL DEFAULT 180,
      image_batch_enabled INTEGER NOT NULL DEFAULT 0,
      image_batch_hour_local INTEGER NOT NULL DEFAULT 3,
      image_batch_size INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO automation_settings (
      id,
      posting_enabled,
      posting_hour_local,
      posting_days,
      timezone_offset_minutes,
      image_batch_enabled,
      image_batch_hour_local,
      image_batch_size
    ) VALUES (1, 1, 9, '0,1,2,3,4,5,6', 180, 0, 3, 1)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'scheduled',
      local_date TEXT,
      status TEXT NOT NULL,
      processed INTEGER DEFAULT 0,
      succeeded INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_automation_runs_type_date
      ON automation_runs (run_type, local_date, created_at)
    `).run();
  } catch {}
}

export async function getAutomationSettings(env) {
  await ensureAutomationSchema(env);
  const row = await env.DB.prepare('SELECT * FROM automation_settings WHERE id = 1').first();
  return normalizeAutomationSettings(row || DEFAULT_AUTOMATION_SETTINGS);
}

export async function saveAutomationSettings(env, input) {
  await ensureAutomationSchema(env);
  const current = await getAutomationSettings(env);
  const settings = normalizeAutomationSettings({ ...current, ...input });

  await env.DB.prepare(`
    UPDATE automation_settings
    SET posting_enabled = ?,
        posting_hour_local = ?,
        posting_days = ?,
        timezone_offset_minutes = ?,
        image_batch_enabled = ?,
        image_batch_hour_local = ?,
        image_batch_size = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).bind(
    settings.posting_enabled ? 1 : 0,
    settings.posting_hour_local,
    settings.posting_days.join(','),
    settings.timezone_offset_minutes,
    settings.image_batch_enabled ? 1 : 0,
    settings.image_batch_hour_local,
    settings.image_batch_size
  ).run();

  return getAutomationSettings(env);
}

export async function getImageQueueStatus(env) {
  await ensurePromptImageColumns(env);
  const visibility = await publishedPromptCondition(env);
  const counts = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN before_image_url IS NULL OR after_image_url IS NULL THEN 1 ELSE 0 END) AS missing,
      SUM(CASE WHEN image_status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN image_status = 'generating' THEN 1 ELSE 0 END) AS generating,
      SUM(CASE WHEN before_image_url IS NOT NULL AND after_image_url IS NOT NULL AND image_status = 'ready' THEN 1 ELSE 0 END) AS ready
    FROM prompts
    WHERE ${visibility}
  `).first();

  const next = await env.DB.prepare(`
    SELECT id, slug, title_ku, title_en, image_status, image_error, before_image_url, after_image_url
    FROM prompts
    WHERE ${visibility}
      AND (
        before_image_url IS NULL
        OR after_image_url IS NULL
        OR image_status = 'failed'
        OR image_quality_status IS NULL
        OR image_quality_status IN ('pending', 'failed')
      )
    ORDER BY
      CASE WHEN image_status = 'failed' THEN 0 ELSE 1 END,
      id ASC
    LIMIT 10
  `).all();

  return {
    provider: getConfiguredImageProvider(env) || 'missing',
    total: Number(counts?.total || 0),
    missing: Number(counts?.missing || 0),
    failed: Number(counts?.failed || 0),
    generating: Number(counts?.generating || 0),
    ready: Number(counts?.ready || 0),
    next: next.results || []
  };
}

export async function processImageBatch(env, requestedLimit, options = {}) {
  await Promise.all([ensureAutomationSchema(env), ensurePromptImageColumns(env)]);
  const visibility = await publishedPromptCondition(env, 'prompts');
  const provider = getConfiguredImageProvider(env);
  const limit = clampInteger(requestedLimit, 1, 1, 3);
  const source = cleanToken(options.source || 'manual') || 'manual';
  const runType = cleanToken(options.run_type || 'image_batch') || 'image_batch';
  const localDate = cleanText(options.local_date, 20) || null;

  if (!provider) {
    const result = {
      ok: false,
      provider: 'missing',
      limit,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      error: 'No image provider is configured.'
    };
    await recordAutomationRun(env, runType, source, localDate, 'failed', result);
    return result;
  }

  const queue = await env.DB.prepare(`
    SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name
    FROM prompts
    JOIN categories ON prompts.category_id = categories.id
    WHERE ${visibility}
      AND (
        prompts.before_image_url IS NULL
        OR prompts.after_image_url IS NULL
        OR prompts.image_status = 'failed'
        OR prompts.image_quality_status IS NULL
        OR prompts.image_quality_status IN ('pending', 'failed')
      )
    ORDER BY
      CASE WHEN prompts.image_status = 'failed' THEN 0 ELSE 1 END,
      prompts.id ASC
    LIMIT ?
  `).bind(limit).all();

  const results = [];
  for (const prompt of queue.results || []) {
    const force = prompt.image_status === 'failed';
    const generated = await ensurePromptImages(env, prompt, { force });
    results.push({
      id: prompt.id,
      slug: prompt.slug,
      title: prompt.title_ku || prompt.title_en || prompt.slug,
      ok: Boolean(generated.ok),
      skipped: Boolean(generated.skipped),
      provider: generated.provider || provider,
      error: generated.error || null,
      before_image_url: generated.before_image_url || prompt.before_image_url || null,
      after_image_url: generated.after_image_url || prompt.after_image_url || null
    });
  }

  const succeeded = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok).length;
  const response = {
    ok: failed === 0,
    provider,
    limit,
    processed: results.length,
    succeeded,
    failed,
    empty: results.length === 0,
    results
  };

  await recordAutomationRun(
    env,
    runType,
    source,
    localDate,
    failed ? 'partial' : 'completed',
    response
  );
  return response;
}

export async function getAutomationHistory(env, limit = 20) {
  await ensureAutomationSchema(env);
  const result = await env.DB.prepare(`
    SELECT *
    FROM automation_runs
    ORDER BY id DESC
    LIMIT ?
  `).bind(clampInteger(limit, 20, 1, 50)).all();
  return result.results || [];
}

export async function hasAutomationRun(env, runType, localDate) {
  await ensureAutomationSchema(env);
  const row = await env.DB.prepare(`
    SELECT id
    FROM automation_runs
    WHERE run_type = ?
      AND local_date = ?
      AND status IN ('completed', 'partial', 'running')
    LIMIT 1
  `).bind(cleanToken(runType), localDate).first();
  return Boolean(row?.id);
}

export async function recordAutomationRun(env, runType, source, localDate, status, result = {}) {
  await ensureAutomationSchema(env);
  await env.DB.prepare(`
    INSERT INTO automation_runs (
      run_type,
      source,
      local_date,
      status,
      processed,
      succeeded,
      failed,
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    cleanToken(runType) || 'unknown',
    cleanToken(source) || 'scheduled',
    cleanText(localDate, 20) || null,
    cleanToken(status) || 'completed',
    Number(result.processed || 0),
    Number(result.succeeded || 0),
    Number(result.failed || 0),
    cleanText(JSON.stringify(result), 3000)
  ).run();
}

export function normalizeAutomationSettings(input = {}) {
  return {
    posting_enabled: toBoolean(input.posting_enabled, DEFAULT_AUTOMATION_SETTINGS.posting_enabled),
    posting_hour_local: clampInteger(input.posting_hour_local, DEFAULT_AUTOMATION_SETTINGS.posting_hour_local, 0, 23),
    posting_days: normalizeDays(input.posting_days),
    timezone_offset_minutes: clampInteger(input.timezone_offset_minutes, DEFAULT_AUTOMATION_SETTINGS.timezone_offset_minutes, -720, 840),
    image_batch_enabled: toBoolean(input.image_batch_enabled, DEFAULT_AUTOMATION_SETTINGS.image_batch_enabled),
    image_batch_hour_local: clampInteger(input.image_batch_hour_local, DEFAULT_AUTOMATION_SETTINGS.image_batch_hour_local, 0, 23),
    image_batch_size: clampInteger(input.image_batch_size, DEFAULT_AUTOMATION_SETTINGS.image_batch_size, 1, 3)
  };
}

export function getLocalScheduleParts(settings, now = new Date()) {
  const normalized = normalizeAutomationSettings(settings);
  const shifted = new Date(now.getTime() + normalized.timezone_offset_minutes * 60000);
  return {
    day: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    date: shifted.toISOString().slice(0, 10),
    iso: shifted.toISOString(),
    offset_minutes: normalized.timezone_offset_minutes
  };
}

export function shouldRunPosting(settings, now = new Date()) {
  const normalized = normalizeAutomationSettings(settings);
  const local = getLocalScheduleParts(normalized, now);
  return normalized.posting_enabled
    && normalized.posting_days.includes(local.day)
    && normalized.posting_hour_local === local.hour;
}

export function shouldRunImageBatch(settings, now = new Date()) {
  const normalized = normalizeAutomationSettings(settings);
  const local = getLocalScheduleParts(normalized, now);
  return normalized.image_batch_enabled
    && normalized.image_batch_hour_local === local.hour;
}

export function getNextScheduledPosting(settings, now = new Date()) {
  const normalized = normalizeAutomationSettings(settings);
  if (!normalized.posting_enabled || !normalized.posting_days.length) return null;

  for (let hoursAhead = 0; hoursAhead <= 24 * 14; hoursAhead += 1) {
    const candidate = new Date(now.getTime() + hoursAhead * 3600000);
    const local = getLocalScheduleParts(normalized, candidate);
    if (normalized.posting_days.includes(local.day) && local.hour === normalized.posting_hour_local) {
      return {
        utc: candidate.toISOString(),
        local_date: local.date,
        local_hour: local.hour,
        local_day: local.day,
        timezone_offset_minutes: normalized.timezone_offset_minutes
      };
    }
  }

  return null;
}

function normalizeDays(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? DEFAULT_AUTOMATION_SETTINGS.posting_days.join(','))
      .split(',');
  const days = [...new Set(raw.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  return days.length ? days : [...DEFAULT_AUTOMATION_SETTINGS.posting_days];
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function cleanToken(value) {
  return cleanText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function publishedPromptCondition(env, alias = '') {
  try {
    const row = await env.DB.prepare(`
      SELECT name FROM pragma_table_info('prompts')
      WHERE name = 'moderation_status'
      LIMIT 1
    `).first();
    const prefix = alias ? `${alias}.` : '';
    return row?.name ? `COALESCE(${prefix}moderation_status, 'published') = 'published'` : '1 = 1';
  } catch {
    return '1 = 1';
  }
}

function cleanText(value, maximumLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}
