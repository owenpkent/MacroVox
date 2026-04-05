/**
 * Entry point for the settings window (settings.html)
 */
import { Component, StrictMode, useState, useEffect } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import { SettingsPanel } from './components/SettingsPanel'
import type { AppUser } from './lib/auth'
import { getUser } from './lib/auth'
import './index.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Settings render error:', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ef4444', background: '#0a0f14', fontFamily: 'monospace', height: '100vh' }}>
          <h2 style={{ color: '#cbd5e1' }}>Settings failed to load</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{this.state.error}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function SettingsApp() {
  const [user, setUser] = useState<AppUser | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await getUser()
        if (result.success && result.user) {
          setUser(result.user)
        }
      } catch {}
    }
    loadUser()
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SettingsPanel isOpen={true} onClose={() => window.close()} user={user} isPopup={true} />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SettingsApp />
    </StrictMode>
  )
}
