import React from 'react'
import { Columns3, Layers, Database, Clapperboard, Settings } from 'lucide-react'

// Slim left rail — appears once in-session. Panel icons per the mockup.
// Fields = model explorer (wired in Phase 4 canvas), Layers/Data/Story = stubs
// for now (render exactly, no destructive action).
//
// Props: active (string|null), onSelect(key), onSettings(), stub(feature)
export default function LeftRail({ active, onSelect, onSettings, stub }) {
  const panels = [
    { key: 'fields', label: 'Fields', icon: Columns3 },   // semantic model explorer
    { key: 'layers', label: 'Layers', icon: Layers },     // visuals on the active page
    { key: 'data',   label: 'Data',   icon: Database },    // dataset stats
  ]
  return (
    <div style={{
      width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, padding: '8px 0', background: 'var(--v-bg-0)', borderRight: '1px solid var(--v-border)',
    }}>
      {panels.map(p => (
        <RailBtn key={p.key} label={p.label} Icon={p.icon} active={active === p.key}
          onClick={() => onSelect?.(p.key)} />
      ))}
      <div style={{ width: 22, height: 1, background: 'var(--v-border)', margin: '6px 0' }} />
      {/* VILSEM_STUB: story-composer (S12) */}
      <RailBtn label="Stories" Icon={Clapperboard} onClick={() => stub?.('Story composer')} />
      <div style={{ flex: 1 }} />
      <RailBtn label="Settings" Icon={Settings} onClick={onSettings} />
    </div>
  )
}

function RailBtn({ label, Icon, active, onClick }) {
  return (
    <button onClick={onClick} title={label}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--v-surface-3)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      style={{
        width: 34, height: 34, borderRadius: 'var(--v-r-2)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--v-accent-quiet)' : 'transparent',
        color: active ? 'var(--v-accent)' : 'var(--v-text-muted)',
        position: 'relative',
      }}>
      {active && <span style={{ position: 'absolute', left: -8, top: 8, bottom: 8, width: 2, borderRadius: 2, background: 'var(--v-accent)' }} />}
      <Icon size={18} strokeWidth={1.75} />
    </button>
  )
}
