// Normalize social URLs so raw usernames/numbers still work.
// Pure functions — keep their exact normalization behavior in sync with the
// raw inputs stored in cafe_settings (full URLs, @handles, bare numbers).

export const getInstagramUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  const handle = val.replace(/^@/, '');
  return `https://instagram.com/${handle}`;
};

export const getWhatsAppUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  const digits = val.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
};

export const getTikTokUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  const handle = val.startsWith('@') ? val : `@${val}`;
  return `https://tiktok.com/${handle}`;
};

export const getTelegramUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  const handle = val.replace(/^@/, '');
  return `https://t.me/${handle}`;
};

export const getLineUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  const handle = val.replace(/^@/, '');
  return `https://line.me/R/ti/p/@${handle}`;
};

export const getPhoneUrl = (val: string) => {
  return `tel:${val.replace(/[^0-9+]/g, '')}`;
};

export const ensureUrl = (val: string) => {
  if (val.startsWith('http')) return val;
  return `https://${val}`;
};
