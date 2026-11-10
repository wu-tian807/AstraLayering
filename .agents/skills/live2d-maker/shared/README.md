# 共享运行时与维护

默认配置统一维护在 skill 根目录的 [example.env](../example.env)，由 `shared/default-configuration.ts` 读取。模型职责与生图默认值由共享模型模块校验、解析；运行时回退、首次生成 `.env` 与 WebUI 使用同一模板。WebUI 依赖 skill，独立 skill 包含完整配置与解析能力。

只有修改提示词／工具、接入 CLI 或诊断共享行为时读取本页；日常执行见 [SKILL.md](../SKILL.md)。

## 工具与模型

工具的 schema 是代码，放在 `shared/tools/<name>/schema.json`（参数为空也保留 json）；`shadow/tools/`、`clothing-part-layering/tools/` 可提供本管线专有或替换的 schema（如 `inspect_shadow_mask`、衣服的 `write_groups`）。工具说明是先验知识，放在 `knowledge/shared/tools/<name>/description.md`，步骤可用 `knowledge/<section>/<stepNN>/tools/<name>/description.md` 替换。每个 agent 实际注册的工具以该步骤 `agent.json` 的 `tools` 为准；程序靠工具收取结果的步骤（如 `write_outline_svg`、`submit_review`）必须列出这些工具，启动检查会拒绝缺项。注册工具时读取本次定义，不保留跨运行缓存；缺少非原生工具实现或 schema 无效直接报错，真正的路径与写入校验在实现中。生图能力也由 tools 中的 imagegen 声明统一控制；未列出则关闭，.env 只选择生图模型与服务，不能授予能力。Codex 使用 codex-native 时按声明设置原生工具开关，使用 GPT／Nano 自定义服务时才建立 patch 路由；其他 CLI 只为已声明的 agent 注册自定义 imagegen 工具。启动及恢复都重新核对声明，旧工具与模型配置不会重新打开未声明的生图能力。review 使用独立 thread 和自己的 tools；repair 续接 main 的绘制 thread，使用同一份 main.tools，repair 只配置提示词。模型、provider 与生图协议见[模型方案与配置](../references/model-presets.md)。

`preview_svg` 的生成图对照参数只在补全阶段开放，section 定义覆盖后仍保留阶段限制。`referenceRegion` 使用生成图坐标选取对应部件，工具将裁片等比居中到 SVG 实际内容范围；`referenceOffset` 使用原图像素微调，各轴上限为部件尺寸的 10%。生成图用 `edge` 检查形状，省略 reference 参数后用默认参考图 `blend` 检查定位；`crop` 仅控制最终查看窗口。生成图对照默认聚焦部件，普通对照默认全画布，输入文件保持原样。读取与预览接受可读本地路径及符号链接，参考图沿用生图工具返回的位置。自定义生图工具 `imagegen` 的 `input_images` 与可选 `output_path` 只接受绝对路径，`output_path` 省略时使用默认生图目录；原生 Codex 生图保留自身保存位置并返回绝对 `savedPath`。两类生图返回或 agent 回复的相对 `savedPath` 直接报错，不按任何目录猜测。

Krita 的用法只写在 [krita 工具说明](../knowledge/shared/tools/krita/description.md)，仅随需要 Krita 的 section 的工具提供，提示词不注入共用环境段落；prompts 与工具说明是运行输入，不是额外使用手册。私有进程、并发名额（`krita_max_instances`，`krita: false` 的步骤不占名额也没有该工具）与显示环境见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。

Codex 的每个回合都经 App Server（`codex app-server`）执行；延续已有 thread 时不能改变工作目录、工具定义、shell 或生图开关，需要改变时新建 thread。Claude／AGV 的工具活动按长度截断后镜像到 `workflow.log`，完整记录在请求目录的 `events.jsonl`。总控并发运行的管线各在独立 worker 进程中，agent 名额由总调度统一按 `--jobs` 分配，跨进程共享。

