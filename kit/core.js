// Shared browser runtime for kit games (served at /kit/core.js). Hand-written on a bare
// PIXI.Application (pixi.js 7.4.3, loaded as the global PIXI from /vendor/pixi.min.js).
// Nothing here decides an outcome: the server runs the engine, the page plays back its events.

export const ease = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c = 1.7, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

export const G = () => new PIXI.Graphics();

/** Pixi 7 core has no drawStar (it lives in graphics-extras). */
export function star(g, x, y, points, outer, inner) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.drawPolygon(pts);
}

/** Regular polygon helper (diamond = 4, hexagon = 6, ...). */
export function polygon(g, x, y, sides, r, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < sides; i++) { const a = rot + (i * Math.PI * 2) / sides; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.drawPolygon(pts);
}

export const mix = (a, b, t) => {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255, br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};
export const css = (n) => "#" + n.toString(16).padStart(6, "0");

export function canvasTex(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  return PIXI.Texture.from(cv);
}

export function txt(s, style) {
  const t = new PIXI.Text(s, new PIXI.TextStyle(style));
  t.anchor.set(0.5);
  return t;
}

export const money = (cents) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Waits for web fonts (e.g. Google Fonts) with a timeout so offline play still starts. */
export async function loadFonts(specs, timeoutMs = 2500) {
  try { await Promise.race([Promise.all(specs.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, timeoutMs))]); } catch {}
}

/**
 * Creates the Pixi application letterboxed into #stage, plus a tween engine on its ticker.
 * Returns the kit object every other client module takes.
 */
export function createKit({ width = 1280, height = 720, background = 0x0b0d1a, mount = document.getElementById("stage") } = {}) {
  const app = new PIXI.Application({ width, height, backgroundColor: background, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
  mount.prepend(app.view);
  const fit = () => {
    const s = Math.min(innerWidth / width, innerHeight / height);
    const w = Math.floor(width * s), h = Math.floor(height * s);
    Object.assign(app.view.style, { width: w + "px", height: h + "px" });
    Object.assign(mount.style, { width: w + "px", height: h + "px" });
  };
  addEventListener("resize", fit);
  fit();

  const resize=(w,h)=>{
    if(![w,h].every(n=>Number.isFinite(n)&&n>0))throw Error('Canvas dimensions must be positive');
    width=w;height=h;app.renderer.resize(w,h);fit();
  };
  const tweens = new Set();
  function tween(target, to, ms, fn = ease.out, onUpdate) {
    if(!target||typeof target!=='object'||!to||typeof to!=='object'||!Number.isFinite(ms)||ms<0||typeof fn!=='function'||(onUpdate!==undefined&&typeof onUpdate!=='function'))throw Error('Use tween(target, to, milliseconds, easing?, onUpdate(progress)?); animate(milliseconds, progress => ...) animates effects.');
    return new Promise((resolve) => {
      const from = {};
      for (const k in to) from[k] = target[k];
      tweens.add({ target, from, to, ms: Math.max(1, ms), fn, el: 0, resolve, onUpdate });
    });
  }
  // Progress is a scalar from 0 to 1; target tween callbacks observe mutated target fields.
  const animate=(ms,onUpdate,{easing=ease.linear}={})=>{
    if(typeof onUpdate!=='function')throw Error('Use animate(milliseconds, progress => ...)');
    const state={progress:0};
    return tween(state,{progress:1},ms,easing,()=>onUpdate(state.progress));
  };
  const wait = (ms) => tween({ v: 0 }, { v: 1 }, ms, ease.linear);
  app.ticker.add(() => {
    const dt = app.ticker.deltaMS;
    for (const t of [...tweens]) {
      t.el += dt;
      const p = Math.min(1, t.el / t.ms), e = t.fn(p);
      for (const k in t.to) t.target[k] = t.from[k] + (t.to[k] - t.from[k]) * e;
      if (t.onUpdate) t.onUpdate(p);
      if (p >= 1) { tweens.delete(t); t.resolve(); }
    }
  });
  const pulse = (obj, s = 1.18, ms = 160) => tween(obj.scale, { x: s, y: s }, ms).then(() => tween(obj.scale, { x: 1, y: 1 }, ms * 1.6, ease.back));

  /** Draw Graphics directly or add composed children; renders a fixed-size texture. */
  function bake(draw, w, h) {
    const c = G();
    draw(c);
    const t = app.renderer.generateTexture(c, { region: new PIXI.Rectangle(0, 0, w, h), resolution: 2 });
    c.destroy({ children: true });
    return t;
  }
  const imageOf = (texture) => app.renderer.extract.base64(new PIXI.Sprite(texture));

  return { app, W: width, H: height, fit, resize, tween, animate, wait, pulse, bake, imageOf };
}

/** Web Audio synth. Create once; call ensure() from a user gesture. Games add cues with Object.assign. */
export function createSound() {
  return {
    ctx: null, on: true,
    ensure() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(f, d, { type = "sine", v = 0.15, to = null, at = 0 } = {}) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + d + 0.05);
    },
    noise(d, { v = 0.2, f = 800, to = null, at = 0 } = {}) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + at;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), filt = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf;
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(f, t);
      if (to) filt.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(filt).connect(g).connect(c.destination);
      src.start(t);
    },
    spin() { this.noise(0.4, { v: 0.05, f: 2600, to: 900 }); },
    stop() { this.tone(120, 0.14, { type: "triangle", v: 0.22, to: 60 }); this.noise(0.05, { v: 0.06, f: 1500 }); },
    coin() { this.tone(1568, 0.16, { type: "square", v: 0.05 }); this.tone(2093, 0.26, { type: "square", v: 0.045, at: 0.07 }); },
    thump() { this.tone(80, 0.18, { v: 0.35, to: 45 }); },
    pop() { this.tone(660, 0.08, { type: "triangle", v: 0.12, to: 220 }); this.noise(0.08, { v: 0.05, f: 2400 }); },
    morph() { this.tone(440, 0.25, { type: "sine", v: 0.08, to: 880 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, { type: "triangle", v: 0.1, at: i * 0.09 })); },
    fanfare() { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.4, { type: "square", v: 0.05, at: i * 0.11 })); },
    tick() { this.tone(2600, 0.03, { type: "square", v: 0.025 }); },
    whoosh() { this.noise(0.9, { v: 0.12, f: 3000, to: 200 }); },
  };
}

