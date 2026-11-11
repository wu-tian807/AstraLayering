import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nineAxisStepCard } from '../nine-axis-flow.js';
import { sectionSteps, previousNineAxisSectionSteps, statusLabel } from '../progress.js';

const context = (products = new Set<string>(), collapsed = new Set<string>()) => ({
  esc: (value: unknown) => String(value).replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
  icon: (name: string) => `<i data-icon="${name}"></i>`,
  statusMark: (status: string) => `<i data-status="${status}"></i>`, statusLabel,
  content: (step: { id: string }) => products.has(step.id) ? `<button>查看产物</button>` : '', collapsed,
});

test('new and previous nine-axis layouts retain real step IDs in flat rows with no nested cards or repeated preview links', () => {
  for (const step of [sectionSteps[6][3], previousNineAxisSectionSteps[1]]) {
    const before = JSON.stringify(step), html = nineAxisStepCard(step, context());
    assert.equal((html.match(/class="step-node /g) || []).length, 1);
    const children = step.children.flatMap(child => [child, ...child.children]);
    for (const child of children) assert.equal(html.split(`data-node="6:${child.id}"`).length - 1, 1, child.id);
    assert.equal((html.match(/class="step-content /g) || []).length, 1);
    assert.doesNotMatch(html, /九轴预览|href=|step-code|<details/);
    assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /step\d|deformers\.json/);
    assert.equal(JSON.stringify(step), before, 'presentation preserves the execution tree');
  }
});

test('only rows with saved output expose disclosures, with independent direction and merge states', () => {
  const step = structuredClone(sectionSteps[6][3]);
  step.status = 'running'; step.children[0].status = 'running';
  step.children[0].children[0].status = 'done'; step.children[0].children[1].status = 'throttled';
  const html = nineAxisStepCard(step, context(new Set(['step04_angles/model/left'])));
  assert.equal((html.match(/<details/g) || []).length, 1);
  assert.match(html, /class="nine-task done" data-node="6:step04_angles\/model\/left"/);
  assert.match(html, /class="nine-task throttled" data-node="6:step04_angles\/model\/up"/);
  assert.match(html, /class="nine-task running" data-node="6:step04_angles\/model"/);
  assert.match(html, /查看产物/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
});

test('empty pending stages have no filler body; collapsing a stage hides the task list', () => {
  const leaf = nineAxisStepCard(sectionSteps[6][1], context());
  assert.doesNotMatch(leaf, /step-content|data-step-toggle|尚无|等待/);
  const closed = nineAxisStepCard(sectionSteps[6][3], context(new Set(), new Set(['6:step04_angles'])));
  assert.match(closed, /aria-expanded="false"/);
  assert.doesNotMatch(closed, /nine-task-group|step-content/);
});
