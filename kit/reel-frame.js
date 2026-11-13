// Reel-frame placement (served at /kit/reel-frame.js). A full reel surround is placed by its
// published opening geometry around the real board, never by hand-coded target numbers.

/** Largest board/opening aspect difference that `fit: "contain"` absorbs as spare opening space. */
export const FRAME_CONTAIN_MAX_ASPECT_GAP = .1;

/**
 * Fit a full reel surround by its interior opening.
 *   fit "exact" (default)  the board has the opening's aspect; the opening lands exactly on it
 *   fit "contain"          the opening covers the board (aspects within FRAME_CONTAIN_MAX_ASPECT_GAP);
 *                          `align` ("center" | "bottom") places the board in the spare opening space
 */
export function framePlacement(geometry,board,{fit='exact',align='center'}={}) {
  if(!Number.isFinite(board.x)||!Number.isFinite(board.y))throw Error('Board position must be finite');
  if(!['exact','contain'].includes(fit))throw Error('Frame fit must be exact or contain');
  if(!['center','bottom'].includes(align))throw Error('Frame align must be center or bottom');
  const o=geometry.opening,sx=board.width/o.width,sy=board.height/o.height;
  if(!Number.isFinite(sx)||sx<=0||!Number.isFinite(sy)||sy<=0)throw Error('Board size must be positive');
  if(fit==='exact'){
    if(Math.abs(sx-sy)>1e-6*Math.max(sx,sy))throw Error('Board aspect differs from reel-frame opening; regenerate the frame for this board or use fit: "contain"');
    return {scale:sx,x:board.x-o.x*sx,y:board.y-o.y*sx};
  }
  const gap=Math.max(sx,sy)/Math.min(sx,sy)-1;
  if(gap>FRAME_CONTAIN_MAX_ASPECT_GAP)throw Error(`Board aspect differs from reel-frame opening by ${(gap*100).toFixed(1)}% (contain allows ${FRAME_CONTAIN_MAX_ASPECT_GAP*100}%); regenerate the frame with the board's aspect`);
  const scale=Math.max(sx,sy),spareX=o.width*scale-board.width,spareY=o.height*scale-board.height;
  return {scale,x:board.x-spareX/2-o.x*scale,y:board.y-(align==='bottom'?spareY:spareY/2)-o.y*scale};
}

/**
 * The rectangle every live cell of a ReelGrid can occupy, in the grid's own coordinates: the
 * maximum-rows board, widened for the scaled-up cells of shorter reels (variable heights). Shorter
 * reels always lie inside it, so a frame whose opening fits this rectangle frames every board shape.
 */
export function boardRect(grid) {
  const {w,h,pitchX,pitchY}=grid.cellSize,ex=Math.max(0,(w*(grid.maxCellScale??1)-w)/2);
  return {x:grid.origin.x-ex,y:grid.origin.y,width:pitchX*(grid.cols-1)+w+2*ex,height:pitchY*(grid.rows-1)+h};
}

/** A sprite placed around `board` (a rectangle, or a ReelGrid for its full boardRect). */
export function reelFrameSprite(texture,geometry,board,options) {
  const rect=board?.cellSize&&board?.origin?boardRect(board):board;
  const fit=framePlacement(geometry,rect,options);
  const sprite=new PIXI.Sprite(texture);sprite.scale.set(fit.scale);sprite.position.set(fit.x,fit.y);
  sprite.reelFrame={geometry};
  return sprite;
}

/** Axis-aligned global rectangle of a local box under a display object's world transform. */
export function globalRect(node,x,y,width,height) {
  const m=node.worldTransform,points=[[x,y],[x+width,y],[x,y+height],[x+width,y+height]].map(([px,py])=>({x:m.a*px+m.c*py+m.tx,y:m.b*px+m.d*py+m.ty}));
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys);
  return {x:left,y:top,width:Math.max(...xs)-left,height:Math.max(...ys)-top};
}

/**
 * Visible reel frames under `root` with their openings in global coordinates: sprites placed by
 * reelFrameSprite, and any sprite showing a published reel-frame texture (hand placement included).
 */
export function placedReelFrames(root,art) {
  const published=new Map();
  for(const [id,entry] of Object.entries(art?.manifest?.images??{}))if(entry.geometry&&['reel-frame','frame'].includes(entry.assetKind)&&art.images?.[id])published.set(art.images[id],{id,geometry:entry.geometry});
  const frames=[],visit=node=>{
    const tagged=node.reelFrame?.geometry?{geometry:node.reelFrame.geometry}:node.texture&&published.get(node.texture);
    if(tagged&&node.worldVisible&&node.worldAlpha>0){
      const g=tagged.geometry,t=node.texture,w=t?.width||g.width,h=t?.height||g.height,ax=node.anchor?.x??0,ay=node.anchor?.y??0;
      const kx=w/g.width,ky=h/g.height,o=g.opening;
      frames.push({...(tagged.id?{id:tagged.id}:{}),opening:globalRect(node,o.x*kx-ax*w,o.y*ky-ay*h,o.width*kx,o.height*ky)});
    }
    for(const child of node.children??[])visit(child);
  };
  visit(root);return frames;
}
