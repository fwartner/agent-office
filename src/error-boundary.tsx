import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, fontFamily: "'Press Start 2P', monospace", color: '#ff8b8b',
          background: '#0b0d12', minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center'
        }}>
          <h1 style={{ fontSize: 14, letterSpacing: '0.1em' }}>Something broke</h1>
          <p style={{ fontSize: 10, color: '#99a3b9', maxWidth: 500, lineHeight: 1.6 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => { this.setState({ error: null }) }}
            style={{
              fontFamily: 'inherit', fontSize: 10, padding: '8px 16px',
              background: '#1a2030', border: '2px solid #3a4a68', color: '#95d8ff', cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
