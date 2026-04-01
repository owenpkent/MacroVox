import { useState, useCallback } from 'react'
import { ANTHROPIC_API_URL, ANTHROPIC_MODEL, API } from '../config'

interface UsePostProcessingOptions {
  useProxy?: boolean
  githubId?: string
}

export function usePostProcessing({ useProxy = false, githubId }: UsePostProcessingOptions = {}) {
  const [isPostProcessing, setIsPostProcessing] = useState(false)

  const postProcess = useCallback(async (rawTranscript: string): Promise<string | null> => {
    // Check if post-processing is enabled
    const enabled = localStorage.getItem('post_processing_enabled') === 'true'
    if (!enabled) return null

    const context = localStorage.getItem('post_processing_context') || ''

    // Get API key — either from proxy or local storage
    let apiKey: string | null = null
    let useDirectApi = false

    if (useProxy && githubId) {
      // Pro user — use proxy
    } else {
      apiKey = localStorage.getItem('anthropic_api_key')
      if (!apiKey) return null
      useDirectApi = true
    }

    setIsPostProcessing(true)

    try {
      const systemPrompt = `You are a transcript cleanup assistant. Fix speech-to-text errors, add proper punctuation, and clean up the text while preserving the original meaning and tone. Do NOT add any commentary — return only the cleaned transcript.${context ? `\n\nUser context about their speech patterns: ${context}` : ''}`

      if (useDirectApi && apiKey) {
        // Direct Anthropic API call
        const response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: rawTranscript }],
          }),
        })

        if (!response.ok) {
          console.error('[PostProcessing] API error:', response.status)
          return null
        }

        const data = await response.json() as { content?: Array<{ text?: string }> }
        return data.content?.[0]?.text || null
      } else if (useProxy && githubId) {
        // Proxy call
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
      }

      return null
    } catch (error) {
      console.error('[PostProcessing] Error:', error)
      return null
    } finally {
      setIsPostProcessing(false)
    }
  }, [useProxy, githubId])

  return { postProcess, isPostProcessing }
}
