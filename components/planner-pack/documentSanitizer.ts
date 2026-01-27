import createDOMPurify from 'dompurify';

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sanitizeHtml = (html: string) => {
  if (typeof window === 'undefined') {
    return escapeHtml(html);
  }
  const purifier = createDOMPurify(window as unknown as Window);
  return purifier.sanitize(html, { USE_PROFILES: { html: true } });
};
