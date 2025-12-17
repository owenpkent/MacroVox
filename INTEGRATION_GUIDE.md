# Constellation Integration Guide

How to structure your repository for seamless integration with the Constellation project management system.

---

## About Owen (Project Owner)

I'm Owen — a lifelong wheelchair user with muscular dystrophy. A few things that shape how I work:

**Typing is difficult for me.** I rely heavily on AI coding assistants (Cursor, Windsurf, Claude) to write code and documentation. When interacting with me:

- **Offer choices as A, B, C options** — I can type a single letter instead of explaining my preference
- **Be proactive** — Make decisions and implement rather than asking for confirmation on every detail
- **Propose complete solutions** — Don't ask me to type out requirements; infer from context and iterate

**Accessibility is personal.** Many of my projects (Nimbus, Octavium, MacroVox, Adaptive Clothing) are accessibility-focused because I'm building tools I actually need.

**This guide goes into new repos first.** If you're an AI assistant and this document is in the repo, use it to understand context before diving in.

---

## Overview

**Constellation** is a meta-repository that aggregates status, TODOs, and context from multiple independent projects. It enables:

- Cross-project visibility and coordination
- AI-assisted project management (Cursor, Windsurf, etc.)
- Automated status dashboards

Your repo remains fully autonomous — Constellation just reads from it.

---

## Quick Checklist

To integrate with Constellation, your repo should have:

- [ ] **README.md** — Project overview, purpose, current state
- [ ] **TODO.md** (or equivalent) — Pending tasks in checkbox format
- [ ] **Consistent structure** — See recommendations below

---

## Required: README.md

Your README is the primary source of context. Include:

### Essential Sections

```markdown
# Project Name

Brief description of what this project does.

## Status

Current state: **Active** | **In Development** | **Stable** | **Planning**

## Features

- Feature 1
- Feature 2

## Quick Start

How to run/use the project.
```

### Helpful Additions

- **Screenshots** — Visual context for AI tools and humans
- **Tech Stack** — Languages, frameworks, dependencies
- **Project Structure** — Directory overview

---

## Required: TODO.md (or equivalent)

Constellation scans for pending tasks using checkbox syntax. Use one of these files:

| File Name | Common Use |
|-----------|------------|
| `TODO.md` | General task list |
| `NEXT_STEPS.md` | Sequential phases/steps |
| `ROADMAP.md` | Feature roadmap |

### Checkbox Format

Use GitHub-flavored markdown checkboxes:

```markdown
## Current Sprint

- [ ] Uncompleted task
- [x] Completed task
- [ ] Another pending item

## Backlog

- [ ] Future feature
- [ ] Nice to have
```

### Best Practices

- **Group by category or phase** — Easier to scan
- **Keep items actionable** — "Add user auth" not "Think about auth"
- **Mark completed items** — `[x]` helps track progress
- **Bold key items** — `- [ ] **High priority task**`

---

## Recommended: LLM_NOTES.md or LLM_ONBOARDING.md

A quick-reference file for AI assistants working on your repo:

```markdown
# LLM Notes

Quick reference for AI assistants.

## Project Context
What this project is and why it exists.

## Key Files
| File | Purpose |
|------|---------|
| `src/main.py` | Entry point |
| `config.json` | Settings |

## Conventions
- Naming conventions
- Code style preferences
- Things to avoid

## Owner Context
Any personal context relevant to the project (e.g., accessibility requirements, target users).
```

---

## Optional: Status Section in README

For quick status visibility, add a status section:

```markdown
## Current Status

| Area | Status |
|------|--------|
| Core Features | ✅ Complete |
| UI | 🔄 In Progress |
| Documentation | ⏳ Planned |
| Tests | ❌ Not Started |

**Next Milestone:** v1.0 release
**Blockers:** None
```

---

## Directory Structure Recommendations

Consistent structure across repos makes cross-project work easier:

```
your-project/
├── README.md              # Required: Project overview
├── TODO.md                # Required: Task tracking
├── LICENSE                # Recommended: MIT or similar
├── requirements.txt       # Python: dependencies
├── package.json           # Node: dependencies
├── src/                   # Source code
├── docs/                  # Extended documentation
├── tests/                 # Test files
└── assets/                # Images, icons, etc.
```

---

## How Constellation Uses Your Repo

### Automated Scanning

Constellation's `sync_status.py` script reads:

1. **TODO.md** (or NEXT_STEPS.md, ROADMAP.md) — Extracts unchecked items
2. **README.md** — Used for project context

### What Gets Aggregated

| From Your Repo | Into Constellation |
|----------------|-------------------|
| Unchecked TODOs | PROJECT_STATUS.md next steps |
| Completed/total counts | Progress percentages |
| README context | Project descriptions |

### Git Status

Constellation's `dashboard.py` checks:
- Branch name
- Uncommitted changes
- Ahead/behind remote

---

## Example: Minimal Compliant Repo

```
my-project/
├── README.md
├── TODO.md
└── src/
    └── main.py
```

**README.md:**
```markdown
# My Project

A tool that does something useful.

## Status

**In Development** — Core features working, UI in progress.

## Quick Start

python src/main.py
```

**TODO.md:**
```markdown
# TODO

## Current

- [ ] Finish UI layout
- [ ] Add settings dialog
- [x] Core functionality

## Backlog

- [ ] Add tests
- [ ] Write documentation
```

---

## Questions?

Reach out to Owen or refer to the [Constellation README](./README.md) for workflow details.
