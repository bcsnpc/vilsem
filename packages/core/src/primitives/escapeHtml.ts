// Use only at HTML output boundaries; stored data and canvas labels stay literal.
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))
