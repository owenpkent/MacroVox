# Voice Learning & Transcript Correction — Design Document

## Problem

MacroVox users can edit transcripts after dictation, but those corrections are thrown away. The app doesn't learn from mistakes. Users with specialized vocabulary (names, jargon, technical terms) hit the same errors repeatedly.

Deepgram's keyword boosting helps, but is limited to ~100 terms per request. We need a multi-layered approach that combines STT-level hints, local corrections, and AI-powered cleanup — and we should evaluate whether Deepgram is still the best STT provider for this use case.

## Current State

- **Deepgram Nova-2** (streaming) / **Nova-3** (batch) for STT
- **Keyword boosting** wired up in both WebSocket and HTTP paths, capped at 50 (API limit is 100)
- **Editable textarea** — users can already edit transcripts, but edits aren't tracked
- **AI cleanup** via Claude Haiku — uses a static `post_processing_context` from settings (1,000 char limit)
- **Whisper local STT** — scaffold exists behind `local-stt` feature flag, not exposed in UI
- **Tight coupling** to Deepgram — model names, endpoints, response parsing, auth format all hardcoded

---

## Part 1: STT Provider Comparison

### Deepgram (current)

| Feature | Details |
|---------|---------|
| **Models** | Nova-3 (latest), Nova-2 |
| **Keyword boosting** | Up to 100 keywords with intensity values (0-10). Exponential boost — no upper limit on intensity, but high values cause false positives. |
| **Keyterm Prompting** | Nova-3 feature. Up to 500 tokens (~100 words). Uses in-context learning at inference time — more accurate than legacy keyword boosting. Dynamic per-request, no pre-registration. |
| **Find & Replace** | `&replace=misheard:correct` URL param. Server-side string substitution in the response. No documented limit (URL length is the practical cap, ~200 pairs). |
| **Custom models** | Enterprise only. Requires thousands of hours of training audio. Not viable for a consumer app. |
| **Streaming latency** | ~200ms. Best-in-class for real-time. |
| **Pricing** | Pay-as-you-go from \$0.0043/min (Nova-2). Nova-3 higher. |
| **Personalization ceiling** | 100 keyterms + ~200 replace pairs per request. No per-user model training outside Enterprise. |

**Verdict:** Strong real-time performance. Keyterm Prompting on Nova-3 is a meaningful upgrade over legacy keywords. The `replace` parameter is underused and should be leveraged for learned corrections. But 100-term limit is a hard wall for power users.

### AssemblyAI

| Feature | Details |
|---------|---------|
| **Models** | Universal-2 (batch), Universal-Streaming (real-time) |
| **Keyterms Prompting** | Up to 100 terms, 50 chars each. Claims 21% better accuracy than Deepgram Nova-3 on domain-specific terms. |
| **Custom Spelling** | Dictionary mapping: any word/phrase to preferred spelling/format. Works across all languages and models. This is their equivalent of Deepgram's `replace`. |
| **Custom models** | Available on higher tiers. |
| **Streaming latency** | Competitive with Deepgram. |
| **Pricing** | \$0.01/min (streaming with keyterms: \$0.04/hr additional). |
| **Personalization ceiling** | 100 keyterms + unlimited custom spelling mappings. Custom Spelling is the standout feature — it's essentially a server-side correction dictionary with no documented limit. |

**Verdict:** Custom Spelling is more flexible than Deepgram's `replace` param. 21% accuracy claim on domain terms is significant if true. Worth evaluating as a potential swap or dual-provider option.

### Gladia

| Feature | Details |
|---------|---------|
| **Models** | Whisper-based + proprietary post-processing |
| **Custom vocabulary** | Per-term weighting, per-language config. Available on both real-time and async APIs. |
| **Custom spelling** | `custom_spelling_config` parameter for spelling overrides. |
| **Multilingual** | 100+ languages with native code-switching (speakers can switch languages mid-sentence). |
| **Pricing** | Competitive, audio intelligence features bundled. |
| **Personalization ceiling** | Custom vocab + spelling config. No documented term limit. |

**Verdict:** Best multilingual support. Code-switching is unique. Custom vocabulary with weighting is flexible. Worth considering if the app expands beyond English.

