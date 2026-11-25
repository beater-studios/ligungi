import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Temporary: logs what Discord's Activity proxy sends, to settle how to tell its requests apart and what to rate
 * limit them by (Discord does not document its headers). On only with LOG_ACTIVITY_PROBE=true; remove once settled.
 */

/** Keeps the network part of an address: enough to recognize Cloudflare's or Discord's ranges, not a person. */
export const maskIp = (value: string): string => {
  const ip = value.trim();
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:…`;
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : '?';
};

const one = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? value.join(',') : (value ?? null));

const masked = (value: string | string[] | undefined): string | null => {
  const text = one(value);
  return text === null ? null : text.split(',').map(maskIp).join(', ');
};

/** Whether a request may have come through the Activity proxy, broadly, so nothing from it is missed. */
const fromProxy = (req: IncomingMessage, activityOrigin: string | null): boolean => {
  const h = req.headers;
  return (
    h['cf-worker'] !== undefined ||
    h['x-ligungi-activity'] !== undefined ||
    (activityOrigin !== null && h.origin === activityOrigin) ||
    String(h.host ?? '').endsWith('.discordsays.com') ||
    String(h.referer ?? '').includes('.discordsays.com')
  );
};

export const probeActivity = (
  req: IncomingMessage,
  res: ServerResponse | null,
  activityOrigin: string | null,
  hasSession: boolean,
): void => {
  if (!fromProxy(req, activityOrigin)) return;
  const h = req.headers;
  const line = {
    kind: res ? 'http' : 'ws',
    method: req.method,
    path: (req.url ?? '/').split('?')[0],
    query: [...new URL(req.url ?? '/', 'http://x').searchParams.keys()],
    host: one(h.host),
    origin: one(h.origin),
    referer: one(h.referer)?.split('?')[0] ?? null,
    cfWorker: one(h['cf-worker']),
    cfConnectingIp: masked(h['cf-connecting-ip']),
    xForwardedFor: masked(h['x-forwarded-for']),
    xRealIp: masked(h['x-real-ip']),
    trueClientIp: masked(h['true-client-ip']),
    secFetchDest: one(h['sec-fetch-dest']),
    secFetchSite: one(h['sec-fetch-site']),
    activityHeader: one(h['x-ligungi-activity']),
    sessionCookie: hasSession,
    headerNames: Object.keys(h).sort(),
  };
  if (!res) {
    console.log('[activity-probe]', JSON.stringify(line));
    return;
  }
  res.on('finish', () => {
    const cookie = res.getHeader('set-cookie');
    // The cookie's attributes only, never its value.
    const setCookie = cookie === undefined ? null : String(cookie).replace(/^([^=]+)=[^;]*/, '$1=…');
    console.log('[activity-probe]', JSON.stringify({ ...line, status: res.statusCode, setCookie }));
  });
};
