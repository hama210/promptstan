import { promptItems } from '../data/site.js';

export function getAllPrompts() {
  return promptItems;
}

export function searchPrompts(query = '') {
  const term = query.trim().toLowerCase().replace('#', '');
  if (!term) return promptItems;

  return promptItems.filter((prompt) => {
    const searchable = [
      prompt.title,
      prompt.category,
      prompt.text,
      ...(prompt.tags || [])
    ].join(' ').toLowerCase();

    return searchable.includes(term);
  });
}

export function getPromptById(id) {
  return promptItems.find((prompt) => String(prompt.id) === String(id));
}

export function getTrendingPrompts(limit = 6) {
  return [...promptItems]
    .sort((a, b) => Number.parseFloat(b.rating || 0) - Number.parseFloat(a.rating || 0))
    .slice(0, limit);
}

export function getPromptsByCategory(categoryName) {
  return promptItems.filter((prompt) => prompt.category === categoryName);
}
