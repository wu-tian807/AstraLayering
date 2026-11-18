import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The native GenAI route cannot execute dynamic functions directly. Its terminal
// invokes this helper; the gateway restores the original function and result.
const input = JSON.parse(Buffer.from(process.argv[2], 'base64url').toString());
try {
  const response = await fetch(process.env.LAYERING_MCP_URL!, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.LAYERING_MCP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: input.invocation, method: 'tools/call', params: { name: input.name, arguments: input.arguments } }),
  });
  const rpc = await response.json() as any;
  if (!response.ok || rpc.error) throw new Error(rpc.error?.message || `Tool bridge HTTP ${response.status}`);
  const directory = process.env.LAYERING_BRIDGE_RESULTS!;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${input.invocation}.json`);
  await writeFile(path, JSON.stringify({ name: input.name, result: rpc.result }), { mode: 0o600 });
  process.stdout.write(`ASTRA_TOOL_RESULT:${pathToFileURL(path).href.replaceAll("'", "%27")}\n`);
} catch (error) { process.stderr.write(String(error) + '\n'); process.exitCode = 1; }
