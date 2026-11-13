// Reel ring for any grid (served at /kit/reels.js). Each reel is a ring of cells: one hidden
// slot above, `peekAbove` partly visible rows above the live window, `rows` live rows, and
// `peekBelow` rows below. Scrolling past one row pitch recycles a slot to the other end with
// the next symbol: random filler while spinning, the queued final column while stopping.
// Variable reel heights: a column shorter than `rows` makes that reel show fewer, taller rows
// that fill the same window (its cells scale up to `maxCellScale` and stay centred).
import { ease } from "./core.js";

export class ReelGrid {
  /**
   * kit       from createKit()
   * cols/rows live grid size
   * cell      { w, h, pitchX, pitchY } cell size and spacing
   * origin    { x, y } top-left of live cell (0, 0)
   * makeCell  () => { c: PIXI.Container, set(sym, val, extra) } — the game's cell view
   * filler    () => { sym, val } random off-screen / blur symbol
   * onLand    (col) => void, e.g. a reel-stop sound
   * peekPx    { top, bottom } visible pixels of the peek rows (default: the whole peek rows)
   * maxCellScale  largest scale for cells of a reel showing fewer than `rows` rows (default 1)
   */
  constructor({ kit, cols, rows, cell, origin, makeCell, filler, peekAbove = 0, peekBelow = 0, peekPx, blur = 10, maxCellScale = 1, onLand = () => {} }) {
    Object.assign(this, { kit, cols, rows, cellSize: cell, origin, makeCell, filler, peekAbove, peekBelow, maxCellScale, onLand });
    this.slotCount = 1 + peekAbove + rows + peekBelow;
    this.container = new PIXI.Container();
    this.blurFilter = new PIXI.BlurFilter(0); this.blurFilter.blurX = 0; this.blurFilter.blurY = blur;
    this.reels = Array.from({ length: cols }, (_, c) => this.#makeReel(c));
    const { w, h, pitchX, pitchY } = cell;
    const liveBottom = origin.y + (rows - 1) * pitchY + h;
    const top = origin.y - (peekPx?.top ?? peekAbove * pitchY), bottom = liveBottom + (peekPx?.bottom ?? peekBelow * pitchY);
    const ex = (w * maxCellScale - w) / 2; // room for scaled-up cells on the outer reels
    this.view = { x: origin.x - 4 - ex, y: top, w: pitchX * (cols - 1) + w + 8 + 2 * ex, h: bottom - top };
    this.mask = new PIXI.Graphics();
    this.mask.beginFill(0xffffff); this.mask.drawRect(this.view.x, this.view.y, this.view.w, this.view.h); this.mask.endFill();
    this.container.mask = this.mask;
    this.container.addChild(this.mask);
    kit.app.ticker.add(() => this.reels.forEach((r) => this.#update(r, kit.app.ticker.deltaMS)));
  }

  #makeReel(col) {
    const reel = { col, c: new PIXI.Container(), slots: [], offset: 0, speed: 0, queue: [], mode: "idle", landed: null };
    reel.c.x = this.origin.x + this.cellSize.pitchX * col;
    for (let k = 0; k < this.slotCount; k++) { const cell = this.makeCell(); const f = this.filler(); cell.set(f.sym, f.val); reel.slots.push(cell); reel.c.addChild(cell.c); }
    this.container.addChild(reel.c);
    this.#setHeight(reel, this.rows);
    return reel;
  }
  /** Visible rows of one reel: pitch P fills the window; cells scale by sc and stay centred in their slot. */
  #setHeight(reel, n) {
    const { w, h, pitchY } = this.cellSize;
    n = Math.max(1, Math.min(this.rows, n));
    const P = n === this.rows ? pitchY : (this.rows * pitchY) / n;
    if (reel.P) reel.offset *= P / reel.P;
    const sc = n === this.rows ? 1 : Math.min(P / pitchY, this.maxCellScale);
    Object.assign(reel, { n, P, sc, dx: (w - w * sc) / 2, dy: (P - pitchY) / 2 + (h - h * sc) / 2 });
    reel.slots.forEach((s) => { s.c.scale.set(sc); s.c.x = reel.dx; });
    this.#layout(reel);
  }
  #layout(reel) { reel.slots.forEach((s, k) => (s.c.y = this.origin.y + (k - 1 - this.peekAbove) * reel.P + reel.offset + reel.dy)); }
  #recycleDown(reel, next) { const s = reel.slots.pop(); s.set(next.sym, next.val, next); reel.slots.unshift(s); reel.offset -= reel.P; }
  #recycleUp(reel, next) { const s = reel.slots.shift(); s.set(next.sym, next.val, next); reel.slots.push(s); reel.offset += reel.P; }
  #update(reel, dt) {
    if (reel.mode !== "spin" && reel.mode !== "stopping") return;
    const P = reel.P;
    reel.offset += reel.speed * dt;
    const step = (down) => {
      const next = reel.mode === "stopping" ? reel.queue.shift() : this.filler();
      down ? this.#recycleDown(reel, next) : this.#recycleUp(reel, next);
      if (reel.mode === "stopping" && !reel.queue.length) { reel.offset = 0; reel.mode = "idle"; reel.landed(); }
    };
    while (reel.offset >= P && reel.mode !== "idle") step(true);
    while (reel.offset <= -P && reel.mode !== "idle") step(false);
    this.#layout(reel);
  }

