# Settings Roadmap

Future settings and configuration options to give MacroVox a competitive edge. Grouped by impact and effort.

---

## High Impact

### 1. Custom Hotkey Binding

**Current state:** Hardcoded to Ctrl+Space.

**Proposal:** Let users pick their own global hotkey, plus optionally a second hotkey for push-to-talk mode. Need a hotkey capture input in settings that listens for a key combo and stores it.

**Why it matters:** Ctrl+Space conflicts with IDE autocomplete (VS Code, JetBrains), Windows IME switching, and various accessibility tools. Users who hit this conflict have no workaround — it's a hard blocker. Every competing dictation app supports custom hotkeys.

**Implementation:**
- Replace the hardcoded `Ctrl+Space` registration in the Tauri global shortcut plugin with a dynamic one read from settings
- Add a "Record shortcut" input in Settings that captures a key combo
- Store as `global_hotkey` in localStorage, sync to Rust backend via `settings_broadcast`
- Re-register the shortcut whenever the setting changes
- Validate for conflicts (warn if the combo is already taken by the OS)

---

### 2. Language Selection

**Current state:** Hardcoded to `en-US` (Deepgram) and English-only Claude cleanup prompt.

**Proposal:** Dropdown of supported languages. Deepgram Nova-3 supports \~30 languages — start with the top 10:
- English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese (Mandarin), Italian, Dutch

**Why it matters:** Opens up the entire non-English market with almost no backend work. The language param is just a URL query parameter on both Deepgram endpoints.

**Implementation:**
- Add `transcription_language` dropdown in Settings (Voice Recognition section)
- Pass selected language to both Deepgram streaming (`deepgram_ws.rs`) and batch (`commands.rs`) URLs as `&language=xx`
- Update Claude cleanup prompt to specify the language: "The transcript is in {language}. Clean it up in that language."
- Sync to Rust backend via `settings_broadcast`
- Default: `en` (multi-dialect, lets Deepgram auto-detect en-US vs en-GB vs en-AU)

---

### 3. Auto-Punctuation Style / Output Formatting

**Current state:** Deepgram `smart_format=true` and `punctuate=true` are hardcoded. No control over filler words, paragraph breaks, or capitalization.

**Proposal:** Formatting options:
- **Filler words** — toggle to keep or strip "um", "uh", "like" (Deepgram param: `filler_words=true/false`)
- **Paragraph breaks** — toggle to insert paragraph breaks on long pauses (Deepgram param: `paragraphs=true`)
- **Capitalization style** — dropdown: Sentence case (default), lowercase (for code/chat), UPPERCASE
  - Sentence case: default Deepgram behavior
  - Lowercase/uppercase: post-process in Claude cleanup prompt

**Implementation:**
- Add three controls in AI Post-Processing section
- `filler_words` and `paragraphs` are Deepgram URL params — add to both streaming and batch URLs
- Capitalization is a Claude prompt instruction (like number formatting)
- Store as `filler_words`, `paragraph_breaks`, `capitalization_style` in localStorage

---

### 4. Per-App Profiles

**Current state:** All settings are global. Same behavior regardless of which app the user is dictating into.

**Proposal:** Detect the focused application when dictation starts and apply a matching profile. Example profiles:
- **VS Code** — lowercase, no punctuation, strip filler words
- **Outlook / Gmail** — formal tone, sentence case, paragraph breaks
- **Slack / Discord** — casual tone, lowercase, no period at end
- **Default** — current global settings

**Why it matters:** No competitor does this well. This is the kind of feature that makes people recommend the app. A developer dictating code comments needs completely different formatting than when they switch to email.

**Implementation:**
- Tauri backend reads the foreground window process name / title on dictation start (Windows API: `GetForegroundWindow` + `GetWindowThreadProcessId`)
- Emit the app name to the frontend via a Tauri event
- Settings UI: let users create named profiles with overrides for formatting, cleanup prompt, capitalization, etc.
- Match profiles by process name (e.g., `Code.exe`, `OUTLOOK.EXE`, `slack.exe`)
- Fall back to default profile if no match
- Store profiles as JSON in localStorage or a dedicated config file

**Complexity:** Medium-high. The window detection is straightforward in Rust on Windows, but the profile management UI and override logic adds surface area. Consider shipping a basic version first (just process name detection + 2-3 built-in presets) before building full custom profiles.

---

### 5. Custom Cleanup Prompt / Persona

