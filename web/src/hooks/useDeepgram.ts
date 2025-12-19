import { useState, useRef, useCallback } from 'react'

interface UseDeepgramOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  apiKey?: string
}

export function useDeepgram({ onTranscript, apiKey }: UseDeepgramOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startListening = useCallback(async () => {
    const key = apiKey || localStorage.getItem('deepgram_api_key')
    
    if (!key) {
      const userKey = prompt('Enter your Deepgram API key:')
      if (!userKey) return
      localStorage.setItem('deepgram_api_key', userKey)
    }
    
    const finalKey = key || localStorage.getItem('deepgram_api_key')
    if (!finalKey) return

    setIsConnecting(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      streamRef.current = stream

      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&endpointing=300`,
        ['token', finalKey]
      )

      socket.onopen = () => {
        console.log('Deepgram connected')
        setIsConnecting(false)
        setIsListening(true)

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        }

        mediaRecorder.start(250)
        mediaRecorderRef.current = mediaRecorder
      }

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const transcript = data.channel?.alternatives?.[0]?.transcript
        if (transcript) {
          onTranscript(transcript, data.is_final)
        }
      }

      socket.onerror = (error) => {
        console.error('Deepgram error:', error)
        setIsConnecting(false)
        setIsListening(false)
      }

      socket.onclose = () => {
        console.log('Deepgram disconnected')
        setIsListening(false)
      }

      socketRef.current = socket

    } catch (error) {
      console.error('Failed to start listening:', error)
      setIsConnecting(false)
    }
  }, [apiKey, onTranscript])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    setIsListening(false)
  }, [])

  return {
    isListening,
    isConnecting,
    startListening,
    stopListening
  }
}
