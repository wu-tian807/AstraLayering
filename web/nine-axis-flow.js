import { flowStepHeading } from './flow-step-ui.js';

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
  if (step.rounds?.length) {
    // Rounds share this step's session, products and recovery controls. These
    // display rows must not become executable child steps.
    branches += `<div class="nine-task-group"><div class="nine-group-heading"><h4>分轮制作</h4><span>依次执行</span></div>${step.rounds.map(round =>
      `<div class="nine-task ${round.status}" data-hair-round="${esc(round.id)}"><div class="nine-task-heading">${statusMark(round.status)}<span class="nine-task-title">${esc(round.title)}</span><span class="nine-task-status">${esc(statusLabel(round.status))}</span></div></div>`).join('')}${step.roundNotice ? `<p class="step-activity">${esc(step.roundNotice)}</p>` : ''}</div>`;
  }
  return `<section class="step-node nine-axis-step ${children.length ? 'nine-axis-branches' : ''} ${closed ? 'node-collapsed' : ''} ${step.status} ${selected === step.id ? 'selected' : ''}" data-node="${key}">
    ${flowStepHeading(step, { index: 6, closed, esc, icon, statusMark, statusLabel })}
    ${!closed ? `<div class="step-content nine-step-content">${step.note ? `<p class="step-summary" title="${esc(step.note)}">${esc(step.note)}</p>` : ''}${branches}${outputs ? `<div class="nine-step-outputs">${outputs}</div>` : ''}</div>` : ''}
  </section>`;
}
