import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as fflate from "fflate";
import * as agPsd from "ag-psd";
import sharp from "sharp";
const script = await readFile(
  new URL("../studio/document-worker.js", import.meta.url),
  "utf8",
);
async function decode(bytes: Uint8Array, name: string): Promise<any> {
  let result: any;
  const self: any = {
    postMessage: (data: any) => {
      result = data;
    },
  };
  runInNewContext(script, {
    self,
    importScripts: () => {},
    fflate,
    agPsd,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Uint8ClampedArray,
    Uint32Array,
    DataView,
    Blob,
  });
  self.onmessage({ data: { bytes: bytes.slice().buffer, name } });
  if (result.error) throw Error(result.error);
  return result;
}
test("KRA reads saved full-size composite without unzipping paint layers", async () => {
  const image = await sharp({
    create: { width: 34, height: 51, channels: 4, background: "#a3bedc80" },
  })
    .png()
    .toBuffer();
  const xml =
    '<DOC><IMAGE width="34" height="51"><layers><layer name="hair"/></layers></IMAGE></DOC>';
  const kra = fflate.zipSync({
    "mergedimage.png": image,
    "maindoc.xml": new TextEncoder().encode(xml),
    "paint-layer": new Uint8Array(1000000),
  });
  const result = await decode(kra, "character.kra");
  assert.equal(result.width, 34);
  assert.equal(result.height, 51);
  assert.equal(result.xml, xml);
  assert.deepEqual(
    Buffer.from(await result.color.arrayBuffer()),
    image,
    "KRA PNG is retained byte for byte",
  );
  await assert.rejects(
    decode(fflate.zipSync({ "maindoc.xml": new Uint8Array() }), "bad.kra"),
    Error,
  );
});
test("PSD preserves saved composite RGBA and nested, inherited layer visibility", async () => {
  const width = 16,
    height = 12,
    data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4)
    data.set([50, 120, 200, i < width * 4 ? 0 : 255], i);
  const bytes = agPsd.writePsdUint8Array({
    width,
    height,
    imageData: { width, height, data },
    children: [
      { name: "face" },
      {
        name: "hair",
        hidden: true,
        children: [{ name: "fringe", opacity: 0.7 }],
      },
    ],
  });
  const result = await decode(bytes, "character.psd");
  const { data: pixels, info } = await sharp(
    Buffer.from(await result.color.arrayBuffer()),
  )
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, width);
  assert.equal(info.height, height);
  assert.deepEqual([...pixels], [...data]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.layers)), [
    {
      name: "hair",
      depth: 0,
      visible: false,
      effectiveVisible: false,
      group: true,
      opacity: 1,
    },
    {
      name: "fringe",
      depth: 1,
      visible: true,
      effectiveVisible: false,
      group: false,
      opacity: Math.round(0.7 * 255) / 255,
    },
    {
      name: "face",
      depth: 0,
      visible: true,
      effectiveVisible: true,
      group: false,
      opacity: 1,
    },
  ]);
  const unsupported = bytes.slice();
  new DataView(unsupported.buffer).setUint16(22, 16);
  await assert.rejects(decode(unsupported, "16bit.psd"), Error);
  const excessive = bytes.slice();
  new DataView(excessive.buffer).setUint32(18, 30000);
  new DataView(excessive.buffer).setUint32(14, 30000);
  await assert.rejects(decode(excessive, "large.psd"), Error);
});
