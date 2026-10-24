# 配置与工作流细节

以下命令均从安装后的 `live2d-maker` 根目录执行。

## 总入口

用户只给部分产物时，核对可从哪条管线继续，帮助把文件放到同名任务的标准上游位置；缺失项按入口报错的具体路径补齐。输入和路径规则见下方“输入、产物与续跑”。

从 skill 根目录执行。先检查该任务是否已有活跃总调度或独立管线；有则接管监听，避免重复启动。新任务或仅有产物的旧任务可能没有总控 `run.json`，此时 `--status` 会报缺少总控记录；按实际输入与 `--from` 首次启动即可，不因此删除已有产物或会话记录。

```bash
# 新任务；使用默认运行根目录，需自定义时追加 --dir /绝对路径/运行根目录
# 需要标准化姿态时在此命令追加 --standard
pnpm start --name jianma --image /绝对路径/参考图.png --krita /绝对路径/krita --background

# 续跑；读取 <运行根目录>/jianma/run.json 中保存的配置
pnpm start --name jianma --background

# 查询，不启动模型
pnpm start --name jianma --status --json
```

后台启动会等到配置保存、任务锁和 Krita 检查成功才确认；确认后检查状态和日志，向用户通报当前阶段。省略 `--background` 为前台运行。后台调度进程负责制作，HTTP 工作台由仓库根目录的 `pnpm web` 单独启动；按[工作台启动与连接](workbench.md)展示同一任务，避免从 CLI 和网页重复启动。

总入口顺序执行：人物 part → 人物 raster → 衣服 part → 衣服 raster → 穿戴组装 → 阴影制作。一条结束后立即进入下一条；两小时检查不参与正常阶段推进。总控 `run.json` 保存路线、配置、PID、各管线进度、最近消息及错误；实际跳过和恢复仍由各管线自己的产物及标记判断。

按用户需要可用 `--from <管线>` / `--to <管线>` 限定连续范围，默认完整六条管线。比如已有两份 KRA 与简化参考，只组装用 `--from character-assembly --to character-assembly`；只做人物到 `--to raster-layering`。范围会保存，之后只用任务名即可恢复。总入口不会把手动提供的上游文件标为已经执行过的阶段。`--jobs` 控制 part 的 agent 并发，默认 3。

`--shadow-mode mask|normal-depth` 透传到阴影制作，首次默认 `mask`，续跑省略沿用保存值。只制作阴影用 `--from shadow --to shadow`；产物与独立恢复见 [阴影制作](../shadow/README.md)。

`--standard` 是人物 part 的 preparation 选项，不增加独立管线。启动新任务前确认用户是否需要标准化；省略时默认关闭。启用后由 preparation agent 判断嘴部是否张大、眼睛是否张开、是否正视站立且双手在身体两侧；已符合就复制原图，否则通过本步骤配置的 `image_generation` 调整。未启用时不调用姿态判断或生图，直接复制原图。两种模式都输出 `part-layering/references/standard.png`，非 PNG 原图会转换格式，`input/original.<扩展名>` 保留原始文件。

后续沿用现有画风判断、简化和素体流程，只把输入改为 `standard.png`。新步骤不额外增加视觉 review。总控 `run.json` 和人物 `part-layering/preparation/step02/options.json` 记录选项；前台、后台和仅用 `--name` 续跑都沿用保存值。独立 part 已保存的选项也可被首次总控继承。`--no-standard` 显式关闭；已完成的任务不能直接切换，须对 options 步骤执行重试（删除 `part-layering/preparation/step02/.completed`），其后的参考随之重做。显式指定这两个选项时，所选路线必须包含人物 part。

只操作特定组、设置拆分限深或调试单阶段时，使用[单管线操作与验收](individual-pipelines.md)中的独立入口；不要与同一任务的总调度同时运行。

## Codex 环境配置

首次创建 skill 根目录 `.env` 时，按[推荐模型方案](model-presets.md)使用方案 1 默认配置；用户指定方案 2 或自定义时按其选择填写。以 [example.env](../example.env) 为完整字段基础，已有配置不覆盖。没有 `.env` 时，代码默认值与方案 1 一致：全部职责为 `gpt-6.1-sol`，按职责使用 low／medium／high／xhigh，生图继承宿主 Codex 内置服务。shell 同名变量优先，文件不执行 shell 或展开变量，`.env` 不写入 Git。LLM 职责配置、独立生图选择、CLI、两种 Google 生图协议及会话隔离见[模型与 harness](agent-models.md)。

