// Bottom control bar (served at /kit/ui.js): balance / bet / win fields, bet ±, info, sound,
// optional feature-buy buttons and a round SPIN button. Space spins. Theme it per game.
import { G, txt, money, ease } from "./core.js";

export const DEFAULT_THEME = {
  bar: 0x09040f, panel: 0x171026, accent: 0xc11e9f, accentDim: 0x59356f, button: 0x28173d,
  text: "#f8edf8", label: "#b892d0", font: '"Space Grotesk", ui-sans-serif, sans-serif', displayFont: '"Space Grotesk", ui-sans-serif, sans-serif',
  spinFill: 0x621d60, spinIcon: 0x32c7e5,
};

function drawTaperedSpinArrow(g, color) {
  const points = [];
  const inner = [];
  const radius = 15;
  const start = Math.PI / 2;
  const end = Math.PI * 1.75;
  const steps = 48;
  const offsetX = 2;
  const offsetY = 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    const halfWidth = 1.6 + t * 3.2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push(offsetX + cos * (radius + halfWidth), offsetY + sin * (radius + halfWidth));
    inner.unshift(offsetX + cos * (radius - halfWidth), offsetY + sin * (radius - halfWidth));
  }

  const cos = Math.cos(end);
  const sin = Math.sin(end);
  const px = offsetX + cos * radius;
  const py = offsetY + sin * radius;
  const tx = -sin;
  const ty = cos;
  points.push(
    px - tx * 2 + cos * 8, py - ty * 2 + sin * 8,
    px + tx * 9, py + ty * 9,
    px - tx * 2 - cos * 8, py - ty * 2 - sin * 8,
    ...inner,
  );

  g.lineStyle(0); g.beginFill(color); g.drawPolygon(points); g.endFill();
}

/**
 * kit, sound    from createKit() / createSound()
 * bets          allowed bets in cents; betIndex the starting index
 * onSpin/onInfo callbacks; buys: [{ id, label, cost }] adds buy buttons (onBuy(id))
 * decorate(g)   extra drawing on the bar background (theme flourish)
 * drawSpin(b)   replaces the default spin-button art
 */
