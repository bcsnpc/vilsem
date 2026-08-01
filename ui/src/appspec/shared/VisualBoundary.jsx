import React from 'react'

// Per-visual error boundary. A single visual that throws during render must never
// blank the whole dashboard — it shows a small error card instead, and logs the
// cause. Resets when `resetKey` changes (e.g. new data/spec) so a transient error
// clears on the next good render.
export default class VisualBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[VisualBoundary] visual crashed:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 12, boxSizing: 'border-box', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: '#F87171' }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Visual error</div>
            <div style={{ opacity: 0.8, wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
