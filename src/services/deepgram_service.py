"""
MacroVox DeepGram Service
Speech-to-text transcription for recorded files and live streaming
"""

import threading
from pathlib import Path
from typing import Optional

from PySide6.QtCore import QObject, Signal

from deepgram import DeepgramClient

from .api_keys import get_api_key, DEEPGRAM_KEY


class DeepgramService(QObject):
    """
    DeepGram transcription service supporting file transcription.
    
    Signals:
        transcript_received: Emits final transcript text
        partial_transcript: Emits interim/partial transcript (live mode)
        transcription_started: Emits when transcription begins
        transcription_finished: Emits when transcription completes
        error_occurred: Emits error messages
    """
    
    transcript_received = Signal(str)      # Final transcript
    partial_transcript = Signal(str)       # Interim results (live)
    transcription_started = Signal()
    transcription_finished = Signal()
    error_occurred = Signal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._client: Optional[DeepgramClient] = None
        self._is_streaming = False
        
    @property
    def is_configured(self) -> bool:
        """Check if DeepGram API key is configured."""
        return get_api_key(DEEPGRAM_KEY) is not None
    
    @property
    def is_streaming(self) -> bool:
        """Check if live streaming is active."""
        return self._is_streaming
        
    def _get_client(self) -> Optional[DeepgramClient]:
        """Get or create DeepGram client."""
        if self._client is None:
            api_key = get_api_key(DEEPGRAM_KEY)
            if not api_key:
                self.error_occurred.emit("DeepGram API key not configured")
                return None
            
            try:
                self._client = DeepgramClient(api_key=api_key)
            except Exception as e:
                self.error_occurred.emit(f"Failed to create DeepGram client: {e}")
                return None
                
        return self._client
    
    def transcribe_file(self, file_path: str | Path) -> Optional[str]:
        """
        Transcribe an audio file.
        
        Args:
            file_path: Path to the audio file (wav, mp3, flac, ogg, etc.)
            
        Returns:
            Transcript text, or None if failed.
        """
        client = self._get_client()
        if not client:
            return None
            
        file_path = Path(file_path)
        if not file_path.exists():
            self.error_occurred.emit(f"File not found: {file_path}")
            return None
            
        self.transcription_started.emit()
        
        try:
            with open(file_path, "rb") as audio_file:
                buffer_data = audio_file.read()
            
            response = client.listen.v1.media.transcribe_file(
                request=buffer_data,
                model="nova-2",
                smart_format=True,
                punctuate=True,
                paragraphs=True,
            )
            
            # Extract transcript from response
            transcript = ""
            if hasattr(response, 'results') and response.results:
                if hasattr(response.results, 'channels') and response.results.channels:
                    for channel in response.results.channels:
                        if hasattr(channel, 'alternatives') and channel.alternatives:
                            for alternative in channel.alternatives:
                                if hasattr(alternative, 'transcript'):
                                    transcript += alternative.transcript + "\n"
            
            transcript = transcript.strip()
            
            if transcript:
                self.transcript_received.emit(transcript)
            else:
                self.error_occurred.emit("No transcript returned")
            
            self.transcription_finished.emit()
            return transcript
            
        except Exception as e:
            self.error_occurred.emit(f"Transcription failed: {e}")
            self.transcription_finished.emit()
            return None
    
    def transcribe_file_async(self, file_path: str | Path):
        """
        Transcribe an audio file asynchronously (non-blocking).
        
        Results are emitted via signals.
        
        Args:
            file_path: Path to the audio file
        """
        thread = threading.Thread(
            target=self.transcribe_file,
            args=(file_path,),
            daemon=True
        )
        thread.start()
    
    def stop_live_transcription(self):
        """Stop live streaming transcription."""
        self._is_streaming = False
    
    def close(self):
        """Clean up resources."""
        self.stop_live_transcription()
        self._client = None
