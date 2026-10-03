/* Compiled, author-designed SVG keyforms. No model calls, path parsing or deformation formulas per frame. */
(function (host) {
  "use strict";
  const check = (ok, msg) => {
    if (!ok) throw Error("Boundary rig: " + msg);
  };
  const finite = Number.isFinite;
  function bracket(keys, value) {
    let hi = 1;
    while (hi < keys.length - 1 && value > keys[hi]) hi++;
    const lo = hi - 1;
    return [lo, hi, (value - keys[lo]) / (keys[hi] - keys[lo])];
  }
  function weights(axes, values) {
    let cells = [[0, 1]];
    for (const axis of axes) {
      const [lo, hi, t] = bracket(axis.keys, values[axis.parameter]);
      const next = [];
      for (const [idx, w] of cells) {
        if (t < 1) next.push([idx * axis.keys.length + lo, w * (1 - t)]);
        if (t > 0) next.push([idx * axis.keys.length + hi, w * t]);
      }
      cells = next;
    }
    return cells;
  }
  function interpolate(forms, blend, out) {
    out.fill(0);
    for (const [i, w] of blend) {
      const src = forms[i];
      for (let j = 0; j < out.length; j++) out[j] += src[j] * w;
    }
    return out;
  }
  function target(svg, t) {
    const owner =
      svg.id === t.svg_id ? svg : svg.querySelector("#" + CSS.escape(t.svg_id));
    check(owner, "missing " + t.svg_id);
    if (t.path_index !== undefined)
      return owner.querySelectorAll("path")[t.path_index];
    if (t.element_index !== undefined)
      return owner.querySelectorAll(t.tag)[t.element_index];
    return owner;
  }
  const BASIC_FACE_GROUPS = [
    ["eye.left.open", "eye.left.curve"],
    ["eye.right.open", "eye.right.curve"],
    ["brow.left.height", "brow.left.angle", "brow.left.curve"],
    ["brow.right.height", "brow.right.angle", "brow.right.curve"],
    ["mouth.open", "mouth.form"],
  ];
  function validateCapabilityProfile(rig) {
    if (rig.capability_profile === undefined) return null;
    check(rig.capability_profile === "basic-face-v1", "unsupported capability profile");
    const defaults = Object.fromEntries(Object.entries(rig.parameters).map(([id, p]) => [id, p.default]));
    const evidence = [];
    for (const ids of BASIC_FACE_GROUPS) {
      for (const id of ids) {
        const p = rig.parameters[id], open = id.endsWith(".open");
        check(p && p.min === (open ? 0 : -1) && p.max === 1 && p.default === (id.startsWith("eye.") && open ? 1 : 0), "basic-face-v1 missing/invalid parameter " + id);
      }
      const regions = rig.regions.filter(r => r.axes.length === ids.length && ids.every(id => r.axes.some(a => a.parameter === id)));
      check(regions.length === 1, "basic-face-v1 needs one joint region for " + ids.join(" × "));
      const region = regions[0];
      check(region.axes.every(a => a.keys.includes(defaults[a.parameter])), "basic-face-v1 needs neutral keys in " + region.id);
      const geometry = rig.bindings.filter(b => b.region === region.id && ["d", "transform"].includes(b.property));
      check(geometry.length, "basic-face-v1 missing geometry in " + region.id);
      function difference(id, conditions) {
        const low = weights(region.axes, { ...defaults, ...conditions, [id]: rig.parameters[id].min });
        const high = weights(region.axes, { ...defaults, ...conditions, [id]: rig.parameters[id].max });
        let delta = 0;
        for (const b of geometry) {
          const a = interpolate(b.keyforms, low, new Float64Array(b.rest.length));
          const z = interpolate(b.keyforms, high, new Float64Array(b.rest.length));
          for (let i = 0; i < a.length; i++) delta = Math.max(delta, Math.abs(a[i] - z[i]));
        }
        check(delta > 1e-6, "basic-face-v1 ineffective parameter " + id + " at " + JSON.stringify(conditions));
        evidence.push({ parameter: id, conditions, maximum_coordinate_delta: delta });
      }
      for (const id of ids) difference(id, {});
      if (ids[0].startsWith("eye.")) difference(ids[1], { [ids[0]]: 0 });
    }
    return { profile: rig.capability_profile, parameters: BASIC_FACE_GROUPS.flat(), effects: evidence };
  }
  function validate(rig) {
    check(
      rig?.schema_version === "0.3.0" && rig.document_type === "boundary_rig",
      "unsupported document",
    );
    check(rig.source?.svg_sha256?.length === 64, "source fingerprint missing");
    check(
      rig.parameters &&
        Array.isArray(rig.regions) &&
        Array.isArray(rig.bindings),
      "incomplete document",
    );
    for (const [id, p] of Object.entries(rig.parameters))
      check(
        p.type === "number" &&
          [p.min, p.max, p.default].every(finite) &&
          p.min < p.max &&
          p.default >= p.min &&
          p.default <= p.max,
        "invalid parameter " + id,
      );
    const regions = new Map();
    for (const r of rig.regions) {
      check(!regions.has(r.id), "duplicate region " + r.id);
      check(
        new Set(r.axes.map((a) => a.parameter)).size === r.axes.length,
        "duplicate axis " + r.id,
      );
      check(
        r.axes.length > 0 && r.axes.length <= 3,
        "axes must contain 1..3 parameters",
      );
      let count = 1;
      for (const a of r.axes) {
        const p = rig.parameters[a.parameter];
        check(
          p &&
            a.keys.length >= 2 &&
            a.keys.every((v, i) => finite(v) && (!i || v > a.keys[i - 1])) &&
            a.keys[0] === p.min &&
            a.keys.at(-1) === p.max,
          "axis does not cover parameter " + a.parameter,
        );
        count *= a.keys.length;
      }
      regions.set(r.id, { ...r, count });
    }
    const writers = new Set();
    for (const b of rig.bindings) {
      const identity = JSON.stringify(b.target) + "@" + b.property;
      check(!writers.has(identity), "duplicate binding writer");
      writers.add(identity);
      const r = regions.get(b.region);
      check(
        r &&
          b.target?.svg_id &&
          ["d", "transform", "gradientTransform"].includes(b.property),
        "invalid binding",
      );
      check(b.rest.every(finite), "nonfinite rest geometry");
      check(
        b.keyforms.length === r.count &&
          b.keyforms.every(
            (f) => f.length === b.rest.length && f.every(finite),
          ),
        "incomplete keyform grid " + b.target.svg_id,
      );
      if (b.property === "d")
        check(
          b.commands?.length &&
            b.commands.every((c) => ["M", "L", "C", "Q", "Z"].includes(c)) &&
            b.commands.reduce(
              (n, c) => n + ({ M: 2, L: 2, C: 6, Q: 4, Z: 0 }[c] || 0),
              0,
            ) === b.rest.length,
          "invalid path commands",
        );
      else check(b.rest.length === 6, "invalid transform");
    }
    validateCapabilityProfile(rig);
    return regions;
  }
  class Runtime {
    constructor(svg, rig) {
      this.svg = svg;
      this.rig = rig;
      this.regions = validate(rig);
      this.values = Object.fromEntries(
        Object.entries(rig.parameters).map(([id, p]) => [id, p.default]),
      );
      this.bindings = [];
      this.dirty = new Set(this.regions.keys());
      this.original = [];
      this.disposed = false;
      this.stats = { updates: 0, updatedBindings: 0, elapsedMs: 0 };
      for (const r of rig.resources || []) {
        const node = target(svg, r);
        check(
          node && ["filter", "mask", "rect"].includes(node.localName),
          "resource must be filter, mask or rect",
        );
        for (const [k, v] of Object.entries(r.attributes)) {
          check(
            ["x", "y", "width", "height"].includes(k) && finite(v),
            "invalid resource bound",
          );
          this.original.push([node, k, node.getAttribute(k)]);
          node.setAttribute(k, String(v));
        }
      }
      for (const b of rig.bindings) {
        const node = target(svg, b.target);
        check(node, "missing indexed node " + b.target.svg_id);
        check(
          b.property !== "d" || node.localName === "path",
          "path target mismatch",
        );
        this.original.push([node, b.property, node.getAttribute(b.property)]);
        this.bindings.push({
          ...b,
          node,
          keyforms: b.keyforms.map((f) => new Float64Array(f)),
          out: new Float64Array(b.rest.length),
          last: null,
        });
      }
      this.apply();
    }
    setParameters(partial) {
      check(!this.disposed, "disposed");
      const checked = [];
      for (const [id, value] of Object.entries(partial)) {
        const p = this.rig.parameters[id];
        check(
          p && finite(value) && value >= p.min && value <= p.max,
          "parameter out of range " + id,
        );
        checked.push([id, value]);
      }
      for (const [id, value] of checked) {
        if (this.values[id] === value) continue;
        this.values[id] = value;
        for (const r of this.regions.values())
          if (r.axes.some((a) => a.parameter === id)) this.dirty.add(r.id);
      }
      return this.apply();
    }
    apply() {
      const start = performance.now();
      if (!this.dirty.size)
        return { changed: false, updatedBindings: 0, elapsedMs: 0 };
      const blends = new Map();
      const neutral = new Map();
      for (const id of this.dirty) {
        const r = this.regions.get(id);
        blends.set(id, weights(r.axes, this.values));
        neutral.set(
          id,
          r.axes.every(
            (a) =>
              this.values[a.parameter] ===
              this.rig.parameters[a.parameter].default,
          ),
        );
      }
      let updated = 0;
      for (const b of this.bindings) {
        const blend = blends.get(b.region);
        if (!blend) continue;
        let text;
        if (b.default_source_passthrough && neutral.get(b.region))
          text = b.source_value;
        else {
          const v = interpolate(b.keyforms, blend, b.out);
          if (b.property === "d") {
            let i = 0;
            const parts = [];
            for (const cmd of b.commands) {
              parts.push(cmd);
              const n = cmd === "Z" ? 0 : cmd === "C" ? 6 : cmd === "Q" ? 4 : 2;
              for (let j = 0; j < n; j++)
                parts.push(String(Math.round(v[i++] * 10000) / 10000));
            }
            text = parts.join(" ");
          } else
            text =
              "matrix(" +
              Array.from(v, (n) => Math.round(n * 1e7) / 1e7).join(" ") +
              ")";
        }
        if (b.last !== text) {
          if (text === null) b.node.removeAttribute(b.property);
          else b.node.setAttribute(b.property, text);
          b.last = text;
          updated++;
        }
      }
      this.dirty.clear();
      const elapsed = performance.now() - start;
      this.stats.updates++;
      this.stats.updatedBindings = updated;
      this.stats.elapsedMs = elapsed;
      return {
        changed: updated > 0,
        updatedBindings: updated,
        elapsedMs: elapsed,
      };
    }
    reset() {
      return this.setParameters(
        Object.fromEntries(
          Object.entries(this.rig.parameters).map(([id, p]) => [id, p.default]),
        ),
      );
    }
    dispose() {
      if (this.disposed) return;
      for (const [n, k, v] of this.original) {
        if (v === null) n.removeAttribute(k);
        else n.setAttribute(k, v);
      }
      this.original.length = 0;
      this.bindings.length = 0;
      this.disposed = true;
    }
  }
  const api = { Runtime, validate, validateCapabilityProfile, BASIC_FACE_GROUPS, weights, interpolate };
  host.AstraBoundaryRig = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : this);
