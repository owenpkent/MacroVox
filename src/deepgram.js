import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import Logger from './logger.js';
import { config } from './config.js';

const logger = new Logger(config.logLevel);

class DeepgramStreamer {
  constructor() {
    if (!config.deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set in .env');
    }
    this.client = createClient(config.deepgramApiKey);
    this.connection = null;
    this.isConnected = false;
  }

  /**
   * Start a live transcription connection
   * @param {stream.Readable} audioStream - Audio stream from microphone
   * @param {function} onTranscript - Callback for transcript events
   * @returns {Promise<void>}
   */
  async startLiveTranscription(audioStream, onTranscript) {
    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to Deepgram live transcription...');

        const options = {
          model: config.deepgram.model || 'nova-2',
          language: config.deepgram.language || 'en',
          interim_results: config.deepgram.interimResults !== false,
          punctuate: config.deepgram.punctuate === true,
          smart_format: config.deepgram.smartFormat === true,
          vad_events: config.deepgram.vad !== false,
          endpointing: config.deepgram.endpointing || 300,
          encoding: 'linear16',
          sample_rate: config.audio.sampleRate,
          channels: config.audio.channels,
        };

        logger.debug('Deepgram options:', JSON.stringify(options));

        this.connection = this.client.listen.live(options);

        this.connection.on(LiveTranscriptionEvents.Open, () => {
          logger.info('Deepgram connection opened');
          this.isConnected = true;
          resolve();
        });

        this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          if (data.channel.alternatives && data.channel.alternatives.length > 0) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final === true;

            if (transcript) {
              logger.debug(
                `[${isFinal ? 'final' : 'interim'}] ${transcript}`
              );
              if (onTranscript) {
                onTranscript({
                  transcript,
                  isFinal,
                  confidence: data.channel.alternatives[0].confidence,
                });
              }
            }
          }
        });

        this.connection.on(LiveTranscriptionEvents.Error, (err) => {
          logger.error('Deepgram error:', err.message);
          this.isConnected = false;
        });

        this.connection.on(LiveTranscriptionEvents.Close, () => {
          logger.info('Deepgram connection closed');
          this.isConnected = false;
        });

        // Send audio chunks to Deepgram (don't use pipe, use send method)
        audioStream.on('data', (chunk) => {
          if (this.isConnected && this.connection) {
            try {
              this.connection.send(chunk);
            } catch (err) {
              logger.error('Error sending audio chunk:', err.message);
            }
          }
        });

        audioStream.on('error', (err) => {
          logger.error('Audio stream error:', err.message);
          this.stopLiveTranscription();
          reject(err);
        });

        audioStream.on('end', () => {
          logger.debug('Audio stream ended');
          this.stopLiveTranscription();
        });
      } catch (err) {
        logger.error('Failed to start live transcription:', err.message);
        reject(err);
      }
    });
  }

  /**
   * Stop the live transcription
   */
  stopLiveTranscription() {
    if (this.connection) {
      logger.info('Stopping Deepgram connection...');
      this.connection.finish();
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  isLive() {
    return this.isConnected;
  }
}

export default DeepgramStreamer;
