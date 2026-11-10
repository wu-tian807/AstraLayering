# 管线审查复核与处理决定（原 20 项）

原审查基线：`fc9ee8915249dcdc9da0e461ea57bbbe25040619`，分支 `docs/release-readiness-20261110`，PR #251。以下保留原 20 项编号以便对照，不能继续称为 20 个当前违规项。

2026-11-10 用户逐项确认后的处理：

- 第 1 项已在原基线删除 FFmpeg 提示词注入。
- 本轮落实 2、4、5、6、7、11、13、14、15、16、17、18、19、20；不增加输入指纹、SHA 校验或新的恢复状态表。
- 第 3 项暂不修改；第 12 项及类似的已生成产物主动重生成规则留待统一设计。
- 第 8 项前次误把底层路径函数当成总入口：实际总入口 directoryFor 已提前拒绝非法名字。只给网页新建表单补相同规则，没有新建命名校验体系。
- 第 9、10 项是人为构造链接后的文件系统行为，没有证据违反用户的相对/绝对路径契约，撤销违规判断，不增加链接配置或限制。
- Web 全局设置只提供新任务默认值；总控持久化并可修改本任务的 knowledge、Krita 等参数，每次 section 启动显式接收。独立 section 的无状态启动设计保留。

原始触发证据与本轮结果分别记录。下面的代码链接指向原审查基线，避免把已修改的当前源码误当作旧行为。

范围包括 live2d-maker 的先验知识加载、工具声明、agent 调用与 CLI 补丁中的提示词变换、section 目录边界、九轴视频与选帧、全局软件设置和扫描。未调用真实模型，未改作者工程、任务产物或生产服务。隔离复现使用临时文件、模拟视频服务及两个模拟可执行文件；浏览器通过本地 HTTP fixture 验证扫描错误路径。Windows、macOS 没有实机结果。

## 判断依据

