import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker/entry-v6.js', import.meta.url), 'utf8');

assert.match(worker, /USER_REQUESTED_PURGE_CUTOFF = '2026-07-17T12:45:00\.000Z'/);
assert.match(worker, /purgeExistingPrompts\(env, USER_REQUESTED_PURGE_CUTOFF\)/);
assert.match(worker, /env\.PROMPT_IMAGES\.delete\(keys\)/);
assert.match(worker, /DELETE FROM prompt_tags WHERE prompt_id/);
assert.match(worker, /DELETE FROM prompt_collections WHERE prompt_id/);
assert.match(worker, /DELETE FROM prompt_events WHERE prompt_id/);
assert.match(worker, /DELETE FROM content_scale_events WHERE prompt_id/);
assert.match(worker, /DELETE FROM prompts WHERE id/);
assert.match(worker, /user_requested_prompt_purge/);

console.log(JSON.stringify({ ok: true, permanent_prompt_purge: true, bounded_by_cutoff: true }, null, 2));
