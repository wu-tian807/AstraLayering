import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SectionKrita } from '../.agents/skills/live2d-maker/shared/krita/section-krita.ts';
import { nativeMaterialExport } from '../.agents/skills/live2d-maker/nine-axis/kra-materials.ts';
import { kraContents, kraLayers } from '../.agents/skills/live2d-maker/shadow/delivery.ts';
import { parseXml } from '../.agents/skills/live2d-maker/shared/xml.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { values } = parseArgs({ options: {
  krita: { type: 'string', default: process.platform === 'darwin' ? '/Applications/krita.app/Contents/MacOS/krita' : 'krita' },
  case: { type: 'string' },
} });
const supportedCases = ['jianma', 'pink-doll', 'pink-elf', 'black-white-doll'];
if (values.case && !supportedCases.includes(values.case)) throw Error(`Unknown case: ${values.case}. Choose ${supportedCases.join(', ')}.`);

const temporary = await mkdtemp(join(tmpdir(), 'astra-showcase-'));
const krita = new SectionKrita({ section: 'showcase', krita: values.krita! });
const exportLayers = nativeMaterialExport(async () => krita);
try {
  const results = [];
  for (const name of values.case ? [values.case] : supportedCases) {
    const relativeKra = `demos/${name}/character-assembly/step01/character-assembled.kra`;
    const kra = join(root, relativeKra), source = await readFile(kra);
    const { xml } = kraContents(source), layers = kraLayers(xml);
    const image = parseXml(xml).getElementsByTagName('IMAGE')[0];
    const canvas = [Number(image?.getAttribute('width')), Number(image?.getAttribute('height'))];
    if (canvas.some(size => !size)) throw Error('Could not read KRA canvas: ' + name);
    const rows = [...layers].reverse().filter(([, layer]) => layer.nodetype === 'paintlayer')
      .map(([uuid, layer], index) => ({ id: layer.name, uuid, texture: `layers/${String(index).padStart(3, '0')}.png` }));
    const staging = join(temporary, name), output = join(root, '.web/showcase-layers', name);
    await mkdir(join(staging, 'layers'), { recursive: true });
    const exported = await exportLayers(kra, staging, rows, []);
    if (!(await readFile(kra)).equals(source)) throw Error('Source KRA changed during export: ' + name);
    await mkdir(join(output, 'layers'), { recursive: true });
    const records = [];
    for (const row of exported) {
      const layer = layers.get(row.uuid!)!, [x, y] = row.bounds;
      await copyFile(join(staging, row.texture), join(output, row.texture));
      records.push({ id: row.uuid, name: row.id, opacity: Number(layer.opacity ?? 255),
        blend: layer.compositeop ?? 'normal', visible: layer.visible !== '0', original: { file: row.texture, x, y } });
    }
    await writeFile(join(output, 'layers.json'), JSON.stringify({ canvas, order: 'back-to-front', sourceKra: relativeKra,
      sourceSha256: createHash('sha256').update(source).digest('hex'), layers: records }, null, 2) + '\n');
    results.push({ name, layers: records.length });
  }
  console.log(JSON.stringify({ cases: results }, null, 2));
} finally {
  await krita.release();
  await rm(temporary, { recursive: true, force: true });
}
