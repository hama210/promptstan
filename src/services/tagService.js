import { promptItems, tags } from '../data/site.js';

export function getTrendingTags() {
  return tags;
}

export function normalizeTag(tag = '') {
  return tag.replace('#', '').trim().toLowerCase();
}

export function getPromptsByTag(tag) {
  const cleanTag = normalizeTag(tag);
  return promptItems.filter((prompt) =>
    (prompt.tags || []).some((item) => normalizeTag(item) === cleanTag)
  );
}

export function getAllTagsFromPrompts() {
  const tagSet = new Set();
  promptItems.forEach((prompt) => {
    (prompt.tags || []).forEach((tag) => tagSet.add(`#${normalizeTag(tag)}`));
  });
  return [...tagSet];
}
