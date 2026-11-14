# 共享运行时与维护

默认配置统一维护在 skill 根目录的 [example.env](../example.env)，由 `shared/default-configuration.ts` 读取。模型职责与生图默认值由共享模型模块校验、解析；运行时回退、首次生成 `.env` 与 WebUI 使用同一模板。WebUI 依赖 skill，独立 skill 包含完整配置与解析能力。

日常执行见 [SKILL.md](../SKILL.md)。

## 工具与模型

每个步骤的 `agent.json` 声明工具，启动时一次注册。工具参数、说明和实现分别维护：

| 内容 | 位置 |
| --- | --- |
| 参数 schema | `shared/tools/<name>/schema.json`；section 可提供专用 schema |
| 共用工具说明 | `knowledge/shared/tools/<name>/description.md` |
| 步骤专用说明 | `knowledge/<section>/<stepNN>/tools/<name>/description.md` |

启动检查核对声明、schema 和实现；`write_outline_svg`、`submit_review` 等交付工具必须列入对应步骤。工具实现负责路径与写入校验。

生图能力由 `tools` 中的 `imagegen` 声明决定，`.env` 选择模型与服务。Codex 原生工具按声明开启，GPT／Nano 自定义服务使用 patch 路由；其他 CLI 注册同一工具接口。

review 使用独立 thread 和自己的工具；repair 续接 main 的绘制 thread 与工具，只单独配置提示词。模型与服务协议见 [模型方案](../references/model-presets.md)。

`preview_svg` 的生成图对照参数只在补全阶段开放，section 定义覆盖后仍保留阶段限制。`referenceRegion` 使用生成图坐标选取对应部件，工具将裁片等比居中到 SVG 实际内容范围；`referenceOffset` 使用原图像素微调，各轴上限为部件尺寸的 10%。生成图用 `edge` 检查形状，省略 reference 参数后用默认参考图 `blend` 检查定位；`crop` 仅控制最终查看窗口。生成图对照默认聚焦部件，普通对照默认全画布，输入文件保持原样。

读取与预览接受可读本地路径及符号链接，参考图沿用生图工具返回的位置。自定义生图工具 `imagegen` 的 `input_images` 与可选 `output_path` 只接受绝对路径，`output_path` 省略时使用默认生图目录；原生 Codex 生图保留自身保存位置并返回绝对 `savedPath`。两类生图返回或 agent 回复的相对 `savedPath` 直接报错，不按任何目录猜测。

Krita 的操作由 [krita 工具说明](../knowledge/shared/tools/krita/description.md) 提供，软件路径由工具内部使用。FFmpeg 同样通过 `extract_video_frame` 工具调用。私有进程、并发名额与显示环境见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。

Codex 的每个回合都经 App Server（`codex app-server`）执行；延续已有 thread 时不能改变工作目录、工具定义、shell 或生图开关，需要改变时新建 thread。Claude／AGV 的工具活动按长度截断后镜像到 `workflow.log`，完整记录在请求目录的 `events.jsonl`。总控并发运行的管线各在独立 worker 进程中，agent 名额由总调度统一按 `--jobs` 分配，跨进程共享。

会话恢复由 CLI 适配层处理。Codex 的 `shared/codex/tool-agent.ts` 为工作流子会话关闭 `features.goals`，防止原生 goal 自动续跑抢先启动回合；恢复时若仍有活动回合，先请求 `turn/interrupt` 并等待该回合的 `turn/completed`（最多 30 秒），再提交原始输入和 outputSchema。

若提交仍遇到 `ActiveTurnOutputSchemaMismatch`，重新查询活动回合、中断后立即重试一次；仍不能安全恢复时，由共享的有界会话替换机制保留记录与产物新建 thread，不占用网络退避次数。

工具、消息、用量、错误和完成事件必须携带与当前回合匹配的 ID；缺少 ID 时明确报协议错误并结束连接，旧回合的工具与结果不能执行或结束新任务。

Claude 使用一次性 `--print --resume` 且禁用定时唤醒工具；AGV 使用 `--conversation`，按当前 user_input 边界核对终态，两者均校验恢复后的会话 ID。共享层只负责错误分类、重试预算与会话替换，不实现某个 CLI 的中断协议。

## 多深度与上游修正

