import React from 'react'
import { Card } from '../ui/Surface.jsx'
import { Logo } from '../ui/Logo.jsx'
import { Spinner } from '../ui/Feedback.jsx'
import { CircleCheck, Loader2 } from '../ui/icons.js'

const STEPS = [
  { id: 'auth',      label: 'Authenticating with Fabric' },
  { id: 'measures',  label: 'Loading measure metadata' },
  { id: 'lakehouse', label: 'Discovering lakehouse' },
  { id: 'ready',     label: 'Engine ready' },
]

export default function Connect({ step = 0 }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-base)', height: '100%',
    }}>
      <Card style={{ padding: '40px 48px', minWidth: 380, textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Logo size={30} fontSize={20} />
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 28 }}>
          Microsoft Fabric query engine
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Spinner size={28} />
        </div>

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            const color = done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--text-faint)'
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', color, fontSize: 'var(--fs-body)' }}>
                <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>
                  {done
                    ? <CircleCheck size={15} />
                    : active
                      ? <Loader2 size={15} style={{ animation: 'sx-spin 0.8s linear infinite' }} />
                      : <span style={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid currentColor' }} />}
                </span>
                {s.label}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
