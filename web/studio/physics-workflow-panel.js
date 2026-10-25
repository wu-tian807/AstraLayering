import { normalizedStages, provenanceSummary, coverageRows, selectedAssemblies, tuningRounds, candidateMetrics, candidateMotionTarget, candidateResponseCurves, selectedFindings, selectedEvents, recordedCurve, curveGeometry, responseProbes, sampleResponse, statusLabel } from './physics-workflow-model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const number = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
const empty = text => `<p class="muted workflow-empty">${esc(text)}</p>`;
const criterionNames = { attachment: '固定与连接', shape: '轮廓与形变', response: '运动与回弹', limits: '最大约束', layers: '叠层与遮挡', surfaces: '光照贴图' };
const verdictNames = { supported: '有证据支持', unsupported: '需修复', uncertain: '待确认', missing: '待复核', failed: '需修复' };
const eventNames = { peak: '位移峰值', reversal: '换向', limit: '触及约束', fallback: '安全回退' };
const inputNames = { neutral: '静止', 'tip-impulse': '末端脉冲', 'support-release': '支撑移动后释放', 'support-reverse': '支撑往返', sustained: '持续输入后停止', extreme: '极端输入', combined: '组合运动', 'light-brush': '轻扫后释放', airflow: '微风后停止' };
const parameterNames = { frequencyHz: '摆动节奏', outputFrequencyHz: '角度过渡', dampingRatio: '衰减', inputGain: '受力倍率', parentGain: '牵动惯性', parentVelocityLimit: '惯性预算（L/s）', outputGain: '摆幅倍率', maxTravel: '最大位移', maxAngle: '最大摆角', maxStretch: '最大拉伸', maxCompression: '最大压缩', maxShear: '最大剪切', minAreaRatio: '最小面积' };
const familyNames = { hair: '头发', fabric: '衣物', accessory: '配饰', other: '其他' };

function curveMarkup(series, options = {}) {
  const geometry = curveGeometry(series, options);
  if (!geometry.series.some(item => item.points.length > 1)) return empty('等待运动采样');
  return `<svg viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="${esc(options.label || '横向位移曲线，单位像素')}">
    <path class="curve-grid" d="M16 16H${geometry.width - 16} M16 ${geometry.zero}H${geometry.width - 16} M16 ${geometry.height - 16}H${geometry.width - 16}"/>
    ${geometry.series.map(item => `<path class="response-${esc(item.id)}" d="${item.path}"/>`).join('')}
    <text x="16" y="11">${number(geometry.extent)} px</text><text x="16" y="${geometry.height - 2}">${number(geometry.start)} s</text><text x="${geometry.width - 16}" y="${geometry.height - 2}" text-anchor="end">${number(geometry.end)} s</text>
  </svg>`;
}

