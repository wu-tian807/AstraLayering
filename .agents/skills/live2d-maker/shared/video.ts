import type { VideoApi, WorkflowEnvironment } from './codex/environment.ts';

// Confirmed against the compatible video service's GET /models, 2026-11-10.
export const videoModels = ['seedance-2.5', 'seedance-2', 'seedance-2-fast', 'seedance-2-mini',
  'seedance-2.5-las', 'seedance-2-las', 'seedance-2-fast-las', 'seedance-2-mini-las'] as const;

export function videoModel(value: string): string {
  if (!(videoModels as readonly string[]).includes(value)) throw new Error(`nine_axis_view_video_model 不支持 ${value}；可选：${videoModels.join('、')}。2.0 系列使用 seedance-2。`);
  return value;
}

export function requireVideoApi(environment: Pick<WorkflowEnvironment, 'videoApi'>): VideoApi {
  if (!environment.videoApi) throw new Error('头部九轴需要生视频接口：请在 live2d-maker/.env 填写 video_base_url、video_api_key 与 nine_axis_view_video_model（不使用生图接口）。');
  videoModel(environment.videoApi.model);
  return environment.videoApi;
}
