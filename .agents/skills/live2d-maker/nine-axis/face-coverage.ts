import { createHash } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AngleScale } from './angles.ts';
import type { Built } from './head.ts';
import type { Box } from './turn.ts';
import { createNineAxisViewTool } from './view-tool.ts';

type Stage = 'left' | 'up' | 'down' | 'xy';

// All face directions check the same actual skin alpha. Only the target
// angle, reference frame and file prefix differ. This cannot detect a skin
// window that the agent omitted from its reference-derived mask.
export async function checkFaceCoverage(directory: string, nine: string, stage: Stage, current: Built, box: Box, scale: AngleScale, signal: AbortSignal, referenceDirectory?: string) {
  const bounds = [box.x, box.y, box.size, box.size];
  const targets = stage === 'xy'
    ? [{ prefix: 'left-up-', x: scale.x[0], y: scale.y[1], reference: join(directory, 'left-up.png') },
      { prefix: 'left-down-', x: scale.x[0], y: scale.y[0], reference: join(directory, 'left-down.png') }]
    : [{ prefix: '', x: stage === 'left' ? scale.x[0] : 0, y: stage === 'up' ? scale.y[1] : stage === 'down' ? scale.y[0] : 0,
      reference: referenceDirectory ? join(referenceDirectory, `${stage}.png`) : join(nine, stage === 'left' ? 'step01_video/left.png' : `step01_video/${stage}.png`) }];
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const finalAuthorSha256 = hash(await readFile(join(directory, `face-${stage}.json`)));
  const view = createNineAxisViewTool(nine, join(directory, 'observations'), async () => current);
  for (const target of targets) {
    const mask = join(directory, `${target.prefix}face-coverage.svg`);
    await readFile(mask).catch(error => { throw new Error(`${stage} 缺少 ${target.prefix}face-coverage.svg：先按视频描出可见额头皮肤，不能仅检查闭合脸型`, { cause: error }); });
    const checked = await view.execute({ x: target.x, y: target.y, level: 'face', only: ['face/face_base'], crop: bounds, scale: 1,
      reference: { path: target.reference, bounds }, coverage: { path: mask, bounds },
    }, signal);
    const info = JSON.parse((checked.contentItems[0] as { text: string }).text);
    const report = { x: info.x, y: info.y, crop: info.crop, scale: info.scale, ...info.coverage, finalAuthorSha256,
      referenceSha256: hash(await readFile(target.reference)) };
    await copyFile(report.savedPath, join(directory, `${target.prefix}face-coverage-check.png`));
    await copyFile(report.alphaSavedPath, join(directory, `${target.prefix}face-alpha-check.png`));
    await writeFile(join(directory, `${target.prefix}face-coverage-report.json`), JSON.stringify(report, null, 2) + '\n');
    if (!report.satisfied) throw new Error(`${target.prefix || stage} 可见皮肤覆盖不足：${report.uncoveredPixels} 个像素未被实际脸底覆盖，检查 ${target.prefix}face-coverage-check.png 标红处并修正完整额部`);
  }
}
