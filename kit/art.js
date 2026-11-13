// Procedural placeholder art for any symbol set (served at /kit/art.js), so a new game is
// playable before it has its own art. Roles come from the definition summary: wilds, scatters,
// value carriers, royals, pictures (ranked by top pay), blanks. Games replace any texture by id.
import { G, star, polygon, mix, canvasTex, txt, money } from "./core.js";
import { playFrames } from "./stylized.js";

const PALETTE = [0xe0564f, 0x4f8fe0, 0x55b86a, 0xb36ad6, 0xe39a3b, 0x3bbfbf, 0xd6589a, 0x8fa83c, 0x6c6fe0, 0xc98a5a, 0x5aa0a8, 0xd0c040];
const ROYALS = { A: "A", K: "K", Q: "Q", J: "J", TEN: "10", "10": "10", NINE: "9", "9": "9" };
const VALUE_TAGS = ["coin", "money", "cash", "value", "bonus-value"];

export function symbolRole(s) {
  const id = s.id.toUpperCase(), tags = s.tags ?? [];
  if (/^(BLANK|EMPTY|NONE)$/.test(id)) return "blank";
  if (s.wild || tags.includes("wild")) return "wild";
  if (tags.some((t) => VALUE_TAGS.includes(t)) || /COIN|CASH|MONEY|ORB/.test(id)) return "value";
  if (tags.includes("scatter") || tags.includes("bonus") || s.pays?.some((p) => p.anywhere) || /SCATTER|BONUS|FS/.test(id)) return "scatter";
  if (ROYALS[id]) return "royal";
  return "picture";
}

const topPay = (s) => Math.max(0, ...(s.pays ?? []).flatMap((p) => Object.values(p.table)));
const label = (id) => (id.length <= 4 ? id : id.replace(/[^A-Z0-9]/gi, "").slice(0, 4)).toUpperCase();

/**
 * Builds a texture per symbol id: { [id]: PIXI.Texture }, plus `glow`, `lockFrame`, the cell
 * background `cellBg` and `cellFrame` (the same cell with a border, behind high-value pictures).
 * symbols: config.symbols from the server; size: { w, h }.
 */