- **C1 提示词来源：** [shared/README.md](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/README.md#提示词模板与动态位置) 规定工作流任务文字来自 knowledge Markdown，由 agent.json 声明；代码不能临时拼接制作要求。用户本次明确禁止这种自行注入提示词的实现。
- **C2 工具和会话：** [工具与模型](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/README.md#工具与模型) 规定实际工具以 agent.json 为准，启动固定本次定义；延续 thread 不得改变工具、shell、生图开关及工作目录。
- **C3 配置与路径：** [SKILL.md](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/SKILL.md) 规定任务根是路径基准、独立 section 启动无状态；[knowledge.ts](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L8) 明确 --knowledge 替换整个目录、没有默认知识回退。软件配置属于执行参数和环境。
- **C4 产物与恢复：** [九轴 README](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/README.md) 定义视频、实际选帧记录和规范化 PNG；[工作台 README](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/web/README.md#制作与续跑) 定义停止保留产物、继续和恢复的行为。完成的步骤不因提示词改变自动重绘。
- **C5 软件选择与扫描：** 用户要求 Krita、FFmpeg 共用全局选择和搜索，选定路径由执行环境消费；停止扫描和完整扫描的结果应能够准确区分。

P1 表示影响提示词来源、工具权限、任务目录、所选软件或恢复结果，应优先处理；P2 表示校验、错误恢复或条件性兼容风险。优先级不代表已批准修改，也不把本表全部变成发布门禁。

## 20 项

### 1. P1：FFmpeg 路径说明由代码拼入制作提示词（已修复）

**证据：** [原提交 0ad1e50d](https://github.com/kubeela/AstraLayering/commit/0ad1e50d49f5256d5c0e707ab4d4ea4eac645f3d) 增加 ffmpegInstructions，并在 runAgentTurn 中前置到正常及恢复提示词。违反 C1；这不是用户要求的实现方式。

**解决方案及结果：** 删除该函数、拼接调用及 agent 对象上的提示词专用 ffmpeg 字段；保留全局选择、检查和环境参数。修正 SKILL、setup、README 的错误说明。正常及恢复均不再添加这段文字。12 项定向检查通过；随后加强为精确正文断言，受影响的 9 项会话检查通过，TypeScript 与 diff 检查通过。

**验收：** 自定义 FFmpeg 仍在执行环境中可用；实际 agent 正文与原任务正文加已声明的工作区模板一致，不含 FFmpeg 路径段落。

### 2. P1：先验知识目录是可变的进程全局状态

**证据：** [knowledge.ts:11](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L11)、[共享文件解析:95](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L95)。在同一进程保留 A 的 stepKnowledge 句柄，再选择 B，A 的共享提示词读取变成 B。C3 要求本次调用使用选定的知识来源。

**本轮实现：** 知识目录绑定到本次调用的异步上下文，stepKnowledge 句柄也固定其创建时目录。同进程的另一调用不再改变旧句柄的 shared 模板及参考路径。Web 新任务使用全局默认；已有任务可在执行参数修改 knowledge/Krita，由总控保存到 run.json，启动和续跑再传给 section。不将这些任务参数重新变成代码进程的全局设置。

**验收：** 同进程交错运行 A、B，提示词、工具说明和参考文件各自保持原来源。当前总调度使用独立 worker，因此不能把这个复现写成现有网页任务已经串线。

### 3. P1：agent.json 在运行期间反复读取，定义没有真正固定

**用户决定：暂不实施。** 不固定整份 agent.json 快照。

**证据：** [knowledge.ts:87](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L87)、[toolNames:105](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L105)。修改临时 agent.json 的 tools 后，既有句柄立即从 view_bitmap 变成空数组。提示词文件也在 render 时重新读取。与 C2 的本次定义固定要求冲突。

**解决方案：** 启动时一次加载本次 agent 配置、模板和工具说明，形成不可变快照；能力判断与注册使用同一份快照。下次启动刷新；已有 thread 要改变定义时按契约新建会话。

**验收：** 修改磁盘文件不会改变在途调用；新调用看到新版本；main、repair 和生图权限来源一致。

### 4. P2：工具目录缓存跨运行保留，下一次调用可能仍用旧 schema

**证据：** [tool-config.ts:60](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/codex/tool-config.ts#L60)。缓存只以知识目录和 overrides 路径为键。同进程将临时 schema 默认值从 1 改为 2，再次查询仍返回 1。该文件注释承诺修改对下一次 workflow launch 生效。

**本轮实现：** 删除跨运行的 ToolCatalog 全局缓存，组装工具时直接读取定义。实际会话仍按既有机制注册工具，不新增缓存刷新或工具管理框架。

**验收：** 在途调用保持旧 schema，下一次同进程调用使用新 schema。独立新进程本来会清空缓存，本项是长进程或直接嵌入调用条件下的风险。

### 5. P1：已声明但未提供的工具被静默丢弃

**证据：** [knowledge.ts:126](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L126)。agent.json 声明 view_bitmap，而 provided 为空时，tools() 返回 []，没有错误。C2 要求实际工具符合声明。

**本轮实现：** 对非宿主原生工具，缺执行实现时在启动阶段报错，包含 section、step、role 和工具名；对原生 imagegen 等由宿主提供的能力建立明确映射，不能无差别报缺 handler。

**验收：** 缺普通 handler 在调用模型前失败；已登记的原生工具按现有能力规则正常注册。

### 6. P1：agent.json 的提示词文件路径可以逃出知识根目录

**证据：** [knowledge.ts:94](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/knowledge.ts#L94)。initial 写入 ../../../outside.md 后，render 成功读取知识目录之外的文件。违反 C1/C3 的来源边界；现有模板无需包含这种路径才能触发。

**本轮实现：** initial 只能使用步骤或 shared 的知识相对路径，拒绝绝对路径和 `..` 越级路径。保留现有 group 覆盖；不附加符号链接规则。

**验收：** .. 和绝对路径在启动时拒绝；合法步骤覆盖和 shared 模板正常工作。

### 7. P1：九轴 agent 返回值没有执行其声明的结果 schema

**证据：** [结果 schema:68](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/run.ts#L68)、[结果处理:129](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/run.ts#L129)。schema 要求 error 字段，实际只读取 JSON.parse(...).error；模拟返回 {} 被 createFitHead 接受。代码行为没有执行自己声明的协议。

**本轮实现：** 在共享结果处理入口验证完整形状：对象、必需字段、字段类型和额外字段；不能只依赖 CLI 对 outputSchema 的遵守。

**验收：** {}、数组、error 为布尔值及额外字段均明确报协议错误；合法 error:null 成功，合法错误字符串失败。保留原会话和工程。

### 8. 任务名规则（前次判断已纠正）

**复核：** 前次 `_case` 只通过了底层 taskDirectory，而 [实际总入口 directoryFor](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/workflow/state.ts#L56) 已检查首字符、允许字符和长度，CLI、Web 都调用它。因此“完整路线可能晚失败”的结论没有成立。

**本轮处理：** 网页新建任务 input 加入相同 pattern/maxlength，让用户提交前看到已有规则；不改变独立 part 的历史名称兼容。

### 9. section 根目录是链接时会写到链接目标（撤销违规判断）

**观察：** 复现时人为将临时 section 目录设为符号链接，共享循环的文件写入落在链接目标。这是操作系统解析路径的行为，管线没有为任务自动创建该链接，也没有证据表明当前作者任务使用它。

**处理决定：** 用户契约只有相对任务根路径和原值绝对路径，没有禁止链接。本项不作为契约违规，不增加链接配置、拒绝链接或新的输出路径限制。

### 10. stat 跟随文件链接（撤销违规判断）

**观察：** stat 查看链接指向的文件，lstat 查看链接本身。原建议用 lstat 拒绝链接产物，其实增加了用户没有约定的限制。

**处理决定：** 撤销该建议，维持原文件检查。与第 9 项一样不改代码，不把底层文件系统行为算作用户契约缺陷。

### 11. P2：空文件会让选帧入口跳过 agent

**证据：** [turn.ts:262](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L262)。selected-frames.json、left.png 和 frames/left.png 全为空时，runFrameSelection 仍不调用 select。后续 checkSelectedFrames 会拒绝，因此不是无条件误标完成；问题是恢复入口先把残缺交付视为可沿用。

**本轮实现：** 跳过前复用选帧记录和 PNG 的实际校验；残缺数据明确进入当前步骤的修复或已有重试入口，保留可用帧。

**验收：** 空、损坏或缺字段文件不能静默跳过；合格完整成果保持不重选；不追加视觉审核轮数。

### 12. P1：视频复用没有校验实际首帧内容

**用户决定：暂不实施。** 已生成产物的主动重生成规则留待统一设计。

**证据：** [pitch 缓存:216](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L216)、[corner 缓存:240](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L240)。临时首帧内容从 A 改为 B，路径、模型和提示词不变，再调用 producePitchVideos 仍沿用旧视频，生成调用数保持 2。corner 复用还会将旧记录的 first 改写成当前路径。

**原建议已撤回：** 本轮不采用首帧/裁框指纹或 SHA 校验，也不按输入、模型、提示词变化自动废弃已生成产物。继续时以实际 MP4 产出为准，相关统一设计没有实施。

**本轮边界：** 不把暂缓的指纹及主动重生成方案写成已完成保证。

### 13. P1：成功视频未记入汇总时可能被重复生成

**证据：** [turn.ts:219](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L219)、[汇总落盘:228](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L228)。up 成功落了 MP4，down 失败，videos.json 未保存；重试时 up 的模拟生成函数再次执行。真实服务对应重复生成和费用风险，本轮没有真实费用。

**本轮实现：** 每个方向首先检查实际非空 MP4，有文件就保留，仅补缺失或空文件。等待本批各方向结束后返回结果；某方向失败不删除其他方向产物。videos.json 保留为说明记录，缺失不触发重新生成，没有新增恢复记录或指纹。

**验收：** up 成功/down 失败后再次运行，up 的生成调用数保持 1；两支最终汇总正确，未丢旧产物。

### 14. P2：视频 timeout 没有约束 HTTP 请求和下载

**证据：** [call:78](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L78)、[超时检查:103](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L103)。HTTP fetch 只有调用方 signal，timeout 只在两次轮询之间检查；timeout=1ms 的隔离调用经过约 54ms 请求仍成功返回。慢响应体或挂起请求不能靠这一选项及时结束。

**本轮实现：** 从本次视频调用开始建立总期限 signal，与用户取消信号合并，并用于提交、查询、等待和下载；保留现有期限，不增加请求重试。

**验收：** 模拟提交、查询或下载挂起时均在配置期限内退出，取消能提前结束；保留服务已分配的请求 ID。

### 15. P2：视频轮询的 abort 监听器在正常等待结束后不清理

**证据：** [turn.ts:85](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L85)。三次正常轮询完成后 signal 上仍有三个 abort listener。等待前也没有已取消状态检查。

**本轮实现：** 使用支持 AbortSignal 的 timers/promises 等待，或在完成/失败两侧移除监听器，并在等待前检查取消。

**验收：** 任意轮询次数结束后无新增监听器残留；已取消信号不进入完整的下一次等待。

### 16. P2：空 HTTP 200 下载被接受为视频结果

**证据：** [turn.ts:111](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/nine-axis/turn.ts#L111)。缺 Content-Length 的空正文返回 bytes.length=0，generateVideo 正常返回；非视频正文同样没有容器校验。后续阶段可能才报错。

**本轮实现：** 空下载正文、空生成结果不能落为成功 MP4；实际非空文件是视频部分的产出依据。不增加 SHA、指纹、媒体验证清单或其他 section 的 FFmpeg 依赖。

**验收：** 空正文明确拒绝；非空视频字节可正常保存，实际抽帧错误仍由 FFmpeg 报告。未增加其他 section 的 FFmpeg 依赖。

### 17. P1：选中非标准文件名的 FFmpeg，裸命令可能调用另一份软件

**证据：** [检查:12](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/ffmpeg.ts#L12)、[环境:45](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/shared/ffmpeg.ts#L45)、[现有选帧提示词](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/knowledge/nine-axis/step03_frames/prompts/选帧.md)。ffmpeg-custom 能通过版本检查，但其目录加入 PATH 并不会将它命名为 ffmpeg；隔离执行裸 ffmpeg 调用了 PATH 中另一份模拟程序。

**本轮实现：** 将抽帧操作封装到正式声明的工具，执行实现内部消费选定的完整路径；agent 只提供视频、帧号/时间点和输出位置。工具 schema 放代码、说明与调用约定放 knowledge，不向制作提示词动态拼路径，也不自动安装软件。

**验收：** 标准、非标准名称和带空格路径均使用选定文件，其他 PATH 软件不被调用；选帧 agent 无需处理可执行文件路径。

### 18. P1：视觉压缩辅助模型的固定指令仍硬编码在 TypeScript

**证据：** [visual-context.ts:144](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/patches/shared/visual-context.ts#L144) 定义 summaryInstruction；summaryBody 将它放入辅助模型的 user 文本，还用代码生成说明性历史标记。隔离 capture 确认发出的第一段为 Summarize the historical images actually provided below...。

**本轮实现：** 原固定指令逐字迁入 `knowledge/shared/prompts/runtime/visual-context-summary.md`，与恢复模板一样由 knowledge 管理。启动检查及压缩器构造阶段拒绝缺失/空文件，发辅助请求前失败。保留既有压缩、原图和协议记录，不新增制作指令。

**验收：** 辅助模型的任务正文可追溯到声明模板；代码没有私自新增指令段落；原图片、摘要与工具调用配对的现有验收继续成立。图片压缩功能已有 [patches README](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/.agents/skills/live2d-maker/patches/README.md#图片容量保护) 说明，本项是其固定文字来源与本次约束的潜在冲突，未擅自改写或关闭该功能。

### 19. P2：手动停止扫描和完整扫描使用相同完成状态与结论

**证据：** [software-scan.ts:111](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/web/software-scan.ts#L111)、[settings-dialog.js:40](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/web/settings-dialog.js#L40)。停止后只写 finishedAt，SIGTERM 不记错误；未完整扫描且 found 为空时，界面也显示扫描结束/没有找到。隔离停止扫描确实得到 scanned:0、finishedAt 和空结果，没有 stopped 状态。

**本轮实现：** 共用扫描状态增加 stopped/completed 的区别；停止时显示“结果尚不完整”，保留已发现路径；完整扫描结束才给未找到结论。

**验收：** Krita 与 FFmpeg 使用同一逻辑；手动停止、扫描完整结束、进程失败三个状态分别正确展示。

### 20. P2：停止扫描请求失败后，前端不再轮询

**证据：** [settings-dialog.js:57](https://github.com/kubeela/AstraLayering/blob/fc9ee8915249dcdc9da0e461ea57bbbe25040619/web/settings-dialog.js#L57)。点击前清理 timer，POST 失败的 catch 只写错误。Linux Chromium 模拟停止接口 HTTP 500 后等待 1.1 秒，新增 GET 为 0，按钮仍显示停止扫描。

**本轮实现：** 操作失败后在对话框仍打开时重新读取状态，并按实际 running 状态恢复共用轮询；保留 revision 对旧响应的保护。

**验收：** 模拟 start/stop 暂时失败后进度能够恢复；关闭对话框仍结束轮询；两项软件互不覆盖 timer。

## 已核对但未算作新增违规的行为

- workspacePrompt、interrupted-task、outline/raster recovery 的文字来自已有声明的 runtime Markdown；Nano 背景适配也有明确的 Markdown 外层模板及文档契约。它们与临时编写 FFmpeg 指令段落的来源不同，未擅自移除这些既有机制。
- 全局 FFmpeg 清空后，旧任务仍可回退到 run.json 的旧路径，这一行为已隔离观察。总调度保存参数以及 Krita 的同类回退都有文档背景，当前对空值应表示“清除”还是“禁用回退”没有足够明确的产品约定，因此没有拿它充作第 20 个违规项。若后续约定清空即禁用，可在 Web 协议区分缺省、明确清空和指定路径，同时保留 CLI 的记录恢复。
- 旧审查 M1–M6 不能全部算作当前缺陷：现行 shared README 已记录受控编辑修复，并明确结构诊断仅提示是用户批准行为。没有将这项已批准行为升级为强制交付门禁。

## 证据与处理次序

隔离复现脚本及 JSON 留在 `.web/contract-audit-*.mjs`、`.web/contract-audit-*.json`；原图/截图和交付记录另存于本机 `AstraLayering-release-readiness-evidence-20261110`，不提交测试缓存。总证据文件 contract-audit-evidence.json 记录第 1 项的修复及第 2–20 项的触发观察；第 9、10 项使用共享循环和文件元数据验证，未把它们写成完整生产路线验收。

当前处理范围以文首用户决定为准，第 8、9、10 项不再作为待修契约违规，第 3、12 项暂缓。新验证证据位于 `.web/contract-corrections-browser.json` 与同名截图，和原审查复现分开保存。

## 本轮验证

使用本地样本视频、模拟视频 HTTP、模拟 agent 和临时任务验证：同进程知识隔离、工具缺实现、返回 schema、选帧完整性、成功 MP4 保留、超时/取消、空下载、非标准名称及含空格路径的 FFmpeg 工具调用，以及 runtime 模板缺失/为空的快速失败。视觉压缩原图、工具配对和签名保护回归继续成立。

Web 验证任务参数保存、启动/续跑传参、全局默认与已有任务分离，以及共用扫描停止/完成区别和失败后的轮询恢复。未调用真实模型；Windows/macOS 仍无实机结果。
