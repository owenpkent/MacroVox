/**
 * Entry point for the dictation window (dictation.html)
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import { DictationMode } from './components/DictationMode'
import './index.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <DictationMode />
      </ThemeProvider>
    </StrictMode>
  )
}
