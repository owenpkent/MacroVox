# CLI AI Integration Guide

**Created**: December 2024  
**Status**: Planning  
**Purpose**: Integrate command-line AI assistants (Claude Code, Aider, etc.) into MacroVox Cloud

---

## Overview

Command-line AI coding assistants like **Claude Code**, **Aider**, and **GitHub Copilot CLI** represent a powerful new paradigm: AI that operates directly in your terminal, reading files, running commands, and making edits autonomously.

This guide covers how to integrate CLI-based AIs into the MacroVox Cloud environment, enabling voice-driven interaction with these tools.

---

## Why CLI AI Assistants?

| Advantage | Description |
|-----------|-------------|
| **Full codebase access** | Can read any file, understand project structure |
| **Direct execution** | Runs tests, builds, git commands natively |
| **Agentic workflows** | Multi-step reasoning without manual intervention |
| **Terminal-native** | Works in any environment with a shell |
| **No browser required** | Lighter weight than web-based IDEs |

---

## Target CLI AI Tools

### 1. Claude Code (Anthropic)

```bash
# Installation
npm install -g @anthropic-ai/claude-code

# Usage
claude-code "Add error handling to the login function"
```

**Capabilities**:
- File read/write
- Command execution
- Multi-file edits
- Git operations
- Project-wide refactoring

### 2. Aider

```bash
# Installation
pip install aider-chat

# Usage
aider --model claude-3-5-sonnet
```

**Capabilities**:
- Git-aware editing
- Automatic commits
- Multiple file context
- Voice mode (experimental)

### 3. GitHub Copilot CLI

```bash
# Installation
gh extension install github/gh-copilot

# Usage
gh copilot suggest "create a dockerfile for node app"
```

**Capabilities**:
- Shell command suggestions
- Git workflow assistance
- Explain commands

### 4. OpenAI Codex CLI (codex)

```bash
# Usage
codex "write a python script to resize images"
```

---

## Architecture: MacroVox Cloud + CLI AI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MacroVox Cloud                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────────┐  │
│  │   Browser    │───▶│  Voice API   │───▶│   Intent Engine           │  │
│  │   Client     │    │  (WebSocket) │    │   (LLM + Rules)           │  │
│  └──────────────┘    └──────────────┘    └───────────────────────────┘  │
│         │                                           │                    │
│         ▼                                           ▼                    │
│  ┌──────────────┐                         ┌───────────────────────────┐  │
│  │   Monaco     │                         │   CLI AI Router           │  │
│  │   Editor     │                         │   ┌───────────────────┐   │  │
│  └──────────────┘                         │   │ Claude Code       │   │  │
│         │                                 │   │ Aider             │   │  │
│         ▼                                 │   │ Copilot CLI       │   │  │
│  ┌────────────────────────────────────────┴───┴───────────────────┴───┐  │
│  │              Workspace Container (per user)                        │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │  Git    │  │  Shell  │  │  CLI AI      │  │  File System     │ │  │
│  │  │  Client │  │  (PTY)  │  │  Subprocess  │  │  (workspace)     │ │  │
│  │  └─────────┘  └─────────┘  └──────────────┘  └──────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Approaches

### Approach A: Terminal Passthrough (Simplest)

User speaks → Voice transcription → Command sent to terminal → CLI AI executes

```
Voice: "Claude, add unit tests for the user service"
       ↓
Transcription: "add unit tests for the user service"
       ↓
Terminal: claude-code "add unit tests for the user service"
       ↓
CLI AI: [reads files, writes tests, runs them]
       ↓
Output: streamed to terminal panel in browser
```

**Implementation**:

```typescript
// voice-to-cli-ai.ts
interface CLIAIConfig {
  tool: 'claude-code' | 'aider' | 'copilot';
  workingDir: string;
  env: Record<string, string>;
}

async function routeToCliAI(
  transcript: string,
  config: CLIAIConfig
): Promise<void> {
  const { tool, workingDir, env } = config;
  
  // Strip wake word if present
  const command = transcript
    .replace(/^(hey |okay )?(claude|aider|copilot),?\s*/i, '')
    .trim();
  
  // Build CLI command
  const cliCommand = buildCommand(tool, command);
  
  // Execute in workspace container
  const process = spawn(cliCommand.bin, cliCommand.args, {
    cwd: workingDir,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Stream output to browser
  process.stdout.on('data', (data) => {
    websocket.send({ type: 'cli-output', data: data.toString() });
  });
}

function buildCommand(tool: string, prompt: string) {
  switch (tool) {
    case 'claude-code':
      return { bin: 'claude-code', args: [prompt] };
    case 'aider':
      return { bin: 'aider', args: ['--message', prompt] };
    case 'copilot':
      return { bin: 'gh', args: ['copilot', 'suggest', prompt] };
  }
}
```

**Pros**: Simple, leverages existing CLI tools exactly as designed  
**Cons**: Limited control over AI behavior, output parsing challenges

---

### Approach B: API Wrapper (More Control)

