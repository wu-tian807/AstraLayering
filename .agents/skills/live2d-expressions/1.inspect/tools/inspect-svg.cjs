#!/usr/bin/env node
/* Source inventory and baseline rendering belong to the inspect step. */
const fs = require('node:fs'), path = require('node:path');
const { sha, open, mount } = require('../../tools/svg-source.cjs');
const { write: writeJson, check, runCli } = require('../../tools/tool-common.cjs');
async function inspect(options) {
  const inputBytes=fs.readFileSync(options.svg), input=inputBytes.toString('utf8'), out=path.resolve(options.out); check(path.resolve(options.svg)!==out,'Output must not overwrite source');
  const {browser,page}=await open(options);
  try {
    const viewBox=await mount(page,input);
    const inventory=await page.evaluate(() => {
      const nodes=[], ids=new Set();
      for (const node of rigSvg.querySelectorAll('[id]')) {
        if (ids.has(node.id)) throw Error('Duplicate SVG id: '+node.id); ids.add(node.id);
        const item={id:node.id,tag:node.localName,parent:node.parentElement?.id||null};
        if (node.localName==='path') {item.d=node.getAttribute('d');item.commands=[...new Set((item.d||'').match(/[a-df-z]/ig)||[])];}
        if (node.getBBox) {try {const b=node.getBBox();item.bounds=[b.x,b.y,b.width,b.height];item.matrix=AstraSvgGeometry.array(AstraSvgGeometry.authorMatrix(node,rigSvg));}catch{}}
        if (node.hasAttribute('transform')) item.transform=node.getAttribute('transform');
        if (node.hasAttribute('clip-path')) item.clip=node.getAttribute('clip-path');
        nodes.push(item);
      }
      return nodes;
    });
    fs.mkdirSync(path.dirname(out),{recursive:true});
    writeJson(out,{schema_version:'0.3.0',source_sha256:sha(inputBytes),viewBox,nodes:inventory});
    await page.locator('#stage').screenshot({path:path.join(path.dirname(out),'baseline.png')});
    return {source_sha256:sha(inputBytes),nodes:inventory.length,inventory:out};
  } finally {await browser.close();}
}
module.exports = { inspect };
if (require.main === module) runCli({ inspect }, "inspect-svg.cjs --svg SVG --out inventory.json");
