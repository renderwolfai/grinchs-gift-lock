// Art mode (served at /kit/stylized.js): every game has two looks. "prototype" is the procedural
// vector art drawn in code; "stylized" is generated art (Renderwolf, made by tools/stylize.mjs)
// read from the game's public/art/manifest.json. The stylized look is only selectable once the
// manifest says `status: "ready"`; until then the toggle stays disabled and polls for it.
//
// manifest.json: { status: "generating" | "ready" | "partial", version, missing?: [ids], fallbacks?: [ids],
//   images: { ID: { file, kind: "symbol" | "overlay" | "cell" | "background" | "anim", modes?: "base" | "feature" | [modeIds], orientation?: "landscape" | "portrait" } } }
//   symbol      replaces tex[ID] (and every alias of it), fitted inside the cell
//   overlay     presentation art outside the reels, loaded at its native aspect ratio in art.images
//   cell        a cell background, covering the cell: tex[key], "cellBg" (default) or "cellFrame"
//               (the framed tile behind high-value picture symbols)
//   background  full-stage backdrop; "base" (default) for the base game, "feature" for every other mode
//   anim        a sprite sheet of the still `of` (registered onto it), in art.anims:
//               { of, state, w, h, cols, rows, frames, fps, loop, pingpong?, fadeIn? }. Played with
//               playFrames / overlaySprite; the player plays "win" and "land" ones on the reels

const KEY = `artMode:${location.pathname}`;

/** The selected mode: ?art=prototype|stylized wins (and is remembered), else the saved choice. */
export function artModeChoice() {
  const q = new URLSearchParams(location.search).get("art");
  if (q === "prototype" || q === "stylized") { localStorage.setItem(KEY, q); return q; }
  return localStorage.getItem(KEY) === "stylized" ? "stylized" : "prototype";
}

async function fetchManifest() {
  try {
    const res = await fetch(`art/manifest.json?t=${Date.now()}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Resamples an image into a w×h texture at 2× resolution: "contain" for symbols, "cover" for cells. */
function fitTexture(img, w, h, fit) {
  const R = 2, canvas = document.createElement("canvas");
  canvas.width = Math.round(w * R); canvas.height = Math.round(h * R);
  const x = canvas.getContext("2d");
  x.imageSmoothingQuality = "high";
  const s = (fit === "cover" ? Math.max : Math.min)(canvas.width / img.width, canvas.height / img.height);
  const dw = img.width * s, dh = img.height * s;
  x.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  return PIXI.Texture.from(canvas, { resolution: R });
}

/**
 * Loads the art mode. `cell` is the symbol cell size in stage points; `ticker` is the game's
 * (kit.app.ticker), which animations run on so they keep game time like the kit's tweens.
 * → { mode, stylized, ready, manifest, images: { ID: Texture }, anims: { ID: anim }, backgrounds: [{ id, texture, modes }] }
 * Falls back to prototype when stylized is chosen but the art is not ready or fails to load.
 */
export async function loadArt({ cell, ticker = PIXI.Ticker.shared }) {
  const manifest = await fetchManifest();
  const ready = manifest?.status === "ready";
  let mode = artModeChoice();
  const art = { mode, stylized: false, ready, manifest, images: {}, anims: {}, fonts: {}, backgrounds: [] };
  if (mode !== "stylized" || !ready) { art.mode = "prototype"; return art; }
  try {
    await Promise.all(Object.entries(manifest.images).filter(([, it]) => it.kind !== "anim").map(async ([id, it]) => {
      const img = await loadImage(`art/${it.file}?v=${manifest.version ?? ""}`);
      if (it.kind === "background") art.backgrounds.push({ id, texture: PIXI.Texture.from(img), modes: it.modes ?? "base", orientation: it.orientation ?? (img.height > img.width ? "portrait" : "landscape") });
      else art.images[id] = it.kind === "overlay" ? PIXI.Texture.from(img) : fitTexture(img, cell.w, cell.h, it.kind === "cell" ? "cover" : "contain");
    }));
    await Promise.all(Object.entries(manifest.fonts ?? {}).map(async ([id, entry]) => {
      try {
        const response = await fetch(`art/${entry.file}?v=${manifest.version ?? ""}`);
        if (!response.ok) throw Error(`Missing glyph metadata: ${id}`);
        const font = await response.json();
        if (!font.identityVerified) throw Error(`Unreviewed art font: ${id}`);
        art.fonts[id] = { ...font, texture: PIXI.Texture.from(await loadImage(`art/${entry.atlas}?v=${manifest.version ?? ""}`)) };
      } catch (error) { console.warn(`Art font ${id} failed to load; retain the game's lettering fallback:`, error.message); }
    }));
    art.stylized = true;
  } catch (e) {
    console.warn("stylized art failed to load, using prototype art:", e.message);
    Object.assign(art, { mode: "prototype", images: {}, fonts: {}, backgrounds: [] });
    return art;
  }
  // animations are extras: one that fails to load leaves its still
  await Promise.all(Object.entries(manifest.images).filter(([, it]) => it.kind === "anim" && art.images[it.of]).map(async ([id, it]) => {
    try { art.anims[id] = { ...animFrames(await loadImage(`art/${it.file}?v=${manifest.version ?? ""}`), it, manifest.images[it.of].kind === "overlay" ? { w: it.w * 2, h: it.h * 2 } : cell), ticker }; }
    catch (e) { console.warn(`animation ${id} failed to load, showing the still:`, e.message); }
  }));
  return art;
}