`occlusion.json` v3 每个逻辑 part 只有一条：单深度使用 `level`，多深度使用 `levels: [{ level, region }]`，二者互斥。深度数值唯一，从后往前排序，可用小数插入；v2 单深度仍兼容。多深度表示同动整体跨层，不强制回 part 拆树，实际绘画分片由 raster step01 在 Krita 中实现，保持连接和归属。

step01 绘制与返修对轮廓、隐藏补全、画风和结构负责。读取结构使用内置文件工具，修改分组使用 [edit_groups](../knowledge/shared/tools/edit_groups/description.md)，修改深度使用 [edit_occlusion](../knowledge/shared/tools/edit_occlusion/description.md)。工具校验分组、全部终止节点的深度覆盖及 SVG 引用后保存；终止部件 ID 改变时同时提交完整深度表。版本、方向及上游 sourceHash 由程序管理，图层名与部件的映射写在绘画报告中，并同步对应 SVG、当前 KRA 与预览。

工具校验失败直接向当前 agent 返回具体字段路径与原因，保留原文件，修正参数后再次提交。step01 结束时的额外结构诊断记录为日志“结构检查提示”，供前端查看；这项诊断继续保留完成与后续执行，也保留原有视觉 review 轮数。完成标记表示已通过当前交付检查，结构诊断与视觉检查应分别核对。

各环节的流程工具见 [raster 工具表](../raster-layering/README.md#三步交付)：结构编辑工具仅提供给两套 raster step01 绘制／返修，reviewer 只用框选工具，step02、step03 只用 Krita；需要 Krita 的步骤中，绘制、review 与返修 agent 都另有 `krita` 工具。各 CLI 沿用共用函数工具通道和原有会话恢复能力。职责约定与受控工具校验之外没有写入沙箱：Codex 使用 `danger-full-access`，Claude／AGV 使用 `--dangerously-skip-permissions`。

三种 harness 使用管线 `agents/` 内的独立配置和会话数据，续跑复用任务记录，认证按需接入。

raster 中断、主动重跑及已进入 raster 的总控续跑保留上游修正。独立重跑 part 会从首次分组与各步骤事实重建树；仅写在根 groups.json 的树结构调整需事先留档核对。

reviewer 逐层检查视觉效果，只提交观察确认的问题。blocked 用于输入或工具等执行障碍，不消耗正式质量审核轮数。

## 参考图后处理

新生成的 simplified、base-subject 和纯衣服参考以 `standard.png` 为统一画布。真实 alpha 直接保留，Nano 的透明请求由共享生图通道双背景差分恢复，不额外安装 Python 抠图环境；处理方式见 [生图配置](../references/model-presets.md#生图执行与透明处理)。

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

## 维护检查

修改配置或共享调用层时，运行相关自动检查；接入新模型、CLI 或协议时，按所选路线验证工具调用与会话恢复。命令与覆盖范围见 [验证说明](VALIDATION.md)。

## 工作区与产物

各 CLI 使用同一运行目录约定：`<步骤>/workspace/` 保存中间文件，`<步骤>/` 保存完整交付、报告及报告引用的图片；工作区子目录由 agent 自行选择。CLI 当前目录为 `<步骤>/workspace/`；正文和工具结果给出绝对路径，工具参数及程序读取记录中的相对路径以任务根目录为基准。请求记录携带工作区与输出目录；同一步骤续跑或换 CLI 保留草稿，原生会话数据仍在 `agents/`。

步骤调度记录在 `agents/steps/<步骤>/`；各管线的步骤会话统一保存在 `<管线>/agents/steps/<步骤>/session.json`，被替换或清除的会话追加到同目录 `session.json.history.jsonl`。

reviewer 每次新建、不保存；配置切换 harness 时丢弃原 thread，新会话按通用提示词接续。布局转换不改写 `agents/`，转换前的会话不再续接。

输入准备由 `shared/agents/inputs.ts` 共用：直接传入上下文的正文和图片不额外落盘；已有原图、上游产物与参考路径直接读取；程序需要生成的索引、说明与变换参考图放在 `workspace/references/`。`agents/` 下每个请求目录的 `prompt.md` 是实际请求的审计副本。工作区和部件层级路径也由共享模块解析，前端与迁移复用同一规则。

前端按工作区实际目录分组过程文件，最新 KRA 预览包含工作区保存的工程。报告引用的工作区图片随报告发布到步骤目录，链接一并更新；没有被报告引用的图片继续作为中间产物。旧任务搬迁必须先确认制作已完成并持有任务锁。
