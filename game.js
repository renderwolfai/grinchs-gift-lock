import { startPlayer } from "./kit/player.js";
import { G, txt, canvasTex, ease } from "./kit/core.js";
import { placeOverlay } from "./kit/art-placement.js";
import { reelFrameSprite } from "./kit/reel-frame.js";
import { animFor, playFrames } from "./kit/stylized.js";

const DISPLAY = "Trebuchet MS, Arial Rounded MT Bold, sans-serif";
const C = { red:0xd72d2d, wine:0x6f1425, dark:0x071a33, gold:0xffd45a, pale:0xf4fbff, teal:0x75d7ef, green:0x176b3a, lime:0x79c842, brown:0x8a4c2c };
const NAMES = {
  H1:"Christmas Star", H2:"Gift Stack", H3:"Ornaments", H4:"Candy Canes",
  A:"Ace", K:"King", Q:"Queen", J:"Jack", T:"Ten", 9:"Nine",
  DV:"The Grinch", CN:"Gift Bauble", JP:"Jackpot Bauble", PG:"Baby Reindeer",
  base:"Grinch's Gift Lock", "mini-pigs":"Sneaky Sack Respin", free:"Stolen Christmas Free Games",
  leftPig:"Gifts Left", rightPig:"Gifts Right",
  "rewind-coin":"Christmas Rewind Bauble", "rewind-coins":"Christmas Rewind Baubles", "rewind-jackpot":"Christmas Rewind Jackpot",
  "left-pig-burst":"Gifts Left Burst", "right-pig-burst":"Gifts Right Burst",
};
let scene;

function label(text, size, fill="#f4fbff", stroke="#092f22", thickness=7) {
  return txt(text,{fontFamily:DISPLAY,fontSize:size,fontWeight:"900",fill,stroke,strokeThickness:thickness,align:"center",dropShadow:true,dropShadowColor:"#020b17",dropShadowBlur:2,dropShadowDistance:4});
}

