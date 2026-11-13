// Stage cards and their overview use the same execution tree. A planned step
// is visible before it has saved any products.
export function flowStepHeading(step, { index, status = step.status, closed, esc, icon, statusMark, statusLabel }) {
  const key = `${index}:${step.id}`;
  return `<div class="step-heading"><button class="step-node-heading" data-step="${key}">${statusMark(status)}<h3>${esc(step.title)}</h3><small class="step-state" title="${esc(step.id)}">${esc(statusLabel(status))}</small></button><button class="icon-button" data-step-toggle="${key}" aria-label="${closed ? '展开' : '收起'}${esc(step.title)}" aria-expanded="${!closed}">${icon(closed ? 'chevron' : 'down')}</button></div>`;
}

export function flowStepList(steps, { index, esc, icon, statusMark, statusLabel }) {
  const list = (nodes, nested = false) => `<ol class="flow-step-list ${nested ? 'flow-step-children' : ''}">${nodes.map((step, order) => {
    const children = step.children || [];
    const label = step.status === 'skipped' ? '无需执行' : statusLabel(step.status);
    const mark = step.status === 'skipped' ? `<span class="phase-mark" aria-label="无需执行">${icon('arrow')}</span>` : statusMark(step.status);
    return `<li><button class="flow-plan-step" data-step="${index}:${step.id}" title="${esc(label)}">${nested ? '' : `<span class="step-ordinal">${String(order + 1).padStart(2, '0')}</span>`}<span class="flow-plan-title">${esc(step.title)}</span>${mark}</button>${children.length ? list(children, true) : ''}</li>`;
  }).join('')}</ol>`;
  return list(steps);
}
