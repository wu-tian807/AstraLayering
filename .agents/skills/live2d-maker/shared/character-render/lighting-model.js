// Shared, renderer-independent contracts for recipes and geometry.
export const rendererVersion = "mtoon-3.5.5-three-0.180.0-v4";
export const defaults = Object.freeze({
  lightX: 2.4,
  lightY: 0.4,
  lightZ: 1.1,
  lightColor: '#ffffff',
  ambient: 0.16,
  lightingMix: 1,
  shade: "#aaa0ba",
  toony: 0.93,
  shift: -0.25,
  normalStrength: 1,
  normalY: 1,
  depthScale: 0.45,
  shadow: true,
  shadowStrength: 0.72,
  shadowSoftness: 3,
  bias: -0.0015,
  rim: 0,
  background: "#c9c9ce",
});
export const ranges = Object.freeze({
  lightX: [-6, 6],
  lightY: [-6, 6],
  lightZ: [-4, 8],
  ambient: [0, 0.7],
  lightingMix: [0, 1],
  toony: [0, 0.99],
  shift: [-0.9, 0.9],
  normalStrength: [0, 2],
  normalY: [-1, 1],
  depthScale: [0, 1.5],
  shadowStrength: [0, 1],
  shadowSoftness: [1, 8],
  bias: [-0.003, 0.003],
  rim: [0, 0.2],
});
export const presets = Object.freeze({
  anime: { label: "动画", values: { ...defaults } },
  soft: {
    label: "柔和",
    values: {
      ...defaults,
      toony: 0.55,
      shade: "#bab0c7",
      shift: -0.18,
      ambient: 0.2,
    },
  },
  dramatic: {
    label: "戏剧侧光",
    values: {
      ...defaults,
      lightX: 2.8,
      lightY: 1,
      lightZ: 0.4,
      shade: "#827eac",
      toony: 0.94,
      ambient: 0.1,
      shift: -0.18,
    },
  },
  rightSoft: {
    label: "右侧柔光",
    values: {
      ...defaults,
      lightX: 2.8,
      lightY: 0.5,
      lightZ: 1,
      shade: "#b7aec9",
      toony: 0.82,
      shift: -0.2,
      ambient: 0.24,
      normalStrength: 0.85,
      shadowStrength: 0.55,
    },
  },
  maskSoft: {
    label: "蒙版柔光",
    values: {
      ...defaults,
      lightX: 2.8, lightY: 0.5, lightZ: 1,
      shade: "#b7aec9", toony: 0.82, shift: -0.2,
      ambient: 0.24, normalStrength: 0.85,
      lightingMix: 0.55, shadow: false, shadowStrength: 0.55,
    },
  },
  leftSoft: {
    label: "左侧柔光",
    values: {
      ...defaults,
      lightX: -2.8, lightY: 0.5, lightZ: 1.2,
      shade: "#b2b2c9", toony: 0.7, shift: -0.18,
      ambient: 0.22, normalStrength: 0.9, shadowStrength: 0.5,
    },
  },
  warm: {
    label: "暖色夕照",
    values: {
      ...defaults,
      lightX: -2.8, lightY: 1.1, lightZ: 0.7,
      lightColor: "#ffe2be", shade: "#a99dbb",
      toony: 0.86, shift: -0.16, ambient: 0.15,
      lightingMix: 0.8, shadowStrength: 0.6,
    },
  },
  cool: {
    label: "冷色月光",
    values: {
      ...defaults,
      lightX: 2.3, lightY: 1.6, lightZ: 0.8,
      lightColor: "#d4e4ff", shade: "#8f91b5",
      toony: 0.8, shift: -0.2, ambient: 0.14,
      lightingMix: 0.85, shadowStrength: 0.6,
    },
  },
  topSoft: {
    label: "顶部柔光",
    values: {
      ...defaults,
      lightX: 0.4, lightY: 2.8, lightZ: 1.4,
      shade: "#b6afc2", toony: 0.65, shift: -0.12,
      ambient: 0.2, shadowStrength: 0.5, shadowSoftness: 5,
    },
  },
});
export function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("光照参数必须是对象");
  for (const key of Object.keys(value))
    if (!Object.hasOwn(defaults, key)) throw new Error(`未知的光照参数 ${key}`);
  const result = { ...defaults };
  for (const [key, range] of Object.entries(ranges))
    if (value[key] !== undefined) {
      if (
        typeof value[key] !== "number" ||
        !Number.isFinite(value[key]) ||
        value[key] < range[0] ||
        value[key] > range[1]
      )
        throw new Error(`无效的光照参数 ${key}`);
      result[key] = value[key];
    }
  if (![-1, 1].includes(result.normalY))
    throw new Error("法线 Y 方向必须是 +1 或 -1");
  for (const key of ["shade", "background", "lightColor"])
    if (value[key] !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(value[key]))
        throw new Error(`无效颜色 ${key}`);
      result[key] = value[key];
    }
  if (value.shadow !== undefined) {
    if (typeof value.shadow !== "boolean")
      throw new Error("阴影开关必须为布尔值");
    result.shadow = value.shadow;
  }
  return result;
}
// Filter only the derived depth surface, not the artwork. Floating point keeps
// the filtered heights continuous instead of reintroducing 8-bit stair steps.
export function projectionDepth(rgba, alpha, width, height) {
  let a = new Float32Array(width * height),
    b = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) a[i] = rgba[i * 4] / 255;
  for (let pass = 0; pass < 4; pass++) {
    const horizontal = pass % 2 === 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (alpha[i * 4 + 3] < 100) {
          b[i] = a[i];
          continue;
        }
        let sum = 0,
          weight = 0;
        for (let k = -6; k <= 6; k++) {
          const px = horizontal ? Math.min(width - 1, Math.max(0, x + k)) : x,
            py = horizontal ? y : Math.min(height - 1, Math.max(0, y + k)),
            j = py * width + px;
          const diff = Math.abs(a[j] - a[i]);
          if (alpha[j * 4 + 3] < 100 || diff > 0.045) continue;
          const w = (7 - Math.abs(k)) * (1 - diff / 0.045);
          sum += a[j] * w;
          weight += w;
        }
        b[i] = sum / weight;
      }
    [a, b] = [b, a];
  }
  return a;
}

