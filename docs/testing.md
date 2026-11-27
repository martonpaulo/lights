# Test ownership and commands

Moved from `AGENTS.md`.

The product has no build step or package dependencies. `package.json` only names the tasks: `pnpm validate` is the cheap half and the CI gate, `pnpm test:browser` the expensive one. The checks come in two halves, and the
pipeline is gated so each runs only when something it can observe has changed.

- **Cheap, nothing installed.** `node --test` runs the regressions under `tests/`, which load the
  real `index.html` through `tests/harness.js` — a `vm` context with a virtual clock, a DOM built
  from the page's own markup, and switchable Web Speech and Web Audio globals. `index.html` ships no
  test hooks. Tests exercise observable simulation transitions and browser API boundaries, not
  source-text snapshots, duplicated constants or private implementation wiring. `scripts/check-embedded-script.mjs`
  checks that the embedded script parses and runs first. Both run as `pnpm validate`. Workflow:
  `.github/workflows/validate.yml`, gated on `site/**`, `tests/**` and the checking script.
- **Expensive, real engines.** `node tests/browser/acceptance.mjs [engine]` serves `site/` and
  drives Chromium, Gecko and WebKit. Playwright is a checking tool installed on demand, never a
  project dependency and never loaded by the page; `node_modules/` is ignored. Workflow:
  `.github/workflows/browser.yml`, gated on `site/**` and `tests/browser/**` and
  pinned to one Playwright version so a cache hit means the same browser builds.

Node tests do not substitute for the rendered checks, and neither substitutes for the human
judgements — screen-reader behaviour, listening quality, comfort under reduced motion — which must
be reported as unverified rather than claimed.
