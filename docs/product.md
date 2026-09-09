# Lights — product definition

## What it is

A browser piece where forty points of light live together in a dark field: they drift, form and
break bonds, take on and lose personalities, age, die, are replaced, and speak when you select them.

## Who it is for

A person who wants something to sit with rather than something to finish. They open it on a second
monitor, or full screen at night, and let it run. They are not looking for a game, a tool, or a
tutorial, and they will leave the moment it asks them to accomplish something.

## The job

Give attention somewhere that rewards it without demanding it. Today that person uses a lo-fi
stream, a screensaver, or a generative-art tab: pleasant, but with nothing underneath. Nothing
happens in them that could not have happened five minutes earlier.

## What it does

- **Reveals a system that is actually running.** Charge, temperament, mood, reputation and
  relationships are simulated, not scripted. What a light does can be traced to what happened to it.
- **Lets someone be met.** Selecting a light makes it speak from its own state — who is near, who it
  keeps returning to, who it avoids, how alone it is right now. Two can be held at once, and they
  answer each other.
- **Keeps changing without being driven.** Personalities shift with mood and age, bonds rewire,
  strangers arrive and are named, and the field is read back as a society every half minute.
- **Answers a nudge.** Clicking detonates, right-clicking summons a comet, a portal pair or an
  attractor, and everything can be dragged. The field absorbs the interruption and carries on.

## What it will never do

- **No score, level, goal, or win state.** The moment there is something to achieve, the piece stops
  being somewhere to rest and becomes something to finish.
- **No accounts, saved progress, or server.** It is one static page. Nothing about a viewer leaves
  their browser, and there is nothing to sign into or lose.
- **No onboarding, tutorial, or tooltip tour.** Everything meaningful is discoverable by clicking
  around; a guide sits behind one control for anyone who wants it.
- **No configuration of the simulation.** Sliders control sound, not physics. Exposing the constants
  turns a world into a control panel, and tuning it is the author's job.
- **No cloud speech or generative text at runtime.** Voices are the viewer's own installed ones and
  lines come from a fixed written pool. This keeps it free, offline-capable, private, and silent
  about who is watching.
- **No localization for now.** The written lines are the work itself; translating 700 of them would
  produce a different piece, and system voice quality outside English is markedly worse.

## How you know it worked

Someone leaves it open. A session that ends within a few seconds means it read as a screensaver; a
session that runs for minutes means the system underneath became visible. The available signal is
qualitative — whether a viewer selects a second light after the first one speaks.

## Constraints

- **One static file.** `index.html` carries the markup, styles and simulation. No build step, no
  bundler, no dependencies, so it can be opened from disk or served by GitHub Pages unchanged.
- **Browser platform only.** Canvas 2D, Web Audio and Web Speech, degrading quietly where a browser
  lacks one.
- **The audio is CC BY 4.0** and its attribution travels with any copy. See `NOTICE.md`.
- **Free to host.** GitHub Pages, no backend, no paid service.
- **It must stay quiet by default.** Audio never starts without a gesture, and levels are conservative.