`layering_image_compact_threshold` 留空关闭，只作用于 Codex；例如网关最多 50 张时可设 `49`。这项能力需要仓库提供的可选 Codex 补丁。启用此项或 Codex 自定义生图后，若 `layering_codex_path` 留空，启动预检自动准备补丁；有缓存直接复用，并发等待同一次构建。显式指定路径时检查该入口，失败不会替换用户配置。

构建需要 Git 和平台 C/C++ 编译依赖。Rust 1.95.0 不可用时明确提示，在临时目录隔离安装，构建成功或失败均清理，不写全局 Cargo/Rustup 或 shell 设置。补丁固定在官方 0.161.0 源码，独立生成文件，不修改系统 Codex 或全局配置。已有图片压缩策略保持不变：恰好阈值时图片参加视觉 compact；超过阈值时按容量分段，保留尚未压缩的原图、对应文字与工具配对。见[构建与本地验证说明](../patches/codex/README.md)。Codex 自定义生图也使用这份补丁；`codex-native` 和 Claude／AGV 自定义生图不要求生图补丁。

### 生效配置核对

启动、续跑或调整 `.env` 后，在实际执行的 skill 根目录、沿用原启动环境运行：

```bash
pnpm env:check
```

此命令通过工作流同一个配置加载器只读展示生效的 LLM 职责模型与力度、逐步骤生图模型、API 是否已填写及协议、CLI 路径、Codex 配置目录和图片阈值。列出覆盖 `.env` 的 shell 键名，不输出密钥或 API URL，不启动模型、不验证登录，也不修改配置与任务。按[安装与前置](setup.md)另外检查所选路线的 CLI、权限和绘图能力。

- 确认 `skill` 和 `configuration` 指向实际运行的安装；从网页发起时检查工作台 checkout 内的 skill 及服务环境，从 CLI 发起时检查原 CLI 环境。仅在另一份 checkout 或交互终端核对，不能证明后台配置正确。
- `codex.imageCompaction.enabled: false`、`threshold: null` 表示未启用按图片数保护。**补丁存在或生图可用不能证明图片保护开启。** 已知上游拒绝含 50 张及以上图片的请求时，设置 `layering_image_compact_threshold=49`；报告须显示 `enabled: true`、`threshold: 49`、`childThreshold: "49"`，并用启动时选定的二进制检查 `debug layering-capabilities` 中 `image_compaction_version: 2`。没有此限制的环境保持用户选择，默认仍关闭。
- 用户已有 Codex 的 `model_auto_compact_token_limit` 是 token 阈值，与图片数量是两种独立限制；调大 token 窗口不会解除每请求 50 张限制。工作流不通过此 `.env` 键设置 token 窗口或改写用户 Codex 配置。
- 更新模型方案只改用户指定的差异键；保留 provider、API、CLI 路径、`CODEX_HOME`、图片阈值及显示环境，不用完整模板覆盖已有 `.env`。配置由进程启动时加载，修改后让停止的任务用原入口续跑；正在执行的请求不会热更新。

将实际 skill 路径、Codex 路径／配置目录、图片阈值的启停状态及必要 shell 覆盖记入任务 `monitor.md`；不记录密钥。发生超限或换机器／服务后，用这个记录核对当前配置，再按[巡检与恢复](monitoring.md)操作。

## 输入、产物与续跑

```text
<运行根目录>/<name>/
├── run.json                # 总入口保存配置与进度；各管线仍按自己的文件恢复
├── workflow.log            # 唯一主日志：调度、所有绘制/review agent 与后台错误输出
├── monitor.md              # 定时任务信息、环境配置与巡检记录，由 agent 维护
├── input/                  # 用户首次提供的原图，后续管线不复制上游
├── part-layering/           # references、groups、parts、stages、occlusion
├── raster-layering/         # run.json、step01～step03
├── clothing-part-layering/  # 纯衣服 preparation 及衣片分组产物
├── clothing-raster-layering/# run.json、step01～step02
└── character-assembly/      # run.json、step01 穿戴组装
```

