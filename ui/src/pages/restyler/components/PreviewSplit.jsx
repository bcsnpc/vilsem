import React from 'react'

export default function PreviewSplit() {
  const Box = ({ label }) => (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.02)',
      border: '1px dashed rgba(255,255,255,0.08)',
      borderRadius: 10, padding: 16,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{
        flex: 1, minHeight: 320, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.04))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#475569', fontSize: 11,
      }}>
        Preview renderer wires up in step 6
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 16, padding: 24 }}>
      <Box label="Before" />
      <Box label="After" />
    </div>
  )
}
