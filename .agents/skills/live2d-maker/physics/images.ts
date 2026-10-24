import sharp from 'sharp';
// Contact sheets reduce request image count, never source pixel dimensions.
export async function imageSheet(items:{label:string;bytes:Buffer}[]) {
  if(!items.length||items.length>16)throw Error('原尺寸拼图一次 1–16 张');
  const sizes=await Promise.all(items.map(async i=>{const m=await sharp(i.bytes).metadata();if(!m.width||!m.height)throw Error('无效图片');return {width:m.width,height:m.height};}));
  const lineWidth=Math.max(4096,...sizes.map(s=>s.width+16));let x=8,y=8,row=0,width=0;
  const tiles=sizes.map((s,i)=>{if(x+s.width+8>lineWidth){x=8;y+=row;row=0;}const t={index:i+1,label:items[i].label,left:x,top:y+24,...s};x+=s.width+16;row=Math.max(row,s.height+40);width=Math.max(width,x);return t;});
  const height=y+row;
  if(width*height>64_000_000)throw Error('原尺寸拼图过大，请减少张数，不能降低图像分辨率');
  const labels=Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${tiles.map(t=>`<text x="${t.left}" y="${t.top-7}" fill="white" font-size="16">${t.index}</text>`).join('')}</svg>`);
  const image=await sharp({create:{width,height,channels:4,background:'#182232'}}).composite([{input:labels,left:0,top:0},...tiles.map((t,i)=>({input:items[i].bytes,left:t.left,top:t.top}))]).png().toBuffer();
  return {image,tiles,sourcePixelScale:1};
}
