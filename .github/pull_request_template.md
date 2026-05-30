<!--
Thanks for the pull request. Filling in the sections below speeds up
review. If a section doesn't apply, write "n/a".

For anything security-sensitive, follow SECURITY.md instead of opening a
public PR.
-->

## Summary

<!-- 1-3 bullets: what does this change and why? -->

## Related issue

<!-- e.g. Closes #123, or "no issue, drive-by typo fix" -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Docs only
- [ ] Build / CI / tooling
- [ ] Other (describe)

## Test plan

<!--
How did you verify this works? Bullet list of what you ran and what you
saw. For UI changes, mention which platform you tested on.
-->

- [ ] `npm test` passes (renderer / Vitest)
- [ ] `npm run test:rust` passes (cargo test)
- [ ] `npx tsc --noEmit` is clean
- [ ] Added or updated tests
- [ ] Tested in `python run.py` (not just a packaged build)
- [ ] Verified on Windows
- [ ] Verified on Linux

## Accessibility check

<!--
Any change that affects the dictation UI, click targets, or required
precision should answer this. Skip if irrelevant.
-->

- [ ] Click targets stay large and reachable
- [ ] No new requirement for fast or precise input
- [ ] Feedback (status text, audio meter) still clear

## Notes for reviewers

<!-- Anything subtle, surprising, or worth a closer look. -->
