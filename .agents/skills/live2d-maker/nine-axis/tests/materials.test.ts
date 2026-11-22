import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectHeadMaterials } from '../materials.ts';

test('split eyebrows retain their UUIDs with or without region names and skip hidden backups', () => {
  const left = 'face/eyebrows/eyebrow_left', right = 'face/eyebrows/eyebrow_right';
  const layers = new Map([
    ['left-front', { name: `D84.1 | ${left} | front`, nodetype: 'paintlayer' }],
    ['left-back', { name: `D80 | ${left} | back`, nodetype: 'paintlayer' }],
    ['right-front', { name: `84.2 ${right}`, nodetype: 'paintlayer' }],
    ['hidden', { name: 'Backup', nodetype: 'grouplayer', visible: '0' }],
    ['backup', { name: `81 ${right}`, nodetype: 'paintlayer', parent: 'hidden', visible: '1' }],
    ['right-back', { name: `81 ${right}`, nodetype: 'paintlayer' }],
  ]);
  const selected = selectHeadMaterials(layers, [`character:${left}`, `character:${right}`], []);
  assert.deepEqual(selected, [
    { uuid: 'left-front', id: `${left}::front`, partId: `character:${left}`, scope: 'face' },
    { uuid: 'left-back', id: `${left}::back`, partId: `character:${left}`, scope: 'face' },
    { uuid: 'right-front', id: `${right}::right-front`, partId: `character:${right}`, scope: 'face' },
    { uuid: 'right-back', id: `${right}::right-back`, partId: `character:${right}`, scope: 'face' },
  ]);
});

test('head selection preserves an explicit namespace when character and clothing paths overlap', () => {
  const selected = selectHeadMaterials(new Map([
    ['character-neck', { name: '人物 | D10 | neck | back', nodetype: 'paintlayer' }],
  ]), ['character:neck', 'clothing:neck'], []);
  assert.deepEqual(selected, [{ uuid: 'character-neck', id: 'neck::back', partId: 'character:neck', scope: 'face' }]);
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
