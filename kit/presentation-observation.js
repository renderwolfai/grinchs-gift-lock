// Presentation facts the verification snapshot reports (served at /kit/presentation-observation.js).
// Pure helpers: HUD counter labels and which generated art images are actually on screen.

/** Readable fallback for an internal id: "roundValue", "ROUND_VALUE", "hold.round-value" → "Round value". */
export function humanLabel(id) {
  const words = String(id).split(".").pop()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/).filter(Boolean).map((w) => w.toLowerCase());
  const text = words.join(" ");
  return text ? text[0].toUpperCase() + text.slice(1) : String(id);
}

/**
 * HUD counter label from startPlayer({ names }): the full id ("hold.roundValue") or its last
 * segment ("roundValue"). `named` is false when the player falls back to humanLabel(id).
 */
export function counterLabel(names, id) {
  const short = String(id).split(".").pop();
  const given = names?.[id] ?? names?.[short];
  return given != null && String(given).trim() ? { label: String(given), named: true } : { label: humanLabel(id), named: false };
}

/**
 * Ids of art.images (and of stills whose art.anims sheet is playing) drawn by a visible, renderable
 * display object that overlaps the screen. Textures match by base texture, so crops and
 * re-wrapped textures of a generated image count as drawing it.
 */
export function drawnArtIds({ root, images = {}, anims = {}, screen }) {
  const owners = new Map();
  for (const [id, texture] of Object.entries(images)) if (texture?.baseTexture) owners.set(texture.baseTexture, id);
  for (const anim of Object.values(anims)) for (const frame of anim?.frames ?? []) if (frame?.baseTexture && anim.of) owners.set(frame.baseTexture, anim.of);
  const drawn = new Set();
  const overlaps = (node) => {
    if (!screen || typeof node.getBounds !== "function") return true;
    const b = node.getBounds();
    const w = Math.min(b.x + b.width, screen.x + screen.width) - Math.max(b.x, screen.x);
    const h = Math.min(b.y + b.height, screen.y + screen.height) - Math.max(b.y, screen.y);
    return w > 0 && h > 0;
  };
  const visit = (node) => {
    if (!node || node.visible === false || node.renderable === false || !(node.worldAlpha > 0)) return;
    const id = node.texture?.baseTexture && owners.get(node.texture.baseTexture);
    if (id && !drawn.has(id) && overlaps(node)) drawn.add(id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return [...drawn].sort();
}
