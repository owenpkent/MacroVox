# MacroVox To-Do List

## 🎯 Direction: Best Voice-to-Text Workstation

> Decision made Dec 13, 2024: Focus on being the best voice recorder/transcription tool.
> See `designs/phase-1-prototype/voice-recorder-roadmap.md` for full feature planning.

## 🚀 Current Sprint: File Browser & Output Modes

### Phase 1: Layout Foundation ✅ COMPLETE
- [x] Create vision document
- [x] Implement three-column splitter layout
- [x] Create left panel (file browser with tree view)
- [x] Create middle panels (terminal + recorder)
- [x] Create right panel (output editor with copy button)
- [x] Add resizable panel dividers
- [x] Migrate existing recorder to middle-bottom

### Phase 2: Output Panel ✅ COMPLETE
- [x] Editable QTextEdit for transcribed text
- [x] Copy All button (one-click clipboard)
- [x] Clear button
- [x] Word/character count display

### Phase 3: File Browser (PARTIAL)
- [x] Tree widget for recordings folder
- [x] Date-based folder grouping
- [ ] Tag filtering sidebar
- [ ] File context menu (delete, rename, re-tag)
- [ ] Sort options (date, name, duration)

### Phase 4: DeepGram Integration
- [ ] API key configuration in settings
- [ ] Live streaming transcription during recording
- [ ] Batch transcription for existing files
- [ ] Connection status indicator in terminal
- [ ] Model selection (nova-2, nova, base)

### Phase 5: Output Mode Selection
- [ ] Add mode toggle to output panel (Simple / Conversation)
- [ ] Simple Transcription mode (current behavior)
- [ ] Conversation Mode UI (ChatGPT-like chat interface)
- [ ] Context window management for conversation history
- [ ] LLM API integration (Claude/GPT) for conversation mode
- [ ] Export conversation as markdown

### Phase 6: MCP Client Integration & Content Creation
- [ ] Integrate Python MCP client SDK
- [ ] Server configuration UI (add/manage MCP server connections)
- [ ] Connect to GitHub MCP server (repos, branches, commits)
- [ ] Connect to Filesystem MCP server (file trees, read/write)
- [ ] Project panel with file tree from connected servers
- [ ] Editor panel for markdown with voice-driven insertions
- [ ] Voice command router (AI interprets intent → MCP tool calls)

---

## UI Polish
- [ ] Improve tag button visibility and contrast
- [ ] Add hover states and animations
- [ ] Polish settings dialog layout
- [ ] Add visual recording indicator (pulsing, waveform)
- [ ] Improve button iconography

## Features
- [ ] Global hotkeys (keyboard shortcuts)
- [ ] System tray integration with quick record
- [ ] Metadata sidecar files (JSON with tags, duration, transcript)

## Distribution
- [ ] Windows installer (PyInstaller or Inno Setup)
- [ ] macOS app bundle
- [ ] Settings sync between devices
- [ ] Auto-update mechanism

## Integrations
- [ ] n8n/Zapier webhook on new recording
- [ ] Direct upload to cloud storage APIs
- [ ] Obsidian/Notion integration
- [ ] MCP client connections (GitHub, Filesystem, Memory, Brave Search)
- [ ] Optional: MCP server mode for external AI assistants
