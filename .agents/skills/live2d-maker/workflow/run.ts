import { shadowMode } from '../shared/shadow.ts';
import { fork } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { fromTaskPath } from '../shared/task-paths.ts';
import { directoryFor, sectionId, taskStatus, type TaskOptions } from './state.ts';
import { lastLog, runTask } from './runner.ts';
import { requestTaskStop } from './control.ts';
import { preflightKrita } from './krita.ts';
import { applyStepAction, applyTaskAction } from './step-actions.ts';
import { taskLogName } from './log.ts';

export const help = [
  'live2d-maker — 制作、后台运行与恢复整条管线；与网页工作台的操作一一对应',
  '',
  '开始制作：pnpm start --name <任务名> --image <参考图> --krita <可执行文件> [--background]',
  '继续：    pnpm start --name <任务名> [--continue] [--background]   保留产物与会话，从中断处继续运行',
  '恢复：    pnpm start --name <任务名> --resume [--background]       清除会话、保留产物，在新会话中继续运行',
  '重试：    pnpm start --name <任务名> --retry [--background]        删除中断 / 失败及已完成但缺少交付的步骤的产物、会话与 agent 尝试记录后重做',
  '停止：    pnpm start --name <任务名> --stop                        停止运行，保留产物与续跑记录',
  '进度：    pnpm start --name <任务名> --status [--json]',
  '导出成果：pnpm export --name <任务名> [--dir <运行根目录>] [--output <目录或.zip>]',
  '',
  '继续、恢复、重试作用于所有中断或失败的步骤，然后按保存的路线运行；没有这类步骤时继续即从未完成处续跑。',
  '--section <管线> --step <步骤> 只处理一个步骤（如 step02、step11_completion/head）；只给 --section 时仅可继续。',
  '路线含 Krita（raster、character-assembly、shadow）时，启动前先检查记录的 Krita 路径；不可用则拒绝运行，',
  '  请加 --krita <可执行文件> 重新指定。继续、恢复、重试同样先检查，检查通过后才改动步骤。',
  '',
  '--dir <绝对路径> 指定运行根目录，任务记录在 <dir>/<name>/run.json。',
  '--knowledge <目录> 用该目录完整替换 skill 自带的 knowledge/ 先验知识，不回退；记录在 run.json，续跑省略沿用。',
  '  启动、继续、恢复、重试前先检查其中全部文件，缺失则拒绝运行并写入 workflow.log。',
  '--from / --to <管线> 选择连续范围，默认从人物 part 到阴影制作；只制作一个管线时两者相同。',
  '--live 开启阴影完成后的七步头部九轴；首次默认关闭，续跑沿用，--no-live 显式关闭。',
  '  显式 --from / --to 仍优先限制本次范围。不会另启调度系统。',
  '管线：part-layering、raster-layering、clothing-part-layering、clothing-raster-layering、character-assembly、shadow',
  '--shadow-mode mask|normal-depth 选择阴影路线，首次默认 mask；续跑省略沿用保存值。',
  '--jobs <正整数> 整次运行所有管线（含 raster、组装、阴影）共用的 agent 名额，默认 3；并行管线不增加总并发。',
  '--standard 在人物 preparation 中先判断姿态，必要时生成 standard.png；默认关闭，仅复制原图。',
  '续跑省略选项则沿用已保存配置；--no-standard 显式关闭。切换选项须通过 preparation 指纹检查。',
  '省略 --background 则在前台执行；总入口不会自行创建定时任务。',
].join('\n');

