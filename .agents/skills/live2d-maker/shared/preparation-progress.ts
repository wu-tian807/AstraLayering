export type PreparationProgress = {
  tool: 'upscayl' | 'rust' | 'codex';
  state: 'running' | 'completed' | 'failed';
  message: string;
  bytes?: { received: number; total?: number };
};

export type ReportPreparation = (event: PreparationProgress) => void;
export const preparationLogPrefix = '[环境准备] ';

export function preparationMessage(event: PreparationProgress): string {
  const bytes = event.bytes;
  const mib = (count: number) => (count / 1048576).toFixed(1) + ' MiB';
  return event.message + (bytes ? ' · ' + mib(bytes.received) + (bytes.total ? ' / ' + mib(bytes.total) : '') : '');
}
