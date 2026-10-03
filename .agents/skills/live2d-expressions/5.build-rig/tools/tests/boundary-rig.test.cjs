const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  weights,
  interpolate,
  Runtime,
  validate,
} = require("../../../tools/preview/svg-boundary-runtime.js");
const { open } = require("../build-rig.cjs"),
  { mount } = require("../../../tools/svg-source.cjs");
const rig = () => ({
  schema_version: "0.3.0",
  document_type: "boundary_rig",
  source: { svg_sha256: "a".repeat(64) },
  parameters: {
    x: { type: "number", min: 0, max: 1, default: 0 },
    y: { type: "number", min: -1, max: 1, default: 0 },
  },
  regions: [
    {
      id: "mouth",
      axes: [
        { parameter: "x", keys: [0, 1] },
        { parameter: "y", keys: [-1, 0, 1] },
      ],
    },
  ],
  bindings: [
    {
      region: "mouth",
      target: { svg_id: "p" },
      property: "d",
      commands: ["M", "L"],
      source_value: "M0 0L1 1",
      default_source_passthrough: true,
      rest: [0, 0, 1, 1],
      keyforms: [
        [0, 0, 1, 1],
        [1, 0, 2, 1],
        [2, 0, 3, 1],
        [0, 4, 1, 5],
        [1, 8, 2, 9],
        [2, 12, 3, 13],
      ],
    },
  ],
});
test("two independent axes interpolate actual six authored cells", () => {
  const r = rig(),
    b = r.bindings[0],
    axes = r.regions[0].axes;
  assert.deepEqual(
    [
      ...interpolate(
        b.keyforms,
        weights(axes, { x: 1, y: 0 }),
        new Float64Array(4),
      ),
    ],
    [1, 8, 2, 9],
  );
  assert.deepEqual(
    [
      ...interpolate(
        b.keyforms,
        weights(axes, { x: 0.5, y: 0.5 }),
        new Float64Array(4),
      ),
    ],
    [1.5, 5, 2.5, 6],
  );
});
test("runtime rejects malformed topology and missing Cartesian cells", () => {
  const r = rig();
  validate(r);
  r.bindings[0].rest.pop();
  assert.throws(() => validate(r), /incomplete keyform/);
  const s = rig();
  s.bindings[0].commands = ["M"];
  assert.throws(() => validate(s), /invalid path/);
  const t = rig();
  t.bindings[0].keyforms.pop();
  assert.throws(() => validate(t), /incomplete keyform/);
});
test("parameter commands are atomic, no-op is free, reset and disposal restore original attributes", () => {
  global.CSS = { escape: (s) => s };
  let value = "original",
    writes = 0;
  const node = {
      localName: "path",
      getAttribute: () => value,
      setAttribute: (k, v) => {
        value = v;
        writes++;
      },
      removeAttribute: () => {
        value = null;
        writes++;
      },
    },
    svg = { querySelector: () => node };
  const r = new Runtime(svg, rig());
  r.setParameters({ x: 1 });
  const before = value,
    count = writes;
  assert.throws(() => r.setParameters({ x: 0, y: 2 }), /out of range/);
  assert.equal(r.values.x, 1);
  assert.equal(value, before);
  assert.equal(r.setParameters({ x: 1 }).changed, false);
  assert.equal(writes, count);
  r.reset();
  assert.equal(value, "M0 0L1 1");
  r.dispose();
  assert.equal(value, "original");
  assert.throws(() => r.setParameters({ x: 0 }), /disposed/);
});
test("browser compilation preserves source and makes both mirrored eye apertures close to one curve", async () => {
  const { browser, page } = await open();
  try {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 40 15"><g id="right"><path id="ap" d="M0 0 C3 -4 7 -4 10 0 C7 4 3 4 0 0Z"/></g><g id="left" transform="translate(30 0) scale(-1 1)"><path id="ap2" d="M0 0 C3 -4 7 -4 10 0 C7 4 3 4 0 0Z"/></g></svg>';
    await mount(page, svg);
    const result = await page.evaluate(() => {
      const region = (id, space, path) => ({
        id,
        space,
        source: { kind: "aperture", path, x: [0, 10] },
        bounds: [-5, -5, 15, 5],
        axes: [{ parameter: id, keys: [0, 1] }],
        keyforms: [
          {
            at: [0],
            upper: [
              [0, 0],
              [3, 0],
              [7, 0],
              [10, 0],
            ],
            lower: [
              [0, 0],
              [3, 0],
              [7, 0],
              [10, 0],
            ],
          },
          { at: [1], identity: true },
        ],
        bindings: [{ selector: "#" + path, role: "aperture" }],
      });
      const recipe = {
        schema_version: "0.3.0",
        document_type: "boundary_recipe",
        character_id: "fixture",
        source_sha256: "a".repeat(64),
        parameters: {
          right: { type: "number", min: 0, max: 1, default: 1 },
          left: { type: "number", min: 0, max: 1, default: 1 },
        },
        regions: [
          region("right", "right", "ap"),
          region("left", "left", "ap2"),
        ],
      };
      const source = new XMLSerializer().serializeToString(rigSvg),
        compiled = AstraBoundaryCompiler.compile(rigSvg, recipe),
        unchanged = source === new XMLSerializer().serializeToString(rigSvg);
      const runtime = new AstraBoundaryRig.Runtime(rigSvg, compiled.rig);
      runtime.setParameters({ right: 0, left: 0 });
      const y = [];
      for (const id of ["ap", "ap2"]) {
        const n = document.getElementById(id);
        for (let i = 0; i <= 100; i++)
          y.push(
            Math.abs(n.getPointAtLength((n.getTotalLength() * i) / 100).y),
          );
      }
      runtime.reset();
      const restored = source === new XMLSerializer().serializeToString(rigSvg);
      let missing = false;
      recipe.regions[0].keyforms.pop();
      try {
        AstraBoundaryCompiler.compile(rigSvg, recipe);
      } catch (e) {
        missing = /missing keyform/.test(e.message);
      }
      return { unchanged, restored, maxY: Math.max(...y), missing };
    });
    assert.equal(result.unchanged, true);
    assert.equal(result.restored, true);
    assert.ok(result.maxY < 1e-6);
    assert.equal(result.missing, true);
  } finally {
    await browser.close();
  }
});


