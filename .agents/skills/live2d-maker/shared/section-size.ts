export const sectionSizes = ['1K', '2K', '3K', '4K'] as const;
export type SectionSize = typeof sectionSizes[number];

export function sectionSize(value: unknown = '1K'): SectionSize {
  if (!sectionSizes.includes(value as SectionSize)) throw new Error('--size 必须为 1K、2K、3K 或 4K。');
  return value as SectionSize;
}

const pixelsPerTier = 1024;
export const sectionSizePixels = (size: SectionSize) => (sectionSizes.indexOf(size) + 1) * pixelsPerTier;

export function sectionSizeForLongEdge(pixels: number): SectionSize {
  const index = Math.floor(pixels / pixelsPerTier) - 1;
  return sectionSizes[Math.max(0, Math.min(sectionSizes.length - 1, index))]!;
}
