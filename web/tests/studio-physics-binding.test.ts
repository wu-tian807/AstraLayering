import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindingDefaults, physicsVersion } from '../studio/physics-model.js';
import { physicsRecipe, restorePhysicsRecipe, type PhysicsPart } from '../studio/physics-recipe.js';
const { PhysicsPanel } = await import(new URL('../studio/physics-panel.js', import.meta.url).href);

test('project preparation does not guess bindings; Jianma resets old drafts and preserves newly authored bindings', async t => {
  const store = new Map<string, string>();
  for (const [key, value] of Object.entries({
    localStorage: { getItem: (key: string) => store.get(key) || null },
    requestAnimationFrame: () => 1,
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : Reflect.deleteProperty(globalThis, key));
  }
  const parts = [{ id: 'hair', name: 'left_long_tail' }, { id: 'skirt', name: 'skirt_front' }];
  const panel = (owner: any) => Object.assign(Object.create(PhysicsPanel.prototype), {
    epoch: 0, source: () => owner, busy: () => false, fingerprint: () => 'source-hash', bindings: new Map(),
    surfaces: { prepare: async () => true, layers: parts, size: [100, 100] },
    sync() {}, options() {}, changed() {},
    error(message: string) { assert.fail(message); },
    rebuild(this: any) { this.bodies = new Map([...this.bindings].filter(([, binding]: any) => binding.enabled)); },
    save(this: any) { store.set(this.storageKey(), JSON.stringify(this.recipe())); },
  });
  const normal = panel({ name: 'character.kra' });
  await normal.prepare();
  assert.equal(normal.bodies.size, 0, 'part names created physical components');

  const previous = JSON.stringify({ schema: 1, solver: physicsVersion, sourceHash: 'source-hash', size: [100, 100],
    bindings: Object.fromEntries(parts.map(p => [p.id, { ...bindingDefaults(), enabled: true }])) });
  store.set('astra-physics-1:source-hash', previous);
  const jianma = { name: 'jianma-assembled.kra', project: { name: 'jianma-shadow-fresh-20261022' } };
  const reset = panel(jianma);
  await reset.prepare();
  assert.equal(reset.bodies.size, 0, 'legacy Jianma bindings were restored');
  assert.equal(store.get('astra-physics-1:source-hash'), previous, 'another project draft was deleted');
  reset.bindings.get('skirt').enabled = true;
  reset.save();
  const reopened = panel(jianma);
  await reopened.prepare();
  assert.deepEqual([...reopened.bodies.keys()], ['skirt'], 'new Jianma authoring was reset again');

  const other = panel({ name: 'another-character.kra' });
  await other.prepare();
  assert.equal(other.bodies.size, 2, 'another project lost its existing authored draft');
});

const uid = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const nativePart = (n:number, extra:Partial<PhysicsPart> = {}):PhysicsPart => ({ id:uid(n), uuid:uid(n), legacyId:`n${n}`,
  partPath:`character:hair/tail_${n}`, contentHash:'a'.repeat(64), sourceLayerUuids:[uid(n)],
  bounds:{x:20,y:10,width:30,height:80}, ...extra });
const context = { sourceHash:'original-kra', size:[100,100] };
const authored = { ...bindingDefaults('ribbon'), enabled:true, fixed:.32, maxAngle:12, maxTravel:.08 };

test('stable references survive reorder, rename, inserted shadows and document hash changes', () => {
  const parts = [nativePart(1), nativePart(2)];
  const recipe = physicsRecipe(parts, new Map([[uid(1),authored],[uid(2),bindingDefaults()]]), context);
  assert.equal(recipe.schema,2);
  assert.deepEqual(Object.keys(recipe.records),['uuid:'+uid(1),'uuid:'+uid(2)]);
  const reordered = [nativePart(3), nativePart(2,{legacyId:'n0'}), nativePart(1,{legacyId:'n5',partPath:'renamed/path'})];
  const result = restorePhysicsRecipe(recipe,reordered,{...context,sourceHash:'shadowed-and-reordered-kra'});
  assert.deepEqual(result.bindings.get(uid(1)),authored);
  assert.equal(result.bindings.get(uid(3))!.enabled,false,'new shadow inherited another part binding');
  assert.equal(result.pending.size,0);
  assert.equal(result.issues.length,0);
});

test('repainted, resized, replaced and regrouped parts retain old authoring without binding by similar names', () => {
  const recipe = physicsRecipe([nativePart(1)],new Map([[uid(1),authored]]),context);
  for (const [next, ctx] of [
    [[nativePart(1,{contentHash:'b'.repeat(64)})],context],
    [[nativePart(1,{bounds:{x:20,y:10,width:31,height:80}})],context],
    [[nativePart(2,{partPath:'character:hair/tail_1'})],context],
    [[nativePart(2,{sourceLayerUuids:[uid(1),uid(2)]})],context],
    [[nativePart(1)],{...context,size:[200,200]}],
  ] as [PhysicsPart[],typeof context][]) {
    const result = restorePhysicsRecipe(recipe,next,ctx);
    assert(next.every(l=>!result.bindings.get(l.id)!.enabled));
    assert.equal(result.issues.length,1);
    const saved = physicsRecipe(next,result.bindings,ctx,result.pending);
    assert.deepEqual(saved.records['uuid:'+uid(1)],recipe.records['uuid:'+uid(1)],'unresolved authoring was overwritten');
    const recovered = restorePhysicsRecipe(saved,[nativePart(1)],context);
    assert.deepEqual(recovered.bindings.get(uid(1)),authored,'reopening the original part lost authoring');
  }
});

test('legacy positional authoring migrates only with original bytes, size and unambiguous aliases', () => {
  const recipe = {schema:1,solver:physicsVersion,...context,bindings:{n1:authored,n2:bindingDefaults()}};
  const parts = [nativePart(1),nativePart(2)];
  const result = restorePhysicsRecipe(recipe,parts,context);
  assert.equal(result.migrated,true);
  assert.deepEqual(result.bindings.get(uid(1)),authored);
  assert.throws(()=>restorePhysicsRecipe(recipe,parts,{...context,sourceHash:'changed-kra'}),Error);
  assert.throws(()=>restorePhysicsRecipe(recipe,[...parts,nativePart(3)],context),Error);
});

test('malformed stable references and duplicate identities fail before changing bindings', () => {
  const parts = [nativePart(1)], initial = new Map([[uid(1),bindingDefaults()]]);
  const recipe = physicsRecipe(parts,new Map([[uid(1),authored]]),context);
  recipe.records['uuid:'+uid(1)].ref.uuid = uid(2);
  assert.throws(()=>restorePhysicsRecipe(recipe,parts,context,initial),Error);
  assert.equal(initial.get(uid(1))!.enabled,false);
  assert.throws(()=>physicsRecipe([nativePart(1),nativePart(1)],initial,context),Error);
});

test('project draft namespace survives new document versions and isolates independent projects', () => {
  const panel = (name:string, sourceHash:string) => Object.assign(Object.create(PhysicsPanel.prototype),{
    parts:[nativePart(1)],owner:{project:{name,dir:'/projects'}},sourceHash,
  });
  assert.equal(panel('jianma','assembled').storageKey(),panel('jianma','shadowed').storageKey());
  assert.notEqual(panel('jianma','assembled').storageKey(),panel('another','assembled').storageKey());
});
