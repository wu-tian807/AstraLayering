import type { AgentSession, CodexAgents } from './agents.ts';
import { recognizeInitialGroups } from './initial-groups.ts';
import { drawGroupOutline, reviewGroupOutline } from './outline-agent.ts';
import { reduceGroupOutlines } from './outline-reduce.ts';
import { completeGroupOcclusion, checkGroupCompletion } from './completion-agent.ts';
import { analyzeChildren } from './children-agent.ts';
import { planPartOcclusion } from './occlusion-agent.ts';
import type { LayeringSteps } from './layering-types.ts';

// 补形与子组分析使用只读 agent，经工具提交后由程序验证并发布事实。
export function createLayeringSteps(agents: Pick<CodexAgents, 'run'> & Partial<Pick<CodexAgents, 'createSession'>>): LayeringSteps {
  const sessions = new Map<string, AgentSession>();
  function drawing(id: string): AgentSession {
    let session = sessions.get(id);
    if (!session) {
      if (!agents.createSession) throw new Error('轮廓绘制需要可复用的 agent 会话');
      session = agents.createSession();
      sessions.set(id, session);
    }
    return session;
  }
  async function closeGroup(id: string) {
    const session = sessions.get(id);
    sessions.delete(id);
    await session?.close();
  }
  return {
    async close() {
      await Promise.allSettled([...sessions.keys()].map(closeGroup));
    },
    initialGroups: async context => ({ status: 'completed', output: await recognizeInitialGroups(context, agents) }),
    drawOutline: async context => {
      try { return { status: 'completed', output: await drawGroupOutline(context, drawing(context.group.id)) }; }
      catch (error) { await closeGroup(context.group.id); throw error; }
    },
    reviewOutline: async context => {
      try { return await reviewGroupOutline(context, agents, drawing(context.group.id)); }
      finally { await closeGroup(context.group.id); }
    },
    reduceOutlines: async context => ({ status: 'completed', output: await reduceGroupOutlines(context, agents) }),
    completeOcclusion: async context => ({ status: 'completed', output: await completeGroupOcclusion(context, agents) }),
    checkCompletion: async context => ({ status: 'completed', output: await checkGroupCompletion(context) }),
    splitChildren: async context => ({ status: 'completed', output: await analyzeChildren(context, agents) }),
    planOcclusion: context => planPartOcclusion(context, agents),
  };
}
