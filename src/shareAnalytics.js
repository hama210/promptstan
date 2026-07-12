const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

const SHARE_SELECTOR = '.cardShareButton, .shareWide';

document.addEventListener('click', (event) => {
  const button = event.target.closest?.(SHARE_SELECTOR);
  if (!button) return;

  const container = button.closest('.promptModal, .promptCard, .feature');
  const title = container?.querySelector('h2, h3')?.textContent?.trim() || '';
  const routeMatch = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
  const slug = routeMatch ? decodeURIComponent(routeMatch[1]) : '';
  const payload = JSON.stringify({ slug, title });

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        `${API_BASE}/api/share`,
        new Blob([payload], { type: 'text/plain;charset=UTF-8' })
      );
      if (queued) return;
    }
  } catch {}

  fetch(`${API_BASE}/api/share`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}, true);
