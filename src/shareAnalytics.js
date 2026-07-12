const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

const SHARE_SELECTOR = '.cardShareButton, .shareWide, .campaignShareButton';
const COPY_SELECTOR = '.copyButton, .promptBoxHeader button, .featureActions .primary';
const FAVORITE_SELECTOR = '.heartButton, .favoriteWide';
const CAMPAIGN_NAME = 'prompt-share';
const TRACKING_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const ATTRIBUTION_KEY = 'promptstan-growth-attribution';
const ATTRIBUTION_TTL = 7 * 24 * 60 * 60 * 1000;

if (!window.location.pathname.startsWith('/admin')) {
  captureReferralArrival();
  patchNativeShare();
  patchClipboardLinks();
  installCampaignSharePanel();
  installConversionTracking();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.(SHARE_SELECTOR);
  if (!button) return;

  const prompt = readPromptContext(button);
  const source = button.dataset.shareSource || 'native';
  const campaign = button.dataset.campaign || CAMPAIGN_NAME;

  sendEvent('/api/share', {
    slug: prompt.slug,
    title: prompt.title,
    source,
    campaign
  });
}, true);

function captureReferralArrival() {
  const url = new URL(window.location.href);
  const source = cleanToken(url.searchParams.get('utm_source') || url.searchParams.get('ref') || inferSource(document.referrer));
  const campaign = cleanToken(url.searchParams.get('utm_campaign') || (source ? CAMPAIGN_NAME : ''));
  const medium = cleanToken(url.searchParams.get('utm_medium') || inferMedium(source));
  const routeMatch = url.pathname.match(/^\/prompt\/([^/]+)\/?$/);
  const slug = cleanToken(url.searchParams.get('utm_content') || (routeMatch ? decodeURIComponent(routeMatch[1]) : ''));
  const hasExplicitTracking = TRACKING_KEYS.some((key) => url.searchParams.has(key));
  const hasExternalReferrer = document.referrer && !document.referrer.startsWith(window.location.origin);

  if (!hasExplicitTracking && !hasExternalReferrer) return;

  const attribution = {
    source: source || 'other-referral',
    medium: medium || 'referral',
    campaign: campaign || 'uncategorized',
    slug,
    created_at: Date.now(),
    expires_at: Date.now() + ATTRIBUTION_TTL
  };
  saveAttribution(attribution);

  const key = `promptstan-referral:${attribution.source}:${attribution.campaign}:${slug || 'site'}`;
  let duplicate = false;
  try {
    duplicate = Boolean(sessionStorage.getItem(key));
    sessionStorage.setItem(key, '1');
  } catch {}

  if (!duplicate) {
    sendEvent('/api/referral-event', {
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      slug,
      referrer: document.referrer || ''
    });
  }

  if (hasExplicitTracking) {
    for (const keyName of TRACKING_KEYS) url.searchParams.delete(keyName);
    window.setTimeout(() => {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }, 250);
  }
}