test("basic face requires every functional axis, including curve at fully closed eyes", () => {
  const { BASIC_FACE_GROUPS, validateCapabilityProfile } = require("../../../tools/preview/svg-boundary-runtime.js");
  const r = { ...rig(), capability_profile: "basic-face-v1", parameters: {}, regions: [], bindings: [] };
  for (const ids of BASIC_FACE_GROUPS) {
    const axes = ids.map(id => {
      const open = id.endsWith(".open");
      r.parameters[id] = { type: "number", min: open ? 0 : -1, max: 1, default: id.startsWith("eye.") && open ? 1 : 0 };
      return { parameter: id, keys: open ? [0, 1] : [-1, 0, 1] };
    });
    let cells = [[]];
    for (const a of axes) cells = cells.flatMap(c => a.keys.map(v => [...c, v]));
    r.regions.push({ id: ids[0], axes });
    r.bindings.push({ region: ids[0], target: { svg_id: ids[0] }, property: "d", commands: ["M", "L"], rest: [0, 0, 1, 1], keyforms: cells.map(c => [c[0], c[1], 1 + (c[2] || 0), 1]) });
  }
  validate(r);
  assert.equal(validateCapabilityProfile(r).effects.length, 14);
  const absent = structuredClone(r); delete absent.parameters["brow.left.curve"];
  assert.throws(() => validateCapabilityProfile(absent), /missing\/invalid parameter brow.left.curve/);
  const ineffective = structuredClone(r);
  ineffective.bindings[0].keyforms.slice(0, 3).forEach(f => { f[1] = 0; });
  assert.throws(() => validate(ineffective), /ineffective parameter eye.left.curve.*open.*0/);
  const detached = structuredClone(r); detached.bindings.splice(2, 1);
  assert.throws(() => validate(detached), /missing geometry/);
});

test("curve compiler preserves brow thickness and interpolates height, angle and curvature together", async () => {
  const { browser, page } = await open();
  try {
    await mount(page, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -10 20 20"><g id="brow"><path id="shape" d="M0 -1L10 -1L10 1L0 1Z"/></g></svg>');
    const result = await page.evaluate(() => {
      const parameters = Object.fromEntries(["height", "angle", "curve"].map(id => [id, { type: "number", min: -1, max: 1, default: 0 }]));
      const keys = [-1, 0, 1], forms = [];
      for (const h of keys) for (const a of keys) for (const c of keys) {
        forms.push(h === 0 && a === 0 && c === 0 ? { at: [h, a, c], identity: true } : {
          at: [h, a, c], curve_mode: "offset", curve: [[0, 2*h-a], [10/3, 2*h-a/3-2*c], [20/3, 2*h+a/3-2*c], [10, 2*h+a]],
        });
      }
      const recipe = { schema_version: "0.3.0", document_type: "boundary_recipe", character_id: "fixture", source_sha256: "a".repeat(64), parameters,
        regions: [{ id: "brow", space: "brow", source: { kind: "curve", path: "shape", x: [0, 10] }, bounds: [-5, -10, 15, 10],
          axes: Object.keys(parameters).map(parameter => ({ parameter, keys })), keyforms: forms, bindings: [{ selector: "#shape", role: "curve" }] }] };
      const before = new XMLSerializer().serializeToString(rigSvg);
      const { rig } = AstraBoundaryCompiler.compile(rigSvg, recipe);
      const unchanged = before === new XMLSerializer().serializeToString(rigSvg);
      const runtime = new AstraBoundaryRig.Runtime(rigSvg, rig);
      runtime.setParameters({ height: 1 });
      const box = document.getElementById("shape").getBBox();
      const heightBox = { y: box.y, height: box.height, width: box.width };
      runtime.setParameters({ height: 0.5, angle: 0.5, curve: 0.5 });
      const combined = document.getElementById("shape").getAttribute("d");
      runtime.reset();
      return { unchanged, restored: before === new XMLSerializer().serializeToString(rigSvg), heightBox, combined, original: rig.bindings[0].source_value };
    });
    assert.equal(result.unchanged, true); assert.equal(result.restored, true);
    assert.ok(Math.abs(result.heightBox.y - 1) < 1e-6, JSON.stringify(result.heightBox));
    assert.ok(Math.abs(result.heightBox.height - 2) < 1e-6);
    assert.ok(Math.abs(result.heightBox.width - 10) < 1e-6);
    assert.notEqual(result.combined, result.original);
  } finally { await browser.close(); }
});
