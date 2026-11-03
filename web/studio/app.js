import { LightingStage, loadImage } from "./renderer.js";
import { LayerPanel } from "./layer-panel.js";
import { SurfacePreview } from "./surface-preview.js";
import { stateKey } from "./layer-model.js";
import { openDocument } from "./document-loader.js";
import { ProjectionPanel } from './projection-panel.js';
import { projectionOnlyEdit } from './projection-model.js';
import { PhysicsPanel } from './physics-panel.js';
import { HeadNineAxisPanel } from './nine-axis-panel.js';
import { physicsProjects, createPhysicsCase } from './physics-cases.js';
import { pickServerPath } from '../server-picker.js';
import {
  defaults,
  presets,
  validateSettings,
  rendererVersion,
} from "./lighting-model.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const state = {
  settings: { ...presets.rightSoft.values },
  tool: "move",
  view: "lit",
  source: null,
  inputs: null,
  busy: false,
  layerBusy: false,
  surfaceActive: false,
  projectOpening: false,
  waitingProject: null,
  generation: 0,
  workspace: 'lighting',
  lightingEnabled: true,
};
let projections, physics, nineAxis;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 5500);
}
async function get(url) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || r.statusText);
  return data;
}
async function blob(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error(`文件读取失败 (${r.status})`);
  return r.blob();
}
async function hash(file) {
  if (!file) return null;
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
// UI units are separate from renderer units. One world unit = half canvas height.
const sliders = {
  lightingMix: ['光照混合', 0, 100, 1, '%', '底图', '光照', v => v * 100, v => v / 100, '实时光照与底图的混合比例；0% 完整保留底图'],
  lightX: [
    "左右",
    -300,
    300,
    1,
    "%",
    "左",
    "右",
    (v) => v * 50,
    (v) => v / 50,
    "相对画布高度；画布中心为 0",
  ],
  lightY: [
    "上下",
    -300,
    300,
    1,
    "%",
    "下",
    "上",
    (v) => v * 50,
    (v) => v / 50,
    "相对画布高度；画布中心为 0",
  ],
  lightZ: [
    "前后",
    -200,
    400,
    1,
    "%",
    "背后",
    "面前",
    (v) => v * 50,
    (v) => v / 50,
    "画面为 0；100% 等于一个画布高度。近灯方向变化更明显",
  ],
  ambient: [
    "暗部提亮",
    0,
    70,
    1,
    "%",
    "深",
    "浅",
    (v) => v * 100,
    (v) => v / 100,
    "增加环境补光，亮面亮度保持不变",
  ],
  toony: [
    "边缘硬度",
    0,
    100,
    1,
    "%",
    "柔",
    "硬",
    (v) => (v / 0.99) * 100,
    (v) => v * 0.0099,
    "控制明暗分界的过渡宽度",
  ],
  shift: [
    "亮部范围",
    0,
    100,
    1,
    "%",
    "少",
    "多",
    (v) => ((v + 0.9) / 1.8) * 100,
    (v) => v * 0.018 - 0.9,
    "移动明暗分界，扩大或缩小受光区域",
  ],
  depthScale: [
    "厚度",
    0,
    75,
    1,
    "%",
    "平",
    "厚",
    (v) => v * 50,
    (v) => v / 50,
    "深度全黑到全白的距离，相对画布高度",
  ],
  shadowStrength: [
    "浓度",
    0,
    100,
    1,
    "%",
    "淡",
    "浓",
    (v) => v * 100,
    (v) => v / 100,
    "部件互相遮挡时的投影浓度",
  ],
  shadowSoftness: [
    "柔边",
    0,
    100,
    1,
    "%",
    "锐",
    "柔",
    (v) => ((v - 1) / 7) * 100,
    (v) => 1 + v * 0.07,
    "阴影贴图的滤波半径",
  ],
  normalStrength: [
    "立体感",
    0,
    200,
    1,
    "%",
    "平",
    "强",
    (v) => v * 100,
    (v) => v / 100,
    "法线横向倾斜的强度；100% 为原始法线",
  ],
};
function slider(key) {
  const [label, min, max, step, unit, left, right, , , title] = sliders[key];
  return `<div class="slider" title="${title}"><div class="slider-head"><label for="${key}">${label}</label><label class="slider-number"><input type="number" id="number-${key}" data-number="${key}" min="${min}" max="${max}" step="${step}" aria-label="${label}数值"><span>${unit}</span></label></div><div class="range-wrap"><input id="${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}">${min < 0 ? `<i class="zero-mark" style="--zero:${(-min / (max - min)) * 100}%" title="${key === "lightZ" ? "画面" : "中心"}"></i>` : ""}</div><div class="range-ends"><span>${left}</span>${key === "lightZ" ? "<span>0 = 画面</span>" : ""}<span>${right}</span></div></div>`;
}
$("#position-controls").innerHTML = ["lightX", "lightY", "lightZ"]
  .map(slider)
  .join("");
$("#main-controls").innerHTML = ["lightingMix", "ambient", "toony", "shift"]
  .map(slider)
  .join("");
$("#shadow-controls").innerHTML = ["shadowStrength", "shadowSoftness"]
  .map(slider)
  .join("");
$("#map-controls").innerHTML = ["normalStrength", "depthScale"]
  .map(slider)
  .join("");
$("#preset").innerHTML =
  Object.entries(presets)
    .map(([k, p]) => `<option value="${k}">${p.label}</option>`)
    .join("") + '<option value="custom" disabled>自定义</option>';
$("#preset").value = "rightSoft";
let stage;
try {
  stage = new LightingStage($("#stage"));
} catch (e) {
  $("#empty-state").textContent = "无法创建 WebGL2 预览：" + e.message;
  throw e;
}
$("#stage").addEventListener("studio-error", (e) => toast(e.detail));
function overlay() {
  const active =
    state.workspace === 'lighting' && state.lightingEnabled && state.tool === "light" && !!state.source?.normal && !state.busy;
  $("#light-overlay").hidden = !active;
  if (!active) return;
  const b = $("#stage").getBoundingClientRect();
  const [x, y] = stage.worldToScreen(
      state.settings.lightX,
      state.settings.lightY,
    ),
    [cx, cy] = stage.worldToScreen(0, 0);
  const px = Math.max(38, Math.min(b.width - 38, x)),
    py = Math.max(30, Math.min(b.height - 70, y));
  const outside = Math.abs(px - x) > 1 || Math.abs(py - y) > 1;
  const h = $("#light-handle");
  h.style.left = px + "px";
  h.style.top = py + "px";
  h.classList.toggle("behind", state.settings.lightZ < 0);
  h.dataset.outside = String(outside);
  h.classList.toggle("edge-right", px > b.width - 90);
  h.classList.toggle("edge-left", px < 90);
  $("#light-label").textContent =
    `${outside ? "画外 · " : ""}${state.settings.lightZ < 0 ? "后" : "前"} ${Math.round(Math.abs(state.settings.lightZ) * 50)}%`;
  const line = $("#light-line line"),
    origin = $("#light-line circle");
  for (const [k, v] of Object.entries({ x1: cx, y1: cy, x2: px, y2: py }))
    line.setAttribute(k, v);
  origin.setAttribute("cx", cx);
  origin.setAttribute("cy", cy);
}
stage.onRender = () => {
  overlay();
  physics?.overlay();
  $("#zoom").textContent = Math.round(stage.viewScale() * 100) + "%";
};
function sync() {
  for (const [k, spec] of Object.entries(sliders)) {
    const value = spec[7](state.settings[k]);
    $("#" + k).value = value;
    $("#number-" + k).value = Number(value.toFixed(1));
    $("#" + k).style.setProperty(
      "--fill",
      `${((value - spec[1]) / (spec[2] - spec[1])) * 100}%`,
    );
  }
  $("#shade").value = state.settings.shade;
  $("#lightColor").value = state.settings.lightColor;
  $("#background").value = state.settings.background;
  $("#normal-y").value = state.settings.normalY;
  $("#shadow").checked = state.settings.shadow;
  $('#show-shading').checked = state.view === 'shading';
  const lighting = state.workspace === 'lighting';
  const physical = state.workspace === 'physics';
  const hasNormal = !!state.source?.normal,
    hasDepth = !!state.source?.depth;
  $('#effect-lighting').checked = state.lightingEnabled;
  $('#effect-lighting').disabled = !hasNormal || state.busy || state.layerBusy;
  $("#lighting-controls").disabled = !hasNormal || !state.lightingEnabled || state.busy;
  const project = state.source?.project || state.waitingProject;
  $("#lighting-status").hidden = hasNormal && !project?.previewDraft;
  $("#lighting-status").textContent = hasNormal && project?.previewDraft
    ? project.previewReview === 'awaiting-publication' ? '交付待恢复' : "待视觉复核"
    : project
    ? project.mapsStale ? "贴图源已变化，请续跑生成" : project.files?.normal.available
      ? "图层已更改，光照已暂停"
      : "法线待管线生成"
    : "绑定法线后启用光照";
  $("#lighting-status").title = project?.previewDraft ? project.previewReviewReason : '';
  $("#depth-status-hint").textContent = project
    ? project.files?.depth.available
      ? "图层已更改，投影已暂停"
      : "深度待管线生成"
    : "绑定深度后启用投影";
  $("#shadow").disabled = !hasDepth;
  $("#shadow-controls").disabled = !hasDepth || !state.settings.shadow;
  $("#depthScale").disabled = $("#number-depthScale").disabled =
    !hasDepth || state.busy;
  $("#depth-status-hint").hidden = hasDepth;
  for (const k of ["normalStrength", "number-normalStrength", "normal-y"])
    $("#" + k).disabled = !hasNormal || state.busy;
  $('[data-tool="light"]').disabled = !hasNormal || !state.lightingEnabled || state.busy;
  $('[data-tool="light"]').hidden = !lighting;
  $('#views').hidden = false;
  $('#show-shading').disabled = !hasNormal || !state.lightingEnabled || state.busy;
  $('#projection-workspace').hidden = state.workspace !== 'mask';
  $('#lighting-workspace').hidden = !lighting;
  $('#physics-workspace').hidden = !physical;
  $('#nine-axis-workspace').hidden = state.workspace !== 'nine-axis';
  nineAxis?.activate(state.workspace === 'nine-axis');
  $('[data-tool="disturb"]').hidden = !physical;
  $('[data-tool="disturb"]').disabled = !physics?.enabled || state.busy;
  $('#engine').textContent = [state.lightingEnabled && hasNormal ? '光照' : '', physics?.enabled ? '物理' : '', '原尺寸'].filter(Boolean).join(' · ');
  $('#physics-case-playback').hidden = !state.source?.physicsCase;
  for (const button of document.querySelectorAll('[data-workspace]')) {
    const selected = button.dataset.workspace === state.workspace;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected);
    button.disabled = state.busy || state.layerBusy;
  }
  projections?.render();
  $("#zoom").textContent = Math.round(stage.viewScale() * 100) + "%";
  for (const el of document.querySelectorAll("[data-view]")) {
    const view = el.dataset.view;
    el.disabled =
      !state.source ||
      (view === "normal" && !hasNormal) ||
      (view === "depth" && !hasDepth) ||
      (["lit", "split", "shading"].includes(view) && !hasNormal);
    el.classList.toggle("active", view === state.view);
  }
  $("#actual").disabled = !state.source || state.busy || state.layerBusy;
  $("#refresh-project").disabled = $("#retry-project").disabled =
    state.busy || state.layerBusy;
  for (const el of document.querySelectorAll('#open-task, [data-open-task], #project-base-choose, #project-base-reset'))
    el.disabled = state.busy || state.layerBusy;
  $(".layer-panel").inert = state.projectOpening || state.surfaceActive && !physics?.ready;

  overlay();
  physics?.sync();
}
function apply(custom = false) {
  state.settings = validateSettings(state.settings);
  stage.apply(state.settings);
  if (custom) $("#preset").value = "custom";
  sync();
}
let frame = 0;
function schedule() {
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply(true);
    });
}
for (const el of document.querySelectorAll("[data-setting],[data-number]")) {
  const key = el.dataset.setting || el.dataset.number,
    spec = sliders[key];
  el.addEventListener(el.dataset.number ? "change" : "input", () => {
    if (el.value === "" || !Number.isFinite(el.valueAsNumber)) {
      sync();
      return;
    }
    state.settings[key] = spec[8](
      Math.max(spec[1], Math.min(spec[2], el.valueAsNumber)),
    );
    schedule();
  });
}
for (const k of ["shade", "background", "lightColor"])
  $("#" + k).oninput = (e) => {
    state.settings[k] = e.target.value;
    schedule();
  };
