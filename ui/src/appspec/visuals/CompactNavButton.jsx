import React from 'react'

// Web-style navigation button. Targets: another page, an in-app popup (modal) showing a
// page's content, or an external URL. Fully styled (variant / size / colour / icon).
const SIZES = {
  sm: { padding: '5px 12px', fontSize: 12 },
  md: { padding: '8px 18px', fontSize: 13 },
  lg: { padding: '11px 24px', fontSize: 15 },
}

export default function CompactNavButton({ config = {} }) {
  const {
    label = 'Button',
    navTarget = 'page',          // 'page' | 'modal' | 'url' | 'filter'
    targetPageId,
    modalPageId,
    url,
    filterColumn, filterValue, filterMode = 'toggle',   // 'toggle' | 'set' | 'clear'
    variant = 'primary',         // primary | secondary | outline | ghost
    size = 'md',
    align = 'center',
    fullWidth = false,
    color,                       // accent override
    icon,
    _onNavigatePage,
    _onOpenModal,
    _onApplyFilter,
  } = config

  const accent = color || '#3B82F6'
  const variants = {
    primary:   { background: accent, border: `1px solid ${accent}`, color: '#fff' },
    secondary: { background: 'rgba(148,163,184,0.14)', border: '1px solid rgba(148,163,184,0.3)', color: 'inherit' },
    outline:   { background: 'transparent', border: `1px solid ${accent}`, color: accent },
    ghost:     { background: 'transparent', border: '1px solid transparent', color: accent },
  }
  const v = variants[variant] || variants.primary
  const sz = SIZES[size] || SIZES.md

  const active =
    (navTarget === 'url' && !!url) ||
    (navTarget === 'modal' && !!_onOpenModal && !!modalPageId) ||
    (navTarget === 'filter' && !!_onApplyFilter && (filterMode === 'clear' || !!filterColumn)) ||
    (navTarget === 'page' && !!_onNavigatePage && !!targetPageId)

  const handleClick = () => {
    if (navTarget === 'url') { if (url) window.open(url, '_blank', 'noopener,noreferrer'); return }
    if (navTarget === 'modal') { if (modalPageId) _onOpenModal?.(modalPageId); return }
    if (navTarget === 'filter') { _onApplyFilter?.({ column: filterColumn, value: filterValue, mode: filterMode }); return }
    if (targetPageId) _onNavigatePage?.(targetPageId)
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center' }}>
      <button
        onClick={handleClick}
        disabled={!active}
        style={{
          ...sz, ...v,
          width: fullWidth ? '100%' : 'auto',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          borderRadius: config.borderRadius ?? 8,
          fontWeight: 600, fontFamily: 'inherit', letterSpacing: 0.2,
          cursor: active ? 'pointer' : 'default',
          opacity: active ? 1 : 0.55,
          transition: 'opacity .15s, filter .15s, transform .05s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (active) e.currentTarget.style.filter = 'brightness(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
        onMouseDown={e => { if (active) e.currentTarget.style.transform = 'translateY(1px)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'none' }}
      >
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </button>
    </div>
  )
}
