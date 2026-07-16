export const PRODUCT_OPERATIONS_VERSION = 'product-operations-v1';
export const RETENTION_CONFIRMATION = 'DELETE_OLD_OPERATIONAL_DATA';
export const MODERATION_STATUSES = Object.freeze(['published', 'hidden', 'flagged', 'archived']);
export const DEFAULT_RETENTION_SETTINGS = Object.freeze({
  retention_enabled: false,
  analytics_retention_days: 90,
  operational_retention_days: 180
});

const encoder = new TextEncoder();
const PROMPT_MODERATION_COLUMNS = Object.freeze([
  ['moderation_status', "ALTER TABLE prompts ADD COLUMN moderation_status TEXT DEFAULT 'published'"],
  ['moderation_reason', 'ALTER TABLE prompts ADD COLUMN moderation_reason TEXT'],
  ['moderated_at', 'ALTER TABLE prompts ADD COLUMN moderated_at DATETIME'],
  ['moderated_by', 'ALTER TABLE prompts ADD COLUMN moderated_by TEXT']
]);

export async function ensureProductOperationsSchema(env) {
  await ensurePromptModerationColumns(env);
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS product_operations_settings (
      id INTEGER PRIMARY KEY,
      retention_enabled INTEGER NOT NULL DEFAULT 0,
      analytics_retention_days INTEGER NOT NULL DEFAULT 90,
      operational_retention_days INTEGER NOT NULL DEFAULT 180,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO product_operations_settings (
      id,
      retention_enabled,
      analytics_retention_days,
      operational_retention_days
    ) VALUES (1, 0, 90, 180)
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS operation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  for (const statement of [
    'CREATE INDEX IF NOT EXISTS idx_prompts_moderation_status ON prompts (moderation_status, updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_operation_events_action_created ON operation_events (action, created_at)'
  ]) {
    try { await env.DB.prepare(statement).run(); } catch {}
  }
}

async function ensurePromptModerationColumns(env) {
  const result = await env.DB.prepare("SELECT name FROM pragma_table_info('prompts')").all();
  const existing = new Set((result.results || []).map((row) => row.name));
  for (const [name, statement] of PROMPT_MODERATION_COLUMNS) {
    if (existing.has(name)) continue;
    try {
      await env.DB.prepare(statement).run();
      existing.add(name);
    } catch (error) {
      const raced = await env.DB.prepare(`
        SELECT name FROM pragma_table_info('prompts')
        WHERE name = ?
        LIMIT 1
      `).bind(name).first();
      if (!raced?.name) throw error;
      existing.add(name);
    }
  }
}

export async function getProductOperationsSchemaStatus(env) {
  try {
    const [columns, settingsTable, eventsTable] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM pragma_table_info('prompts')
        WHERE name IN ('moderation_status', 'moderation_reason', 'moderated_at', 'moderated_by')
      `).first(),
      env.DB.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'product_operations_settings'
        LIMIT 1
      `).first(),
      env.DB.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'operation_events'
        LIMIT 1
      `).first()
    ]);
    const moderationColumns = Number(columns?.count || 0);
    return {
      ready: moderationColumns === 4 && Boolean(settingsTable?.name) && Boolean(eventsTable?.name),
      moderation_columns: moderationColumns,
      settings_table: Boolean(settingsTable?.name),
      events_table: Boolean(eventsTable?.name)
    };
  } catch {
    return {
      ready: false,
      moderation_columns: 0,
      settings_table: false,
      events_table: false
    };
  }
}

export function normalizeModerationStatus(value, fallback = 'published') {
  const status = String(value || '').trim().toLowerCase();
  return MODERATION_STATUSES.includes(status) ? status : fallback;
}

export function normalizeRetentionSettings(input = {}) {
  return {
    retention_enabled: toBoolean(input.retention_enabled, DEFAULT_RETENTION_SETTINGS.retention_enabled),
    analytics_retention_days: clampInteger(input.analytics_retention_days, DEFAULT_RETENTION_SETTINGS.analytics_retention_days, 30, 730),
    operational_retention_days: clampInteger(input.operational_retention_days, DEFAULT_RETENTION_SETTINGS.operational_retention_days, 30, 730)
  };
}

export async function getRetentionSettings(env) {
  await ensureProductOperationsSchema(env);
  const row = await env.DB.prepare('SELECT * FROM product_operations_settings WHERE id = 1').first();
  return normalizeRetentionSettings(row || {});
}

export async function saveRetentionSettings(env, input = {}) {
  const settings = normalizeRetentionSettings(input);
  await ensureProductOperationsSchema(env);
  await env.DB.prepare(`
    INSERT INTO product_operations_settings (
      id,
      retention_enabled,
      analytics_retention_days,
      operational_retention_days,
      updated_at
    ) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      retention_enabled = excluded.retention_enabled,
      analytics_retention_days = excluded.analytics_retention_days,
      operational_retention_days = excluded.operational_retention_days,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    settings.retention_enabled ? 1 : 0,
    settings.analytics_retention_days,
    settings.operational_retention_days
  ).run();
  await recordOperationEvent(env, 'retention_settings_updated', {
    target_type: 'settings',
    target_id: '1',
    details: settings
  });
  return settings;
}