前台、CLI 后台及网页启动共用 `workflow.log`，不再新增 `service.log`。旧后台任务尚未恢复时，查询和工作台兼容读取两者中最近更新的一份，并显示实际日志路径及更新时间。所有 agent 的消息、工具操作、网关请求进度、CLI 原生诊断与重试统一写入任务根目录的 `workflow.log`，每条带调用名称；新请求不再生成 `transcript.log` 或永久 `native.log`。CLI 必需的日志文件只作为临时传输文件，回合结束后删除。`agents/*/request.json`、`events.jsonl`、`result.json` 和会话记录继续独立保存，用于完整诊断和续跑；已有旧日志不删除。

完整仓库的默认运行根目录是 `<仓库>/.run`，独立安装的 skill 默认使用 `<skill上一级>/.run`；五个独立入口均可用 `--dir <绝对路径>` 指定其他运行根目录，启动后续管线和续跑时使用同一目录。显式传入的 `--dir` 不再额外插入 `.run`。用户输入的绝对路径直接使用；相对路径统一相对于 `<运行根目录>/<name>/`，与 shell 当前目录无关。规则也适用于 `--groups` 和正常运行时的 `--krita`。单独 `--check-krita` 无任务名，请提供绝对路径。只有人物 part 接收 `--image`；衣服 part 读取同名人物 part 的 `references/simplified-subject.*`，两套 raster 分别读取同名对应 part 的产物；组装入口读取人物 step03 KRA、衣服 step02 KRA 和人物 part 的简化穿衣参考。后续入口不再接受 `--input` 或另行提供图片。

任务名保留各自原有启动规则：part 接受单个目录名，raster 要求以字母或数字开头、只含字母、数字、点、下划线和短横线且不超过 128 字符。共享目录不额外收紧 part 的名称范围。

首次原图保存为 `<运行根目录>/<name>/input/original.<扩展名>`。后续直接读取上游文件，不建立输入副本。五个独立入口不自动启动上游；总入口 `pnpm start` 按所选范围顺序调用它们。缺少产物时列出具体缺失路径，并提示先运行对应上游管线，或手动将产物放到这些位置。各管线的步骤路径以自身目录为基准。


人物和衣服 preparation 均按内容指纹验证缓存：一致才复用，已有参考或输入不匹配时明确报错并保留文件。人物记录还覆盖标准化选项，以及 `standard.png`、`judgment.json`、简化参考、素体参考的输入和输出指纹；判断与生图中断后可继续已完成的小步骤，生成失败不会回退原图。提示词编辑本身不触发重画。

制作不同参考图优先使用新的 `--name`。若有意重做当前人物 preparation，删除报错指向的参考文件再运行人物 part；切换标准化模式时先删除 `part-layering/references/standard.png`。后续参考会逐项检查，不匹配时也须删除对应文件后重做。缺失输出重新生成后，内容相同就保留已有拆分；简化／素体参考内容改变且 preparation 完整后，仅重置当前人物 part 的 `groups.json`、`parts/`、`stages/`、`observations/`、`preview.svg`、`occlusion.json`。此机制不自动重置 raster、衣服或组装的成果、完成标记及 thread；需重做它们时仍用各自原有重跑方式。

旧人物任务没有 preparation 指纹时，默认续跑会明确提示并以当前文件建立一次基线，不重画已有参考；有原图则补一份不调姿态的 `standard.png`。旧任务缺原图但参考齐全时仍可续跑，暂不补 standard；不能在无法确认旧参考来源的情况下直接开启标准化，应使用新任务或移除旧参考后重做。`--groups` 始终只读校验，不迁移文件、不生图、不清理缓存。

part 按 SVG、检查报告、输入指纹及分组树恢复，整层绘制与 review 完成后先同层去重，再补全和分析子组。raster 以 `.running`、`.completed` 以及 review/repair Markdown 决定进度，`run.json` 保存配置和绘制 threadId。删除完成标记会重置该步及其后续步骤、重新建立绘制 thread；重跑清理仅发生在本管线步骤目录内；step01 写回上游 occlusion.json 的深度修正保留。`.running` 表示尚未完成，不代表进程仍在运行。

人物 raster 保留三步，衣服 raster 保留两步，各自交付文件要求不变。第一步完成全部 review/修复后才写 `.completed`；第二步只精修柔边并自检。每次 reviewer 使用新上下文，反馈交回绘制会话；配置仍属于同一 CLI 时恢复原 thread／session，切换 CLI 时按新会话接续；最多两次 review，第二次反馈修完后结束，不增加第三次 review。Codex 续跑沿用原环境中的会话历史；Claude／Antigravity 的会话历史保存在任务目录的请求记录中。更换 CLI、删除 ID 或原会话不可用时新建会话，保留已有产物与旧记录。

