import React from 'react'

// Canvas object — an image from a URL or data URI. No data.
export default function CompactImage({ config = {} }) {
  const c = config
  const t = c._T || {}
  if (!c.imageUrl) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${t.CARD_BORDER || 'rgba(255,255,255,0.18)'}`, borderRadius: c.borderRadius ?? 8, color: t.textMuted || '#94A3B8', fontSize: 11, textAlign: 'center', padding: 8, boxSizing: 'border-box' }}>
        Add an image URL in the inspector
      </div>
    )
  }
  return (
    <img
      src={c.imageUrl}
      alt={c.alt || ''}
      style={{ width: '100%', height: '100%', objectFit: c.fit || 'contain', objectPosition: 'center', borderRadius: c.borderRadius ?? 8, opacity: c.opacity ?? 1, display: 'block' }}
      onError={(e) => { e.currentTarget.style.opacity = '0.25' }}
    />
  )
}

CompactImage.schema = [
  { key: 'imageUrl',     label: 'Image',       type: 'imageUpload', default: '', group: 'Image' },
  { key: 'fit',          label: 'Fit',         type: 'select', default: 'contain',
    options: [{ label: 'Contain', value: 'contain' }, { label: 'Cover', value: 'cover' }, { label: 'Fill', value: 'fill' }], group: 'Image' },
  { key: 'borderRadius', label: 'Corner radius', type: 'range', default: 8, min: 0, max: 60, step: 1, group: 'Image' },
  { key: 'opacity',      label: 'Opacity',     type: 'range',  default: 1, min: 0.1, max: 1, step: 0.05, group: 'Image' },
  { key: 'alt',          label: 'Alt text',    type: 'text',   default: '', group: 'Image' },
]
