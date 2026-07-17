const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_WORKERS_AI_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const DEFAULT_PUBLIC_BASE_URL = 'https://promptstan-api.hhhh46529.workers.dev';

export function getConfiguredImageProvider(env) {
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.AI) return 'workers-ai';
  return null;
}

export async function ensurePromptImageColumns(env) {
  const columns = [
    'ALTER TABLE prompts ADD COLUMN before_image_url TEXT',
    'ALTER TABLE prompts ADD COLUMN after_image_url TEXT',
    'ALTER TABLE prompts ADD COLUMN image_status TEXT DEFAULT "pending"',
    'ALTER TABLE prompts ADD COLUMN image_error TEXT',
    'ALTER TABLE prompts ADD COLUMN image_quality_status TEXT DEFAULT "pending"',
    'ALTER TABLE prompts ADD COLUMN image_quality_score INTEGER DEFAULT 0',
    'ALTER TABLE prompts ADD COLUMN image_quality_reason TEXT',
    'ALTER TABLE prompts ADD COLUMN image_subject_type TEXT',
    'ALTER TABLE prompts ADD COLUMN image_model_used TEXT'
  ];

  for (const sql of columns) {
    try {
      await env.DB.prepare(sql).run();
    } catch {}
  }
}

export async function getPromptById(env, id) {
  await ensurePromptImageColumns(env);
  return env.DB.prepare(`
    SELECT prompts.*, categories.slug AS category_slug, categories.name_ku AS category_name
    FROM prompts
    JOIN categories ON prompts.category_id = categories.id
    WHERE prompts.id = ?
  `).bind(id).first();
}

