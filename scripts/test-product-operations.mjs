import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MODERATION_STATUSES,
  PRODUCT_OPERATIONS_VERSION,
  RETENTION_CONFIRMATION,
  digestBackupPayload,
  normalizeModerationStatus,
  normalizeRetentionSettings,
  validateBackupStructure
} from '../worker/product-operations.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(PRODUCT_OPERATIONS_VERSION, 'product-operations-v1');
assert.deepEqual(MODERATION_STATUSES, ['published', 'hidden', 'flagged', 'archived']);
assert.equal(normalizeModerationStatus('FLAGGED'), 'flagged');
assert.equal(normalizeModerationStatus('deleted'), 'published');
assert.deepEqual(normalizeRetentionSettings({
  retention_enabled: 'true',
  analytics_retention_days: 2,
  operational_retention_days: 9999
}), {
  retention_enabled: true,
  analytics_retention_days: 30,
  operational_retention_days: 730
});

const backup = {
  format: 'promptstan-content-backup-v2',
  exported_at: '2026-07-16T00:00:00.000Z',
  categories: [{ id: 1, slug: 'person-edit' }],
  prompts: [{ id: 10, slug: 'portrait', category_id: 1, prompt_text: 'Create a realistic portrait.' }],
  tags: [{ id: 20, slug: 'portrait' }],
  prompt_tags: [{ prompt_id: 10, tag_id: 20 }],
  automation_settings: null,
  product_operations_settings: {
    retention_enabled: false,
    analytics_retention_days: 90,
    operational_retention_days: 180
  }
};
const digest = await digestBackupPayload(backup);
assert.match(digest, /^[a-f0-9]{64}$/);
const validation = validateBackupStructure({ ...backup, integrity: { algorithm: 'SHA-256', digest } });
assert.equal(validation.ok, true);
assert.equal(validation.counts.prompts, 1);
assert.equal(validation.warnings.length, 0);

const invalid = validateBackupStructure({
  ...backup,
  prompts: [{ id: 10, slug: 'portrait', category_id: 999, prompt_text: '' }]
});
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.some((error) => error.includes('missing category')));
assert.ok(invalid.errors.some((error) => error.includes('no prompt text')));

const worker = read('worker/entry-v6.js');
const publicApi = read('worker/index.js');
const sharePages = read('worker/entry.js');
const sitemap = read('worker/sitemap.js');
const automation = read('worker/automation.js');
const operations = read('worker/product-operations.js');
const dashboard = read('src/admin/AdminDashboard.jsx');
const manager = read('src/admin/AdminPanelV4.jsx');
const migration = read('database/migrations/005_product_operations.sql');
const backupExport = read('worker/operations.js');
const deployment = read('.github/workflows/deploy-cloudflare.yml');

assert.match(worker, /product_operations: PRODUCT_OPERATIONS_VERSION/);
assert.match(worker, /product_operations_schema: operationsSchema\.ready \? 'ready' : 'pending'/);
assert.match(worker, /\/api\/admin\/operations\/status/);
assert.match(worker, /\/api\/admin\/operations\/restore-drill/);
assert.match(worker, /access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'/);
assert.match(worker, /runRetentionCleanup/);
assert.match(operations, new RegExp(RETENTION_CONFIRMATION));
assert.match(operations, /protected: \['prompts', 'categories', 'tags', 'prompt_tags', 'product_operations_settings'\]/);

assert.ok((publicApi.match(/\$\{visibility\}/g) || []).length >= 5, 'All public prompt reads must enforce moderation');
assert.match(publicApi, /visibility\.replaceAll\('prompts\.', ''\)/);
assert.match(publicApi, /publicVisibilityCondition/);
assert.match(sharePages, /publicVisibilityCondition/);
assert.match(sharePages, /COALESCE\(prompts\.moderation_status, 'published'\) = 'published'/);
assert.match(sitemap, /publicVisibilityCondition/);
assert.match(sitemap, /COALESCE\(moderation_status, 'published'\) = 'published'/);
assert.match(automation, /publishedPromptCondition/);
assert.match(automation, /COALESCE\(\$\{prefix\}moderation_status, 'published'\) = 'published'/);
assert.match(automation, /options\.run_type \|\| 'image_batch'/);
assert.match(worker, /hasAutomationRun\(env, 'image_recovery', local\.date\)/);
assert.match(worker, /run_type: 'image_recovery'/);
assert.match(dashboard, /<AdminPanelV9 \/>/);
assert.match(manager, /status: 'archived'/);
assert.equal(manager.includes("method: 'DELETE'"), false, 'Prompt manager must archive instead of hard delete');

for (const column of ['moderation_status', 'moderation_reason', 'moderated_at', 'moderated_by']) {
  assert.match(operations, new RegExp(`ADD COLUMN ${column}`));
}
assert.equal(migration.includes('ADD COLUMN moderation_status'), false, 'Wrangler migration must stay compatible with runtime schema bootstrap');
for (const table of ['product_operations_settings', 'operation_events']) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(backupExport, /promptstan-content-backup-v2/);
assert.match(backupExport, /integrity: \{ algorithm: 'SHA-256', digest \}/);
assert.match(deployment, /- name: Apply D1 migrations\s+if: env\.CLOUDFLARE_API_TOKEN != ''\s+run: npx wrangler d1 migrations apply promptstan-db --remote/);
assert.match(deployment, /- name: Use Cloudflare repository deployment\s+if: env\.CLOUDFLARE_API_TOKEN == ''/);
assert.match(deployment, /"product_operations_schema":"ready"/);

console.log(JSON.stringify({
  ok: true,
  phase: '9A',
  version: PRODUCT_OPERATIONS_VERSION,
  soft_moderation: true,
  retention_controls: true,
  restore_drill: true,
  backup_integrity: true,
  public_visibility_filter: true
}, null, 2));
