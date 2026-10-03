/* Shared static SVG/browser access for inspection, compilation and scanning. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const sha = text => createHash('sha256').update(text).digest('hex');
const check = (value, message) => { if (!value) throw Error(message); };
function browserPath(explicit) {
  const candidates = [explicit, process.env.ASTRA_BROWSER, chromium.executablePath(), '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/opt/google/chrome/chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(cache)) for (const name of fs.readdirSync(cache).filter(n => n.startsWith('chromium-')).sort().reverse()) {
    for (const child of ['chrome-linux64/chrome','chrome-linux/chrome']) candidates.push(path.join(cache,name,child));
  }
  const found = candidates.find(p => p && fs.existsSync(p));
  check(found, 'No browser found. Run npx playwright install chromium in the skill tools directory, or set ASTRA_BROWSER.'); return found;
}
async function open(options = {}) {
  const browser = await chromium.launch({executablePath:browserPath(options.browser),headless:true});
  const page = await browser.newPage({viewport:{width:720,height:720},deviceScaleFactor:1});
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e5e7eb}#stage{width:640px;height:640px}#stage>svg{width:100%;height:100%;display:block}</style><div id="stage"></div>');
  for (const name of ['svg-geometry.js']) await page.addScriptTag({path:path.join(__dirname,name)});
  return {browser,page};
}
async function mount(page, text) {
  return page.evaluate(text => {
    const doc = new DOMParser().parseFromString(text,'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw Error('Invalid SVG');
    const svg = doc.documentElement;
    for (const n of [svg,...svg.querySelectorAll('*')]) {
      if (['script','foreignObject','animate','animateTransform','set'].includes(n.localName)) throw Error('Prepared SVG must be static: '+n.localName);
      for (const attr of n.attributes) {
        if (/^on/i.test(attr.name)) throw Error('SVG event handlers are not allowed');
        if ((attr.localName==='href' && !attr.value.startsWith('#') && !attr.value.startsWith('data:')) || /url\(\s*['"]?(?:https?:|\/\/)/i.test(attr.value)) throw Error('SVG has an external resource');
      }
    }
    document.getElementById('stage').replaceChildren(document.importNode(svg,true));
    window.rigSvg = document.querySelector('#stage > svg'); window.originalViewBox=rigSvg.getAttribute('viewBox');
    const v = rigSvg.viewBox.baseVal;
    if (!(v.width>0 && v.height>0)) throw Error('Prepared SVG needs a positive viewBox');
    return [v.x,v.y,v.width,v.height];
  },text);
}
module.exports={sha,browserPath,open,mount};
