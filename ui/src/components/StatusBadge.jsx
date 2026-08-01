import React from 'react'

const variants = {
  connected:  { bg: '#D1FAE5', text: '#065F46', dot: '#1D9E75' },
  fabric:     { bg: '#DBEAFE', text: '#1E3A8A', dot: '#185FA5' },
  cache:      { bg: '#D1FAE5', text: '#065F46', dot: '#1D9E75' },
  error:      { bg: '#FEE2E2', text: '#7F1D1D', dot: '#A32D2D' },
  warning:    { bg: '#FEF3C7', text: '#78350F', dot: '#BA7517' },
  staging:    { bg: '#EDE9FE', text: '#4C1D95', dot: '#7C3AED' },
  writeback:  { bg: '#D1FAE5', text: '#065F46', dot: '#1D9E75' },
  query:      { bg: '#DBEAFE', text: '#1E3A8A', dot: '#185FA5' },
  sp:         { bg: '#E0F2FE', text: '#0C4A6E', dot: '#0284C7' },
  device:     { bg: '#FEF9C3', text: '#713F12', dot: '#CA8A04' },
  default:    { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
}

export default function StatusBadge({ status = 'default', label, dot = true, size = 'sm' }) {
  const v = variants[status] || variants.default
  const px = size === 'sm' ? '6px 10px' : '4px 8px'
  const fs = size === 'sm' ? '11px' : '10px'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: v.bg,
      color: v.text,
      borderRadius: 999,
      padding: px,
      fontSize: fs,
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: v.dot,
          flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  )
}
