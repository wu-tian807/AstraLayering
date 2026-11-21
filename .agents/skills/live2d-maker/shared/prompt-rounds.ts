export type PromptRound = { id: string; prompts: readonly string[] };

export function isPromptRounds(value: unknown): value is PromptRound[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const round of value) {
    if (!round || typeof round !== 'object' || Object.keys(round).length !== 2 ||
        typeof round.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(round.id) || ids.has(round.id) ||
        !Array.isArray(round.prompts) || !round.prompts.length ||
        !round.prompts.every((file: unknown) => typeof file === 'string' && file.length > 0)) return false;
    ids.add(round.id);
  }
  return true;
}
