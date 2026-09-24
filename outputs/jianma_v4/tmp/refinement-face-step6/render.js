const sharp=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
for(const [a,b] of [['refinement/groups/face/5.脸部部件绘制/character.svg','tmp/refinement-face-step6/before-transparent.png'],['refinement/groups/face/6.投影与高光效果/character.svg','tmp/refinement-face-step6/after-transparent.png']])await sharp(a,{density:72}).png().toFile(b);
await sharp('refinement/groups/face/6.投影与高光效果/character.svg',{density:72}).flatten({background:'#fff'}).png().toFile('refinement/groups/face/6.投影与高光效果/preview.png');
})();