/** Cuts a registered sheet into frame textures sized like the still they animate (`size` in points). */
function animFrames(img, it, size) {
  const base = PIXI.BaseTexture.from(img, { resolution: it.w / size.w });
  const frames = [...Array(it.frames).keys()].map((i) => new PIXI.Texture(base, new PIXI.Rectangle((i % it.cols) * size.w, Math.floor(i / it.cols) * size.h, size.w, size.h)));
  return { ...it, frames };
}

/** The animation of still `of` for `state` ("idle", "win", "land", a reaction), or null. */
export function animFor(art, of, state) {
  return Object.values(art.anims ?? {}).find((a) => a.of === of && a.state === state) ?? null;
}

/**
 * Plays `anim` on `sprite` (whose texture is the still), then puts the still back. Loops for
 * `anim.loop` unless `loops` says how many times; honours `pingpong`, and `fadeIn` by fading the
 * still out over the first frames. Time comes from `ticker` (the game's, set by loadArt).
 * → { done: Promise, stop({ restore = true }), playing }
 */
export function playFrames(sprite, anim, { still = sprite.texture, loops = anim.loop ? Infinity : 1, ticker = anim.ticker ?? PIXI.Ticker.shared } = {}) {
  const idx = [...anim.frames.keys()];
  const seq = anim.pingpong ? [...idx, ...idx.slice(1, -1).reverse()] : idx;
  let elapsed = 0, fade = null, resolve;
  if (anim.fadeIn) { fade = new PIXI.Sprite(still); fade.anchor.copyFrom(sprite.anchor); sprite.addChild(fade); }
  const run = { playing: true, done: new Promise((r) => (resolve = r)) };
  run.stop = ({ restore = true } = {}) => {
    if (!run.playing) return;
    run.playing = false;
    ticker.remove(tick);
    if (fade && !fade.destroyed) fade.destroy();
    // only put the still back when nothing else changed the sprite meanwhile
    if (restore && !sprite.destroyed && anim.frames.includes(sprite.texture)) sprite.texture = still;
    resolve();
  };
  function draw() {
    if (sprite.destroyed) return run.stop({ restore: false });
    const i = Math.floor((elapsed / 1000) * anim.fps);
    if (Math.floor(i / seq.length) >= loops) return run.stop();
    sprite.texture = anim.frames[seq[i % seq.length]];
    if (fade) { fade.alpha = Math.max(0, 1 - i / anim.fadeIn); if (!fade.alpha) { fade.destroy(); fade = null; } }
  }
  const tick = () => { elapsed += ticker.deltaMS; draw(); };
  ticker.add(tick);
  draw();
  return run;
}

