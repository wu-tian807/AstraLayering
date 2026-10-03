const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const source = require('../../../tools/svg-source.cjs');
const { inspect } = require('../inspect-svg.cjs');

test('inspection reads original bytes and composes nested transforms without rewriting source', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-svg-source-'));
  const file = path.join(directory, 'source.svg'), output = path.join(directory, 'inventory.json');
  const bytes = Buffer.from('\uFEFF<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\r\n  <!-- source spacing and BOM must survive inspection -->\r\n  <g id="parent" transform="translate(10 20) rotate(90)"><path id="curve" transform="scale(2 3) translate(1 2)" d="m1 2 3 4 h5 v-2 z"/></g>\r\n</svg>\r\n');
  fs.writeFileSync(file, bytes);
  try {
    const result = await inspect({svg: file, out: output});
    const inventory = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.source_sha256, source.sha(bytes));
    assert.equal(inventory.source_sha256, source.sha(bytes));
    assert.deepEqual(fs.readFileSync(file), bytes);
    const curve = inventory.nodes.find(node => node.id === 'curve');
    assert.equal(curve.d, 'm1 2 3 4 h5 v-2 z');
    assert.equal(curve.transform, 'scale(2 3) translate(1 2)');
    assert.equal(inventory.nodes.find(node => node.id === 'parent').transform, 'translate(10 20) rotate(90)');
    const expected = [0, 2, -3, 0, 4, 22];
    curve.matrix.forEach((value, index) => assert(Math.abs(value - expected[index]) < 1e-10));
    assert(fs.statSync(path.join(directory, 'baseline.png')).size > 0);
    await assert.rejects(inspect({svg: file, out: file}), /Output must not overwrite source/);
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});
