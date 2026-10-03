/* Offline compiler: an author draws boundary contours, interpolation only runs in the viewer. */
(function (host) {
  "use strict";
  const check = (ok, msg) => {
    if (!ok) throw Error("Boundary compiler: " + msg);
  };
  const clamp = (v) => Math.max(0, Math.min(1, v)),
    smooth = (v) => {
      v = clamp(v);
      return v * v * (3 - 2 * v);
    };
  const arr = (m) => [m.a, m.b, m.c, m.d, m.e, m.f];
  const pt = (m, p) => [
    m.a * p[0] + m.c * p[1] + m.e,
    m.b * p[0] + m.d * p[1] + m.f,
  ];
  const byId = (svg, id) => {
    const n = svg.querySelector("#" + CSS.escape(id));
    check(n, "missing " + id);
    return n;
  };
  function target(node) {
    if (node.id) return { svg_id: node.id };
    let owner = node.parentElement;
    while (owner && !owner.id) owner = owner.parentElement;
    check(owner, "anonymous target lacks ID ancestor");
    return {
      svg_id: owner.id,
      element_index: [...owner.querySelectorAll(node.localName)].indexOf(node),
      tag: node.localName,
    };
  }
  function transform(node, property = "transform") {
    let m = new DOMMatrix();
    const list = node[property]?.baseVal;
    for (let i = 0; i < (list?.numberOfItems || 0); i++)
      m = m.multiply(list.getItem(i).matrix);
    return m;
  }
  function cubic(c, t) {
    const u = 1 - t;
    return [0, 1].map(
      (i) =>
        u * u * u * c[0][i] +
        3 * u * u * t * c[1][i] +
        3 * u * t * t * c[2][i] +
        t * t * t * c[3][i],
    );
  }
  function contour(c, x) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 28; i++) {
      const m = (lo + hi) / 2;
      if (cubic(c, m)[0] < x) lo = m;
      else hi = m;
    }
    return cubic(c, (lo + hi) / 2)[1];
  }
  function sampleOutline(node, m) {
    check(node.localName === "path", "source must be a path");
    const len = node.getTotalLength();
    check(len > 0, "empty source contour");
    const n = Math.max(2048, Math.ceil(len * 32)),
      pts = [];
    for (let i = 0; i <= n; i++) {
      const p = node.getPointAtLength((len * i) / n);
      pts.push(pt(m, [p.x, p.y]));
    }
    const xs = pts.map((p) => p[0]);
    const xmin = Math.min(...xs),
      xmax = Math.max(...xs);
    return {
      xmin,
      xmax,
      at(x) {
        x = Math.max(xmin + 1e-5, Math.min(xmax - 1e-5, x));
        const hits = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1],
            b = pts[i];
          if (
            ((x >= a[0] && x <= b[0]) || (x >= b[0] && x <= a[0])) &&
            Math.abs(a[0] - b[0]) > 1e-9
          )
            hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
        }
        check(hits.length, "source has no vertical contact at " + x);
        return [Math.min(...hits), Math.max(...hits)];
      },
    };
  }
  function orderedForms(region) {
    let cells = [[]];
    for (const a of region.axes)
      cells = cells.flatMap((c) => a.keys.map((v) => [...c, v]));
    check(
      region.keyforms.length === cells.length,
      "missing keyform cell " + region.id,
    );
    return cells.map((at) => {
      const found = region.keyforms.filter(
        (k) => k.at.length === at.length && k.at.every((v, i) => v === at[i]),
      );
      check(
        found.length === 1,
        "missing/duplicate keyform " + region.id + " " + at,
      );
      const k = found[0];
      if (!k.identity) {
        for (const name of region.source.kind === "curve" ? ["curve"] : ["upper", "lower"]) {
          const c = k[name];
          check(
            c?.length === 4 &&
              c.every((p) => p.length === 2 && p.every(Number.isFinite)),
            "invalid contour " + region.id,
          );
          check(
            c.every((p, i) => !i || p[0] >= c[i - 1][0]) && c[0][0] < c[3][0],
            "contour x must be monotonic",
          );
        }
        if (region.source.kind === "curve") return k;
        check(
          k.upper[0].every((v, i) => v === k.lower[0][i]) &&
            k.upper[3].every((v, i) => v === k.lower[3][i]),
          "upper/lower corners must meet",
        );
        for (let i = 0; i <= 100; i++) {
          const x = k.upper[0][0] + ((k.upper[3][0] - k.upper[0][0]) * i) / 100;
          check(
            contour(k.upper, x) <= contour(k.lower, x) + 1e-6,
            "crossed authored boundaries " + region.id,
          );
        }
      }
      return k;
    });
  }
  function compile(svg, recipe) {
    check(
      recipe.schema_version === "0.3.0" &&
        recipe.document_type === "boundary_recipe",
      "unsupported recipe",
    );
    const before = new XMLSerializer().serializeToString(svg),
      claimed = new Set(),
      warnings = [],
      bindings = [],
      regions = [],
      diagnostics = [];
    const subdivisions = recipe.subdivisions ?? 4;
    check(
      Number.isInteger(subdivisions) && subdivisions >= 1 && subdivisions <= 16,
      "subdivisions outside 1..16",
    );
    for (const r of recipe.regions) {
      const frame = AstraSvgGeometry.authorMatrix(byId(svg, r.space), svg),
        inverse = frame.inverse(),
        local = (n) => inverse.multiply(AstraSvgGeometry.authorMatrix(n, svg));
      const source = sampleOutline(
          byId(svg, r.source.path),
          local(byId(svg, r.source.path)),
        ),
        aperture = r.source.aperture
          ? sampleOutline(
              byId(svg, r.source.aperture),
              local(byId(svg, r.source.aperture)),
            )
          : source;
      const sourceEdge = (x) => {
        const y = source.at(x);
        return ["seam", "curve"].includes(r.source.kind)
          ? [(y[0] + y[1]) / 2, (y[0] + y[1]) / 2]
          : y;
      };
      const forms = orderedForms(r),
        [x0, x1] = r.source.x,
        [left, top, right, bottom] = r.bounds;
      check(
        left < x0 && right > x1 && top < bottom,
        "support bounds must contain aperture",
      );
      const maps = forms.map((k) => (p, role) => {
        if (
          k.identity &&
          !(
            r.source.kind === "seam" &&
            (role === "aperture" || role.startsWith("rigid_"))
          )
        )
          return p.slice();
        let [x, y] = p;
        const fromAperture =
          r.source.kind === "seam" &&
          (role === "aperture" || role.startsWith("rigid_"));
        const sx0 = fromAperture ? aperture.xmin : x0,
          sx1 = fromAperture ? aperture.xmax : x1,
          u = clamp((x - sx0) / (sx1 - sx0));
        const sx = sx0 + u * (sx1 - sx0),
          sourceY = fromAperture ? aperture.at(sx) : sourceEdge(sx);
        const boundary = r.source.kind === "curve" ? k.curve : k.upper;
        const tx0 = k.identity ? x0 : boundary[0][0],
          tx1 = k.identity ? x1 : boundary[3][0],
          tx = tx0 + u * (tx1 - tx0);
        if (r.source.kind === "curve") {
          check(role === "curve" || role.startsWith("surface"), "curve source requires curve/surface role");
          const center = sourceY[0];
          let weight = 1;
          if (role.startsWith("surface"))
            weight = y <= center ? smooth((y - top) / (center - top)) : smooth((bottom - y) / (bottom - center));
          if (x < sx0) weight *= smooth((x - left) / (sx0 - left));
          else if (x > sx1) weight *= smooth((right - x) / (right - sx1));
          // Transport the authored silhouette around its centerline, preserving thickness.
          const delta = contour(k.curve, tx) - (k.curve_mode === "offset" ? 0 : center);
          return [x + (tx - sx) * weight, y + delta * weight];
        }
        const dest = k.identity
          ? sourceEdge(tx)
          : [contour(k.upper, tx), contour(k.lower, tx)];
        if (role === "aperture") {
          const v =
            Math.abs(sourceY[1] - sourceY[0]) < 1e-6
              ? 0.5
              : (y - sourceY[0]) / (sourceY[1] - sourceY[0]);
          return [tx, dest[0] + (dest[1] - dest[0]) * v];
        }
        const side = role.includes("upper")
          ? 0
          : role.includes("lower")
            ? 1
            : y <= (sourceY[0] + sourceY[1]) / 2
              ? 0
              : 1;
        let weight = 1;
        if (role.startsWith("surface"))
          weight =
            side === 0
              ? y >= sourceY[0]
                ? 1
                : smooth((y - top) / (sourceY[0] - top))
              : y <= sourceY[1]
                ? 1
                : smooth((bottom - y) / (bottom - sourceY[1]));
        // No tangent rotation: the artist's lash silhouette rides the lid without bending its decorative tips inward.
        if (x < sx0) weight *= smooth((x - left) / (sx0 - left));
        else if (x > sx1) weight *= smooth((right - x) / (right - sx1));
        return [
          x + (tx - sx) * weight,
          y + (dest[side] - sourceY[side]) * weight,
        ];
      });
      const region = {
        id: r.id,
        space: r.space,
        axes: structuredClone(r.axes),
        bounds: r.bounds.slice(),
      };
      regions.push(region);
      const neutralIdentity = forms.some(
        (k) =>
          k.identity &&
          r.axes.every(
            (a, i) => k.at[i] === recipe.parameters[a.parameter].default,
          ),
      );
      const translated = new Set();
      function add(node, role, property, rest, keyforms, extra = {}) {
        const key = (node.id || JSON.stringify(target(node))) + "@" + property;
        check(!claimed.has(key), "duplicate property writer " + key);
        claimed.add(key);
        check(
          keyforms.every(
            (f) => f.length === rest.length && f.every(Number.isFinite),
          ),
          "nonfinite geometry " + key,
        );
        bindings.push({
          region: r.id,
          target: target(node),
          role,
          property,
          rest,
          keyforms,
          source_value: node.getAttribute(property),
          default_source_passthrough:
            neutralIdentity &&
            !(
              r.source.kind === "seam" &&
              (role === "aperture" || role.startsWith("rigid_"))
            ),
          ...extra,
        });
      }
      for (const spec of r.bindings) {
        const nodes = [...svg.querySelectorAll(spec.selector)];
        check(nodes.length, "empty selector " + spec.selector);
        for (const node of nodes) {
          const m = local(node),
            inv = m.inverse();
          if (spec.mode === "translate") {
            translated.add(node);
            const box = node.getBBox(),
              anchor =
                spec.anchor ||
                pt(m, [box.x + box.width / 2, box.y + box.height / 2]),
              rest = transform(node);
            const parent = local(node.parentElement),
              parentInv = parent.inverse();
            if (spec.key_offsets) {
              check(
                spec.key_offsets.length === forms.length,
                "offset grid incomplete",
              );
              for (const k of forms)
                check(
                  spec.key_offsets.filter(
                    (o) =>
                      o.at.length === k.at.length &&
                      o.at.every((v, i) => v === k.at[i]),
                  ).length === 1,
                  "offset cell missing/duplicate",
                );
            }
            const keyforms = maps.map((map, index) => {
              const offset = spec.key_offsets?.find((o) =>
                o.at.every((v, i) => v === forms[index].at[i]),
              )?.offset || [0, 0];
              check(
                offset.length === 2 && offset.every(Number.isFinite),
                "invalid authored offset",
              );
              const mapped = map(anchor, spec.role),
                q = [mapped[0] + offset[0], mapped[1] + offset[1]],
                a = pt(parentInv, anchor),
                b = pt(parentInv, q);
              return arr(
                new DOMMatrix()
                  .translate(b[0] - a[0], b[1] - a[1])
                  .multiply(rest),
              );
            });
            add(node, spec.role, "transform", arr(rest), keyforms);
            continue;
          }
          check(
            node.localName === "path",
            "non-path requires mode translate " + (node.id || node.localName),
          );
          const d = node.getAttribute("d");
          const normalized = AstraSvgGeometry.normalizePath(
              d,
              spec.subdivisions ?? subdivisions,
            ),
            parsed = AstraSvgGeometry.pathData(normalized);
          const keyforms = maps.map((map) => {
            const out = [];
            for (let i = 0; i < parsed.values.length; i += 2)
              out.push(
                ...pt(
                  inv,
                  map(
                    pt(m, [parsed.values[i], parsed.values[i + 1]]),
                    spec.role,
                  ),
                ),
              );
            return out;
          });
          add(node, spec.role, "d", parsed.values, keyforms, {
            commands: parsed.commands,
          });
        }
      }
      for (const paint of r.paints || []) {
        const node = byId(svg, paint.svg_id);
        check(
          ["linearGradient", "radialGradient"].includes(node.localName),
          "paint must be gradient",
        );
        check(
          node.getAttribute("gradientUnits") === "userSpaceOnUse",
          "paint needs explicit userSpaceOnUse",
        );
        const consumers = [...svg.querySelectorAll("[fill],[stroke]")].filter(
          (n) =>
            ["fill", "stroke"].some((k) =>
              (n.getAttribute(k) || "").includes("#" + paint.svg_id + ")"),
            ),
        );
        if (consumers.length && consumers.every((n) => translated.has(n))) {
          warnings.push(
            "paint transported by translated consumer: " + paint.svg_id,
          );
          continue;
        }
        const rest = transform(node, "gradientTransform"),
          [x, y] = paint.anchor,
          keyforms = maps.map((map) => {
            const q = map([x, y], paint.role),
              dx = map([x + 0.01, y], paint.role),
              dy = map([x, y + 0.01], paint.role),
              a = (dx[0] - q[0]) / 0.01,
              b = (dx[1] - q[1]) / 0.01,
              c = (dy[0] - q[0]) / 0.01,
              d = (dy[1] - q[1]) / 0.01;
            return arr(
              new DOMMatrix([
                a,
                b,
                c,
                d,
                q[0] - a * x - c * y,
                q[1] - b * x - d * y,
              ]).multiply(rest),
            );
          });
        add(node, paint.role, "gradientTransform", arr(rest), keyforms);
      }
      diagnostics.push({
        region: r.id,
        authored_cells: forms.length,
        ...(r.source.kind === "curve" ? { centerline: forms.map(k => ({ at: k.at, identity: !!k.identity, curve: k.curve })) } : {
        aperture: forms.map((k) => ({
          at: k.at,
          width: k.identity ? x1 - x0 : k.upper[3][0] - k.upper[0][0],
          center_gap: k.identity
            ? r.source.kind === "seam"
              ? 0
              : source.at((x0 + x1) / 2)[1] - source.at((x0 + x1) / 2)[0]
            : contour(k.lower, (k.upper[0][0] + k.upper[3][0]) / 2) -
              contour(k.upper, (k.upper[0][0] + k.upper[3][0]) / 2),
        })),
        }),
      });
    }
    const corners = regions.flatMap((r) => {
      const m = AstraSvgGeometry.authorMatrix(byId(svg, r.space), svg),
        [l, t, right, bottom] = r.bounds;
      return [
        [l, t],
        [right, bottom],
        [l, bottom],
        [right, t],
      ].map((p) => pt(m, p));
    });
    const x0 = Math.min(...corners.map((p) => p[0])),
      x1 = Math.max(...corners.map((p) => p[0])),
      y0 = Math.min(...corners.map((p) => p[1])),
      y1 = Math.max(...corners.map((p) => p[1])),
      size = Math.max(x1 - x0, y1 - y0) + 24;
    const rig = {
      focus: [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size],
      schema_version: "0.3.0",
      document_type: "boundary_rig",
      character_id: recipe.character_id,
      svg: "character.svg",
      source: {
        svg_sha256: recipe.source_sha256,
        recipe_sha256: "0".repeat(64),
        generator: "boundary-keyforms-v1",
      },
      parameters: structuredClone(recipe.parameters),
      ...(recipe.capability_profile ? { capability_profile: recipe.capability_profile } : {}),
      regions,
      bindings,
      resources: structuredClone(recipe.resources || []),
    };
    AstraBoundaryRig.validate(rig);
    check(
      before === new XMLSerializer().serializeToString(svg),
      "compiler modified original SVG",
    );
    return { rig, warnings, diagnostics };
  }
  host.AstraBoundaryCompiler = { compile, orderedForms };
})(globalThis);
