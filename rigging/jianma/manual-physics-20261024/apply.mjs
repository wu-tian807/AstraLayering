// Applies the reviewed manual settings to their exact source configuration.
// This is a manual preset installer, not the component-generation workflow.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validatePhysicsConfig } from '../../../web/studio/component-physics-schema.js';
const [source, output] = process.argv.slice(2);
if (!source || !output || source === output) throw Error('Usage: node apply.mjs <original physics.json> <physics.draft.json>');
const bytes = await readFile(source), baseline = JSON.parse(bytes);
const overrides = JSON.parse(await readFile(new URL('./overrides.json', import.meta.url)));
if (createHash('sha256').update(bytes).digest('hex') !== overrides.baselineConfigSha256) throw Error('Manual preset source changed; verify the current layers before applying it.');
const replacements = new Map(overrides.components.map(c => [c.id, c]));
const config = { ...baseline, profile: 'manual-secondary-motion-20261024',
  components: baseline.components.map(c => { const next = replacements.get(c.id) || c; replacements.delete(c.id); return next; }) };
config.components.push(...replacements.values());
const cloth = JSON.parse(await readFile(new URL('./cloth.json', import.meta.url)));
for (const patch of cloth.components) {
  const c = config.components.find(c => c.id === patch.id);
  if (!c || c.kind !== 'cloth') throw Error('Manual cloth target missing: ' + patch.id);
  c.material = { ...c.material, ...patch.material };
  c.response = { ...c.response, ...patch.response };
  c.authoring = { ...c.authoring, ...patch.authoring };
  c.validationStatus = 'manual-cloth-preview-pending';
  c.provenance = { ...c.provenance, manualClothRevision: '20261024' };
}
config.review = { status: 'draft', baseConfigHash: baseline.review?.configHash, authoring: 'manual-motion-cloth-20261024', workflowAccepted: false };
validatePhysicsConfig(config);
await writeFile(output + '.manual-tmp', JSON.stringify(config, null, 2) + '\n');
await rename(output + '.manual-tmp', output);
console.log('Manual preview settings saved; original configuration retained.');