### OpenAI Whisper (local or API)

| Feature | Details |
|---------|---------|
| **Models** | Whisper Large v3, v3-turbo (local); API hosted version |
| **Prompt conditioning** | Pass a text prompt to prime the model for expected vocabulary. Reduces WER on specialized terms by 15-25%. Supports speaker names, technical terms, domain context. |
| **Custom vocabulary** | No explicit keyword list — uses natural language prompt. "The following is a conversation about MacroVox, a voice dictation tool using Deepgram and OAuth..." |
| **Fine-tuning** | Possible with Hugging Face tooling. Requires labeled audio data. |
| **Local deployment** | Runs on consumer GPU. Zero API cost. Already scaffolded in MacroVox (`whisper_transcribe` command). |
| **Streaming** | Not natively supported. Workarounds exist (chunked processing) but add latency. |
| **Personalization ceiling** | Prompt conditioning is flexible but imprecise. Fine-tuning is the real personalization path — but requires significant effort. |

**Verdict:** Best option for offline/privacy use. Prompt conditioning is free and surprisingly effective. No streaming support is the dealbreaker for real-time dictation. Best as a fallback/offline mode.

### Recommendation

**Stay with Deepgram as primary**, upgrade to Nova-3 with Keyterm Prompting, and fully leverage the `replace` parameter. Evaluate AssemblyAI's Custom Spelling as a potential secondary provider if Deepgram's 100-term limit becomes a real bottleneck. Keep Whisper as the offline option.

The real personalization wins come from the **correction pipeline** (Part 2), not from switching providers.

---

## Part 2: Voice Learning Architecture

### Core Concept

Every time a user corrects a transcript, the app captures the diff and feeds it back into three layers:

```
User speaks
    |
    v
STT Engine (keywords + server-side replacements from correction history)
    |
    v
Raw transcript --> local find-and-replace from learned dictionary (instant)
    |
    v
Display in textarea (user can edit)
    |
    v
Claude cleanup (async, prompt includes learned correction patterns)
    |
    v
Final transcript
    |
    v
On copy/blur/clear: diff original vs edited --> update correction store
    |
    v
Correction store feeds back into all three layers
```

### Layer 1: STT-Level Hints (Deepgram)

**What:** Auto-populate Deepgram's `keywords` and `replace` params from learned corrections.

**How:**
- Extract the "correct" side of corrections as keyword boosts (e.g., user keeps correcting to "MacroVox" → boost "MacroVox")
- Extract misheard→correct pairs as `replace` params (e.g., `&replace=macro+box:MacroVox`)
- Budget: manual keywords first, auto-keywords fill remaining slots up to 100. Replace pairs have no practical limit (~200).

**Limits:** 100 keywords. Replace is string-literal only (no context sensitivity).

### Layer 2: Local Corrections (instant, offline)

**What:** Client-side find-and-replace applied to the raw transcript before display.

**How:** Case-insensitive whole-word regex replacement using the correction dictionary. Applied instantly — no network call.

**Limits:** No context awareness. "there" → "their" would apply everywhere, including where it's wrong. Best limited to proper nouns and unambiguous terms.

### Layer 3: AI Cleanup (Claude)

**What:** Feed the correction dictionary into Claude's system prompt so it learns the user's vocabulary.

**How:** Append a `<correction_dictionary>` section to the existing cleanup prompt:
```
<correction_dictionary>
"deepgrim" -> "Deepgram" (seen 12 times)
"macro box" -> "MacroVox" (seen 8 times)
</correction_dictionary>
Apply these corrections when you see similar patterns.
```

**Limits:** System prompt budget (~4,000 chars for dictionary = ~100 entries). Requires Pro subscription. Adds ~1s latency.

**Why this is the highest-value layer:** Claude understands context. It can apply "their/there" correctly, handle plurals, and generalize from patterns. Keywords and replace are literal; Claude is semantic.

### Data Model

```typescript
interface CorrectionEntry {
  misheard: string   // what STT produced
  correct: string    // what the user changed it to
  count: number      // how many times this correction was made
  lastUsed: number   // timestamp for LRU pruning
}
```