export function createUiBar({ kit, sound, bets, betIndex = Math.min(2, bets.length - 1), theme: themeIn = {}, onSpin, onInfo, onBuy, buys = [], decorate, drawSpin, height = 80 }) {
  const theme = { ...DEFAULT_THEME, ...themeIn };
  const { W, H } = kit;
  const ui = new PIXI.Container();
  ui.y = H - height;
  const bg = G();
  bg.beginFill(theme.bar); bg.drawRect(0, 0, W, height); bg.endFill();
  bg.lineStyle(2, theme.accent, 0.72); bg.moveTo(0, 1); bg.lineTo(W, 1);
  decorate?.(bg, theme);
  ui.addChild(bg);

  let busy = false;
  const fields=[],controls={};
  let compact=false;
  const field = (label, x, w) => {
    const g = G(); g.beginFill(theme.panel); g.lineStyle(1, theme.accentDim, 0.65); g.drawRoundedRect(x - w / 2, 22, w, 48, 10); g.endFill();
    const l = txt(label, { fontFamily: theme.font, fontSize: 11, fontWeight: "600", fill: theme.label, letterSpacing: 1.2 }); l.position.set(x, 33);
    const v = txt("", { fontFamily: theme.font, fontSize: 21, fontWeight: "600", fill: theme.text }); v.position.set(x, 54);
    ui.addChild(g, l, v);
    fields.push({g,l,v,x,w});
    return v;
  };
  const button = (draw, x, y, onTap) => {
    const b = new PIXI.Container();
    draw(b);
    b.position.set(x, y);
    b.eventMode = "static"; b.cursor = "pointer";
    b.on("pointertap", () => { sound?.ensure(); onTap(); });
    b.on("pointerover", () => b.scale.set(1.06));
    b.on("pointerout", () => b.scale.set(1));
    ui.addChild(b);
    return b;
  };
  const small = (label) => (b) => {
    const g = G(); g.beginFill(theme.button); g.lineStyle(1, theme.accentDim, 0.85); g.drawRoundedRect(-19, -19, 38, 38, 10); g.endFill();
    const t = txt(label, { fontFamily: theme.displayFont, fontSize: label.length > 1 ? 13 : 20, fontWeight: "600", fill: theme.text }); t.y = label === "i" ? 0 : -1;
    b.addChild(g, t);
  };

  const balText = field("BALANCE", 250, 220);
  const betText = field("BET", 540, 150);
  const winText = field("WIN", 830, 220);
  const changeBet = (d) => { if (busy) return; betIndex = Math.max(0, Math.min(bets.length - 1, betIndex + d)); betText.text = money(bets[betIndex]); fitValues();bar.onBetChange?.(bets[betIndex]); };
  controls.decrease=button(small("−"), 440, 46, () => changeBet(-1));
  controls.increase=button(small("+"), 640, 46, () => changeBet(1));
  if (onInfo) controls.info=button(small("i"), 50, 46, () => { if (!busy) onInfo(); });
  const soundBtn = controls.sound = button(small("♪"), 990, 46, () => { if (!sound) return; sound.on = !sound.on; soundBtn.alpha = sound.on ? 1 : 0.4; });
  const buyButtons = buys.map((b, i) => button((c) => {
    const g = G(); g.beginFill(theme.button); g.lineStyle(1, theme.accentDim, 0.85); g.drawRoundedRect(-140, -22, 280, 44, 10); g.endFill();
    const t = txt(b.label ?? `BUY ${b.cost}×`, { fontFamily: theme.font, fontSize: 14, fontWeight: "600", letterSpacing: 0.6, fill: theme.text });
    c.addChild(g, t);
  }, W - 150, -50 - i * 52, () => { if (!busy) onBuy?.(b.id); })); // stacked above the bar, right side
  const spinBtn = controls.spin = button(drawSpin ?? ((b) => {
    const g = G();
    g.beginFill(theme.spinFill); g.lineStyle(2, theme.accent, 0.9); g.drawCircle(0, 0, 31); g.endFill();
    drawTaperedSpinArrow(g, theme.spinIcon);
    b.addChild(g);
  }), W - 120, 46, () => onSpin());
  addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); sound?.ensure(); onSpin(); } });

  const fitValues=()=>{for(const {v,w} of fields){v.scale.set(1);if(compact)v.scale.set(Math.min(1,(v._fieldWidth-12)/Math.max(1,v.width)));}};
  function layout({width=W,compact:portrait=width<600}={}){
    if(!Number.isFinite(width)||width<280)throw Error('Control bar needs at least 280 logical pixels');
    compact=portrait;const h=compact?144:height;
    bg.clear();bg.beginFill(theme.bar).drawRect(0,0,width,h).endFill();bg.lineStyle(2,theme.accent,.72).moveTo(0,1).lineTo(width,1);decorate?.(bg,theme);
    fields.forEach(({g,l,v,x,w},i)=>{
      const cx=compact?width*(i+.5)/3:x,fw=compact?width/3-12:w;
      g.clear();g.beginFill(theme.panel).lineStyle(1,theme.accentDim,.65).drawRoundedRect(cx-fw/2,compact?14:22,fw,compact?48:48,10).endFill();
      l.position.set(cx,compact?26:33);l.style.fontSize=11;
      v.position.set(cx,compact?46:54);v.style.fontSize=compact?17:21;v._fieldWidth=fw;
    });
    const desktop={decrease:440,increase:640,info:50,sound:990,spin:width-120};
    const portraitX={info:25,decrease:90,spin:width/2,increase:width-90,sound:width-25};
    for(const [id,b] of Object.entries(controls)){
      b.position.set(compact?portraitX[id]:desktop[id],compact?106:46);b.scale.set(1);
      b.hitArea=new PIXI.Rectangle(id==='spin'?-58:-22,id==='spin'?-25:-22,id==='spin'?116:44,id==='spin'?50:44);
    }
    buyButtons.forEach((b,i)=>b.position.set(width-150,-50-i*52));
    fitValues();return h;
  }
  const winState = { v: 0 };
  let winSeq = 0; // a newer setWin supersedes a count-up still in flight
  const bar = {
    container: ui, theme, button, field, controls, layout,
    verificationSnapshot() { return { balanceText: balText.text, winText: winText.text }; },
    get bet() { return bets[betIndex]; },
    get busy() { return busy; },
    get win() { return winState.v; }, // the win meter's current (possibly counting) value in cents
    setBusy(b) { busy = b; spinBtn.alpha = b ? 0.5 : 1; },
    setBalance(cents) { balText.text = money(cents);fitValues(); },
    setWin(cents, ms = 0) {
      const seq = ++winSeq;
      if (!ms) { winState.v = cents; winText.text = money(cents);fitValues(); return; }
      const step = { v: winState.v };
      kit.tween(step, { v: cents }, ms, ease.out, () => { if (seq === winSeq) { winState.v = step.v; winText.text = money(Math.round(step.v));fitValues(); } });
    },
    onBetChange: null,
  };
  betText.text = money(bets[betIndex]);
  bar.setWin(0);
  return bar;
}
