# part-layering

包含循环与并发骨架、参考准备，以及官方 `@openai/codex-sdk` 的 agent 调度。需要 Node 24.12+，先运行 `pnpm install`，并完成 Codex 登录。

统一入口是 `pnpm start --name <运行名> [--image <角色图片路径>]`，程序使用当前 Codex 登录配置。

使用 SDK 自带的 Codex 运行程序，不需要自行定位 `codex.exe`。创建与运行会话采用官方接口：

```ts
const codex = new Codex();
const thread = codex.startThread({
  model: 'gpt-6.1-sol', modelReasoningEffort: 'xhigh',
});
const result = await thread.run(prompt);
```

首次启动传入 `--image`，原图会复制到 `.run/<运行名>/references/original.<原扩展名>`。续跑只需 `--name`，不依赖原图之前的外部路径。每次启动都检查参考输出，缺少哪一步就执行哪一步；全部存在时不调用 preparation agent。

当前已实现参考准备；组循环的具体步骤仍待配置，配置后由同一入口进入。`runPartLayering()` 的 `hooks` 提供初始化、待执行组扫描和本组一轮执行。

`agents.ts` 的 `CodexAgents.run()` 每次通过 `startThread()` 创建新会话，统一使用 `gpt-6.1-sol / xhigh`，并等待 `thread.run()` 返回。不同调用可以并发，结果按会话隔离。`run.ts` 的 `runPartLayering()` 将参考准备、agent 调用入口和现有组循环接在一起；初始化与组内步骤仍由调用方逐项提供，通过传入的 `agents.run()` 调度。

简化和素体 agent 通过 SDK 配置显式启用 Codex 内置 `image_generation`，以结构化 JSON 返回生成图片的 `savedPath`。程序读取对应的真实文件，检查 PNG 格式，再保存到本次运行的 references 目录；路径缺失、文件不存在或格式不符时抛出错误。判断 agent 使用图片输入和结构化 JSON 输出。

此版尚未接入自定义 function 工具。TS SDK 没有直接注册 TS 回调的 `tools` 接口，后续定义具体工具时再通过其支持的 MCP 配置接入。

简化风格参考位于 `resources/简化参考图片.png`，随角色原图作为第二张图片输入。所有固定提示词和参考资源都来自本模块。

调用 `runWorkflow(input, hooks, { concurrency, maxDepth })`，由调用方提供以下接口：

- `preparation()`：可选，在循环初始化前执行参考准备。
- `initialize(input)`：接收 `null`、单组或组列表；如何初始化暂留空。
- `ready()`：返回当前可执行的组，包含唯一 `id`、组数据和本次运行的相对 `depth`（从 0 开始）。
- `runRound(group)`：执行本组一轮；具体步骤暂留空。

每完成一组就重新扫描待运行组，并立即补上空出的并发位置。相同 `id` 在一次调用中只执行一次。`maxDepth: 1` 只处理深度 0 的组；达到限制的组留给调用方维护。任何回调失败时，停止继续调度，等待已启动的组结束并抛出错误。

入口内部调用 `prepareReferences({ image, runName }, steps)`。`image` 为可选原图路径，输出位于本目录的 `.run/<runName>/references/`：

- `original.<原扩展名>`：首次传入的原图副本，用于续跑和补齐缺失参考。
- `judgment.json`：参考判断结果，包含 `needsSimplification`；存在则读取，不再调用判断。
- `simplified-subject.png`：需要简化时生成；不需要简化时直接复制原图，并保留原图扩展名。目标文件存在则跳过。
- `base-subject.png`：以简化图为输入生成素体参考；存在则跳过。

`steps` 提供 `judge(image, prompt)`、`simplify(inputImage, outputImage, prompt)` 和 `baseSubject(inputImage, outputImage, prompt)` 三个执行接口。每个需要执行的步骤会读取本目录内对应的提示词，并将完整内容作为 `prompt` 传入；跳过的步骤不读取提示词。

- `prompts/1-参考判断.md`
- `prompts/2-简化图片.md`
- `prompts/3-素体参考.md`

图片步骤结束后必须真的存在对应输出文件，否则抛出错误。没有额外完成标记，不生成线稿／素描。

循环内的进度、SVG 合并与各阶段内容仍待逐项定义。
