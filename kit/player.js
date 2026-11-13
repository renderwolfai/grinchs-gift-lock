// Generic event-playback player (served at /kit/player.js). It renders ANY game definition the
// server runs: board size per mode, placeholder art per symbol role, and a default animation for
// every engine event type. A new game is playable with this alone; games then theme it, swap
// textures, or take over specific events through hooks. It never computes an outcome: boards,
// values, wins and meters all come from the engine's events.
import { createKit, createSound, createApi, loadFonts, splitPasses, boardFrom, createMeters, G, txt, money, ease } from "./core.js";
import { preservesAspect } from "./art-placement.js";
import { counterLabel, drawnArtIds } from "./presentation-observation.js";
import { stageLayout } from "./stage-layout.js";
import { ReelGrid } from "./reels.js";
import { boardRect, globalRect, placedReelFrames } from "./reel-frame.js";
import { createUiBar, DEFAULT_THEME } from "./ui.js";
import { framedCell, makeSymbolArt, symbolCellFactory, symbolRole } from "./art.js";
import { loadArt, applyStylized, backdropSprite, artToggle, animFor } from "./stylized.js";

const HUD_W = 280;

/**
 * options
 *   theme       ui theme (see ui.js DEFAULT_THEME) + { background, title color }
 *   fonts       font specs to await, e.g. ["48px Bungee"]
 *   art(tex, ctx)          adjust/replace textures by symbol id after placeholders are built;
 *                          ctx.art = { mode, stylized, images } — in stylized mode the generated
 *                          images then replace tex by id, so art() only needs `ctx.art.images` to
 *                          compose variants of a generated symbol (badges, overlays)
 *   names       { SYMBOL_ID: "Display name" }, { modeId: "Display name" }, { accId: "Label" },
 *               { pluginStateKey: "Label" } (full "ns.key" or last segment); an unnamed HUD
 *               counter shows a readable fallback ("Round value") and verification warns
 *   fillerFilter(id, mode)  false keeps a symbol out of the random spin/off-screen filler
 *   paytableFilter(symbol)  false hides a symbol (e.g. an internal state) from the paytable
 *   framedFilter(id)        true puts a symbol on the framed tile (tex.cellFrame); default: picture symbols
 *   valueDisplayFilter(id)  false hides a value badge while preserving the engine value
 *   valueDisplayFormatter(id, value, bet) formats a value badge; null/undefined uses money
 *   hudFilter(key, mode)    false hides a HUD line; key is "spin-counter:<mode>", "accumulator:<id>" or "plugin-state:<key>"
 *   hud           "auto" (default) shows a compact panel only when it has meter/counter content;
 *                 true keeps the full panel visible, false hides it. Feature buys reserve their own width.
 *   maxPitch      maximum reel-cell pitch in pixels (default 150)
 *   orientation   the game's requested stage, matching its stage.json: "landscape" (default
 *                 1280×720 stage) or "portrait" (native tall phone stage). "responsive" is legacy
 *                 and fails acceptance; see stage-layout.js
 *   hooks.beforeLand(pass, ctx) may return { staggerMs, replayDurationMs, replayStaggerMs };
 *                          ctx.next is the engine-resolved board
 *   hooks.afterLand(pass, ctx) runs after the resolved board has visibly stopped
 *   hooks.event(e, ctx)    return true when the game animated `e` itself (skips the default)
 *   hooks.afterRound(result, ctx)
 *   describe    extra paytable HTML (string or (cfg, bet) => string)
 */
