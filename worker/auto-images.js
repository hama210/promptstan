const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_PUBLIC_BASE_URL = 'https://promptstan-api.hhhh46529.workers.dev';

export async function ensurePromptImageColumns(env) {
  const columns = [
    'ALTER TABLE prompts ADD COLUMN before_image_url TEXT',
    'ALTER TABLE prompts ADD COLUMN after_image_url TEXT',
    'ALTER TABLE prompts ADD COLUMN image_status TEXT DEFAULT "pending"',
    'ALTER TABLE prompts ADD COLUMN image_error TEXT'
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
  if (!force && prompt.before_image_url && prompt.after_image_url) {
    await setImageStatus(env, prompt.id, 'ready', null);
    return {
      ok: true,
      skipped: true,
      before_image_url: prompt.before_image_url,
      after_image_url: prompt.after_image_url
    };
  }

  if (!env.PROMPT_IMAGES) {
    const message = 'PROMPT_IMAGES R2 binding is missing';
    await setImageStatus(env, prompt.id, 'failed', message);
    return { ok: false, error: message };
  }

  const claimed = await claimImageJob(env, prompt.id);
  if (!claimed) {
    return { ok: true, skipped: true, reason: 'Image generation is already running' };
  }

  try {
    const title = prompt.title_en || prompt.title_ku || prompt.slug || 'Person Edit';
    let beforeImageUrl = prompt.before_image_url || null;
    let beforeSource;

    if (beforeImageUrl) {
      beforeSource = await loadImageSource(beforeImageUrl, env);
    } else {
      beforeSource = {
        buffer: await generateBeforeImage(env, prompt, title),
        contentType: 'image/png'
      };
      const beforeKey = `generated/${safeKey(prompt.slug || prompt.id)}-before.png`;
      await storeImage(env, beforeKey, beforeSource.buffer, beforeSource.contentType);
      beforeImageUrl = `/uploads/${beforeKey}`;
    }

    let afterImageUrl = prompt.after_image_url || null;
    if (force || !afterImageUrl) {
      const afterBuffer = await generateAfterImage(env, prompt, title, beforeSource);
      const afterKey = `generated/${safeKey(prompt.slug || prompt.id)}-after.png`;
      await storeImage(env, afterKey, afterBuffer, 'image/png');
      afterImageUrl = `/uploads/${afterKey}`;
    }

    await env.DB.prepare(`
      UPDATE prompts
      SET before_image_url = ?, after_image_url = ?, image_status = ?, image_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(beforeImageUrl, afterImageUrl, 'ready', prompt.id).run();

    return { ok: true, before_image_url: beforeImageUrl, after_image_url: afterImageUrl };
  } catch (error) {
    const message = String(error?.message || error || 'Image generation failed');
    await setImageStatus(env, prompt.id, 'failed', message);
    return { ok: false, error: message };
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

async function generateBeforeImage(env, prompt, title) {
  return callOpenAIImageGeneration(env, buildBeforePrompt(prompt, title));
}

async function generateAfterImage(env, prompt, title, beforeSource) {
  const editPrompt = buildAfterPrompt(prompt, title);
  try {
    return await callOpenAIImageEdit(env, beforeSource, editPrompt);
  } catch (editError) {
    console.warn(JSON.stringify({ event: 'prompt_image_edit_fallback', prompt_id: prompt.id, error: String(editError?.message || editError) }));
    return callOpenAIImageGeneration(env, `${editPrompt}\n\nCreate the final edited result as a realistic high quality photo.`);
  }
}

function buildBeforePrompt(prompt, title) {
  const category = String(prompt.category_slug || '').toLowerCase();
  const text = `${title} ${prompt.prompt_text || ''}`.toLowerCase();

  if (category.includes('couple') || text.includes('two people') || text.includes('couple')) {
    return 'Realistic simple unedited casual photo of two adult people standing together, neutral clothes, natural daylight, plain background, phone camera look, no cinematic effects, no rain, no luxury styling.';
  }

  if (category.includes('kurdish') || text.includes('kurdish')) {
    return 'Realistic simple unedited photo of one Kurdish adult person in normal everyday clothes, natural daylight, plain background, phone camera look, before transformation.';
  }

  if (category.includes('outfit') || text.includes('suit') || text.includes('clothes')) {
    return 'Realistic simple unedited full body photo of one adult person wearing casual clothes, natural pose, plain background, phone camera look, before outfit transformation.';
  }

  if (category.includes('movie') || text.includes('cinematic') || text.includes('movie')) {
    return 'Realistic simple unedited portrait photo of one adult person, neutral expression, normal clothes, natural daylight, plain background, phone camera look, before cinematic transformation.';
  }

  if (text.includes('woman') || text.includes('girl') || text.includes('female')) {
    return 'Realistic simple unedited portrait photo of one adult woman, natural daylight, plain background, phone camera look, no makeup transformation, before AI edit.';
  }

  return 'Realistic simple unedited portrait photo of one adult man, natural daylight, plain background, phone camera look, neutral clothes, before AI edit.';
}

function buildAfterPrompt(prompt, title) {
  return `Use the input before photo as the source image. Apply this PromptStan prompt as the final edit while preserving the same person's identity, realistic human anatomy, and a natural photo look. Title: ${title}. Prompt: ${prompt.prompt_text || title}. High quality, realistic, sharp face details, natural lighting, no text, no watermark.`;
}

async function callOpenAIImageGeneration(env, prompt) {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getOpenAIKey(env)}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
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
  form.append('model', env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('size', env.OPENAI_IMAGE_SIZE || '1024x1024');
  form.append('n', '1');
  form.append('image', new File([imageSource.buffer], `before.${extensionFromContentType(contentType)}`, { type: contentType }));

  const response = await fetch(OPENAI_EDITS_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${getOpenAIKey(env)}` },
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
  const response = await fetch(toAbsoluteUrl(value, env));
  if (!response.ok) throw new Error(`Could not load image: ${response.status}`);
  return {
    buffer: await response.arrayBuffer(),
    contentType: normalizeImageContentType(response.headers.get('content-type'))
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

function toAbsoluteUrl(value, env = {}) {
  const url = String(value || '');
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL).replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
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

function getOpenAIKey(env) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY Cloudflare secret is missing');
  return env.OPENAI_API_KEY;
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
