import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectHeadMaterials } from '../materials.ts';

test('split native layers retain every UUID and a distinct region within the same face part', () => {
  const layers = new Map([
    ['left-front', { name: 'D84.1 | face/eyebrows/eyebrow_left | front', nodetype: 'paintlayer' }],
    ['left-back', { name: 'D80 | face/eyebrows/eyebrow_left | back', nodetype: 'paintlayer' }],
    ['right-front', { name: 'D84.2 | face/eyebrows/eyebrow_right | front', nodetype: 'paintlayer' }],
    ['right-back', { name: 'D81 | face/eyebrows/eyebrow_right | back', nodetype: 'paintlayer' }],
  ]);
  const selected = selectHeadMaterials(layers, ['character:face/eyebrows/eyebrow_left', 'character:face/eyebrows/eyebrow_right'], []);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map(row => row.id)).size, 4);
  assert.deepEqual(selected.map(row => row.uuid), [...layers.keys()]);
  assert.ok(selected.every(row => row.scope === 'face'));
  for (const side of ['left', 'right']) {
    const partId = `character:face/eyebrows/eyebrow_${side}`;
    assert.deepEqual(selected.filter(row => row.partId === partId).map(row => row.id),
      [`face/eyebrows/eyebrow_${side}::front`, `face/eyebrows/eyebrow_${side}::back`]);
  }
});

test('head selection preserves an explicit namespace when character and clothing paths overlap', () => {
  const selected = selectHeadMaterials(new Map([
    ['character-neck', { name: '人物 | D10 | neck | back', nodetype: 'paintlayer' }],
  ]), ['character:neck', 'clothing:neck'], []);
  assert.deepEqual(selected, [{ uuid: 'character-neck', id: 'neck::back', partId: 'character:neck', scope: 'face' }]);
});

test('depth-only layer names retain both eyebrow fragments and skip hidden backups', () => {
  const brow = 'face/eyebrows/eyebrow_right';
  const layers = new Map([
    ['front', { name: '54.2 ' + brow, nodetype: 'paintlayer' }],
    ['hidden', { name: 'Backup', nodetype: 'grouplayer', visible: '0' }],
    ['backup', { name: '40 ' + brow, nodetype: 'paintlayer', parent: 'hidden', visible: '1' }],
    ['back', { name: '40 ' + brow, nodetype: 'paintlayer' }],
  ]);
  const selected = selectHeadMaterials(layers, ['character:' + brow], []);
  assert.deepEqual(selected.map(row => [row.uuid, row.id, row.partId]), [
    ['front', brow + '::front', 'character:' + brow],
    ['back', brow + '::back', 'character:' + brow],
  ]);
});

test('split hair and accessory layers keep both depth regions in their own preview scope', () => {
  const rows = [
    ['hair-front', 'D57 | hair/braid_right | front'],
    ['hair-back', 'D13 | hair/braid_right | back'],
    ['ornament-front', 'D85.5 | head_accessories/tanuki_ornament/tanuki_body | front'],
    ['ornament-back', 'D12 | head_accessories/tanuki_ornament/tanuki_body | back'],
  ];
  const selected = selectHeadMaterials(new Map(rows.map(([id, name]) => [id, { name, nodetype: 'paintlayer' }])),
    ['character:hair/braid_right', 'character:head_accessories/tanuki_ornament/tanuki_body'], []);
  assert.deepEqual(selected.map(row => [row.uuid, row.scope]), [
    ['hair-front', 'hair'], ['hair-back', 'hair'], ['ornament-front', 'accessory'], ['ornament-back', 'accessory'],
  ]);
  assert.equal(new Set(selected.map(row => row.id)).size, rows.length);
});