export async function startPlayer(options = {}) {
  const { theme = {}, fonts = [], names = {}, hooks = {} } = options;
  const resolvedTheme = { ...DEFAULT_THEME, ...theme };
  const stage = stageLayout({ orientation: options.orientation, viewport: { width: innerWidth, height: innerHeight } });
  const portrait = stage.orientation === "portrait", uiScale = stage.uiScale, TOP = stage.top, BAR_H = stage.barH;
  const kit = createKit({ width: stage.width, height: stage.height, background: resolvedTheme.background ?? 0x09040f });
  const { app, W, H, tween, animate, wait, pulse } = kit;
  await loadFonts(fonts.length ? fonts : ['400 16px "Space Grotesk"', '600 16px "Space Grotesk"', '700 16px "Space Grotesk"']);
  const sound = createSound();
  const api = createApi();
  let session;
  try { session = await api.session(); } catch {
    document.querySelector("#loading small").textContent = "server not reachable — run: node tools/run.mjs <game> serve";
    return;
  }
  const cfg = session.config;
  const font = resolvedTheme.font, display = resolvedTheme.displayFont ?? font;
  const nameOf = (id) => names[id] ?? id.replace(/[-_]/g, " ").toUpperCase();
  const symDesc = Object.fromEntries(cfg.symbols.map((s) => [s.id, s]));
  let balance = session.balance;

  // ---------------------------------------------------------------- layout & art
  const base = cfg.modes[0];
  const maxCols = Math.max(...cfg.modes.map((m) => m.cols)), maxRows = Math.max(...cfg.modes.map((m) => m.rows));
  const forcedHud = options.hud === true;
  const hudEnabled = options.hud !== false;
  // The automatic HUD floats over the backdrop instead of permanently shrinking every game's
  // reels. Feature-buy buttons still own this rail so an expanded board cannot cover them.
  const hudReserve = !portrait && (forcedHud || cfg.featureBuys.length) ? HUD_W : 0;
  const maxPitch = options.maxPitch ?? 150;
  const areaW = W - hudReserve - 60, areaH = H - TOP - BAR_H - 24;
  const pitch = Math.floor(Math.min(areaW / maxCols, areaH / maxRows, maxPitch));
  const size = pitch - 10;
  const tex = makeSymbolArt(kit, cfg.symbols, { w: size, h: size, font: display });
  const art = await loadArt({ cell: { w: size, h: size }, ticker: kit.app.ticker });
  const ctx = { kit, cfg, tex, art, sound, api, wait, tween, animate, pulse, get bet() { return bar.bet; } };
  // the framed tile follows whichever plain cell is in use (kit, game or stylized), unless that
  // same source supplied its own frame
  const kitCell = tex.cellBg, kitFrame = tex.cellFrame;
  options.art?.(tex, ctx);
  const frameFor = (bg) => framedCell(kit, bg, size, size, resolvedTheme.accent);
  if (tex.cellBg !== kitCell && tex.cellFrame === kitFrame) tex.cellFrame = frameFor(tex.cellBg);
  applyStylized(tex, art);
  const cells = art.stylized ? Object.values(art.manifest.images).filter((i) => i.kind === "cell") : [];
  if (cells.some((i) => (i.key ?? "cellBg") === "cellBg") && !cells.some((i) => i.key === "cellFrame")) tex.cellFrame = frameFor(tex.cellBg);
  const fillerFor = (mode) => {
    const ids = (cfg.modes.find((m) => m.id === mode)?.symbols ?? base.symbols).filter((id) => !["wild", "scatter", "blank"].includes(symbolRole(symDesc[id] ?? { id })) && (options.fillerFilter?.(id, mode) ?? true));
    const pool = ids.length ? ids : base.symbols;
    return () => ({ sym: pool[Math.floor(Math.random() * pool.length)], val: 0 });
  };

  const world = new PIXI.Container();
  app.stage.addChild(world);
  // games draw their prototype backdrop into `backdrop`; the stylized background sits above it
  const backdrop = new PIXI.Container();
  backdrop.sortableChildren = true;
  const stylizedBg = backdropSprite(art, { W, H, baseId: base.id, orientation: stage.orientation });
  stylizedBg.zIndex = 1000;
  backdrop.addChild(stylizedBg);
  world.addChild(backdrop);
  const titleText = txt(cfg.name.toUpperCase(), { fontFamily: display, fontSize: Math.round(28 * uiScale), fontWeight: "700", fill: resolvedTheme.titleColor ?? resolvedTheme.text, letterSpacing: 2 });
  titleText.position.set((W - hudReserve) / 2, TOP / 2);
  world.addChild(titleText);

  // one ReelGrid per board shape, created on demand
  const grids = new Map();
  let grid = null, gridMode = null;
  function gridFor(cols, rows, mode) {
    // variable reel heights: wider columns so a short reel's taller cells can grow to fill them
    const ragged = (cfg.modes.find((m) => m.id === mode)?.minRows ?? rows) < rows;
    const pitchX = ragged ? Math.floor(Math.min(areaW / cols, maxPitch)) : pitch;
    const key = `${cols}x${rows}${ragged ? "v" : ""}`;
    if (!grids.has(key)) {
      const w = pitchX * (cols - 1) + size, h = pitch * (rows - 1) + size;
      const origin = { x: Math.round((W - hudReserve - w) / 2), y: Math.round(TOP + 8 + (areaH - h) / 2) };
      const g = new ReelGrid({ kit, cols, rows, cell: { w: size, h: size, pitchX, pitchY: pitch }, maxCellScale: (pitchX - 10) / size, origin, makeCell: symbolCellFactory({ tex, w: size, h: size, bet: () => bar.bet, font: display, framed: (id) => options.framedFilter?.(id) ?? symbolRole(symDesc[id] ?? { id }) === "picture", showValue: (id) => options.valueDisplayFilter?.(id) ?? true, formatValue: options.valueDisplayFormatter }), filler: fillerFor(mode), onLand: (col) => { sound.stop(); playLand(g, col); } });
      // the frame sits outside the masked reel container so the mask does not clip it
      g.frame = G(); g.frame.lineStyle(2, bar.theme.accentDim, 0.62); g.frame.drawRoundedRect(g.view.x - 8, origin.y - 12, g.view.w + 16, h + 24, 10);
      g.container.visible = g.frame.visible = false;
      reelLayer.addChild(g.container, g.frame);
      grids.set(key, g);
    }
    const g = grids.get(key);
    g.filler = fillerFor(mode);
    if (grid !== g) { if (grid) grid.container.visible = grid.frame.visible = false; g.container.visible = g.frame.visible = true; grid = g; }
    gridMode = mode;
    return g;
  }
  const boardUnderlay = new PIXI.Container();
  const reelLayer = new PIXI.Container();
  const boardOverlay = new PIXI.Container();
  world.addChild(boardUnderlay, reelLayer, boardOverlay);
  const layers = { background: backdrop, boardUnderlay, reels: reelLayer, boardOverlay };

  // ---------------------------------------------------------------- HUD: mode, meters, spins left
  const hud = new PIXI.Container();
  // Portrait: the HUD sits centred between the title and the board, scaled to screen pixels.
  const boardTopGap = (areaH - pitch * maxRows) / 2;
  if (portrait) { hud.scale.set(uiScale); hud.position.set((W - HUD_W * uiScale) / 2, TOP); }
  else hud.position.set(W - HUD_W - 10, TOP);
  hud.visible = false;
  const hudH = portrait ? Math.max(64, (boardTopGap - 8) / uiScale) : areaH - cfg.featureBuys.length * 52; // feature-buy buttons stack below the HUD
  const hudBg = G();
  const modeText = txt("", { fontFamily: display, fontSize: 20, fontWeight: "700", fill: resolvedTheme.text, letterSpacing: 1 }); modeText.position.set(HUD_W / 2, 26);
  const meterText = new PIXI.Text("", { fontFamily: font, fontSize: 16, fontWeight: "500", fill: resolvedTheme.text, lineHeight: 26, wordWrap: true, wordWrapWidth: HUD_W - 28 });
  meterText.position.set(14, 52);
  hud.addChild(hudBg, modeText, meterText);
  world.addChild(hud);
  const meters = createMeters();
  let activeMode = base.id;
  function refreshHud() {
    modeText.text = nameOf(activeMode);
    stylizedBg.show(activeMode);
    const mode = cfg.modes.find((m) => m.id === activeMode);
    const lines = [];
    const shown = (key) => options.hudFilter?.(key, activeMode) ?? true;
    const spinsLeft = meters.values[`spin-counter:${activeMode}`];
    if (activeMode !== base.id && spinsLeft !== undefined && shown(`spin-counter:${activeMode}`)) lines.push(`SPINS LEFT  ${spinsLeft}`);
    for (const a of mode?.accumulators ?? []) if (shown(`accumulator:${a.id}`)) lines.push(`${counterLabel(names, a.id).label.toUpperCase()}  ${fmtNum(meters.get("accumulator", a.id, Number(a.seed)))}`);
    for (const [k, v] of Object.entries(meters.values)) if (k.startsWith("plugin-state:") && shown(k)) { const key = k.slice(13); lines.push(`${counterLabel(names, key).label.toUpperCase()}  ${fmtNum(v)}`); }
    meterText.text = lines.join("\n");
    hud.visible = hudEnabled && (forcedHud || lines.length > 0);
    if (hud.visible) {
      const height = forcedHud ? hudH : Math.min(hudH, 64 + Math.max(1, lines.length) * 26);
      hudBg.clear(); hudBg.beginFill(resolvedTheme.panel, 0.9); hudBg.lineStyle(1, resolvedTheme.accentDim, 0.65); hudBg.drawRoundedRect(0, 0, HUD_W, height, 12); hudBg.endFill();
    }
  }
  const fmtNum = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, ""));

  // ---------------------------------------------------------------- fx
  const fx = new PIXI.Container();
  world.addChild(fx);
  async function banner(lines, { hold = 1100 } = {}) {
    const b = new PIXI.Container();
    const back = G(); back.beginFill(0x05060f, 0.6); back.drawRect(0, 0, W, H - BAR_H); back.endFill();
    const box = new PIXI.Container(); box.position.set((W - hudReserve) / 2, (H - BAR_H) / 2);
    lines.forEach(([s, sz], i) => { const t = txt(s, { fontFamily: display, fontSize: sz, fill: ["#fff3c4", "#f0b62a"], stroke: "#2a1a08", strokeThickness: Math.max(3, sz / 12), align: "center" }); t.y = (i - (lines.length - 1) / 2) * sz * 1.2; box.addChild(t); });
    b.addChild(back, box); b.alpha = 0; box.scale.set(0.4);
    fx.addChild(b);
    await Promise.all([tween(b, { alpha: 1 }, 180), tween(box.scale, { x: 1, y: 1 }, 380, ease.back)]);
    await wait(hold);
    await tween(b, { alpha: 0 }, 220);
    b.destroy({ children: true });
  }
  function toast(s, x, y) {
    const t = txt(s, { fontFamily: font, fontSize: 18, fill: "#ffffff", stroke: "#000", strokeThickness: 4 });
    t.scale.set(uiScale); t.position.set(x, y); fx.addChild(t);
    tween(t, { y: y - 40, alpha: 0 }, 900, ease.out).then(() => t.destroy());
  }

  // ---------------------------------------------------------------- UI bar
  const bar = createUiBar({
    kit, sound, bets: cfg.bets, theme: resolvedTheme, onSpin: () => spin(), onInfo: () => openPaytable(),
    buys: cfg.featureBuys.map((b) => ({ id: b.id, label: `BUY ${nameOf(b.id)} · ${b.cost}× BET`, cost: b.cost })),
    onBuy: (id) => spin(id), height: BAR_H,
  });
  if (portrait) { bar.layout({ width: W / uiScale, compact: true }); bar.container.scale.set(uiScale); }
  world.addChild(bar.container);
  bar.onBetChange = () => grids.forEach((g) => g.reels.forEach((r) => r.slots.forEach((s) => s.refresh())));
  bar.setBalance(balance);

  // ---------------------------------------------------------------- playback
  let model = Array.from({ length: base.cols }, () => Array.from({ length: base.rows }, () => fillerFor(base.id)()));
  gridFor(base.cols, base.rows, base.id).setBoard(model);
  let shownWin = 0;
  // mode-exit's totalWin is only the feature's last spin, so sum each open feature's spin-settles
  const featureWins = {};
  let callMode = base.id;

  const cellAt = (c, r) => grid.cell(c, r);
  // symbols with a generated "land" animation (a scatter, say) play it once as they land: per reel
  // as it stops on a spin, per replayed cell on a respin or tumble
  const playLand = (g, col, rows = null) => g.liveCells()[col]?.forEach((cell, r) => { const a = animFor(art, cell.sym, "land"); if (a && (!rows || rows.has(r))) cell.play(a); });
  const setCell = (c, r, patch) => { Object.assign(model[c][r], patch); const m = model[c][r]; cellAt(c, r)?.set(m.sym, m.val, m); };

  async function showWins(wins) {
    if (!wins.length) return;
    const lit = new Set(wins.flatMap((w) => w.cells.map(([c, r]) => `${c},${r}`)));
    grid.liveCells().forEach((col, c) => col.forEach((cell, r) => { cell.c.alpha = lit.has(`${c},${r}`) ? 1 : 0.45; cell.glow.visible = lit.has(`${c},${r}`); }));
    const total = wins.reduce((s, w) => s + Number(w.payAmount), 0);
    // winning cells whose symbol has a generated "win" animation play it instead of the pulse
    const animating = [...lit].map((k) => cellAt(...k.split(",").map(Number))).filter((cell) => cell && animFor(art, cell.sym, "win")).map((cell) => cell.play(animFor(art, cell.sym, "win")));
    sound.win();
    const b = grid.bounds;
    const t = txt(money(Math.round(total * bar.bet)), { fontFamily: display, fontSize: 50, fill: ["#fff3c4", "#f0b62a"], stroke: "#2a1a08", strokeThickness: 5 });
    t.position.set(b.x + b.w / 2, b.y + b.h / 2); t.scale.set(0.4); fx.addChild(t);
    await tween(t.scale, { x: 1, y: 1 }, 320, ease.back);
    for (const w of wins.slice(0, 5)) { w.cells.forEach(([c, r]) => cellAt(c, r) && !cellAt(c, r).anim?.playing && pulse(cellAt(c, r).s, 1.15, 110)); await wait(260); }
    await wait(350);
    await Promise.all(animating);
    await tween(t, { alpha: 0 }, 200); t.destroy();
    grid.liveCells().flat().forEach((cell) => { cell.c.alpha = 1; cell.glow.visible = false; });
  }

  async function defaultEvent(e, pass) {
    switch (e.type) {
      case "symbol-mutate": {
        const kind = e.mutationType;
        if (kind === "value" || kind === "multiplier") {
          let fresh = false;
          e.cells.forEach(([c, r], i) => {
            if (!model[c]?.[r]) return;
            const patch = kind === "value" ? { val: Number(e.values[i]) } : { mult: Number(e.values[i]) };
            fresh ||= model[c][r][kind === "value" ? "val" : "mult"] !== Object.values(patch)[0];
            setCell(c, r, patch); pulse(cellAt(c, r).s, 1.15, 110);
          });
          sound.coin(); if (fresh) await wait(160);
        } else if (kind === "symbol" && pass.gravity) {
          // cascade compaction: survivors keep their values in order and fall by the holes below
          const removed = new Set(pass.destroyed.map(([c, r]) => `${c},${r}`));
          const byCol = new Map();
          e.cells.forEach(([c, r], i) => { if (!byCol.has(c)) byCol.set(c, []); byCol.get(c).push([r, e.symbols[i]]); });
          const falls = [];
          for (const [c, list] of byCol) {
            const survivors = model[c].filter((x, r) => !removed.has(`${c},${r}`) && x.sym);
            list.forEach(([r, sym]) => Object.assign(model[c][r], { sym, val: 0, mult: 0 }));
            const filled = model[c].filter((x) => x.sym);
            if (filled.length === survivors.length) filled.forEach((x, k) => { x.val = survivors[k].val; x.mult = survivors[k].mult; });
            const drop = pass.destroyed.filter(([dc]) => dc === c).length * pitch;
            list.forEach(([r, sym]) => { const m = model[c][r]; const cell = cellAt(c, r); cell.set(m.sym, m.val, m); if (sym) { cell.s.y -= drop; falls.push(tween(cell.s, { y: cell.s.y + drop }, 240, ease.in)); } });
          }
          await Promise.all(falls);
          if (falls.length) sound.thump();
        } else if (kind === "symbol") {
          await Promise.all(e.cells.map(async ([c, r], i) => {
            const cell = cellAt(c, r); if (!cell) return;
            await tween(cell.s.scale, { x: 0.1, y: 0.1 }, 140, ease.in);
            setCell(c, r, { sym: e.symbols[i] });
            await tween(cell.s.scale, { x: 1, y: 1 }, 220, ease.back);
          }));
          sound.morph();
        } else if (kind === "destroy" || kind === "remove") {
          pass.destroyed.push(...e.cells);
          await Promise.all(e.cells.map(([c, r]) => cellAt(c, r) && tween(cellAt(c, r).s, { alpha: 0 }, 200)));
          sound.pop();
        } else if (kind === "lock" || kind === "unlock") {
          e.cells.forEach(([c, r]) => model[c]?.[r] && setCell(c, r, { locked: kind === "lock" }));
        } else if (kind === "gravity") {
          pass.gravity = true;
        } else if (kind !== "refill") {
          // grow / shrink / cell-size / movement / position tags: mark the cells
          e.cells.forEach(([c, r]) => { const cell = cellAt(c, r); if (cell) pulse(cell.s, 1.2, 140); });
          const at = e.cells[0] ? grid.center(...e.cells[0]) : { x: W / 2, y: H / 2 };
          toast(kind.toUpperCase(), at.x, at.y);
          await wait(200);
        }
        return;
      }
      case "win": pass.wins.push(e); return;
      case "state-update": {
        meters.apply(e); refreshHud();
        // a retrigger emits no mode-enter: only the spin counter going up mid-feature
        const added = Number(e.newValue) - Number(e.oldValue);
        if (e.namespace === "spin-counter" && added > 0 && Number(e.oldValue) > 0) { sound.fanfare(); await banner([[`+${added} SPINS`, 56]], { hold: 800 }); }
        return;
      }
      case "mode-enter": activeMode = e.modeId; featureWins[e.modeId] ??= 0; refreshHud(); sound.fanfare(); await banner([[nameOf(e.modeId), 56], ...(e.spins > 1 ? [[`${e.spins} SPINS`, 34]] : [])]); return;
      case "mode-exit": {
        const total = (featureWins[e.modeId] ?? 0) + Number(e.totalWin); // earlier spins + this last one
        delete featureWins[e.modeId];
        await banner([[`${nameOf(e.modeId)} COMPLETE`, 40], [money(Math.round(total * bar.bet)), 52]]);
        return;
      }
      case "prize-resolved": sound.fanfare(); await banner([[nameOf(e.prizeId ?? "PRIZE"), 44], [money(Math.round(Number(e.amount) * bar.bet)), 52]]); return;
      case "jackpot-award": sound.fanfare(); await banner([[`${nameOf(e.poolId)} JACKPOT`, 44], [money(Math.round(Number(e.amount) * bar.bet)), 52]]); return;
      case "win-capped": await banner([["MAX WIN REACHED", 44]]); return;
      case "bonus-resolve": await banner([["BONUS", 44], [money(Math.round(Number(e.total ?? 0) * bar.bet)), 52]]); return;
      case "area-award-resolved": { const at = grid.center(...(e.center ?? [0, 0])); toast(`+${e.baseAmount}×`, at.x, at.y); await wait(300); return; }
      case "spin-settle": {
        // spin-scoped accumulators reset to their seed after each dealt spin without an event
        for (const m of cfg.modes) for (const a of m.accumulators) if (a.scope === "spin") meters.values[`accumulator:${a.id}`] = Number(a.seed);
        refreshHud();
        const win = Number(e.totalWin);
        if (callMode in featureWins) featureWins[callMode] += win;
        // running display only; truncates like the server's creditsFor, and the round's exact total replaces it
        if (win > 0) { shownWin += Math.floor(win * bar.bet + 1e-9); bar.setWin(shownWin, 500); }
        return;
      }
      default: return; // win-deferred, mode-completed, position-tags-changed, choice-* are informational
    }
  }

  /** Lands a pass's board: reel spin for a fresh deal, respin of unlocked cells, or a tumble. */
  async function landBoard(p, { fresh, prevDestroyed }) {
    // a mode with variable reel heights keeps one grid of its tallest height; short columns fill it
    const cols = p.resolve.board.width ?? p.board.length;
    const rows = Math.max(cfg.modes.find((m) => m.id === activeMode)?.rows ?? 0, ...p.board.map((c) => c.length));
    const shapeChanged = !grid || grid.cols !== cols || grid.rows !== rows;
    const next = boardFrom(p.resolve, shapeChanged ? null : model, prevDestroyed);
    if (shapeChanged) gridFor(cols, rows, activeMode);
    else grid.filler = fillerFor(activeMode);
    // values revealed at reel stop land with the symbols instead of popping in afterwards
    for (const e of p.events) {
      if (e.type !== "symbol-mutate") continue;
      if (!["value", "multiplier"].includes(e.mutationType)) break;
      if (e.revealTiming === "board-stop") continue;
      e.cells.forEach(([c, r], i) => { const x = next[c]?.[r]; if (x) x[e.mutationType === "value" ? "val" : "mult"] = Number(e.values[i]); });
    }
    const anyLocked = next.some((col) => col.some((x) => x.locked));
    const spinning = grid.reels[0].mode !== "idle";
    const landing = await hooks.beforeLand?.(p, { ...ctx, model, grid, next, fresh, activeMode });
    let landed = null; // the replayed cells on a respin or tumble; a spin's reels play their own
    if (spinning || (fresh && !anyLocked)) {
      if (!spinning) { sound.spin(); grid.start(2.4); await wait(260); }
      await grid.stop(next, landing?.staggerMs ?? 150);
    } else {
      // A respin redraws every unlocked position, even when the same symbol lands again. Without
      // that distinction a blank-heavy hold-and-win can make blanks look locked in place.
      // Other replay types only move changed cells or cells above a destroyed position.
      const lowestHole = (c) => Math.max(-1, ...prevDestroyed.filter(([dc]) => dc === c).map(([, dr]) => dr));
      const isRespin = p.resolve.label === "respin";
      const moving = [];
      next.forEach((col, c) => col.forEach((x, r) => {
        const old = model[c]?.[r];
        if ((isRespin && !x.locked) || !old || old.sym !== x.sym || r <= lowestHole(c)) moving.push([c, r]);
      }));
      grid.setBoard(next);
      landed = new Set(moving.map(([c, r]) => `${c},${r}`));
      moving.forEach(([c, r]) => { const s = grid.cell(c, r).s; s.alpha = 0; s.y -= pitch * 0.6; });
      const replayDurationMs = landing?.replayDurationMs ?? 260;
      const replayStaggerMs = landing?.replayStaggerMs ?? 40;
      await Promise.all(moving.map(async ([c, r]) => { const s = grid.cell(c, r).s; await wait(c * replayStaggerMs); await tween(s, { alpha: 1, y: s.y + pitch * 0.6 }, replayDurationMs, ease.out); }));
      if (moving.length) sound.thump();
    }
    model = next;
    if (landed) grid.liveCells().forEach((_, c) => playLand(grid, c, new Set([...landed].filter((k) => k.startsWith(`${c},`)).map((k) => Number(k.split(",")[1])))));
    await hooks.afterLand?.(p, { ...ctx, model, grid, fresh, activeMode, landing });
  }

  async function playCall(round) {
    callMode = round.mode;
    if (round.mode !== activeMode) { activeMode = round.mode; refreshHud(); }
    let prevDestroyed = [];
    for (const raw of splitPasses(round.events)) {
      const p = { ...raw, wins: [], destroyed: [] };
      if (p.resolve) await landBoard(p, { fresh: p.resolve.iteration === 0, prevDestroyed });
      for (const e of p.events) {
        // show a pass's wins before whatever follows them (tumble removal, banners, settle)
        if (p.wins.length && e.type !== "win" && e.type !== "state-update") { await showWins(p.wins); p.wins = []; }
        if (await hooks.event?.(e, { ...ctx, model, grid, pass: p, banner, toast })) continue;
        await defaultEvent(e, p);
      }
      if (p.wins.length) await showWins(p.wins);
      // when the engine reported the compaction itself, the model is already compacted
      prevDestroyed = p.gravity ? [] : p.destroyed;
    }
  }

  let busy = false;
  async function spin(buyId, debugSpec) {
    if (busy) return;
    buyId ??= cfg.demoSpecs?.find((s) => s.id === (debugSpec ?? api.debugSpec))?.start?.buy;
    const buy = buyId ? cfg.featureBuys.find((b) => b.id === buyId) : null;
    const cost = buy ? Math.floor(buy.cost * bar.bet) : bar.bet;
    if (balance < cost) { banner([["INSUFFICIENT FUNDS", 36]], { hold: 700 }); return; }
    busy = true; bar.setBusy(true);
    balance -= cost; bar.setBalance(balance);
    shownWin = 0; bar.setWin(0);
    if (!buy) { sound.spin(); grid.start(2.4); }
    let result;
    try {
      result = await api.spin(bar.bet, { buy: buyId, debug: debugSpec });
    } catch (e) {
      if (!buy) await grid.stop(model);
      balance += cost; busy = false; bar.setBusy(false); bar.setBalance(balance);
      banner([[String(e.message).toUpperCase(), 28]], { hold: 900 });
      return;
    }
    await playResult(result);
  }

  async function playResult(result) {
    for (const round of result.rounds) await playCall(round);
    if (result.pendingChoice) {
      const optionIds = await chooseOverlay(result.rounds.flatMap((r) => r.events).filter((e) => e.type === "choice-requested").at(-1));
      return playResult(await api.choose(optionIds));
    }
    activeMode = base.id; refreshHud();
    if (result.totalWin >= bar.bet * 20) { sound.fanfare(); await banner([[result.totalWin >= bar.bet * 60 ? "MEGA WIN" : "BIG WIN", 70], [money(result.totalWin), 46]], { hold: 1300 }); }
    await hooks.afterRound?.(result, ctx);
    bar.setWin(result.totalWin);
    balance = result.balance; bar.setBalance(balance);
    busy = false; bar.setBusy(false);
  }

  /** Player choice: one button per option; resolves with the chosen option ids. */
  function chooseOverlay(req) {
    return new Promise((resolve) => {
      const layer = new PIXI.Container();
      const back = G(); back.beginFill(0x05060f, 0.75); back.drawRect(0, 0, W, H - BAR_H); back.endFill();
      layer.addChild(back);
      const head = txt("CHOOSE", { fontFamily: display, fontSize: 44, fill: bar.theme.text }); head.position.set(W / 2, portrait ? TOP + 60 * uiScale : 140); head.scale.set(portrait ? uiScale : 1); layer.addChild(head);
      const opts = req?.options ?? [];
      opts.forEach((o, i) => {
        const b = new PIXI.Container();
        const g = G(); g.beginFill(bar.theme.button); g.lineStyle(1, bar.theme.accentDim, 0.85); g.drawRoundedRect(-120, -30, 240, 60, 12); g.endFill();
        b.addChild(g, txt(nameOf(o.label ?? o.id), { fontFamily: display, fontSize: 18, fontWeight: "600", fill: bar.theme.text }));
        if (portrait) { b.scale.set(uiScale); b.position.set(W / 2, TOP + 140 * uiScale + i * 80 * uiScale); }
        else b.position.set(W / 2 + (i - (opts.length - 1) / 2) * 270, 300);
        b.eventMode = "static"; b.cursor = "pointer";
        b.on("pointertap", () => { sound.ensure(); window.__game.choose = null; layer.destroy({ children: true }); resolve([o.id]); });
        layer.addChild(b);
      });
      fx.addChild(layer);
      window.__game.choose = (k = 0) => {
        const ids = Array.isArray(k) ? k : [opts[k]?.id];
        if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !opts.some(o => o.id === id))) throw Error("Invalid choice option IDs");
        window.__game.choose = null; layer.destroy({ children: true }); resolve(ids);
      };
    });
  }

  // ---------------------------------------------------------------- paytable
  const pt = document.getElementById("paytable");
  async function openPaytable() {
    if (busy) return;
    const fmt = (x) => money(Math.round(x * bar.bet));
    const rows = await Promise.all(cfg.symbols.filter((s) => (s.pays.length || symbolRole(s) !== "picture") && (options.paytableFilter?.(s) ?? true)).map(async (s) => {
      const pays = s.pays.map((p) => Object.entries(p.table).sort((a, b) => b[0] - a[0]).map(([n, v]) => `${n}× ${fmt(v)}`).join(" · ") + (p.anywhere ? " (anywhere)" : "")).join("<br>");
      const role = symbolRole(s);
      const note = role === "wild" ? "Wild — substitutes" : role === "scatter" ? "Scatter" : role === "value" ? "Carries a value" : "";
      return `<div class="sym"><img src="${await kit.imageOf(tex[s.id])}" alt="${s.id}"><div><b>${nameOf(s.id)}</b></div><div>${pays || note}</div></div>`;
    }));
    const extra = typeof options.describe === "function" ? options.describe(cfg, bar.bet) : options.describe ?? "";
    pt.querySelector(".inner").innerHTML = `
      <button class="close">CLOSE</button>
      <h1>${cfg.name}</h1>
      <p style="text-align:center">${base.cols}×${base.rows} · ${base.evaluator} · values at the current bet of ${money(bar.bet)}</p>
      <h2>PAYTABLE</h2><div class="grid">${rows.join("")}</div>
      ${extra}
      ${cfg.featureBuys.length ? `<h2>FEATURE BUY</h2><p>${cfg.featureBuys.map((b) => `${nameOf(b.id)}: ${b.cost}× bet`).join("<br>")}</p>` : ""}
      <p class="muted">Every outcome comes from the native math engine.</p>`;
    pt.querySelector(".close").onclick = () => pt.classList.remove("open");
    pt.classList.add("open");
  }

  // ---------------------------------------------------------------- ?debug panel
  /** One button per forceable feature; each forces only the next spin. Needs DEBUG_FEATURES=1 on the server. */
  function debugPanel() {
    const panel = document.createElement("div");
    panel.id = "debug-panel";
    Object.assign(panel.style, { position: "absolute", top: "8px", left: "8px", zIndex: 3, display: "flex", flexDirection: "column", gap: "4px", padding: "8px", maxWidth: "190px", background: "rgba(9,4,15,0.88)", border: "1px solid #59356f", borderRadius: "12px", font: `500 12px/1.3 ${font}`, color: "#f8edf8" });
    const head = document.createElement("b");
    const list = document.createElement("div");
    Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "4px" });
    head.style.cursor = "pointer";
    const toggle = (open) => { list.style.display = open ? "flex" : "none"; head.textContent = `${open ? "▾" : "▸"} DEBUG · force next spin`; };
    head.onclick = () => toggle(list.style.display === "none");
    toggle(true);
    panel.append(head, list);
    if (!cfg.debugFeatures) {
      const note = document.createElement("div");
      note.textContent = "Server debug is off. Restart it with DEBUG_FEATURES=1.";
      list.append(note);
    }
    for (const { spec, label } of cfg.debugFinders ?? []) {
      const b = document.createElement("button");
      b.textContent = nameOf(label);
      b.title = spec;
      Object.assign(b.style, { cursor: "pointer", padding: "7px 10px", textAlign: "left", background: "#28173d", color: "#f8edf8", border: "1px solid #59356f", borderRadius: "9px", font: "inherit" });
      b.onclick = () => { sound.ensure(); spin(undefined, spec); };
      list.append(b);
    }
    document.getElementById("stage").append(panel);
  }
  if (api.debugRequested) debugPanel();
  artToggle(art, { busy: () => busy, theme: bar.theme });

  refreshHud();
  document.getElementById("loading")?.remove();
  // `art` lets tools/stylize.mjs export the prototype textures and backdrop as references
  window.__game = { app, verificationSnapshot() {
    const shown = key => options.hudFilter?.(key, activeMode) ?? true;
    const mode = cfg.modes.find(m => m.id === activeMode);
    const counterFields = [];
    if (activeMode !== base.id && meters.values['spin-counter:' + activeMode] !== undefined && shown('spin-counter:' + activeMode)) counterFields.push({ key: 'spin-counter:' + activeMode, label: 'SPINS LEFT' });
    for (const a of mode?.accumulators ?? []) if (shown('accumulator:' + a.id)) { const l = counterLabel(names, a.id); counterFields.push({ key: 'accumulator:' + a.id, label: l.label.toUpperCase(), named: l.named, seed: Number(a.seed) }); }
    for (const key of Object.keys(meters.values)) if (key.startsWith('plugin-state:') && shown(key)) { const id = key.slice(13), l = counterLabel(names, id); counterFields.push({ key, label: l.label.toUpperCase(), named: l.named }); }
    return { schema: 1, layout: { orientation: stage.orientation, requested: stage.requested, width: W, height: H }, busy, choicePending: !!window.__game.choose, ...bar.verificationSnapshot(), counters: { ...meters.values }, counterText: meterText.text, counterTextVisible: meterText.worldVisible && meterText.worldAlpha > 0, counterFields,
      drawnArt: drawnArtIds({ root: app.stage, images: art.images, anims: art.anims, screen: app.screen }),
      board: grid.liveCells().map(col => col.map(cell => ({ symbol: cell.sym, textureMatches: !!tex[cell.sym] && cell.s.texture === tex[cell.sym], aspectPreserved: preservesAspect(cell.s.worldTransform), visible: cell.s.worldVisible && cell.s.worldAlpha > 0 && cell.c.worldVisible && cell.c.worldAlpha > 0, rect: globalRect(cell.c, 0, 0, grid.cellSize.w, grid.cellSize.h) }))),
      // board-inside-frame evidence: global cell rectangles above, frame openings here; boardRect is
      // the grid-space rectangle a reel frame's opening should fit (maximum rows of variable boards)
      boardRect: boardRect(grid), reelFrames: placedReelFrames(app.stage, art) };
  }, spin, debug: (spec) => spin(undefined, spec), openPaytable, get busy() { return busy; }, get grid() { return grid; }, choose: null, art: { mode: art.mode, textures: tex, backdrop, anims: Object.keys(art.anims ?? {}) } };
  return { ...ctx, spin, openPaytable, banner, toast, bar, world, backdrop, layers };
}
