// Configuration keys used to start with layering_. An old spelling is still
// read as the same key, and the current spelling wins within one source.
export const legacyPrefix = 'layering_';

export function withLegacyKeys<T extends Record<string, string | undefined>>(source: T): T {
  const result: Record<string, string | undefined> = { ...source };
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith(legacyPrefix) && result[key.slice(legacyPrefix.length)] === undefined) result[key.slice(legacyPrefix.length)] = value;
  }
  return result as T;
}