function addRank(container, size, id, color) {
  const t=label(id,Math.round(size*.58),color,"#3c1020",Math.max(4,size*.055));t.position.set(size/2,size/2);container.addChild(t);
}
function addCoin(container,size,jackpot=false){
  const g=G(),u=size/100;g.lineStyle(7*u,0x7c2b12,1);g.beginFill(C.gold);g.drawCircle(50*u,50*u,34*u);g.endFill();g.lineStyle(4*u,C.pale,.95);g.drawCircle(50*u,50*u,27*u);
  if(jackpot){g.beginFill(C.wine);g.drawCircle(50*u,50*u,20*u);g.endFill();g.beginFill(C.pale);g.drawPolygon([50,28,56,42,72,43,60,53,64,69,50,59,36,69,40,53,28,43,44,42].map(v=>v*u));g.endFill();}
  else {const t=label("$",40*u,"#8c281a","#ffe96b",3*u);t.position.set(50*u,50*u);g.addChild(t);}container.addChild(g);
}
function addPicture(container,size,id){
  const g=G(),u=size/100;
  if(id==="H1"){g.lineStyle(5*u,0x7b4c12,1);g.beginFill(C.gold);g.drawPolygon([50,8,59,35,86,23,69,47,91,60,63,62,66,91,50,68,34,91,37,62,9,60,31,47,14,23,41,35].map(v=>v*u));g.endFill();g.beginFill(C.red);g.drawCircle(50*u,51*u,10*u);g.endFill();}
  if(id==="H2"){for(const [x,y,w,h,c] of [[14,44,44,36,C.red],[43,29,43,51,C.green],[24,17,39,31,0x2f8f56]]){g.lineStyle(4*u,0x0b3a2a,1);g.beginFill(c);g.drawRoundedRect(x*u,y*u,w*u,h*u,6*u);g.endFill();g.lineStyle(5*u,C.gold,1);g.moveTo((x+w/2)*u,y*u);g.lineTo((x+w/2)*u,(y+h)*u);g.moveTo(x*u,(y+h/2)*u);g.lineTo((x+w)*u,(y+h/2)*u);}}
  if(id==="H3"){for(const [x,y,c] of [[31,58,C.red],[52,39,C.teal],[69,61,C.green]]){g.lineStyle(4*u,0x0b3a2a,1);g.beginFill(c);g.drawCircle(x*u,y*u,18*u);g.endFill();g.beginFill(C.gold);g.drawRoundedRect((x-6)*u,(y-25)*u,12*u,9*u,2*u);g.endFill();}}
  if(id==="H4"){for(const flip of [-1,1]){g.lineStyle(15*u,0xf5fbff,1);g.moveTo((50-17*flip)*u,82*u);g.lineTo((50+13*flip)*u,27*u);g.arc((50+2*flip)*u,26*u,12*u,0,Math.PI);g.lineStyle(6*u,C.red,1);for(let i=0;i<5;i++){g.moveTo((50-17*flip+i*6*flip)*u,(80-i*11)*u);g.lineTo((55-17*flip+i*6*flip)*u,(72-i*11)*u);}}}
  container.addChild(g);
}
function addGrinch(container,size){
  const g=G(),u=size/100;g.lineStyle(5*u,0x124527,1);g.beginFill(C.lime);g.drawEllipse(50*u,55*u,32*u,30*u);g.endFill();g.beginFill(C.lime);g.drawPolygon([23,48,11,34,29,34,71,34,89,34,77,48].map(v=>v*u));g.endFill();g.beginFill(C.red);g.drawPolygon([25,29,46,5,72,31].map(v=>v*u));g.endFill();g.lineStyle(7*u,C.pale,1);g.moveTo(25*u,30*u);g.lineTo(72*u,31*u);g.beginFill(C.pale);g.drawCircle(47*u,5*u,7*u);g.endFill();g.beginFill(0xffef77);g.drawEllipse(39*u,49*u,9*u,7*u);g.drawEllipse(61*u,49*u,9*u,7*u);g.endFill();g.beginFill(0x143821);g.drawCircle(41*u,50*u,3*u);g.drawCircle(59*u,50*u,3*u);g.endFill();g.lineStyle(4*u,0x143821,1);g.arc(50*u,59*u,19*u,.15,2.98);container.addChild(g);
}
function addReindeer(container,size){
  const g=G(),u=size/100;g.lineStyle(5*u,0x4a271b,1);g.beginFill(C.brown);g.drawEllipse(48*u,60*u,31*u,23*u);g.endFill();g.drawCircle(70*u,43*u,18*u);g.beginFill(0x6b351f);g.drawPolygon([58,32,52,13,64,29,75,27,84,10,83,34].map(v=>v*u));g.endFill();g.beginFill(C.red);g.drawCircle(83*u,48*u,7*u);g.endFill();g.lineStyle(7*u,C.red,1);g.moveTo(53*u,44*u);g.lineTo(78*u,56*u);g.beginFill(C.gold);g.drawCircle(61*u,57*u,5*u);g.endFill();container.addChild(g);
}

