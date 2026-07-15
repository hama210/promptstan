export async function exportProjectData(env) {
  const [categories, prompts, tags, promptTags, automationSettings] = await Promise.all([
    env.DB.prepare('SELECT * FROM categories ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM prompts ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM tags ORDER BY id ASC').all(),
    env.DB.prepare('SELECT * FROM prompt_tags ORDER BY prompt_id ASC, tag_id ASC').all(),
    env.DB.prepare('SELECT * FROM automation_settings WHERE id = 1').first().catch(() => null)
  ]);

  return {
    format: 'promptstan-content-backup-v1',
    exported_at: new Date().toISOString(),
    categories: categories.results || [],
    prompts: prompts.results || [],
    tags: tags.results || [],
    prompt_tags: promptTags.results || [],
    automation_settings: automationSettings || null
  };
}
