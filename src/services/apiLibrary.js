import { categories as fallbackCategories, promptItems as fallbackPrompts, tags as fallbackTags } from '../data/site.js';

const gradients = ['purple', 'green', 'gold', 'pink', 'blue', 'rose'];

export async function loadLibraryData() {
  try {
    const [categoriesResponse, promptsResponse, tagsResponse] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/prompts'),
      fetch('/api/tags/trending')
    ]);

    if (!categoriesResponse.ok || !promptsResponse.ok) throw new Error('API not ready');

    const [apiCategories, apiPrompts, apiTags] = await Promise.all([
      categoriesResponse.json(),
      promptsResponse.json(),
      tagsResponse.ok ? tagsResponse.json() : Promise.resolve([])
    ]);

    const categories = apiCategories.length ? apiCategories.map(normalizeCategory) : fallbackCategories;
    const prompts = apiPrompts.length ? apiPrompts.map(normalizePrompt) : fallbackPrompts;
    const tags = apiTags.length ? apiTags.map((tag) => tag.name) : fallbackTags;

    return { categories, prompts, tags, source: 'api' };
  } catch (error) {
    return {
      categories: fallbackCategories,
      prompts: fallbackPrompts,
      tags: fallbackTags,
      source: 'static'
    };
  }
}

export async function searchLibrary(query) {
  const term = query.trim();
  if (!term) return null;

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
    if (!response.ok) throw new Error('Search API not ready');
    const prompts = await response.json();
    return prompts.map(normalizePrompt);
  } catch {
    return null;
  }
}

export async function trackPromptAction(id, action) {
  try {
    await fetch(`/api/${action}/${id}`, { method: 'POST' });
  } catch {
    // Keep UI fast even if analytics endpoint is not deployed yet.
  }
}

function normalizeCategory(category) {
  return {
    name: category.name_ku || category.name_en || category.slug,
    icon: category.icon || '📂',
    slug: category.slug,
    count: category.count || 0
  };
}

function normalizePrompt(prompt, index = 0) {
  return {
    id: prompt.id,
    slug: prompt.slug,
    title: prompt.title_ku || prompt.title_en || prompt.title_ar || 'Untitled Prompt',
    category: prompt.category_name || prompt.category || 'پرۆمپت',
    badge: prompt.is_trending ? 'ترێند' : prompt.is_featured ? 'هەڵبژاردە' : 'نوێ',
    views: formatNumber(prompt.views || 0),
    copies: formatNumber(prompt.copies || 0),
    rating: String(prompt.rating || '4.8'),
    imageTitle: prompt.title_en || prompt.title_ku || 'Prompt',
    text: prompt.prompt_text || prompt.text || '',
    gradient: prompt.gradient || gradients[index % gradients.length],
    tags: Array.isArray(prompt.tags) ? prompt.tags.map((tag) => tag.name || tag) : []
  };
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 100) / 10}K`;
  return String(number);
}