/**
 * A sprite for overlay art `id` (a character or prop outside the reels): the generated still,
 * looping its `idle` animation when there is one. `sprite.react(state)` plays that animation once
 * (e.g. "react" on a big win), then returns to the idle. null when there is no generated still,
 * so the game draws its procedural version instead.
 */
export function overlaySprite(art, id, { idle = "idle" } = {}) {
  const still = art.images?.[id];
  if (!still) return null;
  const sprite = new PIXI.Sprite(still);
  const idleAnim = animFor(art, id, idle);
  let current = null, turn = 0;
  const startIdle = () => { current = idleAnim ? playFrames(sprite, idleAnim, { still }) : null; };
  sprite.react = async (state) => {
    const a = animFor(art, id, state);
    if (!a || sprite.destroyed) return;
    const mine = ++turn;
    current?.stop({ restore: false });
    current = playFrames(sprite, a, { still });
    await current.done;
    if (mine === turn && !sprite.destroyed) startIdle();
  };
  startIdle();
  return sprite;
}

/**
 * Swaps stylized textures into `tex` by symbol id after the game has built its prototype art.
 * Aliases (tex.W1 = tex.WILD) follow their source; a "cell" image becomes tex[key ?? "cellBg"].
 */
export function applyStylized(tex, art) {
  if (!art.stylized) return;
  for (const [id, texture] of Object.entries(art.images)) {
    const { kind, key: cellKey } = art.manifest.images[id];
    const key = kind === "cell" ? cellKey ?? "cellBg" : id;
    const old = tex[key];
    for (const k of Object.keys(tex)) if (old && tex[k] === old) tex[k] = texture;
    tex[key] = texture;
  }
}

/** The background for one orientation's list: a listed-mode or "feature" background, else the base one. */
function backgroundIn(bgs, modeId, baseId) {
  const listed = bgs.find((b) => Array.isArray(b.modes) && b.modes.includes(modeId));
  if (listed) return listed.texture;
  if (modeId !== baseId) { const f = bgs.find((b) => b.modes === "feature"); if (f) return f.texture; }
  return bgs.find((b) => b.modes === "base")?.texture ?? null;
}

/**
 * The background texture for a mode and stage orientation. A background composed for the
 * stage's orientation wins; otherwise the other orientation's background is cover-cropped.
 */
export function backgroundFor(art, modeId, baseId, orientation = "landscape") {
  const bgs = art.backgrounds, matches = (b) => (b.orientation ?? "landscape") === orientation;
  return backgroundIn(bgs.filter(matches), modeId, baseId) ?? backgroundIn(bgs.filter((b) => !matches(b)), modeId, baseId);
}

/**
 * A stage-sized sprite that shows the stylized background for the current mode; call
 * `show(modeId)` on mode changes. Invisible in prototype mode. `fit(rect, orientation)` covers a
 * different rectangle (in the sprite's parent space), e.g. the visible viewport of a scaled world.
 */
export function backdropSprite(art, { W, H, baseId, orientation = "landscape" }) {
  const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  let rect = { x: 0, y: 0, width: W, height: H }, shape = orientation, current = baseId;
  sprite.visible = false;
  sprite.show = (modeId = current) => {
    current = modeId;
    const t = art.stylized ? backgroundFor(art, modeId, baseId, shape) : null;
    sprite.visible = !!t;
    if (!t) return;
    sprite.texture = t;
    // cover the rectangle, centred
    const s = Math.max(rect.width / t.width, rect.height / t.height);
    sprite.scale.set(s); sprite.position.set(rect.x + (rect.width - t.width * s) / 2, rect.y + (rect.height - t.height * s) / 2);
  };
  sprite.fit = (next, nextOrientation = shape) => { rect = { ...next }; shape = nextOrientation; sprite.show(); };
  sprite.show(baseId);
  return sprite;
}

