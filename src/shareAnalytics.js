const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

const SHARE_SELECTOR = '.cardShareButton, .shareWide, .campaignShareButton';
const CAMPAIGN_NAME = 'prompt-share';
const TRACKING_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

if (!window.location.pathname.startsWith('/admin')) {
  captureReferralArrival();
  patchNativeShare();
  patchClipboardLinks();
  installCampaignSharePanel();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.(SHARE_SELECTOR);
  if (!button) return;

  const container = button.closest('.promptModal, .promptCard, .feature');
  const title = container?.querySelector('h2, h3')?.textContent?.trim() || '';
  const routeMatch = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
  const slug = button.dataset.promptSlug || (routeMatch ? decodeURIComponent(routeMatch[1]) : '');
  const source = button.dataset.shareSource || 'native';
  const campaign = button.dataset.campaign || CAMPAIGN_NAME;

  sendEvent('/api/share', { slug, title, source, campaign });
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

  const key = `promptstan-referral:${source || 'other'}:${campaign || 'uncategorized'}:${slug || 'site'}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {}

  sendEvent('/api/referral-event', {
    source: source || 'other-referral',
    medium: medium || 'referral',
    campaign: campaign || 'uncategorized',
    slug,
    referrer: document.referrer || ''
  });

  if (hasExplicitTracking) {
    for (const keyName of TRACKING_KEYS) url.searchParams.delete(keyName);
    window.setTimeout(() => {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }, 250);
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
