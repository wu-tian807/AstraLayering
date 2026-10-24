// Display-only definitions, matched to the existing preparation, part and raster runners.
// Execution states are supplied by the read-only task snapshot; these are labels only.
export const groupPhases = [
  ['outline', '轮廓绘制'], ['review', '轮廓复核'], ['reduction', '同层去重'],
  ['completion', '遮挡补全'], ['completionCheck', '补全检查'], ['children', '直属结构拆分'],
];
export const statusNames = {pending:'待执行', running:'进行中', available:'已有产物', done:'已完成', failed:'执行失败'};
export const displayStatus = (status, hasArtifacts = false) => status === 'skipped' ? 'done'
  : Object.hasOwn(statusNames, status) ? status : hasArtifacts ? 'available' : 'pending';
export const statusLabel = status => statusNames[displayStatus(status)];

export function groupSummary(group) {
  const values = groupPhases.map(([id]) => group.webPhases?.[id]);
  const status = values.includes('failed') ? 'failed' : values.includes('running') ? 'running' : values.every(value => value === 'done') ? 'done'
    : values.some(value => value === 'done' || value === 'available') ? 'available' : 'pending';
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

export function groupStagePreviewArtifacts(phase, phaseFiles, files, versions = {}) {
  const phases = phase === 'outline' ? ['outline'] : ['completion', 'reduction', 'outline'];
  return latestSvgArtifacts(phases.flatMap(id => phaseFiles[id]), files, versions);
}

export function groupReviewSteps(group, pipeline, groupId) {
  return [1, 2].flatMap(number => ['review', 'repair'].map(mode => {
    const record = group.webReviewRounds?.[number - 1]?.[mode];
    const title = `第 ${number} 轮${mode === 'review' ? '轮廓复核' : '返修'}`;
    return { id: `${mode}-${number}`, title, status: record?.status || 'pending', detail: record?.detail || '',
      artifacts: record?.reportIndex === undefined ? [] : [{ path: `${pipeline}/stages/review/${groupId}.review.json`,
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

export const pipelineSteps = [
  partSteps(false), rasterSteps(false), partSteps(true), rasterSteps(true),
  [step('step01', '人物与衣服 KRA 组装', 'pending', [],
    '同一 agent 调整穿戴关系、必要遮罩与局部笔触，重开验收并导出 KRA、合成 PNG 和报告。')],
  [{ ...step('step01', '阴影方式 · 二选一', 'pending', [
    { ...step('mask', 'Live2D 蒙版', 'pending'), processDirectory: 'shadow/mask/step01' },
    step('normal-depth', '法线＋深度', 'pending', [
      { ...step('normal-depth-maps', '生成与验收贴图', 'pending'), processDirectory: 'shadow/normal-depth/step01' },
    ])],
    '本轮执行所选分支；两种方式的已有产物分别保留。'), childrenMode: 'alternative' }],
  [step('step01','组件与实际连接','pending'),step('step02','固定区与约束绑定','pending'),step('step03','连续动画复核','pending')],
];

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
const rasterDelivery = (pipeline, stepId, png, kra) => [
  image(`${pipeline}/${stepId}/${png}`, '合成 PNG'),
  file(`${pipeline}/${stepId}/${kra}`, '分层 KRA'),
  file(`${pipeline}/${stepId}/report.md`, '绘制报告'),
];
export const stepArtifacts = [
  {
    preparation: [file('part-layering/references/judgment.json', '参考判断记录')],
    standard: [image('part-layering/references/standard.png', '标准参考图')],
    simplified: [image('part-layering/references/simplified-subject.png', '简化角色')],
    base: [image('part-layering/references/base-subject.png', '素体参考')],
    initial: [file('part-layering/groups.json', '分组树')],
    merge: [image('part-layering/preview.draft.svg', '分块合成 · 中间产物'), image('part-layering/preview.svg', '分块合成 SVG')],
    occlusion: [image('part-layering/stages/occlusion/candidate.svg', '深度规划 · 中间产物'), file('part-layering/occlusion.json', '遮挡深度表')],
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
    occlusion: [image('clothing-part-layering/stages/occlusion/candidate.svg', '深度规划 · 中间产物'), file('clothing-part-layering/occlusion.json', '遮挡深度表')],
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
  mask: [image('shadow/mask/step01/character-shadowed.png', '投影阴影'), image('shadow/mask/step01/face-review.png', '头脸投影 · 原尺寸对照'), image('shadow/mask/step01/inspection/overview.png', '去影对照'), file('shadow/mask/step01/character-shadowed.kra', '阴影 KRA'), file('shadow/mask/step01/shadows.json', '跟随与裁切关系'), file('shadow/mask/step01/inspection.json', '裁切检查'), file('shadow/mask/step01/report.md', '绘制报告')],
  'normal-depth': [],
  'normal-depth-maps': [image('shadow/normal-depth/step01/normal.png', '法线'), image('shadow/normal-depth/step01/depth.png', '深度'), file('shadow/normal-depth/step01/report.md', '贴图报告')],
});
export function shadowInspectionArtifacts(files) {
  return files.filter(path => /^shadow\/mask\/step01\/inspection\/relation-\d{3,}-review\.png$/.test(path)).sort()
    .map((path,i) => image(path, `投影 ${i+1} · 余量检查`));
}

for (const index of [1, 3]) {
  const pipeline = index === 1 ? "raster-layering" : "clothing-raster-layering";
  for (const phase of ["review-01", "repair-01", "review-02", "repair-02"])
    stepArtifacts[index][phase] = [file(`${pipeline}/step01/${phase}.md`, phase + " 报告")];
}

export function groupArtifacts(pipeline, group, depth) {
 const svg = (folder, label) => [
  image(`${pipeline}/${folder}/${group.id}.draft.svg`, `${label} · 中间产物`),
  image(`${pipeline}/${folder}/${group.id}.svg`, `${label}图`),
 ];
 return {
  outline: svg('stages/outline', '轮廓'),
  review: [file(`${pipeline}/stages/review/${group.id}.review.json`, '复核 / 返修记录')],
  reduction: [...svg('stages/outline-reduce', '去重'), file(`${pipeline}/stages/outline-reduce/layers/${depth}.json`, '同层去重记录')],
  completion: [...svg('parts', '补全'), file(`${pipeline}/stages/completion-inputs/${group.id}.json`, '补全输入记录')],
  completionCheck: [file(`${pipeline}/stages/completion-check/${group.id}.json`, '补全检查记录')],
  children: [file(`${pipeline}/groups.json`, '分组树与分析记录')],
 };
}

stepArtifacts.push({step01:[file('physics/step01/analysis.json','组件分析'),file('physics/step01/report.md','分析说明')],step02:[file('physics/step02/physics.draft.json','物理草稿'),file('physics/step02/report.md','绑定说明')],step03:[file('physics/physics.json','正式物理配置'),file('physics/step03/findings.json','视觉结论'),file('physics/step03/evidence/manifest.json','连续动画证据'),file('physics/step03/report.md','复核说明')]});
