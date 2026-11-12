// Display-only definitions, matched to the existing preparation, part and raster runners.
// Execution states are supplied by the read-only task snapshot; these are labels only.
import { groupStepId, layerStepId } from './step-paths.js';
import { aggregateStatus } from './execution-state.js';
export const groupPhases = [
  ['outline', '轮廓绘制'], ['review', '轮廓复核'], ['reduction', '同层去重'],
  ['completion', '遮挡补全'], ['completionCheck', '补全检查'], ['children', '直属结构拆分'],
];
// throttled: waiting to retry after a 429 or other temporary error; the agent keeps its slot and resumes on its own.
// A summary stays running or throttled while any part still is, and only then shows a failure.
export const statusNames = {pending:'待执行', running:'进行中', throttled:'限流等待', done:'已完成', failed:'执行失败', interrupted:'已中断'};
export const displayStatus = (status, hasArtifacts = false) => status === 'skipped' ? 'done'
  : status === 'unconfirmed' ? 'interrupted' : Object.hasOwn(statusNames, status) ? status : 'pending';
export const statusLabel = status => statusNames[displayStatus(status)];

export function groupSummary(group) {
  const values = groupPhases.map(([id]) => group.webPhases?.[id]);
  const status = aggregateStatus(values);
  return { status, text: statusNames[status] };
}

function latestSvgArtifacts(items, files, versions) {
  return items.filter(item => item.kind === 'image' && files.has(item.path))
    .sort((a, b) => Number(versions[b.path]?.split(':')[0] ?? 0) - Number(versions[a.path]?.split(':')[0] ?? 0)).slice(0, 1);
}
export function groupPreviewArtifacts(group, phaseFiles, files, versions = {}) {
  // A running phase can lag behind the saved artwork. Show the latest actual
  // drawing across all three stages, including drafts, regardless of status.
  return latestSvgArtifacts([...phaseFiles.completion, ...phaseFiles.reduction, ...phaseFiles.outline], files, versions);
}

// A stage panel shows its own latest drawing (draft or published); an earlier
// stage stands in only until the stage has drawn anything, however recently the
// earlier one was rewritten.
export function groupStagePreviewArtifacts(phase, phaseFiles, files, versions = {}) {
  const phases = phase === 'outline' ? ['outline'] : ['completion', 'reduction', 'outline'];
  for (const id of phases) {
    const latest = latestSvgArtifacts(phaseFiles[id], files, versions);
    if (latest.length) return latest;
  }
  return [];
}

const groupStepPath = (section, id, step) => `${section}/${groupStepId(id, step)}`;
const layerPath = (section, depth) => `${section}/${layerStepId(depth)}`;

export function groupReviewSteps(group, section, groupId) {
  return [1, 2].flatMap(number => ['review', 'repair'].map(mode => {
    const record = group.webReviewRounds?.[number - 1]?.[mode];
    const title = `第 ${number} 轮${mode === 'review' ? '轮廓复核' : '返修'}`;
    return { id: `${mode}-${number}`, title, status: record?.status || 'pending', detail: record?.detail || '',
      artifacts: record?.reportIndex === undefined ? [] : [{ path: `${groupStepPath(section, groupId, 'outline')}/review.json`,
        label: mode === 'review' ? `第 ${number} 轮反馈` : `第 ${number} 轮返修记录`, kind: 'file',
        reviewIndex: record.reportIndex, reviewMode: mode }] };
  }));
}

export function reviewReportText(text, item) {
  try {
    const review = JSON.parse(text).reviews?.[item.reviewIndex];
    if (!review) return '本轮记录尚未保存';
    if (item.reviewMode === 'repair') return `${review.repairedCandidateHash ? '已按本轮意见返修并自检' : '尚无本轮返修完成记录'}\n\n${review.feedback}`;
    const verdict = { pass: '通过', revise: '需要返修', blocked: '复核受阻' }[review.verdict] || review.verdict;
    return `结论：${verdict}\n\n${review.feedback}`;
  } catch { return text; }
}

export function latestKraPreview(previews = {}) {
  return Object.entries(previews).map(([stepId, preview]) => ({ ...preview, stepId }))
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt) || b.stepId.localeCompare(a.stepId))[0];
}

