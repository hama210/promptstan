import {
  digestBackupPayload,
  ensureProductOperationsSchema,
  getRetentionSettings,
  recordOperationEvent
} from './product-operations.js';

export async function exportProjectData(env) {
  await ensureProductOperationsSchema(env);
  const [categories, prompts, tags, promptTags, automationSettings, productOperationsSettings] = await Promise.all([
    env.DB.prepare('SELECT * FROM categories ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM prompts ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM tags ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM prompt_tags ORDER BY prompt_id ASC, tag_id ASC').all(),
    env.DB.prepare('SELECT * FROM automation_settings WHERE id = 1').first().catch(() => null),
    getRetentionSettings(env)
  ]);

  const backup = {
    format: 'promptstan-content-backup-v2',
    exported_at: new Date().toISOString(),
    categories: categories.results || [],
    prompts: prompts.results || [],
    tags: tags.results || [],
    prompt_tags: promptTags.results || [],
    automation_settings: automationSettings || null,
    product_operations_settings: productOperationsSettings || null
  };
  const digest = await digestBackupPayload(backup);
  await recordOperationEvent(env, 'backup_exported', {
    target_type: 'backup',
    details: { format: backup.format, prompts: backup.prompts.length, digest }
  });
  return { ...backup, integrity: { algorithm: 'SHA-256', digest } };
}
