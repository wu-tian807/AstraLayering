export type ToolContent =
  | { type: 'inputText'; text: string }
  | { type: 'inputImage'; imageUrl: string };

export type ToolResult = { contentItems: ToolContent[]; success: boolean };

export type FunctionTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(argumentsValue: unknown, signal: AbortSignal): Promise<ToolResult>;
};

export function textResult(value: unknown): ToolResult {
  return { success: true, contentItems: [{ type: 'inputText', text: JSON.stringify(value) }] };
}
