// Normalize social URLs so raw usernames/numbers still work.
// Pure functions — keep their exact normalization behavior in sync with the
// raw inputs stored in cafe_settings (full URLs, @handles, bare numbers).

/**
 * Only an *absolute http(s) URL* is passed through verbatim. The previous
 * `startsWith('http')` check let a stored value like `javascript:…` (doesn't
 * match, so it was normalized — fine) but also `httpx://evil` or a bare
 * `http`-prefixed string through as a raw href. Requiring the `https?://`
 * scheme means anything else is normalized into the platform URL instead of
 * being rendered as an arbitrary link — defense-in-depth on admin-sourced
 * values (these render with `rel="noopener"` already).
 */
const isHttpUrl = (val: string): boolean => /^https?:\/\//i.test(val.trim());

export const getInstagramUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  const handle = val.replace(/^@/, '');
  return `https://instagram.com/${handle}`;
};

export const getWhatsAppUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  const digits = val.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
};

export const getTikTokUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  const handle = val.startsWith('@') ? val : `@${val}`;
  return `https://tiktok.com/${handle}`;
};

export const getTelegramUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  const handle = val.replace(/^@/, '');
  return `https://t.me/${handle}`;
};

export const getLineUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  const handle = val.replace(/^@/, '');
  return `https://line.me/R/ti/p/@${handle}`;
};

export const getPhoneUrl = (val: string) => {
  return `tel:${val.replace(/[^0-9+]/g, '')}`;
};

export const ensureUrl = (val: string) => {
  if (isHttpUrl(val)) return val;
  return `https://${val}`;
};
