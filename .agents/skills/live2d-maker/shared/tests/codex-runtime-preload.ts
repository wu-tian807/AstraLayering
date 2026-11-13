import { registerHooks } from 'node:module';

// Only test processes import this hook. Subprocess fixtures can substitute the
// runtime builder without a production environment variable or a real build.
const build = new URL('../../patches/codex/build.ts', import.meta.url).href;
const marker = 'export async function ensurePatchedCodex(options: Options = {}, services: Services = {}): Promise<string> {';
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== build) return result;
    const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source as Uint8Array).toString('utf8');
    if (!source.includes(marker)) throw new Error('Codex test runtime builder signature changed');
    return { ...result, source: source.replace(marker, marker + '\n  if (process.env.ASTRA_TEST_CODEX_EXECUTABLE) return process.env.ASTRA_TEST_CODEX_EXECUTABLE;') };
  },
});