$("#normal-y").onchange = (e) => {
  state.settings.normalY = Number(e.target.value);
  apply(true);
  if (surfaces.active) surfaces.schedule();
};
$("#shadow").onchange = (e) => {
  state.settings.shadow = e.target.checked;
  apply(true);
};
function initialPreset(source) {
  return source?.project?.previewMode === 'mixed' ? 'maskSoft' : 'rightSoft';
}
function applyPreset(key) {
  $("#preset").value = key;
  state.settings = { ...presets[key].values };
  apply();
}
$("#preset").onchange = (e) => {
  applyPreset(e.target.value);
};
$("#reset").onclick = () => {
  applyPreset(initialPreset(state.source));
};
const positions = {
  left: [-2.8, 0.5, 1],
  front: [0, 0.4, 3],
  right: [2.8, 0.5, 1],
  top: [0.4, 2.8, 0.8],
};
for (const el of document.querySelectorAll("[data-position]"))
  el.onclick = () => {
    [state.settings.lightX, state.settings.lightY, state.settings.lightZ] =
      positions[el.dataset.position];
    apply(true);
  };
function selectView(view) {
  state.view = view;
  stage.setMode(view);
  $("#split-line").hidden = view !== "split";
  sync();
}
$("#views").onclick = (e) => {
  const el = e.target.closest("[data-view]");
  if (el && !el.disabled) selectView(el.dataset.view);
};
$('#show-shading').onchange = e => selectView(e.target.checked ? 'shading' : 'lit');
function selectTool(tool) {
  if (tool === 'light' && (state.workspace !== 'lighting' || !state.lightingEnabled) || tool === 'disturb' && (state.workspace !== 'physics' || !physics?.enabled)) tool = 'move';
  pointer = null;
  if (physics) physics.pointer = null;
  state.tool = tool;
  for (const el of document.querySelectorAll("[data-tool]"))
    el.classList.toggle("active", el.dataset.tool === tool);
  $("#stage").classList.toggle("light", tool === "light");
  $("#stage").classList.toggle("disturb", tool === "disturb");
  overlay();
}
$("#interaction").onclick = (e) => {
  const el = e.target.closest("[data-tool]");
  if (el && !el.disabled) selectTool(el.dataset.tool);
};
let pointer;
function placeLight(e) {
  const b = $("#stage").getBoundingClientRect(),
    [x, y] = stage.screenToWorld(e.clientX - b.x, e.clientY - b.y);
  state.settings.lightX = Math.max(-6, Math.min(6, x));
  state.settings.lightY = Math.max(-6, Math.min(6, y));
  schedule();
}
for (const el of [$("#stage"), $("#light-handle")]) {
  el.onpointerdown = (e) => {
    if (state.busy || !state.source || e.button !== 0) return;
    if (state.tool === 'disturb') return;
    pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pan: [...stage.pan],
      tool: state.tool,
    };
    el.setPointerCapture(e.pointerId);
    // A click in light mode places the actual XY projection at the pointer.
    if (state.tool === "light") placeLight(e);
  };
  el.onpointermove = (e) => {
    if (state.tool === 'disturb') { physics?.input(e); return; }
    if (!pointer || pointer.id !== e.pointerId) return;
    if (pointer.tool === "light") placeLight(e);
    else {
      const b = $("#stage").getBoundingClientRect(),
        s = (stage.camera.top - stage.camera.bottom) / b.height;
      stage.pan = [
        pointer.pan[0] - (e.clientX - pointer.x) * s,
        pointer.pan[1] + (e.clientY - pointer.y) * s,
      ];
      stage.render();
    }
  };
  el.onpointerup =
    el.onpointercancel =
    el.onlostpointercapture =
      () => {
        pointer = null;
      };
}
$('#stage').addEventListener('pointerleave', () => { if (physics) { physics.pointer = null; physics.overlay(); } });
$("#light-handle").onkeydown = (e) => {
  const step = e.shiftKey ? 0.2 : 0.02,
    s = state.settings;
  if (e.key === "ArrowLeft") s.lightX -= step;
  else if (e.key === "ArrowRight") s.lightX += step;
  else if (e.key === "ArrowUp") s.lightY += step;
  else if (e.key === "ArrowDown") s.lightY -= step;
  else if (e.key === "PageUp") s.lightZ += step;
  else if (e.key === "PageDown") s.lightZ -= step;
  else return;
  e.preventDefault();
  s.lightX = Math.max(-6, Math.min(6, s.lightX));
  s.lightY = Math.max(-6, Math.min(6, s.lightY));
  s.lightZ = Math.max(-4, Math.min(8, s.lightZ));
  apply(true);
};
$("#drop-zone").addEventListener(
  "wheel",
  (e) => {
    if (!state.source || state.busy) return;
    e.preventDefault();
    if (state.tool === "light" && e.altKey) {
      state.settings.lightZ = Math.max(
        -4,
        Math.min(8, state.settings.lightZ - e.deltaY * 0.005),
      );
      schedule();
    } else {
      stage.zoom = Math.max(
        0.25,
        Math.min(40, stage.zoom * Math.exp(-e.deltaY * 0.001)),
      );
      stage.render();
      sync();
    }
  },
  { passive: false },
);
$("#fit").onclick = () => {
  stage.zoom = 1;
  stage.pan = [0, 0];
  stage.render();
  sync();
};
$("#actual").onclick = () => {
  if (stage.source) {
    stage.actualSize();
    sync();
  }
};
const layers = new LayerPanel({
  error: toast,
  rendered() {
    projections?.render();
    if (physics?.ready) {
      if (state.workspace === 'physics' && layers.selected !== physics.selected && physics.bindings.has(layers.selected)) physics.select(layers.selected);
    }
  },
  busy(value) {
    state.layerBusy = value;
    sync();
  },
  changed(owner, rows) {
    if (state.source?.layerDocument !== owner.layerDocument) return;
    state.source.layers = rows;
    state.source.nativeBaseline ??= rows.map(l => ({ ...l }));
    showSource();
  },
  async composite(owner, data, color) {
    if (state.source?.layerDocument !== owner.layerDocument) return;
    const previousPhysics = physics?.ready ? { draft: physics.recipe(), enabled: physics.enabled, selected: physics.selected, paused: physics.paused, internal: true } : null;
    surfaces.clear();
    const source = state.source;
    const key = data.baseline ? "baseline" : stateKey(data.layers);
    const maps = source.mapBindings.get(key) || (projectionOnlyEdit(source.shadowBindings, source.nativeBaseline, data.layers)
      ? source.mapBindings.get('baseline') : null) || {};
    const id = begin("正在更新预览…");
    try {
      await install(
        {
          ...source,
          layers: data.layers,
          layerKey: key,
          color: data.baseline ? source.originalColor : color,
          normal: maps.normal || null,
          depth: maps.depth || null,
        },
        id,
        false,
      );
      if (!maps.normal) selectTool("move");
    } finally {
      finish(id);
    }
    if (previousPhysics && id === state.generation) await physics.prepare(previousPhysics);
  },
});
projections = new ProjectionPanel(layers, () => state.source);
const surfaces = new SurfacePreview({stage, source:()=>state.source, session:()=>layers.session?{session:layers.session,revision:layers.revision}:null, error:toast,
  changed(active){state.surfaceActive=active;if(!active)physics?.clear();sync();}});