会话恢复由 CLI 适配层处理。Codex 的 `shared/codex/tool-agent.ts` 为工作流子会话关闭 `features.goals`，防止原生 goal 自动续跑抢先启动回合；恢复时若仍有活动回合，先请求 `turn/interrupt` 并等待该回合的 `turn/completed`（最多 30 秒），再提交原始输入和 outputSchema。若提交仍遇到 `ActiveTurnOutputSchemaMismatch`，重新查询活动回合、中断后立即重试一次；仍不能安全恢复时，由共享的有界会话替换机制保留记录与产物新建 thread，不占用网络退避次数。工具、消息、用量、错误和完成事件必须携带与当前回合匹配的 ID；缺少 ID 时明确报协议错误并结束连接，旧回合的工具与结果不能执行或结束新任务。Claude 使用一次性 `--print --resume` 且禁用定时唤醒工具；AGV 使用 `--conversation`，按当前 user_input 边界核对终态，两者均校验恢复后的会话 ID。共享层只负责错误分类、重试预算与会话替换，不实现某个 CLI 的中断协议。

## 多深度与上游修正

`occlusion.json` v3 每个逻辑 part 只有一条：单深度使用 `level`，多深度使用 `levels: [{ level, region }]`，二者互斥。深度数值唯一，从后往前排序，可用小数插入；v2 单深度仍兼容。多深度表示同动整体跨层，不强制回 part 拆树，实际绘画分片由 raster step01 在 Krita 中实现，保持连接和归属。

step01 绘制与返修对轮廓、隐藏补全、画风和结构负责。读取结构使用内置文件工具，修改分组使用 [edit_groups](../knowledge/shared/tools/edit_groups/description.md)，修改深度使用 [edit_occlusion](../knowledge/shared/tools/edit_occlusion/description.md)。工具校验分组、全部终止节点的深度覆盖及 SVG 引用后保存；终止部件 ID 改变时同时提交完整深度表。版本、方向及上游 sourceHash 由程序管理，图层名与部件的映射写在绘画报告中，并同步对应 SVG、当前 KRA 与预览。

工具校验失败直接向当前 agent 返回具体字段路径与原因，保留原文件，修正参数后再次提交。step01 结束时的额外结构诊断记录为日志“结构检查提示”，供前端查看；这项诊断继续保留完成与后续执行，也保留原有视觉 review 轮数。完成标记表示已通过当前交付检查，结构诊断与视觉检查应分别核对。

