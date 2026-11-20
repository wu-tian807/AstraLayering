import type { PreparationProgress } from './preparation-progress.ts';

type DownloadOptions = {
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  maxBytes?: number;
  progress?: (bytes: NonNullable<PreparationProgress['bytes']>) => void;
};

export async function downloadBytes(url: string, { signal, idleTimeoutMs, maxBytes, progress }: DownloadOptions = {}): Promise<Buffer> {
  const inactivity = idleTimeoutMs === undefined ? undefined : new AbortController();
  const requestSignal = inactivity && signal ? AbortSignal.any([signal, inactivity.signal]) : inactivity?.signal ?? signal;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let total: number | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let received = 0, last = 0;
  const resetIdleTimer = () => {
    if (idleTimeoutMs === undefined) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const bytes = total === undefined ? String(received) : `${received} / ${total}`;
      inactivity?.abort(new Error(`下载超时（连续 ${idleTimeoutMs / 1000} 秒没有收到新数据，已下载 ${bytes} 字节）：${url}`));
    }, idleTimeoutMs);
  };
  resetIdleTimer();

  try {
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）：${url}`);
    const length = Number(response.headers.get('content-length'));
    total = Number.isSafeInteger(length) && length > 0 && !response.headers.has('content-encoding') ? length : undefined;
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength) resetIdleTimer();
      received += chunk.value.byteLength;
      if (maxBytes !== undefined && received > maxBytes) throw new Error('下载文件超出预期大小。');
      chunks.push(chunk.value);
      if (Date.now() - last >= 500) {
        last = Date.now();
        progress?.({ received, total });
      }
    }
    requestSignal?.throwIfAborted();
    progress?.({ received, total });
    return Buffer.concat(chunks, received);
  } catch (error) {
    // Fetch can report a generic AbortError when the response body has already started.
    if (inactivity?.signal.aborted) requestSignal?.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(idleTimer);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
