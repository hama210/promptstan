import assert from 'node:assert/strict';
import {
  ROTATION_COUNT,
  buildRotationCandidate,
  comparePromptContent,
  scorePromptQuality
} from '../worker/content-scale.js';

assert.equal(ROTATION_COUNT, 240, 'Phase 6 should provide 240 rotation combinations');

const rotationKeys = new Set();
for (let index = 0; index < ROTATION_COUNT; index += 1) {
  const candidate = buildRotationCandidate(index);
  assert.ok(candidate.rotation_key, `Candidate ${index} needs a rotation key`);
  assert.ok(!rotationKeys.has(candidate.rotation_key), `Duplicate rotation key: ${candidate.rotation_key}`);
  rotationKeys.add(candidate.rotation_key);

  const quality = scorePromptQuality(candidate);
  assert.ok(
    quality.score >= 70,
    `Rotation candidate ${candidate.rotation_key} scored only ${quality.score}: ${quality.issues.join(', ')}`
  );
}

const original = buildRotationCandidate(0);
const exactCopy = { ...original, slug: 'another-slug' };
const exactComparison = comparePromptContent(original, exactCopy);
assert.equal(exactComparison.similarity, 1, 'Exact prompt text must be blocked');

const nearCopy = {
  ...original,
  slug: 'near-copy',
  title_en: `${original.title_en} Portrait`,
  prompt_text: `${original.prompt_text} Ultra detailed output.`
};
const nearComparison = comparePromptContent(original, nearCopy);
assert.ok(
  nearComparison.similarity >= 0.84,
  `Near duplicate should be blocked, received ${nearComparison.similarity}`
);

const different = buildRotationCandidate(137);
const differentComparison = comparePromptContent(original, different);
assert.ok(
  differentComparison.similarity < 0.84,
  `Distinct rotation candidates should remain publishable, received ${differentComparison.similarity}`
);

const lowQuality = scorePromptQuality({
  title_en: 'Test',
  prompt_text: 'test prompt',
  tags: []
});
assert.ok(lowQuality.score < 70, 'Placeholder prompts must fail the bot quality threshold');

console.log(JSON.stringify({
  ok: true,
  rotation_count: ROTATION_COUNT,
  unique_rotation_keys: rotationKeys.size,
  first_quality: scorePromptQuality(original).score,
  near_duplicate_similarity: nearComparison.similarity,
  distinct_similarity: differentComparison.similarity,
  low_quality_score: lowQuality.score
}, null, 2));
