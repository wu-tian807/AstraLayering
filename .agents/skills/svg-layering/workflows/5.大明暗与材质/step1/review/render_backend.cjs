// Rasterize only. Called through render.py / compare.py; source SVG is never edited.
const path = require('node:path');
const os = require('node:os');
let sharp;
for (const candidate of [
  process.env.REVIEW_SHARP,
  'sharp',
  path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'),
].filter(Boolean)) {
  try { sharp = require(candidate); break; } catch {}
}
if (!sharp) {
  console.error('Install sharp or set REVIEW_SHARP to its module path.');
  process.exit(1);
}
sharp(process.argv[2], { density: 72, limitInputPixels: 100000000 })
  .png().toFile(process.argv[3])
  .catch(error => { console.error(error.message); process.exitCode = 1; });
