// Stage geometry for the default player. Pure: no PIXI or DOM access, so it is testable.
//
// orientation
//   "landscape"   (default) the 1280×720 cabinet stage, letterboxed into any viewport
//   "portrait"    a native tall stage for phones: title on top, full-width board, compact controls
//                 at the bottom. Its height follows the viewport's aspect so the canvas fills the
//                 screen; on a wide viewport it uses 720×1280.
//   "responsive"  legacy: portrait when the viewport is taller than it is wide, otherwise
//                 landscape. A game is built for one requested orientation (stage.json, see
//                 lib/orientation.mjs), so acceptance rejects a responsive stage; pass the
//                 requested "landscape" or "portrait" instead.
export const ORIENTATIONS = ["landscape", "portrait", "responsive"];
export const LANDSCAPE = { width: 1280, height: 720, top: 64, barH: 80 };
export const PORTRAIT_WIDTH = 720;
const PORTRAIT_MIN_H = 1080, PORTRAIT_MAX_H = 1680, PORTRAIT_TOP = 150, COMPACT_BAR_H = 144;

export function stageLayout({ orientation = "landscape", viewport = { width: 1280, height: 720 } } = {}) {
  if (!ORIENTATIONS.includes(orientation)) throw Error(`orientation must be one of ${ORIENTATIONS.join(", ")}`);
  const vw = Number(viewport?.width), vh = Number(viewport?.height);
  if (!(vw > 0 && vh > 0)) throw Error("stageLayout needs a positive viewport size");
  const portrait = orientation === "portrait" || (orientation === "responsive" && vh > vw);
  if (!portrait) return { orientation: "landscape", requested: orientation, ...LANDSCAPE, uiScale: 1 };
  const width = PORTRAIT_WIDTH;
  const height = Math.round(Math.min(PORTRAIT_MAX_H, Math.max(PORTRAIT_MIN_H, vh > vw ? width * vh / vw : width * 16 / 9)));
  // Controls, HUD text and choice buttons are authored in screen pixels (44px touch targets).
  // uiScale converts them to stage units for the letterboxed canvas.
  const cssScale = Math.min(vw / width, vh / height);
  const uiScale = Math.min(2.5, Math.max(1, 1 / cssScale));
  return { orientation: "portrait", requested: orientation, width, height, top: Math.round(PORTRAIT_TOP * Math.min(uiScale, 1.6)), barH: Math.round(COMPACT_BAR_H * uiScale), uiScale };
}
