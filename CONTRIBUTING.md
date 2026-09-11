# Contributing to Lights

Thanks for looking. Lights is deliberately small: **one HTML file, no build step, no dependencies,
no backend**. Keeping it that way is a feature, so the most useful contributions are the ones that
fit inside `index.html` without adding machinery around it.

Read [AGENTS.md](AGENTS.md) first. It is the working agreement for this repository — the patterns
the code repeats, what belongs in the simulation loop versus the render loop, how tests are owned,
and the Git policy. It applies to people and coding agents alike.

## Reporting a bug

Open an issue with:

- your **browser and version**, your **operating system**, and — for anything about speech — which
  system voices you have installed;
- what you did, what you expected, and what happened instead;
- whether it reproduces on a fresh reload, and anything the browser console printed.

Rendering, audio and speech differ sharply between Chromium, Gecko and WebKit, so naming the engine
is usually what makes a report actionable.

## Proposing a change

Open an issue before writing code for anything beyond a small fix. Say what you want to change, what
it would look like, and why the current behaviour does not fit.

Two things to know before you start:

- **A new file needs a stronger reason than tidiness.** The page is one file with one `<style>` and
  one `<script>`. The approved exception is dependency-free regression tests under `tests/`.
- **A change that breaks a recorded pattern stops and asks first**, naming the existing pattern, the
  proposed one, and why the existing one does not fit. Deviating is allowed; deviating silently is
  not. The patterns are listed in [AGENTS.md](AGENTS.md).

Accessibility is part of the change, not a follow-up: the field is fully keyboard-reachable and
announces what the cursor is on, and it stays that way.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org), in English — `feat:`, `fix:`,
  `docs:`, `chore:`, `perf:`, with a scope where it helps (`fix(seo): …`).
- One commit per concern. Do not split mechanically, and do not combine unrelated changes.
- When the commit belongs to an issue, end the subject with its number: `feat: add the portal
  cooldown (#54)`. Use the issue number, never the pull request's.
- Merges keep every commit: `gh pr merge <number> --merge --delete-branch`. **Never squash.**
- Small changes go straight to `main`. Branch when a change is large enough to want review before it
  reaches the live page — a push to `main` publishes, because GitHub Pages redeploys automatically.
- Add or update a focused test for changed behaviour, and never commit secrets, caches or build
  output. There is no `CHANGELOG.md`: the product has no versions or releases, and Git history is
  the record.

## Running the checks locally

The same two halves that CI runs, in the same order.

Cheap, with nothing installed:

```bash
node --test
```

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log('OK')"
```

Those are what [`.github/workflows/validate.yml`](.github/workflows/validate.yml) runs, gated on
`index.html` and `tests/**`.

Real engines, with the checking tool installed on demand — never a project dependency, and
`node_modules/` is ignored:

```bash
npm install --no-save playwright@1.63.0 && npx playwright install --with-deps
node tests/browser/acceptance.mjs
```

Pass `chromium`, `firefox` or `webkit` to run a single engine.
[`.github/workflows/browser-acceptance.yml`](.github/workflows/browser-acceptance.yml) runs all
three as a matrix, gated on `index.html` and `tests/browser/**`, with the Playwright version pinned.

Serve the page while you work with `python3 -m http.server 8000`.

Neither suite substitutes for human judgement on screen-reader behaviour, listening quality or
comfort under reduced motion. If you could not check something, say so in the pull request rather
than implying it passed.

## Conduct

Be decent and assume good faith; harassment or personal attacks are not welcome here.
