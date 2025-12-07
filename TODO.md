# MacroVox To-Do List

## 🚀 Current Sprint: IDE-Style Layout

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

### Phase 5: Terminal / AI Console
- [ ] Terminal-style output widget
- [ ] Command input with history
- [ ] DeepGram status display
- [ ] Claude Code integration (optional)

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