Wrap CLI AI tools in a structured API that provides:
- Streaming output parsing
- Progress indicators
- File change notifications
- Confirmation prompts

```typescript
// cli-ai-wrapper.ts
interface CLIAIResponse {
  status: 'thinking' | 'editing' | 'running' | 'complete' | 'error';
  files_changed: string[];
  commands_run: string[];
  output: string;
  requires_confirmation?: {
    action: string;
    description: string;
  };
}

class ClaudeCodeWrapper {
  private process: ChildProcess | null = null;
  
  async execute(prompt: string): AsyncGenerator<CLIAIResponse> {
    this.process = spawn('claude-code', [prompt, '--output-format', 'json']);
    
    for await (const line of this.readLines(this.process.stdout)) {
      const event = JSON.parse(line);
      
      yield {
        status: this.mapStatus(event.type),
        files_changed: event.files || [],
        commands_run: event.commands || [],
        output: event.content || '',
        requires_confirmation: event.confirmation
      };
    }
  }
  
  async confirm(approved: boolean): Promise<void> {
    this.process?.stdin.write(approved ? 'y\n' : 'n\n');
  }
  
  cancel(): void {
    this.process?.kill('SIGINT');
  }
}
```

**UI Integration**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 Claude Code                                            ✕     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🎤 "Add authentication middleware to the Express app"          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 📂 Reading files...                                             │
│    • src/app.ts                                                 │
│    • src/routes/api.ts                                          │
│    • package.json                                               │
│                                                                 │
│ ✏️ Editing files:                                               │
│    • src/middleware/auth.ts (created)                           │
│    • src/app.ts (modified)                                      │
│                                                                 │
│ ⚠️ Confirm: Install jsonwebtoken package?                       │
│    [Yes] [No] [Show Details]                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Approach C: Headless Mode with File Watching

Run CLI AI in headless/non-interactive mode, watch filesystem for changes, sync to browser editor.

```typescript
// headless-cli-ai.ts
import { watch } from 'chokidar';

class HeadlessCLIAI {
  private watcher: FSWatcher;
  
  constructor(private workspaceDir: string) {
    this.watcher = watch(workspaceDir, {
      ignored: /node_modules|\.git/,
      persistent: true
    });
    
    this.watcher.on('change', (path) => {
      this.notifyFileChange(path);
    });
  }
  
  async runTask(prompt: string): Promise<void> {
    // Run CLI AI with auto-confirm for safe operations
    const result = await exec(
      `claude-code "${prompt}" --auto-confirm=safe --no-interactive`,
      { cwd: this.workspaceDir }
    );
    
    // File watcher will pick up changes and sync to editor
  }
  
  private notifyFileChange(path: string): void {
    websocket.send({
      type: 'file-changed',
      path: path.replace(this.workspaceDir, ''),
      content: fs.readFileSync(path, 'utf8')
    });
  }
}
```

---

## Voice Command Mapping

| Voice Command | CLI AI Action |
|---------------|---------------|
| "Claude, explain this function" | `claude-code "explain the function at cursor"` |
| "Add error handling here" | `claude-code "add try-catch error handling to selected code"` |
| "Write tests for this file" | `aider --message "write unit tests for {current_file}"` |
| "Fix the TypeScript errors" | `claude-code "fix all TypeScript compilation errors"` |
| "Refactor to use async await" | `aider "refactor callbacks to async/await in {current_file}"` |
| "Create a new API endpoint for users" | `claude-code "create GET/POST endpoints for /api/users"` |
| "What does this code do?" | `gh copilot explain` |
| "Run the tests and fix failures" | `claude-code "run tests, analyze failures, fix the code"` |

---

## Container Setup

### Dockerfile for CLI AI Environment

```dockerfile
FROM ubuntu:22.04

# Base tools
RUN apt-get update && apt-get install -y \
    curl git nodejs npm python3 pip \
    && rm -rf /var/lib/apt/lists/*

# Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Aider
RUN pip install aider-chat

# GitHub CLI + Copilot
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    gh extension install github/gh-copilot

# Environment variables (injected at runtime)
ENV ANTHROPIC_API_KEY=""
ENV OPENAI_API_KEY=""
ENV GITHUB_TOKEN=""

WORKDIR /workspace
```

### Runtime Configuration

```yaml
# cli-ai-config.yaml
cli_ai:
  default_tool: claude-code
  
  tools:
    claude-code:
      enabled: true
      auto_confirm:
        - file_read
        - file_write
        - git_status
      require_confirm:
        - git_push
        - npm_install
        - delete_file
      max_files_per_edit: 10
      
    aider:
      enabled: true
      model: claude-3-5-sonnet
      auto_commit: false
      
    copilot:
      enabled: true
      
  safety:
    blocked_commands:
      - rm -rf
      - sudo
      - curl | bash
    max_execution_time: 300  # seconds
    sandbox_network: true
```

---

## Authentication & API Keys

### Key Management

