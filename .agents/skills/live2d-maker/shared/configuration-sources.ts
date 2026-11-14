import { withLegacyKeys } from './legacy-keys.ts';

export const scalarConfigurationKeys=[
  ...['codex','claude','agv'].flatMap(h=>['api_key','base_url','models'].map(key=>`${h}_${key}`)),
  'claude_path','agv_path','codex_home','agv_protocol','agv_unlimited_response_header_timeout','agv_minimal_thinking_level',
  'image_compact_threshold',...['codex','claude','agv'].flatMap(h=>[`${h}_image_compact_threshold`,`${h}_request_compact_mib`]),
  'agv_image_deduplicate','claude_image_deduplicate','krita_max_instances','update_check','DISPLAY','WAYLAND_DISPLAY','QT_QPA_PLATFORM',
  'openai_image_models','google_image_models','openai_image_base_url','openai_image_api_key','google_image_base_url','google_image_api_key','google_image_protocol',
  'video_provider','video_base_url','video_api_key','nine_axis_view_video_model',
];

// A blank value means unconfigured. Keep unrelated empty process variables
// (notably PATH) intact when constructing the child environment.
export function configurationSources(file:NodeJS.ProcessEnv, environment:NodeJS.ProcessEnv, defaults:NodeJS.ProcessEnv={}) {
  const nonempty=(source:NodeJS.ProcessEnv)=>Object.fromEntries(Object.entries(source).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&!!entry[1].trim()));
  const local=withLegacyKeys(nonempty(file));
  const configuredEnvironment=withLegacyKeys(nonempty(environment)),startup={...environment,...configuredEnvironment};
  const select=(keys:readonly string[])=>{for(const [source,values] of [['file',local],['environment',configuredEnvironment]] as const)for(const key of keys)if(values[key]?.trim())return {key,value:values[key]!.trim(),source};};
  return {select,file:local,environment:startup,effective:{...startup,...defaults,...configuredEnvironment,...local}};
}
