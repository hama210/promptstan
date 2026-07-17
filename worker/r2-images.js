const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function uploadPromptImage(request, env) {
  if (!env.PROMPT_IMAGES) return json({ error: 'R2 bucket is not connected' }, 500);

  const form = await request.formData();
  const file = form.get('file');

  if (!file || typeof file === 'string') return json({ error: 'No image file uploaded' }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'Only JPG, PNG, WEBP, and GIF images are allowed' }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: 'Image is too large. Max size is 5MB.' }, 400);

  const extension = extensionFromType(file.type);
  const key = `prompt-images/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  await env.PROMPT_IMAGES.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  return json({ ok: true, key, url: `/uploads/${key}` });
}

export async function servePromptImage(request, env) {
  if (!env.PROMPT_IMAGES) return json({ error: 'R2 bucket is not connected' }, 500);

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace('/uploads/', ''));
  const object = await env.PROMPT_IMAGES.get(key);

  if (!object) return json({ error: 'Image not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');
  headers.set('cross-origin-resource-policy', 'cross-origin');
  if (object.size) headers.set('content-length', String(object.size));
  headers.set('x-content-type-options', 'nosniff');

  if (request.headers.get('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

function extensionFromType(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  });
}