```typescript
// api-key-manager.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

interface APIKeys {
  anthropic?: string;
  openai?: string;
  github?: string;
}

async function injectAPIKeys(
  containerId: string,
  userId: string
): Promise<void> {
  const keys = await fetchUserKeys(userId);
  
  // Inject as environment variables
  await docker.exec(containerId, [
    'env',
    `ANTHROPIC_API_KEY=${keys.anthropic}`,
    `OPENAI_API_KEY=${keys.openai}`,
    `GITHUB_TOKEN=${keys.github}`
  ]);
}
```

### User Settings UI

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ CLI AI Settings                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ API Keys                                                        │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Anthropic (Claude Code)                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ sk-ant-••••••••••••••••••••••••          [Show] [Update]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ OpenAI (Aider)                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Not configured                                    [Add Key] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ GitHub (Copilot CLI)                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ Connected as @owenpkent                      [Reconnect] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Default CLI AI Tool                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ● Claude Code  ○ Aider  ○ Copilot CLI                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Voice Workflow Examples

### Example 1: Bug Fix Workflow

```
User: "Hey Claude, there's a bug where users can't log in"

Claude Code:
  1. Reads src/auth/login.ts
  2. Reads src/auth/login.test.ts
  3. Runs existing tests → finds failure
  4. Identifies issue: password hash comparison wrong
  5. Fixes the code
  6. Runs tests → all pass

Voice Response: "Found the bug in login.ts line 42. The password 
comparison was using equals instead of bcrypt compare. Fixed and 
tests are passing."

User: "Commit that"

Claude Code:
  git add .
  git commit -m "fix: use bcrypt.compare for password validation"
```

### Example 2: Feature Development

```
User: "Add a dark mode toggle to the settings page"

Claude Code:
  1. Reads current settings page
  2. Reads theme configuration
  3. Creates new ThemeToggle component
  4. Adds to settings page
  5. Updates CSS variables
  6. Tests in browser (if available)

Voice Response: "Added dark mode toggle. Created ThemeToggle 
component and wired it to the existing theme context. Want me 
to also add a keyboard shortcut?"

User: "Yes, control shift D"

Claude Code:
  1. Adds keyboard event listener
  2. Maps Ctrl+Shift+D to toggle
  3. Updates accessibility labels
```

---

## Security Considerations

### Sandboxing

```typescript
// sandbox-config.ts
const sandboxRules = {
  // Network restrictions
  network: {
    allowOutbound: [
      'api.anthropic.com',
      'api.openai.com',
      'api.github.com',
      'registry.npmjs.org'
    ],
    blockInbound: true
  },
  
  // Filesystem restrictions
  filesystem: {
    writablePaths: ['/workspace', '/tmp'],
    readOnlyPaths: ['/usr', '/etc'],
    blockedPaths: ['/root', '/home']
  },
  
  // Process restrictions
  process: {
    maxProcesses: 50,
    maxMemoryMB: 2048,
    maxCpuPercent: 100,
    noRoot: true
  }
};
```

### Audit Logging

```typescript
// audit-logger.ts
interface CLIAIAuditEvent {
  timestamp: Date;
  userId: string;
  workspaceId: string;
  tool: string;
  prompt: string;
  filesRead: string[];
  filesModified: string[];
  commandsRun: string[];
  duration: number;
  success: boolean;
  error?: string;
}

async function logCLIAIAction(event: CLIAIAuditEvent): Promise<void> {
  await db.auditLogs.insert(event);
  
  // Alert on suspicious activity
  if (event.commandsRun.some(cmd => isSuspicious(cmd))) {
    await alertSecurityTeam(event);
  }
}
```

---

## Implementation Phases

### Phase 1: Basic Integration (2 weeks)

- [ ] Terminal passthrough for claude-code
- [ ] Voice command → CLI AI routing
- [ ] Output streaming to browser terminal
- [ ] API key management UI

### Phase 2: Enhanced UX (2 weeks)

- [ ] Structured output parsing
- [ ] File change notifications
- [ ] Confirmation prompts for dangerous actions
- [ ] Progress indicators

### Phase 3: Multi-Tool Support (2 weeks)

- [ ] Aider integration
- [ ] Copilot CLI integration
- [ ] Tool switching via voice
- [ ] Per-project tool preferences

### Phase 4: Advanced Features (2 weeks)

- [ ] Conversation history with CLI AI
- [ ] Custom prompt templates
- [ ] Workspace snapshots before AI edits
- [ ] Rollback support

---

## Open Questions

1. **Output format**: Should CLI AIs output JSON for structured parsing, or keep human-readable?
2. **Concurrent sessions**: Allow multiple CLI AI sessions per workspace?
3. **Cost management**: How to handle API costs for heavy users?
4. **Offline mode**: Cache common operations for offline use?

---

## Related Documents

- [Cloud IDE Proposal](./cloud-ide-proposal.md)
- [Voice Input Proposal](./voice-input-proposal.md)
- [Android App Design](../android-app/design-doc.md)

---

*Document Version: 1.0*  
*Created: December 2024*