export function makeSymbolArt(kit, symbols, { w = 150, h = 120, font = "Georgia, serif" } = {}) {
  const tex = {};
  const pictures = symbols.filter((s) => symbolRole(s) === "picture").sort((a, b) => topPay(b) - topPay(a));
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
  symbols.forEach((s, i) => {
    const role = symbolRole(s);
    const color = PALETTE[i % PALETTE.length];
    tex[s.id] = kit.bake((c) => {
      const g = G();
      c.addChild(g);
      if (role === "blank") return;
      if (role === "royal") {
        g.beginFill(mix(color, 0x000000, 0.55)); g.lineStyle(3, mix(color, 0xffffff, 0.35)); g.drawRoundedRect(cx - R, cy - R, R * 2, R * 2, 18); g.endFill();
        const t = txt(ROYALS[s.id.toUpperCase()], { fontFamily: font, fontSize: R * 1.35, fontWeight: "700", fill: ["#ffffff", "#" + mix(color, 0xffffff, 0.4).toString(16).padStart(6, "0")], stroke: "#111", strokeThickness: 5 });
        t.position.set(cx, cy + 2); c.addChild(t);
      } else if (role === "picture") {
        const rank = pictures.indexOf(s);
        const shapes = ["star", "diamond", "hex", "circle", "shield", "tri"];
        const shape = shapes[rank % shapes.length];
        const fill = rank === 0 ? 0xf1c40f : color;
        g.lineStyle(4, mix(fill, 0xffffff, 0.5)); g.beginFill(fill);
        if (shape === "star") star(g, cx, cy, 5, R * 1.1, R * 0.5);
        else if (shape === "diamond") polygon(g, cx, cy, 4, R * 1.05);
        else if (shape === "hex") polygon(g, cx, cy, 6, R);
        else if (shape === "circle") g.drawCircle(cx, cy, R * 0.95);
        else if (shape === "shield") g.drawPolygon([cx - R * 0.85, cy - R * 0.8, cx + R * 0.85, cy - R * 0.8, cx + R * 0.85, cy, cx, cy + R, cx - R * 0.85, cy]);
        else polygon(g, cx, cy + R * 0.15, 3, R * 1.1);
        g.endFill();
        g.lineStyle(0); g.beginFill(0xffffff, 0.28); g.drawEllipse(cx - R * 0.25, cy - R * 0.35, R * 0.35, R * 0.18); g.endFill();
        const t = txt(label(s.id), { fontFamily: font, fontSize: Math.min(26, (R * 2.2) / Math.max(2, label(s.id).length)), fontWeight: "700", fill: "#ffffff", stroke: "#111", strokeThickness: 4 });
        t.position.set(cx, cy + 4); c.addChild(t);
      } else if (role === "wild") {
        g.beginFill(0x7a2fb8); g.lineStyle(4, 0xffe27a); star(g, cx, cy, 8, R * 1.15, R * 0.8); g.endFill();
        const t = txt("WILD", { fontFamily: font, fontSize: R * 0.6, fontWeight: "700", fill: ["#fff7c2", "#f0b62a"], stroke: "#2a0f3a", strokeThickness: 5 });
        t.position.set(cx, cy); c.addChild(t);
      } else if (role === "scatter") {
        for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; g.beginFill(0xff4fa3, k % 2 ? 0.25 : 0.55); g.moveTo(cx, cy); g.arc(cx, cy, R * 1.2, a, a + Math.PI / 16); g.lineTo(cx, cy); g.endFill(); }
        g.beginFill(0x2b0a3d); g.lineStyle(4, 0xff9fd0); g.drawCircle(cx, cy, R * 0.75); g.endFill();
        const t = txt(label(s.id), { fontFamily: font, fontSize: R * 0.5, fontWeight: "700", fill: "#ffd1ea", stroke: "#000", strokeThickness: 4 });
        t.position.set(cx, cy); c.addChild(t);
      } else if (role === "value") {
        g.beginFill(0x8a5a12); g.drawCircle(cx, cy + 3, R); g.endFill();
        g.beginFill(0xf2c14e); g.lineStyle(3, 0xfff0b0); g.drawCircle(cx, cy, R); g.endFill();
        g.lineStyle(2, 0xb07d1c); g.drawCircle(cx, cy, R * 0.78);
      }
    }, w, h);
  });
  tex.glow = kit.bake((c) => {
    const g = G();
    g.lineStyle(10, 0xffd36a, 0.45); g.drawRoundedRect(6, 6, w - 12, h - 12, 8);
    g.lineStyle(4, 0xfff2b0, 1); g.drawRoundedRect(6, 6, w - 12, h - 12, 8);
    g.filters = [new PIXI.BlurFilter(2)];
    c.addChild(g);
  }, w, h);
  tex.lockFrame = kit.bake((c) => { const g = G(); g.lineStyle(4, 0x4fd1ff, 1); g.drawRoundedRect(4, 4, w - 8, h - 8, 10); c.addChild(g); }, w, h);
  tex.cellBg = canvasTex(w, h, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#232744"); gr.addColorStop(1, "#141629");
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#3a3f66"; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2);
  });
  tex.cellFrame = canvasTex(w, h, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#232744"); gr.addColorStop(1, "#141629");
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const b = Math.round(Math.min(w, h) * 0.07);
    x.strokeStyle = "#c9a24a"; x.lineWidth = b; x.strokeRect(b / 2, b / 2, w - b, h - b);
    x.strokeStyle = "#f3dc8e"; x.lineWidth = 2; x.strokeRect(b, b, w - 2 * b, h - 2 * b);
  });
  return tex;
}

