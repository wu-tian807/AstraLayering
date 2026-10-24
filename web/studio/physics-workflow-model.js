const list = value => Array.isArray(value) ? value : [];
export const workflowStages = [
  { id: 'analysis', letter: 'A', title: '结构分析' },
  { id: 'calibration', letter: 'B', title: '制作标定' },
  { id: 'review', letter: 'C', title: '独立复核' },
];
const stageAliases = { analyze: 'analysis', structure: 'analysis', author: 'calibration', authoring: 'calibration', tuning: 'calibration', make: 'calibration', verify: 'review' };
const statusLabels = { pending: '待运行', missing: '待生成', running: '进行中', completed: '已完成', complete: '已完成', accepted: '已通过', approved: '已认可', calibrated: '已标定', draft: '待复核', failed: '失败', blocked: '待处理', stale: '需重跑', deferred: '暂缓', 'repair-requested': '需修复', 'manual-confirmation': '待人工确认', 'not-started': '待运行', 'not-applicable': '未参与' };
export function statusLabel(status) { return statusLabels[status] || '待确认'; }
export function normalizedStages(data) {
  const stages = list(data?.stages);
  return workflowStages.map((definition, index) => {
    const found = stages.find(stage => (stageAliases[stage.id] || stage.id) === definition.id || stage.id === definition.letter)
      || (stages.length === 3 ? stages[index] : null);
    const status = found?.status || 'pending';
    return { ...definition, status, label: statusLabel(status), reason: found?.reason || found?.detail || '' };
  });
}
export function provenanceSummary(data, dirty = false) {
  const provenance = data?.provenance || {};
  const review = provenance.manualReview || data?.manualReview;
  const currentHash = provenance.configHash || provenance.currentConfigHash || data?.configHash;
  const approved = review?.status === 'approved' && (!currentHash || !review.configHash || review.configHash === currentHash);
  const evidenceHash = data?.evidence?.configHash;
  const matches = !dirty && (typeof provenance.evidenceMatchesCurrent === 'boolean'
    ? provenance.evidenceMatchesCurrent : !!currentHash && currentHash === evidenceHash);
  if (dirty) return { title: '本地调参 · 未保存', tone: 'pending', detail: '当前预览已变更；制作记录仍对应项目中的配置。', evidenceCurrent: false, workflowAccepted: false };
  if (data?.source === 'manual') return {
    title: approved ? '手动版本 · 人工已认可' : '手动版本 · 待确认',
    tone: approved ? 'approved' : 'pending',
    detail: '工作流复现待验证。历史制作记录不代表当前版本已经通过工作流。',
    evidenceCurrent: matches, workflowAccepted: false,
  };
  const accepted = matches && provenance.workflowAccepted === true;
  return { title: accepted ? '工作流版本 · 已复核' : '工作流版本 · 待复核', tone: accepted ? 'accepted' : 'pending', detail: accepted ? '独立复核与当前配置一致。' : '各阶段状态以已生成的产物为准。', evidenceCurrent: matches, workflowAccepted: accepted };
}
export function coverageRows(coverage) {
  return list(coverage?.regions).map(region => ({
    ...region, parts: list(region.parts), bound: list(region.bound), fixed: list(region.fixed), deferred: list(region.deferred),
  }));
}
export function selectedAssemblies(assemblies, selected) {
  const groups = list(assemblies?.groups);
  return selected ? groups.filter(group => list(group.componentIds).includes(selected)) : groups;
}
export function tuningRounds(tuning, selected) {
  return list(tuning?.groups).filter(group => !selected || list(group.componentIds).includes(selected)).flatMap(group =>
    list(group.rounds).map(round => ({ ...round, assemblyId: group.assemblyId, componentIds: list(group.componentIds), candidates: list(round.candidates) })),
  );
}
export function candidateMetrics(candidate, selected) {
  const metrics = Object.values(candidate?.metrics || {}).flatMap(test => Object.entries(test || {})
    .filter(([id]) => !selected || id === selected).map(([, value]) => value));
  if (!metrics.length) return null;
  return { peak: Math.max(...metrics.map(metric => Number(metric.peak) || 0)), maxStep: Math.max(...metrics.map(metric => Number(metric.maxStep) || 0)), fallback: metrics.reduce((sum, metric) => sum + (Number(metric.fallback) || 0), 0), limited: metrics.reduce((sum, metric) => sum + (Number(metric.limited) || 0), 0) };
}
export function candidateMotionTarget(candidate, selected, test) {
  if(!selected||!test)return null;
  const target=candidate?.metrics?.[test]?.[selected]?.target;
  if(!target||!Number.isFinite(target.ratios?.peak)||!Number.isFinite(target.ratios?.activity))return null;
  return target;
}
export function candidateResponseCurves(round, selected, test) {
  if (!selected || !test) return [];
  return list(round?.candidates).map((candidate, index) => ({
    id: `candidate-${index % 4}`, name: candidate.id, selected: candidate.id === round.selectedCandidate,
    points: list(candidate.metrics?.[test]?.[selected]?.samples)
      .filter(sample => Number.isFinite(sample?.time) && Number.isFinite(sample?.tip?.[0]))
      .map(sample => [sample.time, sample.tip[0]]),
  }));
}
export function selectedFindings(findings, selected) {
  return list(findings?.components).filter(component => !selected || component.id === selected).flatMap(component =>
    Object.entries(component.criteria || {}).map(([criterion, value]) => ({ component: component.id, criterion, ...(value || {}) })),
  );
}
export function selectedEvents(run, selected) {
  return list(run?.events).filter(event => !selected || event.component === selected).sort((a, b) => a.step - b.step);
}
export function recordedCurve(run, selected) {
  const source = Array.isArray(run?.curves) ? run.curves.find(curve => curve.id === selected) : run?.curves?.[selected];
  return list(source?.points || source).filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])).map(point => [point[0], point[1]]);
}
// Keep graph values finite, including while a Worker starts or a component is disabled.
export function curveGeometry(series, { width = 240, height = 112, padding = 16, minTime, maxTime } = {}) {
  const clean = list(series).map(item => ({ ...item, points: list(item.points).filter(point => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1])) }));
  const points = clean.flatMap(item => item.points);
  const start = minTime ?? (points.length ? Math.min(...points.map(point => point[0])) : 0);
  const end = Math.max(start + .001, maxTime ?? (points.length ? Math.max(...points.map(point => point[0])) : 1));
  const extent = Math.max(.25, ...points.map(point => Math.abs(point[1])));
  const x = time => padding + (time - start) / (end - start) * (width - padding * 2);
  const y = value => height / 2 - value / extent * (height / 2 - padding);
  return { start, end, extent, width, height, zero: height / 2, series: clean.map(item => ({ ...item, path: item.points.map((point, index) => `${index ? 'L' : 'M'}${x(point[0]).toFixed(2)},${y(point[1]).toFixed(2)}`).join(' ') })) };
}
// Probe selection is cached per body, never repeated per frame across the model.
export function responseProbes(body) {
  if (!body?.rest?.length || !body.weights?.length) return null;
  const root = body.component?.supports?.[0]?.at || [body.rest[0], body.rest[1]];
  let tip = -1, mid = -1, farthest = -1, closestMiddle = Infinity;
  for (let index = 0; index < body.weights.length; index++) {
    if (!(body.weights[index] > 0)) continue;
    const distance = Math.hypot(body.rest[index * 2] - root[0], body.rest[index * 2 + 1] - root[1]);
    if (distance > farthest) { farthest = distance; tip = index; }
  }
  if (tip < 0) return null;
  for (let index = 0; index < body.weights.length; index++) {
    if (!(body.weights[index] > 0)) continue;
    const distance = Math.hypot(body.rest[index * 2] - root[0], body.rest[index * 2 + 1] - root[1]);
    if (Math.abs(distance - farthest / 2) < closestMiddle) { closestMiddle = Math.abs(distance - farthest / 2); mid = index; }
  }
  const dx = body.rest[tip * 2] - root[0], dy = body.rest[tip * 2 + 1] - root[1], length = Math.max(1e-8, Math.hypot(dx, dy));
  return { mid, tip, axis: [dy / length, -dx / length] };
}
export function sampleResponse(body, probes) {
  if (!body || !probes) return null;
  const residual = index => (body.positions[index * 2] - body.pose[index * 2]) * probes.axis[0] + (body.positions[index * 2 + 1] - body.pose[index * 2 + 1]) * probes.axis[1];
  const values = { root: body.stats?.root ?? 0, mid: residual(probes.mid), tip: residual(probes.tip) };
  return Object.values(values).every(Number.isFinite) ? values : null;
}
