import { useState, useCallback } from 'react'
import { ANTHROPIC_MODEL, API } from '../config'

interface UsePostProcessingOptions {
  useProxy?: boolean
  githubId?: string
}

export function usePostProcessing({ useProxy = false, githubId }: UsePostProcessingOptions = {}) {
  const [isPostProcessing, setIsPostProcessing] = useState(false)

  const postProcess = useCallback(async (rawTranscript: string): Promise<string | null> => {
    const context = localStorage.getItem('post_processing_context') || ''

    // Managed only — must be a Pro subscriber using the proxy
    if (!useProxy || !githubId) return null

    setIsPostProcessing(true)

    try {
      const systemPrompt = `You are a transcript cleanup assistant. Fix speech-to-text errors, add proper punctuation, and clean up the text while preserving the original meaning and tone. Do NOT add any commentary — return only the cleaned transcript.${context ? `\n\nUser context about their speech patterns: ${context}` : ''}`

      const response = await fetch(API.claudeProxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_id: githubId,
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
  }, [useProxy, githubId])

  return { postProcess, isPostProcessing }
}
