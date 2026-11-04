import { fileURLToPath } from 'node:url';
import type { PartProfile } from '../shared/part/profile.ts';

export const profile: PartProfile = {
  toolsDirectory: fileURLToPath(new URL('tools/', import.meta.url)),
  id: 'part-layering'
};
