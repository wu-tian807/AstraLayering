import type { SectionSize } from '../section-size.ts';

export type PreparationInput = { image?: string; runName: string; dir?: string; standard?: boolean; size?: SectionSize };
export type PreparationReferences = {
  directory: string; originalImage?: string; standardImage?: string; simplifiedSubject: string; baseSubject: string;
};
