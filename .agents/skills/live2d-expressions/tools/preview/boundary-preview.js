(function (host) {
'use strict';
const $ = id => document.getElementById(id);
let runtime = null, rigData = null, svgRoot = null, sourceText = null, originalViewBox = null;
let pending = {}, frame = 0, loadToken = 0;
let selectedSvg = null, selectedRig = null;
const controls = new Map();
const format = value => Number(value.toFixed(4)).toString();
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function cancelPending() { if (frame) cancelAnimationFrame(frame); frame = 0; pending = {}; }
function reflect() {
  if (!runtime) return;
  for (const [id, ui] of controls) { ui.input.value = String(runtime.values[id]); ui.output.value = format(runtime.values[id]); }
}
function setParameters(values) {
  if (!runtime) throw Error('请先载入 SVG 和控制 JSON。');
  cancelPending();
  const result = runtime.setParameters(values); reflect(); return result;
}
function queueParameter(id, value) {
  pending[id] = value;
  controls.get(id).output.value = format(value);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0; const values = pending; pending = {};
    try { runtime.setParameters(values); reflect(); } catch (error) { status(error.message, true); }
  });
}
function reset() {
  if (!runtime) throw Error('请先载入 SVG 和控制 JSON。');
  cancelPending(); const result = runtime.reset(); reflect(); status('已回到全部参数原值。'); return result;
}
function focus(mode = 'face') {
  if (!svgRoot) return;
  if (mode === 'full') {
    if (originalViewBox === null) svgRoot.removeAttribute('viewBox'); else svgRoot.setAttribute('viewBox', originalViewBox);
  } else {
    const [x, y, width, height] = rigData.focus;
    const pad = Math.max(width, height) * .07;
    svgRoot.setAttribute('viewBox', [x - pad, y - pad, width + pad * 2, height + pad * 2].join(' '));
  }
}
function buildControls() {
  $('parameters').replaceChildren(); controls.clear();
  for (const [id, parameter] of Object.entries(rigData.parameters)) {
    const row = document.createElement('div'); row.className = 'control';
    const head = document.createElement('div'); head.className = 'control-head';
    const label = document.createElement('label'); label.textContent = parameter.label;
    const output = document.createElement('output');
    const input = document.createElement('input'); input.type = 'range'; input.id = 'parameter-' + controls.size;
    input.min = String(parameter.min); input.max = String(parameter.max); input.step = String((parameter.max - parameter.min) / 400);
    input.value = String(parameter.default); input.dataset.parameter = id; input.setAttribute('aria-label', parameter.label);
    label.htmlFor = input.id; output.htmlFor = input.id;
    input.addEventListener('input', () => queueParameter(id, Number(input.value)));
    head.append(label, output);
    const name = document.createElement('div'); name.className = 'id'; name.textContent = id;
    const ticks = document.createElement('div'); ticks.className = 'ticks';
    for (const [title, value] of [['最小', parameter.min], ['原值', parameter.default], ['最大', parameter.max]]) {
      const button = document.createElement('button'); button.textContent = title + ' ' + format(value);
      button.addEventListener('click', () => { input.value = String(value); queueParameter(id, value); }); ticks.append(button);
    }
    row.append(head, name, input, ticks); $('parameters').append(row); controls.set(id, { input, output });
  }
  reflect();
}
async function load(svgText, rig) {
  const token = ++loadToken;
  if (typeof svgText !== 'string') throw Error('SVG 输入必须是原文件文本。');
  const parsed = typeof rig === 'string' ? JSON.parse(rig) : rig;
  AstraBoundaryRig.validate(parsed);
  if (!Array.isArray(parsed.focus) || parsed.focus.length !== 4 || !parsed.focus.every(Number.isFinite) || parsed.focus[2] <= 0 || parsed.focus[3] <= 0) throw Error('控制 JSON 缺少有效面部定位范围。');
  if (!crypto.subtle) throw Error('当前浏览器无法校验 SVG 来源，请使用支持 Web Crypto 的浏览器。');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(svgText))), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== parsed.source.svg_sha256) throw Error('SVG 与控制 JSON 的来源哈希不一致。请选择编译时使用的原 SVG。');
  const documentSvg = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const candidate = documentSvg.documentElement;
  if (documentSvg.querySelector('parsererror') || candidate.localName !== 'svg') throw Error('无法解析 SVG 文件。');
  if (documentSvg.querySelector('script,foreignObject') || [...documentSvg.querySelectorAll('*')].some(node => [...node.attributes].some(attribute => /^on/i.test(attribute.name)))) throw Error('预览输入不能包含脚本或事件处理属性。');
  if (token !== loadToken) return null;
  cancelPending(); if (runtime) runtime.dispose(); runtime = null;
  const imported = document.importNode(candidate, true); $('canvas').replaceChildren(imported);
  try { runtime = new AstraBoundaryRig.Runtime(imported, parsed); }
  catch (error) { svgRoot = null; rigData = null; sourceText = null; $('canvas').replaceChildren(); controls.clear(); $('parameters').replaceChildren(); for (const id of ['reset', 'face', 'full']) $(id).disabled = true; throw error; }
  svgRoot = imported; sourceText = svgText; rigData = parsed; originalViewBox = imported.getAttribute('viewBox');
  buildControls(); focus('face');
  for (const id of ['reset', 'face', 'full']) $(id).disabled = false;
  status('已载入 ' + parsed.character_id + '，共 ' + controls.size + ' 个连续参数。');
  return snapshot();
}
function snapshot() {
  if (!runtime) return null;
  return { character_id: rigData.character_id, parameters: { ...runtime.values }, source_sha256: rigData.source.svg_sha256,
    statistics: { ...runtime.stats }, original_svg_bytes: new TextEncoder().encode(sourceText).length };
}
async function loadSelected() {
  if (selectedSvg === null || selectedRig === null) { status(selectedSvg === null ? '已选择控制 JSON，等待原 SVG。' : '已选择原 SVG，等待控制 JSON。'); return; }
  status('正在核对来源并载入参数…');
  try { await load(selectedSvg, selectedRig); } catch (error) { status(error.message, true); }
}
$('svgFile').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { selectedSvg = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await file.arrayBuffer()); await loadSelected(); } catch (error) { status(error.message, true); }
});
$('rigFile').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { selectedRig = await file.text(); await loadSelected(); } catch (error) { status(error.message, true); }
});
$('reset').addEventListener('click', reset);
$('face').addEventListener('click', () => focus('face'));
$('full').addEventListener('click', () => focus('full'));
host.addEventListener('pagehide', () => { cancelPending(); if (runtime) runtime.dispose(); });
host.boundaryPreview = { load, setParameters, reset, snapshot, focus };
})(window);