const step = (id, title, status, children = [], note = '') => ({ id, title, status, children, note });
const partSteps = clothing => [
  step('preparation', '准备参考', 'pending', clothing
    ? [step('clothing', '提取纯衣服参考', 'pending')]
    : [step('standard', '标准参考', 'pending'),
      step('simplified', '判断并简化角色', 'pending'), step('base', '生成素体参考', 'pending')]),
  step('initial', '首次分组', 'pending'),
  step('layers', '逐层拆分', 'pending', groupPhases.map(([id, title]) => step(id, title, 'pending')),
    '每层先完成轮廓和复核，再同层去重；补全、检查和直属结构拆分完成后进入下一层。终止 part 不再拆子组。'),
  step('merge', '合成分块预览', 'pending'),
  step('occlusion', '遮挡深度规划', 'pending'),
];

const rasterSteps = clothing => [
  step('step01', clothing ? '衣服分件、补全与拼装' : '分层、补全与 Krita 交付', 'pending', [
    step('draw', '分件绘制与对齐', 'pending'),
    step('review-01', '第 1 轮轮廓复核', 'pending'),
    step('repair-01', '第 1 轮修复', 'pending'),
    step('review-02', '第 2 轮轮廓复核', 'pending'),
    step('repair-02', '第 2 轮修复', 'pending'),
  ], '检查轮廓、明显画风差异与补绘衔接；最多两轮反馈，修复结束后 step01 完成。'),
  step('step02', clothing ? '衣服边缘与衔接精修' : '边缘柔化与去锯齿', 'pending', [],
    '沿用已确认结构，精修柔边、线条与细微接缝；完成自检后交付。'),
  ...(clothing ? [] : [step('step03', '去除连体服、补全身体底层', 'pending')]),
];

export const sectionSteps = [
  partSteps(false), rasterSteps(false), partSteps(true), rasterSteps(true),
  [step('step01', '人物与衣服 KRA 组装', 'pending', [],
    '同一 agent 调整穿戴关系、必要遮罩与局部笔触，重开验收并导出 KRA、合成 PNG 和报告。')],
  [{ ...step('step01', '阴影方式 · 二选一', 'pending', [
    { ...step('mask', 'Live2D 蒙版', 'pending'), processDirectory: 'shadow/step01_mask' },
    step('normal-depth', '法线＋深度', 'pending', [
      { ...step('normal-depth-maps', '生成与验收贴图', 'pending'), processDirectory: 'shadow/step01_normal-depth' },
    ])],
    '启动时选择其中一种方式执行；另一种方式的已有产物保留。'), childrenMode: 'alternative' }],
  [step('step01_preparation', '头部素材准备', 'pending', [], '脸、五官、脖子、头发、头饰及独立投影统一提取；保留原图层范围和来源关系。'),
    step('step02_video', '单轴视频生成', 'pending'),
    step('step03_frames', '单轴参考帧', 'pending'),
    { ...step('step04_angles', '单轴模型与斜角视频', 'pending', [
      { ...step('step04_angles/model', '单轴模型制作与合并', 'pending', ['left', 'up', 'down'].map(group =>
        step(`step04_angles/model/${group}`, { left: '左右转头', up: '抬头', down: '低头' }[group], 'pending'))), childrenMode: 'parallel' },
      step('step04_angles/video', '斜角视频生成', 'pending'),
    ], '模型制作与视频生成并发；各自保存进展和产物。'), childrenMode: 'parallel' },
    step('step05_frames', '斜角参考帧', 'pending', [], '使用上一步的视频。'),
    step('step06_angle-xy', '斜角模型', 'pending'),
    step('step07_jaw-line', '下颌与颈部衔接', 'pending')],
];

export const previousNineAxisSectionSteps = [step('step01_video', '三向视频与参考帧', 'pending'),
    { ...step('step02_angles', '独立单轴与合并', 'pending', ['left', 'up', 'down'].map(group =>
      step(`step02_angles/${group}`, { left: '左右转头', up: '抬头', down: '低头' }[group], 'pending')),
      '三个子项并发制作；全部完成后合并单轴结果。'), childrenMode: 'parallel' },
    step('step03_angle-xy', '斜向四角', 'pending', [], '等待三个单轴和父合并全部完成。'),
    step('step04_jaw-line', '下颌线与脖子', 'pending')];

