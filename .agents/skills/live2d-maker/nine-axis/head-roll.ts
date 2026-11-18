import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HEAD_ROLL_LIMIT, validateHeadNineAxis, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { angleParameter } from './angles.ts';
import { readUpstream } from './continuation.ts';
import { writeBuilt } from './head.ts';
import { wholeHeadScope } from './head-controls.ts';
import { ownsNode, withinPart } from './ownership.ts';
import { modelDocument } from './source.ts';

export function prepareHeadRoll(upstream: HeadNineAxis): HeadNineAxis {
  const upperNeck = upstream.parts.find(part => part.id === 'neck/upper');
  const neck = upperNeck ?? upstream.parts.find(part => part.id === 'neck');
  if (!neck) throw Error('头部 Z 轴缺少颈部接点，请检查下颌步骤的颈部图层');
  const [x, y, width, height] = neck.textureBounds;
  const parts = upstream.parts.filter(part => !part.context && !withinPart(part.id, 'neck') && ownsNode(upstream, part, wholeHeadScope)).map(part => part.id);
  return validateHeadNineAxis({
    ...upstream,
    parameters: [...(upstream.parameters ?? []), angleParameter('ParamAngleZ', '角度 Z', [-HEAD_ROLL_LIMIT, HEAD_ROLL_LIMIT])],
    headRoll: { pivot: [x + width / 2, upperNeck ? y + height : y], parts },
  });
}

export async function finishHeadRoll(directory: string, upstreamDirectory: string, taskRoot: string) {
  const { doc: upstream } = await readUpstream(upstreamDirectory);
  const document = await modelDocument(taskRoot, upstreamDirectory, upstream);
  if (!document || !await stat(document).then(info => info.isFile(), error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  })) throw Error('头部 Z 轴缺少四角模型引用的 KRA');
  const doc = prepareHeadRoll(upstream), textures = new Map<string, string>();
  for (const part of doc.parts) {
    if (part.texture && !part.uuid && part.material !== 'transparent') textures.set(part.texture, join(upstreamDirectory, part.texture));
  }
  await writeBuilt(directory, { doc, textures });
}
