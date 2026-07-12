import { promptItems } from '../src/data/site.js';

export function listFallbackPrompts() {
  return promptItems.map((prompt, index) => normalizeFallbackPrompt(prompt, index));
}

export function getFallbackPrompt(slug) {
  return listFallbackPrompts().find((prompt) => prompt.slug === slug) || null;
}

function normalizeFallbackPrompt(prompt, index) {
  return {
    id: prompt.id || index + 1,
    slug: prompt.slug || `prompt-${prompt.id || index + 1}`,
    title_ku: prompt.title,
    title_en: prompt.imageTitle || prompt.title,
    title_ar: null,
    description_ku: `پرۆمپتی ئامادە بۆ ${prompt.title}`,
    description_en: `Ready-to-use AI photo editing prompt: ${prompt.imageTitle || prompt.title}.`,
    description_ar: null,
    prompt_text: prompt.text,
    category_name: prompt.category,
    rating: Number(prompt.rating || 4.8),
    views: parseMetric(prompt.views),
    copies: parseMetric(prompt.copies),
    is_featured: index === 0 ? 1 : 0,
    is_trending: 1,
    preview_image_url: null,
    before_image_url: null,
    after_image_url: null,
    image_status: 'fallback',
    tags: prompt.tags || []
  };
}

function parseMetric(value) {
  const raw = String(value || '0').trim().toUpperCase();
  const number = Number.parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
  if (raw.endsWith('K')) return Math.round(number * 1000);
  if (raw.endsWith('M')) return Math.round(number * 1000000);
  return Math.round(number);
}
