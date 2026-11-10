# 总流程、工作台与恢复

常规参数和 section 导航见 [SKILL.md](../SKILL.md)。从实际安装的 skill 根目录执行；新用户在完整仓库中可双击启动文件，再通过前端制作，见[项目首页](../../../../readme.md)。

## 总入口

```sh
pnpm start --name jianma --image /绝对路径/角色.png --krita /绝对路径/krita --background
pnpm start --name jianma --status --json
pnpm start --name jianma --background
```

参数含义（含 `--dir` 默认值、`--jobs`、`--step` 写法）只在 [SKILL.md](../SKILL.md#启动参数) 说明。自定义运行根目录时每次追加同一 `--dir`；所有相对输入（包括 image、groups 和 krita）从任务目录 `<dir>/<name>/` 解析。

总控按依赖调度：人物 part 完成准备（简化参考）后，人物 raster 与衣服线（衣服 part → 衣服 raster）同时进行；两条线都完成后执行组装和阴影。首次默认到阴影结束；总入口加 `--live` 才自动继续 `nine-axis`，该段依赖阴影完成并复用既有总调度。`live` 与实际 `from`／`to` 保存在 `run.json`，继续／恢复／重试省略选项则沿用；`--no-live` 显式关闭整条流程的九轴续接。显式 `--from`／`--to` 优先限定范围，单独管线不因此扩大。`--from`／`--to` 选择连续范围并保存，路线范围之外的上游视为已就绪，后续阶段自动推进。一条线失败只阻塞依赖它的管线，另一条线继续跑完，随后整次运行记为 failed。素体未换装时两条衣服管线记为 `completed` 且 `skipped: true`，见[姿态与参考](#姿态与参考)。运行状态的 `activeSections` 列出正在执行的 section。九轴 step04 的 model／video 分支及 model 内三个方向并发，所有模型调用仍共用整次运行的 `--jobs` 名额。主动停止的 section 记为 interrupted，调用失败记为 failed；`.running` 仍只表示尚未交付。已有两份 KRA 与简化参考时可从组装开始，不伪造上游完成记录。

后台返回启动确认后仍需查询状态与日志，Codex 补丁可能仍在准备。新任务或只有成果的旧任务没有总控 `run.json` 时，`--status` 报缺记录；按实际输入和范围首次启动即可。先核实活跃进程与锁，不能同时从 CLI、网页或独立 section 启动同一任务。总调度和恢复操作持有任务锁 `<dir>/<name>/.runner.lock`（每 10 秒刷新，30 秒无刷新即过期）。

### 姿态与参考

新任务确认 `--standard`，默认关闭：直接复制原图；开启后先判断再按需生图，均输出 `part-layering/references/standard.png`。首次原图另存 `input/original.*`。选项只保存在总控 `run.json`，续跑省略则沿用；`part-layering/step02_options/options.json` 是该步产物，记录已采用的选项；`--no-standard` 显式关闭。`--standard`／`--no-standard` 要求本次路线包含 part-layering。选项步骤完成后再切换会被拒绝且不改动文件，请使用新的 `--name`。

默认换装范围是主体衣装；手套、袜类、鞋靴和其自身装饰随人物保留。人物素体使用临时连体服，raster step03 去除；衣服 preparation 同时读取简化穿衣图和素体图，提取互补衣装。整套衣装的大小与位置由组装适配。

素体 agent 的选择写入 `part-layering/step06_base/decision.json`（`dressed`）。没有换装时，总控把 clothing-part-layering 与 clothing-raster-layering 记为“完成（跳过）”且不调用 agent；raster step03 直接复制 step02 成果作为素体，character-assembly 直接复制人物 KRA，阴影照常运行。之后重做素体并换装，两条衣服管线会正常执行。旧任务没有 decision.json 时按简化图与素体像素是否相同判断；已画出衣服的旧任务继续使用这些衣服，已完成的输入保持不变。

已完成的步骤直接沿用，提示词更新不会自动重绘。已标记完成但交付文件缺失时拒绝续跑并提示路径：恢复文件，或对该步骤重试。生成参考的透明处理、等比缩放和留档规则见 [shared](../shared/README.md#参考图后处理)。

## 生效配置核对

```sh
pnpm env:check
```

从实际执行的 skill、原启动环境核对 `.env` 和 shell 覆盖。命令只读显示模型、力度、生图、CLI、配置路径、图片数／字节预算和是否填写 API；`providers` 展示连接来源、地址、协议和可用模型列表，不输出密钥，也不验证登录或工具可用性。首次环境与真实工具验证见 [setup](../references/setup.md) 和 [shared](../shared/README.md#启动验证)。

网页启动使用工作台 checkout 内的 skill 和服务环境；CLI 使用原入口环境。修改 `.env` 后，新进程会读取配置；已运行的总调度或请求不热更新，需先停止再继续。不要用另一份 checkout 的预览值证明当前任务已生效。

模型职责与覆盖顺序见 [模型配置](../references/model-presets.md)。保留用户已有 provider、CLI、CODEX_HOME、显示环境与图片预算。Codex 补丁自动准备与容量保护见 [patches](../patches/README.md)；不能仅凭二进制存在认定保护开启。把实际路径、非敏感启用值、必要 shell 覆盖记入 `monitor.md`。

## 输入、产物与续跑

```text
<dir>/<name>/
├── run.json                  # 总控配置、PID 与错误；进度与最近消息见 workflow.log
├── workflow.log              # 调度、agent 和网关的唯一主日志
├── monitor.md                # 宿主定时信息、操作环境与巡检记录
├── input/
├── part-layering/
├── raster-layering/           # step01～03
├── clothing-part-layering/
├── clothing-raster-layering/  # step01～02
├── character-assembly/        # step01
├── shadow/                   # step01_mask 与 step01_normal-depth 独立恢复
└── nine-axis/                # --live 可选续接；step01_preparation～step07_jaw-line
```

请求目录继续保留 `prompt.md`、`request.json`、`events.jsonl`、`result.json` 和会话记录。任务日志统一写入 `workflow.log`（不再读取旧版的 `service.log`），不新增永久 native/transcript 日志。

section 的事实文件决定恢复，总控只是摘要。`.running` 表示尚未交付，不证明进程存活；`.completed` 表示交付检查通过。普通中断用相同入口、name、dir 恢复原会话。需要主动重做某步时用 `--retry --section <管线> --step <步骤>`（可指定已完成步骤），不要手动删除 `.completed` 等标记。重试删除该步骤目录、它在目录外的产物、会话，以及输出写在该步骤的 agent 尝试记录（`agents/<时间>-<名称>-*/` 与 `sessions.json` 中的对应条目），新 agent 不会读到旧尝试；只重做该步骤，已完成的后续步骤与下游管线沿用，不会因上游重做自动重跑。

part 逐层进行轮廓与复核、同层去重、补全和直属拆分；每层全部结束再进下一层。raster step01 的结构修正持久写回上游，已进入 raster 的总控续跑不会再用旧 part 事实覆盖它；明确只选 part 会按首次分组与各步骤事实重建树；续跑前应留档核对仅在根 groups.json 中调整的结构。现行工具职责与诊断边界见 [共享说明](../shared/README.md#多深度与上游修正)。

两套 raster 与 part 的正式质量 review 最多两轮，每次 reviewer 使用新上下文；反馈回原绘制会话，第二次修完不做第三轮。临时服务重试不消耗 review 轮数。文件检查不能代替逐层看图；不伪造完成标记或改写报告为通过。

## 工作台启动与连接

CLI、HTTP 服务和宿主巡检独立运行。先读 `monitor.md` 复用服务，核对 `GET <根URL>/healthz` 返回 `status: ok`、`application: astra-layering`、`mode: workbench`，再核对 `api/settings` 的运行根目录。

完整仓库可双击根目录的 `start-workbench.command`／`.sh`／`.cmd`；启动文件在 4387–4406 中选第一个空闲端口，并复用本 checkout 已在运行的服务。agent 也可在仓库根目录以持续后台方式运行 `pnpm web`，默认 4387，`--port 4388` 可换端口。`pnpm web` 不接受任务的 `--name`／`--dir`。

独立 skill 不包含网页；没有已有服务时，在 skill 外准备匹配版本的工作台，避免下载 demos/archive：

```sh
git clone --filter=blob:none --sparse https://github.com/wu-tian807/AstraLayering.git /安装位置/AstraLayering-web
cd /安装位置/AstraLayering-web
git sparse-checkout set web .agents/skills/live2d-maker
pnpm install --frozen-lockfile
pnpm web
```

网页只浏览产物时不需要模型凭据；从网页启动则使用网页 checkout 内的 skill，需要其 `.env`、原 thread 历史和 Krita 显示环境。补齐网页不替换执行中的 skill，也不搬任务；原 CLI 续跑仍从原安装执行。

在页面“工作目录”选择与 CLI `--dir` 相同的根目录。程序连接先读 `GET api/settings`，再 `POST api/settings`，JSON 为 `{ "dir": "刚读取的旧目录", "directory": "目标运行根目录" }`；此设置为实例共享，不能擅自改掉无关服务。`?dir=` 不会改变设置。两个不同目录需要独立 checkout 和服务，只改端口仍共用设置。

打开 `<根URL>/?name=<编码后的name>` 并检查实际选中任务与目录；再打开一项真实产物，或展示真实等待状态。流程定位 `?name=<name>&page=preview&stage=0`，stage 为 0..6。角色预览是 `studio?project=<name>`，读取该任务的组装、阴影、lighting 及已制作的九轴产物。九轴阶段的模型与工程使用该阶段交付，不从其他案例猜贴图。

服务只监听本机，远程需使用已有转发／部署入口，不能把远端 localhost 当作用户地址。浏览器能力可用时打开并核对页面；不可用时给链接并说明。页面故障不重置绘图。关闭网页不停止制作；网页“停止”或 CLI `pnpm start --name <name> [--dir …] --stop` 可控制网页或 CLI 总入口启动的任务，按当前运行 ID 请求总调度取消并保留产物及 thread。停止请求不会影响下一次续跑。旧版网页 worker 仍用原入口，旧版终端调度在 macOS／Linux 上可通过原终止信号停止；Windows 旧终端任务仍需从原终端停止。独立 section 需停止原进程及子进程。完整 UI、原生合成器的 Krita／Xvfb 环境与部署见工作台 checkout 的 `web/README.md`。

## 定时巡检

使用宿主实际提供的定时工具，每 2 小时检查，持续到所选路线完成或用户取消；先核对已有定时记录，避免重复。创建成功后记录实际定时 ID、skill 版本／绝对路径、任务名／绝对路径、范围、启动方式、CLI 与 Krita 显示环境、工作台 URL／checkout／追踪目录和恢复命令到 `monitor.md`，不记录密钥。

宿主无定时能力时明确说明，不自行安装 cron 等替代方案。后台总调度仍可推进。

每次检查：

1. 运行 `--status --json`，结合 `run.json`、`workflow.log`、当前报告和错误判断阶段；独立 section 无总控时沿用独立进程和事实记录。
2. 核对实际进程身份、子进程和日志；固定沉默时长、`.running` 或仅 PID 存活均不足以认定卡死。正常或自动退避中的任务不重复启动。`<section>/krita.json` 的 `state: waiting` 表示在排队等本机 Krita 名额（`krita_max_instances`，默认 4），不是卡死；`krita: false` 的步骤不占名额。
3. 失败时检查最后消息、会话与已保存产物，修复可恢复的环境／输入问题后以原入口、范围、name、dir 续跑。不能只记录故障后等待。按情况选择：原会话可继续用 `--continue`（默认）；会话损坏但产物可用用 `--resume`；产物本身不合格才用 `--retry`。
4. 追加发现、动作与结果到 `monitor.md`；只在有实质变化、故障、完成或需用户操作时通知，正常无变化保持安静。另检查网页仍连接同一任务。
5. 完成时核对文件并交付，取消时核实身份后停止本任务及子进程；关闭本任务定时检查，保留产物和共享工作台。

活跃锁冲突先核实进程，不直接删锁；意外退出后锁约 30 秒过期。独立入口不受总控锁保护，不得并跑。

## 故障恢复

| 情况 | 操作 |
| --- | --- |
| 网络断流、服务过载、临时限流 | 只重试调用通道给出结构化错误码的错误：`serverOverloaded`、`internalServerError`、`rateLimitExceeded`、`responseStreamDisconnected`、`responseStreamConnectionFailed`、`httpConnectionFailed`、`responseTooManyFailedAttempts`、`apiError`（仅 429／5xx）、`processKilled`、`transportTimeout`。CLI 自身重试结束后按 5、10、20、40、60 秒退避，随后每 60 秒重试直到成功或取消；等待期间不占 agent 名额，保留原会话与文件 |
| 无错误码的错误；鉴权、额度、上下文、无效输入、单次图片数或字节超限 | 不自动重试；查看实际错误后修复，不重复发送原请求。容量保护与本地模拟见 [patches](../patches/README.md#图片容量保护) |
| 启动报“记录的 Krita 不可用” | 按 [setup](../references/setup.md#krita-与显示环境) 修复路径或显示环境后，加 `--krita <可执行文件>` 重新启动；已有安装确认沿用，缺少必要确认时不擅自改方案 |
| 运行中 Krita 崩溃或卡死 | 由 agent 通过 `krita` 工具自行重启；框架不替 agent 启动 Krita |
| 模型正常退出却无交付 | 查看最后消息、threadId、步骤 `error.txt`；保留 `.running`，修正工具／输入后续跑 |
| 需要重做正式 review／repair | 先归档原报告和原因，再让原调度接续；不增加第三轮 review |
| 网页断开 | 单独恢复网页，保持绘图记录；不能因此重置工程 |

Codex 泛化断流先读日志“错误详情”与请求 `result.json`，区分 API、代理和 CLI，不能直接推断网络或容量；AGV 的响应头期限、MINIMAL 兼容与 LiteLLM 透传均见 [patches](../patches/README.md)。

### 恢复方式

`--continue`（默认）接上原会话，只发一句固定的继续提示。`--resume`（网页“恢复”）适用于所有管线：清除会话、保留产物，新会话收到通用提示词，自行读取已有输入、产物及反馈。`--retry`（网页“重试”）删除该步骤目录、它在目录外的产物、会话和该步骤的 agent 尝试记录，只重做该步骤。三者是不同操作。不带 `--section` 时作用于全部 `.running` 步骤；`--retry` 还会重做已标记完成但缺少交付的步骤（运行时拒绝沿用这类步骤）。

## 交付与自动化测试

最终文件位置由各 section README 约定，核对实际文件，特别是衣服 PNG 按实际导出位置提供。阴影默认交付 `shadow/step01_mask/character-shadowed.kra` 与 PNG；normal-depth 交付贴图并发布 `lighting/`。默认路线交付静态分层素材；开启 `--live` 后另交付现有工作台可读的头部九轴模型和贴图，Cubism 绑定／导出仍是后续工作。

```sh
node --import ./shared/tests/ignore-local-env.ts --test workflow/tests/*.test.ts
# 或全部：pnpm test
```

必须预加载 `ignore-local-env.ts`（`pnpm test` 已包含），否则 skill 本机 `.env` 会改变测试所用的 harness、模型与能力；测试只读 `example.env`。

使用本地模拟与临时文件，覆盖后台、锁、范围、状态、步骤操作及会话恢复；不调用付费模型。
## 导出成果

仅当全部导出管线已完成、总调度已停止（无活跃进程和任务锁）时可导出；工作台提供“导出成果”，下载 `<name>.zip`。

```sh
pnpm export --name my-character --dir /绝对路径/运行根目录
pnpm export --name my-character --dir /绝对路径/运行根目录 --output /绝对路径/my-character.zip
# 写成文件夹，可直接放进 demos 或交给工作台查看
pnpm export --name my-character --dir /绝对路径/运行根目录 --output /绝对路径/demos/my-character
```

`--dir` 默认值与制作命令一致；`--output` 相对当前终端目录解析，省略时为 `<name>.zip`。`--json` 输出 JSON：文件数、文件总字节数及未找到的历史图片引用。目标已存在时拒绝覆盖；输出位置不能在任务目录内或包含任务目录。文件夹输出就是任务目录；ZIP 内包含一层 `<name>/`。

网页与命令行共用同一导出程序：由完成记录和步骤交付契约收集正式结果，再保留报告引用的图片。被报告引用的 workspace 图片会复制到报告旁并改写链接，其他过程文件不导出。CLI 会话、凭据、环境配置、缓存和恢复备份留在原运行目录。导出失败会清理暂存内容，原任务不被搬动或删除。

已完成九轴下颌步骤的任务，还包含九轴正式目录中的模型、贴图、可编辑 KRA、合成图及已有说明／对照；阴影名称和组织方式按实际交付保留。工作台读取同一份阶段模型与工程。这项收集不增加九轴完成条件。

归档保留各步骤的完成事实，因此导入工作台后仍显示完整的步骤、review、分块预览、深度预览和 Krita 保存画面；不再提供制作恢复操作。未找到的历史报告截图列在 `manifest.json` 的 `warnings`，不伪造图片。KRA 及原有美术文件按原字节复制；缺少固定 PNG 预览的步骤从 KRA 的 `mergedimage.png` 提取，深度 SVG 按当前 `occlusion.json` 重新合成。多深度部件仍以 KRA 中的真实拆层为准。
