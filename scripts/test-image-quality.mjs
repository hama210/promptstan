import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessImagePair, buildAfterPrompt, detectSubjectType } from '../worker/auto-images.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(detectSubjectType({ prompt_text: 'Edit one person in a suit' }), 'solo');
assert.equal(detectSubjectType({ prompt_text: 'Combine two people from two photos' }), 'couple');
assert.equal(detectSubjectType({ prompt_text: 'Create a family group photo' }), 'group');

const couplePrompt = buildAfterPrompt({ prompt_text: 'cinematic rain scene' }, 'Rain', 'couple');
assert.match(couplePrompt, /Preserve both identities independently/);
assert.match(couplePrompt, /exactly two people/);

const passed = assessImagePair(
  { buffer: new ArrayBuffer(20_000), contentType: 'image/jpeg' },
  { buffer: new ArrayBuffer(40_000), contentType: 'image/jpeg' }
);
assert.equal(passed.passed, true);

const failed = assessImagePair(
  { buffer: new ArrayBuffer(2_000), contentType: 'image/jpeg' },
  { buffer: new ArrayBuffer(2_000), contentType: 'image/jpeg' }
);
assert.equal(failed.passed, false);

const worker = read('worker/auto-images.js');
const publicApi = read('worker/index.js');
const entry = read('worker/entry-v6.js');
const app = read('src/App.jsx');
const styles = read('src/preview-images.css');
const config = read('wrangler.jsonc');

assert.match(worker, /workers_ai_image_fallback/);
assert.match(worker, /versionedImageKey/);
assert.match(publicApi, /image_quality_status/);
assert.match(publicApi, /before_image_url IS NOT NULL/);
assert.match(entry, /image_quality: 'phase10-v1'/);
assert.match(app, /compareRange/);
assert.match(app, /decoding="async"/);
assert.match(styles, /touch-action: pan-y/);
assert.match(config, /flux-2-klein-9b/);

console.log(JSON.stringify({
  ok: true,
  phase: 10,
  subject_aware: true,
  identity_preservation: true,
  quality_gate: true,
  fallback_model: true,
  incomplete_hidden: true,
  mobile_comparison: true
}, null, 2));