  /** Live cell view at (col, row); rows −peekAbove..rows+peekBelow−1 are addressable. */
  cell(col, row) { return this.reels[col].slots[row + 1 + this.peekAbove]; }
  center(col, row) {
    const { w, h, pitchX } = this.cellSize, reel = this.reels[col];
    return { x: this.origin.x + pitchX * col + w / 2, y: this.origin.y + reel.P * row + reel.dy + (h * reel.sc) / 2 };
  }
  get bounds() { const { w, h, pitchX, pitchY } = this.cellSize; return { x: this.origin.x, y: this.origin.y, w: pitchX * (this.cols - 1) + w, h: pitchY * (this.rows - 1) + h }; }
  liveCells() { return this.reels.map((reel, c) => Array.from({ length: reel.n }, (_, r) => this.cell(c, r))); }

  /** Full ring column (every slot, top→bottom) for a live column; off-screen slots get filler. */
  ring(liveColumn) {
    const pad = (n) => Array.from({ length: n }, () => this.filler());
    return [...pad(1 + this.peekAbove), ...liveColumn, ...pad(this.peekBelow + Math.max(0, this.rows - liveColumn.length))];
  }
  /** Snaps a board ([col][row] = { sym, val, ... }) into place without motion; column length sets the reel's height. */
  setBoard(board) { this.reels.forEach((reel, c) => { this.ring(board[c]).forEach((x, k) => reel.slots[k].set(x.sym, x.val, x)); reel.offset = 0; this.#setHeight(reel, board[c].length); }); }

  start(speed = 2.4) { for (const reel of this.reels) { reel.mode = "spin"; reel.speed = speed; reel.c.filters = [this.blurFilter]; } }
  /** Stops one reel on a live column; symbols enter from the top (positive speed) or the bottom. */
  stopReel(col, liveColumn) {
    const reel = this.reels[col];
    const ring = this.ring(liveColumn);
    this.#setHeight(reel, liveColumn.length); // a new height snaps in under the blur
    return new Promise((resolve) => {
      reel.queue = reel.speed > 0 ? [...ring].reverse() : ring;
      reel.mode = "stopping";
      reel.landed = () => {
        reel.c.filters = null;
        const dir = Math.sign(reel.speed);
        reel.c.y = 0;
        this.kit.tween(reel.c, { y: 16 * dir }, 70, ease.out).then(() => this.kit.tween(reel.c, { y: 0 }, 260, ease.back)).then(resolve);
        this.onLand(col);
      };
    });
  }
  /** Stops every reel left to right with a stagger. */
  async stop(board, staggerMs = 150) {
    await Promise.all(this.reels.map(async (_, c) => { await this.kit.wait(c * staggerMs); await this.stopReel(c, board[c]); }));
  }

  /** Board scroll by one row (t in 0..1) — e.g. a whole-board drop. Call commitShiftDown() at t = 1. */
  setShift(t) { for (const reel of this.reels) { reel.offset = t * reel.P; this.#layout(reel); } }
  commitShiftDown() { for (const reel of this.reels) { reel.slots.unshift(reel.slots.pop()); reel.offset = 0; const f = this.filler(); reel.slots[0].set(f.sym, f.val); this.#layout(reel); } }
}