export async function getOperationsStatus(env) {
  await ensureProductOperationsSchema(env);
  const [prompts, automation, analytics, operations, recentEvents] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN COALESCE(moderation_status, 'published') = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN moderation_status = 'hidden' THEN 1 ELSE 0 END) AS hidden,
        SUM(CASE WHEN moderation_status = 'flagged' THEN 1 ELSE 0 END) AS flagged,
        SUM(CASE WHEN moderation_status = 'archived' THEN 1 ELSE 0 END) AS archived,
        SUM(CASE WHEN image_status = 'ready' AND before_image_url IS NOT NULL AND after_image_url IS NOT NULL THEN 1 ELSE 0 END) AS image_ready,
        SUM(CASE WHEN image_status = 'failed' THEN 1 ELSE 0 END) AS image_failed,
        SUM(CASE WHEN before_image_url IS NULL OR after_image_url IS NULL THEN 1 ELSE 0 END) AS image_missing,
        SUM(CASE WHEN image_status = 'generating' AND updated_at < datetime('now', '-15 minutes') THEN 1 ELSE 0 END) AS image_stale
      FROM prompts
    `).first(),
    env.DB.prepare(`
      SELECT
        COUNT(*) AS runs_7d,
        SUM(CASE WHEN status IN ('failed', 'partial') THEN 1 ELSE 0 END) AS unhealthy_7d,
        SUM(CASE WHEN created_at >= datetime('now', '-24 hours') AND status IN ('failed', 'partial') THEN 1 ELSE 0 END) AS unhealthy_24h,
        MAX(CASE WHEN status = 'completed' THEN created_at END) AS last_success_at,
        MAX(CASE WHEN status IN ('failed', 'partial') THEN created_at END) AS last_failure_at
      FROM automation_runs
      WHERE created_at >= datetime('now', '-7 days')
    `).first().catch(() => ({})),
    env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS last_24h,
        MIN(created_at) AS oldest_at,
        MAX(created_at) AS newest_at
      FROM prompt_events
    `).first().catch(() => ({})),
    env.DB.prepare(`
      SELECT COUNT(*) AS total, MAX(created_at) AS latest_at
      FROM operation_events
    `).first(),
    env.DB.prepare(`
      SELECT * FROM operation_events
      ORDER BY id DESC
      LIMIT 20
    `).all()
  ]);

  const promptStats = numericObject(prompts, [
    'total', 'published', 'hidden', 'flagged', 'archived', 'image_ready', 'image_failed', 'image_missing', 'image_stale'
  ]);
  const automationStats = numericObject(automation, ['runs_7d', 'unhealthy_7d', 'unhealthy_24h']);
  const analyticsStats = numericObject(analytics, ['total', 'last_24h']);
  const operationStats = numericObject(operations, ['total']);
  const warnings = [];
  if (promptStats.image_failed) warnings.push(`${promptStats.image_failed} image generation job(s) failed`);
  if (promptStats.image_stale) warnings.push(`${promptStats.image_stale} image job(s) are stale`);
  if (automationStats.unhealthy_24h) warnings.push(`${automationStats.unhealthy_24h} automation run(s) were unhealthy in 24h`);
  if (promptStats.flagged) warnings.push(`${promptStats.flagged} prompt(s) need moderation review`);

  return {
    ok: true,
    version: PRODUCT_OPERATIONS_VERSION,
    overall: warnings.length ? 'attention' : 'healthy',
    warnings,
    prompts: promptStats,
    automation: {
      ...automationStats,
      last_success_at: automation?.last_success_at || null,
      last_failure_at: automation?.last_failure_at || null
    },
    analytics: {
      ...analyticsStats,
      oldest_at: analytics?.oldest_at || null,
      newest_at: analytics?.newest_at || null
    },
    operations: {
      ...operationStats,
      latest_at: operations?.latest_at || null,
      recent: recentEvents.results || []
    },
    retention: await getRetentionSettings(env)
  };
}

