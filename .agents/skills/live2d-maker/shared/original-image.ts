import sharp from 'sharp';

export const originalImageLimits = { maxEdge: 3840, maxPixels: 8_294_400 } as const;

export async function checkOriginalImage(input: string | Buffer) {
  // Read dimensions without decoding the image, so even oversized inputs get
  // a message with their actual size and a valid replacement size.
  const metadata = await sharp(input, { limitInputPixels: false }).metadata();
  const { width, height } = metadata.autoOrient;
  const { maxEdge, maxPixels } = originalImageLimits;
  const pixels = width * height;
  if (Math.max(width, height) > maxEdge || pixels > maxPixels) {
    const scale = Math.min(maxEdge / Math.max(width, height), Math.sqrt(maxPixels / pixels));
    const suggestedWidth = Math.max(1, Math.floor(width * scale));
    const suggestedHeight = Math.max(1, Math.floor(height * scale));
    throw new Error(`原图分辨率过大（${width}×${height} px）。最长边上限为 ${maxEdge} px，总像素上限为 ${maxPixels.toLocaleString('en-US')}。请等比缩小至约 ${suggestedWidth}×${suggestedHeight} px 后重试。`);
  }
  return metadata;
}