// Orthographic height-field; depth is white-near and never changes x/y or UV.
// Caster triangles crossing a depth discontinuity are omitted, avoiding invented
// curtains joining a raised hand to the face. Hidden surfaces remain unknown.
export function reliefGrid(depth, alpha, width, height, maxEdge = 512) {
  const ny = Math.min(height - 1, maxEdge),
    nx = Math.max(1, Math.round((ny * width) / height));
  const n = (nx + 1) * (ny + 1),
    positions = new Float32Array(n * 3),
    uv = new Float32Array(n * 2),
    values = new Float32Array(n),
    coverage = new Uint8Array(n);
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const i = y * (nx + 1) + x,
        px = Math.min(width - 1, Math.round((x / nx) * (width - 1))),
        py = Math.min(height - 1, Math.round((y / ny) * (height - 1))),
        p = (py * width + px) * 4;
      const z =
        depth.length === width * height
          ? depth[py * width + px]
          : depth[p] / 255;
      positions[i * 3] = ((x / nx - 0.5) * 2 * width) / height;
      positions[i * 3 + 1] = (0.5 - y / ny) * 2;
      positions[i * 3 + 2] = z - 0.5;
      values[i] = z;
      coverage[i] = alpha[p + 3];
      uv[i * 2] = x / nx;
      uv[i * 2 + 1] = 1 - y / ny;
    }
  const display = [],
    caster = [];
  function triangle(a, b, c) {
    display.push(a, b, c);
    if (
      Math.min(coverage[a], coverage[b], coverage[c]) > 100 &&
      Math.max(values[a], values[b], values[c]) -
        Math.min(values[a], values[b], values[c]) <
        0.09
    )
      caster.push(a, b, c);
  }
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const a = y * (nx + 1) + x,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      triangle(a, c, b);
      triangle(b, c, d);
    }
  return {
    positions,
    uv,
    display: new Uint32Array(display),
    caster: new Uint32Array(caster),
    vertices: n,
  };
}
