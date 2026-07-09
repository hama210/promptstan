import { categories as fallbackCategories, promptItems as fallbackPrompts, tags as fallbackTags } from '../data/site.js';

const API_BASE = 'https://promptstan-api.hhhh46529.workers.dev';
const gradients = ['purple', 'green', 'gold', 'pink', 'blue', 'rose'];

export async function loadLibraryData() {
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

    return {
      categories: apiCategories.length ? apiCategories.map(normalizeCategory) : fallbackCategories,
      prompts: apiPrompts.length ? apiPrompts.map(normalizePrompt) : fallbackPrompts,
      tags: apiTags.length ? apiTags.map((tag) => tag.name) : fallbackTags,
      source: apiPrompts.length ? 'api' : 'static'
    };
  } catch {
    return { categories: fallbackCategories, prompts: fallbackPrompts, tags: fallbackTags, source: 'static' };
  }
}

export async function searchLibrary(query) {
  const term = query.trim();
  if (!term) return null;
  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(term)}`);
    if (!response.ok) throw new Error('Search API not ready');
    const prompts = await response.json();
    return prompts.map(normalizePrompt);
  } catch {
    return null;
  }
}

export async function trackPromptAction(id, action) {
  try {
    await fetch(`${API_BASE}/api/${action}/${id}`, { method: 'POST' });
  } catch {}
}

function normalizeCategory(category) {
  return {
    name: category.name_ku || category.name_en || category.slug,
    icon: category.icon || '👤',
    slug: category.slug,
    count: category.count || 0
  };
}

function normalizePrompt(prompt, index = 0) {
  return {
    id: prompt.id,
    slug: prompt.slug,
    title: prompt.title_ku || prompt.title_en || prompt.title_ar || 'Untitled Prompt',
    category: prompt.category_name || prompt.category || 'دەستکاری کەس',
    badge: prompt.is_trending ? 'ترێند' : prompt.is_featured ? 'هەڵبژاردە' : 'نوێ',
    views: formatNumber(prompt.views || 0),
    copies: formatNumber(prompt.copies || 0),
    rating: String(prompt.rating || '4.8'),
    imageTitle: prompt.title_en || prompt.title_ku || 'Person Edit',
    text: prompt.prompt_text || prompt.text || '',
    previewImage: normalizeImageUrl(prompt.preview_image_url || prompt.previewImage || prompt.image || ''),
    gradient: prompt.gradient || gradients[index % gradients.length],
    tags: Array.isArray(prompt.tags) ? prompt.tags.map((tag) => tag.name || tag) : []
  };
}

function normalizeImageUrl(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  return `${API_BASE}${image.startsWith('/') ? '' : '/'}${image}`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 100) / 10}K`;
  return String(number);
}
