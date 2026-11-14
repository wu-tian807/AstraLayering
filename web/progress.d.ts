export type ProgressStatus = 'pending' | 'running' | 'throttled' | 'available' | 'done' | 'failed' | 'interrupted' | 'unconfirmed';
export type GroupPhase = 'outline' | 'review' | 'reduction' | 'completion' | 'completionCheck' | 'children';
export type ReviewPhase = 'review-1' | 'repair-1' | 'review-2' | 'repair-2';
export interface ReviewObservation { status: ProgressStatus | 'skipped'; detail: string; reportIndex?: number }
export interface PartReviewRound { round: number; review: ReviewObservation; repair: ReviewObservation }
export interface ProgressGroup {
  webPhases?: Partial<Record<GroupPhase, string>>;
  groups?: ProgressGroup[];
  webReviewRounds?: PartReviewRound[];
}
export interface Artifact {
  path: string;
  label: string;
  kind: 'image' | 'file' | 'video';
  reviewIndex?: number;
  reviewMode?: 'review' | 'repair';
}
export interface ProgressStep {
  id: string;
  title: string;
  status: string;
  children: ProgressStep[];
  note: string;
  childrenMode?: 'alternative' | 'parallel';
  processDirectory?: string;
  rounds?: { id: string; title: string; status: string }[];
  roundNotice?: string;
}
export const groupPhases: [GroupPhase, string][];
export const statusNames: Record<ProgressStatus, string>;
export function displayStatus(status?: string, hasArtifacts?: boolean): ProgressStatus;
export function statusLabel(status?: string): string;
export function groupSummary(group: ProgressGroup): { status: ProgressStatus; text: string };
export function groupPreviewArtifacts(group: ProgressGroup, phaseFiles: Record<GroupPhase, Artifact[]>,
  files: Set<string>, versions?: Record<string, string>): Artifact[];
export function groupStagePreviewArtifacts(phase: 'outline' | 'completion', phaseFiles: Record<GroupPhase, Artifact[]>,
  files: Set<string>, versions?: Record<string, string>): Artifact[];
export function groupReviewSteps(group: ProgressGroup, section: string, groupId: string):
  { id: ReviewPhase; title: string; status: string; detail: string; artifacts: Artifact[] }[];
export function reviewReportText(text: string, item: Artifact): string;
export function groupLayers<T extends { groups?: T[] }>(groups: T[]): T[][];
export function groupArtifacts(section: string, group: { id: string }, depth: number): Record<GroupPhase, Artifact[]>;
export interface ArtifactGroup { id: string; groups?: ArtifactGroup[] }
export function replacementGroupDraft(path: string, section: string, groups: ArtifactGroup[],
  files: Set<string>, versions?: Record<string, string>): Artifact | null | undefined;
export const sectionSteps: ProgressStep[][];
export const stepArtifacts: Record<string, Artifact[]>[];
export function shadowInspectionArtifacts(files: string[]): Artifact[];

export const previousNineAxisSectionSteps: ProgressStep[];