export async function listModerationPrompts(env, requestedStatus = 'all', requestedLimit = 50) {
  await ensureProductOperationsSchema(env);
  const status = String(requestedStatus || 'all').toLowerCase();
  const limit = clampInteger(requestedLimit, 50, 1, 100);
  const filter = MODERATION_STATUSES.includes(status) ? 'AND COALESCE(prompts.moderation_status, \'published\') = ?' : '';
  const statement = env.DB.prepare(`
    SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name
    FROM prompts
    JOIN categories ON categories.id = prompts.category_id
    WHERE 1 = 1 ${filter}
    ORDER BY
      CASE COALESCE(prompts.moderation_status, 'published')
        WHEN 'flagged' THEN 0
        WHEN 'hidden' THEN 1
        WHEN 'archived' THEN 2
        ELSE 3
      END,
      prompts.updated_at DESC,
      prompts.id DESC
    LIMIT ?
  `);
  const result = MODERATION_STATUSES.includes(status)
    ? await statement.bind(status, limit).all()
    : await statement.bind(limit).all();
  return result.results || [];
}

export async function moderatePrompt(env, id, input = {}) {
  await ensureProductOperationsSchema(env);
  const promptId = clampInteger(id, 0, 1, Number.MAX_SAFE_INTEGER);
  const requested = String(input.status || '').trim().toLowerCase();
  if (!MODERATION_STATUSES.includes(requested)) {
    return { ok: false, code: 'INVALID_MODERATION_STATUS', error: 'Invalid moderation status' };
  }
  const reason = cleanText(input.reason, 500) || null;
  const existing = await env.DB.prepare('SELECT id, slug, moderation_status FROM prompts WHERE id = ?').bind(promptId).first();
  if (!existing) return { ok: false, code: 'PROMPT_NOT_FOUND', error: 'Prompt not found' };

  await env.DB.prepare(`
    UPDATE prompts
    SET moderation_status = ?,
        moderation_reason = ?,
        moderated_at = CURRENT_TIMESTAMP,
        moderated_by = 'admin',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(requested, reason, promptId).run();
  await recordOperationEvent(env, 'prompt_moderated', {
    target_type: 'prompt',
    target_id: String(promptId),
    details: { slug: existing.slug, from: existing.moderation_status || 'published', to: requested, reason }
  });
  return {
    ok: true,
    id: promptId,
    slug: existing.slug,
    moderation_status: requested,
    moderation_reason: reason
  };
}

export async function repairStaleImageJobs(env) {
  await ensureProductOperationsSchema(env);
  const result = await env.DB.prepare(`
    UPDATE prompts
    SET image_status = 'failed',
        image_error = 'Recovered stale image generation job; ready for retry',
        updated_at = CURRENT_TIMESTAMP
    WHERE image_status = 'generating'
      AND updated_at < datetime('now', '-15 minutes')
  `).run();
  const recovered = Number(result.meta?.changes || 0);
  await recordOperationEvent(env, 'stale_image_jobs_recovered', {
    target_type: 'image_jobs',
    status: recovered ? 'completed' : 'skipped',
    details: { recovered }
  });
  return { ok: true, recovered };
}

export async function previewRetentionCleanup(env, overrides = {}) {
  await ensureProductOperationsSchema(env);
  const stored = await getRetentionSettings(env);
  const settings = normalizeRetentionSettings({ ...stored, ...overrides });
  const analyticsCutoff = `-${settings.analytics_retention_days} days`;
  const operationalCutoff = `-${settings.operational_retention_days} days`;
  const [promptEvents, contentEvents, automationRuns, operationEvents] = await Promise.all([
    countOlder(env, 'prompt_events', analyticsCutoff),
    countOlder(env, 'content_scale_events', operationalCutoff),
    countOlder(env, 'automation_runs', operationalCutoff),
    countOlder(env, 'operation_events', operationalCutoff)
  ]);
  return {
    ok: true,
    dry_run: true,
    settings,
    deletable: {
      prompt_events: promptEvents,
      content_scale_events: contentEvents,
      automation_runs: automationRuns,
      operation_events: operationEvents
    },
    total_deletable: promptEvents + contentEvents + automationRuns + operationEvents,
    protected: ['prompts', 'categories', 'tags', 'prompt_tags', 'product_operations_settings']
  };
}

export async function runRetentionCleanup(env, input = {}) {
  const preview = await previewRetentionCleanup(env, input.settings || {});
  if (input.confirm !== RETENTION_CONFIRMATION) {
    return {
      ...preview,
      ok: false,
      code: 'CONFIRMATION_REQUIRED',
      confirmation: RETENTION_CONFIRMATION,
      error: 'Explicit retention cleanup confirmation is required'
    };
  }

  const settings = preview.settings;
  const analyticsCutoff = `-${settings.analytics_retention_days} days`;
  const operationalCutoff = `-${settings.operational_retention_days} days`;
  const results = await env.DB.batch([
    deleteOlderStatement(env, 'prompt_events', analyticsCutoff),
    deleteOlderStatement(env, 'content_scale_events', operationalCutoff),
    deleteOlderStatement(env, 'automation_runs', operationalCutoff),
    deleteOlderStatement(env, 'operation_events', operationalCutoff)
  ]);
  const deleted = {
    prompt_events: Number(results[0]?.meta?.changes || 0),
    content_scale_events: Number(results[1]?.meta?.changes || 0),
    automation_runs: Number(results[2]?.meta?.changes || 0),
    operation_events: Number(results[3]?.meta?.changes || 0)
  };
  const totalDeleted = Object.values(deleted).reduce((sum, value) => sum + value, 0);
  await recordOperationEvent(env, 'retention_cleanup', {
    target_type: 'operational_data',
    target_id: cleanText(input.local_date, 20) || null,
    status: totalDeleted ? 'completed' : 'skipped',
    details: { deleted, total_deleted: totalDeleted, settings, source: cleanToken(input.source) || 'manual' }
  });
  console.log(JSON.stringify({ event: 'retention_cleanup', deleted, total_deleted: totalDeleted }));
  return { ok: true, dry_run: false, settings, deleted, total_deleted: totalDeleted, batch_limit_per_table: 1000 };
}

export async function hasRetentionCleanup(env, localDate) {
  await ensureProductOperationsSchema(env);
  const row = await env.DB.prepare(`
    SELECT id FROM operation_events
    WHERE action = 'retention_cleanup'
      AND target_id = ?
      AND status IN ('completed', 'skipped')
    LIMIT 1
  `).bind(cleanText(localDate, 20)).first();
  return Boolean(row?.id);
}

export function validateBackupStructure(backup = {}) {
  const errors = [];
  const warnings = [];
  const formats = ['promptstan-content-backup-v1', 'promptstan-content-backup-v2'];
  if (!formats.includes(backup?.format)) errors.push('Unsupported or missing backup format');
  for (const field of ['categories', 'prompts', 'tags', 'prompt_tags']) {
    if (!Array.isArray(backup?.[field])) errors.push(`${field} must be an array`);
  }
  if (errors.length) return { ok: false, errors, warnings, counts: {} };

  const categoryIds = new Set(backup.categories.map((row) => Number(row.id)).filter(Boolean));
  const promptIds = new Set(backup.prompts.map((row) => Number(row.id)).filter(Boolean));
  const tagIds = new Set(backup.tags.map((row) => Number(row.id)).filter(Boolean));
  const slugs = new Set();
  for (const prompt of backup.prompts) {
    const slug = cleanText(prompt?.slug, 180);
    if (!slug) errors.push('Every prompt must have a slug');
    else if (slugs.has(slug)) errors.push(`Duplicate prompt slug: ${slug}`);
    else slugs.add(slug);
    if (!categoryIds.has(Number(prompt?.category_id))) errors.push(`Prompt ${slug || prompt?.id || '?'} references a missing category`);
    if (!cleanText(prompt?.prompt_text, 10000)) errors.push(`Prompt ${slug || prompt?.id || '?'} has no prompt text`);
  }
  for (const link of backup.prompt_tags) {
    if (!promptIds.has(Number(link?.prompt_id))) errors.push(`prompt_tags references missing prompt ${link?.prompt_id}`);
    if (!tagIds.has(Number(link?.tag_id))) errors.push(`prompt_tags references missing tag ${link?.tag_id}`);
  }
  if (!backup.integrity?.digest) warnings.push('Legacy backup has no integrity digest');

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)].slice(0, 50),
    warnings,
    counts: {
      categories: backup.categories.length,
      prompts: backup.prompts.length,
      tags: backup.tags.length,
      prompt_tags: backup.prompt_tags.length
    }
  };
}

export async function runRestoreDrill(env, backup = {}) {
  await ensureProductOperationsSchema(env);
  const validation = validateBackupStructure(backup);
  let integrity = { present: Boolean(backup.integrity?.digest), valid: null };
  if (validation.ok && integrity.present) {
    const digest = await digestBackupPayload(backup);
    integrity = { present: true, valid: digest === backup.integrity.digest, expected: backup.integrity.digest, actual: digest };
    if (!integrity.valid) validation.errors.push('Backup integrity digest does not match');
    validation.ok = validation.errors.length === 0;
  }

  if (!validation.ok) {
    await recordOperationEvent(env, 'restore_drill', {
      target_type: 'backup',
      status: 'failed',
      details: { errors: validation.errors, integrity }
    });
    return { ok: false, dry_run: true, validation, integrity, changes_applied: 0 };
  }

  const [categoryRows, promptRows, tagRows] = await Promise.all([
    env.DB.prepare('SELECT slug FROM categories').all(),
    env.DB.prepare('SELECT slug FROM prompts').all(),
    env.DB.prepare('SELECT slug FROM tags').all()
  ]);
  const current = {
    categories: new Set((categoryRows.results || []).map((row) => row.slug)),
    prompts: new Set((promptRows.results || []).map((row) => row.slug)),
    tags: new Set((tagRows.results || []).map((row) => row.slug))
  };
  const comparison = {
    existing_categories: backup.categories.filter((row) => current.categories.has(row.slug)).length,
    new_categories: backup.categories.filter((row) => !current.categories.has(row.slug)).length,
    existing_prompts: backup.prompts.filter((row) => current.prompts.has(row.slug)).length,
    new_prompts: backup.prompts.filter((row) => !current.prompts.has(row.slug)).length,
    existing_tags: backup.tags.filter((row) => current.tags.has(row.slug)).length,
    new_tags: backup.tags.filter((row) => !current.tags.has(row.slug)).length
  };
  await recordOperationEvent(env, 'restore_drill', {
    target_type: 'backup',
    details: { validation: validation.counts, comparison, integrity }
  });
  return { ok: true, dry_run: true, validation, integrity, comparison, changes_applied: 0 };
}

export async function digestBackupPayload(backup = {}) {
  const canonical = {
    format: backup.format,
    exported_at: backup.exported_at,
    categories: backup.categories || [],
    prompts: backup.prompts || [],
    tags: backup.tags || [],
    prompt_tags: backup.prompt_tags || [],
    automation_settings: backup.automation_settings || null,
    product_operations_settings: backup.product_operations_settings || null
  };
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(canonical)));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recordOperationEvent(env, action, input = {}) {
  await ensureProductOperationsSchema(env);
  await env.DB.prepare(`
    INSERT INTO operation_events (action, target_type, target_id, status, details)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    cleanToken(action) || 'unknown',
    cleanToken(input.target_type) || null,
    cleanText(input.target_id, 120) || null,
    cleanToken(input.status) || 'completed',
    cleanText(JSON.stringify(input.details || {}), 4000)
  ).run();
}

async function countOlder(env, table, cutoff) {
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE created_at < datetime('now', ?)`).bind(cutoff).first();
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

function deleteOlderStatement(env, table, cutoff) {
  return env.DB.prepare(`
    DELETE FROM ${table}
    WHERE id IN (
      SELECT id FROM ${table}
      WHERE created_at < datetime('now', ?)
      ORDER BY id ASC
      LIMIT 1000
    )
  `).bind(cutoff);
}

function numericObject(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, Number(row?.[field] || 0)]));
}

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return !['false', '0', 'off', 'no'].includes(value.toLowerCase());
  return Boolean(value);
}

function cleanText(value, maximumLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function cleanToken(value) {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
