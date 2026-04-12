# STT Provider Evaluation — MacroVox

Last updated: 2026-04-12

MacroVox currently uses Deepgram Nova-3 for speech-to-text. This document evaluates alternatives in case we decide to switch. The priorities for MacroVox are: **accuracy on single-speaker dictation**, **low latency**, **custom vocabulary / personalization**, and **reasonable cost at consumer scale**.

---

## Provider Comparison

### 1. Deepgram Nova-3 (current)

| | |
|---|---|
| **Accuracy** | ~5.3% WER (batch), ~10.9% WER (streaming) |
| **Latency** | ~200ms streaming |
| **Pricing** | \$0.0077/min (\$0.46/hr) mono, \$200 free credit |
| **Streaming** | WebSocket, interim results, VAD, endpointing |
| **Batch** | HTTP POST with audio file |
| **Custom vocabulary** | Keyterm Prompting (up to 100 terms, Nova-3 only). Uses in-context learning — more accurate than legacy keyword boosting. |
| **Find & Replace** | `&replace=misheard:correct` server-side substitution. No documented limit (~200 pairs via URL length). |
| **Custom models** | Enterprise only. Requires thousands of hours of audio. Not viable for consumer app. |
| **Languages** | 30+ with multilingual model |
| **SDK/Integration** | WebSocket + REST. Currently deeply integrated in MacroVox (Rust WebSocket client + HTTP batch). |

**Strengths:** Best keyword/replace ecosystem. Per-second billing (no rounding). Generous free tier. Low latency. Already integrated.

**Weaknesses:** Mid-tier accuracy compared to newer models. 100-term keyterm limit. No local/offline option.

**Migration effort:** N/A (current provider)

---

### 2. ElevenLabs Scribe v2

| | |
|---|---|
| **Accuracy** | ~2.3% WER — current best-in-class for cloud APIs |
| **Latency** | ~150ms streaming |
| **Pricing** | \$0.40/hr (\$0.0067/min). Free tier details vary by plan. |
| **Streaming** | WebSocket with real-time transcripts, VAD support |
| **Batch** | HTTP file upload |
| **Custom vocabulary** | Keyterm prompting — up to 100 terms. Model decides contextually whether to apply them (smarter than simple boosting). Built-in handling for technical language, medications, proper nouns. |
| **Find & Replace** | Not documented as a separate feature. |
| **Custom models** | Not available. |
| **Languages** | 99 languages |
| **Entity recognition** | Built-in: 56 categories including PII, health data, with timestamps. |

**Strengths:** Best accuracy available in a cloud API. Predictive transcription anticipates next words. 150ms latency beats Deepgram. Contextual keyterm application (not just boosting). Entity recognition is a free bonus.

**Weaknesses:** No equivalent to Deepgram's `replace` parameter. Newer API — less battle-tested. No local/offline option. Slightly more expensive than Deepgram.

**Migration effort:** Medium. Swap WebSocket endpoint + auth format. Response JSON structure will differ. Keyterm API is similar conceptually. ~2-3 days.

**Verdict:** Top candidate if we prioritize accuracy. The 2.3% vs 5.3% WER difference is significant for dictation where every word matters.

---

### 3. AssemblyAI Universal-2

| | |
|---|---|
| **Accuracy** | Claims 21% better than Nova-3 on domain-specific terms (with keyterms). General WER competitive with Deepgram. |
| **Latency** | ~300ms P50 streaming |
| **Pricing** | \$0.15/hr streaming, +\$0.04/hr for keyterms. Batch pricing varies. 333 hours free streaming. |
| **Streaming** | WebSocket (`wss://streaming.assemblyai.com/v3/ws`) |
| **Batch** | HTTP upload + polling |
| **Custom vocabulary** | Keyterms Prompting — up to 100 terms, 50 chars each. |
| **Custom Spelling** | Dictionary mapping: any word/phrase to preferred spelling. Works across all languages/models. **No documented limit on number of mappings.** This is the standout feature. |
| **Custom models** | Available on higher tiers. |
| **Languages** | 99 languages |

**Strengths:** Custom Spelling with no documented limit is extremely valuable for the voice learning feature — we could map hundreds of corrections server-side. Cheapest streaming option. Generous free tier.

**Weaknesses:** Higher latency than Deepgram/ElevenLabs (300ms vs 150-200ms). Batch requires upload + polling (not instant response). Custom Spelling's lack of a documented limit doesn't mean it's truly unlimited — need to test at scale.

