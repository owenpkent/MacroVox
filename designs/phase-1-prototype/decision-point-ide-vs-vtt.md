# Decision Point: IDE-Style Interaction Software vs Best Voice-to-Text App

## Context (What We’ve Built / Planned)

MacroVox currently spans two overlapping directions:

- **Voice memo + transcription workstation** (root `README.md`, `VISION.md`)
  - Desktop PySide6 app
  - IDE-inspired multi-panel layout: file browser, terminal/console, recorder, output editor
  - Goal: fast voice capture and fast “copy-to-use” transcription

- **Phase 1 prototype: voice-controlled terminal** (`designs/phase-1-prototype/README.md`)
  - Voice → Deepgram transcript → Claude tool-use → shell commands → embedded terminal
  - Goal: validate “voice → action” workflow quickly on desktop

There are also exploratory proposals for broader IDE-like products:

- `designs/proposals/cloud-ide-proposal.md` (Codespaces-like voice-first IDE)
- `designs/proposals/mobile-voice-ide-proposal.md` (mobile voice-first cloud IDE)
- `designs/proposals/voice-input-proposal.md` (voice-to-text input layer for AI assistants)

## The Decision

We need to choose the primary product direction after Phase 1:

### Option A: IDE-Style Interaction Software ("voice workstation" / "voice-controlled terminal + agent")

MacroVox becomes an environment where **voice drives actions** (terminal commands, file operations, git workflows, structured tool use). The IDE-like layout is central.

### Option B: Best Voice-to-Text App ("voice capture + best transcription + best editing/export")

MacroVox becomes the **best, fastest, most accurate voice-to-text** tool. IDE-like layout is optional/secondary; focus is on transcription quality, latency, editing UX, and exports/integrations.

## What’s Common to Both Options (Shared Foundation)

- Desktop-first app (PySide6) with proven UI control and low mic friction
- Deepgram integration as the “accuracy + latency” engine
- Strong UX emphasis: low-latency feedback and minimal friction
- Secure key storage (keyring) and local-first workflow

The difference is **where we spend complexity budget**:

- Option A spends it on **reliable intent → tool execution**
- Option B spends it on **transcription + editing + distribution**

## Pros/Cons Matrix

| Dimension | Option A: IDE-Style Interaction Software | Option B: Best Voice-to-Text App |
|---|---|---|
| **Primary user** | Developers / power users; accessibility/RSI use cases; people who live in terminals | Broad: knowledge workers, students, creators, devs; anyone who wants fast transcription |
| **Core job-to-be-done** | “Do complex computer work hands-free via intent” | “Turn speech into clean text fast, reliably, and export it where I need it” |
| **Differentiation** | High upside: voice-driven agent + tool execution is rarer and more defensible | Crowded space, but can win on latency, accuracy, workflow polish, and trust |
| **Time-to-value (MVP)** | Medium: needs safety/confirmations, error recovery, high trust | High: transcription + editor + copy/export can delight quickly |
| **Engineering complexity** | High: tool safety, permissions, undo, multi-step plans, model reliability, command sandboxing | Medium: streaming STT, text cleanup, editor UX, storage, export integrations |
| **Risk profile** | Higher: one bad command can destroy trust; failures are expensive | Lower: worst case is “bad transcript” (still fixable) |
| **Safety/Trust burden** | Very high (destructive actions, installs, file deletion) | Moderate (privacy + accuracy expectations) |
| **Market size** | Smaller niche initially (dev/power users), but high ARPU potential | Larger market, lower ARPU unless strong verticalization |
| **Monetization** | Easier to charge more (power user value); possible enterprise later | Freemium possible; pricing pressure vs existing tools |
| **Distribution** | Harder: “it runs commands” triggers security friction | Easier: “best transcription tool” is legible and shareable |
| **Competitive landscape** | Competes with voice-control tools, agentic IDEs, and LLM-in-IDE assistants | Competes with Whisper-based apps, OS dictation, Otter, etc. |
| **Strategic optionality** | If it works, can expand into cloud/mobile IDE concepts later | Can later add “actions” as a premium layer once trust is earned |

## Key Points to Keep in Mind

### What Phase 1 is already validating
- Voice → transcript → intent interpretation → action execution (terminal) is a **strong litmus test** for Option A.
- The IDE-like layout is already in place, but the *core value* isn’t the panels—it’s whether users trust the system to do things.