/** Talks to lib/server.mjs. `?debug` opens the player's debug panel; `?debug=<spec>` forces every
 * spin to that feature (server needs DEBUG_FEATURES=1). spin(bet, { debug }) forces one spin. */
export function createApi() {
  const post = async (path, body) => {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  };
  const params = new URLSearchParams(location.search);
  const debug = params.get("debug") || undefined;
  let id = null;
  return {
    debugRequested: params.has("debug"),
    debugSpec: debug,
    async session() { const s = await post("/api/session"); id = s.id; return s; },
    spin: (bet, { buy, debug: once } = {}) => post("/api/spin", { id, bet, buy, debug: once ?? debug }),
    choose: (optionIds) => post("/api/choose", { id, optionIds }),
  };
}

// ---------------------------------------------------------------- engine event helpers

/** Splits one engine call's events into passes, each starting at a board-resolve. Events before
 * the first board-resolve (mode-enter carried from a buy, etc.) form a pass with `board: null`. */
export function splitPasses(events) {
  const passes = [];
  let cur = { board: null, resolve: null, events: [] };
  for (const e of events) {
    if (e.type === "board-resolve") {
      if (cur.resolve || cur.events.length) passes.push(cur);
      cur = { board: e.board.cells.map((col) => col.map((c) => c.symbol)), resolve: e, events: [] };
    } else cur.events.push(e);
  }
  if (cur.resolve || cur.events.length) passes.push(cur);
  return passes;
}

/**
 * Board as [col][row] = { sym, val, mult, locked } from a board-resolve. Board cells carry no
 * values: values and multipliers arrive as symbol-mutate events, so `prev` (the previous model)
 * supplies them for cells that kept their symbol, following gravity when holes were destroyed.
 */
export function boardFrom(resolve, prev = null, destroyed = []) {
  const next = resolve.board.cells.map((col) => col.map((c) => ({ sym: c.symbol, val: 0, mult: 0, locked: !!c.locked })));
  if (!prev) return next;
  if (resolve.iteration === 0) {
    // a fresh deal keeps values only on cells that stayed locked (held coins, sticky symbols)
    next.forEach((col, c) => col.forEach((cell, r) => { const old = prev[c]?.[r]; if (cell.locked && old?.sym === cell.sym) { cell.val = old.val; cell.mult = old.mult; } }));
    return next;
  }
  const gone = new Set(destroyed.map(([c, r]) => `${c},${r}`));
  next.forEach((col, c) => {
    const old = prev[c] ?? [];
    const survivors = old.filter((_, r) => !gone.has(`${c},${r}`));
    // gravity: survivors sit at the bottom (down) or top (up) in order; check against the engine's board
    const off = col.length - survivors.length;
    const down = gone.size > 0 && survivors.every((s, k) => col[off + k]?.sym === s.sym);
    const up = !down && gone.size > 0 && survivors.every((s, k) => col[k]?.sym === s.sym);
    col.forEach((cell, r) => {
      const src = down ? survivors[r - off] : up ? survivors[r] : old[r];
      if (src && src.sym === cell.sym) { cell.val = src.val; cell.mult = src.mult; }
    });
  });
  return next;
}

/**
 * Accumulator / spin-counter values with carry-forward. The engine emits no state-update for a
 * write that leaves the value unchanged, so a meter must keep its last known value.
 */
export function createMeters(seeds = {}) {
  const values = { ...seeds };
  return {
    values,
    apply(e) {
      if (e.type !== "state-update") return false;
      values[`${e.namespace}:${e.key}`] = Number(e.newValue);
      return true;
    },
    get: (namespace, key, fallback = 0) => values[`${namespace}:${key}`] ?? fallback,
  };
}

/** Sum of a round's spin-settle totals as a total-bet multiple (display only; the server's
 * totalWin in credits is the authority). */
export const settledMultiple = (events) => events.filter((e) => e.type === "spin-settle").reduce((s, e) => s + Number(e.totalWin), 0);
