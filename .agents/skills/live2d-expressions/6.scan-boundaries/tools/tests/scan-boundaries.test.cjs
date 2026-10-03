const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { sha } = require('../../../tools/svg-source.cjs');
const execute = promisify(execFile);

test('step scan CLI renders real frames and finalize protects frozen evidence', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-step-scan-'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 20 20"><g id="face"><path id="p" d="M0 0L10 0L10 10Z"/></g></svg>';
  const rig = {
    schema_version: '0.3.0', document_type: 'boundary_rig', character_id: 'fixture', svg: 'character.svg',
    source: { svg_sha256: sha(svg), recipe_sha256: 'a'.repeat(64), generator: 'boundary-keyforms-v1' },
    focus: [-5, -5, 20, 20],
    parameters: { x: { type: 'number', label: 'Fixture aperture', min: 0, max: 1, default: 0 } },
    regions: [{ id: 'face', space: 'face', bounds: [-5, -5, 15, 15], axes: [{ parameter: 'x', keys: [0, 1] }] }],
    bindings: [{ region: 'face', role: 'aperture', target: { svg_id: 'p' }, property: 'd',
      commands: ['M', 'L', 'L', 'Z'], source_value: 'M0 0L10 0L10 10Z', default_source_passthrough: true,
      rest: [0, 0, 10, 0, 10, 10], keyforms: [[0, 0, 10, 0, 10, 10], [0, 0, 10, 0, 10, 4]],
    }],
  };
  const source = path.join(directory, 'character.svg'), controls = path.join(directory, 'controls.json');
  const output = path.join(directory, 'scan'), entry = path.resolve(__dirname, '../scan-boundaries.cjs');
  fs.writeFileSync(source, svg); fs.writeFileSync(controls, JSON.stringify(rig));
  const args = ['--svg', source, '--rig', controls, '--out-dir', output];
  try {
    const scan = await execute(process.execPath, [entry, 'check', ...args]);
    assert.equal(JSON.parse(scan.stdout).status, 'ready_for_visual_review');
    const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
    assert(report.visual_cases.length >= 5);
    assert(fs.statSync(path.join(output, 'contact-sheet.png')).size > 0);
    const frame = path.join(output, report.visual_cases[0].image), bytes = fs.readFileSync(frame);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const resumed = await execute(process.execPath, [entry, 'finalize', ...args]);
    assert.equal(JSON.parse(resumed.stdout).cases, report.visual_cases.length);
    assert.deepEqual(fs.readFileSync(frame), bytes);
    fs.writeFileSync(frame, 'changed evidence');
    await assert.rejects(execute(process.execPath, [entry, 'finalize', ...args]), /Scan image changed/);
    assert.equal(fs.readFileSync(source, 'utf8'), svg);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