export function parseArguments(args: string[]) {
  const { values } = parseArgs({ args, options: {
    name: { type: 'string' }, dir: { type: 'string' }, image: { type: 'string' }, krita: { type: 'string' }, knowledge: { type: 'string' },
    'shadow-mode': { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, jobs: { type: 'string' },
    standard: { type: 'boolean' }, 'no-standard': { type: 'boolean' }, live: { type: 'boolean' }, 'no-live': { type: 'boolean' },
    background: { type: 'boolean' }, 'background-worker': { type: 'boolean' },
    status: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    continue: { type: 'boolean' }, resume: { type: 'boolean' }, retry: { type: 'boolean' },
    section: { type: 'string' }, step: { type: 'string' }, stop: { type: 'boolean' },
  }, strict: true, allowPositionals: false });
  if (values.help) return { mode: 'help' as const };
  if (!values.name) throw new Error('请提供 --name <任务名>。');
  if (values.standard && values['no-standard']) throw new Error('--standard 与 --no-standard 不能同时使用。');
  if (values.live && values['no-live']) throw new Error('--live 与 --no-live 不能同时使用。');
  const options: TaskOptions = { name: values.name, dir: values.dir, image: values.image, krita: values.krita, knowledge: values.knowledge,
    standard: values['no-standard'] ? false : values.standard,
    live: values['no-live'] ? false : values.live,
    shadowMode: values['shadow-mode'] === undefined ? undefined : shadowMode(values['shadow-mode']),
    from: values.from ? sectionId(values.from) : undefined, to: values.to ? sectionId(values.to) : undefined,
    jobs: values.jobs === undefined ? undefined : Number(values.jobs) };
  directoryFor(options);
  if (options.jobs !== undefined && (!Number.isSafeInteger(options.jobs) || options.jobs < 1)) throw new Error('--jobs 必须为正整数。');
  const actions = (['continue', 'resume', 'retry'] as const).filter(action => values[action]);
  if (actions.length > 1) throw new Error('--continue、--resume 和 --retry 只能选一个。');
  if ((values.section !== undefined || values.step !== undefined) && !actions.length) throw new Error('--section / --step 需与 --continue、--resume 或 --retry 一起使用。');
  if (values.step !== undefined && values.section === undefined) throw new Error('--step 需同时提供 --section。');
  if (values.section !== undefined && values.step === undefined && actions[0] !== 'continue') throw new Error('只给 --section 时仅可 --continue；恢复或重试请用 --step 指定步骤。');
  if ([values.background, values['background-worker'], values.status, values.stop].filter(Boolean).length > 1) {
    throw new Error('--background、--status 和 --stop 不能同时使用。');
  }
  if (actions.length && (values.status || values.stop || values['background-worker'])) {
    throw new Error('--continue、--resume、--retry 不能与 --status 或 --stop 同时使用。');
  }
  if (values.json && !values.status) throw new Error('--json 只能与 --status 一起使用。');
  if (values.status || values.stop) {
    if (values.image || values.krita || values.knowledge || values.from || values.to || values.jobs || options.standard !== undefined || options.shadowMode !== undefined || options.live !== undefined) throw new Error('查询或停止时不修改启动配置。');
  }
  if (values.stop) return { mode: 'stop' as const, options };
  // Without --section the action applies to the whole task; with it and no --step, to that section.
  const action = actions[0] && { action: actions[0], section: values.section === undefined ? undefined : sectionId(values.section), step: values.step ?? '' };
  return { mode: values.status ? 'status' as const : values.background ? 'background' as const : 'run' as const,
    options, json: values.json, worker: values['background-worker'], action };
}

export async function startBackground(options: TaskOptions): Promise<number> {
  const directory = directoryFor(options);
  await mkdir(directory, { recursive: true });
  const log = await open(join(directory, taskLogName), 'a', 0o600);
  const args = ['--background-worker', '--name', options.name];
  if (options.shadowMode !== undefined) args.push('--shadow-mode', options.shadowMode);
  if (options.standard !== undefined) args.push(options.standard ? '--standard' : '--no-standard');
  if (options.live !== undefined) args.push(options.live ? '--live' : '--no-live');
  for (const key of ['dir', 'image', 'krita', 'knowledge', 'from', 'to', 'jobs'] as const) {
    if (options[key] !== undefined) args.push('--' + key, String(options[key]));
  }
  try {
    return await new Promise<number>((resolve, reject) => {
      const child = fork(fileURLToPath(import.meta.url), args, {
        cwd: directory, detached: true, stdio: ['ignore', log.fd, log.fd, 'ipc'],
      });
      let settled = false, failure: Error | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (child.connected) child.disconnect();
        child.unref();
        if (error) reject(error); else resolve(child.pid!);
      };
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish(new Error('后台启动确认超时。请查看 ' + join(directory, taskLogName) + ' 与 --status 后再重试。'));
      }, 30_000);
      child.on('message', value => {
        const message = value as { type?: string; message?: string };
        if (message.type === 'ready') finish();
        else if (message.type === 'failure') failure = new Error(message.message ?? '后台启动失败。');
      });
      child.once('error', error => finish(error));
      child.once('exit', (code, signal) => {
        if (!settled) void lastLog(directory).then(log => finish(failure ?? new Error('后台未启动 (code=' + code + ', signal=' + signal + ')\n' + log)));
      });
    });
  } finally { await log.close(); }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const parsed = parseArguments(args);
  if (parsed.mode === 'help') { console.log(help); return; }
  const { options } = parsed;
  if (parsed.mode === 'status') {
    const status = await taskStatus(options);
    if (parsed.json) console.log(JSON.stringify(status, null, 2));
    else {
      console.log('任务：' + status.directory + '\n状态：' + status.status + '；进程存活：' + status.runnerAlive + '；任务锁：' + status.lockHeld);
      for (const stage of status.sections) console.log(stage.id + '：' + (stage.status ?? 'pending')
        + (stage.threadId ? '；threadId=' + stage.threadId : '') + '\n  ' + stage.steps.map(step => step.name + '=' + step.status).join(' '));
      if (status.error) console.log('错误：' + status.error);
      if (status.lastMessage) console.log('最近消息：' + status.lastMessage);
      console.log('日志：' + status.log);
      if (status.output) console.log('交付：' + fromTaskPath(status.directory, status.output));
    }
    return;
  }
  if (parsed.mode === 'stop') {
    await requestTaskStop(options);
    console.log('已请求停止，将保留产物和续跑记录。');
    return;
  }
  if (parsed.action) {
    // The same order as the workbench: Krita first, so a refused start changes no step.
    await preflightKrita(options);
    console.log(parsed.action.section === undefined ? await applyTaskAction({ ...options, action: parsed.action.action })
      : await applyStepAction({ ...options, section: parsed.action.section, step: parsed.action.step, action: parsed.action.action }));
  }
  if (parsed.mode === 'background') {
    const pid = await startBackground(options);
    console.log('后台总调度已启动，PID=' + pid + '\n任务：' + directoryFor(options) + '\n用相同 --name / --dir 加 --status 查看进度。');
  } else {
    if (parsed.worker && !process.send) throw new Error('--background-worker 是内部启动参数。');
    const controller = new AbortController();
    const interrupt = () => controller.abort(new Error('总调度收到终止信号；保留进度，稍后可续跑。'));
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    try {
      // A Codex build confirms the background start early; its progress goes to the log.
      const ready = () => { if (parsed.worker && process.connected) process.send?.({ type: 'ready' }); };
      await runTask(options, { signal: controller.signal, progress: parsed.worker ? undefined : console.log, preparing: ready, ready });
    } catch (error) {
      if (parsed.worker && process.connected) process.send?.({ type: 'failure', message: formatAgentError(error) });
      throw error;
    } finally {
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
      if (parsed.worker && process.connected) process.disconnect();
    }
  }
}

if (import.meta.main) main().catch(error => { console.error(formatAgentError(error)); process.exitCode = 1; });
