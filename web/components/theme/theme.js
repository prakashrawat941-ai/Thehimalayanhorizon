const allowed = new Set(['light', 'dark', 'system']);
export const normalizeTheme = (value) => allowed.has(value) ? value : 'system';