export async function ensurePromptImages(env, prompt, options = {}) {
  if (!prompt?.id) return { ok: false, error: 'Prompt not found' };
  await ensurePromptImageColumns(env);

  const force = Boolean(options.force);
  const regenerateBefore = Boolean(options.regenerateBefore);
  let qualityRetry = false;

  if (!force && !regenerateBefore && prompt.before_image_url && prompt.after_image_url) {
    try {
      const existingBefore = await loadImageSource(prompt.before_image_url, env);
      const existingAfter = await loadImageSource(prompt.after_image_url, env);
      const quality = assessImagePair(existingBefore, existingAfter);
      await persistImageQuality(env, prompt.id, quality, detectSubjectType(prompt), prompt.image_model_used || 'legacy');
      if (quality.passed) {
        await setImageStatus(env, prompt.id, 'ready', null);
        return {
          ok: true,
          skipped: true,
          quality,
          before_image_url: prompt.before_image_url,
          after_image_url: prompt.after_image_url
        };
      }
      qualityRetry = true;
    } catch {
      qualityRetry = true;
    }
  }

  if (!env.PROMPT_IMAGES) {
    const message = 'PROMPT_IMAGES R2 binding is missing';
    await setImageStatus(env, prompt.id, 'failed', message);
    return { ok: false, error: message };
  }

  const provider = getConfiguredImageProvider(env);
  if (!provider) {
    const message = 'No image provider is configured. Connect Workers AI or set OPENAI_API_KEY.';
    await setImageStatus(env, prompt.id, 'failed', message);
    return { ok: false, error: message };
  }

  const claimed = await claimImageJob(env, prompt.id);
  if (!claimed) {
    return { ok: true, skipped: true, reason: 'Image generation is already running' };
  }

  try {
    const title = prompt.title_en || prompt.title_ku || prompt.slug || 'Person Edit';
    const subjectType = detectSubjectType(prompt);
    let beforeImageUrl = prompt.before_image_url || null;
    let beforeSource;

    if (beforeImageUrl && !regenerateBefore) {
      beforeSource = await loadImageSource(beforeImageUrl, env);
    } else {
      beforeSource = await generateBeforeImageSource(env, prompt, title);
      const beforeExtension = extensionFromContentType(beforeSource.contentType);
      const beforeKey = versionedImageKey(prompt, 'before', beforeExtension);
      await storeImage(env, beforeKey, beforeSource.buffer, beforeSource.contentType);
      beforeImageUrl = `/uploads/${beforeKey}`;
      await persistBeforeImage(env, prompt.id, beforeImageUrl);
    }

    let afterImageUrl = regenerateBefore ? null : (prompt.after_image_url || null);
    if (force || qualityRetry || regenerateBefore || !afterImageUrl) {
      const afterSource = await generateAfterImageSource(env, prompt, title, beforeSource, subjectType);
      const afterExtension = extensionFromContentType(afterSource.contentType);
      const afterKey = versionedImageKey(prompt, 'after', afterExtension);
      await storeImage(env, afterKey, afterSource.buffer, afterSource.contentType);
      afterImageUrl = `/uploads/${afterKey}`;

      const quality = assessImagePair(beforeSource, afterSource);
      await persistImageQuality(env, prompt.id, quality, subjectType, afterSource.model || provider);
      if (!quality.passed) throw new Error(`Image quality gate failed: ${quality.reason}`);
    }

    await env.DB.prepare(`
      UPDATE prompts
      SET before_image_url = ?, after_image_url = ?, image_status = ?, image_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(beforeImageUrl, afterImageUrl, 'ready', prompt.id).run();

    return { ok: true, provider, before_image_url: beforeImageUrl, after_image_url: afterImageUrl };
  } catch (error) {
    const message = String(error?.message || error || 'Image generation failed');
    await setImageStatus(env, prompt.id, 'failed', message);
    return { ok: false, provider, error: message };
  }
}

async function claimImageJob(env, promptId) {
  const result = await env.DB.prepare(`
    UPDATE prompts
    SET image_status = 'generating', image_error = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (
        image_status IS NULL
        OR image_status != 'generating'
        OR updated_at < datetime('now', '-10 minutes')
      )
  `).bind(promptId).run();
  return Number(result.meta?.changes || 0) > 0;
}

async function persistBeforeImage(env, promptId, beforeImageUrl) {
  await env.DB.prepare(`
    UPDATE prompts
    SET before_image_url = ?, after_image_url = NULL, image_status = 'generating', image_error = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(beforeImageUrl, promptId).run();
}

async function generateBeforeImageSource(env, prompt, title) {
  const beforePrompt = buildBeforePrompt(prompt, title);

  if (env.OPENAI_API_KEY) {
    const buffer = await callOpenAIImageGeneration(env, beforePrompt);
    return { buffer, contentType: detectImageContentType(buffer, 'image/png') };
  }

  return callWorkersAIFlux2(env, beforePrompt, null, {
    width: clampInteger(env.CLOUDFLARE_BEFORE_WIDTH, 512, 256, 512),
    height: clampInteger(env.CLOUDFLARE_BEFORE_HEIGHT, 512, 256, 512)
  });
}

async function generateAfterImageSource(env, prompt, title, beforeSource, subjectType) {
  const editPrompt = buildAfterPrompt(prompt, title, subjectType);

  if (!env.OPENAI_API_KEY) {
    const primaryModel = env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_WORKERS_AI_IMAGE_MODEL;
    const fallbackModel = env.CLOUDFLARE_IMAGE_FALLBACK_MODEL || primaryModel;
    try {
      return await callWorkersAIFlux2(env, editPrompt, beforeSource, {
        model: primaryModel,
        width: clampInteger(env.CLOUDFLARE_IMAGE_WIDTH, 768, 256, 1920),
        height: clampInteger(env.CLOUDFLARE_IMAGE_HEIGHT, 768, 256, 1920)
      });
    } catch (primaryError) {
      console.warn(JSON.stringify({
        event: 'workers_ai_image_fallback',
        prompt_id: prompt.id,
        primary_model: primaryModel,
        fallback_model: fallbackModel,
        error: String(primaryError?.message || primaryError).slice(0, 300)
      }));
      return callWorkersAIFlux2(env, `${editPrompt}\nRetry with conservative composition and maximum facial fidelity.`, beforeSource, {
        model: fallbackModel,
        width: clampInteger(env.CLOUDFLARE_FALLBACK_WIDTH, 768, 256, 1024),
        height: clampInteger(env.CLOUDFLARE_FALLBACK_HEIGHT, 768, 256, 1024)
      });
    }
  }

  try {
    const buffer = await callOpenAIImageEdit(env, beforeSource, editPrompt);
    return { buffer, contentType: detectImageContentType(buffer, 'image/png') };
  } catch (editError) {
    console.warn(JSON.stringify({ event: 'prompt_image_edit_fallback', prompt_id: prompt.id, error: String(editError?.message || editError) }));
    const buffer = await callOpenAIImageGeneration(env, `${editPrompt}\n\nCreate the final edited result as a realistic high quality photo.`);
    return { buffer, contentType: detectImageContentType(buffer, 'image/png') };
  }
}

export function detectSubjectType(prompt) {
  const category = String(prompt.category_slug || '').toLowerCase();
  const text = `${prompt.title_en || ''} ${prompt.title_ku || ''} ${prompt.prompt_text || ''}`.toLowerCase();

  if (category.includes('group') || /group|family|friends|three people|four people|کۆمەڵ|خێزان/.test(text)) return 'group';
  if (category.includes('couple') || /couple|two people|two photos|دوو کەس|شخصان/.test(text)) return 'couple';
  return 'solo';
}

function buildBeforePrompt(prompt, title) {
  const category = String(prompt.category_slug || '').toLowerCase();
  const text = `${title} ${prompt.prompt_text || ''}`.toLowerCase();
  const subjectType = detectSubjectType(prompt);

  if (subjectType === 'group') {
    return 'Photorealistic unedited casual group photo of three adult friends, every face fully visible and distinct, natural spacing, normal everyday clothes, simple daylight, plain background, realistic phone camera photo, no cinematic styling.';
  }

  if (subjectType === 'couple') {
    return 'Photorealistic unedited casual photo of exactly two adults standing together, both complete faces visible and distinct, neutral clothes, natural daylight, plain background, realistic phone camera detail, no cinematic effects or luxury styling.';
  }

  if (category.includes('kurdish') || text.includes('kurdish')) {
    return 'Realistic simple unedited photo of one Kurdish person in normal everyday clothes, natural daylight, plain background, phone camera look, before transformation.';
  }

  if (category.includes('outfit') || text.includes('suit') || text.includes('clothes')) {
    return 'Realistic simple unedited full body photo of one person wearing casual clothes, natural pose, plain background, phone camera look, before outfit transformation.';
  }

  if (category.includes('movie') || text.includes('cinematic') || text.includes('movie')) {
    return 'Realistic simple unedited portrait photo of one person, neutral expression, normal clothes, natural daylight, plain background, phone camera look, before cinematic transformation.';
  }

  if (text.includes('woman') || text.includes('girl') || text.includes('female')) {
    return 'Realistic simple unedited portrait photo of one woman, natural daylight, plain background, phone camera look, no makeup transformation, before AI edit.';
  }

  return 'Realistic simple unedited portrait photo of one man, natural daylight, plain background, phone camera look, neutral clothes, before AI edit.';
}

export function buildAfterPrompt(prompt, title, subjectType = detectSubjectType(prompt)) {
  const identityRules = {
    solo: 'Preserve the single subject’s exact facial geometry, eye shape, nose, mouth, jawline, skin tone, age, hairline, and distinguishing features.',
    couple: 'Preserve both identities independently. Keep exactly two people; do not merge, swap, average, duplicate, or replace either face.',
    group: 'Preserve every person independently. Keep the same number and left-to-right identity order; do not merge, duplicate, omit, or swap faces.'
  };
  return `Professional photorealistic image edit using input image 0 as the identity source. ${identityRules[subjectType]} Keep natural skin pores, realistic eyes, correct hands and anatomy, coherent pose, physically consistent lighting, shadows, scale, and camera perspective. Apply only this requested transformation: ${prompt.prompt_text || title}. Title: ${title}. The result must look like a real DSLR photograph, not AI art. No face reshaping, beauty-filter plastic skin, extra people, extra fingers, duplicated limbs, text, logo, or watermark.`;
}

async function callWorkersAIFlux2(env, prompt, imageSource = null, options = {}) {
  if (!env.AI) throw new Error('Workers AI binding is missing');

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(options.width || 768));
  form.append('height', String(options.height || 768));

  const guidance = clampNumber(env.CLOUDFLARE_IMAGE_GUIDANCE, 4, 1, 10);
  form.append('guidance', String(guidance));

  if (imageSource?.buffer) {
    const contentType = normalizeImageContentType(imageSource.contentType);
    const extension = extensionFromContentType(contentType);
    const imageBlob = new Blob([imageSource.buffer], { type: contentType });
    form.append('input_image_0', imageBlob, `before.${extension}`);
  }

  const formResponse = new Response(form);
  const formContentType = formResponse.headers.get('content-type');
  if (!formResponse.body || !formContentType) throw new Error('Could not serialize FLUX.2 multipart input');

  const model = options.model || env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_WORKERS_AI_IMAGE_MODEL;
  const result = await env.AI.run(
    model,
    {
      multipart: {
        body: formResponse.body,
        contentType: formContentType
      }
    }
  );

  const buffer = await workersAIResultToArrayBuffer(result);
  return {
    buffer,
    contentType: detectImageContentType(buffer, 'image/jpeg'),
    model
  };
}

async function workersAIResultToArrayBuffer(result) {
  if (!result) throw new Error('Workers AI did not return image data');

  if (result instanceof ArrayBuffer) return result;
  if (ArrayBuffer.isView(result)) {
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  }
  if (result instanceof Response) return result.arrayBuffer();
  if (result instanceof ReadableStream) return new Response(result).arrayBuffer();
  if (result?.image) return base64ToArrayBuffer(result.image);
  if (result?.body) return new Response(result.body).arrayBuffer();
  if (typeof result === 'string') {
    const base64 = result.includes(',') ? result.split(',').pop() : result;
    return base64ToArrayBuffer(base64);
  }

  throw new Error('Workers AI returned an unsupported image response');
}

async function callOpenAIImageGeneration(env, prompt) {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL,
      prompt,
      size: env.OPENAI_IMAGE_SIZE || '1024x1024',
      n: 1
    })
  });

  return imageResponseToArrayBuffer(response);
}