export function groupLayers(groups) {
  const layers = [];
  function visit(nodes, depth) {
    for (const node of nodes) {
      (layers[depth] ??= []).push(node);
      visit(node.groups || [], depth + 1);
    }
  }
  visit(groups, 0);
  return layers;
}

// Known artifact contracts; the UI only displays files present in the selected task.
const image = (path, label) => ({ path, label, kind: 'image' });
const file = (path, label) => ({ path, label, kind: 'file' });
const video = (path, label) => ({ path, label, kind: 'video' });
const viewName = name => ({ left: '左右转头', up: '抬头', down: '低头', 'left-up': '左上', 'left-down': '左下' })[name] || name;
const rasterDelivery = (section, stepId, png, kra) => [
  image(`${section}/${stepId}/${png}`, '合成 PNG'),
  file(`${section}/${stepId}/${kra}`, '分层 KRA'),
  file(`${section}/${stepId}/report.md`, '绘制报告'),
];
export const stepArtifacts = [
  {
    preparation: [],
    standard: [image('part-layering/references/standard.png', '标准参考图')],
    simplified: [image('part-layering/references/simplified-subject.png', '简化角色')],
    base: [image('part-layering/references/base-subject.png', '素体参考')],
    initial: [file('part-layering/groups.json', '分组树')],
    merge: [image('part-layering/preview.draft.svg', '分块合成 · 中间产物'), image('part-layering/preview.svg', '分块合成 SVG')],
    occlusion: [image('part-layering/step14_occlusion/preview.svg', '遮挡深度预览'), file('part-layering/occlusion.json', '遮挡深度表')],
  },
  {
    step01: rasterDelivery('raster-layering', 'step01', 'composite.png', 'character-depth.kra'),
    step02: rasterDelivery('raster-layering', 'step02', 'character-soft-edges.png', 'character-soft-edges.kra'),
    step03: rasterDelivery('raster-layering', 'step03', 'character-dressup-base.png', 'character-dressup-base.kra'),
  },
  {
    clothing: [image('clothing-part-layering/references/clothing.png', '纯衣服参考')],
    initial: [file('clothing-part-layering/groups.json', '分组树')],
    merge: [image('clothing-part-layering/preview.draft.svg', '衣服分块 · 中间产物'), image('clothing-part-layering/preview.svg', '衣服分块 SVG')],
    occlusion: [image('clothing-part-layering/step14_occlusion/preview.svg', '遮挡深度预览'), file('clothing-part-layering/occlusion.json', '遮挡深度表')],
  },
  {
    step01: rasterDelivery('clothing-raster-layering', 'step01', 'composite.png', 'clothing-depth.kra'),
    step02: rasterDelivery('clothing-raster-layering', 'step02', 'composite.png', 'clothing-soft-edges.kra'),
  },
  {
    step01: [...rasterDelivery('character-assembly', 'step01', 'character-assembled.png', 'character-assembled.kra'),
      image('character-assembly/step01/final-overall-comparison.jpg', '最终参考对照')],
  },
];

