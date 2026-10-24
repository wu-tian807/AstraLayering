import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { traceReplayWindow, traceWindow } from '../evidence.ts';

async function fixture(records:any[], run:(directory:string)=>Promise<void>) {
  const directory=await mkdtemp(join(tmpdir(),'astra-replay-input-'));
  try {
    await mkdir(join(directory,'support-reverse'));
    await writeFile(join(directory,'support-reverse/trace.jsonl.gz'),gzipSync(records.map(row=>JSON.stringify(row)+'\n').join('')));
    await run(directory);
  } finally { await rm(directory,{recursive:true,force:true}); }
}
const records=Array.from({length:5},(_,step)=>({step,time:step/120,sourcePose:{x:Math.sin(step*.13),y:0,angle:step*.0007},airflow:{x:Math.cos(step*.17),y:Math.sin(step*.19)},components:{cloth:{positions:[step+.125,step+.375]}}}));

test('replay preserves every exact command before sparse, reordered output samples',async()=>{
  await fixture(records,async directory=>{
    const replay=await traceReplayWindow(directory,'support-reverse',[4,1]);
    assert.deepEqual(replay.rows,[records[4],records[1]]);
    assert.deepEqual(replay.inputs,records.map(({sourcePose,airflow})=>({sourcePose,airflow})));
    assert.deepEqual(await traceWindow(directory,'support-reverse',[1]),[records[1]]);
  });
});
test('replay rejects missing, nonfinite and discontinuous commands instead of replacing outputs',async()=>{
  for(const invalid of [
    records.map(({airflow,...row})=>row),
    records.map((row,step)=>step===2?{...row,sourcePose:{...row.sourcePose,x:null}}:row),
    records.map((row,step)=>step===2?{...row,step:3}:row),
    records.slice(0,4),
  ])await fixture(invalid,async directory=>{
    await assert.rejects(traceReplayWindow(directory,'support-reverse',[4]),/逐步输入|轨迹不完整/);
  });
});