/** A prototype framed tile cut from `background`, so the framed and plain cells share one surface. */
export function framedCell(kit, background, w, h, color = 0xc9a24a) {
  return kit.bake((c) => {
    const bg = new PIXI.Sprite(background); bg.width = w; bg.height = h;
    const b = Math.round(Math.min(w, h) * 0.07), g = G();
    g.lineStyle(b, color, 1, 0); g.drawRect(0, 0, w, h);
    g.lineStyle(2, mix(color, 0xffffff, 0.55), 1); g.drawRect(b, b, w - 2 * b, h - 2 * b);
    c.addChild(bg, g);
  }, w, h);
}

/**
 * Default cell view for ReelGrid: background, symbol sprite, live value / multiplier labels,
 * lock frame and win glow. `bet()` converts values (total-bet multiples) to money labels.
 * `framed(id)` true puts that symbol on `frame` (tex.cellFrame) instead of the plain background,
 * with the symbol scaled by `frameScale` so it sits inside the border. `cell.play(anim)` plays a
 * generated animation of the cell's symbol (see stylized.js) and resolves when it ends; setting
 * the cell stops it.
 */
export function symbolCellFactory({ tex, w = 150, h = 120, bet, font = "Georgia, serif", background = tex.cellBg, frame = tex.cellFrame, framed = () => false, frameScale = 0.9, showValue = () => true, formatValue = null }) {
  const valueStyle = { fontFamily: font, fontSize: 24, fontWeight: "700", fill: "#3a2205", stroke: "#fff1c0", strokeThickness: 4 };
  const multStyle = { fontFamily: font, fontSize: 22, fontWeight: "700", fill: "#ffffff", stroke: "#7a1030", strokeThickness: 5 };
  return () => {
    const cell = {
      c: new PIXI.Container(), sym: null, val: 0, mult: 0,
      set(sym, val = 0, extra = {}) {
        cell.anim?.stop({ restore: false }); cell.anim = null;
        cell.sym = sym; cell.val = val || 0; cell.mult = extra.mult || 0;
        cell.s.texture = tex[sym] ?? PIXI.Texture.EMPTY;
        cell.s.scale.set(1); cell.s.alpha = 1; cell.c.alpha = 1;
        const onFrame = !!(frame && background && framed(sym));
        if (background) cell.bg.texture = onFrame ? frame : background;
        cell.inner.scale.set(onFrame ? frameScale : 1);
        cell.lock.visible = !!extra.locked;
        cell.refresh();
      },
      play(anim) {
        cell.anim?.stop();
        cell.anim = playFrames(cell.s, anim, { loops: 1 });
        return cell.anim.done;
      },
      refresh() {
        cell.v.text = cell.val && showValue(cell.sym)
          ? (formatValue?.(cell.sym, cell.val, bet()) ?? money(Math.round(cell.val * bet())))
          : "";
        cell.m.text = cell.mult ? `×${cell.mult}` : "";
      },
    };
    cell.bg = background ? new PIXI.Sprite(background) : new PIXI.Container();
    cell.s = new PIXI.Sprite(PIXI.Texture.EMPTY); cell.s.anchor.set(0.5); cell.s.position.set(w / 2, h / 2);
    // holds the symbol so a framed cell can shrink it without touching cell.s.scale (animations own that)
    cell.inner = new PIXI.Container(); cell.inner.pivot.set(w / 2, h / 2); cell.inner.position.set(w / 2, h / 2); cell.inner.addChild(cell.s);
    cell.v = txt("", valueStyle); cell.v.position.set(w / 2, h / 2);
    cell.m = txt("", multStyle); cell.m.position.set(w - 26, 20);
    cell.lock = new PIXI.Sprite(tex.lockFrame); cell.lock.visible = false;
    cell.glow = new PIXI.Sprite(tex.glow); cell.glow.visible = false; cell.glow.blendMode = PIXI.BLEND_MODES.ADD;
    cell.c.addChild(cell.bg, cell.inner, cell.v, cell.m, cell.lock, cell.glow);
    return cell;
  };
}