各环节的流程工具见 [raster 工具表](../raster-layering/README.md#三步交付)：结构编辑工具仅提供给两套 raster step01 绘制／返修，reviewer 只用框选工具，step02、step03 只用 Krita；需要 Krita 的步骤中，绘制、review 与返修 agent 都另有 `krita` 工具。各 CLI 沿用共用函数工具通道和原有会话恢复能力。职责约定与受控工具校验之外没有写入沙箱：Codex 使用 `danger-full-access`，Claude／AGV 使用 `--dangerously-skip-permissions`。

raster 中断、主动重跑及已进入 raster 的总控续跑保留上游修正。独立重跑 part 会从首次分组与各步骤事实重建树；仅写在根 groups.json 的树结构调整需事先留档核对。来源与审计证据见本页文末。

reviewer 只提交已经观察确认的问题；blocked 仅用于必要输入／工具等执行障碍，不消耗正式质量审核轮数。文件、像素统计与测试不能代替逐层视觉验收。

## 参考图后处理

新生成的 simplified、base-subject 和纯衣服参考以 `standard.png` 为统一画布。真实 alpha 直接保留，Nano 的透明请求由共享生图通道双背景差分恢复，不额外安装 Python 抠图环境；细节、失败留档与局限见 [生图配置](../references/model-presets.md#生图执行与透明处理)。

旧式不透明参考只做 Node 颜色键与去溢色，边缘无可靠背景时保留并记录；它不承担语义分割。不同尺寸用 Sharp 等比缩放并居中透明补边，不裁紧角色；已合格且无需缩放时保留原字节。处理前原图与报告追加保存到 `references/archive/`，归档不参与恢复或完成判断，旧任务已有参考仅校验复用，不重新处理。

## 提示词模板与动态位置

工作流自己提供的任务文字以 `knowledge/` 下的 Markdown 为来源，每步由 `agent.json` 声明拼接的文件与工具。代码不在正文后临时拼接制作要求；占位符单次替换，输入正文或 JSON 数据里的花括号不会再次求值。

每次调用绑定启动时的知识目录；同进程的其他调用不能改变它。Web 全局设置只提供新任务默认值，总控在任务根 run.json 保存本任务的 knowledge、Krita 等参数，已有任务可单独修改，section 每次接收这些启动值。

### 动态位置

步骤提示词只使用以下变量：

| 变量 | 含义 |
| --- | --- |
| `{input}` | 用户上传的原图（扩展名不固定）。 |
| `{group_id}`、`{group_dir}`、`{layer_depth}` | 当前组 ID、组在产物中的目录（含 `children/`）、层号。 |
| `{review_round}` | 当前 review 轮次；返修据此读取对应 review 文件。 |
| `{width}`、`{height}` | 画布尺寸。 |

其余路径一律写成相对任务根目录的 `{uri:…}`，渲染为绝对路径；框架写出的参考图都是固定的 `.png` 路径。`{reference:…}`、`{shared_reference:…}` 指向 knowledge 自带的参考文件。轮廓返修是绘制 thread 的下一轮，指向 `review.json` 中最后一条 review；raster 返修指向对应轮次的 `review-NN.md`。

### 恢复与生图适配

`knowledge/shared/prompts/runtime/` 中的模板是恢复或外层固定句：

| 模板 | 用途 |
| --- | --- |
| `visual-context-summary.md` | 图片历史压缩辅助模型的底层维护指令；缺失或为空时快速报错。 |
| `agent-turn.md` | 所有 CLI 共用的路径约定与工作区说明，无变量。 |
| `interrupted-task.md` | 会话仍可接上时只发这一句。 |
| `outline-repair-resume.md`、`raster-repair-resume.md` | 原 thread 不可用时，代码拼接原绘制任务、这一句固定提示与返修任务。 |
| `image-blocked-*.md` | agent 内部遇到图片被内容策略拦截时的恢复策略：`{images}`、`{count}`、`{stop}`、`{origin}`。 |

生图 API 的外层模板在 `shared/prompts/`：[生图请求](prompts/image-request.md)与 [Nano 纯色背景](prompts/nano-solid-background.md)（`{drawing_prompt}`、`{background_instructions}`、`{background_hex}`）保留原始绘制要求，并为 Nano 透明后处理补充独立的背景要求；[Nano 仅换背景](prompts/nano-background-replacement.md)（`{background_hex}`、`{width}`、`{height}`）在第二次请求仅附第一张原始 RGB 图，保持前景与画布，用双背景差分恢复透明 PNG。

工具说明来自 `knowledge/` 中的 `description.md`，参数来自代码中的 `schema.json`（见[工具与模型](#工具与模型)）；宿主原生工具的定义由宿主提供。模型、API 凭据和构建环境不写进这些制作提示词。

### 查阅实际请求

各请求目录的 `prompt.md` 保存展开后的正文，`request.json` 保存请求参数与输入消息（图片只以路径出现在正文中，不作为附件）。CLI 的 `prompt.md` 保存经过 CLI 外层模板展开后的实际正文。raster 阶段既有 `prompt.md`、review／repair 提示词记录也继续保留。Nano 的 `image-processing/normalization.json` 同时保存原始提示词和 provider 实际提示词。模板和实际请求可以逐项对照；不改全局或隐藏的系统提示词。

## 启动验证

首次使用新的模型方案、CLI 或 provider，以及修改协议适配／工具 schema 后，按本次路线验证。记录版本、实际配置来源、检查结果与日志位置；不能把命令存在、一次 `OK` 或模拟服务器通过写成完整实测。用户要求停管线时不执行真实模型或生图检查。

### 自动检查

从 skill 根目录执行：

```bash
pnpm test:agents
# 修改 TypeScript 后再检查类型；相同源码的通过记录可以复用。
pnpm check
```

`test:agents` 不调用真实模型或生图服务，覆盖以下条件：

| 条件 | 通过标准 |
| --- | --- |
| 方案 1 默认、方案 2 混合与自定义配置 | 全部 LLM 职责和独立生图选择完整；人物／衣服职责共享，但工具和提示词覆盖保留；shell 覆盖、默认回退与旧配置冲突有对应断言 |
| 模型与生图组合 | 所有生图步骤拒绝非 Codex harness 配原生 imagegen；缺少所选生图 URL／key、CLI 或 Codex 生图补丁能力时，启动前明确报错；CLI 本地版本探测能识别文件存在但解释器／动态库缺失的情况 |
| 真实工具目录 | 读取 `shared/tools/`、`shadow/tools/`、`clothing-part-layering/tools/` 的全部 schema.json 与 knowledge 中的 description.md，管线自有工具只出现在该管线的 catalog；不以只含简单字符串的测试工具代替；可空类型、嵌套数组、枚举、数值约束、oneOf 和 additionalProperties 等逐字段保留 |
| Gemini 请求 | 实际 HTTP 适配路径用 parametersJsonSchema 传完整 JSON Schema，不能把 type 数组塞进受限的 parameters；保留 CLI 原生工具；重复准备不重复注册；camelCase／snake_case 原生声明均可处理 |
| 工具调用与返回 | 原参数、null 值、工具说明、文本、全部返回图片及 thought signature 不丢失；下一回合还能恢复上回合的工具结果 |
| Codex 原生生图 | `codex-native` 不注入补丁生图配置；GPT／Nano 使用原生工具；不同请求的路由／模型隔离，保存图片事件与原 thread 续跑保留 |
| 自定义生图协议 | Gemini 原生和 OpenAI 兼容的生图／编辑请求保留提示词与输入图片，输入文件不修改；输出落在请求目录，跨任务路径被拒绝 |
| 会话恢复 | 同 CLI 修改模型／力度恢复原会话；切换 CLI 或会话失效创建替代会话并记录历史，已有产物保留 |
| 故障与状态 | 只按通道给出的结构化错误码判断临时错误并沿用会话重试，错误文本只能否决、不能触发重试；正常退出却无产物展示最后消息；取消、失败及进程退出的总控状态明确，不把已退出进程展示为运行中 |

这些是配置、传输和恢复的自动回归；它们不能证明上游当前授权、API 完整兼容或绘图质量。

### 新环境的真实验证

在实际 `.env`、任务目录及隔离请求环境中执行最小验证，记录哪些是实测，哪些仍是模拟覆盖。测试文件和请求记录放在 `<dir>/<name>/runtime/`，不写入用户全局配置。已通过的同版本、同配置检查不反复执行。

1. **带真实工具测试所选 harness。** 用现有 `CodexAgents`／`runCliTask` 调用路径，载入 `ToolCatalog` 的实际共享及管线覆盖定义。请求必须携带真实 schema，尤其包含 write_groups 的可空 note 和 propose_occlusion 的单／多深度 oneOf；只询问模型是否能回复不算通过。工具回调使用测试数据，不能修改正式成果。
2. **验证调用和续会话。** 让模型实际调用一个无副作用测试工具，核对参数与返回值，再以该 session/threadId 发第二回合。测试工具也包含可空字段，并返回小型测试图片，确认下一回合能读取。纯连通、注册、执行、带图返回、恢复是不同验证项，不能相互替代。
3. **按所选生图方式验证。** 原生 Codex 要确认实际注册 imagegen；自定义服务要使用本次配置的协议、模型与输入图片。首次正式准备步骤产出合格图片后可作为该生图组合的实测证据，记录尺寸／透明通道与实际产物；不能据此宣称另外的模型或协议也通过。无必要不额外生图。
4. **验证所需软件。** 每次启动都对显式 Krita 入口做不启动 Krita 的轻量检查；真实验证由 agent 经本 section 私有 Krita 的 `krita` 工具完成保存 KRA、重新打开和查看／导出图像，脚本运行在 Krita 自带的 Python 中。Linux 无显示时框架启动共享 Xvfb（`-noreset`），已设 `QT_QPA_PLATFORM` 时沿用该设置；使用 Xvfb 时验证它能从工作流环境启动。Nano 双背景处理用已有 Node／Sharp，无抠图模型推理步骤；版本命令不是全部验收。
5. **核对续跑和展示。** 检查总控进程、锁、真实阶段与工作台一致。恢复时核对准备图内容指纹，已完成的步骤不能重新生图。取消后检查任务所属的绘制子进程，不能只看总控 PID 消失。

发现确定的请求格式错误时先修适配并补回归，不用重复重试掩盖。修复不更换用户选定模型、不删产物、不修改绘图提示词与审核轮次。缺少 CLI／凭据的处理和安装确认沿用[安装与前置](../references/setup.md)。

### 验证记录

任务 monitor.md 至少记录：代码／CLI 版本与配置位置、实际覆盖的步骤或工具集、模拟／真实验证区别、结果和请求日志、未测项。重用证据时说明适用范围。不能使用“所有情况都通过”代替这些记录；新的问题补具体回归和检查条件。

## 自动化测试（维护用）

```sh
pnpm test
# 只验证一个共享模块
node --import ./shared/tests/ignore-local-env.ts --test shared/tests/step-models.test.ts
pnpm check
```

自动回归使用本地模拟，不证明上游授权、实际绘图质量或全部协议兼容。临时服务退避、会话恢复与宿主巡检见 [workflow](../workflow/README.md)。

## 结构写回审计（2026-10-26）

<details>
<summary>历史证据与受控编辑改造记录</summary>

记录日期：2026-10-26。以下权限表及 M1–M6 记录受控编辑改造前的核查结果；改造进展见文末。核对本机执行副本中的人物、衣服、组装、阴影及物理管线的提示词、工具回调、恢复与交付检查；物理 agent 工作流仅在执行副本中，当前主线没有 `physics/steps.ts`。审计未修改运行中的模型会话、KRA 或结构文件。

### 谁能修改结构文件

两套 part 共用实现；两套 raster 共用实现。这里区分任务授权、受控工具写入与程序落盘，不把提示词中的“只读”当作操作系统写保护。

| agent | groups.json | occlusion.json | 实际入口与边界 |
| --- | --- | --- | --- |
| part 首次分组 | 创建初始分组，随后由调度器更新根树 | 无 | `write_groups` 校验并写 `step08_initial/groups.json`；调度器通过 GroupStore 写根文件。见 [initial-groups.ts](part/initial-groups.ts)、[layering.ts](part/layering.ts) |
| part 轮廓绘制／返修 | 仅修改当前组 note | 无 | `update_group_note` 精确替换当前 note 中唯一匹配的文本，走 GroupStore 写入队列；不改父组、其他组或树结构。见 [outline-agent.ts](part/outline-agent.ts) |
| part 细分组 | 改变直属子节点，程序保存分组树 | 无 | `submit_children` 返回并校验结构，调度器写对应 `children.json`，再更新根树；agent 不直接编辑事实文件。见 [children-agent.ts](part/children-agent.ts)、[layering.ts](part/layering.ts) |
| part 最终遮挡层级规划 | 无；要求规划期间输入不变 | 生成深度表 | `propose_occlusion`、`check_occlusion_part`、`submit_occlusion` 校验，调度器原子写入最终文件。见 [occlusion-agent.ts](part/occlusion-agent.ts)、[occlusion-plan.ts](part/occlusion-plan.ts) |
| raster step01 绘制及两轮返修 | 允许直接编辑并同步 SVG／记录 | 允许直接编辑深度与区域 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md) 在 step01 绘制中注入；repair 沿用绘制 thread，新建 thread 时前置完整绘制提示词，不再重复注入；结构修改由当前绘制 agent 执行 |
| raster step01 独立 reviewer | 只读检查与反馈 | 只读检查与反馈 | 不注入结构写回职责；框选工具只输出审查证据。见 [review.ts](raster/review.ts)、[part-section.ts](raster/part-section.ts) |
| raster step02、人物 step03 | 当前任务没有授予新的结构编辑职责 | 同左 | 新提示词要求沿用结构；`buildPrompt` 仅在 step01 注入写回职责。与 step01 共用绘制会话，旧指令仍在历史中；文档还有与此冲突的措辞，见 M4 |
| part 独立 reviewer、同层去重、遮挡补全 | 不编辑这两个结构文件；各自仅提交审查或 SVG 产物 | 同左 | 工具绑定对应产物；同层去重与补全不接管分组树或最终深度表 |
| character-assembly、shadow | 上游结构作为输入，无修改授权 | 同左 | 各自修改本管线的工程／配置；不继承 raster step01 的结构写回提示词。见 [组装提示词](../knowledge/character-assembly/step01/prompts/01-人物与衣服组装.md)、[阴影提示词](../knowledge/shadow/step01_mask/prompts/mask.md) |
| physics 的分析／制作／复核（本机执行副本） | 上游结构只读，无修改授权 | 同左 | 执行副本 `physics/steps.ts` 明确要求不改上游、另一管线、run.json 或完成标记；各角色只修改规定的本阶段配置与证据 |

技术边界：raster agent 使用 `danger-full-access`；Claude／AGV 请求使用各 CLI 的执行能力。当前并没有对这两个文件统一设置阶段写保护。未授权角色在提示词上只读，不等于程序已经检测并阻止其越权写入。参见 [raster/agent.ts](raster/agent.ts)、[agents/cli.ts](agents/cli.ts)。

### 当前案例的确定证据

`black-white-doll/clothing-part-layering/occlusion.json` 经 raster step01 回写后，在 15 个多深度区域和 4 个单深度记录中加入了 `layer` 图层名字段，共 19 处。原 schema 只接受单行规定字段以及 `levels: [{ level, region }]`；图层名可记录在绘画报告中，现有 schema 不接受新增的 `layer` 属性。

直接调用 `validateOcclusionDocument` 会报 `pleated_skirt/skirt_body 深度值重复、非法或缺少区域描述`。只在内存副本中移除这 19 处额外字段后，同一校验器通过，覆盖 10 个逻辑 part、19 个深度区域；未修改真实文件。因此本次已证实是额外字段违反协议，未发现深度值重复。此检查不代替视觉 review。

本次观察时，step01 已完成两轮 review／必要返修，step02 在运行。错误来自 [web/part-stages.ts](../../../../web/part-stages.ts) 读取现有表时的校验；它会展示错误，未向当前绘制会话发送修正反馈。

### 已确认的误导文案及程序缺口

| 编号 | 文件与具体文案／行为 | 误导点及实际边界 |
| --- | --- | --- |
| M1 | [occlusion-plan.ts](part/occlusion-plan.ts)：`深度值重复、非法或缺少区域描述` | 同一条件同时检查区域是否为对象、额外字段、数值类型／范围、深度重复及 region 非空；额外 `layer` 字段也触发此句。应分别定位字段路径和失败原因，不能让 agent 按重复深度去改正确层序 |
| M2 | 同文件：`层级表包含重复 ID 或不支持的字段` | 缺失／空 ID、重复 ID、行不是对象及额外字段被合并。此次多深度的 `layer` 移除后，单深度的 `layer` 会触发此句；不能据此认为 ID 重复 |
| M3 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md)：`检查相关文件能够解析、引用完整且图像一致`；[workflow.ts](raster/workflow.ts) 的 `checkFiles` 与 `交付检查通过，写入 .completed` | 能解析 JSON 不证明符合 schema；当前 part raster 没有挂接结构交付校验，完成门槛主要检查要求的输出文件存在、非空且位于目录内。`.completed` 或视觉 review 通过不证明回写的结构文件合法 |
| M4 | [workflow-details.md](README.md#多深度与上游修正)“多深度与上游修正”：`step01 绘画者…step02 沿用已确认结构精修柔边，使用现有文件工具直接修改 groups.json、occlusion.json 和对应 SVG。可以调整层序、归属或拆出…` | 同段将 step01 与 step02 连写，容易把结构编辑权限扩展到 step02；人物／衣服 step02 提示词实际要求沿用层序、归属，不新增拆层。step03 也要求保持结构。参见 [steps.ts](raster/steps.ts) 中仅为 step01 注入写回职责的条件 |
| M5 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md)：`直接编辑上游 groups.json…`、`上游分层文件保存后即作为后续工作的有效输入`；[workflow-details.md](README.md#多深度与上游修正)：`上游结构修改在中断与主动重跑后继续使用` | 这不是所有恢复入口都成立的保证。`GroupStore.open` 从首次分组与各已完成的 `children.json` 重建树；根 groups.json 仅保留已有 ID 的 name／note／metadata。只改根树增加、删除或重排节点，独立 part 恢复时可能被旧步骤事实覆盖。总控在 raster 已启动时跳过 part 恢复只是保护一条入口。见 [groups.ts](part/groups.ts)、[part-steps.ts](part/part-steps.ts) |
| M6 | [workflow-details.md](README.md#多深度与上游修正)“编辑工具说明与 schema”：`raster 各阶段按下文约定提供深度工具`、`实际执行与文件写入校验仍在 TS 中` | 观察时 part raster 只注册 reviewer 框选及 step02 像素差异工具，没有深度修改／校验工具（像素差异工具现已删除，step01 绘制／返修已注册 `edit_groups`、`edit_occlusion`）。工具回调中的 schema 校验不会覆盖 agent 用脚本直接改写上游 JSON 的路径，不能让 agent 误以为保存后已有同等保护 |

### 后续修复边界

- 将层级校验错误拆成准确的字段路径与原因；人物、衣服和前端使用同一校验器。
- 让直接编辑结构的 agent 获得可执行的 schema／引用检查入口，在完成前收到具体错误并在原绘制会话修正；交付端也校验，不只由前端发现。技术校验返修不额外消费视觉 review 轮次。
- 明确 step01 绘制／返修与后续步骤的写入范围，处理共享会话里的旧指令和相互冲突的说明。
- 先统一根 groups.json 与步骤分组事实的写回／恢复机制，再声称结构编辑能够在所有恢复入口保留；不能靠修改提示词替代真实持久化。

这些是待修复项。本次只记录职责、证据和误导点，不向运行中的 agent 注入新任务，也不清理产物或重跑管线。

### 受控编辑改造进展

- 人物／衣服 raster step01 绘制及返修改用 `edit_groups`、`edit_occlusion`；说明在 [edit_groups](../knowledge/shared/tools/edit_groups/description.md) 和 [edit_occlusion](../knowledge/shared/tools/edit_occlusion/description.md)，schema 在 `tools/` 同名目录，执行共用 [structure-tools.ts](raster/structure-tools.ts)。读取仍使用内置文件工具。reviewer、step02、step03 与组装不注册结构编辑工具。
- 工具先校验结构、全部终止节点的深度覆盖和 SVG 引用，再保存。终止 ID 改变时同时提交分组树与深度表。M1、M2 的报错已区分具体字段路径与原因；图层名映射写在报告中。
- 按用户确认，step01 结束时的额外诊断只记日志提示，不阻断完成或后续步骤，也不回交 agent 返修。工具调用失败仍直接返回当前 agent，非法参数不落盘。M3 不采用强制退出的交付门禁。
- M4、M6 涉及的职责与工具说明已改为现行边界，见 [workflow-details.md](README.md#多深度与上游修正)。文件系统硬性写保护与 M5 的独立 part 恢复问题保持现状；文档已明确只保证 raster 续跑保留根结构修改。

</details>

## 工作区与产物

各 CLI 使用同一运行目录约定：`<步骤>/workspace/` 保存中间文件，`<步骤>/` 保存完整交付、报告及报告引用的图片；工作区子目录由 agent 自行选择。CLI 当前目录为 `<步骤>/workspace/`；正文和工具结果给出绝对路径，工具参数及程序读取记录中的相对路径以任务根目录为基准。请求记录携带工作区与输出目录；同一步骤续跑或换 CLI 保留草稿，原生会话数据仍在 `agents/`。步骤调度记录在 `agents/steps/<步骤>/`；各管线的步骤会话统一保存在 `<管线>/agents/steps/<步骤>/session.json`，被替换或清除的会话追加到同目录 `session.json.history.jsonl`。reviewer 每次新建、不保存；配置切换 harness 时丢弃原 thread，新会话按通用提示词接续。布局转换不改写 `agents/`，转换前的会话不再续接。

输入准备由 `shared/agents/inputs.ts` 共用：直接传入上下文的正文和图片不额外落盘；已有原图、上游产物与参考路径直接读取；程序需要生成的索引、说明与变换参考图放在 `workspace/references/`。`agents/` 下每个请求目录的 `prompt.md` 是实际请求的审计副本。工作区和部件层级路径也由共享模块解析，前端与迁移复用同一规则。

前端按工作区实际目录分组过程文件，最新 KRA 预览包含工作区保存的工程。报告引用的工作区图片随报告发布到步骤目录，链接一并更新；没有被报告引用的图片继续作为中间产物。旧任务搬迁必须先确认制作已完成并持有任务锁。
