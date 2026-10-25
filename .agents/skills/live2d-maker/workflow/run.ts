import { shadowMode } from '../shared/shadow.ts';
import { fork } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { directoryFor, pipelineId, taskStatus, type TaskOptions } from './state.ts';
import { lastLog, runTask } from './runner.ts';
import { replaceThread } from './recovery.ts';
import { taskLogName } from './log.ts';

export const help = [
  'live2d-maker — 制作、后台运行与恢复整条管线',
  '',
  '首次：pnpm start --name <任务名> --image <参考图> --krita <可执行文件> --background',
  '续跑：pnpm start --name <任务名> --background',
  '进度：pnpm start --name <任务名> --status [--json]',
  '--dir <绝对路径> 指定运行根目录，任务记录在 <dir>/<name>/run.json。',
  '--from / --to <管线> 选择连续范围，默认从人物 part 到阴影制作。',
  '管线：part-layering、raster-layering、clothing-part-layering、clothing-raster-layering、character-assembly、shadow、physics',
  '--shadow-mode mask|normal-depth 选择阴影路线，首次默认 mask；续跑省略沿用保存值。',
  '--physics 开启末尾物理工作流；--physics-profile primary|all（默认 primary）。--no-physics 显式关闭。',
  '--physics-reference <认可配置.json> 为物理提供明确的初始化／运动目标，续跑沿用。',
  '--jobs <正整数> part 的 agent 并发，默认 3。',
  '--standard 在人物 preparation 中先判断姿态，必要时生成 standard.png；默认关闭，仅复制原图。',
  '续跑省略选项则沿用已保存配置；--no-standard 显式关闭。切换选项须通过 preparation 指纹检查。',
  '省略 --background 则在前台执行；总入口不会自行创建定时任务。',
  '',
  '恢复损坏的绘制会话（先确认任务已停止，保留产物和标记）：',
  'pnpm start --name <任务名> --replace-thread <raster管线、character-assembly、shadow或physics> --handoff <交接.md> --reason <原因>',
  '此命令只准备恢复；之后用正常续跑命令启动。相对输入路径均以 <dir>/<name> 为基准。',
].join('\n');

export function parseArguments(args: string[]) {
  const { values } = parseArgs({ args, options: {
    name: { type: 'string' }, dir: { type: 'string' }, image: { type: 'string' }, krita: { type: 'string' },
    physics: { type: 'boolean' }, 'no-physics': { type: 'boolean' }, 'physics-profile': { type: 'string' }, 'physics-reference':{type:'string'}, 'shadow-mode': { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, jobs: { type: 'string' },
    standard: { type: 'boolean' }, 'no-standard': { type: 'boolean' },
    background: { type: 'boolean' }, 'background-worker': { type: 'boolean' },
    status: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    'replace-thread': { type: 'string' }, handoff: { type: 'string' }, reason: { type: 'string' },
  }, strict: true, allowPositionals: false });
  if (values.help) return { mode: 'help' as const };
  if (!values.name) throw new Error('请提供 --name <任务名>。');
  if (values.standard && values['no-standard']) throw new Error('--standard 与 --no-standard 不能同时使用。');
  if (values.physics && values['no-physics']) throw Error('--physics 与 --no-physics 不可同时使用');
  if (values['physics-profile'] && !['primary','all'].includes(values['physics-profile'])) throw Error('物理范围必须为 primary 或 all');
  const options: TaskOptions = { name: values.name, dir: values.dir, image: values.image, krita: values.krita,
    physicsEnabled: values['no-physics'] ? false : values.physics, physicsProfile: values['physics-profile'] as TaskOptions['physicsProfile'],
    physicsReference:values['physics-reference'],
    standard: values['no-standard'] ? false : values.standard,
    shadowMode: values['shadow-mode'] === undefined ? undefined : shadowMode(values['shadow-mode']),
    from: values.from ? pipelineId(values.from) : undefined, to: values.to ? pipelineId(values.to) : undefined,
    jobs: values.jobs === undefined ? undefined : Number(values.jobs) };
  directoryFor(options);
  if (options.jobs !== undefined && (!Number.isSafeInteger(options.jobs) || options.jobs < 1)) throw new Error('--jobs 必须为正整数。');
  if ([values.background, values['background-worker'], values.status, values['replace-thread'] !== undefined].filter(Boolean).length > 1) {
    throw new Error('--background、--status 和 --replace-thread 不能同时使用。');
  }
  if (values.json && !values.status) throw new Error('--json 只能与 --status 一起使用。');
  if ((values.handoff || values.reason) && !values['replace-thread']) throw new Error('--handoff / --reason 只能与 --replace-thread 一起使用。');
  if (values.status || values['replace-thread']) {
    if (values.image || values.krita || values.from || values.to || values.jobs || options.standard !== undefined || options.shadowMode !== undefined) throw new Error('查询或替换 thread 时不修改启动配置。');
  }
  if (values['replace-thread']) {
    if (!values.handoff || !values.reason?.trim()) throw new Error('请提供 --handoff <交接.md> 和 --reason <原因>。');
    return { mode: 'replace' as const, options, pipeline: pipelineId(values['replace-thread']), handoff: values.handoff, reason: values.reason };
  }
  return { mode: values.status ? 'status' as const : values.background ? 'background' as const : 'run' as const,
    options, json: values.json, worker: values['background-worker'] };
}

export async function startBackground(options: TaskOptions): Promise<number> {
  const directory = directoryFor(options);
  await mkdir(directory, { recursive: true });
  const log = await open(join(directory, taskLogName), 'a', 0o600);
  const args = ['--background-worker', '--name', options.name];
  if (options.shadowMode !== undefined) args.push('--shadow-mode', options.shadowMode);
  if (options.physicsEnabled !== undefined) args.push(options.physicsEnabled ? '--physics' : '--no-physics');
  if (options.physicsProfile) args.push('--physics-profile', options.physicsProfile);
  if (options.physicsReference) args.push('--physics-reference', options.physicsReference);
  if (options.standard !== undefined) args.push(options.standard ? '--standard' : '--no-standard');
  for (const key of ['dir', 'image', 'krita', 'from', 'to', 'jobs'] as const) {
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
      for (const stage of status.pipelines) console.log(stage.id + '：' + (stage.status ?? 'pending')
        + (stage.threadId ? '；threadId=' + stage.threadId : '') + '\n  ' + stage.steps.map(step => step.name + '=' + step.status).join(' '));
      if (status.error) console.log('错误：' + status.error);
      if (status.lastMessage) console.log('最近消息：' + status.lastMessage);
      console.log('日志：' + status.log);
      if (status.output) console.log('交付：' + status.output);
    }
  } else if (parsed.mode === 'replace') {
    console.log('交接已保存：' + await replaceThread({ ...options, pipeline: parsed.pipeline, handoff: parsed.handoff, reason: parsed.reason })
      + '\n产物和标记已保留；请用总入口继续运行。');
  } else if (parsed.mode === 'background') {
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
