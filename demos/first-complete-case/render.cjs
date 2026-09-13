const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
(async () => {
  for (const job of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) {
    await sharp(job.source, { density: 144 }).png().toFile(job.output);
  }
})().catch(error => { console.error(error); process.exit(1); });
