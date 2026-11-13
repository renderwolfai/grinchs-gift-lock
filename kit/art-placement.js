/** Map the useful part of an image into a scene rectangle without distortion.
 * Frames use measured opening; titles/symbols use visible ink bounds. */
export function placeArt(entry,target,{fit='contain'}={}){
 const source=entry.placement?.opening??entry.geometry?.opening??entry.placement?.ink??{x:0,y:0,width:entry.w,height:entry.h};
 for(const r of [source,target])if(!r||!['x','y','width','height'].every(k=>Number.isFinite(r[k]))||r.width<=0||r.height<=0)throw Error('Placement requires positive source and target rectangles');
 if(!['contain','cover'].includes(fit))throw Error('Placement fit must be contain or cover');
 const scale=Math[fit==='cover'?'max':'min'](target.width/source.width,target.height/source.height);
 return {scale,x:target.x+(target.width-source.width*scale)/2-source.x*scale,y:target.y+(target.height-source.height*scale)/2-source.y*scale,content:{x:target.x+(target.width-source.width*scale)/2,y:target.y+(target.height-source.height*scale)/2,width:source.width*scale,height:source.height*scale}};
}

/** Fit a selected generated overlay without cropping or touching prototype text.
 * PIXI.Text inherits Sprite; class checks cannot identify generated artwork. */
export function placeOverlay(art,id,sprite,target,options){
 const texture=art.stylized&&art.images?.[id];
 if(!texture||sprite.texture!==texture)return false;
 const entry=art.manifest?.images?.[id];if(!entry)throw Error(`Missing art metadata: ${id}`);
 const fit=placeArt({...entry,w:entry.w??texture.width,h:entry.h??texture.height},target,options);
 sprite.anchor.set(0,0);sprite.scale.set(fit.scale);sprite.position.set(fit.x,fit.y);return true;
}

/** Fit an intact frame and contain the board inside its measured opening.
 * Both transforms are uniform; unused opening space remains a supporting surface. */
export function fitBoardToFrame({entry,target,bounds,board,frame}){
 const frameFit=placeArt(entry,target);
 const boardFit=placeArt({placement:{ink:bounds}},frameFit.content);
 board.scale.set(boardFit.scale);board.position.set(boardFit.x,boardFit.y);
 frame.anchor.set(0,0);frame.scale.set(frameFit.scale);frame.position.set(frameFit.x,frameFit.y);
 return {frame:frameFit,board:boardFit};
}

/** Uniform scale plus rotation/reflection preserves texture proportions. */
export function preservesAspect({a,b,c,d},tolerance=.01){
 const x=Math.hypot(a,b),y=Math.hypot(c,d);
 return x>0&&y>0&&Math.abs(x/y-1)<=tolerance&&Math.abs((a*c+b*d)/(x*y))<=tolerance;
}
