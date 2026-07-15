const DEFAULT_PUBLIC_ORIGIN = 'https://promptstan-api.hhhh46529.workers.dev';

function cleanOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

const configuredApiOrigin = cleanOrigin(import.meta.env.VITE_API_BASE_URL);
const configuredPublicOrigin = cleanOrigin(import.meta.env.VITE_PUBLIC_SITE_URL);
const currentOrigin = cleanOrigin(window.location.origin);
const isLegacyPagesHost = window.location.hostname.endsWith('.pages.dev');

// The Worker is the canonical application origin. Pages remains a read-only
// compatibility host until its project is redirected or removed.
export const PUBLIC_SITE_ORIGIN = configuredPublicOrigin || DEFAULT_PUBLIC_ORIGIN;
export const API_BASE = configuredApiOrigin
  || (isLegacyPagesHost ? DEFAULT_PUBLIC_ORIGIN : currentOrigin)
  || DEFAULT_PUBLIC_ORIGIN;

export function publicUrl(path = '/') {
  const normalizedPath = String(path || '/');
  return `${PUBLIC_SITE_ORIGIN}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}
