# MacroVox — Go-to-market strategy

How to get MacroVox in front of the people most likely to buy it. Covers
positioning, pricing, launch-day playbook, SEO content plan, and demo video
specs. This is a living doc — update it as we learn what converts.

> **Status:** pre-launch (v1.0.7 cycle). All numbers in this doc are working
> assumptions, not data. Replace with real metrics as soon as we have them.

---

## The wedge

MacroVox's most defensible angle right now is:

> **Wispr Flow / SuperWhisper, but on Linux too, and no API keys to manage.**

- Wispr Flow is Mac/Windows only.
- SuperWhisper is Mac-only.
- Dragon NaturallySpeaking has been coasting for a decade.
- Talon and whisper.cpp setups require config work most buyers won't do.

Lead every piece of copy with that wedge. Avoid generic "AI voice dictation"
framing — that puts MacroVox head-to-head with incumbents and loses on brand
recognition.

---

## Positioning, in priority order

1. **"Voice dictation that works everywhere you do."** Cross-platform — Linux is the kicker.
2. **"Press a key, speak, paste. No API keys, no setup."** Managed-service angle, vs Talon / open-source whisper.cpp setups that require fiddling.
3. **"AI cleanup that's actually fast."** Claude Haiku is genuinely fast; Wispr's cleanup has noticeable lag. The demo video should show this directly.

---

## Pricing

### Competitor pricing (verify before publishing comparisons)

| Product | Monthly | Annual | Notes |
|---|---|---|---|
| Wispr Flow | \$15/mo | \$144/yr (~\$12/mo) | Mac/Win |
| SuperWhisper | \$8.49/mo | \$84/yr | Mac-only |
| Dragon Professional | — | \$200 one-time | Legacy |
| ChatGPT Plus voice | \$20/mo | — | Voice→text→paste is manual |

### Recommendation

- **Pro: \$12/mo or \$108/yr (\$9/mo annual).** Undercut Wispr by \$3/mo. The \$9 annual price reads as "below \$10/mo," which matters for "I'll just expense it" buyers.
- **7-day free trial without a credit card** if Stripe allows. Conversion to paid drops vs. CC-required, but trial signups, word-of-mouth, and HN tolerance go up. For an indie launch we want flywheel, not maximum trial→paid extraction.
- **Launch promo: Lifetime \$199, capped at the first 100 buyers.** Generates revenue immediately, creates urgency, gives 100 evangelists. Wispr can't match this (VC-backed, needs ARR). Cap strictly — never reopen.
- **No free tier with limited minutes.** Too easy to abuse, and our variable cost (Deepgram per-minute + Claude per-token) is real.

### Landing page surgery

**Remove:**
- Any feature list longer than 6 bullets — choice paralysis.
- Generic stock photos of people on laptops.
- "Powered by AI" alone — meaningless in 2026; specify Deepgram + Claude.

**Add:**
- A live cost-of-typing calculator: "If you type 4 hours/day at 50 WPM, MacroVox at 150 WPM saves you ~10 hours/week." Numbers people share screenshots of.
- One real-user quote with a face — even one beats none. If we have zero now, get five users to give a quote in exchange for a free year.

---

## Launch-day playbook

### When to launch

**Tuesday or Wednesday, 7:00–9:00 AM Eastern.** HN front-page algorithm
rewards early traction; that window catches US East commuters, Europe
afternoon, and gives 6h of activity before West Coast lunch.

### Pre-launch checklist

These must be done before posting anywhere:

- [ ] Landing page above-the-fold has a 10–15s autoplaying muted GIF/video — not screenshots
- [ ] Pricing visible without scrolling, not behind a "Get Started" CTA
- [ ] Comparison table vs Wispr / SuperWhisper / Dragon, factual not snarky
- [ ] 7-day trial works without a credit card if at all possible
- [ ] "Linux" mentioned in the hero or first feature row
- [ ] Status page / GitHub issues link visible — establishes "real product"
- [ ] Mobile-responsive (~40% of HN traffic)

### Show HN post

**Title:** `Show HN: MacroVox – AI voice dictation for Linux and Windows`

**Body:**

```
I built MacroVox because every good voice dictation app I tried (Wispr Flow,
SuperWhisper) was Mac/Windows only, and Dragon NaturallySpeaking has been
coasting for a decade.

It's a Tauri + Rust app — ~5 MB installer, ~30 MB RAM at idle. Press
Ctrl+Space, speak, release; the transcript gets cleaned up by Claude Haiku
and auto-pasted into whatever window had focus. Streaming via Deepgram
Nova-3, ~300ms perceived latency.

Cross-platform: Windows + Linux today (.deb, .rpm, AppImage), macOS next.
Wayland has known limits — auto-paste is disabled (enigo can't inject keys
reliably) and the UI tells you so.

Managed service — no API keys, \$X/mo with a 7-day trial. Auth via
Supabase, billing via Stripe.

Architecture writeup: <link to ARCHITECTURE.md>
Tradeoffs / known limits: happy to answer in comments.
```

