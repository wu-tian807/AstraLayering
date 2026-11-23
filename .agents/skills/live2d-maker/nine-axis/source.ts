import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fromTaskPath, toTaskPath } from '../shared/task-paths.ts';
import type { HeadNineAxis } from '../shared/nine-axis-model.js';

export const editableKra = (directory: string) => join(directory, 'character-nine-axis.kra');
export const exists = (file: string) => access(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });

/** Sources follow the author model's saved KRA reference. */
export function modelDocument(root: string, doc: HeadNineAxis): string | undefined {
  return doc.source?.document ? fromTaskPath(root, doc.source.document) : undefined;
}

export function withDocument(doc: HeadNineAxis, root: string, document: string): HeadNineAxis {
  const source = doc.source, path = toTaskPath(root, document);
  if (source?.document === path) return doc;
  return { ...doc, source: { document: path,
    ...(source && source.document !== path ? { geometryDocument: source.geometryDocument ?? source.document }
      : source?.geometryDocument ? { geometryDocument: source.geometryDocument } : {}) } };
}

export async function modelVersion(root: string, doc: HeadNineAxis, version: string) {
  const document = modelDocument(root, doc);
  if (!document) return version;
  const info = await stat(document);
  return `${version}|${toTaskPath(root, document)}:${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
}
