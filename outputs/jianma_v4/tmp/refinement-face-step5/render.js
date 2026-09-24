const sharp=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('fs');
(async()=>{
const paths=[['refinement/groups/face/4.肤色与局部层次/character.svg','tmp/refinement-face-step5/before-transparent.png'],['refinement/groups/face/5.脸部部件绘制/character.svg','tmp/refinement-face-step5/after-transparent.png']];
for(const [a,b] of paths) await sharp(a,{density:72}).png().toFile(b);
await sharp('refinement/groups/face/5.脸部部件绘制/character.svg',{density:72}).flatten({background:'#fff'}).png().toFile('refinement/groups/face/5.脸部部件绘制/preview.png');
})();