physics = new PhysicsPanel({stage, surfaces, source:()=>state.source, fingerprint:()=>state.source?.authorHash,
  workspace:()=>state.workspace, tool:()=>state.tool, busy:()=>state.busy||state.layerBusy, error:toast,
  changed(){layers.render();if(!physics.enabled&&state.tool==='disturb')selectTool('move');sync();}, selectLayer(id){if(layers.selected!==id){layers.selected=id;layers.render();}}});
nineAxis = new HeadNineAxisPanel({ error: toast });
$('#effect-lighting').onchange = e => {
  state.lightingEnabled = e.target.checked;
  if (!state.lightingEnabled) { if (state.tool === 'light') selectTool('move'); if (state.view === 'shading') selectView('lit'); }
  stage.setLightingEnabled(state.lightingEnabled); sync();
};
$('#effect-physics').onchange = e => void physics.setEnabled(e.target.checked);
function showSource() {
  const source = state.source;
  $("#document-info").hidden = !source;
  $("#empty-state").hidden = !!source || !!state.waitingProject;
  $("#project-empty").hidden = !!source || !state.waitingProject;
  $("#project-empty-name").textContent = state.waitingProject?.name || "";
  if (source) {
    $("#document-name").textContent = source.project?.displayName || source.project?.name || source.name;
    $("#document-meta").textContent =
      `${stage.source.w} × ${stage.source.h}${source.layers?.length ? " · " + source.layers.filter((l) => !l.mask).length + " 层" : ""}`;
  }
  $("#quality").textContent = source
    ? `${stage.source.w} × ${stage.source.h} px`
    : "未打开文件";
  $("#refresh-project").hidden = !source?.project;
  $("#refresh-project").disabled = state.busy || state.layerBusy;
  for (const k of ["normal", "depth"]) {
    $("#" + k + "-status").textContent = source?.[k]
      ? source.project
        ? source.project.kind === 'example' ? "项目贴图 · 已绑定" : "管线产物 · 已绑定"
        : source[k].name || "已绑定"
      : source?.project
        ? source.project.files[k].available
          ? "图层已更改 · 已暂停"
          : "待管线生成"
        : state.waitingProject
          ? "待管线生成"
          : "未绑定";
  }
  $("#map-validity").hidden =
    !source || source.layerKey === "baseline" || !!source.normal;
  $("#map-validity").textContent = source?.project
    ? source.project.files?.normal.available ||
      source.project.files?.depth.available
      ? "图层已更改；还原后恢复管线贴图"
      : "图层已更改；贴图待管线生成"
    : "图层已更改，请为当前合成图更新贴图";
  sync();
}
function begin(message, projectOpening = false) {
  state.busy = true;
  state.projectOpening = projectOpening;
  const id = ++state.generation;
  $("#loading").hidden = false;
  $("#loading").textContent = message;
  sync();
  return id;
}
function finish(id) {
  if (id !== state.generation) return;
  state.busy = false;
  state.projectOpening = false;
  $("#loading").hidden = true;
  sync();
}
async function install(source, id, reset = true) {
  // Rebinding invalidates preparations that have not reached active preview yet.
  surfaces.clear();
  if (!source.project) void nineAxis.load(null);
  const urls = {};
  try {
    for (const k of ["color", "normal", "depth"])
      if (source[k]) urls[k] = URL.createObjectURL(source[k]);
    const [entries, authorHash] = await Promise.all([
      Promise.all(
        Object.entries(urls).map(async ([k, url]) => [k, await loadImage(url)]),
      ),
      source.authorHash || hash(source.file || source.originalColor || source.color),
    ]);
    if (id !== state.generation) return;
    const priorZoom = stage.zoom,
      priorPan = [...stage.pan];
    // Stage validates dimensions before replacing GPU resources. Failed bindings
    // leave the active document and its existing maps intact.
    await stage.load(Object.fromEntries(entries));
    if (!reset) {
      stage.zoom = priorZoom;
      stage.pan = priorPan;
    }
    if (reset) {
      surfaces.clear();
      state.waitingProject = null;
      source.layerDocument = Symbol("document");
      source.layerKey = "baseline";
      source.originalColor = source.color;
      source.savedLayers = source.layers;
      source.mapBindings = new Map([
        ["baseline", { normal: source.normal, depth: source.depth }],
      ]);
      state.lightingEnabled = source.project?.previewMode !== 'mask';
    }
    state.source = source;
    source.authorHash = authorHash;
    // Generated maps are data only. First lighting entry always uses an active
    // studio preset; later layer/workspace updates preserve the user's settings.
    if (reset || (source.normal && !source.lightingInitialized)) {
      const key = initialPreset(source);
      state.settings = { ...presets[key].values };
      $("#preset").value = key;
      source.lightingInitialized = !!source.normal;
    }
    if (reset) selectTool("move");
    apply();
    stage.setLightingEnabled(state.lightingEnabled);
    selectView(
      source.normal
        ? reset || state.view === "color"
          ? "lit"
          : state.view === "depth" && !source.depth
            ? "lit"
            : state.view
        : "color",
    );
    showSource();
    if (source.project) projectURL(source.project);
    else {
      const u = new URL(location.href);
      for (const key of ['name', 'sample', 'project', 'folder', 'preview', 'physicsCase']) u.searchParams.delete(key);
      if (source.sample) u.searchParams.set("name", source.sample);
      history.replaceState(null, "", u);
    }
    if (reset) void layers.open(source);
  } finally {
    Object.values(urls).forEach(URL.revokeObjectURL);
  }
}
$("#close-document").onclick = () => {
  surfaces.clear();
  layers.clear();
  state.generation++;
  state.busy = false;
  state.projectOpening = false;
  state.source = null;
  state.waitingProject = null;
  $("#loading").hidden = true;
  stage.clear();
  selectTool("move");
  selectView("color");
  showSource();
  const u = new URL(location.href);
  u.searchParams.delete("name");
  u.searchParams.delete("sample");
  u.searchParams.delete("project");
  u.searchParams.delete("folder");
  u.searchParams.delete('preview');
  u.searchParams.delete('physicsCase');
  history.replaceState(null, "", u);
};
// Files are not opened by dropping; keep a stray drop from navigating away from the editor.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
async function openJianma() {
  layers.clear();
  const id = begin("正在打开 Jianma…");
  try {
    const [kra, normal, depth] = await Promise.all([
      blob("./studio-document?id=jianma"),
      blob("./studio-asset?sample=jianma&kind=normal"),
      blob("./studio-asset?sample=jianma&kind=depth"),
    ]);
    if (id !== state.generation) return;
    const source = await openDocument(new File([kra], "jianma-assembled.kra"));
    await install({ ...source, normal, depth, sample: "jianma" }, id);
  } catch (e) {
    if (id === state.generation) toast(e.message);
  } finally {
    finish(id);
  }
}
let projectListGeneration = 0;
// A project is a whole task folder: one listed from the run directory, or one imported
// from elsewhere on the server. Edits stay in this page; nothing is written back.
async function openProject(folder, preview, workspace, refresh = false) {
  const id = begin("正在打开项目…", true);
  try {
    const nineStage = new URLSearchParams(location.search).get('nineStage');
    const nineSelection = nineStage ? { nineStage } : {};
    let project = await get(
      "./api/studio/project?" + new URLSearchParams({ folder, ...nineSelection, ...(preview ? { preview } : {}) }),
    );
    // Load the complete available document once. Shadow visibility is edited
    // in its native graph, never by reopening another base from a selector.
    if (project.previewMode === 'normal-depth' && project.previewModes.mask) {
      project = await get('./api/studio/project?' + new URLSearchParams({ folder, ...nineSelection, preview: project.previewModes.mixed ? 'mixed' : 'mask' }));
    }
    if (id !== state.generation) return;
    void nineAxis.load(project);
    if (!project.files.document.available) {
      if (!state.source) {
        state.waitingProject = { name: project.displayName || project.name, folder: project.folder };
        showSource();
        projectURL(project);
        $("#task-dialog").close();
      }
      throw Error(project.name + "：角色组装结果尚未生成");
    }
    const read = (kind) => {
      const file = project.files[kind];
      return file.available
        ? blob("./studio-artifact?" + new URLSearchParams({ folder: project.folder, path: file.path, version: file.version }))
        : null;
    };
    const sameDocument = !refresh && state.source?.project?.folder === project.folder &&
      state.source.project.files.document.path === project.files.document.path &&
      state.source.project.files.document.version === project.files.document.version;
    const [document, normal, depth, bindings] = await Promise.all([
      read("document"),
      read("normal"),
      read("depth"),
      read('bindings'),
    ]);
    if (id !== state.generation) return;
    const source = sameDocument && preview ? { ...state.source } : await openDocument(
      new File([document], project.files.document.path.split("/").at(-1)));
    if (id !== state.generation) return;
    const shadowBindings = bindings ? JSON.parse(await bindings.text()) : null;
    if (shadowBindings && (shadowBindings.version !== 2 || !Array.isArray(shadowBindings.shadows))) throw Error('投影关系产物无效');
    state.workspace = workspace || (project.previewMode === 'mask' ? 'mask' : 'lighting');
    const preserve = sameDocument && !!preview;
    const maps = { normal, depth };
    if (preserve) {
      source.mapBindings.set('baseline', { ...maps });
      if (source.layerKey !== 'baseline' && !projectionOnlyEdit(shadowBindings, source.nativeBaseline, source.layers)) {
        maps.normal = null; maps.depth = null;
      }
    }
    await install({ ...source, ...maps, shadowBindings, project }, id, !preserve);
    if (id === state.generation) $("#task-dialog").close();
  } catch (e) {
    if (id === state.generation) {
      $("#project-status").textContent = e.message;
      toast(e.message);
    }
  } finally {
    finish(id);
  }
}
// A project from the run directory is addressed by name; an imported one by its folder.
function projectURL(project) {
  const u = new URL(location.href);
  for (const key of ['name', 'sample', 'project', 'folder', 'preview', 'physicsCase']) u.searchParams.delete(key);
  if (project.inDirectory) u.searchParams.set('project', project.name);
  else u.searchParams.set('folder', project.folder);
  if (project.previewMode) u.searchParams.set('preview', project.previewMode);
  history.replaceState(null, '', u);
}
// The base folder the project list reads lives in this browser only; without one, or once
// it no longer exists on the server, the list follows the run directory from settings.
const projectBaseKey = 'astra-studio-project-base';
function projectBase() { try { return localStorage.getItem(projectBaseKey) || ''; } catch { return ''; } }
function setProjectBase(folder) {
  try { if (folder) localStorage.setItem(projectBaseKey, folder); else localStorage.removeItem(projectBaseKey); } catch {}
}
async function chooseProjectBase() {
  if (state.busy || state.layerBusy) return;
  const folder = await pickServerPath({ get, esc, icon: (name) => name === 'folder' ? '▸' : name === 'close' ? '×' : '·', kind: 'dir',
    path: $('#project-directory').textContent, title: '选择基准文件夹', note: '列出该文件夹下的任务（含 run.json），进入后点「选择此目录」。' });
  if (!folder) return;
  setProjectBase(folder);
  void chooseProject();
}
async function chooseProject() {
  const generation = ++projectListGeneration;
  if (!$("#task-dialog").open) $("#task-dialog").showModal();
  $("#project-list").replaceChildren();
  $("#project-status").textContent = "正在读取项目…";
  const addProject = (label, open, rename) => {
    const button = document.createElement('button');
    button.className = 'project-item';
    button.textContent = label;
    button.onclick = open;
    if (rename) {
      const row = document.createElement('div'); row.className = 'project-item-row';
      const edit = document.createElement('button'); edit.className = 'project-name-edit'; edit.textContent = '✎';
      edit.title = '修改显示名称'; edit.setAttribute('aria-label', `修改 ${label} 的显示名称`);
      edit.onclick = rename;
      row.append(button, edit); $('#project-list').append(row);
    } else $('#project-list').append(button);
    return button;
  };
  for (const [name, project] of Object.entries(physicsProjects))
    addProject(project.label, () => void openExampleProject(project.caseId)).dataset.project = name;
  try {
    let base = projectBase(), response = await fetch('./api/studio/projects?' + new URLSearchParams(base ? { dir: base } : {}));
    let data = await response.json();
    if (response.status === 404 && data.missing && base) {
      // The stored base is gone: forget it and fall back to the run directory.
      setProjectBase(''); base = '';
      toast(data.error + '，已恢复默认基准文件夹');
      response = await fetch('./api/studio/projects'); data = await response.json();
    }
    if (generation !== projectListGeneration) return;
    if (!response.ok) throw Error(data.error || response.statusText);
    const isDefault = data.directory === data.default;
    $("#project-directory").textContent = data.directory;
    $("#project-base-reset").hidden = !base;
    $("#project-status").textContent = data.projects.length ? "选择项目，加载图层和贴图" : "该文件夹中还没有任务";
    for (const project of data.projects) {
      const label = project.displayName || project.name;
      // Display names are kept with the run directory's tasks only.
      addProject(label, () => void openProject(project.folder),
        isDefault ? () => editProjectName(project.name, label, data.directory) : undefined).dataset.project = project.name;
    }
  } catch (e) {
    if (generation === projectListGeneration)
      $("#project-status").textContent = e.message;
  }
}
let projectNameSelection;
function editProjectName(name, label, dir) {
  projectNameSelection = { name, dir };
  $('#project-display-name').value = label;
  $('#project-name-error').textContent = '';
  $('#project-name-dialog').showModal(); $('#project-display-name').focus();
}
$('#project-name-close').onclick = () => $('#project-name-dialog').close();
$('#project-name-form').onsubmit = async e => {
  e.preventDefault();
  const selection = projectNameSelection;
  $('#project-name-save').disabled = true;
  try {
    const response = await fetch('./api/project-name', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selection, displayName: $('#project-display-name').value }) });
    const result = await response.json(); if (!response.ok) throw Error(result.error || response.statusText);
    if (state.source?.project?.name === selection.name && state.source.project.dir === selection.dir) {
      state.source.project.displayName = result.displayName; showSource();
    }
    $('#project-name-dialog').close(); void chooseProject();
  } catch (error) { $('#project-name-error').textContent = error.message; }
  finally { $('#project-name-save').disabled = false; }
};
for (const el of document.querySelectorAll('#open-task, [data-open-task]')) el.onclick = chooseProject;
$('#project-base-choose').onclick = () => void chooseProjectBase();
$('#project-base-reset').onclick = () => { setProjectBase(''); void chooseProject(); };
$("#retry-project").onclick = () => {
  if (state.waitingProject && !state.busy)
    void openProject(state.waitingProject.folder);
};
$("#refresh-project").onclick = () => {
  if (state.source?.project && !state.busy && !state.layerBusy) {
    const { folder, previewMode } = state.source.project;
    void openProject(folder, previewMode, state.workspace, true);
  }
};
for (const button of document.querySelectorAll('[data-workspace]')) button.onclick = () => {
  const workspace = button.dataset.workspace;
  if (workspace === state.workspace || state.busy || state.layerBusy) return;
  selectTool('move');
  state.workspace = workspace;
  if (workspace !== 'lighting' && state.view === 'shading') selectView(state.source?.normal ? 'lit' : 'color');
  const u = new URL(location.href); u.searchParams.set('workspace', workspace); history.replaceState(null, '', u);
  sync();
};
async function openExampleProject(caseId, workspace = 'lighting') {
  if (state.busy || state.layerBusy) return;
  const id = begin('正在加载示例项目…', true);
  try {
    const source = await createPhysicsCase(caseId);
    if (id !== state.generation) return;
    state.workspace = workspace;
    await install(source, id);
    if (id !== state.generation) return;
    // Cases use the same active lighting preset and depth projection as a
    // character. The independent effect switches provide the albedo comparison.
    state.lightingEnabled = true;
    state.settings.shadow = true;
    apply(); stage.setLightingEnabled(true);
    $('#task-dialog').close(); sync();
  } catch (error) { if (id === state.generation) toast(error.message); }
  finally { finish(id); }
  if (id === state.generation && state.source?.physicsCase) {
    await physics.prepare(); physics.setDemo(true);
  }
}
sync();
// Projects load the complete document; workspaces only choose the editor.
const requested = new URLSearchParams(location.search);
const requestedWorkspace = ['mask','lighting','physics','nine-axis'].includes(requested.get('workspace')) ? requested.get('workspace') : undefined;
const requestedExample = physicsProjects[requested.get('project')] ?? (requested.get('physicsCase') ? physicsProjects[`example:cloth:${requested.get('physicsCase')}`] : undefined);
// A run-directory project is named; an imported one keeps its folder. With neither, the list opens.
async function openRequested() {
  const name = requested.get('project') || (requested.get('name') !== 'jianma' && requested.get('name'));
  const folder = requested.get('folder') || (name && (await get('./api/settings')).directory.replace(/[\\/]$/, '') + '/' + name);
  if (folder) return openProject(folder, requested.get('preview'), requestedWorkspace);
  void chooseProject();
}
if (requestedExample) void openExampleProject(requestedExample.caseId, requestedWorkspace);
else if (requested.get("name") === "jianma" || requested.get("sample") === "jianma") void openJianma();
else void openRequested().catch(error => toast(error.message));
window.addEventListener("pagehide", () => {
  surfaces.clear();
  layers.clear(true);
  cancelAnimationFrame(frame);
  stage.dispose();
});
window.studioDiagnostics = () => ({
  physics: physics.diagnostics(),
  nineAxis: nineAxis.diagnostics(),
  tool: state.tool,
  surface: surfaces.diagnostics(),
  renderer: rendererVersion,
  document: state.source?.name,
  sample: state.source?.sample,
  project: state.source?.project?.name,
  physicsCase: state.source?.physicsCase?.id,
  caseMarker: state.source?.physicsCase?.marker,
  workspace: state.workspace,
  previewMode: state.source?.project?.previewMode,
  previewDraft: !!state.source?.project?.previewDraft,
  projections: state.source?.shadowBindings?.shadows?.length || 0,
  layers: state.source?.layers?.length || 0,
  layerSession: layers.session,
  layerRevision: layers.revision,
  layerBusy: state.layerBusy || layers.pending,
  layerKey: state.source?.layerKey === "baseline" ? "baseline" : "edited",
  layerStates: layers.layers.map(
    ({
      id,
      name,
      type,
      parentId,
      visible,
      opacity,
      inheritAlpha,
      passThrough,
    }) => ({
      id,
      name,
      type,
      parentId,
      visible,
      opacity,
      inheritAlpha,
      passThrough,
    }),
  ),
  maps: { normal: !!state.source?.normal, depth: !!state.source?.depth },
  settings: { ...state.settings },
  lightingEnabled: state.lightingEnabled,
  view: state.view,
  tool: state.tool,
  busy: state.busy,
  source: stage.source
    ? { width: stage.source.w, height: stage.source.h }
    : null,
  textureSizes: stage.textures.map((t) => [t.image.width, t.image.height]),
  drawCalls: stage.renderer.info.render.calls,
  projectedLight: stage.source
    ? stage.worldToScreen(state.settings.lightX, state.settings.lightY)
    : null,
});
