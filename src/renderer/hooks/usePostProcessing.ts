import { useState, useCallback } from 'react'
import { ANTHROPIC_MODEL, API } from '../config'
import { supabase } from '../lib/supabase'

interface UsePostProcessingOptions {
  useProxy?: boolean
  userId?: string
}

export function usePostProcessing({ useProxy = false, userId }: UsePostProcessingOptions = {}) {
  const [isPostProcessing, setIsPostProcessing] = useState(false)

  const postProcess = useCallback(async (rawTranscript: string): Promise<string | null> => {
    const context = localStorage.getItem('post_processing_context') || ''

    // Managed only — must be a Pro subscriber using the proxy
    if (!useProxy || !userId) return null

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    setIsPostProcessing(true)

    try {
      const systemPrompt = `You are a transcript cleanup assistant. Fix speech-to-text errors, add proper punctuation, and clean up the text while preserving the original meaning and tone. Do NOT add any commentary — return only the cleaned transcript.${context ? `\n\nUser context about their speech patterns: ${context}` : ''}`

      const response = await fetch(API.claudeProxy, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: rawTranscript }],
        }),
      })

      if (!response.ok) {
        console.error('[PostProcessing] Proxy error:', response.status)
        return null
      }

      const data = await response.json() as { content?: Array<{ text?: string }> }
      return data.content?.[0]?.text || null
    } catch (error) {
      console.error('[PostProcessing] Error:', error)
      return null
    } finally {
      setIsPostProcessing(false)
    }
  }, [useProxy, userId])

  return { postProcess, isPostProcessing }
}
