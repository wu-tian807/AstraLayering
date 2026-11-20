import { registerHooks } from 'node:module';

// Only test processes import this hook. Subprocess fixtures can substitute the
// runtime builder without a production environment variable or a real build.
const build = new URL('../../patches/codex/build.ts', import.meta.url).href;
const marker = 'export async function ensurePatchedCodex(options: Options = {}, services: Services = {}): Promise<string> {';
const upscale = new URL('../upscayl.ts', import.meta.url).href;
const upscaleMarker = '}: InstallServices = {}): Promise<string> {';
const upscaleEnvironment = new URL('../upscale-environment.ts', import.meta.url).href;
const environmentMarker = 'export async function probeUpscaleEnvironment(): Promise<UpscaleEnvironment> {';
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url !== build && url !== upscale && url !== upscaleEnvironment) return result;
    const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source as Uint8Array).toString('utf8');
    if (url === upscaleEnvironment) {
      if (!source.includes(environmentMarker)) throw new Error('Upscayl test environment signature changed');
      return { ...result, source: source.replace(environmentMarker, environmentMarker +
        '\n  if (process.env.ASTRA_TEST_UPSCALE_UNAVAILABLE) return { supported: false, reason: "GPU fixture" };' +
        '\n  if (process.env.ASTRA_TEST_UPSCAYL) return { supported: true };') };
    }
    if (url === upscale) {
      if (!source.includes(upscaleMarker)) throw new Error('Upscayl test installer signature changed');
      return { ...result, source: source.replace(upscaleMarker, upscaleMarker +
        '\n  if (process.env.ASTRA_TEST_UPSCALE_UNAVAILABLE) throw new Error("unexpected Upscayl download");' +
        '\n  if (process.env.ASTRA_TEST_UPSCAYL) return process.env.ASTRA_TEST_UPSCAYL;') };
    }
    if (!source.includes(marker)) throw new Error('Codex test runtime builder signature changed');
    return { ...result, source: source.replace(marker, marker + '\n  if (process.env.ASTRA_TEST_CODEX_EXECUTABLE) return process.env.ASTRA_TEST_CODEX_EXECUTABLE;') };
  },
});
