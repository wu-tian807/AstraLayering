import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowStepHeading, flowStepList } from '../flow-step-ui.js';
import { sectionSteps, previousNineAxisSectionSteps, statusLabel, type ProgressStep } from '../progress.js';

const context = {
  index: 6, esc: (value: unknown) => String(value),
  icon: (name: string) => `<i data-icon="${name}"></i>`,
  statusMark: (status: string) => `<i data-status="${status}"></i>`, statusLabel,
};
const flatten = (steps: ProgressStep[]): ProgressStep[] => steps.flatMap(step => [step, ...flatten(step.children)]);

test('pending overview lists every configured stage and child before any products exist', () => {
  for (const { index, steps } of [{ index: 6, steps: sectionSteps[6] }, { index: 6, steps: previousNineAxisSectionSteps }, { index: 1, steps: sectionSteps[1] }]) {
    const before = JSON.stringify(steps), html = flowStepList(steps, { ...context, index });
    for (const step of flatten(steps)) {
      assert.equal(html.split(`data-step="${index}:${step.id}"`).length - 1, 1, step.id);
      assert.ok(html.includes(step.title));
    }
    assert.doesNotMatch(html, /等待模型|<canvas|href=|<details/);
    assert.equal(JSON.stringify(steps), before);
  }
});

test('card headers allow selection and folding while pending, with the same controls in both states', () => {
  const step = sectionSteps[6][1];
  for (const closed of [true, false]) {
    const html = flowStepHeading(step, { ...context, closed });
    assert.match(html, /data-step="6:step02_video"/);
    assert.match(html, /data-step-toggle="6:step02_video"/);
    assert.ok(html.includes(`aria-expanded="${!closed}"`));
    assert.doesNotMatch(html, /disabled/);
  }
});

test('the plan shows current execution states and explicit skips without inferring completion from files', () => {
  const steps = structuredClone(sectionSteps[1]);
  steps[0].status = 'interrupted'; steps[1].status = 'done'; steps[0].children[1].status = 'skipped';
  const html = flowStepList(steps, context);
  assert.match(html, /data-status="interrupted"/);
  assert.match(html, /data-status="done"/);
  assert.match(html, /title="无需执行"/);
  assert.match(html, /aria-label="无需执行"/);
});
