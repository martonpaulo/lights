# Patterns this project repeats

Moved from `AGENTS.md`.

These are the recorded project contracts. Open issues track places where the current code does
not yet satisfy them; do not weaken a contract to hide an implementation gap. A change that would
break a recorded contract or establish a new pattern stops and asks first, naming the existing
pattern, the proposed one, and why the existing one does not fit.

- **One file, three layers.** `site/index.html` holds markup, a single `<style>` block, and a single
  `<script>`. No build step, no modules, no dependencies. A second file needs a reason stronger than
  tidiness. The owner-approved exception is separate dependency-free regression tests.
- **Two loops.** `simulationStep()` on a 16 ms `setInterval` owns world time, physics and state;
  `requestAnimationFrame` owns drawing and owns no simulation. Anything that changes the world goes
  in the first, including the lifetimes of things that only draw. The world nearly pauses while the
  document is hidden, because the browser throttles the interval, and resumes without compensating
  for hidden elapsed time; this does not override explicit music playback intent.
- **A node is a flat object with one life-owner.** Every trait is a plain property on the node.
  `freshLife()` owns every per-life and transient field and runs on both paths — the first cast in
  `rs()` and every replacement in `reborn()` — so a new trait is added in one place and cannot leak
  between lives. Only slot identity (size, hub flag) and the authored first-life cast are set by the
  caller.
- **Pair state lives in typed arrays.** `affinity` and `regard` are `Float32Array` indexed by
  `pairKey(i, j)`. They are cleared for a node's row and column when it is reborn.
- **Absent nodes take no part.** A slot waiting to be reborn is skipped by physics, rendering,
  bonding, selection, speech and events. Every new loop over `n` honours `absent`.
- **Draw cost stays off the hot path.** Repeated visuals are pre-rendered (glow sprites) or cached
  (background gradient, vignette) rather than rebuilt per frame. Canvas shadows are avoided.
- **Three type voices.** Serif for anything a node is or says, system sans for interface, monospace
  for figures. Colour carries meaning that text would otherwise repeat.
- **Audio is one bus.** Every synthesised sound routes through `sfxGain`; music is the `<audio>`
  element; speech is the Web Speech API. Each has exactly one slider.
- **Speech is one voice at a time**, and only for a selected node.
- **Written lines are data.** Phrase pools are flat arrays of plain sentences with no contractions,
  because the text is spoken aloud. Placeholders are `{name}`, `{friend}`, `{rival}`.
- **Announcements are gated.** Everything user-visible goes through `announceEvent`, which enforces
  one at a time and a cooldown for minor notes.
