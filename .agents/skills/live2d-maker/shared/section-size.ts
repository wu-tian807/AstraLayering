export const sectionSizes = ['1K', '2K', '3K', '4K'] as const;
export type SectionSize = typeof sectionSizes[number];

export function sectionSize(value: unknown = '1K'): SectionSize {
  if (!sectionSizes.includes(value as SectionSize)) throw new Error('--size 必须为 1K、2K、3K 或 4K。');
  return value as SectionSize;
}
