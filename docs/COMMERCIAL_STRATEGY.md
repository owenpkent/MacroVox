# GitConnect Commercial Strategy

## Overview

**Product Name**: GitConnect (commercial) / MacroVox (open source upstream)
**Domain**: gitconnect.pro
**Tagline**: Voice-powered GitHub editing from anywhere

---

## Repository Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        OPEN SOURCE                              │
│  owenpkent/MacroVox (upstream)                                  │
│  - MIT License                                                  │
│  - Community contributions welcome                              │
│  - Core voice-to-code functionality                             │
│  - Generic branding                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fork / sync
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COMMERCIAL                               │
│  GitConnectPro/gitconnect (or similar org name)                 │
│  - Same MIT License (or proprietary additions)                  │
│  - GitConnect branding                                          │
│  - Hosted at gitconnect.pro                                     │
│  - Premium features (optional future)                           │
│  - Analytics, user accounts, etc.                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Action Checklist

### Phase 1: Organization Setup (Today)

- [ ] **Create GitHub Organization**
  - Go to: https://github.com/organizations/new
  - Suggested name: `GitConnectPro` or `gitconnect-app`
  - Add billing info if needed for private repos

- [ ] **Fork MacroVox to Organization**
  - Fork `owenpkent/MacroVox` → `GitConnectPro/gitconnect`
  - Or create fresh repo and push web/ contents

- [ ] **Create GitHub OAuth App (under org)**
  - Go to: https://github.com/organizations/YOUR_ORG/settings/applications
  - New OAuth App:
    - Name: GitConnect
    - Homepage: https://gitconnect.pro
    - Callback: https://gitconnect.pro/api/github-auth/callback

### Phase 2: Deployment (Today)

- [ ] **Connect Netlify to org repo**
  - Link `GitConnectPro/gitconnect` to Netlify
  - Set build directory: `web/`
  - Build command: `npm run build`
  - Publish directory: `web/dist`

- [ ] **Add custom domain**
  - In Netlify: Domain settings → Add custom domain → gitconnect.pro
  - Update DNS (where you registered gitconnect.pro):
    ```
    Type: CNAME
    Name: @ (or www)
    Value: YOUR-SITE.netlify.app
    ```
  - Or use Netlify DNS (recommended)

- [ ] **Set environment variables in Netlify**
  - `GITHUB_CLIENT_ID` = (from OAuth app)
  - `GITHUB_CLIENT_SECRET` = (from OAuth app)

### Phase 3: Branding (Optional, Later)

- [ ] Rename app title from "MacroVox" to "GitConnect"
- [ ] Update logo/favicon
- [ ] Add landing page at gitconnect.pro
- [ ] Add pricing page (if monetizing)

---

## Sync Strategy (Upstream ↔ Commercial)

### Pulling from Upstream (open source → commercial)

```bash
# In commercial repo
git remote add upstream https://github.com/owenpkent/MacroVox.git
git fetch upstream
git merge upstream/main --no-commit
# Review changes, resolve conflicts, commit
```

### Contributing Back (commercial → open source)

For features that should be open source:
1. Create branch in upstream repo
2. Cherry-pick or port changes
3. Submit PR to upstream

### What Stays Commercial-Only

- GitConnect branding
- Analytics/tracking code
- User account system (future)
- Premium features (future)
- Marketing pages

---

## Monetization Options (Future)

| Model | Description |
|-------|-------------|
| **Freemium** | Free for public repos, paid for private |
| **Usage-based** | Free tier with API call limits |
| **Teams** | Org-level features, SSO, audit logs |
| **Sponsorship** | GitHub Sponsors for open source |

---

## DNS Configuration for gitconnect.pro

### Option A: Netlify DNS (Recommended)
1. In Netlify → Domains → Add domain → gitconnect.pro
2. Netlify will provide nameservers
3. Update your registrar to use Netlify nameservers

### Option B: External DNS
Add these records at your registrar:
```
Type    Name    Value
A       @       75.2.60.5
CNAME   www     YOUR-SITE.netlify.app
```

---

## Next Immediate Steps

1. **Create GitHub org** → https://github.com/organizations/new
2. **Fork repo to org** → Fork button on MacroVox repo
3. **Create OAuth App** → Org settings → Developer settings → OAuth Apps
4. **Tell me the org name** → I'll update the OAuth callback URLs and deploy

---

## Questions to Decide

1. **Org name**: `GitConnectPro`, `gitconnect-app`, or other?
2. **Repo visibility**: Public (recommended for trust) or Private?
3. **License**: Keep MIT, or add commercial clause?
4. **Rebrand now or later?**: Ship as MacroVox first, rebrand after validation?
