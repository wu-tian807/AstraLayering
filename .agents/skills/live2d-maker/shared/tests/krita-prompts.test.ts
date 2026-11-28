import {staticPromptPrefix} from './prompt-prefix.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildPrompt} from '../raster/steps.ts';
import {buildReviewPrompt} from '../raster/review.ts';
import {steps as character} from '../../raster-layering/steps.ts';
import {steps as clothing} from '../../clothing-raster-layering/steps.ts';
import {buildPrompt as assembly, steps as assembled} from '../../character-assembly/steps.ts';
import {buildPrompt as shadow, maskSteps, mapSteps} from '../../shadow/steps.ts';
import { stepKnowledge } from '../knowledge.ts';
const mainPrompt = (step: { knowledge: { section: string; step: string } }) => stepKnowledge(step.knowledge.section, step.knowledge.step).files('main')[0];

// Krita usage is explained only by the krita tool's description; prompts keep
// their own task text and carry no shared Krita environment section.
test('人物衣服绘制/review/返修、组装和两种阴影提示词不注入共用 Krita 环境说明，保留原任务正文', async () => {
  const prompts: string[] = [];
  for (const steps of [character,clothing]) {
    for(const step of steps) {
      const prompt = await buildPrompt(step,{directory:'/fixture/input',parts:'/fixture/parts',...(steps === clothing ? {originalCharacter:'/fixture/reference.png'} : {})},'/fixture/output/step01');
      const body = await readFile(mainPrompt(step), 'utf8');
      assert.ok(prompt.startsWith(staticPromptPrefix(body)));
      prompts.push(prompt);
      if ('review' in step && step.review) for(const kind of ['review','repair'] as const) prompts.push(await buildReviewPrompt(step,
        {kind,filename:kind === 'review' ? 'review-01.md':'repair-01.md',index:kind === 'review'?0:1}));
    }
  }
  prompts.push(await assembly(assembled[0],{characterKra:'/fixture/body.kra',clothingKra:'/fixture/clothes.kra',simplifiedCharacter:'/fixture/reference.png'},'/fixture/output'));
  for(const step of [...maskSteps,...mapSteps]) prompts.push(await shadow(step,
    {characterKra:'/fixture/assembled.kra',characterColor:'/fixture/assembled.png',simplifiedCharacter:'/fixture/reference.png',structureFiles:[]},'/fixture/output'));
  for(const prompt of prompts) {
    assert.doesNotMatch(prompt, /\{(?:krita_environment|runtime_context|drawing_responsibilities|drawing_report_filename)\}/);
    assert.doesNotMatch(prompt, /shared\/krita\/environment\.md|execute_krita_python|run-krita-plugin/);
  }
});
