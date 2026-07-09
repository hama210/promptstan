const PREVIEW_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': 'public, max-age=86400',
  'access-control-allow-origin': '*'
};

export function autoPreviewPath(slug, title = 'Person Edit') {
  const safeSlug = encodeURIComponent(String(slug || 'person-edit').replace(/\.svg$/i, ''));
  const safeTitle = encodeURIComponent(String(title || 'Person Edit'));
  return `/api/preview/${safeSlug}.svg?title=${safeTitle}`;
}

export function serveAutoPreview(request) {
  const url = new URL(request.url);
  const rawSlug = decodeURIComponent(url.pathname.split('/').pop()?.replace(/\.svg$/i, '') || 'person-edit');
  const title = url.searchParams.get('title') || titleFromSlug(rawSlug);
  const colors = paletteFor(rawSlug);
  const svg = buildBeforeAfterSvg(title, colors);
  return new Response(svg, { headers: PREVIEW_HEADERS });
}

function titleFromSlug(slug) {
  return String(slug || 'person-edit')
    .replace(/^daily-\d{4}-\d{2}-\d{2}-/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function paletteFor(value) {
  const palettes = [
    ['#8b5cf6', '#00f5a0', '#111827'],
    ['#38bdf8', '#ec4899', '#0f172a'],
    ['#f59e0b', '#22c55e', '#18181b'],
    ['#fb7185', '#a78bfa', '#111827'],
    ['#14b8a6', '#f97316', '#0b1120']
  ];
  const hash = String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function buildBeforeAfterSvg(title, [primary, secondary, bg]) {
  const safeTitle = escapeXml(title).slice(0, 72);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Before and after AI prompt preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="0.46" stop-color="#050505"/>
      <stop offset="1" stop-color="${primary}" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="after" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${secondary}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="24" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <circle cx="1030" cy="110" r="180" fill="${secondary}" opacity="0.18" filter="url(#glow)"/>
  <circle cx="160" cy="680" r="240" fill="${primary}" opacity="0.16" filter="url(#glow)"/>

  <text x="600" y="82" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="800">Promptstan AI Edit</text>
  <text x="600" y="130" text-anchor="middle" fill="#d4d4d8" font-family="Arial, sans-serif" font-size="25">${safeTitle}</text>

  <g transform="translate(70 180)">
    <rect width="500" height="520" rx="34" fill="#0f0f13" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
    <text x="34" y="62" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="26" font-weight="800">BEFORE</text>
    <rect x="34" y="96" width="432" height="370" rx="26" fill="#1f2937"/>
    <circle cx="250" cy="206" r="72" fill="#4b5563"/>
    <path d="M120 430c18-96 86-142 130-142s112 46 130 142" fill="#4b5563"/>
    <path d="M70 502h360" stroke="#374151" stroke-width="12" stroke-linecap="round"/>
    <text x="250" y="498" text-anchor="middle" fill="#71717a" font-family="Arial, sans-serif" font-size="22">Original photo</text>
  </g>

  <g transform="translate(630 180)">
    <rect width="500" height="520" rx="34" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.24)" stroke-width="2"/>
    <text x="34" y="62" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="800">AFTER</text>
    <rect x="34" y="96" width="432" height="370" rx="26" fill="url(#after)"/>
    <circle cx="250" cy="206" r="72" fill="rgba(255,255,255,.88)"/>
    <path d="M120 430c18-96 86-142 130-142s112 46 130 142" fill="rgba(255,255,255,.84)"/>
    <path d="M90 366c96-54 226-80 320-40" stroke="rgba(255,255,255,.42)" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M76 126h348" stroke="rgba(255,255,255,.28)" stroke-width="8" stroke-linecap="round"/>
    <text x="250" y="498" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">AI edited result</text>
  </g>

  <rect x="500" y="400" width="200" height="72" rx="36" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.18)"/>
  <text x="600" y="448" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="900">→</text>

  <text x="600" y="750" text-anchor="middle" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="22">Auto generated before / after preview</text>
</svg>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