### What the current repo identity implies
- Root `README.md` describes a voice memo recorder (closer to Option B).
- `VISION.md` describes an IDE-inspired voice-to-text workstation (closer to Option B, with optional “AI console”).
- Phase 1 prototype docs describe a voice-controlled terminal (closest to Option A).

This mismatch is a signal that we should **choose a single headline**.

## Decision Criteria (How We Decide)

Pick Option A if most of the following are true:

- **Trust can be earned quickly**: users are comfortable confirming commands and see it as still faster than typing.
- **The “voice → action” loop is reliably fast**: transcription latency and tool execution feel immediate.
- **We have a clear wedge user**: e.g., devs doing repetitive file/git workflows, or accessibility/RSI users.
- **We can make it safe** without killing flow: confirmations, undo, dry-run, and “explain before execute” are sufficient.

Pick Option B if most of the following are true:

- **Transcription + editing delight is obvious**: users keep using it daily even without “agentic actions.”
- **A simpler product is shipping faster** and is easier to iterate with real users.
- **Distribution and trust matter more than cleverness**: “best transcription” is easier to explain and adopt.
- **We want maximum market size** and the ability to layer advanced workflows later.

## Recommendation (Provisional)

**Default recommendation: Bias toward Option B (best voice-to-text) as the primary product narrative**, while keeping Option A as an “advanced mode” only if Phase 1 proves strong trust + speed.

Reasoning:

- Phase 1 shows Option A is technically feasible, but its success hinges on safety + reliability.
- Option B fits the existing repo identity and can become a daily habit product faster.
- Option B can still incorporate an IDE-like layout (file browser, output editor, console) without committing to risky automation.
- If Option B wins adoption, adding Option A later becomes easier because trust, distribution, and retention are already earned.

## Experiments to Run (Next 1–2 Weeks)

### Experiment 1: “Voice → Command” trust test (Option A)
- Have 5–10 dogfood sessions where you do real tasks:
  - file ops (mkdir/copy/move)
  - `git status`, `git diff`, `git commit` (with safeguards)
  - running scripts / starting a server
- Track:
  - **success rate** of correct command on first try
  - **time saved** vs typing
  - number of confirmations / edits required
  - “would you keep this enabled?” (yes/no + why)

### Experiment 2: “Voice → Clean Text → Export” habit test (Option B)
- Use MacroVox daily for a week for:
  - meeting notes
  - dev journaling
  - drafting prompts / specs
- Track:
  - transcript latency and accuracy
  - editing friction (how many corrections?)
  - export/copy workflows
  - whether you open the app proactively

### Experiment 3: Positioning smoke test
- Create two one-paragraph landing-page blurbs (internal is fine) and show to 10 people:
  - A: “voice-controlled terminal/agent”
  - B: “fastest voice-to-text workstation”
- Ask:
  - what they think it is
  - whether they’d try it
  - what they’d pay (if anything)

## Decision Gate (Write This in the Sprint Plan)

At the end of the experiments, decide based on these thresholds:

- **Option A greenlight** if:
  - ≥ 80% of voice requests lead to a correct command (with at most one clarification)
  - confirmation UX doesn’t feel annoying (self-rated ≥ 4/5)
  - no “scary” failure modes encountered during dogfood

- **Option B greenlight** if:
  - you use it on ≥ 5 of 7 days without forcing yourself
  - speech-to-text visible latency is consistently low enough to feel “live”
  - editing + copy/export flow feels meaningfully better than OS dictation/Whisper workflows

If both greenlight, choose based on:

- Which one people understand immediately
- Which one has stronger retention signals
- Which one can ship an MVP with the least trust risk

---

## Status

**DECISION MADE: December 13, 2024**

✅ **Option B Selected: Best Voice-to-Text App**

MacroVox will focus on becoming the **best, fastest, most accurate voice-to-text workstation**. The IDE-like layout remains as a productivity feature, but the core value proposition is:

> **Turn speech into clean text fast, reliably, and export it where you need it.**

### Next Steps (Post-Decision)

1. **File Browser Improvements** - Enhance navigation, filtering, and file management
2. **Output Mode Selection** - Add toggle between:
   - **Simple Transcription Mode**: Clean, edited text output (current behavior)
   - **Conversation Mode**: ChatGPT-like AI context window for interactive refinement
3. **MCP Server Integration** - Explore exposing MacroVox as an MCP server for AI assistants

See `@designs/phase-1-prototype/voice-recorder-roadmap.md` for detailed feature planning.
