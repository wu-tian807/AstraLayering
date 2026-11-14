import {access,readdir} from 'node:fs/promises';
import {join} from 'node:path';

// Count actual requests, independently of session indexes and private CLI data.
export async function requestLogNames(root:string):Promise<string[]> {
  const entries=await readdir(root,{withFileTypes:true});
  const names=await Promise.all(entries.filter(entry=>entry.isDirectory()).map(async entry=>
    await access(join(root,entry.name,'request.json')).then(()=>entry.name,()=>undefined)));
  return names.filter((name):name is string=>!!name);
}
