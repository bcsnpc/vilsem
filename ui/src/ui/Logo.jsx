import React from 'react'

// Semantica brand mark — a compact ascending-bars glyph in the accent color,
// optionally paired with the wordmark in the display font.
export function LogoMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3"  y="13" width="4.2" height="8"  rx="2" fill="var(--accent)" opacity="0.55" />
      <rect x="9.9" y="8"  width="4.2" height="13" rx="2" fill="var(--accent)" opacity="0.78" />
      <rect x="16.8" y="3" width="4.2" height="18" rx="2" fill="var(--accent)" />
    </svg>
  )
}

export function Logo({ size = 22, wordmark = true, fontSize = 15 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      {wordmark && (
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>
          vilsem
        </span>
      )}
    </span>
  )
}
