import { processFileList } from '../process-files.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { displayStatus, sectionSteps, previousNineAxisSectionSteps, shadowInspectionArtifacts, statusLabel, stepArtifacts } from '../progress.js';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function overviewCard('), source.indexOf('function graph('));
const visibleStage = source.match(/^const visibleStage=.*$/m)![0];
const lanes = source.match(/^const flowLanes = .*$/m)![0];
const observed = source.slice(source.indexOf('function observedDisplayStatus('), source.indexOf('function rasterItems('));
function render(statuses: string[], files: string[] = [], running = false, locked = false, archive?: { sections: Record<string, unknown> }, sections?: unknown[], kritaInUse?: number) {
  const templates = structuredClone(sectionSteps);
  if ((sections?.[6] as any)?.layout === 'nested') templates[6] = structuredClone(previousNineAxisSectionSteps);
  for (const [i, steps] of templates.entries()) for (const step of steps) step.status = (sections?.[i] as any)?.states?.[step.id] ?? 'pending';
  return runInNewContext(lanes + '\n' + visibleStage + '\n' + observed + renderer + '\nprojectPage();', {
    stages: statuses.map((status, i) => ({ name: '管线 ' + i, id: i === 6 ? 'nine-axis' : 'section-' + i, status })),
    state: { name: 'case', stage: 0 }, data: { files, runnerAlive: running, lockHeld: locked, ...(sections ? { sections } : {}), kritaInUse, ...(archive ? { archived: true, run: archive } : {}) },
    stepArtifacts: {}, available: () => [], pageHeading: () => '', runNotice: () => '',
    esc: String, icon: () => '', displayStatus, statusLabel,
    sectionSteps: templates, finished: (step: { status: string }) => ['done', 'skipped'].includes(step.status),
    statusMark: (status: string) => `<i data-status="${status}"></i>`,
  }) as string;
}