**Migration effort:** Medium. Similar WebSocket pattern. Different response format. Custom Spelling integration is straightforward. ~2-3 days.

**Verdict:** Best value pick. Cheapest streaming + unlimited Custom Spelling makes it ideal for the voice learning pipeline. Worth a head-to-head accuracy test against Deepgram on our actual audio.

---

### 4. Gladia

| | |
|---|---|
| **Accuracy** | Whisper-based + proprietary post-processing. Competitive but not benchmarked as aggressively. |
| **Latency** | Competitive streaming |
| **Pricing** | Bundled audio intelligence features (no per-feature add-ons) |
| **Streaming** | WebSocket, real-time + async APIs |
| **Batch** | Async transcription API |
| **Custom vocabulary** | Per-term weighting, per-language config. Both real-time and async. |
| **Custom Spelling** | `custom_spelling_config` parameter for spelling overrides. |
| **Languages** | 100+ with native code-switching (speakers can switch languages mid-sentence) |

**Strengths:** Best multilingual support by far. Code-switching is unique — no other provider handles mid-sentence language changes. Audio intelligence features bundled (sentiment, NER, summarization).

**Weaknesses:** Less accuracy data available for English-only dictation. Smaller developer community. Overkill for single-language dictation.

**Migration effort:** Medium. ~2-3 days.

**Verdict:** Only relevant if MacroVox goes multilingual. Not a priority for English-only dictation.

---

### 5. OpenAI Whisper (local via whisper.cpp)

| | |
|---|---|
| **Accuracy** | Large v3: ~2.0% WER (clean), ~7.9% WER (real-world). Turbo: within 1-2% of full model. |
| **Latency** | Processes 30-second chunks. ~4 sec/chunk on RTX 3060 (Turbo). Not real-time streaming. |
| **Pricing** | Free (local). OpenAI API: \$0.006/min. |
| **Streaming** | **Not supported natively.** Chunked workarounds exist but add significant latency. |
| **Batch** | Process full audio file locally or via API. |
| **Custom vocabulary** | Prompt conditioning: pass natural language context ("This is a conversation about MacroVox, OAuth, and Deepgram..."). Reduces specialized term WER by 15-25%. |
| **Custom models** | Fine-tuning possible via Hugging Face. Requires labeled audio data + GPU. |
| **Languages** | 99 languages |
| **Local models** | GGML format via whisper.cpp. Sizes: 75MB (tiny) to 2.9GB (large). Runs on CPU, no CUDA required. |

**Strengths:** Best accuracy on clean audio (2.0% WER). Completely free and offline. No API dependency. Privacy-first. Already scaffolded in MacroVox (`whisper_transcribe` command behind `local-stt` feature flag). Prompt conditioning is flexible and free.

**Weaknesses:** No real-time streaming — fundamentally incompatible with "see words as you speak" mode. 30-second chunk buffer means minimum 4-30 second latency. Requires model download (800MB-2.9GB). Requires cmake/C++ toolchain to compile whisper-rs.

**Migration effort:** Low — scaffold already exists. Need to build model download UI, expose in settings, and flesh out the transcription flow. ~2 days for batch mode only.

**Verdict:** Best offline/privacy option. Use as batch-only alternative. Already partially built. Should be completed as an option alongside the cloud provider, not a replacement for streaming.

---

### 6. NVIDIA Parakeet RNNT 1.1B

| | |
|---|---|
| **Accuracy** | ~1.8% WER on LibriSpeech — state-of-the-art. |
| **Latency** | Streaming capable (RNNT architecture) |
| **Pricing** | Free (open source, local deployment) |
| **Streaming** | Supported via NeMo/Riva framework |
| **Custom vocabulary** | Word boosting at request time. N-gram language model support. |
| **Deployment** | Docker container. NVIDIA GPU required. Windows via WSL2. |
| **Model size** | 1.1B parameters |

**Strengths:** Absolute best accuracy available (1.8% WER). Free. Streaming-capable. Open source.

**Weaknesses:** Requires NVIDIA GPU + Docker + WSL2. Heavy infrastructure for a consumer desktop app. NeMo/Riva framework is enterprise-oriented. Not designed for easy embedding in a Tauri app. Significant integration effort.

**Migration effort:** High. Would need to run as a sidecar service (Docker container) that MacroVox communicates with via localhost API. ~1-2 weeks. Requires users to have Docker + WSL2 + NVIDIA GPU.

**Verdict:** Best accuracy possible but deployment requirements make it impractical for a consumer app. Could be offered as a "power user" option for users with NVIDIA GPUs who want maximum accuracy.