## 交付

总控显示所选路线完成后，核对最终 KRA、PNG 和报告实际存在，查看合成图并报告遗留问题；不要只凭进程退出宣称完成。完整路线最终交付位于 `character-assembly/step01/`：`character-assembled.kra`、`character-assembled.png`、`report.md`。限定路线则交付该路线最后阶段的成果。

给出用户可访问的实际文件路径和预览，说明完成范围。结束并注销本任务的定时检查；用户取消时同样停止继续制作和定时恢复。静态分层素材尚未进行 Cubism 绑定与动画制作。

交付时保留可访问的工作台任务页，便于查看流程、分组树和下载产物。关闭本任务的巡检不等于关闭共享工作台；仅为本任务临时启动的服务，结束时说明是否仍在运行及其访问方式。

## 共享实现与独立配置

| 位置 | 职责 |
| --- | --- |
| `workflow/` | 总调度、后台启动、进度查询和保留产物的会话交接 |
| `shared/part/` | 分组树、SVG、整层调度、去重、依赖恢复及 part agent |
| `shared/raster/` | 上游定位、Krita 检查、顺序步骤、review 和标记恢复 |
| `shared/codex/` | SDK / App Server 适配、日志、工具配置、并发和临时重试 |
| `shared/agents/` | 按职责统一 LLM 模型、按 agent 选择生图，Claude／Antigravity 适配、MCP 与自定义生图接口 |
| `shared/paths.ts` | 统一任务目录和外部输入路径解析 |
| 各管线目录 | 启动入口、preparation 或步骤定义、提示词和专项配置 |

人物与衣服分别加载自己的提示词。人物原有 `prompts/groups/<完整ID>/` 特化、参考清单、无祖先继承、默认回退及固定操作约定追加规则保留；共享恢复器也使用对应的参考清单。人物额外参考按需读取，衣服继续提供原穿衣角色用于判断穿插和随动。

## 编辑工具说明与 schema

```text
shared/tools/<工具名>/description.md
shared/tools/<工具名>/schema.json
part-layering/tools/write_groups/description.md
clothing-part-layering/tools/write_groups/schema.json
```

直接修改仓库固定目录中的文件。description 为工具说明，schema 为发送给所选 agent 的 JSON Schema。各管线配置的工具目录可按完整文件覆盖公共版本；未提供的文件沿用公共版本。人物原有分组 JSON 示例放在人物专属工具说明中；衣服首次分组只允许 `subject="other"`，不会读取人物示例或更改人物的允许值。没有外部工具目录启动参数。

工具配置在启动时加载并固定，修改文件在下一次启动生效；同一次 agent 调用期间定义保持一致。raster 各阶段按下文约定提供深度工具，切换阶段仍沿用绘制 thread。实际执行与文件写入校验仍在 TS 中，新增参数或修改执行行为需要同步实现。配置无效会报错。

步骤提示词保留任务目标、方法和验收要求，可以在特殊场景点明工具；参数与调用教程放在工具定义中。此配置只管理工作流注册的函数工具；Codex 生图使用宿主或补丁版原生工具定义，Claude／AGV 自定义生图函数工具的说明和 schema 位于 `shared/tools/image_generation/`。

`update_group_note` 在首次绘制和返修时都可使用：只允许精确修改当前组 note，不改父组、其他组、名称、种类或分组树。reviewer 只提交反馈；修改后的说明交给后续检查和子组分析。

## 临时错误恢复

各管线使用同一临时错误分类和退避策略。先等待所选 CLI 自身重连的最终结果，再对服务过载、断流和临时限流按 5、10、20、40、60 秒等待重试，之后每次 60 秒，直到成功或取消。保持原 thread、已有图片和文件，提示 agent 从未完成处继续；不增加视觉 review 轮次。

认证、额度、上下文超限、图片数量上限、输入或工件校验错误不会进入此重试。可选图片保护在请求发出前处理阈值；未启用时保持原行为。

模型正常结束但没有交付文件、没有保存分组、缺少有效结构化结果，也会明确报错并展示模型最后消息及 threadId；raster 同时写入该步骤的 `error.txt`，保留 `.running`，不误标 `.completed`。例如模型告知没有可用的生图工具，终端会保留这段说明，方便修正环境后恢复 thread／session 续跑。

