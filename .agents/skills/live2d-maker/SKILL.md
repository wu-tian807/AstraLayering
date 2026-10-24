---
name: live2d-maker
description: 从角色参考图制作适合 Live2D 后续绑定的人物与衣服分层素材，启动并恢复 Codex、Claude Code 或 Antigravity / Krita 制作管线、跟踪进度和处理异常，交付可编辑 KRA 与 PNG，并可制作 Live2D 投影蒙版或法线／深度贴图。用于让 agent 开始制作、接续已有任务或查看结果；可独立制作组件摆动物理配置与连续动画证据；不导出 Cubism 文件。
---

# Live2D Maker

负责从输入准备、启动管线、持续追踪到交付结果。组件摆动物理见 [physics](physics/README.md)：从 assembled 独立分析、绑定、模拟复核，产出 physics.json；同一工作台预览和编辑，不包含眼睛、胸部果冻。遵循人物与衣服各自已有的绘图提示词、验收要求和审核轮次。阴影制作见 [shadow](shadow/README.md)：默认蒙版，也可选法线／深度；两分支独立恢复，输出素材与跟随／裁切关系，后续由 deformer 绑定。

1. **确定任务。** 区分新制作和续跑，询问缺失的参考图、任务名与工作路径；新任务还要确认是否用 `--standard` 标准化姿态，已说明或续跑有记录时不重复询问。未指定路径时，告知用户实际绝对路径并使用默认的 `<仓库>/.run/<name>/`（独立安装时为 `<skill上一级>/.run/<name>/`）；`--dir` 指定运行根目录，相对输入路径从 `<dir>/<name>/` 解析，数据不得放在 skill 内。
2. **确认配置并检查启动条件。** skill 根目录 `.env` 不存在时，按[推荐模型方案](references/model-presets.md)使用方案 1 默认配置创建；用户已指定方案 2 或自定义时沿用所选方案；已有 `.env` 直接复用，未要求时不覆盖。在实际启动环境执行 `pnpm env:check`（配置预览），再按[安装与前置](references/setup.md)核对实际软件、登录及操作能力；总入口会先执行所选 CLI 的本地版本检查。按[生效配置核对](references/workflow-details.md#生效配置核对)检查模型、CLI、生图选择及各接口的图片数／请求体预算；容量保护和可选无损去重见 [图片容量保护](patches/README.md#图片容量保护)；安装补丁不等于开启保护，已确认的配置在换方案或升级时保留。Codex 自定义生图、图片数或请求体 compact 已开启且未指定补丁入口时，启动会自动构建缓存；AGV 以 `layering_agv_unlimited_response_header_timeout=true` 开启自动准备。补丁源码和构建入口统一在 [patches](patches/README.md)。Codex 构建需要 Rust 1.95.0：缺少时明确提示，在临时目录隔离安装并在构建后清理，不改全局 Rust 或 shell 配置；Git 与平台 C/C++ 编译依赖仍须可用。读取[安装与前置](references/setup.md)，检查登录、生图和 Krita 操作能力。Nano 透明请求由共享生图通道先生成纯色背景图，再仅换背景生成第二张，由 Node／Sharp 差分恢复透明 PNG；无需抠图模型或 Python 包。所有操作 Krita 的 agent 共用[环境与恢复说明](shared/krita/environment.md)，由提示词构建器自动注入，不注册专用 Krita 执行工具。辅助绘图 Python 优先复用宿主，缺少时验证 Krita 内置脚本环境。已有依赖直接复用；缺少 CLI／凭据时说明并询问下一步，缺少 Krita 时先确认桌面或 headless 安装方案，有桌面优先官方原生安装包。
3. **启动或续跑。** 按[总入口与配置](references/workflow-details.md#总入口)使用 `pnpm start`，确认后台启动与当前状态。总控记录在 `<dir>/<name>/run.json`；已有任务用相同名称和运行根目录恢复，活跃任务直接接管监听，避免重复启动。
4. **展示工作台。** 按[工作台启动与连接](references/workbench.md)复用或启动真实前端，核对追踪的是同一任务目录，打开任务页并给用户可访问的链接。独立安装时按该文档补齐网页入口。
5. **持续追踪。** 按[巡检与恢复](references/monitoring.md)创建宿主每 2 小时的检查，主动诊断、整理上下文并重试可恢复故障，直到完成或用户取消。必要时可换 thread，完整保留记录和产物。宿主无定时能力时明确告知，不安装替代定时器；不能只记录故障后等待用户。
6. **交付结果。** 核对 KRA、PNG 和报告，查看合成图，给出实际文件入口及遗留问题，完成或取消后关闭定时检查。具体交付路径见[交付说明](references/workflow-details.md#交付)。

按需读取：指定组、拆分限深或单阶段调试见[单管线操作与验收](references/individual-pipelines.md)；LLM 职责配置和独立生图选择见[模型与 harness](references/agent-models.md)；provider、图片压缩和工具配置见[配置与工作流细节](references/workflow-details.md#codex-环境配置)。

动态提示词只在 Markdown 已声明的 `{变量名}` 位置展开，位置由模板决定。Krita 说明使用各阶段的 `{krita_environment}`；全文有来源路径与开始／结束标记。生图规则、运行信息、恢复与 CLI 说明等均有显式模板，见[提示词模板与动态位置](references/prompt-templates.md)。最终提示词在请求目录 `prompt.md` 和既有阶段记录中可直接审查，不新增执行工具，不修改全局或隐藏系统提示词。
