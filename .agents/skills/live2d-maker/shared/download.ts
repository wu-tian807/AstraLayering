import type { PreparationProgress } from './preparation-progress.ts';

type DownloadOptions = {
  signal?: AbortSignal;
  timeout?: { idleMs: number; totalMs: number };
  maxBytes?: number;
  progress?: (bytes: NonNullable<PreparationProgress['bytes']>) => void;
};

export async function downloadBytes(url: string, { signal, timeout, maxBytes, progress }: DownloadOptions = {}): Promise<Buffer> {
  const deadline = timeout ? new AbortController() : undefined;
  const requestSignal = deadline ? (signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal) : signal;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let total: number | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let received = 0, last = 0;
  const abortDownload = (reason: string) => deadline?.abort(new Error(
    `下载超时（${reason}，已下载 ${received}${total === undefined ? '' : ` / ${total}`} 字节）：${url}`));
  const resetIdleTimer = () => {
    if (!timeout) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => abortDownload(`连续 ${timeout.idleMs / 1000} 秒没有收到新数据`), timeout.idleMs);
  };
  const totalTimer = timeout ? setTimeout(() => abortDownload(`总时长达到 ${timeout.totalMs / 1000} 秒`), timeout.totalMs) : undefined;
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
    if (deadline?.signal.aborted) requestSignal?.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