stepArtifacts.push({
  step01: [file('shadow/selection.json', '当前预览方式')],
  mask: [image('shadow/step01_mask/character-shadowed.png', '投影阴影'), image('shadow/step01_mask/face-review.png', '头脸投影 · 原尺寸对照'), image('shadow/step01_mask/inspection/overview.png', '去影对照'), file('shadow/step01_mask/character-shadowed.kra', '阴影 KRA'), file('shadow/step01_mask/shadows.json', '跟随与裁切关系'), file('shadow/step01_mask/inspection.json', '裁切检查'), file('shadow/step01_mask/report.md', '绘制报告')],
  'normal-depth': [],
  'normal-depth-maps': [image('shadow/step01_normal-depth/normal.png', '法线'), image('shadow/step01_normal-depth/depth.png', '深度'), file('shadow/step01_normal-depth/report.md', '贴图报告')],
});
stepArtifacts.push({
  step01_video: [...['left', 'up', 'down'].flatMap(group => [image(`nine-axis/step01_video/${group}.png`, `${viewName(group)}参考帧`),
    video(`nine-axis/step01_video/${group}.mp4`, `${viewName(group)}视频`)]), file('nine-axis/step01_video/views.json', '三向取帧记录')],
  'step02_angles': [file('nine-axis/step02_angles/deformers.json', '合并单轴结果')],
  ...Object.fromEntries(['left', 'up', 'down'].map(group => [`step02_angles/${group}`, [file(`nine-axis/step02_angles/${group}/deformers.json`, `${viewName(group)}模型`)]])),
  'step03_angle-xy': [file('nine-axis/step03_angle-xy/deformers.json', '斜向九轴结果')],
  'step04_jaw-line': [file('nine-axis/step04_jaw-line/deformers.json', '下颌线结果')],
});
const nineFrameArtifacts = (stepId, names) => [...names.flatMap(name => [image(`nine-axis/${stepId}/${name}.png`, `${viewName(name)}参考帧`)]), file(`nine-axis/${stepId}/selected-frames.json`, '选帧记录')];
Object.assign(stepArtifacts[6], {
  step01_preparation: [image('nine-axis/step01_preparation/original-full-face.png', '固定面部素材'), file('nine-axis/step01_preparation/source.json', '工程来源'), file('nine-axis/step01_preparation/head_parts_manifest.json', '素材清单')],
  step02_video: ['left', 'up', 'down'].map(name => video(`nine-axis/step02_video/${name}.mp4`, `${viewName(name)}视频`)),
  step03_frames: nineFrameArtifacts('step03_frames', ['left', 'up', 'down']),
  step04_angles: [],
  'step04_angles/model': [file('nine-axis/step04_angles/model/deformers.json', '合并单轴模型')],
  ...Object.fromEntries(['left', 'up', 'down'].map(name => [`step04_angles/model/${name}`, [file(`nine-axis/step04_angles/model/${name}/deformers.json`, `${viewName(name)}模型`)]])),
  'step04_angles/video': ['left-up', 'left-down'].map(name => video(`nine-axis/step04_angles/video/${name}.mp4`, `${viewName(name)}视频`)),
  step05_frames: nineFrameArtifacts('step05_frames', ['left-up', 'left-down']),
  'step06_angle-xy': [file('nine-axis/step06_angle-xy/deformers.json', '斜角模型')],
  'step07_jaw-line': [file('nine-axis/step07_jaw-line/deformers.json', '脸部九轴模型'), image('nine-axis/step07_jaw-line/character-nine-axis.png', '合成图'), file('nine-axis/step07_jaw-line/character-nine-axis.kra', '分层 KRA'), file('nine-axis/step07_jaw-line/notes.md', '制作说明')],
});
export function shadowInspectionArtifacts(files) {
  return files.filter(path => /^shadow\/step01_mask\/inspection\/relation-\d{3,}-review\.png$/.test(path)).sort()
    .map((path,i) => image(path, `投影 ${i+1} · 余量检查`));
}

for (const index of [1, 3]) {
  const section = index === 1 ? "raster-layering" : "clothing-raster-layering";
  for (const phase of ["review-01", "repair-01", "review-02", "repair-02"])
    stepArtifacts[index][phase] = [file(`${section}/step01/${phase}.md`, phase + " 报告")];
}

export function groupArtifacts(section, group, depth) {
 const svg = (path, label, draft) => [
  image(path.replace(/\.svg$/, '.draft.svg'), `${label} · 中间产物`),
  image(draft, `${label} · 中间产物`),
  image(path, `${label}图`),
 ];
 const step = name => groupStepPath(section, group.id, name);
 return {
  outline: svg(`${step('outline')}/outline.svg`, '轮廓', `${step('outline')}/workspace/outline.draft.svg`),
  review: [file(`${step('outline')}/review.json`, '复核 / 返修记录')],
  reduction: svg(`${layerPath(section, depth)}/${group.id}.svg`, '去重', `${layerPath(section, depth)}/workspace/${group.id}.draft.svg`),
  completion: svg(`${section}/parts/${group.id}.svg`, '补全', `${step('completion')}/workspace/completion.draft.svg`),
  completionCheck: [file(`${step('completion')}/check.json`, '补全检查记录')],
  children: [file(`${step('children')}/children.json`, '子组分析记录')],
 };
}
