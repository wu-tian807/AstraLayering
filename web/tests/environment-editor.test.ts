import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEnvEditor } from '../env-editor.js';

test('repeated workbench renders keep one preview/save action and enable discard immediately', async t => {
  class Control {
    dataset:Record<string,string>={}; value=''; textContent=''; disabled=false; tagName='INPUT'; scrollTop=0;
    onclick?:()=>unknown; oninput?:()=>unknown;
    listeners:(()=>unknown)[]=[];
    addEventListener(_name:string,listener:()=>unknown){this.listeners.push(listener);}
    hasAttribute(){return false;}
    async click(){await Promise.all([this.onclick?.(),...this.listeners.map(listener=>listener())]);}
  }
  const input=new Control();input.dataset.envValue='codex_path';
  const save=new Control(),preview=new Control(),discard=new Control(),count=new Control(),main=new Control();
  save.disabled=preview.disabled=discard.disabled=true;
  const controls:Record<string,Control>={'[data-env-save]':save,'[data-env-preview]':preview,'[data-env-discard]':discard,'[data-env-count]':count,'.env-main':main};
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    querySelector:(selector:string)=>controls[selector]??null,
    querySelectorAll:(selector:string)=>selector==='[data-env-value]'?[input]:selector.includes('[data-env-save],')?[save,preview,discard]:[],
  }});
  t.after(()=>original?Object.defineProperty(globalThis,'document',original):Reflect.deleteProperty(globalThis,'document'));
  const source={exists:true,revision:'initial',preview:'codex_path=',fields:[{key:'codex_path',value:'',effective:'',type:'text'}],cli:{},models:[],issues:[]};
  const posts:string[]=[],notices:string[]=[];
  let editor:ReturnType<typeof createEnvEditor>;
  editor=createEnvEditor({get:async()=>source,post:async(path:string,body:any)=>{
    posts.push(path);
    return {...source,revision:path.endsWith('/preview')?'initial':'saved',preview:'codex_path=/local/codex',fields:[{...source.fields[0],value:body.changes.codex_path,effective:body.changes.codex_path}]};
  },toast:(message:string)=>notices.push(message),render:()=>editor.bind()});
  await editor.load();editor.bind();editor.bind();
  input.value='/local/codex';input.oninput?.();
  assert.equal(save.disabled,false);assert.equal(discard.disabled,false);
  await preview.click();editor.bind();editor.bind();
  assert.equal(posts.filter(path=>path.endsWith('/preview')).length,1);
  input.value='';input.oninput?.();assert.equal(save.disabled,true);
  input.value='/local/codex';input.oninput?.();
  await save.click();
  assert.equal(posts.filter(path=>path==='config/environment').length,1);
  assert.ok(notices.includes('配置已保存，下一次启动任务时生效'));
});
