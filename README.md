# Small Lights

Forty points of light drift, bond, age and speak in a dark field.

**[Open it →](https://martonpaulo.com/small-lights/)**

## What happens in there

Every light is a person with a temperament: how steady it is, how much company it wants, how hard
it feels what happens to it. Some carry a divergent trait — restless, single-minded, easily
overwhelmed, self-regulating. All of it is simulated, so what a light does can be traced to what
happened to it.

- **Energy** runs from −1 to +1 and drifts with experience. Opposites attract, like repels like, and
  the colour of a light is its charge.
- **Relationships** accumulate. Time spent close counts for or against depending on whether two fit,
  a hard collision is remembered as an offence, and every light settles on a closest friend and a
  rival it steers toward and away from.
- **Experience changes behaviour.** Each light trains a tiny online model from its own encounters,
  then approaches people it expects to get along with and avoids those it does not.
- **Entanglement** pairs the most distant unbound lights. Bound pairs flicker in antiphase and pass
  each other mirrored impulses across the field.
- **Lives end.** A light ages a year every fourteen seconds, changes personality as it passes
  through its stages, and eventually fades. Its place stays empty a while before someone new arrives
  with a fresh name and history.
- **The field is read back** as a society every half minute: polarised, fragmented, crowded, feuding,
  learning, or settling into clusters found by k-means.

## Using it

| Gesture | What it does |
| --- | --- |
| Click a light | Selects it and lets it speak |
| Ctrl or Cmd + click | Holds a second one; the two answer each other |
| Click empty space | Detonates there — click again to stack the blast |
| Right-click | Summons a comet, a portal pair or an attractor at that point |
| Drag | Moves a light or a summon |
| Escape | Clears the selection |

Sound starts only after you interact, and the panel controls music, voices and effects separately.
Levels persist in your browser.

## Requirements

A current browser with Canvas 2D, Web Audio and Web Speech. Voices come from your own operating
system; on Chrome the Google neural voices sound markedly better than the compact system ones. The
piece runs without them, silently.

## Running it locally

No build, no dependencies. Serve the folder over HTTP so the audio loads:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Validation

There is no build or test runner. Check the embedded JavaScript before publishing:

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.match(/<script>([\\s\\S]*?)<\\/script>/)[1]);console.log('OK')"
```

Then serve the page locally and confirm that it starts with forty lights and no console errors
in Chromium, Gecko and WebKit. Separate dependency-free regression tests using `node:test` are
approved; once tests exist, run them with `node --test`. No persistent tests are present yet.

## Security

There is no backend, account, dependency or secret configuration. Every repository file is served
publicly by GitHub Pages, so credentials and private data must never be added to the project.

## Privacy

Everything runs in your browser. Nothing is sent anywhere, there is no analytics, no account and no
server. The only thing stored is your three volume levels, in `localStorage`.

## Limitations

- Speech quality depends entirely on the voices your system has installed.
- English only. The written lines are the work, and translating them would produce a different piece.
- Tuned for a desktop-sized window; it runs on a phone but the field gets crowded.

## License and attribution

This work is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The background track is "Space ambient mix.mp3" by Almusic34, also CC BY 4.0, via the
[Free Music Archive](https://freemusicarchive.org/music/almusic34/single/space-ambient-mixmp3).
See [NOTICE.md](NOTICE.md).