/**
 * The "Prototype | Stylized" switch, top-right of #stage. Disabled (with the reason) until the
 * stylized art is ready; polls the manifest meanwhile. Switching reloads the page once idle.
 * `at` overrides the CSS position, e.g. { top: "8px", left: "8px" } when the corner is taken.
 */
export function artToggle(art, { busy = () => false, at = { top: "8px", right: "8px" }, theme = {} } = {}) {
  const css = (value, fallback) => typeof value === "number" ? `#${value.toString(16).padStart(6, "0")}` : value ?? fallback;
  const accent = css(theme.accent, "#c11e9f");
  const accentDim = css(theme.accentDim, "#59356f");
  const text = css(theme.text, "#f8edf8");
  const panel = css(theme.panel, "#171026");
  const translucent = /^#[0-9a-f]{6}$/i.test(panel) ? `${panel}e8` : panel;
  const wrap = document.createElement("div");
  wrap.id = "art-toggle";
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", "Art style");
  Object.assign(wrap.style, { position: "absolute", zIndex: 3, display: "inline-flex", alignItems: "center", gap: "0", padding: "3px", background: translucent, border: `1px solid ${accentDim}`, borderRadius: "12px", boxShadow: "0 6px 18px rgba(0,0,0,.28)", font: `600 12px/1 ${theme.font ?? '"Space Grotesk", ui-sans-serif, sans-serif'}`, color: text, letterSpacing: ".4px", userSelect: "none" });
  Object.assign(wrap.style, at);
  const buttons = {};
  for (const mode of ["prototype", "stylized"]) {
    const b = document.createElement("button");
    b.textContent = mode === "prototype" ? "Prototype" : "Stylized";
    b.dataset.mode = mode;
    b.setAttribute("role", "radio");
    Object.assign(b.style, { padding: "7px 11px", border: "0", borderRadius: "9px", font: "inherit", letterSpacing: "inherit", transition: "background .16s ease, color .16s ease, opacity .16s ease", cursor: "pointer" });
    b.onclick = () => {
      if (b.disabled || mode === art.mode) return;
      if (busy()) { wrap.title = "Finish the spin first"; return; }
      localStorage.setItem(KEY, mode);
      const url = new URL(location.href); url.searchParams.delete("art");
      location.replace(url);
    };
    buttons[mode] = b; wrap.append(b);
  }
  const paint = (manifest) => {
    const ready = manifest?.status === "ready";
    buttons.stylized.disabled = !ready;
    buttons.stylized.title = ready ? (manifest.fallbacks?.length ? `Generated art; prototype fallback: ${manifest.fallbacks.join(", ")}` : "Generated art") : !manifest ? "No stylized art yet (tools/stylize.mjs)" : manifest.status === "generating" ? "Stylized art is still generating…" : `Stylized art incomplete: ${(manifest.missing ?? []).join(", ")}`;
    if (!ready && manifest?.status === "generating") buttons.stylized.textContent = "Stylized…";
    else buttons.stylized.textContent = "Stylized";
    for (const [mode, b] of Object.entries(buttons)) {
      const on = mode === art.mode;
      b.setAttribute("aria-checked", String(on));
      Object.assign(b.style, { background: on ? `linear-gradient(135deg, ${accent}, #621da2)` : "transparent", color: on ? "#fff" : text, opacity: b.disabled ? "0.38" : "1", cursor: b.disabled ? "not-allowed" : on ? "default" : "pointer" });
    }
    return ready;
  };
  if (!paint(art.manifest)) {
    const timer = setInterval(async () => { const m = await fetchManifest(); if (paint(m)) clearInterval(timer); }, 10000);
  }
  document.getElementById("stage").append(wrap);
  return wrap;
}
