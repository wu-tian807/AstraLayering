import type { InitialContext } from './layering-types.ts';

export type PartProfile = {
  id: 'part-layering' | 'clothing-part-layering';
  toolsDirectory?: string;
};

export function partProfile(context: Pick<InitialContext, 'profile'>): PartProfile {
  if (!context.profile) throw new Error('绘制步骤缺少管线配置（提示词、工具定义与参考语义）。');
  return context.profile;
}
