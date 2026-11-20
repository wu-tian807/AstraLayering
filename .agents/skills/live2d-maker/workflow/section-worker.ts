import { readRun, sectionId } from './state.ts';
import { executeSection } from './sections.ts';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { GroupExecutionError } from '../shared/part/layering.ts';
import { formatLayeringSummary } from '../shared/part/run.ts';
import { agentSlotsVariable, ipcAgentSlots } from './agent-slots.ts';
import { releaseAllSectionKrita } from '../shared/krita/section-krita.ts';
import { signalAgentProcesses } from '../shared/agents/cli.ts';

// An orphan must not continue drawing after its supervisor has exited.
process.on('disconnect', () => {
  if (process.platform !== 'win32') process.kill(-process.pid, 'SIGTERM');
  else process.exit(1);
});

// A stop signals the whole process group; close the sections' Krita
// normally first so their profiles and records do not stay behind. Agent
// CLIs sit in groups of their own and are ended explicitly.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  signalAgentProcesses('SIGTERM');
  void releaseAllSectionKrita().finally(() => { signalAgentProcesses('SIGKILL'); process.exit(signal === 'SIGINT' ? 130 : 143); });
});

try {
  const [directory, requested, execution] = process.argv.slice(2);
  const run = await readRun(directory);
  if (!run || run.runner?.id !== execution) throw new Error('总控执行记录已改变，拒绝启动过期子进程。');
  const agentSlots = process.send && process.env[agentSlotsVariable] === 'ipc' ? ipcAgentSlots(process) : undefined;
  const result = await executeSection(sectionId(requested), directory, run, {
    progress: message => console.log(message), agentSlots,
    prepared: () => process.send?.({ type: 'prepared' }),
  });
  process.send?.({ type: 'result', result });
} catch (error) {
  let message = formatAgentError(error);
  if (error instanceof GroupExecutionError) message += '\n' + formatLayeringSummary(error.groups).join('\n');
  console.error(message);
  process.send?.({ type: 'failure', message });
  process.exitCode = 1;
} finally {
  // Some library resources may keep the event loop alive after a logical result.
  // End the worker only after its IPC result has been flushed.
  process.removeAllListeners('disconnect');
  if (process.connected) process.disconnect();
}
