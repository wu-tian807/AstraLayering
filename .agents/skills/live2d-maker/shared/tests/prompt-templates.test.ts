import assert from 'node:assert/strict';
import {join,sep} from 'node:path';
import {test} from 'node:test';
import {renderPrompt,renderPromptFile} from '../prompts/render.ts';
import {checkKnowledge,defaultKnowledgeDirectory,renderKnowledge,runtimePrompt,stepKnowledge} from '../knowledge.ts';

const taskRoot=join(sep,'runs','case');

test('模板明确要求变量和必要插入位置，填入的数据不进行二次求值',()=>{
  assert.throws(()=>renderPrompt('正文 {runtime_context}',{}),Error);
  assert.throws(()=>renderPrompt('自定义正文',{runtime_context:'data'},'custom',['runtime_context']),Error);
  assert.equal(renderPrompt('{task_prompt} / {runtime_context}',{task_prompt:'原文 {runtime_context}',runtime_context:'本次数据'}),'原文 {runtime_context} / 本次数据');
});
test('姿态与衣服提示词展开输入图片路径',()=>{
  for(const [section,step,inputs] of [
    ['part-layering','step04_standard',['/task/input.png']],
    ['clothing-part-layering','step01_preparation',[
      join('/task','part-layering','references','simplified-subject.png'),
      join('/task','part-layering','references','base-subject.png'),
    ]],
  ] as const){
    const prompt=stepKnowledge(section,step).render('main',{width:'24',height:'32',input:'/task/input.png'},{taskRoot:'/task'});
    assert.doesNotMatch(prompt,/\{[a-z_]+\}/);
    for(const input of inputs) assert.ok(prompt.includes(input), input);
  }
});
test('外层 CLI 与背景适配也由 Markdown 声明替换位置',()=>{
  const cli=runtimePrompt('agent-turn',{},{taskRoot});
  assert.ok(cli.includes(taskRoot));
  const image=renderPromptFile(new URL('../prompts/image-request.md',import.meta.url),{drawing_prompt:'原绘图要求',background_instructions:'背景要求'});
  assert.ok(image.includes('原绘图要求'));
  assert.ok(image.includes('背景要求'));
});
test('先验知识只替换已知变量和路径前缀，其余花括号原样保留',()=>{
  const text=renderKnowledge('{known} {unknown} {"json":1} {uri:a/{layer_depth}/{other}.svg} {shared_reference:x.png}',{known:'值',layer_depth:'2'},{taskRoot});
  assert.equal(text,`值 {unknown} {"json":1} ${join(taskRoot,'a','2','{other}.svg')} ${join(defaultKnowledgeDirectory,'shared','references','x.png')}`);
  assert.throws(()=>renderKnowledge('{reference:x.png}',{}),Error);
});
test('默认先验知识目录完整可用',()=>{ checkKnowledge(defaultKnowledgeDirectory); });
test('启动检查 reference 与 shared_reference 指向的文件，uri 不检查',async()=>{
  const {cp,mkdtemp,rm,appendFile}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const root=await mkdtemp(join(tmpdir(),'knowledge-'));
  try{
    await cp(defaultKnowledgeDirectory,root,{recursive:true});
    const task=join(root,'part-layering/step05_simplified/prompts/2-简化图片.md');
    await appendFile(task,'\n{uri:不存在/x.png}\n');
    checkKnowledge(root);
    await appendFile(task,'{shared_reference:不存在.png}\n');
    assert.throws(()=>checkKnowledge(root),Error);
    await cp(defaultKnowledgeDirectory,root,{recursive:true,force:true});
    await rm(join(root,'part-layering/step11_completion/references/fingers/complete-fingers.png'));
    assert.throws(()=>checkKnowledge(root),Error);
    await cp(defaultKnowledgeDirectory,root,{recursive:true,force:true});
    await rm(join(root,'head-nine-axis/step02_video/references/angles.json'));
    assert.throws(()=>checkKnowledge(root),Error);
  }finally{ await rm(root,{recursive:true,force:true}); }
});
