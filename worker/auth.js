const encoder = new TextEncoder();

export async function isAdminRequest(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const secret = String(env.ADMIN_TOKEN || '');

  if (!token || !secret || token.length !== secret.length) return false;
  return crypto.subtle.timingSafeEqual(encoder.encode(token), encoder.encode(secret));
}