export class PhysicsWorkflowPanel {
  constructor({ physics, source }) {
    this.physics = physics; this.source = source; this.active = false;
    this.live = []; this.selected = null; this.liveBody = null;
    $('#physics-workflow-refresh').onclick = () => void this.refresh();
    $('#physics-evidence-test').onchange = () => this.renderEvidence();
    $('#physics-tuning-round').onchange = () => this.renderTuning();
    $('#physics-tuning-test').onchange = () => this.renderTuning();
    $('#physics-workflow').addEventListener('click', event => {
      const component = event.target.closest('[data-workflow-component]');
      if (component && this.physics.config?.components.some(item => item.id === component.dataset.workflowComponent)) this.physics.select(component.dataset.workflowComponent);
    });
    $('#physics-live-reset').onclick = () => { this.live = []; this.renderLive(); };
    $('#physics-evidence-play').onclick = () => {
      const name = $('#physics-evidence-test').value, control = $('#component-test');
      if (!this.physics.formal || !Array.from(control.options).some(option => option.value === name)) return;
      control.value = name; control.dispatchEvent(new Event('change'));
    };
    this.visibilityChanged = () => { if (!document.hidden && this.active && this.running()) void this.refresh(); else this.schedule(); };
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }
  sync(active) {
    const activated = active && !this.active;
    this.active = active;
    const source = this.source(), project = source?.project;
    const key = project && !source.physicsCase ? `${project.name}\n${project.dir || ''}` : '';
    if (key !== this.key || source !== this.owner) {
      this.controller?.abort(); clearTimeout(this.poll);
      this.key = key; this.owner = source; this.data = project?.physicsWorkflow || null; this.loadedKey = project && Object.hasOwn(project, 'physicsWorkflow') ? key : null; this.error = ''; this.loading = false;
      this.live = []; this.liveBody = null; this.selected = null;
      this.render();
    }
    const selected = this.physics.formal ? this.physics.selected : null;
    if (selected !== this.selected) {
      this.selected = selected; this.live = []; this.liveBody = null;
      this.renderDetails(); this.renderLive();
    }
    $('#physics-live-panel').hidden = !this.physics.formal;
    const dirty = !!this.physics.dirty;
    if (dirty !== this.dirty) { this.dirty = dirty; this.renderProvenance(); this.renderFindings(); }
    const requestKey = key;
    if (active && key && this.loadedKey !== requestKey && this.requestKey !== requestKey) void this.refresh();
    else if (activated) this.schedule();
    if (!active) clearTimeout(this.poll);
  }
  async refresh() {
    const project = this.source()?.project;
    if (!this.key || !project) return;
    this.controller?.abort(); clearTimeout(this.poll);
    const controller = new AbortController(); this.controller = controller;
    const key = this.key; this.requestKey = key; this.loading = true; this.error = ''; this.renderHeader();
    const params = new URLSearchParams({ name: project.name });
    if (project.dir) params.set('dir', project.dir);
    try {
      const response = await fetch(`./api/studio/project?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || `读取失败 (${response.status})`);
      if (controller !== this.controller) return;
      this.data = data.physicsWorkflow || null; this.loadedKey = key;
    } catch (error) { if (error.name !== 'AbortError' && controller === this.controller) { this.error = error.message; this.loadedKey = key; } }
    finally {
      if (controller === this.controller) { this.loading = false; this.requestKey = null; this.render(); this.schedule(); }
    }
  }
  running() { return this.data?.stages?.some(stage => stage.status === 'running'); }
  schedule() { clearTimeout(this.poll); if (this.active && !document.hidden && this.running()) this.poll = setTimeout(() => void this.refresh(), 5000); }
  componentName(id) { return this.physics.config?.components.find(component => component.id === id)?.name || id || '未指定'; }
  componentButton(id, label) { return `<button class="workflow-component" data-workflow-component="${esc(id)}"${id === this.selected ? ' aria-current="true"' : ''}>${esc(label || this.componentName(id))}</button>`; }
  render() { this.renderHeader(); this.renderProvenance(); this.renderDetails(); }
  renderHeader() {
    $('#physics-workflow-refresh').disabled = !this.key || this.loading;
    $('#physics-workflow-status').textContent = this.error ? `读取失败：${this.error}` : this.loading ? '正在读取制作记录…' : this.key ? this.data ? '逐组件制作与复核' : '尚未生成制作记录' : '从项目加载后查看制作记录';
    $('#physics-workflow-stages').innerHTML = normalizedStages(this.data).map(stage => `<div class="workflow-stage" data-status="${esc(stage.status)}" title="${esc(stage.reason)}"><span>${stage.letter}</span><b>${stage.title}</b><small>${esc(stage.label)}</small></div>`).join('');
  }
  renderProvenance() {
    const summary = provenanceSummary(this.data, !!this.physics.dirty);
    const badge = $('#physics-workflow-source'); badge.hidden = !this.data;
    badge.textContent = summary.title; badge.dataset.status = summary.tone; badge.title = summary.detail;
    $('#physics-workflow-provenance').hidden = !this.data;
    const initialization=this.data?.initialization;
    $('#physics-workflow-provenance').textContent = summary.detail + (initialization?.mode==='explicit-same-source-reference' ? ' 参考初始化 · 重新复核。' : initialization?.mode==='reference-and-geometry-presets' ? ' 参考与新组件配方初始化 · 重新复核。' : initialization?.mode==='geometry-aware-presets' ? ' 类型与长度配方初始化。' : '');
    if (this.data?.source === 'manual' && this.physics.formal && !this.physics.dirty) $('#physics-draft').textContent = summary.title.includes('已认可') ? '手动 · 已认可' : '手动 · 待确认';
    this.renderEvidence();
  }
  renderDetails() {
    const regions = coverageRows(this.data?.coverage), total = regions.reduce((sum, region) => sum + region.bound.length, 0);
    $('#physics-coverage-count').textContent = regions.length ? `${total} 个绑定` : '待生成';
    $('#physics-workflow-coverage').innerHTML = regions.length ? regions.map(region => `<div class="workflow-region"><b>${esc(region.region || familyNames[region.family] || region.family)}</b><div class="workflow-counts"><span>${region.bound.length} 绑定</span><span>${region.fixed.length} 固定</span><span${region.deferred.length ? ' class="workflow-warning"' : ''}>${region.deferred.length} 暂缓</span></div>${region.bound.map(bound => this.componentButton(bound.component, this.componentName(bound.component) + (bound.enabled === false ? ' · 已关闭' : ''))).join('')}${region.fixed.map(part => `<p class="workflow-note">固定：${esc(part.reason || part.part)}</p>`).join('')}${region.deferred.map(part => `<p class="workflow-note workflow-warning">暂缓：${esc(part.reason || part.code || part.part)}</p>`).join('')}</div>`).join('') : empty('覆盖报告尚未生成');
    const groups = selectedAssemblies(this.data?.assemblies, this.selected);
    $('#physics-workflow-assemblies').innerHTML = groups.length ? groups.map(group => `<div class="workflow-assembly"><b>${esc(group.id)}</b>${(group.links || []).length ? `<div class="workflow-links">${group.links.map(link => `<div>${this.componentButton(link.parent)}<span aria-label="带动">→</span>${this.componentButton(link.child)}<small>${esc(link.supportId || '')}</small></div>`).join('')}</div>` : `<p class="workflow-note">${(group.roots || []).map(id => esc(this.componentName(id))).join('、') || '独立组件'} · 无子连接</p>`}</div>`).join('') : empty('当前组件的装配连接尚未生成');
    const rounds = tuningRounds(this.data?.tuning, this.selected), control = $('#physics-tuning-round'), previous = control.value;
    control.replaceChildren(...rounds.map((round, index) => new Option(`${round.assemblyId} · 第 ${round.round} 轮`, String(index))));
    control.disabled = !rounds.length; control.value = rounds.some((_, index) => String(index) === previous) ? previous : String(rounds.length - 1);
    this.renderTuning(); this.renderFindings(); this.renderEvidence();
  }
  renderTuning() {
    const rounds = tuningRounds(this.data?.tuning, this.selected), round = rounds[Number($('#physics-tuning-round').value)];
    const tests = [...new Set((round?.candidates || []).flatMap(candidate => Object.keys(candidate.metrics || {})))], control = $('#physics-tuning-test'), previous = control.value;
    control.replaceChildren(...tests.map(test => new Option(inputNames[test] || test, test)));
    if (tests.includes(previous)) control.value = previous;
    control.disabled = !tests.length;
    const curves = candidateResponseCurves(round, this.selected, control.value);
    $('#physics-tuning-curve').innerHTML = curves.some(curve => curve.points.length > 1) ? `${curveMarkup(curves, { label: '各标定候选的末端横向响应，单位像素' })}<div class="response-legend tuning-legend">${curves.filter(curve => curve.points.length).map(curve => `<span class="response-${curve.id}">${esc(curve.name)}${curve.selected ? ' ✓' : ''}</span>`).join('')}</div>` : empty('候选响应曲线待生成');
    $('#physics-workflow-tuning').innerHTML = round ? `${round.reason ? `<p class="workflow-note">${esc(round.reason)}</p>` : ''}<div class="workflow-candidates">${round.candidates.map(candidate => {
      const metrics = candidateMetrics(candidate, this.selected), target=candidateMotionTarget(candidate,this.selected,control.value), chosen = candidate.id === round.selectedCandidate;
      return `<div class="workflow-candidate${chosen ? ' chosen' : ''}"><b>${esc(candidate.id)}${chosen ? ' · 已选择' : candidate.eligible === false ? ' · 未达到目标' : ''}</b>${(candidate.changes || []).filter(change => !this.selected || change.component === this.selected).map(change => `<p>${esc(parameterNames[change.key] || change.key)} <span>${esc(change.from)} → ${esc(change.to)}</span></p>`).join('') || '<p>基准配置</p>'}${metrics ? `<div class="workflow-metrics"><span>峰值 <b>${number(metrics.peak)} px</b></span><span>单步 <b>${number(metrics.maxStep)} px</b></span><span>限幅 / 回退 <b>${metrics.limited} / ${metrics.fallback}</b></span></div>` : '<p class="workflow-note">数值证据待生成</p>'}${target?.usable===false?'<p class="workflow-note">参考片段未通过运动检查，仅作初始化</p>':target ? `<div class="workflow-metrics${target.issues?.length?' workflow-warning':''}"><span>参考幅度 <b>${Math.round(target.ratios.peak*100)}%</b></span><span>参考活动量 <b>${Math.round(target.ratios.activity*100)}%</b></span><span>自由段 <b>${Math.round(target.freeLengthRatio*100)}%</b></span></div>`:''}${(candidate.issues || []).length ? `<p class="workflow-warning">${esc(candidate.issues.join('、'))}</p>` : ''}</div>`;
    }).join('')}</div>` : empty('标定候选尚未生成');
  }
  renderFindings() {
    const rows = selectedFindings(this.data?.findings, this.selected), feedback = (this.data?.feedback?.items || []).filter(item => !this.selected || item.component === this.selected);
    const summary = provenanceSummary(this.data, !!this.physics.dirty);
    $('#physics-workflow-findings').innerHTML = (rows.length || feedback.length) ? `${!summary.evidenceCurrent || this.data?.findings?.current === false ? '<p class="workflow-warning">历史复核，未验证当前配置</p>' : ''}${rows.map(row => `<div class="workflow-finding"><b>${esc(criterionNames[row.criterion] || row.criterion)}</b><span data-verdict="${esc(row.verdict)}">${esc(verdictNames[row.verdict] || '待复核')}</span><p>${esc(row.reason || '尚无说明')}</p>${this.imageReferences(row.images)}</div>`).join('')}${feedback.length ? `<p class="workflow-warning">修复反馈 · ${esc(statusLabel(this.data.feedback.status))}</p>${feedback.map(item => `<div class="workflow-finding"><b>${esc(criterionNames[item.criterion] || item.criterion)}</b><p>${esc(item.reason)}</p><small>${esc(inputNames[item.test] || item.test || '')}${item.steps ? ` · ${number(item.steps[0] / 120)}–${number(item.steps[1] / 120)} s` : ''}</small>${this.imageReferences(item.images)}</div>`).join('')}` : ''}` : empty('六项视觉复核尚未生成');
  }
  imageReferences(images) {
    if (!images?.length) return '';
    return `<details class="workflow-image-references"><summary>${images.length} 张证据图</summary>${images.map(reference => {
      const path = typeof reference === 'string' ? reference : reference.path, url = typeof reference === 'object' ? reference.url : null;
      return url && /^(?:\.\/|\/(?!\/)|https?:\/\/)/.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(path || '复核证据')}" loading="lazy"></a>` : `<small>${esc(path || '未提供图像入口')}</small>`;
    }).join('')}</details>`;
  }
  renderEvidence() {
    const runs = this.data?.evidence?.runs || [], control = $('#physics-evidence-test'), previous = control.value;
    if (Array.from(control.options).map(option => option.value).join('\n') !== runs.map(run => run.test).join('\n')) {
      control.replaceChildren(...runs.map(run => new Option(inputNames[run.test] || run.test, run.test)));
      if (runs.some(run => run.test === previous)) control.value = previous;
    }
    control.disabled = !runs.length;
    const run = runs.find(item => item.test === control.value), curve = recordedCurve(run, this.selected), summary = provenanceSummary(this.data, !!this.physics.dirty);
    $('#physics-evidence-state').textContent = run ? summary.evidenceCurrent ? '记录证据 · 当前配置' : '记录证据 · 历史配置' : '记录证据 · 待生成';
    $('#physics-evidence-state').classList.toggle('workflow-warning', !!run && !summary.evidenceCurrent);
    $('#physics-evidence-curve').innerHTML = curve.length ? curveMarkup([{ id: 'tip', points: curve }], { label: '复核记录中的末端横向响应，单位像素' }) : run?.plotUrl ? `<img class="workflow-overview-plot" src="${esc(run.plotUrl)}" alt="复核记录中的全部组件曲线"><p class="workflow-note">历史格式 · 全部组件总览</p>` : empty(run ? '当前组件未提供记录曲线' : '独立模拟后显示记录曲线');
    const events = selectedEvents(run, this.selected);
    $('#physics-evidence-events').innerHTML = events.length ? events.slice(0, 24).map(event => `<li><time>${number(event.step / 120)} s</time><span>${esc(eventNames[event.type] || event.type)}</span>${event.travel !== undefined ? `<small>${number(event.travel)} px</small>` : ''}</li>`).join('') + (events.length > 24 ? `<li class="muted">另有 ${events.length - 24} 个事件</li>` : '') : '<li class="muted">暂无记录事件</li>';
    $('#physics-evidence-play').disabled = !run || !this.physics.formal || !this.physics.enabled;
    $('#physics-evidence-metrics').innerHTML = run ? this.evidenceMetrics(run) : '';
  }
  evidenceMetrics(run) {
    const metric = run.metrics?.motionReview?.components?.[this.selected];
    if (!metric) return '';
    return `<div class="workflow-metrics"><span>峰值 <b>${number(metric.peak)} px</b></span><span>单步 <b>${number(metric.maxStep)} px</b></span><span>尾段 RMS <b>${number(metric.tailRms)} px</b></span><span>固定残差 <b>${number(metric.root)} px</b></span></div>`;
  }
  sample(body, elapsed) {
    if (!this.active || document.hidden || !$('#physics-live-panel details').open || !this.physics.formal || !body || body.component.id !== this.selected) return;
    if (body !== this.liveBody) { this.liveBody = body; this.probes = responseProbes(body); this.live = []; }
    const time = Number(elapsed) || 0, last = this.live.at(-1);
    if (last && time < last.time) this.live = [];
    if (last && time >= last.time && time - last.time < .16) return;
    const value = sampleResponse(body, this.probes); if (!value) return;
    this.live.push({ time, ...value });
    while (this.live.length > 80 || this.live.length > 1 && this.live[0].time < time - 12) this.live.shift();
    this.renderLive();
  }
  renderLive() {
    $('#physics-live-name').textContent = this.componentName(this.selected);
    const end = this.live.at(-1)?.time || 0;
    $('#physics-live-curve').innerHTML = curveMarkup(['root', 'mid', 'tip'].map(id => ({ id, points: this.live.map(sample => [sample.time, sample[id]]) })), { minTime: Math.max(0, end - 12), maxTime: Math.max(1, end), label: '实时预览的固定残差和中段、末端横向响应，单位像素' });
  }
  diagnostics() { return { project: this.key?.split('\n')[0] || null, loading: this.loading, selected: this.selected, stages: normalizedStages(this.data), provenance: this.data ? provenanceSummary(this.data, !!this.physics.dirty) : null, regions: coverageRows(this.data?.coverage).length, assemblies: this.data?.assemblies?.groups?.length || 0, tuningRounds: tuningRounds(this.data?.tuning, this.selected).length, evidenceRuns: this.data?.evidence?.runs?.length || 0, liveSamples: this.live.length, error: this.error || null }; }
  dispose() { this.controller?.abort(); clearTimeout(this.poll); document.removeEventListener('visibilitychange', this.visibilityChanged); }
}
