import React from 'react'

const STYLE_MAP = {
  primary:   { bg: '#3B82F6', border: 'none',               color: '#FFFFFF' },
  secondary: { bg: '#1E293B', border: '1px solid #334155',   color: '#94A3B8' },
  outline:   { bg: 'transparent', border: '1px solid #3B82F6', color: '#3B82F6' },
}

export default function CompactNavButton({ config = {} }) {
  const {
    label = 'Next Page →',
    targetPageId,
    style = 'primary',
    _onNavigatePage,
  } = config

  const s = STYLE_MAP[style] || STYLE_MAP.primary

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        onClick={() => _onNavigatePage?.(targetPageId)}
        style={{
          padding: '8px 20px',
          borderRadius: 6,
          background: s.bg,
          border: s.border,
          color: s.color,
          fontSize: 13,
          fontWeight: 600,
          cursor: _onNavigatePage ? 'pointer' : 'default',
          fontFamily: 'inherit',
          letterSpacing: 0.2,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { if (_onNavigatePage) e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        {label}
      </button>
    </div>
  )
}
