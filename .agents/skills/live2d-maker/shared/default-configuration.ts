import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { workflowsDirectory } from './paths.ts';
import { scalarConfigurationKeys } from './configuration-sources.ts';

export type DefaultConfiguration = Readonly<Record<string, string>>;

// The installed skill owns defaults. An alternate environment directory may
// supply its own template; directories containing only .env use this installation.
export function readDefaultConfiguration(directory = workflowsDirectory): DefaultConfiguration {
  let source: string;
  try { source = readFileSync(join(directory, 'example.env'), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || resolve(directory) === resolve(workflowsDirectory)) {
      throw new Error('无法读取 live2d-maker/example.env 默认配置', { cause: error });
    }
    source = readFileSync(join(workflowsDirectory, 'example.env'), 'utf8');
  }
  const configuration=parseEnv(source) as Record<string,string>;
  for(const key of scalarConfigurationKeys)if(!Object.hasOwn(configuration,key))throw new Error(`live2d-maker/example.env 缺少配置字段：${key}`);
  for(const key of ['codex_base_url','claude_base_url','agv_protocol','video_provider','codex_models','claude_models','agv_models','openai_image_models','google_image_models','google_image_protocol','nine_axis_view_video_model','krita_max_instances','update_check','agv_unlimited_response_header_timeout','agv_image_deduplicate','claude_image_deduplicate'])requiredDefault(configuration,key);
  return Object.freeze(configuration);
}

export function requiredDefault(configuration: DefaultConfiguration, key: string): string {
  const value = configuration[key]?.trim();
  if (!value) throw new Error(`live2d-maker/example.env 需要配置默认值：${key}`);
  return value;
}
