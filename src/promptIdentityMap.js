const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

if (!window.location.pathname.startsWith('/admin')) installPromptIdentityMap();

async function installPromptIdentityMap() {
  const titleToSlug = new Map();

  try {
    const response = await fetch(`${API_BASE}/api/prompts`, { cache: 'no-store' });
    const prompts = response.ok ? await response.json() : [];
    if (Array.isArray(prompts)) {
      for (const prompt of prompts) {
        const slug = cleanSlug(prompt.slug);
        if (!slug) continue;
        for (const title of [prompt.title_ku, prompt.title_en, prompt.title_ar, prompt.title]) {
          const key = normalizeTitle(title);
          if (key) titleToSlug.set(key, slug);
        }
      }
    }
  } catch {}

  const annotate = () => {
    const routeMatch = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
    const routeSlug = routeMatch ? cleanSlug(decodeURIComponent(routeMatch[1])) : '';

    document.querySelectorAll('.promptModal, .promptCard, .feature').forEach((container) => {
      if (container.dataset.promptSlug) return;
      if (container.classList.contains('promptModal') && routeSlug) {
        container.dataset.promptSlug = routeSlug;
        return;
      }
      const title = normalizeTitle(container.querySelector('h2, h3')?.textContent);
      const slug = titleToSlug.get(title);
      if (slug) container.dataset.promptSlug = slug;
    });
  };

  annotate();
  new MutationObserver(annotate).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', annotate);
  window.addEventListener('promptstan:navigation', annotate);
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}
