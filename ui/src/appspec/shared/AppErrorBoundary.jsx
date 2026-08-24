import React from 'react'

// App-level error boundary. A render error anywhere OUTSIDE a per-visual
// VisualBoundary (the app shell, page tabs, canvas container, page-size math,
// the "+ page" flow, etc.) would otherwise unmount the whole React tree and
// leave a blank white screen. This catches it and shows a recoverable panel
// with the error + a reload, instead of blanking the app.
//
// `resetKey` (optional): when it changes, a caught error is cleared so a
// transient failure recovers on the next good render without a full reload.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] app crashed:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error)
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0b0b12', color: '#E5E7EB', fontFamily: 'Inter, system-ui, sans-serif', padding: 24, zIndex: 99999,
        }}>
          <div style={{ maxWidth: 520, textAlign: 'center' }}>
            <div style={{ fontSize: 40, color: '#F87171', opacity: 0.9, marginBottom: 12 }}>⚠</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, marginBottom: 6 }}>
              The app hit an unexpected error and stopped this view from rendering. Your work isn't lost — try again or reload.
            </div>
            <pre style={{
              fontSize: 11, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8, padding: '10px 12px', margin: '12px 0 16px', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 160, overflow: 'auto',
            }}>{msg}</pre>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ error: null })}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#E5E7EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Try again</button>
              <button
                onClick={() => { try { window.location.reload() } catch { /* ignore */ } }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#818CF8', color: '#0b0b12', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Reload</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
