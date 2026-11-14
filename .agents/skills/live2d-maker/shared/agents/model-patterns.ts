import { modelPatternMatches } from '../model-patterns.js';
export { parseModelPatterns, modelPatternMatches } from '../model-patterns.js';

// Exact rules win, then the wildcard rule containing more literal characters.
// Equal rules in different services are ambiguous rather than order-dependent.
export function matchModelService<T extends string>(model:string,catalog:Partial<Record<T,readonly string[]>>,key='模型'):T|undefined {
  const scores=Object.entries(catalog).flatMap(([service,raw])=>{
    const patterns=raw as readonly string[]|undefined;
    const matches=patterns?.filter(pattern=>modelPatternMatches(model,pattern))??[];
    return matches.length?[{service:service as T,score:Math.max(...matches.map(pattern=>pattern.includes('*')?pattern.replaceAll('*','').length:model.length+1))}]:[];
  });
  if(!scores.length)return;
  const maximum=Math.max(...scores.map(item=>item.score)),best=scores.filter(item=>item.score===maximum);
  if(best.length!==1)throw new Error(`${key} 的模型 ${model} 被多个服务的同等规则匹配，请明确归属：${best.map(item=>item.service).join('、')}`);
  return best[0].service;
}
