// Decorative art lettering; ordinary UI text keeps its own font.
export function layoutGlyphText(font,text,box) {
  if(!(box.width>0&&box.height>0))throw Error('Glyph text box must have positive dimensions');
  let pen=0;const quads=[],missing=[];
  for(const char of text.replace(/[a-z]/g,c=>c.toUpperCase())) {
    if(char===' '){pen+=font.spaceAdvance;continue;}
    const g=Object.hasOwn(font.glyphs,char)?font.glyphs[char]:null;
    if(!g){missing.push(char);continue;}
    quads.push({char,source:{x:g.x,y:g.y,width:g.width,height:g.height},dest:{x:pen,y:-g.baselineOffset,width:g.width,height:g.height}});pen+=g.xAdvance;
  }
  if(missing.length)throw Error(`Missing art glyphs: ${[...new Set(missing)].join(' ')}`);
  if(!quads.length)return {quads,width:0,height:0,scale:0};
  const left=Math.min(...quads.map(q=>q.dest.x)),top=Math.min(...quads.map(q=>q.dest.y));
  const w=Math.max(...quads.map(q=>q.dest.x+q.dest.width))-left,h=Math.max(...quads.map(q=>q.dest.y+q.dest.height))-top;
  const scale=Math.min(box.width/w,box.height/h),width=w*scale,height=h*scale;
  return {width,height,scale,quads:quads.map(q=>({...q,dest:{x:(q.dest.x-left)*scale+(box.width-width)/2,y:(q.dest.y-top)*scale+(box.height-height)/2,width:q.dest.width*scale,height:q.dest.height*scale}}))};
}
export function glyphText(font,texture,text,box) {
  const layout=layoutGlyphText(font,text,box),container=new PIXI.Container();
  for(const q of layout.quads){const s=new PIXI.Sprite(new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(q.source.x,q.source.y,q.source.width,q.source.height)));s.position.set(q.dest.x,q.dest.y);s.width=q.dest.width;s.height=q.dest.height;container.addChild(s);}
  return container;
}