const game = await startPlayer({
  orientation:"portrait",
  maxPitch:120,
  theme:{background:C.dark,bar:0x041224,panel:0x0b3a2a,accent:C.gold,accentDim:0x9a6b20,button:C.red,text:"#f4fbff",label:"#9fe8f7",font:DISPLAY,displayFont:DISPLAY,titleColor:"#ffd45a",spinFill:C.red,spinIcon:C.pale},
  names:NAMES,
  hudFilter:(key)=>!["accumulator:leftPig","accumulator:rightPig"].includes(key),
  framedFilter:()=>false,
  valueDisplayFilter:(id)=>id==="CN"||id==="JP",
  art(tex,ctx){
    const s=tex.cellBg.width;
    tex.cellBg=canvasTex(s,s,x=>{const q=x.createRadialGradient(s*.5,s*.42,4,s*.5,s*.5,s*.72);q.addColorStop(0,"#246b4a");q.addColorStop(.55,"#0d3b31");q.addColorStop(1,"#061b2e");x.fillStyle=q;x.fillRect(0,0,s,s);x.strokeStyle="rgba(244,251,255,.58)";x.lineWidth=4;x.strokeRect(4,4,s-8,s-8);x.strokeStyle="rgba(117,215,239,.22)";x.lineWidth=2;x.strokeRect(9,9,s-18,s-18);});
    for(const id of ["H1","H2","H3","H4"])tex[id]=ctx.kit.bake(c=>addPicture(c,s,id),s,s);
    const rankColors={A:"#ef3a37",K:"#4b92ff",Q:"#d35be8",J:"#4ed06b",T:"#ff8f2b",9:"#27d4cf"};
    for(const [id,color] of Object.entries(rankColors))tex[id]=ctx.kit.bake(c=>addRank(c,s,id,color),s,s);
    if(ctx.art.stylized&&ctx.art.images.NINE)tex["9"]=ctx.art.images.NINE;
    tex.DV=ctx.kit.bake(c=>addGrinch(c,s),s,s);tex.CN=ctx.kit.bake(c=>addCoin(c,s,false),s,s);tex.JP=ctx.kit.bake(c=>addCoin(c,s,true),s,s);tex.PG=ctx.kit.bake(c=>addReindeer(c,s),s,s);
  },
  describe:`<h2>GRINCH'S GIFT LOCK</h2><p>40 fixed paylines pay left to right. The Grinch is wild and can appear only in the centre seat. When he lands he snatches every visible Gift Bauble and Jackpot Bauble.</p><h2>GIFT SACKS</h2><p>Every base-game Grinch fills both sacks. A burst awards 6 Stolen Christmas Free Games; both sacks award 12. A Sneaky Sack Respin may lock the visible prizes for one respin before the feature.</p><h2>STOLEN CHRISTMAS FREE GAMES</h2><p>The Grinch stays locked in the centre and collects on every spin. Each Baby Reindeer adds 3 games. MINI and MINOR jackpots may arrive boosted.</p><h2>CHRISTMAS REWIND</h2><p>A losing base spin may rewind into a guaranteed Grinch-and-bauble result. Maximum round win: 2,013× total bet.</p>`,
  hooks:{
    beforeLand(pass,ctx){scene?.spinStart(pass,ctx);return{staggerMs:70};},
    async afterLand(pass,ctx){await scene?.cellRipple(pass,ctx);},
    async event(e,ctx){return await scene?.event(e,ctx)??false;},
    async afterRound(result,ctx){await scene?.afterRound(result,ctx);},
  },
});
document.title=game?.cfg?.name??document.title;
if(game)scene=makeScene(game);

