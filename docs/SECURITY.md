# Security Considerations

## Overview

MacroVox is a voice-controlled terminal application that executes shell commands based on AI interpretation. This document outlines potential security risks and mitigations.

---

## API Key Storage

### Implementation
- API keys are stored using `keyring` library
- On Windows: Uses Windows Credential Manager
- Keys are **never** stored in plain text files or config.json

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Keys exposed in memory | Medium | Keys only loaded when needed, not cached long-term |
| Keys visible in Settings UI | Low | Input fields use password masking |
| Keys committed to git | High | No `.env` file used; keys stored in OS credential store |

---

## Command Execution

### Implementation
- Commands are executed via `pywinpty` in a real PTY session
- Claude interprets voice input and generates shell commands
- Commands are logged before execution

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Malicious command injection | High | Claude's system prompt includes safety guidelines |
| Destructive commands (rm, del, format) | High | Claude warns in explanation; **TODO**: Add confirmation dialog |
| Unintended command execution | Medium | "PROCESS" button requires manual trigger (not auto-execute) |
| Command history exposure | Low | History kept in memory only, not persisted |

### Recommended Future Enhancements
1. **Confirmation dialog** for destructive commands (del, rmdir, format, etc.)
2. **Command allowlist/blocklist** for sensitive operations
3. **Sandbox mode** for testing commands without execution

---

## Network Security

### API Communications

| Service | Protocol | Data Sent |
|---------|----------|-----------|
| DeepGram | HTTPS | Audio file bytes |
| Anthropic | HTTPS | Text transcript, system prompt |

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Audio data sent to third party | Medium | User-initiated only; DeepGram privacy policy applies |
| Transcript sent to third party | Medium | User-initiated only; Anthropic privacy policy applies |
| Man-in-the-middle attacks | Low | All APIs use HTTPS/TLS |

---

## Local Data

### What's Stored Locally

| Data | Location | Encryption |
|------|----------|------------|
| Audio recordings | User-specified output folder | None (user's choice) |
| API keys | Windows Credential Manager | OS-level encryption |
| App settings | `config.json` | None (no sensitive data) |

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Audio files contain sensitive info | Medium | User controls output folder; can delete recordings |
| Config file tampering | Low | No sensitive data in config.json |

---

## Voice Input Risks

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accidental command execution | Medium | Manual "PROCESS" button required |
| Misheard commands | Medium | Transcript shown before processing; user can edit |
| Background noise triggers | Low | Recording requires button press |

---

## Recommendations for Users

1. **Review transcripts** before clicking "PROCESS"
2. **Use a dedicated API key** with limited permissions if possible
3. **Don't record sensitive information** (passwords, secrets)
4. **Regularly clear** audio recordings if they contain sensitive content
5. **Be cautious** with destructive commands - always verify before confirming

---

## Reporting Security Issues

If you discover a security vulnerability, please open an issue on GitHub or contact the maintainer directly.
