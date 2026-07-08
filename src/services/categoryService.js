import { categories } from '../data/site.js';
import { getPromptsByCategory } from './promptService.js';

export function getAllCategories() {
  return categories;
}

export function getCategoryBySlug(slug) {
  return categories.find((category) => category.slug === slug);
}

export function getCategoryStats(slug) {
  const category = getCategoryBySlug(slug);
  if (!category) return null;

  return {
    ...category,
    prompts: getPromptsByCategory(category.name)
  };
}