function installConversionTracking() {
  patchHistoryNavigation();

  const trackCurrentPromptView = () => {
    const prompt = readPromptContext(document.body);
    if (!prompt.slug) return;

    const key = `promptstan-view:${prompt.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}

    sendConversion('view', prompt);
  };

  let timer = null;
  const scheduleViewTracking = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(trackCurrentPromptView, 80);
  };

  window.addEventListener('popstate', scheduleViewTracking);
  window.addEventListener('promptstan:navigation', scheduleViewTracking);
  new MutationObserver(scheduleViewTracking).observe(document.body, { childList: true, subtree: true });
  scheduleViewTracking();

  document.addEventListener('click', (event) => {
    const copyButton = event.target.closest?.(COPY_SELECTOR);
    if (copyButton) {
      sendConversion('copy', readPromptContext(copyButton));
      return;
    }

    const favoriteButton = event.target.closest?.(FAVORITE_SELECTOR);
    if (favoriteButton && !favoriteButton.classList.contains('active')) {
      sendConversion('favorite', readPromptContext(favoriteButton));
    }
  }, true);
}

function sendConversion(eventType, prompt) {
  const attribution = getAttribution();
  sendEvent('/api/conversion-event', {
    event_type: eventType,
    slug: prompt.slug,
    title: prompt.title,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign
  });
}

function readPromptContext(element) {
  const container = element?.closest?.('.promptModal, .promptCard, .feature') || document.querySelector('.promptModal') || element;
  const routeMatch = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
  const slug = cleanToken(
    element?.dataset?.promptSlug
      || container?.dataset?.promptSlug
      || (routeMatch ? decodeURIComponent(routeMatch[1]) : '')
  );
  const title = container?.querySelector?.('h2, h3')?.textContent?.trim()
    || document.querySelector('.promptModal h2')?.textContent?.trim()
    || document.title.replace(/\s*\|\s*Promptstan.*$/i, '').trim()
    || '';
  return { slug, title };
}

function saveAttribution(value) {
  try {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {}
}

function getAttribution() {
  const fallback = { source: 'direct', medium: 'organic', campaign: 'uncategorized' };
  let raw = '';
  try {
    raw = sessionStorage.getItem(ATTRIBUTION_KEY) || localStorage.getItem(ATTRIBUTION_KEY) || '';
  } catch {}
  if (!raw) return fallback;

  try {
    const value = JSON.parse(raw);
    if (Number(value.expires_at || 0) < Date.now()) {
      try {
        localStorage.removeItem(ATTRIBUTION_KEY);
        sessionStorage.removeItem(ATTRIBUTION_KEY);
      } catch {}
      return fallback;
    }
    return {
      source: cleanToken(value.source) || fallback.source,
      medium: cleanToken(value.medium) || fallback.medium,
      campaign: cleanToken(value.campaign) || fallback.campaign
    };
  } catch {
    return fallback;
  }
}

function patchHistoryNavigation() {
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method];
    if (typeof original !== 'function' || original.__promptstanTracked) continue;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event('promptstan:navigation'));
      return result;
    };
    wrapped.__promptstanTracked = true;
    try { window.history[method] = wrapped; } catch {}
  }
}

function patchNativeShare() {
  if (typeof navigator.share !== 'function' || navigator.share.__promptstanTracked) return;

  const originalShare = navigator.share.bind(navigator);
  const trackedShare = async (data = {}) => {
    const trackedUrl = addTrackingToUrl(data.url, 'native', 'native-share', CAMPAIGN_NAME);
    return originalShare({ ...data, url: trackedUrl || data.url });
  };
  trackedShare.__promptstanTracked = true;

  try {
    navigator.share = trackedShare;
  } catch {
    try {
      Object.defineProperty(navigator, 'share', { configurable: true, value: trackedShare });
    } catch {}
  }
}

function patchClipboardLinks() {
  if (!navigator.clipboard?.writeText || navigator.clipboard.writeText.__promptstanTracked) return;

  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  const trackedWriteText = async (value) => {
    const tracked = addTrackingToUrl(value, 'copy', 'copy', CAMPAIGN_NAME);
    return originalWriteText(tracked || value);
  };
  trackedWriteText.__promptstanTracked = true;

  try {
    navigator.clipboard.writeText = trackedWriteText;
  } catch {}
}

function installCampaignSharePanel() {
  const render = () => {
    document.querySelectorAll('.promptModal .modalContent').forEach((content) => {
      if (content.querySelector('.campaignSharePanel')) return;

      const routeMatch = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
      const slug = routeMatch ? decodeURIComponent(routeMatch[1]) : '';
      if (!slug) return;

      const title = content.querySelector('h2')?.textContent?.trim() || 'Promptstan Prompt';
      const panel = document.createElement('div');
      panel.className = 'campaignSharePanel';
      panel.innerHTML = '<strong>Share directly</strong><div class="campaignShareGrid"></div>';
      const grid = panel.querySelector('.campaignShareGrid');

      const channels = [
        { source: 'whatsapp', label: 'WhatsApp', icon: '🟢' },
        { source: 'telegram', label: 'Telegram', icon: '✈️' },
        { source: 'facebook', label: 'Facebook', icon: '🔵' },
        { source: 'copy', label: 'Copy link', icon: '🔗' }
      ];

      for (const channel of channels) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `campaignShareButton ${channel.source}`;
        button.dataset.shareSource = channel.source;
        button.dataset.promptSlug = slug;
        button.dataset.campaign = CAMPAIGN_NAME;
        button.textContent = `${channel.icon} ${channel.label}`;
        button.addEventListener('click', () => shareToChannel(channel.source, slug, title));
        grid.appendChild(button);
      }

      const actions = content.querySelector('.modalActionRow');
      if (actions) actions.insertAdjacentElement('afterend', panel);
      else content.appendChild(panel);
    });
  };

  render();
  new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', render);
  window.addEventListener('promptstan:navigation', render);
}

function shareToChannel(source, slug, title) {
  const medium = source === 'copy' ? 'copy' : 'social';
  const trackedUrl = buildPromptUrl(slug, source, medium, CAMPAIGN_NAME);
  const text = `${title}\n${trackedUrl}`;

  if (source === 'copy') {
    navigator.clipboard?.writeText(trackedUrl).catch(() => fallbackCopy(trackedUrl));
    return;
  }

  const targets = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(trackedUrl)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl)}`
  };

  const target = targets[source];
  if (target) window.open(target, '_blank', 'noopener,noreferrer');
}

function buildPromptUrl(slug, source, medium, campaign) {
  const url = new URL(`/prompt/${encodeURIComponent(slug)}`, window.location.origin);
  applyTracking(url, source, medium, campaign, slug);
  return url.toString();
}

function addTrackingToUrl(value, source, medium, campaign) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.startsWith('/prompt/')) return raw;
    const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    applyTracking(url, source, medium, campaign, slug);
    return url.toString();
  } catch {
    return raw;
  }
}

function applyTracking(url, source, medium, campaign, slug) {
  url.searchParams.set('ref', source);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  if (slug) url.searchParams.set('utm_content', slug);
}

function sendEvent(path, data) {
  const payload = JSON.stringify(data);

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        `${API_BASE}${path}`,
        new Blob([payload], { type: 'text/plain;charset=UTF-8' })
      );
      if (queued) return;
    }
  } catch {}

  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function inferSource(referrer) {
  const raw = String(referrer || '').toLowerCase();
  if (/whatsapp|wa\.me/.test(raw)) return 'whatsapp';
  if (/telegram|t\.me/.test(raw)) return 'telegram';
  if (/facebook|fb\.com/.test(raw)) return 'facebook';
  if (/instagram/.test(raw)) return 'instagram';
  if (/tiktok/.test(raw)) return 'tiktok';
  if (/twitter|x\.com|t\.co/.test(raw)) return 'x';
  if (/google/.test(raw)) return 'google';
  return raw ? 'other-referral' : '';
}

function inferMedium(source) {
  if (['whatsapp', 'telegram', 'facebook', 'instagram', 'tiktok', 'x'].includes(source)) return 'social';
  if (source === 'copy') return 'copy';
  if (source === 'native') return 'native-share';
  return source ? 'referral' : '';
}

function cleanToken(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function fallbackCopy(value) {
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}
