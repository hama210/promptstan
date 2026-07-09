import { categories as fallbackCategories, promptItems as fallbackPrompts, tags as fallbackTags } from '../data/site.js';

export async function loadLibraryData() {
  return {
    categories: fallbackCategories,
    prompts: fallbackPrompts,
    tags: fallbackTags,
    source: 'person-edit'
  };
}

export async function searchLibrary() {
  return null;
}

export async function trackPromptAction(id, action) {
  try {
    await fetch(`/api/${action}/${id}`, { method: 'POST' });
  } catch {
    // Keep UI fast even if analytics endpoint is not deployed yet.
  }
}