**Current state:** The Claude cleanup system prompt is hardcoded. Users can add "accessibility context" (max 1000 chars) but can't change the core instruction.

**Proposal:** Let users write or select from presets a full cleanup persona. Presets:
- **General** (current default)
- **Medical** — "Format as clinical notes with proper medical terminology (ICD codes, drug names, anatomical terms)"
- **Legal** — "Preserve legal terminology, format citations properly, maintain formal register"
- **Developer** — "Preserve camelCase/snake_case identifiers, don't capitalize variable names, format code references in backticks"
- **Creative Writing** — "Preserve speech patterns, don't overcorrect dialogue, maintain the author's voice"
- **Custom** — free-form textarea for the full system prompt override

**Implementation:**
- Add a "Cleanup style" dropdown with presets + a "Custom" option that shows a textarea
- Store as `cleanup_preset` (preset name) and `cleanup_custom_prompt` (custom text) in localStorage
- In `usePostProcessing.ts`, build the system prompt from the selected preset or custom text
- Keep the accessibility context as a separate field that gets appended regardless of preset
- Cap custom prompts at 2000 chars (proxy allows up to 10,000 system prompt chars)

---

## Medium Impact, Low Effort

### 6. Pause Sensitivity (Endpointing)

**Current state:** `utterance_end_ms=500` and `endpointing=200` are hardcoded.

**Proposal:** A "Pause sensitivity" slider:
- **Fast** — 100ms endpointing, 300ms utterance end (for rapid speakers)
- **Normal** — 200ms / 500ms (current)
- **Relaxed** — 400ms / 1000ms (for slow/thoughtful speakers)
- **Patient** — 600ms / 1500ms (for users with speech impediments or who pause frequently)

**Why it matters:** People who speak slowly get their sentences split in half. People who speak fast get words merged. This is a common frustration with voice dictation and no app exposes this control.

**Implementation:**
- Add slider or segmented control in Voice Recognition section
- Store as `endpointing_preset` in localStorage
- Map preset to `endpointing` + `utterance_end_ms` values
- Pass to both streaming WebSocket URL and batch URL
- Sync to Rust backend

---

### 7. Output Destination Options

**Current state:** Transcribed text is auto-copied and optionally auto-pasted into the focused app.

**Proposal:** Output destination dropdown:
- **Paste into focused app** (current)
- **Clipboard only** (copy, no paste)
- **Append to file** — user picks a file path; each transcription gets appended with a timestamp header
- **Webhook** — POST transcript to a user-specified URL (for Zapier, Make, n8n integrations)

**Why it matters:** "Append to file" alone is a killer feature for journaling, meeting notes, daily logs, and research. Webhook support opens up automation integrations without any custom code on our side.

**Implementation:**
- Add `output_destination` dropdown in Quick Dictation section
- For "Append to file": add a file picker (Tauri `dialog` plugin) and store the path
- For "Webhook": add a URL input and optional auth header
- Handle each destination in the dictation completion flow (after cleanup)
- File append format: `\n---\n[2026-04-15 14:30]\n{transcript}\n`

---

### 8. Voice Command Reference + Custom Commands

**Current state:** Deepgram `dictation=true` supports built-in voice commands ("period", "comma", "new line", "new paragraph") but users don't know what's available.

**Proposal:**
- Add a collapsible "Voice commands" reference panel listing all supported Deepgram dictation commands
- Allow custom voice commands: user defines trigger phrase → replacement text
  - "my email" → "owen@example.com"
  - "signature" → "Best regards,\nOwen Kent\nOK Studio"
  - "home address" → "123 Main St, Springfield, IL"

**Implementation:**
- Reference panel: static list in a collapsible section, no backend work
- Custom commands: store as JSON array in localStorage (`custom_voice_commands`)
- Apply as post-processing string replacements after Deepgram transcription, before Claude cleanup
- Match case-insensitively, replace with exact user-defined text
- Limit: 50 custom commands, 200 chars each for replacement text

---

### 9. Text Replacement / Expansion Rules

**Current state:** Keyword boosting helps Deepgram *recognize* words but doesn't transform output.

**Proposal:** Find-and-replace rules applied to every transcript:
- "gonna" → "going to"
- "wanna" → "want to"
- "dont" → "don't"
- User-defined pairs in a simple two-column input

**Implementation:**
- Store as `text_replacements` JSON array in localStorage
- Apply after Deepgram, before Claude cleanup (so Claude sees the corrected version)
- Case-insensitive whole-word matching to avoid false positives
- UI: simple add/remove list of from→to pairs in the AI Post-Processing section

