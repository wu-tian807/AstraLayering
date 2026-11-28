import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { validateDocument, psdStructure } from "../layer-compositor.ts";
import { layerTree, stateKey, type Layer } from "../studio/layer-model.js";
import { writePsdUint8Array } from "ag-psd";
test("Layer tree preserves own visibility through parent toggles, collapse and filtered ancestry", () => {
  const layers: Layer[] = [
    {
      id: "group",
      parentId: null,
      depth: 0,
      name: "Head",
      visible: false,
      opacity: 255,
      blend: "normal",
      inheritAlpha: false,
      passThrough: false,
    },
    {
      id: "hair",
      parentId: "group",
      depth: 1,
      name: "Hair",
      visible: true,
      opacity: 255,
      blend: "normal",
      inheritAlpha: false,
      passThrough: null,
    },
    {
      id: "mask",
      parentId: "hair",
      depth: 2,
      name: "Mask",
      visible: false,
      opacity: 255,
      blend: "normal",
      inheritAlpha: false,
      passThrough: null,
    },
  ];
  const before = stateKey(layers);
  let rows = layerTree(layers, new Set(["group"]));
  assert.equal(rows[1].visible, true);
  assert.equal(rows[1].inheritedHidden, true);
  assert.equal(rows[1].shown, false);
  rows = layerTree(layers, new Set(["group"]), "mask");
  assert.deepEqual(
    rows.map((r) => r.shown),
    [true, true, true],
  );
  assert.equal(stateKey(layers), before);
  layers[0].visible = true;
  rows = layerTree(layers);
  assert.equal(rows[1].inheritedHidden, false);
  assert.equal(rows[2].visible, false);
  layers[0].name = "Renamed";
  assert.equal(
    stateKey(layers),
    stateKey(layers.map((l) => ({ ...l, name: "ignored" }))),
  );
});
test("Native import validates canvas size and external resources before Krita opens files", () => {
  const kra = (xml: string) => zipSync({ "maindoc.xml": strToU8(xml) });
  assert.equal(
    validateDocument(kra('<IMAGE width="16" height="32"/>'), "kra"),
    512,
  );
  assert.throws(
    () => validateDocument(kra('<IMAGE width="16000" height="16000"/>'), "kra"),
    Error,
  );
  assert.throws(
    () =>
      validateDocument(
        kra(
          '<IMAGE width="16" height="32"><layer nodetype="filelayer"/></IMAGE>',
        ),
        "kra",
      ),
    Error,
  );
  assert.throws(
    () =>
      validateDocument(
        zipSync({
          "maindoc.xml": strToU8('<IMAGE width="16" height="32"/>'),
          "shape.svg": strToU8('<svg><image href="file:///etc/passwd"/></svg>'),
        }),
        "kra",
      ),
    Error,
  );
  assert.throws(() => validateDocument(new Uint8Array(5), "psd"), Error);
});
test("KRA import reads quoted > and single quotes as XML, ignoring fake file layers in comments and attribute text", () => {
  const kra = (xml: string) => zipSync({ 'maindoc.xml': strToU8(xml) });
  assert.equal(validateDocument(kra(`<IMAGE name="a > b nodetype='filelayer'" width = '16' height = '32'><!-- <layer nodetype="filelayer"/> --><layer nodetype="paintlayer"/></IMAGE>`), 'kra'), 512);
  assert.throws(() => validateDocument(kra(`<IMAGE name="a > b" width='16' height='32'><layer nodetype='filelayer'/></IMAGE>`), 'kra'), Error);
});
test("PSD structure retains clipping, disabled masks, child visibility and group opacity without pixel decode", () => {
  const psd = writePsdUint8Array({
    width: 16,
    height: 16,
    children: [
      {
        name: "Group",
        opacity: 0.5,
        children: [
          { name: "base", hidden: true },
          { name: "clip", clipping: true },
        ],
      },
    ],
  });
  assert.equal(validateDocument(psd, "psd"), 256);
  const tree = psdStructure(psd);
  assert.equal(tree[0].opacity, 128);
  assert.equal(tree[0].children[0].visible, false);
  assert.equal(tree[0].children[1].clipping, true);
});
