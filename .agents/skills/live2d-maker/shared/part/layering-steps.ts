import type { AgentSession, CodexAgents } from '../codex/agents.ts';
import { recognizeInitialGroups } from './initial-groups.ts';
import { drawGroupOutline, reviewGroupOutline } from './outline-agent.ts';
import { reduceGroupOutlines } from './outline-reduce.ts';
import { completeGroupOcclusion, checkGroupCompletion } from './completion-agent.ts';
import { analyzeChildren } from './children-agent.ts';
import { planPartOcclusion } from './occlusion-agent.ts';
import type { LayeringSteps } from './layering-types.ts';
import type { GroupContext } from './layering-types.ts';
import { discardedSessionReason } from '../codex/checked-turn.ts';
import { clearStepSession, readStepSession, writeStepSession, type StepSession } from '../agents/step-session.ts';
import type { Harness } from '../agents/models.ts';
import { groupStepId } from './part-steps.ts';

// 补形与子组分析使用只读 agent，经工具提交后由程序验证并发布事实。
export function createLayeringSteps(agents: Pick<CodexAgents, 'run'> & Partial<Pick<CodexAgents, 'createSession'>>): LayeringSteps {
  // Request/session data is separate from artwork. Resetting a step clears
  // its saved session too; continuation retains both session and workspace.
  const sessions = new Map<string, AgentSession>();
  async function stepSession(context: GroupContext, step: 'outline' | 'completion'): Promise<AgentSession> {
    const key = groupStepId(context.group.id, step);
    let session = sessions.get(key);
    if (!session) {
      if (!agents.createSession) throw new Error('轮廓绘制和补全需要可复用的 agent 会话');
      // The same per-step session store as raster steps (step-session.ts).
      let saved: StepSession = await readStepSession(context.directory, key) ?? {};
      const persist = async (threadId: string | null, harness?: Harness) => {
        const next = { threadId: threadId || undefined, harness: harness || saved.harness };
        if (next.threadId === saved.threadId && next.harness === saved.harness) return;
        await writeStepSession(context.directory, key, next);
        saved = next;
      };
      const inner = agents.createSession(saved.threadId, {
        resumeHarness: saved.harness,
        onSessionStarted: persist,
        onThreadReplacement: async () => persist(null),
      });
      session = { close: () => inner.close(), async run(task, signal) {
        try {
          const result = await inner.run(task, signal);
          if (result.threadId) await persist(result.threadId, result.harness);
          return result;
        } catch (error) {
          if (error && typeof error === 'object' && 'threadId' in error && typeof error.threadId === 'string') await persist(error.threadId);
          throw error;
        }
      } };
      sessions.set(key, session);
    }
    return session;
  }
  // A thread whose checks could not be repaired is dropped from the saved session, so 继续
  // keeps the draft and products but starts a new thread instead of the stuck one.
  async function discardSession(context: GroupContext, step: 'outline' | 'completion', error: unknown) {
    const reason = discardedSessionReason(error);
    if (reason) await clearStepSession(context.directory, groupStepId(context.group.id, step), reason);
  }
  async function closeSession(context: GroupContext, step: 'outline' | 'completion') {
    const key = groupStepId(context.group.id, step), session = sessions.get(key);
    sessions.delete(key);
    await session?.close();
  }
  return {
    async close() {
      const open = [...sessions.values()];
      sessions.clear();
      await Promise.allSettled(open.map(session => session.close()));
    },
    initialGroups: async context => ({ status: 'completed', output: await recognizeInitialGroups(context, agents) }),
    drawOutline: async context => {
      try { return { status: 'completed', output: await drawGroupOutline(context, await stepSession(context, 'outline')) }; }
      catch (error) { await closeSession(context, 'outline'); await discardSession(context, 'outline', error); throw error; }
    },
    reviewOutline: async context => {
      try { return await reviewGroupOutline(context, agents, await stepSession(context, 'outline')); }
      catch (error) { await discardSession(context, 'outline', error); throw error; }
      finally { await closeSession(context, 'outline'); }
    },
    reduceOutlines: async context => ({ status: 'completed', output: await reduceGroupOutlines(context, agents) }),
    completeOcclusion: async context => {
      try { return { status: 'completed', output: await completeGroupOcclusion(context, await stepSession(context, 'completion')) }; }
      catch (error) { await discardSession(context, 'completion', error); throw error; }
      finally { await closeSession(context, 'completion'); }
    },
    checkCompletion: async context => ({ status: 'completed', output: await checkGroupCompletion(context) }),
    splitChildren: async context => ({ status: 'completed', output: await analyzeChildren(context, agents) }),
    planOcclusion: context => planPartOcclusion(context, agents),
  };
}
