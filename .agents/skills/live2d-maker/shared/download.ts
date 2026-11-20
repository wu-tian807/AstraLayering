import type { PreparationProgress } from './preparation-progress.ts';

type DownloadOptions = {
  signal?: AbortSignal;
  maxBytes?: number;
  progress?: (bytes: NonNullable<PreparationProgress['bytes']>) => void;
};

export async function downloadBytes(url: string, { signal, maxBytes, progress }: DownloadOptions = {}): Promise<Buffer> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）：${url}`);
  const length = Number(response.headers.get('content-length'));
  const total = Number.isSafeInteger(length) && length > 0 && !response.headers.has('content-encoding') ? length : undefined;
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let received = 0, last = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (maxBytes !== undefined && received > maxBytes) throw new Error('下载文件超出预期大小。');
      chunks.push(chunk.value);
      if (Date.now() - last >= 500) {
        last = Date.now();
        progress?.({ received, total });
      }
    }
    progress?.({ received, total });
    return Buffer.concat(chunks, received);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
