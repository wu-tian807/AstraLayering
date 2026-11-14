import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseXml, svgSource, svgBody, updateSvgRoot } from '../xml.ts';
import { composeCompletion, assertCompletionPreserves } from '../part/completion-svg.ts';
import { namespaceSvg } from '../part/merge-svg.ts';
import { layerPartName, matchLayerPart } from '../layer-names.ts';

const body = `<!-- <svg id="fake"/> --><metadata><![CDATA[<g id='fake' data-group-path='wrong'>]]></metadata><g data-note="a > b" id='shape' data-group-path='hair/bangs'><path d='M1 1H9V9H1Z' fill='#123456'/></g>`;
const source = `<?xml version="1.0"?>\r\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n<svg xmlns="http://www.w3.org/2000/svg" data-note="a > b" width='10' height='10' viewBox='0 0 10 10'>${body}</svg><!-- </svg> -->\r\n`;

test('XML source ranges ignore quoted >, comment tags, CDATA and DOCTYPE; metadata edits keep the SVG body byte-for-byte', () => {
  const parsed = svgSource(source);
  assert.equal(parsed.elements.length, 4);
  assert.equal(svgBody(source), body);
  const scaled = updateSvgRoot(source, { width: '20', height: '20', viewBox: '0 0 5 5' });
  assert.equal(svgBody(scaled), body);
  assert.equal(svgSource(scaled).root.element.getAttribute('data-note'), 'a > b');
  assert.throws(() => parseXml('<svg><g></svg>'), /XML/);
  assert.throws(() => parseXml('<svg id="a" id="b"/>'), /XML/);
  assert.equal(updateSvgRoot('<svg data-note="a > b"/>', { width: '10' }), '<svg data-note="a > b" width="10"/>');
});
test('completion is inserted after the real root and preserves all original content', () => {
  const candidate = composeCompletion(source, [{ d: 'M0 0H1V1H0Z' }]);
  assert.equal(assertCompletionPreserves(source, candidate), 1);
  assert.ok(svgBody(candidate).endsWith(body));
  assert.throws(() => assertCompletionPreserves(source, candidate.replace('#123456', '#abcdef')), /改变了已有 SVG/);
});
test('merge namespaces real IDs and resource links without treating attribute text or comments as elements', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-note="a > b id='fake'" x='99' y='88'><defs><path id='shape' d='M1 1H9V9H1Z'/></defs><style data-note="a > b"><![CDATA[#shape > use {fill:red}]]></style><!-- id="fake" --><use data-note="a > b" href='#shape'/></svg>`;
  const merged = namespaceSvg(svg, 'p');
  const doc = parseXml(merged);
  assert.equal(doc.getElementsByTagName('svg')[0].getAttribute('x'), '0');
  assert.equal(doc.getElementsByTagName('svg')[0].getAttribute('data-note'), "a > b id='fake'");
  assert.equal(doc.getElementsByTagName('path')[0].getAttribute('id'), 'p-shape');
  assert.equal(doc.getElementsByTagName('use')[0].getAttribute('href'), '#p-shape');
  assert.match(merged, /<!\[CDATA\[#p #p-shape > use/);
  assert.ok(merged.includes('<!-- id="fake" -->'));
});
test('actual raster depth labels and split depth regions resolve to the longest real part, leaving ambiguous namespaces empty', () => {
  const parts = ['character:hair', 'character:hair/bangs', 'character:hair/side', 'clothing:collar', 'character:collar'];
  for (const label of ['051 | hair/bangs', '051 hair/bangs', '人物 | 051 | hair/bangs', '051 | 人物 | hair/bangs', 'hair/bangs::front', '053 | hair/bangs::root']) {
    assert.equal(matchLayerPart(label, parts), 'character:hair/bangs');
  }
  assert.equal(matchLayerPart('衣服 | 001 | collar::back', parts), 'clothing:collar');
  assert.equal(matchLayerPart('001 | collar', parts), null);
  assert.equal(matchLayerPart('051 | hair/unknown', parts), 'character:hair');
  assert.equal(matchLayerPart('hairpin', parts), null);
  assert.equal(matchLayerPart('12 | hair/bangs L12', parts), 'character:hair/bangs');
  assert.equal(matchLayerPart('衣服 | 003 collar L3', parts), 'clothing:collar');
  assert.deepEqual(layerPartName('衣装 | 12 | skirt::back'), { namespace: 'clothing:', name: 'skirt::back' });
  assert.deepEqual(layerPartName('D84.1 | face/eyebrows/eyebrow_left | front'), { namespace: undefined, name: 'face/eyebrows/eyebrow_left::front' });
  assert.equal(matchLayerPart('人物 | D84.1 | face/eyebrows/eyebrow_left | front', ['character:face/eyebrows/eyebrow_left']), 'character:face/eyebrows/eyebrow_left');
  assert.equal(matchLayerPart('衣服 | D12 | collar | back', parts), 'clothing:collar');
});