function makeScene({kit,world,backdrop,art,layers}){
  const {W,H,app,tween,wait}=kit,grid=window.__game.grid,b=grid.bounds,cx=b.x+b.w/2;
  const GRINCH_SCALE=1.22;
  const animatedGrinches=new WeakSet();
  let surfaceMode="base";
  let reelBed;
  const syncCellSurfaces=()=>{const tint=surfaceMode==="free"?0xff565d:surfaceMode==="base"?0x6b9b79:0xffffff;for(const reel of grid.reels)for(const slot of reel.slots)slot.bg.tint=tint;if(reelBed)reelBed.tint=surfaceMode==="free"?0xe32935:0x16583b;};
  const syncGrinchSize=()=>{for(const reel of grid.reels)for(const slot of reel.slots)if(slot.sym==="DV"&&!animatedGrinches.has(slot))slot.s.scale.set(GRINCH_SCALE);};
  syncCellSurfaces();
  backdrop.sortableChildren=true;
  const sky=new PIXI.Sprite(canvasTex(W,H,x=>{const q=x.createRadialGradient(W*.5,H*.2,20,W*.5,H*.42,W*.86);q.addColorStop(0,"#75d7ef");q.addColorStop(.16,"#214a74");q.addColorStop(.54,"#0b2747");q.addColorStop(1,"#020a16");x.fillStyle=q;x.fillRect(0,0,W,H);}));sky.zIndex=0;sky.visible=!art.stylized;backdrop.addChildAt(sky,0);
  const village=G();village.zIndex=1;village.visible=!art.stylized;village.beginFill(0x0a3429,.96);village.drawPolygon([0,0,W*.18,0,W*.27,H*.6,W*.17,H,0,H]);village.drawPolygon([W,0,W*.82,0,W*.73,H*.6,W*.83,H,W,H]);village.endFill();village.beginFill(C.pale,.9);for(const [x,y,r] of [[35,120,8],[82,210,6],[W-44,150,7],[W-91,248,5]])village.drawCircle(x,y,r);village.endFill();village.lineStyle(10,C.gold,.6);village.drawCircle(cx,H*.22,Math.min(W*.18,118));backdrop.addChild(village);
  const glow=G();glow.zIndex=1;glow.beginFill(C.teal,.14);glow.drawCircle(cx,H*.34,Math.min(W*.42,300));glow.endFill();glow.filters=[new PIXI.BlurFilter(36)];backdrop.addChild(glow);
  reelBed=G();reelBed.beginFill(0xffffff,1);reelBed.drawRoundedRect(b.x-13,b.y-13,b.w+26,b.h+26,18);reelBed.endFill();layers.boardUnderlay.addChild(reelBed);syncCellSurfaces();
  const proceduralFrame=G();proceduralFrame.lineStyle(25,C.red,1);proceduralFrame.drawRoundedRect(b.x-24,b.y-24,b.w+48,b.h+48,26);proceduralFrame.lineStyle(15,C.pale,1);proceduralFrame.drawRoundedRect(b.x-16,b.y-16,b.w+32,b.h+32,21);proceduralFrame.lineStyle(7,C.green,.95);proceduralFrame.drawRoundedRect(b.x-9,b.y-9,b.w+18,b.h+18,16);proceduralFrame.beginFill(C.gold);proceduralFrame.drawPolygon([cx,b.y-78,cx+13,b.y-43,cx+51,b.y-43,cx+20,b.y-21,cx+31,b.y+14,cx,b.y-7,cx-31,b.y+14,cx-20,b.y-21,cx-51,b.y-43,cx-13,b.y-43]);proceduralFrame.endFill();layers.boardOverlay.addChild(proceduralFrame);grid.frame.visible=false;
  const entry=art.manifest?.images?.REEL_FRAME;
  if(art.stylized&&art.images.REEL_FRAME&&entry?.geometry){const generated=reelFrameSprite(art.images.REEL_FRAME,entry.geometry,grid,{fit:"contain"});if(generated){proceduralFrame.visible=false;layers.boardOverlay.addChild(generated);}}
  const fx=new PIXI.Container();layers.boardOverlay.addChild(fx);
  const defaultTitle=world.children.find(c=>c instanceof PIXI.Text&&String(c.text).toUpperCase()==="GRINCH'S GIFT LOCK");if(defaultTitle)defaultTitle.visible=false;
  const title=art.stylized&&art.images.TITLE?new PIXI.Sprite(art.images.TITLE):label("GRINCH'S GIFT LOCK",32,["#f4fbff","#ffd45a"],"#176b3a",9);
  if(art.stylized&&art.images.TITLE){
    if(!placeOverlay(art,"TITLE",title,{x:24,y:8,width:285,height:82}))title.position.set(165,50);
  }else title.position.set(165,50);
  world.addChild(title);
  const pigLayer=new PIXI.Container();layers.boardOverlay.addChild(pigLayer);
  function makeMeter(x,side){const holder=new PIXI.Container();holder.position.set(x,b.y-54);let body;if(art.stylized&&art.images.PIG_METER){body=new PIXI.Sprite(art.images.PIG_METER);body.anchor.set(.5);body.scale.set(.14);}else{body=G();body.lineStyle(5,0x5d1420,1);body.beginFill(C.red);body.drawEllipse(0,0,55,38);body.endFill();body.beginFill(C.red);body.drawPolygon([-35,-19,-25,-55,-8,-35,8,-35,25,-55,35,-19]);body.endFill();body.lineStyle(7,C.gold,1);body.moveTo(-27,-28);body.quadraticCurveTo(0,-15,27,-28);body.beginFill(C.green);body.drawRoundedRect(-16,-8,32,22,5);body.endFill();}holder.addChild(body);const shelf=G();shelf.lineStyle(9,C.gold,1);shelf.moveTo(-72,43);shelf.lineTo(72,43);holder.addChild(shelf);const tag=label(side,14,"#f4fbff","#0b3b2a",4);tag.position.set(0,58);holder.addChild(tag);pigLayer.addChild(holder);return{holder,body,fill:0};}
  const pigs={leftPig:makeMeter(b.x+95,"GIFTS LEFT"),rightPig:makeMeter(b.x+b.w-95,"GIFTS RIGHT")};
  const giftBagFillAnim=art.stylized?animFor(art,"PIG_METER","fill"):null;
  let t=0,heat=.15;const snow=[];for(let i=0;i<34;i++){const e=G();e.beginFill(i%5?C.pale:C.teal,.76);e.drawCircle(0,0,1+Math.random()*2.3);e.endFill();e.position.set(Math.random()*W,Math.random()*H*.82);backdrop.addChild(e);snow.push(e);}app.ticker.add(()=>{t+=app.ticker.deltaMS;glow.alpha=.1+heat*.18+.025*Math.sin(t/360);snow.forEach((e,i)=>{e.y+=.22+(i%5)*.035;e.x+=Math.sin(t/700+i)*.16;if(e.y>H*.9){e.y=H*.04;e.x=Math.random()*W;}});for(const p of Object.values(pigs))p.body.rotation=.018*Math.sin(t/230+p.fill);syncCellSurfaces();syncGrinchSize();});
  const burst=(x,y,color=C.gold,n=18)=>{for(let i=0;i<n;i++){const q=G();q.beginFill(i%3?color:C.pale,.9);i%4?q.drawCircle(0,0,2+Math.random()*3):q.drawPolygon([0,-6,4,4,-4,2]);q.endFill();q.position.set(x,y);fx.addChild(q);const a=Math.random()*Math.PI*2,r=35+Math.random()*85;tween(q,{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r-30,rotation:(Math.random()-.5)*7,alpha:0},430+Math.random()*380,ease.out).then(()=>q.destroy());}};
  async function banner(text,color="#ffe86c",ms=600){const shade=G();shade.beginFill(0x18020d,.6);shade.drawRect(0,0,W,H-82);shade.endFill();fx.addChild(shade);const m=label(text,44,color,"#5b1024",10);m.position.set(cx,b.y+b.h/2);m.scale.set(.35);m.alpha=0;fx.addChild(m);await Promise.all([tween(m,{alpha:1},140),tween(m.scale,{x:1,y:1},300,ease.back)]);await wait(ms);await Promise.all([tween(m,{alpha:0},160),tween(shade,{alpha:0},160)]);m.destroy();shade.destroy();}
  async function sparkleLine(e,ctx){const g=G();g.lineStyle(7,C.teal,.95);e.cells.forEach(([c,r],i)=>{const p=grid.center(c,r);i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);});g.filters=[new PIXI.BlurFilter(1.2)];fx.addChild(g);ctx.sound.tone(480+e.count*42,.24,{type:"triangle",v:.055,to:820});await tween(g,{alpha:0},520);g.destroy();return true;}
  async function collect(e,ctx){
    let total=0;
    const grinch=grid.liveCells().flat().find(cell=>cell.sym==="DV");
    const generatedAnim=grinch&&art.stylized?animFor(art,"DV","collect"):null;
    let generatedRun=null;
    const target=grinch?grid.center(2,1):{x:cx,y:b.y+b.h/2};
    const read=label("GIFT LOCK  0×",27,"#f4fbff","#176b3a",7);read.position.set(cx,b.y-18);fx.addChild(read);
    const halo=G();halo.lineStyle(10,C.gold,.8);halo.drawCircle(0,0,38);halo.lineStyle(4,C.pale,.9);halo.drawCircle(0,0,48);halo.position.set(target.x,target.y);halo.scale.set(.35);halo.alpha=0;fx.addChildAt(halo,0);
    if(grinch){
      animatedGrinches.add(grinch);grinch.s.scale.set(GRINCH_SCALE);
      if(generatedAnim){generatedRun=playFrames(grinch.s,generatedAnim,{still:art.images.DV,loops:1});await Promise.all([tween(halo,{alpha:.9},130),tween(halo.scale,{x:1,y:1},180,ease.back)]);}
      else{await Promise.all([tween(grinch.s.scale,{x:1.45,y:1.12},130,ease.out),tween(grinch.s,{rotation:-.1},130),tween(halo,{alpha:.9},130),tween(halo.scale,{x:1,y:1},180,ease.back)]);await Promise.all([tween(grinch.s.scale,{x:1.3,y:1.3},140,ease.back),tween(grinch.s,{rotation:0},140)]);}
    }
    try{
      for(const [c,r] of e.cells){
        const p=grid.center(c,r),coin=G();coin.lineStyle(4,0x8a5a18,1);coin.beginFill(C.gold);coin.drawCircle(0,0,16);coin.endFill();coin.lineStyle(2,C.pale,1);coin.moveTo(-8,0);coin.lineTo(8,0);coin.moveTo(0,-8);coin.lineTo(0,8);coin.position.set(p.x,p.y);fx.addChild(coin);ctx.sound.tone(620+total*24,.13,{type:"sine",v:.045,to:920});
        const lean=grinch&&!generatedRun?tween(grinch.s,{rotation:(c<2?-.09:.09)},150,ease.in):Promise.resolve();
        await Promise.all([tween(coin,{x:target.x,y:target.y,rotation:Math.PI*2,alpha:.2},210,ease.in),lean]);coin.destroy();
        if(grinch&&!generatedRun){await Promise.all([tween(grinch.s.scale,{x:1.55,y:1.18},80,ease.out),tween(halo.scale,{x:1.22,y:1.22},80,ease.out)]);await Promise.all([tween(grinch.s.scale,{x:1.3,y:1.3},120,ease.back),tween(grinch.s,{rotation:0},120),tween(halo.scale,{x:1,y:1},120,ease.back)]);}
        else if(generatedRun){await tween(halo.scale,{x:1.18,y:1.18},70,ease.out);await tween(halo.scale,{x:1,y:1},100,ease.back);}
        total=Number(e.payAmount);read.text=`GIFT LOCK  ${total.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}×`;burst(target.x,target.y,C.gold,9);
      }
      if(grinch){
        ctx.sound.noise(.18,{v:.035,f:300,to:760});
        if(generatedRun)await Promise.all([generatedRun.done,tween(halo,{alpha:0},260),tween(halo.scale,{x:1.55,y:1.55},260,ease.out)]);
        else{await Promise.all([tween(grinch.s.scale,{x:1.62,y:1.62},110,ease.out),tween(halo,{alpha:0},260),tween(halo.scale,{x:1.55,y:1.55},260,ease.out)]);await tween(grinch.s.scale,{x:GRINCH_SCALE,y:GRINCH_SCALE},220,ease.back);}
      }
      await wait(180);await tween(read,{alpha:0},150);return true;
    }finally{
      generatedRun?.stop();if(grinch){grinch.s.scale.set(GRINCH_SCALE);grinch.s.rotation=0;animatedGrinches.delete(grinch);}read.destroy();halo.destroy();
    }
  }
  async function rewind(e,ctx){ctx.sound.noise(.35,{v:.04,f:420,to:110});const tint=G();tint.beginFill(0x70451b,.36);tint.drawRect(0,0,W,H-80);tint.endFill();fx.addChild(tint);const watch=label("↶  REWIND",46,"#ffe28b","#4b2511",9);watch.position.set(cx,b.y+b.h/2);watch.scale.set(.5);fx.addChild(watch);await tween(watch,{rotation:-Math.PI*.18,x:cx-20},260,ease.back);await wait(250);await Promise.all([tween(tint,{alpha:0},150),tween(watch,{alpha:0,rotation:0},150)]);tint.destroy();watch.destroy();return true;}
  async function updatePig(e){
    const p=pigs[e.key];if(!p)return;
    const value=Number(e.newValue);p.fill=value;const stage=Math.min(4,Math.floor(value/4));
    p.body.scale.set((art.stylized&&art.images.PIG_METER?.baseTexture?.valid?.valueOf?.()?0.14:1)*(1+stage*.055));
    burst(p.holder.x,p.holder.y-8,C.gold,7);
    if(giftBagFillAnim&&p.body instanceof PIXI.Sprite){
      p.fillRun?.stop();
      const run=playFrames(p.body,giftBagFillAnim,{still:art.images.PIG_METER,loops:1});
      p.fillRun=run;run.done.then(()=>{if(p.fillRun===run)p.fillRun=null;});
      await run.done;
    }else await kit.tween(p.body,{rotation:.12},90,ease.out).then(()=>kit.tween(p.body,{rotation:-.08},100)).then(()=>kit.tween(p.body,{rotation:0},100));
    return true;
  }
  return{
    spinStart(pass,ctx){surfaceMode=ctx?.activeMode==="free"?"free":ctx?.activeMode==="base"?"base":"feature";heat=.25;},
    async cellRipple(pass,ctx){if((pass.resolve?.iteration??0)!==0)return;const order=[];for(let c=0;c<5;c++)for(let r=0;r<3;r++)if(!(c===2&&r===1))order.push([c,r]);order.push([2,1]);for(const [c,r] of order){const cell=grid.cell(c,r);if(cell){cell.alpha=.62;await tween(cell,{alpha:1},28);ctx.sound.tone(115+c*10+r*4,.035,{type:"square",v:.012});}}},
    async event(e,ctx){
      if(e.type==="symbol-mutate"&&e.mutationType==="symbol"&&e.symbols?.includes("DV")){const p=grid.center(2,1);burst(p.x,p.y,C.lime,24);ctx.sound.noise(.22,{v:.05,f:240,to:680});}
      if(e.type==="win"&&e.source==="award-values")return collect(e,ctx);
      if(e.type==="win"&&e.evaluatorType!=="anywhere")return sparkleLine(e,ctx);
      if(e.type==="prize-resolved"&&String(e.prizeId).startsWith("rewind"))return rewind(e,ctx);
      if(e.type==="state-update"&&pigs[e.key]){await updatePig(e);return false;}
      if(e.type==="prize-resolved"&&String(e.prizeId).endsWith("pig-burst")){const p=String(e.prizeId).startsWith("left")?pigs.leftPig:pigs.rightPig;burst(p.holder.x,p.holder.y,C.pale,45);await banner("6 CHRISTMAS FREE GAMES");return true;}
      if(e.type==="mode-enter"&&e.modeId==="mini-pigs"){surfaceMode="feature";await banner("SNEAKY SACK RESPIN","#9fe8f7",500);return true;}
      if(e.type==="mode-enter"&&e.modeId==="free"){surfaceMode="free";heat=1;await banner(`${e.spins} STOLEN CHRISTMAS FREE GAMES`);return true;}
      if(e.type==="state-update"&&e.namespace==="spin-counter"&&e.key==="free"&&Number(e.newValue)>Number(e.oldValue)&&Number(e.oldValue)>0){await banner(`REINDEER  +${Number(e.newValue)-Number(e.oldValue)} GAMES`,"#9fe8f7",350);return true;}
      if(e.type==="win-capped"){await banner("2,013×  MAXIMUM WIN","#fff38a",900);return true;}
      if(e.type==="mode-exit"&&e.modeId==="free"){heat=.2;await banner("CHRISTMAS SAVED... MAYBE","#ffd45a",400);surfaceMode="base";}
      return false;
    },
    async afterRound(result,ctx){const x=Number(result?.totalWinX??0);if(x>=20){heat=1;await banner(x>=100?"CHRISTMAS MEGA WIN":"GRINCHY BIG WIN","#f4fbff",800);for(let i=0;i<6;i++)burst(100+Math.random()*(W-200),100+Math.random()*420,C.gold,18);}surfaceMode="base";heat=.15;},
  };
}
