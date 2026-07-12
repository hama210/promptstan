import { categories as fallbackCategories, promptItems as fallbackPrompts, tags as fallbackTags } from '../data/site.js';

const API_BASE = 'https://promptstan-api.hhhh46529.workers.dev';
const gradients = ['purple', 'green', 'gold', 'pink', 'blue', 'rose'];

export async function loadLibraryData() {
  const staticPrompts = fallbackPrompts.map((prompt, index) => normalizePrompt(prompt, index, 'static'));

  try {
    const promptsResponse = await fetch(`${API_BASE}/api/prompts`);
    if (!promptsResponse.ok) throw new Error('API not ready');
    const apiPrompts = await promptsResponse.json();

    let apiCategories = [];
    let apiTags = [];
    try {
      const categoriesResponse = await fetch(`${API_BASE}/api/categories`);
      apiCategories = categoriesResponse.ok ? await categoriesResponse.json() : [];
    } catch {}
    try {
      const tagsResponse = await fetch(`${API_BASE}/api/tags/trending`);
      apiTags = tagsResponse.ok ? await tagsResponse.json() : [];
    } catch {}

    const livePrompts = Array.isArray(apiPrompts)
      ? apiPrompts.map((prompt, index) => normalizePrompt(prompt, index, 'api'))
      : [];

    return {
      categories: mergeCategories(apiCategories.map(normalizeCategory), fallbackCategories),
      prompts: mergePromptLibraries(livePrompts, staticPrompts),
      tags: mergeTags(apiTags.map((tag) => tag.name), fallbackTags),
      source: livePrompts.length ? 'hybrid' : 'static',
      liveCount: livePrompts.length,
      staticCount: staticPrompts.length
    };
  } catch {
    return {
      categories: fallbackCategories,
      prompts: staticPrompts,
      tags: fallbackTags,
      source: 'static',
      liveCount: 0,
      staticCount: staticPrompts.length
    };
  }
}

export async function getPromptBySlug(slug) {
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return null;

  try {
    const response = await fetch(`${API_BASE}/api/prompts/${encodeURIComponent(safeSlug)}`);
    if (response.ok) return normalizePrompt(await response.json(), 0, 'api');
  } catch {}

  return fallbackPrompts
    .map((prompt, index) => normalizePrompt(prompt, index, 'static'))
    .find((prompt) => prompt.slug === safeSlug) || null;
}

export async function searchLibrary(query) {
  const term = query.trim();
  if (!term) return null;
  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(term)}`);
    if (!response.ok) throw new Error('Search API not ready');
    const prompts = await response.json();
    return Array.isArray(prompts)
      ? prompts.map((prompt, index) => normalizePrompt(prompt, index, 'api'))
      : [];
  } catch {
    return null;
  }
}

export async function trackPromptAction(id, action) {
  if (!id) return;
  try {
    await fetch(`${API_BASE}/api/${action}/${id}`, { method: 'POST' });
  } catch {}
}

function mergePromptLibraries(livePrompts, staticPrompts) {
  const seenSlugs = new Set();
  const merged = [];

  for (const prompt of [...livePrompts, ...staticPrompts]) {
    if (!prompt.slug || seenSlugs.has(prompt.slug)) continue;
    seenSlugs.add(prompt.slug);
    merged.push(prompt);
  }

  return merged;
}

function mergeCategories(liveCategories, staticCategories) {
  const seen = new Set();
  return [...liveCategories, ...staticCategories].filter((category) => {
    const key = category.slug || category.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeTags(liveTags, staticTags) {
  return [...new Set([...liveTags, ...staticTags].filter(Boolean))];
}

function normalizeCategory(category) {
  return {
    name: category.name_ku || category.name_en || category.slug,
    icon: category.icon || '👤',
    slug: category.slug,
    count: category.count || 0
  };
}

export function normalizePrompt(prompt, index = 0, source = 'api') {
  const title = prompt.title_ku || prompt.title_en || prompt.title_ar || prompt.title || 'Untitled Prompt';
  const slug = prompt.slug || `prompt-${prompt.id || index + 1}`;
  const englishTitle = prompt.title_en || prompt.imageTitle || title;
  const beforeImage = normalizeImageUrl(prompt.before_image_url || prompt.beforeImage || '');
  const afterImage = normalizeImageUrl(prompt.after_image_url || prompt.afterImage || '');
  const previewImage = normalizeImageUrl(prompt.preview_image_url || prompt.previewImage || prompt.image || afterImage || '');
  const trackId = source === 'api' ? prompt.id : null;

  return {
    id: prompt.id,
    key: `${source}-${slug}`,
    source,
    trackId,
    slug,
    title,
    category: prompt.category_name || prompt.category || 'دەستکاری کەس',
    badge: prompt.is_trending ? 'ترێند' : prompt.is_featured ? 'هەڵبژاردە' : prompt.badge || 'نوێ',
    views: formatNumber(prompt.views || 0),
    copies: formatNumber(prompt.copies || 0),
    rating: String(prompt.rating || '4.8'),
    imageTitle: englishTitle || 'Person Edit',
    description: prompt.description_ku || prompt.description_en || prompt.description_ar || '',
    text: prompt.prompt_text || prompt.text || '',
    beforeImage,
    afterImage,
    hasBeforeAfter: Boolean(beforeImage && afterImage),
    previewImage,
    gradient: prompt.gradient || gradients[index % gradients.length],
    tags: Array.isArray(prompt.tags) ? prompt.tags.map((tag) => tag.name || tag) : []
  };
}

function normalizeImageUrl(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.includes('/api/preview/')) return '';
  if (/^https?:\/\//i.test(image)) return image;
  return `${API_BASE}${image.startsWith('/') ? '' : '/'}${image}`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 100) / 10}K`;
  return String(number);
}