---

## Summary Matrix

| Provider | WER (batch) | Streaming Latency | Custom Vocab Limit | Replace/Spelling | Price/hr | Offline | Migration |
|----------|-------------|-------------------|---------------------|------------------|----------|---------|-----------|
| **Deepgram Nova-3** | 5.3% | 200ms | 100 keyterms | ~200 replace pairs | \$0.46 | No | Current |
| **ElevenLabs Scribe v2** | 2.3% | 150ms | 100 keyterms | No | \$0.40 | No | Medium |
| **AssemblyAI Universal-2** | ~4-5% | 300ms | 100 keyterms | Unlimited Custom Spelling | \$0.15 | No | Medium |
| **Gladia** | ~5% | ~200ms | Weighted vocab | Custom spelling config | Bundled | No | Medium |
| **Whisper v3 (local)** | 2.0% | N/A (batch only) | Prompt conditioning | N/A | Free | Yes | Low |
| **NVIDIA Parakeet** | 1.8% | Streaming | Word boost + LM | N/A | Free | Yes | High |

---

## Recommended Strategy

### Short term (now)
Stay on **Deepgram Nova-3**. It's integrated, working, and the voice learning pipeline (keywords + replace + Claude cleanup) will squeeze significant accuracy gains out of it.

### Medium term (next quarter)
1. **Add Whisper local as batch-only offline option.** Scaffold exists. High accuracy, free, privacy-friendly. Good differentiator.
2. **Run a head-to-head test** of ElevenLabs Scribe v2 vs Deepgram Nova-3 on real MacroVox dictation audio. If Scribe v2's 2.3% WER holds up on our audio, it's worth the switch.

### Long term
1. **Abstract STT behind a provider interface** so swapping is a config change, not a rewrite. Define a common interface: `connect(config)`, `sendAudio(chunk)`, `onTranscript(callback)`, `stop()`.
2. **Evaluate AssemblyAI** if the voice learning feature needs more than 200 server-side corrections — their unlimited Custom Spelling is uniquely suited for this.
3. **Consider NVIDIA Parakeet** as a power-user local option if demand exists.

---

## What a Provider Switch Requires

Regardless of which provider we switch to, these files must change:

| Layer | Files | What changes |
|-------|-------|-------------|
| **Rust WebSocket** | `src-tauri/src/deepgram_ws.rs` | Endpoint URL, auth header format, query params, response JSON parsing |
| **Rust batch** | `src-tauri/src/commands.rs` (`recording_stop`) | HTTP endpoint, auth, request format, response parsing |
| **Rust state** | `src-tauri/src/state.rs` | Provider-specific config fields |
| **Netlify proxy** | `netlify/functions/deepgram-proxy.ts` | Endpoint, auth, request/response format |
| **Renderer config** | `src/renderer/config.ts` | Proxy URL (if renamed) |
| **API keys** | `.env`, Netlify env vars | New provider key variable |
| **Electron (legacy)** | `src/main/deepgram.ts` | Full rewrite or remove |

The ideal end-state is a `STTProvider` interface in Rust with implementations for each provider, selectable in settings. This would make future switches trivial.

---

## References

- [Deepgram Nova-3 Announcement](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [Deepgram Keywords Docs](https://developers.deepgram.com/docs/keywords)
- [Deepgram Keyterm Prompting](https://developers.deepgram.com/docs/keyterm)
- [ElevenLabs Scribe v2 Realtime](https://elevenlabs.io/realtime-speech-to-text)
- [ElevenLabs Scribe v2 Blog](https://elevenlabs.io/blog/introducing-scribe-v2-realtime)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)
- [AssemblyAI Custom Spelling](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/custom-spelling)
- [AssemblyAI Streaming Keyterms](https://www.assemblyai.com/blog/streaming-keyterms-prompting)
- [Gladia Custom Vocabulary](https://www.gladia.io/blog/custom-vocabulary-stt-accuracy)
- [Whisper Large v3 on Hugging Face](https://huggingface.co/openai/whisper-large-v3)
- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)
- [NVIDIA Parakeet RNNT 1.1B](https://huggingface.co/nvidia/parakeet-rnnt-1.1b)
- [NVIDIA Parakeet Blog](https://developer.nvidia.com/blog/pushing-the-boundaries-of-speech-recognition-with-nemo-parakeet-asr-models/)
- [Artificial Analysis STT Leaderboard](https://artificialanalysis.ai/speech-to-text)
- [CodeSOTA Speech AI Benchmarks 2026](https://www.codesota.com/speech)
