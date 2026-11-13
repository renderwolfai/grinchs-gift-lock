import {placeArt} from './art-placement.js';

/** Portrait staging for a desktop-authored scene. Board and lettering keep their
 * proportions; controls reflow at viewport pixel sizes instead of shrinking. Pass the stylized
 * `backdrop` (from backdropSprite, a child of `world`) so a portrait background covers the
 * phone screen; without one the landscape background is cover-cropped.
 * `orientation` is the game's requested stage (stage.json): "portrait" always stages the scene
 * for a phone, "landscape" always keeps the desktop scene. Omitting it keeps the legacy
 * viewport-dependent switch, which acceptance rejects for a game requested as portrait on desktop
 * or landscape on a phone; pass the requested orientation. */
export function responsivePlayer({kit,world,bar,board,title,subtitle,titleEntry,backdrop,desktop={width:1280,height:720},orientation}){
 if(orientation!==undefined&&!['portrait','landscape'].includes(orientation))throw Error('responsivePlayer orientation must be "portrait" or "landscape"');
 const nodes=[world,board,title,subtitle,bar.container].filter(Boolean);
 const saved=new Map(nodes.map(n=>[n,{x:n.x,y:n.y,sx:n.scale.x,sy:n.scale.y,fontSize:n.style?.fontSize}]));
 const boardBounds={...board.getLocalBounds()};
 // Own these top-level scene elements so background cover scaling cannot squash them.
 for(const n of [board,title,subtitle,bar.container].filter(Boolean))kit.app.stage.addChild(n);
 const isPortrait=()=>orientation?orientation==='portrait':innerWidth<600&&innerHeight>innerWidth;
 function apply(){
  if(!isPortrait()){
   kit.resize(desktop.width,desktop.height);
   for(const [n,p] of saved){n.position.set(p.x,p.y);n.scale.set(p.sx,p.sy);if(p.fontSize!==undefined)n.style.fontSize=p.fontSize;}
   backdrop?.fit?.({x:0,y:0,width:desktop.width,height:desktop.height},'landscape');
   bar.layout({width:desktop.width,compact:false});return;
  }
  // A requested portrait stage keeps a phone shape (390×844) even on a wide screen.
  const height=innerHeight,width=innerHeight>innerWidth?innerWidth:Math.round(innerHeight*390/844);
  kit.resize(width,height);
  const bgScale=Math.max(width/desktop.width,height/desktop.height);
  world.scale.set(bgScale);world.position.set((width-desktop.width*bgScale)/2,(height-desktop.height*bgScale)/2);
  // The visible viewport in world coordinates: a portrait background covers exactly this.
  backdrop?.fit?.({x:-world.x/bgScale,y:-world.y/bgScale,width:width/bgScale,height:height/bgScale},'portrait');
  const controlsH=bar.layout({width,compact:true}),headerH=100;
  const available=Math.max(40,height-controlsH-headerH-56);
  const fit=placeArt({placement:{ink:boardBounds}},{x:12,y:0,width:width-24,height:available});
  const totalH=headerH+fit.content.height+16+controlsH;
  const top=Math.max(40,(height-totalH)/2);
  board.scale.set(fit.scale);board.position.set(fit.x,top+headerH-boardBounds.y*fit.scale);
  const titleSource=titleEntry??{placement:{ink:{...title.getLocalBounds()}}};
  const titleFit=placeArt(titleSource,{x:24,y:top+4,width:width-48,height:64});
  title.scale.set(titleFit.scale);title.position.set(titleFit.x,titleFit.y);
  if(subtitle){subtitle.scale.set(1);subtitle.style.fontSize=11;subtitle.position.set(width/2,top+82);}
  bar.container.position.set(0,top+headerH+fit.content.height+16);
 }
 addEventListener('resize',apply);apply();
 // layout() feeds verificationSnapshot().layout so acceptance can compare it with stage.json.
 const layout=()=>({orientation:isPortrait()?'portrait':'landscape',requested:orientation??'responsive'});
 return {apply,layout,dispose:()=>removeEventListener('resize',apply)};
}