### Reddit posts (each gets its own angle)

| Subreddit | Angle | Lead with |
|---|---|---|
| r/linux | Native Linux app, AppImage + .deb + .rpm, no telemetry, link to GitHub for transparency | "I built a voice dictation app that runs natively on Linux." |
| r/productivity | Speed: 150 WPM cleaned vs ~50 WPM typing | The 30s demo video |
| r/RSI | Pain — typing 8 hrs a day, real wrist damage. Acknowledge Talon and Dragon | "I built this because typing was destroying my wrists." |
| r/ChatGPT, r/OpenAI | "ChatGPT voice mode but it actually pastes into your apps." | The auto-paste demo |
| r/selfhosted | **Skip.** We're managed-service; will get downvoted for "vendor lock-in" | — |

### Twitter/X thread

1. **Hook tweet:** 30s vertical demo video. Copy: "I built a voice dictation app that works on Linux. Watch this."
2. The wedge: "Wispr Flow is great but Mac/Win only. SuperWhisper is Mac-only. Dragon is dying. So I built MacroVox."
3. Tech stack tweet (devs love this): Tauri, Rust, Deepgram Nova-3, Claude Haiku cleanup
4. The Linux flex: AppImage screenshot or `.deb` install gif
5. Pricing tweet (price + free trial)
6. CTA tweet with link, **pinned**

### Day-of execution

- Post **Show HN at 7:00 AM ET.**
- Post Reddit threads **30 min later** (don't simul-post; HN shouldn't be a Reddit sublink in the first hour).
- Sit on the comments for **6 straight hours.** Reply to every single one for the first 90 min.
- **No sales tone in replies** — be the engineer, answer the technical questions, admit the rough edges.
- Tweet the HN link **90 min after posting** (gives it time to gather upvotes organically first).
- **Never ask anyone to upvote.** HN detects vote rings and downranks.

### Failure mode

If HN doesn't take, the Reddit threads will still drive 200–500 trial signups
over the week. The launch isn't wasted. But measure conversion to **paid**,
not just signups — HN audience trial-installs and converts at lower rates
than Reddit r/RSI or r/productivity.

---

## SEO content plan

**Reality check:** SEO is 6-month payback. Don't expect launch-week traffic
from this. But every post written now compounds when an HN visitor 4 months
from now searches "macrovox vs wispr."

### Keyword targets, ranked by effort/return

| Keyword | Search intent | Difficulty | Why it matters |
|---|---|---|---|
| `wispr flow alternative` | High commercial | Low (Wispr brand new) | Direct competitor takeaway |
| `wispr flow linux` | High commercial | Very low | Their gap, our strength |
| `voice dictation linux` | Mid commercial | Low | Underserved category |
| `dragon naturallyspeaking alternative` | High commercial | Mid (lots of legacy SEO) | Big addressable market |
| `voice typing for developers` | Mid commercial | Low | Niche, high-LTV audience |
| `superwhisper windows` | High commercial | Very low | Their gap, our strength |
| `chatgpt voice dictation alternative` | Mid commercial | Mid | Capture confused buyers |

### 5 posts to write, in order

1. **"MacroVox vs Wispr Flow: An Honest Comparison" (1500 words).** Side-by-side feature table. **Be fair to Wispr** — credit their UX and Mac integration. Lead with where we're better (Linux, price, Claude cleanup). Wispr-vs posts are read by people already half-sold; they convert at 5–10× the homepage rate.

2. **"Voice Dictation on Linux in 2026: A Survey" (2000 words).** Cover Talon, nerd-dictation, whisper.cpp, voice2json, MacroVox. Honest about each. MacroVox is "the managed option for people who don't want to configure anything." Linux users trust survey posts more than vendor pages — this ranks well in r/linux and HN bookmarks.

3. **"Dragon NaturallySpeaking Is Dead. Here Are 4 Modern Replacements" (1200 words).** High commercial intent. Big addressable market — millions of older Dragon users who haven't found a replacement. List Wispr, SuperWhisper, MacroVox, and one local-only option (Talon or whisper.cpp setup) for fairness. Our unique angle: "and one of them runs on Linux."

4. **"Why I Built MacroVox: Voice Dictation for Developers" (1000 words, founder voice).** Personal story. Why Tauri over Electron. Why Linux mattered. Show the architecture diagram. Devs share founder posts; PMs/marketers don't. This is the post that earns a second HN moment 3 months later.

5. **"How to Set Up Voice Typing to Reduce RSI" (1500 words).** General-audience, RSI-focused. MacroVox is one option among ergo keyboards, posture changes, breaks. Lower commercial intent per visit, but RSI-driven users convert at high LTV — they don't churn because they're solving real pain.

**Don't write yet:** any post requiring existing user data ("our users save X hours per week"). Wait until we have the data.

### Distribution per post

