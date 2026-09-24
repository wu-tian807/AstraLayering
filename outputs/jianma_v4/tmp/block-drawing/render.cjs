const fs=require('fs');
const {Resvg}=require('./runtime/node_modules/@resvg/resvg-js');
const input=process.argv[2]||'block-layers/character.svg'; const output=process.argv[3]||'block-layers/preview.png';
const r=new Resvg(fs.readFileSync(input),{background:'#ffffff',fitTo:{mode:'original'}});fs.writeFileSync(output,r.render().asPng());