---

## Nice-to-Have / Future

### 10. Confidence Highlighting

**Current state:** Deepgram returns per-word confidence scores but they're discarded.

**Proposal:** In the transcript display, highlight low-confidence words (e.g., < 0.85 confidence) with a subtle underline or color. Clicking a highlighted word shows the confidence score and alternatives.

**Why it matters:** No dictation app does this. It lets users quickly spot and fix errors without re-reading the entire transcript. Especially useful for medical/legal transcription where accuracy matters.

**Implementation:**
- Parse Deepgram's `words` array (which includes `confidence` per word) in the transcript event
- Pass word-level data to the frontend instead of just the flat text
- Render low-confidence words with a styled span
- Threshold configurable via a slider (default: 0.85)

---

### 11. Speaker Diarization

**Current state:** Not enabled. Deepgram supports `diarize=true`.

**Proposal:** Toggle to enable speaker labeling. Each speaker gets a label (Speaker 1, Speaker 2, etc.) in the transcript. Useful for meetings, interviews, and podcasts.

**Implementation:**
- Add toggle in Voice Recognition section
- Pass `&diarize=true` to Deepgram URLs
- Parse speaker labels from Deepgram response
- Format transcript with speaker labels: "Speaker 1: ... \n Speaker 2: ..."
- Only available in batch mode (streaming diarization is less reliable)

---

### 12. Export Formats

**Current state:** Voice buffer recordings can be played back, copied, or deleted. No export.

**Proposal:** Export voice buffer history as:
- **Plain text** (.txt) — just transcripts with timestamps
- **Markdown** (.md) — formatted with headers and timestamps
- **SRT** (.srt) — subtitle format with timing (from duration data)
- **CSV** (.csv) — timestamp, duration, transcript columns
- **JSON** (.json) — full recording metadata

**Implementation:**
- Add "Export" button to the voice buffer section
- Format selector dropdown
- Use Tauri `dialog` plugin for save-file picker
- Generate file content from the manifest data (already have timestamp, duration, transcript)

---

### 13. Audio File Import (Drag-and-Drop / Folder Select)

**Current state:** MacroVox only transcribes live microphone input. There is no way to transcribe pre-recorded audio files.

**Proposal:** Let users import audio files for batch transcription:
- **Drag-and-drop** — drag .wav, .mp3, .ogg, .m4a, .webm files onto the app window
- **File picker** — "Import audio" button opens a file dialog
- **Folder select** — pick a folder and transcribe all audio files in it
- Transcribed files appear in the dictation history (voice buffer) alongside live recordings

**Why it matters:** Users often have existing recordings (meetings, voice memos from phone, podcast interviews) they want transcribed. Currently they need a separate tool. This turns MacroVox from a live-dictation app into a general-purpose transcription tool.

**Implementation:**
- Add `tauri-plugin-dialog` to Cargo.toml for native file/folder picker dialogs
- Add HTML5 drag-and-drop event listeners on the main window (or a dedicated drop zone)
- New Tauri command `transcribe_file(path: String, api_key: String)` that:
  1. Reads the audio file from disk
  2. Converts to WAV if needed (ffmpeg or a Rust audio decoder like `symphonia`)
  3. Sends to Deepgram batch API (reuse existing logic from `recording_stop`)
  4. Optionally runs Claude AI cleanup
  5. Saves result to voice buffer manifest
- For folder import: iterate files, filter by audio extension, queue them sequentially
- UI: progress indicator for multi-file imports, results list showing each file's transcript
- Frontend: "Import Audio" button in the Dictation History section or a new section
- Consider a max file size limit (e.g., 100 MB per file, matching Deepgram's limit)

**Complexity:** Medium. The Deepgram batch transcription logic already exists in `recording_stop` and `voice_buffer_reprocess`. The main new work is file format detection/conversion and the drag-and-drop UI.

---

## Priority Recommendation

**Shipped:**
1. ~~Custom hotkey binding~~ — done
2. ~~Language selection~~ — done
3. ~~Number formatting~~ — done

**Ship next (differentiators):**
4. Audio file import (drag-and-drop / folder select)
5. Per-app profiles
6. Custom cleanup prompt / persona
7. Pause sensitivity

**Ship later (depth features):**
8. Output destinations (especially append-to-file)
9. Custom voice commands + text replacements
10. Confidence highlighting