Stored in localStorage as `correction_dictionary`. Capped at 500 entries (~25KB). Pruned by LRU when full.

### Diff Capture

**When:** On textarea blur, copy action, or clear action — NOT on every keystroke.

**How:** Store `originalTranscript` in a ref when STT output arrives. On trigger, word-level diff against current textarea value. Extract replacement pairs. Merge into correction store (increment count for existing entries, add new ones).

**Algorithm:** Simple word alignment — split both strings into words, match common subsequences, extract changed segments. ~50 lines, no dependencies needed.

---

## Part 3: Deepgram Upgrade Path

### Current: Nova-2 (streaming) + Nova-3 (batch)

Both use legacy `keywords` parameter.

### Proposed: Nova-3 everywhere + Keyterm Prompting + Replace

1. **Switch streaming to Nova-3** — better accuracy baseline
2. **Use Keyterm Prompting** instead of legacy keywords — Nova-3's in-context learning is more accurate
3. **Add `replace` params** — server-side correction for learned pairs
4. **Raise keyword cap** from 50 to 100 in `settings_broadcast`

This is a straightforward change in `deepgram_ws.rs` (model param + keyterm format) and `commands.rs` (batch URL).

---

## Part 4: Implementation Phases

### Phase 1 — Correction Store + Diff Capture
Track what users change. No visible behavior change.

New files:
- `src/renderer/lib/correction-store.ts`
- `src/renderer/lib/text-diff.ts`

Modified: `DictationMode.tsx` (add originalTranscript ref, diff on blur/copy/clear)

### Phase 2 — AI Learning via Claude
Feed corrections into the cleanup prompt. Highest impact for least code.

Modified: `usePostProcessing.ts` (load dictionary, format into system prompt)

### Phase 3 — STT Hints (Keywords + Replace)
Improve raw STT using learned corrections.

New: `src/renderer/lib/keyword-manager.ts`

Modified: `deepgram_ws.rs`, `commands.rs`, `state.rs`, `SettingsPanel.tsx`

### Phase 4 — Local Corrections + UI
Instant offline corrections. Visible dictionary in Settings.

New: `src/renderer/lib/local-corrections.ts`

Modified: `DictationMode.tsx`, `SettingsPanel.tsx`

### Phase 5 — Nova-3 Upgrade + Polish
Switch streaming to Nova-3, use Keyterm Prompting, add export/import, stats display.

### Phase 6 (Future) — Provider Abstraction
Abstract STT behind an interface so providers can be swapped. Evaluate AssemblyAI Custom Spelling. Add provider selection in Settings.

---

## Open Questions

1. **Should corrections sync across devices?** Currently localStorage-only. Supabase sync would be a Pro feature.
2. **Should there be a "confidence" threshold?** Only auto-learn corrections made more than N times?
3. **How to handle phrase-level corrections?** "I went to the store" → "I went to the shore" — is this a word-level or phrase-level correction?
4. **AssemblyAI evaluation:** Should we do a head-to-head accuracy comparison with our actual audio before committing to Deepgram long-term?
5. **Whisper offline priority:** How important is offline mode? The scaffold exists but needs UI and model download workflow.

---

## References

- [Deepgram Keywords Docs](https://developers.deepgram.com/docs/keywords)
- [Deepgram Keyterm Prompting](https://developers.deepgram.com/docs/keyterm)
- [Deepgram Nova-3 Announcement](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api)
- [Deepgram Keyword Boosting Best Practices](https://deepgram.com/learn/everything-you-need-to-know-about-keywords-for-speech-recognition)
- [AssemblyAI Custom Spelling](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/custom-spelling)
- [AssemblyAI Keyterms Prompting for Streaming](https://www.assemblyai.com/blog/streaming-keyterms-prompting)
- [Gladia Custom Vocabulary](https://www.gladia.io/blog/custom-vocabulary-stt-accuracy)
- [Whisper Large v3 on Hugging Face](https://huggingface.co/openai/whisper-large-v3)
- [Fine-tuning Whisper for Domain-Specific Recognition](https://medium.com/@sushanttwayana1/fine-tuning-whisper-large-v3-for-domain-specific-speech-recognition-47bfd9c4a0bf)