## 多深度与上游修正

本节仅适用于人物／衣服 part 和 raster；后续 `character-assembly` 使用已完成的两份 KRA，不注册深度修改工具，也不继承 raster step01 的拆层提示词。

`occlusion.json` v3 中每个逻辑 part 仍只有一条记录：单深度使用 `level`，多深度使用 `levels: [{ level, region }]`，二者互斥。深度在整份表中按数值从后到前排序，不再等于数组位置；数值唯一，可用小数插入现有层之间。每个多深度区域都必须有文本说明和检查依据。v2 单深度表仍可读取。

一个共同运动部件需要多个绘画深度时，不再阻断或要求上游重拆。深度规划保持 part 树和 SVG；整件候选预览仅供参考，不能精确展示文本区域的切分。step01 依据标注或组装中新发现的问题，自行拆实际 KRA 绘画层，保持连续性，必要时局部补画。拆层脚本由绘制 agent 编写，调度器不自动切像素。

step01 绘画者对轮廓、补全、可见画风与分层结构负责，step02 沿用已确认结构精修柔边，使用现有文件工具直接修改 groups.json、occlusion.json 和对应 SVG。可以调整层序、归属或拆出需要独立控制的部件，并同步当前 KRA、预览、来源指纹和相关记录。step01 reviewer 只读检查，提出确定、有证据的问题与修改要求。

KRA、导出图及绘画报告只在当前步骤更新，前序工程作为历史成果保留。上游结构修改在中断与主动重跑后继续使用。总控恢复整条路线时，若对应栅格流程已启动，沿用已完成的 part 产物，避免重新运行 part 的旧事实恢复逻辑覆盖绘画阶段修正；明确只运行 part 路线仍可执行该管线。缺失的上游输入由栅格前置检查报告。SDK 会话继续使用 startThread/resumeThread，不注册分层专用 MCP。

## 检查

```bash
pnpm check
pnpm test
```

测试使用模拟 agent、SDK / App Server 和临时文件，并只读检查仓库已有示例的恢复，覆盖各自 preparation、提示词与参考选择、同层去重、恢复、两轮 review、工具配置及重试。不会运行付费生图或重画已有 KRA。运行数据位于 skill 外，不随 skill 发布；仓库内默认的 `.run` 目录被 Git 忽略。原 `test` 已改名为 `jianma`，正式成果见仓库的 `demos/jianma/`，逐次 agent 操作保留本地。独立安装不包含 demos，只有对应的归档验收用例会明确跳过。

共享重构的逐模块差异、发现的偏差及新旧调度对照结果见 [差异审计](../docs/shared-refactor-audit.md)。

### 审核与执行受阻的边界

人物和衣服的轮廓／栅格 reviewer 只提交经核对的确定问题及可执行要求，不设置待确认或标准维护方审批状态；疑点在审查内补足观察，不能把未检查当成通过。blocked 仅用于必要输入缺失、损坏或工具故障等执行障碍，须记录具体错误及恢复尝试。轮廓 blocked 记录保留，但不消耗两次正式质量审核名额；恢复事实与实时调度使用相同计数。栅格普通返修未完成沿用“仍有问题”暂存报告继续原会话，不发布完成报告。

拆分的直属节点边界、子轮廓父范围、去重的同实体同控制职责和补全的已有路径保护继续有效。父范围限制应明确报告证据，不能让子 agent 越界反复返工；去重证据不足时保留对象，不能误删。层序规划的多深度分片和栅格绘制中的层序修正由对应步骤直接处理，不要求等待外部标准批准。

### 生成参考的自动后处理

新生成的 simplified、base-subject 和纯衣服参考共用 standard.png 的画布尺寸。Nano 请求透明背景时，由共享生图通道选择与参考前景最少冲突的红、绿或蓝纯色背景；图像返回后，保留原始 RGB，以它作为唯一参考再生成一张仅换背景的白底或黑底图，由 Node／Sharp 双背景差分恢复 alpha 和前景 RGB。两种 CLI 接入路径使用同一后处理，不改变调用者的任务提示词，也不需要额外 Python 包或抠图权重，详见[安装与前置](setup.md)。

