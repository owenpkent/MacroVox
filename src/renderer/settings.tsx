/**
 * Entry point for the settings window (settings.html)
 */
import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import { SettingsPanel } from './components/SettingsPanel'
import type { AppUser } from './lib/auth'
import { getUser } from './lib/auth'
import './index.css'

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
    <ThemeProvider>
      <SettingsPanel isOpen={true} onClose={() => window.close()} user={user} isPopup={true} />
    </ThemeProvider>
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