test('九轴总览只展示七步进度，缩略头保留在流程预览页', () => {
  const states = Object.fromEntries(sectionSteps[6].map(step => [step.id, 'done']));
  const html = render(Array(7).fill('done'), [], false, false, undefined, Array(6).fill({}).concat({ states }));
  const card = html.match(/data-overview="6"[\s\S]*?<\/article>/)![0];
  assert.match(card, /已完成 7 \/ 7 步/);
  assert.deepEqual([...card.matchAll(/data-nine-step="([^"]+)"/g)].map(match => match[1]), sectionSteps[6].map(step => step.id));
  assert.doesNotMatch(card, /data-head-preview|<canvas|头部九轴最新画面/);
  const preview = source.slice(source.indexOf('function flowCard('), source.indexOf('function inspector('));
  assert.match(preview, /stage\.id==='nine-axis'\?headThumbnail\(\)/);
});

test('step04 并发分支仍计为一步，进度跟随父步骤状态', () => {
  const states: Record<string, string> = Object.fromEntries(sectionSteps[6].map((step, index) => [step.id, index < 3 ? 'done' : index === 3 ? 'running' : 'pending']));
  Object.assign(states, { 'step04_angles/model': 'running', 'step04_angles/model/left': 'done', 'step04_angles/video': 'done' });
  let html = render(Array(7).fill('running'), [], true, true, undefined, Array(6).fill({}).concat({ states }));
  let card = html.match(/data-overview="6"[\s\S]*?<\/article>/)![0];
  assert.match(card, /已完成 3 \/ 7 步/);
  assert.match(card, /step04_angles · 单轴模型与斜角视频 · 进行中/);
  assert.equal((card.match(/data-nine-step=/g) ?? []).length, 7);
  states.step04_angles = 'done';
  html = render(Array(7).fill('running'), [], true, true, undefined, Array(6).fill({}).concat({ states }));
  card = html.match(/data-overview="6"[\s\S]*?<\/article>/)![0];
  assert.match(card, /已完成 4 \/ 7 步/);
});

test('旧任务的总览沿用其实际四步，不虚构七步完成记录', () => {
  const states = Object.fromEntries(previousNineAxisSectionSteps.map(step => [step.id, 'done']));
  const html = render(Array(7).fill('done'), [], false, false, undefined, Array(6).fill({}).concat({ layout: 'nested', states }));
  assert.match(html, /已完成 4 \/ 4 步/);
  assert.doesNotMatch(html, /data-nine-step="step07_jaw-line"/);
});

test('新旧九轴预览定位到真实步骤，并把唯一缩略头带入视野', () => {
  const defaults = source.slice(source.indexOf('function defaultStep('), source.indexOf('if (Number.isInteger(requestedStage)'));
  for (const steps of [sectionSteps[6], previousNineAxisSectionSteps]) {
    assert.equal(runInNewContext(defaults + '\ndefaultStep(6);', { sectionSteps: [...sectionSteps.slice(0, 6), steps] }), steps[0].id);
  }
  const focus = source.slice(source.indexOf('function focusPreviewStep('), source.indexOf('function updateViewURL('));
  const viewport = { scrollLeft: 0, scrollTop: 0, getBoundingClientRect: () => ({ left: 10 }) };
  const queries: string[] = [], state = { stage: 6, selectedStep: 'step01_preparation', canvasLeft: 0, canvasTop: 0 };
  runInNewContext(focus + '\nfocusPreviewStep();', { state, laneScrollTop: () => 0, document: {
    querySelector(selector: string) { queries.push(selector); return selector === '.flow-scroll' ? viewport : selector === '[data-head-preview]' ? { getBoundingClientRect: () => ({ left: 400 }) } : null; },
  } });
  assert.equal(viewport.scrollLeft, 378);
  assert.deepEqual(queries, ['.flow-scroll', '[data-head-preview]']);
});

test('执行面板逐管线展示真实状态，完成与失败不再显示为未运行', () => {
  const html = render(['done', 'running', 'available', 'pending', 'failed']);
  for (const [i, label] of ['已完成', '进行中', '已有产物', '待执行', '执行失败'].entries()) {
    const card = html.match(new RegExp(`data-overview="${i}"[\\s\\S]*?</article>`))![0];
    assert.ok(card.includes(label), card);
  }
  assert.doesNotMatch(html, /未运行/);
});

test('失败的管线卡片在概览上直接给出失败原因', () => {
  const html = render(['done', 'failed'], [], false, false, undefined, [{ status: 'done' }, { status: 'failed', summary: 'ENAMETOOLONG\nstack' }]);
  const card = (i: number) => html.match(new RegExp(`data-overview="${i}"[\\s\\S]*?</article>`))![0];
  assert.match(card(1), /class="overview-reason status-error"[^>]*>ENAMETOOLONG<\/p>/);
  assert.doesNotMatch(card(0), /overview-reason/);
});

test('section 占用或排队等 Krita 时，在原有执行状态旁加标识', () => {
  const running = { state: 'running', since: '2026-10-27T08:00:00.000Z', limit: 3, pid: 4242, version: '5.3.4', startedAt: '2026-10-27T08:00:00.000Z' };
  const reserved = { state: 'reserved', since: '2026-10-27T08:00:00.000Z', limit: 3 };
  const waiting = { state: 'waiting', since: '2026-10-27T08:00:00.000Z', limit: 3 };
  const html = render(['running', 'running', 'running', 'pending'], [], true, true, undefined,
    [{ krita: running }, { krita: reserved }, { krita: waiting }, { krita: null }], 3);
  const card = (i: number) => html.match(new RegExp(`data-overview="${i}"[\\s\\S]*?</article>`))![0];
  assert.match(card(0), /krita-badge running[^>]*pid 4242[^>]*本机 Krita 名额 3 \/ 3[^>]*>正在使用 Krita<small>3\/3<\/small>/);
  assert.match(card(1), /krita-badge reserved[^>]*尚未启动[^>]*>已占用 Krita 名额/);
  assert.match(card(2), /krita-badge waiting[^>]*已满[^>]*>Krita 排队中<small>3\/3<\/small>/);
  // The badge sits beside the section's own state, which stays as it is.
  for (const i of [0, 1, 2]) assert.ok(card(i).includes('进行中'));
  assert.doesNotMatch(card(3), /krita-badge/);
  assert.doesNotMatch(render(['running']), /krita-badge/);
});

test('归档任务只展示实际运行过的管线', () => {
  const html = render(['done', 'pending', 'done'], [], false, false, { sections: { 'section-0': {}, 'section-2': {} } });
  assert.deepEqual([...html.matchAll(/data-overview="(\d+)"/g)].map(match => match[1]), ['0', '2']);
});

test('停止后已有绘画仍是已有产物，不能误报完成或进行中', () => {
  const html = render(['interrupted', 'unconfirmed'], ['section-0/step01/draft.kra']);
  assert.match(html, /execution-state interrupted/);
  assert.match(html, /execution-state unconfirmed/);
  assert.doesNotMatch(html, /已完成|进行中/);
});

test('管线卡片只保留预览，运行统一由标题栏的继续 / 恢复 / 重试负责', () => {
  const html = render(['done', 'failed'], [], true, true);
  assert.doesNotMatch(html, /data-run-stage|运行 \/ 续跑/);
  assert.equal((html.match(/data-stage="\d+"/g) ?? []).length, 4, 'title and preview keep opening the detailed section');
});

test('人物和衣服跳过的 review/repair 共用紧凑节点，明确为无需执行', () => {
  const node = source.slice(source.indexOf('function stepNode('), source.indexOf('function processArtifacts('));
  for (const index of [1, 3]) {
    const html = runInNewContext(node + `\nstepNode(${index}, step, true);`, {
      step: { id: 'repair-02', title: '第 2 轮修复', status: 'skipped' },
      observedDisplayStatus: () => 'done', icon: () => '', esc: String,
    });
    assert.match(html, /skipped-node/); assert.match(html, /无需执行/);
    assert.doesNotMatch(html, /已完成|step-content/);
  }
});

test('共用过程文件组件识别阴影方式目录，排除已展示文件和另一种方式，空目录隐藏', () => {
  const component = source.slice(source.indexOf('function processArtifacts('), source.indexOf('function flowCard('));
  const mask = sectionSteps[5][0].children[0], maps = sectionSteps[5][0].children[1].children[0];
  const render = (section: string, step: object, files: string[], known: typeof stepArtifacts[number]) => runInNewContext(component + '\nprocessArtifacts(0, step);', {
    processFileList, stages: [{ id: section }], step, data: { files, sections: [{ reports: {} }] }, stepArtifacts: [known], shadowInspectionArtifacts,
    reportEvidence: () => '',
    esc: String, artifacts: (items: { path: string; label: string }[]) => JSON.stringify(items),
  }) as string;
  const files = ['shadow/step01_mask/character-shadowed.kra', 'shadow/step01_mask/inspection/relation-001-review.png',
    'shadow/step01_mask/workspace/inspection/native-case/clip-base.png', 'shadow/step01_normal-depth/workspace/draft.png',
    'shadow/agents/request/workspace/temporary.png'];
  const maskHtml = render('shadow', mask, files, stepArtifacts[5]);
  assert.match(maskHtml, /1 个过程文件/);
  assert.match(maskHtml, /inspection\/native-case\/clip-base\.png/);
  assert.doesNotMatch(maskHtml, /character-shadowed|relation-001-review|step01_normal-depth|\/agents\//);
  const mapsHtml = render('shadow', maps, files, stepArtifacts[5]);
  assert.match(mapsHtml, /1 个过程文件/); assert.match(mapsHtml, /step01_normal-depth\/workspace\/draft\.png/);
  assert.doesNotMatch(mapsHtml, /shadow\/step01_mask/);
  assert.equal(render('shadow', mask, files.slice(0, 2), stepArtifacts[5]), '');
  const raster = render('raster-layering', sectionSteps[1][0], ['raster-layering/step01/workspace/draft.png'], stepArtifacts[1]);
  assert.match(raster, /1 个过程文件/); assert.match(raster, /raster-layering\/step01\/workspace\/draft\.png/);
});
