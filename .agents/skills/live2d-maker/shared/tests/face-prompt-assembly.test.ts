import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {defaultKnowledgeDirectory,stepKnowledge} from '../knowledge.ts';

test('face and face_base completion bind their own priors and the complete-face reference',()=>{
  const knowledge=stepKnowledge('part-layering','step11_completion');
  const root=join(defaultKnowledgeDirectory,'part-layering','step11_completion');
  const taskRoot=join(defaultKnowledgeDirectory,'assembly-fixture');
  for(const group of ['face','face/face_base','face/ears']){
    const specialized=group!=='face/ears';
    const own=join(root,'prompts','groups',group);
    assert.deepEqual(knowledge.files('main',group),[
      join(specialized?own:join(root,'prompts'),'9-正面遮挡补全.md'),
      join(root,'prompts','9-补全操作约定.md'),
      join(group==='face'?own:join(root,'prompts'),'参考图片.md'),
    ]);
    const groupDir=group.split('/').join('/children/');
    const prompt=knowledge.render('main',{group_id:group,group_dir:groupDir,layer_depth:'02',width:'1086',height:'1448'},{taskRoot,group});
    for(const path of [join(taskRoot,'part-layering','references','base-subject.png'),join(taskRoot,'part-layering','step10_reduce','depth02',group+'.svg'),join(taskRoot,'part-layering','step11_completion',groupDir,'workspace','completion.draft.svg')]) assert.ok(prompt.includes(path),path);
    if(specialized) assert.ok(prompt.includes(join(root,'references','face','complete-faces.png')));
  }
});
