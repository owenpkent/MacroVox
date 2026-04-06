import { useState, useCallback } from 'react'
import { ANTHROPIC_MODEL, API } from '../config'
import { supabase } from '../lib/supabase'

const SYSTEM_PROMPT = `You are an expert writer. Based on the user's spoken request, produce the appropriate written content — an email, a message, a book chapter, meeting notes, a document, or anything else. Infer the format and tone entirely from context. Return only the finished text — no commentary, no preamble, no meta-explanation of what you wrote.`

interface Options {
  useProxy: boolean
  userId?: string
}

export function useAgentiveWriting({ useProxy, userId }: Options) {
  const [isGenerating, setIsGenerating] = useState(false)

  const generate = useCallback(async (command: string): Promise<string | null> => {
    if (!useProxy || !userId) return null

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    setIsGenerating(true)

    const styleProfile = localStorage.getItem('writing_style_profile') || ''
    const systemPrompt = styleProfile
      ? `${SYSTEM_PROMPT}\n\nUser's writing style preferences:\n${styleProfile}`
      : SYSTEM_PROMPT

    try {
      const response = await fetch(API.claudeProxy, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          model: ANTHROPIC_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: command }],
        }),
      })

      if (!response.ok) {
        console.error('[AgentiveWriting] Proxy error:', response.status)
        return null
      }

      const data = await response.json() as { content?: Array<{ text?: string }> }
      return data.content?.[0]?.text || null
    } catch (error) {
      console.error('[AgentiveWriting] Error:', error)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [useProxy, userId])

  return { generate, isGenerating }
}
