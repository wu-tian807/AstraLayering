import type { WorkflowEnvironment } from './codex/environment.ts';
export const videoProviders = ['volcengine','openrouter','openai'] as const;
export type VideoProvider = typeof videoProviders[number];
export type VideoApi = {provider:VideoProvider;baseUrl:string;apiKey:string;model:string};
export const videoModels = ['doubao-seedance-2-5-260628','doubao-seedance-2-0-260128',
  'doubao-seedance-2-0-fast-260128','doubao-seedance-2-0-mini-260615',
  'bytedance/seedance-2.0','seedance-2.5','seedance-2','seedance-2-fast','seedance-2-mini'] as const;
export function videoProvider(value:string):VideoProvider {
  if(!(videoProviders as readonly string[]).includes(value))throw new Error(`video_provider 仅支持 ${videoProviders.join(' / ')}。`);
  return value as VideoProvider;
}
export function videoModel(value:string):string {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value))throw new Error('nine_axis_view_video_model 需要填写服务支持的模型 ID。');
  return value;
}
export function requireVideoApi(environment:Pick<WorkflowEnvironment,'videoApi'>):VideoApi {
  if(!environment.videoApi)throw new Error('头部九轴需要生视频接口：请填写 video_provider、video_base_url、video_api_key 与 nine_axis_view_video_model。');
  videoProvider(environment.videoApi.provider);videoModel(environment.videoApi.model);
  return environment.videoApi;
}