真实 alpha 不二次抠图。旧式不透明参考仍用 Node 内的边缘主色估计、颜色键和去溢色，不调用外部程序或 ML 安装；多色边缘没有可靠主色时保留原像素并记录跳过，衣服参考仍须有实际透明区域。颜色键不承担语义分割，近似背景色的前景仍可能误删。尺寸不同由 Sharp 等比缩放并居中透明补边，不裁紧人物或衣服；尺寸一致跳过缩放。已合格透明 PNG 在不需要缩放时原字节保留。

后处理成功后直接替换正式参考文件，后续步骤只读取处理后的图片。处理前的生成原文件和处理报告保存于 references/archive/ 的独立历史目录，每次生成追加保存。archive 仅供人工查看，不参与程序输入、完成判断或恢复运行；删除 archive 不影响续跑，正式参考缺失时也不会从 archive 恢复。人物 part 的步骤记录（`part-layering/preparation/stepNN/`）仅记录正式参考的文件指纹及输入依赖，不保存归档路径或后处理进度。旧任务已有参考只校验并复用，不在续跑时自动重处理；新衣服参考需要同名人物的 standard.png，避免误用 original 或简化图尺寸作为基准。该过程不额外调用 LLM。

Nano 两张背景图、背景选择、alpha 和错误／处理报告保留在调用步骤的 image-processing 目录。第二次生图、背景采样或画布适配失败时明确报错，日志指向实际文件，不发布未完成的新参考。无需透明化时直接保留输出；制作管线不依赖 FFmpeg 或 Python 抠图环境。

模型抠图后共用 Node 边缘恢复：用实际背景颜色和第一张目标参考的主体色盘约束残色，必要时下调边缘 alpha，保留不透明内区与真实同色细节。详情、原模型结果归档和未修正数量见[生图通道](agent-models.md)。这一阶段不修改 Python worker、模块或模型权重，不额外安装依赖。

### 投影蒙版制作

蒙版分支开工前准备真实 part／深度／图层索引及裙影、发影示意，短提示词引用随任务复制的制作格式。保存后通过固定原生检查程序导出完整影层、接收面、去影对照和声明偏移；完成与续跑均验证检查指纹。原画精度不变，拼图仅用于比较。具体输入、裁切规则、v2 关系表和平台要求见 [阴影制作](../shadow/README.md)。法线＋深度分支继续使用独立的模型配置和恢复规则。

### raster 轮廓与边缘分工

step01 reviewer 看图确认形体、画风和衔接过渡问题，使用 `annotate_review_regions` 标记编号框、对应图层和问题说明，生成整图标记及同坐标局部对照；绘制者按编号反馈修复。工具仅为独立 reviewer 注册，定义在 `shared/tools/annotate_review_regions/description.md` 和 `schema.json`；它不自动检测差异、计算相似度或决定通过。step01 重点处理缺口、错位和明显画风差异；仅可覆盖本部件自己的原图可见像素，不能为缩小整图差异混入其他部件。覆盖区与补绘区、相邻 part 的接缝用画笔修自然。隐藏补全根据形体和上下文检查，不与遮挡物像素强行匹配。step02 使用 `locate_pixel_differences` 的候选框作为细节检查入口，对照参考确认后局部小改，并逐层扩展检查全部部件；精修边缘、抗锯齿、瑕疵、描边和部件细节，不拆层或修改归属，也不再独立 review。

旧的 step01 完成交付在新版本下补跑轮廓 review，保留绘制会话和工程。检查没有改变 KRA／必要 PNG 时保留后续成果；实际修复改变工程时，后续步骤移入本管线 `recovery/` 保留，随后从修正输入继续。主动删除 `.completed` 仍沿用原有全重跑规则。旧 step02 已发布初次绘制报告、完成结果与有效交付但停在已移除 review 时，继续启动会完成其标记，不重画已完成柔边。

### 各 CLI 请求大小预算

`.env` 中 `layering_codex_request_compact_mib`、`layering_claude_request_compact_mib`、`layering_agv_request_compact_mib` 分别控制提前带图压缩的 MiB 预算；对应 `layering_<cli>_image_compact_threshold` 控制图片数，留空关闭。Codex 专用图片键优先于旧 `layering_image_compact_threshold`。完整机制、支持的协议、可选去重及失败恢复见 [图片容量保护](../patches/README.md#图片容量保护)。`env:check` 只预览生效配置；真正发包时再核查容量，不改上游硬上限。
