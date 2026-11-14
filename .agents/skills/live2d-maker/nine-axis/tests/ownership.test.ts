import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOwnedEdit, nodeOwners, ownsNode } from '../ownership.ts';
import { hairPreviewScope, hairRoundAllows } from '../hair.ts';

const grid = { bbox:[0,0,10,10],cols:1,rows:1,keyforms:{'0':[[0,0],[10,0],[0,10],[10,10]]} };
function fixture(): any {
  return {version:2,kind:'head-nine-axis',levels:[{id:'hair',includes:['face','hair']}],
    deformers:[{...structuredClone(grid),id:'carrier-17',level:'hair'}],
    parts:[
      {...structuredClone(grid),id:'paint-A',partId:'character:hair/bangs',level:'hair',parent:'carrier-17'},
      {...structuredClone(grid),id:'paint-B',partId:'character:hair/side_hair/left',level:'hair'},
      {...structuredClone(grid),id:'skin',partId:'character:face/face_base',level:'face'},
      {...structuredClone(grid),id:'unrelated-shadow-name',partId:'character:hair/bangs',level:'hair',parent:'carrier-17',shadow:{casters:['paint-A'],receivers:['skin']}},
      {...structuredClone(grid),id:'deferred-shadow',partId:'character:hair/bangs',level:'hair',shadow:{casters:['paint-A'],receivers:['paint-B']}},
    ]};
}
test('part ownership, carrier permissions and preview survive arbitrary node renaming',()=>{
  const original=fixture(),renamed=structuredClone(original),names=new Map([...renamed.parts,...renamed.deformers].map((n:any,i:number)=>[n.id,'arbitrary-'+i]));
  for(const n of [...renamed.parts,...renamed.deformers]) {
    n.id=names.get(n.id);if(n.parent)n.parent=names.get(n.parent);
    if(n.shadow)for(const key of ['casters','receivers'])n.shadow[key]=n.shadow[key].map((id:string)=>names.get(id));
  }
  const front={label:'前发',allows:hairRoundAllows('front')};
  for(const doc of [original,renamed]) {
    assert.deepEqual([...nodeOwners(doc,doc.deformers[0])],['hair/bangs']);
    assert.equal(ownsNode(doc,doc.deformers[0],front),true);
    const visible=doc.parts.map((p:any)=>hairPreviewScope('front').includes(p,doc));
    assert.deepEqual(visible,[true,false,true,true,false]);
    assert.equal(hairPreviewScope('side').includes(doc.parts[4],doc),true);
  }
});
test('a carrier containing protected hair cannot acquire permission through its name',()=>{
  const before=fixture();before.parts[1].parent=before.deformers[0].id;
  before.deformers[0].id='hair/bangs/claim';for(const p of before.parts)if(p.parent)p.parent='hair/bangs/claim';
  const after=structuredClone(before);after.deformers[0].keyforms['0'][0][0]+=1;
  const front={label:'前发',allows:hairRoundAllows('front')};
  assert.equal(ownsNode(before,before.deformers[0],front),false);
  assert.throws(()=>checkOwnedEdit(before,after,front),/范围外/);
});
test('side parts can attach to a read-only front carrier without acquiring permission to edit it',()=>{
  const before=fixture(),after=structuredClone(before),side={label:'侧发',allows:hairRoundAllows('side')};
  after.parts[1].parent=after.deformers[0].id;
  checkOwnedEdit(before,after,side);
  const changed=structuredClone(after);changed.deformers[0].keyforms['0'][0][0]+=1;
  assert.throws(()=>checkOwnedEdit(after,changed,side),/范围外/);
});
test('unregistered context and future receivers stay out of the current round',()=>{
  const doc=fixture();doc.parts[0].context=true;
  assert.equal(hairPreviewScope('front').includes(doc.parts[0],doc),false);
  assert.equal(hairPreviewScope('front').includes(doc.parts[4],doc),false);
});
