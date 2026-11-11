// Execution keeps its step tree. The canvas presents branches as task rows,
// so a model -> direction relationship does not create another card or scroller.
export function nineAxisStepCard(step, { esc, icon, statusMark, statusLabel, content, collapsed, selected }) {
  const key = `6:${step.id}`, closed = collapsed.has(key);
  const outputs = content(step);
  const row = (task, title = task.title) => {
    const body = content(task);
    const heading = `${statusMark(task.status)}<span class="nine-task-title">${esc(title)}</span><span class="nine-task-status">${esc(statusLabel(task.status))}</span>`;
    const attrs = `class="nine-task ${task.status}" data-node="6:${task.id}"`;
    return body ? `<details ${attrs} data-details="nine-output:${esc(task.id)}"><summary class="nine-task-heading">${heading}${icon('down')}</summary><div class="nine-task-body">${body}</div></details>`
      : `<div ${attrs}><div class="nine-task-heading">${heading}</div></div>`;
  };
  const children = step.children || [];
  const model = children.find(child => child.children?.length);
  let branches = '';
  if (model) {
    branches = `<div class="nine-task-group"><div class="nine-group-heading"><h4>单轴模型</h4><span>三方向并行 · 完成后合并</span></div>${model.children.map(task => row(task)).join('')}${row(model, '模型合并')}</div>
      <div class="nine-task-group">${children.filter(child => child !== model).map(task => row(task)).join('')}</div>`;
  } else if (children.length) {
    branches = `<div class="nine-task-group"><div class="nine-group-heading"><h4>单轴制作</h4><span>三方向并行</span></div>${children.map(task => row(task)).join('')}</div>`;
  }
  const hasContent = !!(branches || outputs);
  const number = step.id.match(/^step(\d+)/)?.[1] || '';
  return `<section class="step-node nine-axis-step ${children.length ? 'nine-axis-branches' : ''} ${closed && hasContent ? 'node-collapsed' : ''} ${step.status} ${selected === step.id ? 'selected' : ''}" data-node="${key}">
    <div class="step-heading nine-step-heading"><span class="nine-step-number">${number}</span><h3 title="${esc(step.title)}">${esc(step.title)}</h3><span class="nine-step-status">${statusMark(step.status)}${esc(statusLabel(step.status))}</span>${hasContent ? `<button class="icon-button" data-step-toggle="${key}" aria-label="${closed ? '展开' : '收起'}${esc(step.title)}" aria-expanded="${!closed}">${icon(closed ? 'chevron' : 'down')}</button>` : ''}</div>
    ${hasContent && !closed ? `<div class="step-content nine-step-content">${branches}${outputs ? `<div class="nine-step-outputs">${outputs}</div>` : ''}</div>` : ''}
  </section>`;
}
