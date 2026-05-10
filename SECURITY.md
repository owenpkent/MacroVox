# Security Policy

## Supported Versions

MacroVox follows a rolling-release model. Only the latest published release
on the `main` branch (and the binaries it produces) is supported with
security fixes. Older versions are not patched.

| Version          | Supported          |
| ---------------- | ------------------ |
| Latest `main`    | :white_check_mark: |
| Anything older   | :x:                |

## Reporting a Vulnerability

If you find a security issue in MacroVox, please report it privately so we
have a chance to fix it before the details are public.

- **Preferred channel:** GitHub Security Advisories on
  [okstudio1/MacroVox](https://github.com/okstudio1/MacroVox/security/advisories/new).
  This keeps the report private to the maintainers and tracks the response.
- **Email fallback:** `owenpkent@gmail.com` with `[MacroVox security]` in the
  subject line.

Please include:
1. A description of the issue and the impact you believe it has.
2. Reproduction steps (a minimal repro is ideal, but any detail helps).
3. The version or commit SHA you tested against.
4. Your preferred credit name, if any (default is "anonymous reporter").

### What to expect

- **Acknowledgement:** within 3 business days.
- **Initial assessment:** within 7 business days, including a rough fix
  timeline or a reason we believe the report is out of scope.
- **Disclosure:** coordinated. We aim to ship a fix within 30 days of a
  confirmed report and to publish an advisory at release time. Longer
  timelines are possible for issues that need cross-vendor coordination
  (e.g., Tauri, Supabase, Netlify); we will keep you in the loop.

### Scope

In scope:
- The MacroVox desktop app (Tauri/Rust backend, React renderer).
- The Netlify functions in `netlify/functions/` (Claude and Deepgram proxies).
- The Supabase Edge Functions in `supabase/functions/` (Stripe billing).
- The release/update pipeline (signing, updater manifest, etc.).

Out of scope:
- Supabase, Stripe, Netlify, Anthropic, Deepgram, or any other upstream
  service's own security. Report those directly to the vendor.
- Findings that require the attacker to already have local code-execution
  on the user's machine, unless they enable escalation we would not
  otherwise have (e.g., extraction of secrets we believed were protected).
- Social engineering, physical attacks, or denial-of-service via resource
  exhaustion (the app is single-user desktop software).

### Safe harbor

Good-faith security research that follows this policy is welcome. We will
not pursue legal action against researchers who:
- Avoid privacy violations, data destruction, or service degradation.
- Do not access more data than necessary to demonstrate the issue.
- Give us a reasonable window to fix before disclosure.
