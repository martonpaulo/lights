// Loads the embedded simulation from index.html into a controlled environment so
// regression tests can drive it without a browser. The page has no module seam by
// design (one file, three layers), so the seam is created here: the source is run in
// a vm context together with an appended accessor that hands back the live bindings.
//
// Nothing in this file is shipped. index.html stays free of test hooks.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = join(ROOT, 'index.html');

/** The identifiers the tests observe. Anything else stays private to the page. */
const EXPOSED = [
  'n', 'e', 't', 'events', 'bombs', 'selection', 'selected', 'audioStarted',
  'toneContext', 'availableVoices', 'eventLabel', 'encounters', 'affinity', 'regard',
  'camX', 'camY', 'activeSpeech', 'pendingSpeech', 'speakQueue', 'selectedEvent',
  'dragged', 'draggedEvent', 'bonds', 'blastStack', 'musicChosen', 'calm', 'lastCaption',
];

const FUNCTIONS = [
  'rs', 'go', 'reborn', 'ageField', 'driftPersonalities', 'speakNode', 'pickVoice',
  'loadVoices', 'unlockAudio', 'startMusic', 'toggleMusic', 'dropBomb', 'spawnComet',
  'spawnPortals', 'spawnAttractor', 'updateEvents', 'announceEvent', 'learningPass',
  'socialPass', 'clearBonds', 'pairForces', 'simulationStep', 'lifeStage',
  'converse', 'runQueue', 'endSpeechSession', 'replyPartner',
];

export function readPage() {
  return readFileSync(PAGE, 'utf8');
}

export function readScript() {
  const html = readPage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('index.html has no inline <script> block');
  return match[1];
}

/** Deterministic linear congruential generator, so runs are repeatable. */
function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

class Clock {
  constructor(startedAt = 1_700_000_000_000) {
    this.now = startedAt;
    this.timers = new Map();
    this.nextId = 1;
  }

  set(callback, delay, repeat) {
    const id = this.nextId++;
    this.timers.set(id, { callback, due: this.now + (delay || 0), every: repeat ? delay || 0 : null });
    return id;
  }

  clear(id) {
    this.timers.delete(id);
  }

  /** Runs every callback whose deadline falls inside the advanced window. */
  advance(ms) {
    const until = this.now + ms;
    let guard = 0;
    for (;;) {
      let soonest = null;
      for (const [id, timer] of this.timers) {
        if (timer.due <= until && (!soonest || timer.due < soonest.timer.due)) soonest = { id, timer };
      }
      if (!soonest) break;
      if (++guard > 200000) throw new Error('timer storm: a callback keeps rescheduling inside the window');
      this.now = soonest.timer.due;
      if (soonest.timer.every == null) this.timers.delete(soonest.id);
      else soonest.timer.due = this.now + Math.max(1, soonest.timer.every);
      soonest.timer.callback();
    }
    this.now = until;
  }
}

const CONTEXT_METHODS = [
  'setTransform', 'fillRect', 'clearRect', 'beginPath', 'arc', 'fill', 'stroke', 'moveTo',
  'lineTo', 'save', 'restore', 'translate', 'scale', 'rotate', 'drawImage', 'putImageData',
  'fillText', 'closePath', 'strokeRect', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'clip',
];

function makeContext2d() {
  const ctx = {
    canvas: null,
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (text) => ({ width: String(text).length * 7 }),
  };
  // Off by default; tests turn it on for a frame when the drawing itself is the contract.
  ctx.recording = false;
  ctx.calls = [];
  for (const name of CONTEXT_METHODS) ctx[name] = (...args) => { if (ctx.recording) ctx.calls.push([name, ...args]); };
  return ctx;
}

class Classes {
  constructor(owner) {
    this.owner = owner;
    this.set = new Set();
  }
  add(...names) { names.forEach((name) => this.set.add(name)); }
  remove(...names) { names.forEach((name) => this.set.delete(name)); }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : force;
    if (on) this.set.add(name); else this.set.delete(name);
    return on;
  }
  contains(name) { return this.set.has(name); }
}

class Element {
  constructor(tag, id, page) {
    this.tagName = String(tag).toUpperCase();
    this.id = id || '';
    this.page = page;
    this.children = [];
    this.parentNode = null;
    this.classList = new Classes(this);
    this.dataset = {};
    this.attributes = new Map();
    this.style = {
      values: new Map(),
      setProperty(name, value) { this.values.set(name, value); },
      getPropertyValue(name) { return this.values.get(name) ?? ''; },
    };
    this.listeners = new Map();
    this.value = '';
    this._text = '';
  }

