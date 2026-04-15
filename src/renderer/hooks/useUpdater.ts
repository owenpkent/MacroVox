/**
 * useUpdater — checks for app updates on startup using Tauri's updater plugin.
 *
 * On launch, checks the configured endpoint for a newer version. If one is
 * available, shows a confirmation dialog and downloads + installs it.
 * The app restarts automatically after the update is applied.
 */

import { useState, useEffect, useCallback } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

interface UpdateState {
  checking: boolean
  available: boolean
  downloading: boolean
  version: string | null
  error: string | null
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    available: false,
    downloading: false,
    version: null,
    error: null,
  })

  const checkForUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, checking: true, error: null }))
    try {
      const update = await check()
      if (update) {
        setState(prev => ({
          ...prev,
          checking: false,
          available: true,
          version: update.version,
        }))
        return update
      }
      setState(prev => ({ ...prev, checking: false }))
      return null
    } catch (err) {
      console.warn('[Updater] Check failed:', err)
      setState(prev => ({ ...prev, checking: false, error: String(err) }))
      return null
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    setState(prev => ({ ...prev, downloading: true, error: null }))
    try {
      const update = await check()
      if (!update) return

      await update.downloadAndInstall()
      await relaunch()
    } catch (err) {
      console.warn('[Updater] Download failed:', err)
      setState(prev => ({ ...prev, downloading: false, error: String(err) }))
    }
  }, [])

  // Check on startup (after a short delay to not block initial render)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate()
    }, 5000)
    return () => clearTimeout(timer)
  }, [checkForUpdate])

  return { ...state, checkForUpdate, downloadAndInstall }
}
