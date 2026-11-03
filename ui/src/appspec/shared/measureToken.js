// Let the DOM encode both the field attribute and visible label. Field names
// are data, even when they contain quotes, entities, or markup-like characters.
export function measureTokenHtml(name, style, doc = document) {
  const token = doc.createElement('span')
  token.setAttribute('data-measure', String(name))
  token.setAttribute('contenteditable', 'false')
  token.setAttribute('style', style)
  token.textContent = String(name)
  return token.outerHTML + '&nbsp;'
}

export function extractMeasureTokens(html, doc = document) {
  const template = doc.createElement('template')
  template.innerHTML = html || ''
  return [...new Set(Array.from(template.content.querySelectorAll('[data-measure]'), token => token.getAttribute('data-measure')).filter(Boolean))]
}
