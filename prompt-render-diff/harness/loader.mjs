const root = process.env.CAPTURE_ROOT;
export async function load(url, context, next) {
  const result = await next(url, context);
  if (!url.startsWith('file://' + root) || !url.endsWith('.ts') || url.includes('/tests/') || url.includes('node_modules')) return result;
  let source = String(result.source);
  const before = source;
  // Step-level dispatch.
  if (!url.endsWith('/shared/agents/dispatcher.ts'))
    source = source.replace(/(?<![.\w])(agents|inner|session)(!?)\.run\(/g, (m, name, bang) => `globalThis.__capRun(${name}${bang}, `);
  // Transport-level input (after workspacePrompt / continuation wrapping).
  if (url.endsWith('/shared/codex/tool-agent.ts'))
    source = source.replace("const log = await AgentLog.create(", "globalThis.__capRecord('transport', input.map(i => i.type === 'text' ? { text: i.text } : { image: i.path })); const log = await AgentLog.create(");
  if (url.endsWith('/shared/agents/cli.ts'))
    source = source.replace("child.stdin!.end(", "globalThis.__capRecord('transport-cli', input.map(i => i.type === 'text' ? { text: i.text } : { image: true })); child.stdin!.end(");
  if (url.endsWith('/shared/raster/workflow.ts'))
    source = source.replace("const result = await (dependencies.agent ?? runAgent)({", "const result = await globalThis.__capCall(dependencies.agent ?? runAgent, {");
  if (source === before) return result;
  return { ...result, source };
}