async function callOpenAIImageEdit(env, imageSource, prompt) {
  const contentType = normalizeImageContentType(imageSource.contentType);
  const form = new FormData();
  form.append('model', env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('size', env.OPENAI_IMAGE_SIZE || '1024x1024');
  form.append('n', '1');
  form.append('image', new File([imageSource.buffer], `before.${extensionFromContentType(contentType)}`, { type: contentType }));

  const response = await fetch(OPENAI_EDITS_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form
  });

  return imageResponseToArrayBuffer(response);
}

async function imageResponseToArrayBuffer(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `${response.status} ${response.statusText}`;
    throw new Error(`OpenAI image request failed: ${detail}`);
  }

  const item = data?.data?.[0];
  if (item?.b64_json) return base64ToArrayBuffer(item.b64_json);
  if (item?.url) return (await loadImageSource(item.url)).buffer;
  throw new Error('OpenAI did not return image data');
}

async function loadImageSource(value, env = {}) {
  const imageUrl = String(value || '');

  if (imageUrl.startsWith('/uploads/') && env.PROMPT_IMAGES) {
    const encodedKey = imageUrl.slice('/uploads/'.length).split(/[?#]/)[0];
    const key = decodeURIComponent(encodedKey);
    const object = await env.PROMPT_IMAGES.get(key);
    if (!object) throw new Error(`Could not load R2 image: ${key}`);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    const buffer = await object.arrayBuffer();
    return {
      buffer,
      contentType: detectImageContentType(buffer, normalizeImageContentType(headers.get('content-type')))
    };
  }

  const response = await fetch(toAbsoluteUrl(imageUrl, env));
  if (!response.ok) throw new Error(`Could not load image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return {
    buffer,
    contentType: detectImageContentType(buffer, normalizeImageContentType(response.headers.get('content-type')))
  };
}

async function storeImage(env, key, buffer, contentType) {
  await env.PROMPT_IMAGES.put(key, buffer, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });
}

function versionedImageKey(prompt, role, extension) {
  const version = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `generated/${safeKey(prompt.slug || prompt.id)}-${role}-${version}.${extension}`;
}

export function assessImagePair(beforeSource, afterSource) {
  const beforeBytes = Number(beforeSource?.buffer?.byteLength || 0);
  const afterBytes = Number(afterSource?.buffer?.byteLength || 0);
  const beforeType = normalizeImageContentType(beforeSource?.contentType);
  const afterType = normalizeImageContentType(afterSource?.contentType);
  const reasons = [];

  if (beforeBytes < 12_000) reasons.push('before image is too small');
  if (afterBytes < 18_000) reasons.push('after image is too small');
  if (!beforeType.startsWith('image/') || !afterType.startsWith('image/')) reasons.push('invalid image type');
  if (beforeBytes && afterBytes && afterBytes < beforeBytes * 0.18) reasons.push('after image has suspiciously low detail');

  const score = Math.max(0, 100
    - (beforeBytes < 12_000 ? 30 : 0)
    - (afterBytes < 18_000 ? 45 : 0)
    - (beforeBytes && afterBytes < beforeBytes * 0.18 ? 30 : 0));

  return {
    passed: reasons.length === 0 && score >= 70,
    score,
    reason: reasons.join('; ') || 'technical quality checks passed'
  };
}

async function persistImageQuality(env, promptId, quality, subjectType, model) {
  await env.DB.prepare(`
    UPDATE prompts
    SET image_quality_status = ?, image_quality_score = ?, image_quality_reason = ?,
        image_subject_type = ?, image_model_used = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    quality.passed ? 'passed' : 'failed',
    quality.score,
    quality.reason,
    subjectType,
    String(model || '').slice(0, 200) || null,
    promptId
  ).run();
}

function toAbsoluteUrl(value, env = {}) {
  const url = String(value || '');
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL).replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function detectImageContentType(buffer, fallback = 'image/png') {
  const bytes = new Uint8Array(buffer.slice(0, 16));

  if (bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47) return 'image/png';

  if (bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff) return 'image/jpeg';

  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';

  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }

  return normalizeImageContentType(fallback);
}

function normalizeImageContentType(value) {
  const type = String(value || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/webp') return 'image/webp';
  if (type === 'image/gif') return 'image/gif';
  return 'image/png';
}

function extensionFromContentType(contentType) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'png';
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function clampNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function clampInteger(value, fallback, minimum, maximum) {
  return Math.round(clampNumber(value, fallback, minimum, maximum));
}

async function setImageStatus(env, promptId, status, error = null) {
  await env.DB.prepare(`
    UPDATE prompts
    SET image_status = ?, image_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, error, promptId).run();
}

function safeKey(value) {
  return String(value || 'prompt')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90) || `prompt-${Date.now()}`;
}
