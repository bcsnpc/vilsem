import DOMPurify from 'dompurify'

// Legacy HTML measures need layout, SVG marks and CSS hover/entry animations,
// but never scripts, resource/navigation URLs, forms or arbitrary data hooks.
// Exported by powerbi-dom so the renderer reuses its existing DOMPurify copy.
export function sanitizeMeasureHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'small',
      'sub', 'sup', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'button', 'style', 'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse',
      'line', 'polyline', 'polygon', 'text', 'tspan', 'linearGradient',
      'radialGradient', 'stop', 'clipPath', 'title', 'desc',
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'title', 'role', 'tabindex', 'type',
      'colspan', 'rowspan', 'scope', 'width', 'height', 'viewBox',
      'preserveAspectRatio', 'xmlns', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
      'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'dx', 'dy', 'transform',
      'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
      'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
      'opacity', 'text-anchor', 'dominant-baseline', 'font-family', 'font-size',
      'font-weight', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
      'gradientTransform', 'clip-path', 'clipPathUnits',
      'data-countup', 'data-prefix', 'data-suffix', 'data-sbar-cat',
      'data-sbar-fill', 'data-refline-avg', 'data-refline-tgt',
      'data-axis-idx', 'data-axis-active', 'data-axis-section',
      'data-axis-table', 'data-axis-column', 'data-active-bg',
      'data-active-border', 'data-active-color', 'data-inactive-bg',
      'data-inactive-border', 'data-inactive-color',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
  })
}