  get className() { return [...this.classList.set].join(' '); }
  set className(value) {
    this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get textContent() {
    return this.children.length ? this.children.map((child) => child.textContent).join('') : this._text;
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }

  get nextElementSibling() {
    if (!this.parentNode) return null;
    const at = this.parentNode.children.indexOf(this);
    return this.parentNode.children[at + 1] || null;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
    this._text = '';
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((item) => item !== handler));
  }
  dispatch(type, event = {}) {
    const payload = { type, target: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const handler of [...(this.listeners.get(type) || [])]) handler(payload);
    return payload;
  }

  focus() { this.page.activeElement = this; }
  blur() { if (this.page.activeElement === this) this.page.activeElement = this.page.body; }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.page.width, bottom: this.page.height, width: this.page.width, height: this.page.height, x: 0, y: 0 };
  }
  querySelector(selector) { return this.page.querySelector(selector, this); }
  querySelectorAll(selector) { return this.page.querySelectorAll(selector, this); }
  get children_() { return this.children; }
}

class Canvas extends Element {
  constructor(id, page) {
    super('canvas', id, page);
    this.width = 300;
    this.height = 150;
    this.context = makeContext2d();
    this.context.canvas = this;
    this.captured = new Set();
  }
  getContext() { return this.context; }
  get clientWidth() { return this.id === 'c' ? this.page.width : this.width; }
  get clientHeight() { return this.id === 'c' ? this.page.height : this.height; }
  setPointerCapture(id) { this.captured.add(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

class AudioElement extends Element {
  constructor(id, page) {
    super('audio', id, page);
    this.paused = true;
    this.muted = true;
    this.volume = 1;
    this.loads = 0;
    this.playRejects = false;
  }
  load() {
    this.loads++;
    if (!this.paused) { this.paused = true; this.dispatch('pause'); }
  }
  play() {
    if (this.playRejects) return Promise.reject(new Error('NotAllowedError'));
    if (this.paused) { this.paused = false; this.dispatch('play'); }
    return Promise.resolve();
  }
  pause() {
    if (!this.paused) { this.paused = true; this.dispatch('pause'); }
  }
}

/** The handful of elements index.html declares, rebuilt without a parser. */
function buildPage(width, height) {
  const page = {
    width,
    height,
    byId: new Map(),
    activeElement: null,
    documentElement: null,
    body: null,
    listeners: new Map(),
  };

  const make = (tag, id) => {
    const element = tag === 'canvas' ? new Canvas(id, page)
      : tag === 'audio' ? new AudioElement(id, page)
        : new Element(tag, id, page);
    if (id) page.byId.set(id, element);
    return element;
  };

  page.make = make;
  page.documentElement = make('html');
  page.body = make('body');
  page.activeElement = page.body;

  make('canvas', 'c');
  make('audio', 'music');
  const soundButton = make('button', 'sound');
  soundButton.textContent = '▶';
  for (const id of ['volume', 'voices-volume', 'sfx-volume']) {
    const slider = make('input', id);
    slider.type = 'range';
    slider.value = '1';
  }
  make('div', 'caption');
  make('output', 'kinetic-energy');
  make('div', 'selection-ring');
  make('p', 'hint').classList.add('gone');
  make('button', 'help');
  const menu = make('div', 'summon-menu');
  for (const kind of ['comet', 'portal', 'attractor']) {
    const button = make('button');
    button.dataset.summon = kind;
    menu.append(button);
  }
  make('div', 'audio-panel');
  make('div', 'energy-panel');

  page.querySelector = (selector, scope) => {
    if (selector.startsWith('#')) return page.byId.get(selector.slice(1)) || null;
    const all = page.querySelectorAll(selector, scope);
    return all[0] || null;
  };
  page.querySelectorAll = (selector, scope) => {
    const roots = scope ? [scope] : [...page.byId.values()];
    const wanted = selector.replace(/^\./, '');
    const hit = [];
    const walk = (element) => {
      if (selector.startsWith('.') ? element.classList.contains(wanted) : element.tagName === selector.toUpperCase()) hit.push(element);
      element.children.forEach(walk);
    };
    roots.forEach(walk);
    return hit;
  };

  return page;
}

function makeSpeech(clock) {
  const spoken = [];
  let voices = [];
  const listeners = new Map();
  const synthesis = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => voices,
    speak(utterance) {
      spoken.push(utterance);
      synthesis.speaking = true;
      // Utterances complete on the next clock advance, the way a browser drains them.
      clock.set(() => {
        synthesis.speaking = false;
        utterance.onend && utterance.onend({});
      }, 10, false);
    },
    cancel() {
      synthesis.speaking = false;
      synthesis.pending = false;
      spoken.forEach((utterance) => { utterance.cancelled = true; });
    },
    resume() { synthesis.paused = false; },
    pause() { synthesis.paused = true; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener() {},
  };
  return {
    synthesis,
    spoken,
    setVoices(next) {
      voices = next;
      for (const handler of listeners.get('voiceschanged') || []) handler({});
    },
  };
}

function makeAudioContextClass(clock, log) {
  const param = () => ({
    value: 0,
    setValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    cancelScheduledValues() { return this; },
  });
  const node = (type) => {
    const it = {
      type: '',
      nodeType: type,
      frequency: param(),
      Q: param(),
      gain: param(),
      detune: param(),
      buffer: null,
      loop: false,
      connect(target) { log.connections.push([type, target && target.nodeType]); return target; },
      disconnect() {},
      start() { log.started.push(type); },
      stop() {},
    };
    return it;
  };
  return class AudioContextStub {
    constructor() {
      this.sampleRate = 44100;
      this.destination = node('destination');
      log.created++;
    }
    get currentTime() { return clock.now / 1000; }
    createGain() { return node('gain'); }
    createOscillator() { return node('oscillator'); }
    createBiquadFilter() { return node('filter'); }
    createConvolver() { return node('convolver'); }
    createBufferSource() { return node('source'); }
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, numberOfChannels: channels, getChannelData: (i) => data[i] };
    }
    resume() { return Promise.resolve(); }
  };
}

/**
 * Boots index.html's script.
 *
 * @param {object} options
 * @param {boolean} [options.speech]  expose window.speechSynthesis
 * @param {boolean} [options.audio]   expose window.AudioContext
 * @param {boolean} [options.reducedMotion] what matchMedia reports
 */
export function loadField(options = {}) {
  const {
    speech = true,
    audio = true,
    reducedMotion = false,
    width = 1440,
    height = 900,
    seed = 12345,
    random: randomOverride = null,
    voices = defaultVoices(),
    autoStart = true,
  } = options;

  const clock = new Clock();
  const page = buildPage(width, height);
  const random = randomOverride || seededRandom(seed);
  const errors = [];
  const audioLog = { created: 0, connections: [], started: [] };
  const speechKit = speech ? makeSpeech(clock) : null;
  const frames = [];
  const mediaQueries = new Map();

  const documentStub = {
    documentElement: page.documentElement,
    body: page.body,
    get activeElement() { return page.activeElement; },
    querySelector: (selector) => page.querySelector(selector),
    querySelectorAll: (selector) => page.querySelectorAll(selector),
    createElement: (tag) => page.make(tag),
    createElementNS: (ns, tag) => page.make(tag),
    createTextNode: (text) => { const node = page.make('#text'); node.textContent = text; return node; },
    addEventListener: (type, handler) => windowStub.addEventListener(type, handler),
    removeEventListener: (type, handler) => windowStub.removeEventListener(type, handler),
    hidden: false,
    visibilityState: 'visible',
    dispatch: (type, event) => windowStub.dispatch(type, event),
  };

  const listeners = new Map();
  const windowStub = {
    addEventListener(type, handler, options_) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, once: !!(options_ && options_.once) });
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type);
      if (list) listeners.set(type, list.filter((item) => item.handler !== handler));
    },
    dispatch(type, event = {}) {
      const payload = { type, preventDefault() {}, stopPropagation() {}, ...event };
      const list = [...(listeners.get(type) || [])];
      listeners.set(type, list.filter((item) => !item.once));
      for (const item of list) item.handler(payload);
      return payload;
    },
    matchMedia(query) {
      if (!mediaQueries.has(query)) {
        const list = {
          media: query,
          matches: /prefers-reduced-motion\s*:\s*reduce/.test(query) ? reducedMotion : false,
          handlers: [],
          addEventListener(type, handler) { if (type === 'change') list.handlers.push(handler); },
          removeEventListener(type, handler) { list.handlers = list.handlers.filter((item) => item !== handler); },
          addListener(handler) { list.handlers.push(handler); },
          removeListener(handler) { list.handlers = list.handlers.filter((item) => item !== handler); },
          set(matches) {
            list.matches = matches;
            list.handlers.forEach((handler) => handler({ matches, media: query }));
          },
        };
        mediaQueries.set(query, list);
      }
      return mediaQueries.get(query);
    },
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 2,
  };

  const store = new Map();
  const localStorageStub = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };

  class UtteranceStub {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.onend = null;
      this.onerror = null;
      this.onstart = null;
    }
  }

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorageStub,
    console: { log() {}, warn(...args) { errors.push(['warn', ...args]); }, error(...args) { errors.push(['error', ...args]); } },
    __random: random,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.now])); }
      static now() { return clock.now; }
    },
    setTimeout: (callback, delay) => clock.set(callback, delay, false),
    clearTimeout: (id) => clock.clear(id),
    setInterval: (callback, delay) => clock.set(callback, delay, true),
    clearInterval: (id) => clock.clear(id),
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => {},
    structuredClone,
    performance: { now: () => clock.now },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = windowStub.addEventListener;
  sandbox.removeEventListener = windowStub.removeEventListener;
  sandbox.matchMedia = windowStub.matchMedia;
  sandbox.innerWidth = width;
  sandbox.innerHeight = height;
  sandbox.devicePixelRatio = 2;

  if (speech) {
    sandbox.speechSynthesis = speechKit.synthesis;
    sandbox.SpeechSynthesisUtterance = UtteranceStub;
    windowStub.speechSynthesis = speechKit.synthesis;
    windowStub.SpeechSynthesisUtterance = UtteranceStub;
  }
  if (audio) {
    const AudioContextStub = makeAudioContextClass(clock, audioLog);
    sandbox.AudioContext = AudioContextStub;
    windowStub.AudioContext = AudioContextStub;
  }

  const context = vm.createContext(sandbox);
  vm.runInContext('Math.random = __random;', context);
  const accessor = `\n;globalThis.__field = {${
    EXPOSED.map((name) => `get ${name}(){return typeof ${name}==='undefined'?undefined:${name}},set ${name}(value){${name}=value}`).join(',')
  },fn:{${
    FUNCTIONS.map((name) => `get ${name}(){return typeof ${name}==='undefined'?undefined:${name}}`).join(',')
  }}};\n`;

  let source = readScript();
  vm.runInContext(source + accessor, context, { filename: 'index.html' });

  if (speech) speechKit.setVoices(voices);

  const harness = {
    context,
    clock,
    page,
    errors,
    audioLog,
    frames,
    localStorage: localStorageStub,
    speech: speechKit,
    mediaQuery: (query) => windowStub.matchMedia(query),
    field: sandbox.__field,
    canvas: page.byId.get('c'),
    music: page.byId.get('music'),
    caption: page.byId.get('caption'),
    element: (id) => page.byId.get(id),
    window: windowStub,
    document: documentStub,
    advance: (ms) => clock.advance(ms),
    /** Runs the pending animation-frame callbacks `count` times. */
    frame(count = 1, step = 16) {
      for (let i = 0; i < count; i++) {
        const pending = frames.splice(0, frames.length);
        clock.advance(step);
        for (const callback of pending) callback(clock.now);
      }
    },
    livingNodes: () => sandbox.__field.n.filter((node) => !node.absent),
    /** Presses the pointer over a node's current position, the way a click does. */
    press(node, extra = {}) {
      const canvas = page.byId.get('c');
      return canvas.dispatch('pointerdown', {
        pointerId: 1,
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: node.x + sandbox.__field.camX,
        clientY: node.y + sandbox.__field.camY,
        ...extra,
      });
    },
    /** Presses empty space at the given field coordinates. */
    pressAt(fieldX, fieldY, extra = {}) {
      const canvas = page.byId.get('c');
      return canvas.dispatch('pointerdown', {
        pointerId: 1,
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: fieldX + sandbox.__field.camX,
        clientY: fieldY + sandbox.__field.camY,
        ...extra,
      });
    },
    key(key, extra = {}) {
      return windowStub.dispatch('keydown', { key, ...extra });
    },
    /** Changes the viewport the way a window resize does. */
    resize(nextWidth, nextHeight) {
      page.width = nextWidth;
      page.height = nextHeight;
      windowStub.innerWidth = nextWidth;
      windowStub.innerHeight = nextHeight;
      windowStub.dispatch('resize', {});
    },
    /** Runs pending animation-frame callbacks without advancing the clock. */
    drawOnly(count = 1, step = 20) {
      let stamp = clock.now;
      for (let i = 0; i < count; i++) {
        const pending = frames.splice(0, frames.length);
        stamp += step;
        for (const callback of pending) callback(stamp);
      }
    },
    /** Runs the fixed simulation step directly, without drawing anything. */
    step(count = 1) {
      for (let i = 0; i < count; i++) sandbox.__field.fn.simulationStep();
    },
    /** Draws one frame with the 2d context recording what it was asked to do. */
    recordFrame() {
      const ctx = page.byId.get('c').context;
      ctx.calls = [];
      ctx.recording = true;
      harness.frame(1);
      ctx.recording = false;
      return ctx.calls;
    },
  };

  if (autoStart) harness.frame(1);
  return harness;
}

export function defaultVoices() {
  return [
    voice('Samantha', 'en-US', true),
    voice('Alex', 'en-US', true),
    voice('Daniel', 'en-GB', true),
    voice('Karen', 'en-AU', true),
    voice('Google US English', 'en-US', false),
    voice('Google UK English Male', 'en-GB', false),
  ];
}

export function voice(name, lang, localService) {
  return { name, lang, localService, default: false, voiceURI: name };
}