Posting links to r/SEO is wasted. Post the **content** (excerpted) to:
- Post #2 → r/linux
- Post #4 → r/programming, r/rust
- Post #5 → r/RSI, r/AccessibilityTech

Native Reddit posts that link back to our blog beat link drops 10:1.

---

## Demo video

We need three cuts of the same shoot.

### A. 30s vertical (X / TikTok / IG Reels / YouTube Shorts) — primary asset

| Time | Visual | Voiceover / on-screen text |
|---|---|---|
| 0:00–0:02 | Hands on keyboard, dramatic stop. On-screen: "Stop typing." | (silent, hook visual) |
| 0:02–0:05 | Hand moves away. Press Ctrl+Space (show key overlay). MacroVox HUD appears. | "Press a key…" |
| 0:05–0:18 | Real-time dictation into a Gmail compose window. Show the live transcript. Sample sentence: "Hey Sarah, just confirming the meeting moves to Thursday at 2 — I'll send the deck tonight." | "…speak…" |
| 0:18–0:23 | Release key. AI cleanup happens. Show "gonna" → "going to," filler removed. | "…and the AI cleans it up." |
| 0:23–0:27 | Auto-paste fires. Email is composed and ready to send. | "Pasted, ready to send." |
| 0:27–0:30 | Logo + "macrovox.app — 7 days free" | (silent CTA) |

**Production notes:**

- **Real environment.** No fake mockups. Use real Gmail or real VS Code.
- **Real audio of you speaking.** Ambient room tone. Imperfect but human. Don't use TTS.
- **Show the "um" being cleaned.** Say "um, hey Sarah, like, just confirming…" — the cleanup removing those is the magic moment. People rewind that.
- **No music** for the 30s cut. Silence + voice + key clicks = product confidence. Music says "marketing."
- **Captions burned in** — 80% of social video is watched muted.

### B. 60–90s long version (YouTube + landing page hero)

Same opening. After 0:27, instead of CTA, show:
- Slack message dictation (different app)
- Linux desktop (the wedge — even just 3 seconds of GNOME or KDE)
- The voice history panel (playback at correct speed — pre-empts "what about my data?" objection)
- Settings / model picker (signals depth)
- *Then* CTA at end

### C. Silent looping GIF for landing page hero (5–8s)

Loop of 0:05–0:18 only — the live dictation. No CTA, no end card. Low file
size. Autoplay muted. This is what 80% of landing-page visitors judge the
product on.

### The most common mistake

Demo videos show the **UI**, not the **outcome.** Our video should make a
viewer think "I could send my morning emails in 90 seconds instead of 15
minutes." Lead with the sent email, not the floating microphone widget.

---

## Sequencing

### This week
1. **Demo video** (A + C cuts) — blocks everything else. Without these, launch day is dead.
2. Pricing decision (lifetime promo? annual price?) and update Stripe + landing page.
3. Comparison table on landing page.

### Next week
4. Write posts **#1 (Wispr comparison) and #4 (founder story).** Schedule, don't publish.
5. Tighten landing page per the "remove/add" list.
6. Get 5 quotes from existing users.

### Week 3
7. Final preflight on the v1.0.7 release (use [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)).
8. **Launch day:** HN + Reddit + Twitter. Posts #1 and #4 publish the same day on the blog.

### Weeks 4–8
9. Posts #2, #3, #5 cadence — one per week.
10. Watch which Reddit thread had the highest conversion; double down on that subreddit's tone for future content.

---

## What to avoid right now

- **Google / X paid ads.** Burns cash fast at this stage; no LTV data yet to model CAC.
- **Affiliate programs.** Premature — needs an existing creator network to be worth the operational cost.
- **Translations.** Premature — ship one language well before splitting effort.
- **Press releases.** Tech press doesn't cover indie launches without a hook bigger than "we shipped." Save for v2 or a milestone (5,000 paid users, raised funding, etc.).

---

## Metrics to track from launch day

| Metric | Where | What it tells us |
|---|---|---|
| Trial signups by source | Stripe + Supabase + UTM tags | Which channel actually works |
| Trial → paid conversion | Stripe | Are we attracting buyers or tourists |
| Day-7 retention of paying users | Supabase | Is the product good enough |
| Show HN front-page rank by hour | HN itself | Calibrate timing for next launch |
| r/linux upvote ratio | Reddit | How well the Linux wedge lands |
| Landing page → trial-start conversion | Plausible / Fathom / GA | Is the page itself working |

Don't track vanity metrics (total page views, follower count) at this stage.

---

## Open questions

These need decisions before launch — flag in the GitHub issue tracking the launch:

- [ ] Final monthly + annual price
- [ ] Lifetime promo: yes/no, count, end condition
- [ ] CC-or-no-CC on free trial
- [ ] Email capture for "notify on macOS"? (probably yes — tags non-Linux interest for later)
- [ ] Public roadmap or private? (public is more credible at this stage; risk is competitor ripping it off)
