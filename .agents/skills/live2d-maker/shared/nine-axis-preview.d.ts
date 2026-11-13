import type { HeadNineAxis, HeadDeformer, HeadLevel, NineAxisCapabilities } from './nine-axis-model.js';
export type PreviewMode = { id: HeadLevel; title: string; label: string; available: boolean; axes: NineAxisCapabilities; scope: Set<string> };
export type PreviewSelection = { level: HeadLevel; unlocked: HeadLevel[] };
export const previewLevels: { id: HeadLevel; title: string; label: string }[];
export function authoredPreviewPart(part: Pick<HeadDeformer, 'id'>): boolean;
export function nineAxisPreviewModes(doc: HeadNineAxis, allowPlane?: boolean): PreviewMode[];
export function nextPreviewSelection(previous: PreviewSelection | null | undefined, modes: PreviewMode[]): PreviewSelection;
