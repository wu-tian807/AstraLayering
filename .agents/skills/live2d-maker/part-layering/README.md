# part-layering

启动条件见 [安装与前置](../references/setup.md)。Nano 生图的透明后处理使用 Node／Sharp 双背景差分，不要求 Krita、Python 或自动装包。已有参考续跑不重新处理；后续 raster 的 Krita 前置条件由其管线检查。

运行根目录默认是 `<仓库>/.run`，独立安装时为 `<skill上一级>/.run`；`--dir <绝对路径>` 可更换根目录，显式路径不再额外套 `.run`。下文 `<运行根目录>/<name>/` 为任务目录。后续管线和续跑使用同一 `--name` 与运行根目录；相对输入从该任务目录解析。模型表列出默认值，可在 skill 根目录的 `.env` 配置。

包含参考准备、严格按层推进的分组流程和 Codex agent 调度。需要 Node 24.12+，先在 `live2d-maker` 运行 `pnpm install` 并完成 Codex 登录。参考准备使用官方 SDK，自定义函数工具使用同版本 App Server。参考准备、首次分组、轮廓绘制、review、整层去重、正面遮挡补全及直属 group/part 分析已接入；所有节点完成后由程序合并为 preview.svg，最后由 agent 规划并逐件检查遮挡层级，独立保存 occlusion.json。

在 skill 根目录执行本管线入口 `pnpm part-layering --name <运行名> [--image <角色图片路径>] [--groups <分组JSON路径>] [--jobs <agent并发数>] [--max-depth <制作层数>]`，程序使用当前 Codex 登录配置。组任务不设数量限制，按树的层级依赖进入队列；所有步骤共享的 agent 调用默认最多 3 个，用 `--jobs 2` 或 `-j 2` 调整。`--agents` / `-a` 是同一上限的兼容别名，不另设限制。

使用 SDK 自带的 Codex 运行程序，不需要自行定位 `codex.exe`。创建与运行会话采用官方接口：

```ts
const codex = new Codex();
const thread = codex.startThread({
  model: 'gpt-6.1-sol', modelReasoningEffort: 'high',
});
const { events } = await thread.runStreamed(prompt);
for await (const event of events) {
  console.log(event);
}
```

默认流程首次启动传入 `--image`，原图会复制到 `<运行根目录>/<运行名>/input/original.<原扩展名>`。续跑只需 `--name`，不依赖原图之前的外部路径。省略 `--groups` 时检查参考输出，缺少哪一步就执行哪一步；全部存在时不调用 preparation agent。显式 `--groups` 只读取已有参考，缺失直接报错。

参考准备完成后，同一入口进入 layering。省略 `--groups` 对应 `null` 输入，先读取 `<运行根目录>/<运行名>/part-layering/groups.json`：实际已有组时直接复用并继续进度；实际组为空时才调用首次分组接口，不另存首次完成标记。

显式 `--groups` 只选择本次运行已有树中的组及其子组，不创建新组，也不导入外部说明或完成状态。空选择、未知组、错误父子关系和缺少前置参考均报错。所选组的祖先及前面各层必须完整结束；同层去重已存在时可以单独继续所选分支。若整层去重尚未完成，须完整运行这一层，程序不会暗中启动或修改未选分支。

正式流程见 [layering-workflow.md](docs/layering-workflow.md)。一层取整棵树中同深度的组：先层内并行绘制、review 和返修；全部结束后统一去重；再层内并行执行补形、自检和子组分析。当前层全部结束后才启动下一层。

已收录的完整执行结构见 [jianma](https://github.com/wu-tian807/AstraLayering/blob/main/demos/jianma/part-layering/README.md)，直接采用标准运行格式：所有部位前三层的 86 个已完成节点、第四层 29 个已完成终止 part，以及替换后的最新 hair 均在同一棵树中。[交互预览](https://github.com/wu-tian807/AstraLayering/blob/main/demos/jianma/part-layering/previews/index.html) 可离线选择任意部位、层级和阶段；全部已执行补全均位于 `parts/`。

默认方案按职责使用 `gpt-6.1-sol`：preparation low，轮廓绘制／review medium，分组、去重、补全与深度 high；完整配置见[模型方案](../references/model-presets.md)。`shared/codex/agents.ts` 按所选职责配置运行。`CodexAgents.run()` 每次创建新会话；`createSession()` 保留原生 App Server 进程和 thread，后续 `session.run()` 在同一 thread 内开启新 turn。未配置 `tools` 的一次性调用通过 SDK 执行，函数工具调用使用 App Server 原生 `dynamicTools`，程序直接执行回调并返回文字或图片。`run.ts` 的 `runPartLayering(input, { steps, mergeSvg }, agentOptions)` 串联参考准备与组循环，返回 `{ references, layering }`。默认适配器位于 `shared/part/layering-steps.ts`，首次分组位于 `shared/part/initial-groups.ts`，绘制和 review 位于 `shared/part/outline-agent.ts`。

`shared/codex/agent-runtime.ts` 独立管理 agent 并发、临时错误分类和退避恢复，不依赖分组树或步骤。SDK、一次性原生任务和保留绘制会话均通过 `shared/codex/agents.ts` 接入同一运行实例的限制；空闲会话和退避等待不占执行位置。CLI 的内置重试先照常运行，SDK 的重连 `error` 与 App Server 的 `willRetry` 通知不会提前截断它；仅回合最终因容量、断流或临时服务错误失败时，在 5、10、20、40、60 秒后恢复，之后保持 60 秒，不设次数上限。恢复沿用 thread 与已成功的产物，不重新派发组或清空草稿；认证、额度、上下文、参数、文件校验和主动取消不自动重试。内置重试的源码核对、模拟服务验证及恢复边界见 [agent-runtime.md](docs/agent-runtime.md)。

`layering.ts` 负责按层编排，复用 `workflow.ts` 的并发队列；`groups.ts` 只持久化分组树，`artifact-facts.ts` 读取正式产物和报告，构建仅供运行中展示的步骤状态。每层执行以下阶段：

- `initialGroups`：首次识别直属组，仅在 `null` 输入且实际没有已有组时执行。
- `drawOutline`：组轮廓绘制与分块自检。
- `reviewOutline`：外轮廓、主要结构与去噪的严格 review。
- `reduceOutlines`：轮廓与 review 全部结束后，统一处理同层重复对象，保存到 `stages/outline-reduce/<组ID>.svg`；未修改组原样复制。
- `completeOcclusion`：读取去重后的 SVG，按部位提示词补直接遮挡。
- `checkCompletion`：程序检查原形保留、矢量结构和父范围；视觉合理性在补全回合中自检。
- `splitChildren`：基于完成轮廓识别直属子组；程序将子组登记到树并加入后续调度。

整树制作结束后先程序合并 `preview.svg`，再执行最后一步 `planOcclusion`，工作正文为 `prompts/11-遮挡层级规划.md`。大部分人体 part 使用一个 level；同动整体需要跨深度时使用 levels 的文本区域说明，不退回拆组。从后到前统一排序；`groups.json` 的包含关系和数组顺序不作为深度依据。只读 agent 结合原图、完整部件与必要的去重轮廓逐件核对；程序检查完整覆盖、重复 ID、深度顺序与漏检。候选修改后重新查看叠放预览并检查整件深度，输入 SVG 的已有观察可以复用。

正式深度表为本管线的 `occlusion.json`，独立于 `groups.json`。新写入版本为 v3，单深度保留 `level`，多深度用 `levels: [{ level, region }]`；每个逻辑 part 一条记录，保留 `id`、`note` 和逐件 `check`，多深度还须逐区域检查。全部数值属于同一从后到前的顺序，越大越靠前，不与数组位置绑定。v2 单深度仍能读取。

`stages/occlusion/candidate.svg` 每个完整 part 只叠放一次，多深度暂按最靠后数值排列；它不是精确分片预览，不能据此声称穿插已实现。实际 KRA 拆层由 raster step01 自行处理，并可通过精准工具写回此处深度表。输入指纹不因深度修正本身改变，因此不会触发上游重画；缺失、损坏或真实输入变化仍只重做最终规划。RGB 控制图仍由 raster 第一步即时生成。

首次分组仍只识别直属 group；子组分析返回混合 group/part 节点描述，不替程序标记进度。子节点与当前节点的 `childrenAnalysis: { sourceHash, note? }` 一起原子写入唯一的 `groups.json`，不再生成 `stages/children/`。元数据只保存分析所依据的完成 SVG 哈希及依据，不重复存子节点、ID 列表或步骤状态。有效分析搭配空子节点表示终止；初始树的空数组本身不是终止证据。明确的 part 完成制作与检查后直接终止。

`--max-depth 1` 只完成第一层并登记第二层，`--max-depth 2` 制作到第二层并登记第三层，以此类推；省略则按层继续。这个参数控制本次执行边界，不作为把 group 判成 part 的依据。

拆分通用正文是 `prompts/10-直属结构拆分.md`，完整 ID 下的 `children.md` 优先替换；`prompts/10-拆分操作约定.md` 始终追加。只读 agent 查看完成稿的独显和 blend，按需裁剪原参考，通过 `submit_children` 一次提交直属 name/kind/note。程序生成路径 ID，拒绝重复名、嵌套子树、无效类型与只有一个 part 的包装组。已配置 face、hair、body、neck、pelvis、arms、legs 及标准眼、嘴、鼻、手臂、手、腿、前后发的拆分先验；其余对象用通用判断。左右按角色自身，breast 一件，手指不拆指节，每侧下肢分 leg 与 foot，膝部与脚趾不再细拆。

首次分组读取本模块 `prompts/4-初始分组.md`，agent 的工作目录设为 `<运行根目录>/<运行名>/part-layering`，程序明确传入参考准备完成的素体图绝对路径，不预先附图，也不让 agent 自行寻找目标图。它用内置 `view_image` 观察整体，按需裁剪放大细节。人体头部在第一层拆为 `face`（脸部、五官、耳朵）、`hair`（全部头发、发髻）、`head_accessories`（头部装饰物，含其长飘带）；脸部说明明确只补脸型与耳朵，不补头顶与后脑。`neck`、`body`、`arms`、`pelvis`、`legs` 的范围及临时连体服不分组要求沿用原版，无跨目录运行依赖。

首次分组注册 `view_bitmap({ path, crop?, scale? })` 和 `write_groups({ subject, groups })`。整体可用内置 `view_image` 查看，细节按需用 `view_bitmap` 裁剪放大，观察图保存在 `observations/initial-groups/`。分组工具绑定本次运行的正式 `groups.json`，校验组名、重复名称和一层 group 结构，再以 `name` 生成稳定 `id`，保留 `note`。无效输入不写入；已有组时拒绝覆盖。工具与调度器共用 `GroupStore` 写入队列，agent 不能通过工具修改制作进度。分组保存必须调用 `write_groups`，不再通过 terminal 写临时 JSON。最终回复不参与解析；没有成功调用写入工具时失败。调度器只发起一次识别任务，临时服务中断由 agent 调用层沿用会话恢复；实际已有组时继续现有进度。

组轮廓绘制和 review 的通用提示词为 `prompts/5-组轮廓.md`、`prompts/6-轮廓review.md`，复用迁移流程的轮廓色块及独立审查要求，适配为每次只产出当前组的独立 SVG。agent 收到素体参考、组说明、完整画布尺寸，以及父组完成 SVG（如有）。绘制 agent 优先用绑定的 `write_outline_svg` 写草稿，也可用可用的本地文件接口；以 `preview_svg` 先看整图，再裁剪放大，用 blend 和 edge 逐块自检全部可见区域；程序读取实际文件，校验 SVG、当前组绑定、画布及父范围后保存正式轮廓。草稿和失败返修不会覆盖此前已登记的有效 SVG。

绘制自检核对位置、比例、主要形状和形体归属，并分块放大检查可见边缘、接缝、孔洞、开口和尖端；发现问题先修正，再复查改动处及相邻区域，确认未破坏已有正确形状。绘制须完整覆盖本组可见区域，包括与其他部件的接缝，边缘精确对齐原图，内部明暗分界不作为轮廓。严格 review 重点核对边缘走向、折线、折角、弧度以及轮廓是否超出或缩入参考，并清理来源不明的碎发丝、孤立点和形体混乱；接缝漏画和无依据留空须返修，不能因缺漏较小而放行。微小缺口在本轮依据参考和结构关系补成连续局部形体，不用碎点表示部位存在；可靠的可见边缘和有明确结构依据的分离区域须保留。大片直接遮挡仍由后续补形步骤处理。

绘制及返修通过 App Server 配置开启内置 `image_generation`，review 和首次分组关闭。噪音或结构难辨时可基于原参考局部生成放大辅助图，要求结构清晰优先、不添加原图不存在的细节、不改变已有形状及可靠边缘；生成图仅辅助辨认，继续对照原参考绘制 SVG。同一处问题只生成一次是提示词约束，不是程序调用上限。返修附加要求单独放在 `prompts/7-轮廓返修.md`。本轮仍按实际 SVG 文件交付，不要求生图任务的最终 JSON。

同一个组的一次绘制任务保留一个绘制会话，首次绘制与返修沿用其 thread；每次严格 review 均创建新的只读会话，审查后关闭。review 通过 `submit_review` 保存 `pass`、`revise` 或 `blocked` 及具体意见，最终回复不参与解析。每组最多提交两次正式 review：绘制并自检 → review 1 → 按意见返修并自检 → review 2 → 再返修并自检，然后直接进入下一步，不启动第三次 review。任何一轮 pass 则提前进入下一步。轮数按本组 pass / revise 审查报告累计；blocked 保留记录但不占正式审查名额，重启不清零，临时服务重试不另计一轮。blocked（无法核对）与执行异常仍保留原有处理，不视为返修成功。续跑先落实尚未完成的返修意见；报告以 repairedCandidateHash 记录已完成返修的 SVG，避免中断恢复后重复返修。审查原结论保持不变；两轮意见修正完成后，review 步骤登记 completed，output.reviewOutcome 为 repaired，表示流程完成而非 reviewer 给过 pass。终端显示已按第 2 轮意见返修并自检、不再复审。会话复用和审查循环由程序控制，工作提示词不解释会话管理规则。任务结束、暂停或异常时关闭绘制会话；跨启动不保留活动会话。

每次返修分别保存到 `stages/outline/<组ID>.repairs/<序号>/`，其中 `feedback.txt` 是返修意见，`prompt.txt` 是实际发给绘制 agent 的完整提示词。序号从 1 递增，续跑接着已有序号，失败回合也保留记录，不覆盖前几轮。每轮完整输入仍分别保留在 `agents/<时间-步骤名-唯一后缀>/request.json`。独立审查报告保留各轮反馈、候选和观察记录。原生生图事件及修订提示词记录到 `events.jsonl`；工具返回的已保存图片路径登记到 `result.json`，可读日志省略图片二进制数据。

特化提示词按完整组 ID 查找：`prompts/groups/face/outline.md` 替换 face 的绘制正文，`prompts/groups/face/review.md` 替换其审查正文，`prompts/groups/face/eye/outline.md` 只作用于 face/eye。两个步骤独立选择；对应文件不存在时用通用正文，空文件报错，不继承父组特化。程序继续附加组、参考、父 SVG 和画布等运行输入；绘制收到草稿输出路径，review 收到候选 SVG 和审查报告路径。实际来源和全文保留在 request.json 中。详见 `prompts/groups/README.md`。改提示词不自动重做已完成步骤。

`preview_svg` 支持 `svg` 白底独显、`blend` 半透明混合和 `edge` 红色边缘叠加，支持原图坐标裁剪 `crop` 和矢量放大 `scale`，直接返回图片并保存到 `observations/<步骤>/<组ID>/`。子组同时返回父范围检查；父子 SVG 在同一画布上宽、高各四倍渲染，先计算 `max(子 alpha - 父 alpha, 0)`，再用阈值 128 判断未覆盖采样，避免独立二值化把共用曲线的抗锯齿差异误判为越界。允许正常贴边和共边，不扩张父轮廓，不按越界数量放行；任一未覆盖采样达到阈值即失败。孔洞、分离区域、变换与裁剪沿用实际 SVG 渲染。报告的 `scale` 固定为 4，不受预览选框或倍率影响；`outsideSamples` 为越界采样数，`outsidePixels` 为除以 16 后的原图像素面积估算，`outsideBox` 为原图坐标，可有四分之一像素的小数。范围渲染沿用 1 亿像素的资源上限，有限采样不是数学上绝对包含的证明。输入 SVG 不修改。独立审查记录及每轮实际观察图路径保存在 `stages/review/<组ID>.review.json`。通过后进度直接引用已绘制的轮廓 SVG，review 不生成或复制 SVG；后续补形沿用该路径。

`groups.json` 保存主体、唯一分组树，以及各组必要的分析输入版本和依据。新运行不创建或读取 `progress.json`；旧机器的绝对路径不再参与续跑。轮廓完成看正式 SVG；review 轮次、结论和返修落实情况读取 `.review.json`，并核对候选或 repairedCandidateHash。哈希兼容 LF/CRLF 签出。自检结论保存在 `stages/completion-check/<组ID>.json`，绑定去重与补全版本；分析版本来自组树自身。旧 `stages/children` 仅作兼容迁入，保存树后即不再依赖它，新运行不会写它。没有另一份子组定义或步骤状态矩阵。

所有 SVG 制作接口统一收到 `.draft.svg` 路径，正式文件只在任务成功并验证后发布。草稿、失败回合和仅有 `.repairs` 目录不代表完成。轮廓为 `stages/outline/<组ID>.svg`；去重结果为 `stages/outline-reduce/<组ID>.svg`；补形为 `parts/<组ID>.svg`；最终预览合并为 `preview.svg`，同目录保留对应的 `groups.json`。补形和补形自检的 before 均读取去重版本，子组仍以父组完成 SVG 为范围。完成文件携带必要的输入版本信息，旧输入下的自检或分析结论不能用于新版本。

续跑按父层到子层、逐 part 恢复事实；只有当前父节点完整完成，才恢复子节点。去重记录中的每一行独立核对本件输入/输出，某件 outline 缺失不会清掉同层其他有效部件。统一入口开始新制作前，撤下本件失效的正式文件和草稿；outline 失效同时撤下该件旧 review。去重仍查看整层，未修改的有效去重结果原样保留；只有实际输出改变的 part 及真实引用者才撤销补全、自检和依赖后代。子组分析失效时先清后代文件，最后撤销旧分析和子树。最终 preview/occlusion 依赖整套有效部件，输入不齐时失效。同一候选的待返修 review 保留累计轮次。

清理完成后才发布新产物。即使重建的 outline 与旧版字节相同，该件旧 part、自检和合并也已撤下；中断后仍须生成新补全。只读 `GroupStore.open` 不删除文件。补全输入记录为 `stages/completion-inputs/<id>.json`，绑定正式 SVG 和本次实际使用的图片/同级 SVG 哈希；引用组还须有有效的对应阶段。记录在正式补全前写入，正式稿有版本标记，记录缺失或不匹配不会恢复。旧稿只在未声明额外参考时兼容；声明了引用却缺版本证据的旧补全仅重做该件。失效输入记录保留引用证据，不单独构成完成事实。特化提示词或参考清单编辑本身仍需显式安排重跑；已有输入记录中实际文件的变化会使其真实使用者失效。原始参考、agent 日志及 `.repairs` 诊断保留；不自动清理其他 raster 目录的 PNG/Krita。

轮廓绘制和返修提供 `write_outline_svg`，只接受完整 SVG 文本，写入程序绑定的草稿并检查画布、组标识和父范围；不接受自选路径，不发布正式稿，也不替代预览自检。终端不可用时仍可继续制作。绘制和 review 均提供 `view_bitmap` 裁剪本次运行内的参考图，`preview_svg` 对照 SVG。group 轮廓需覆盖所属的独立组件；“不审组内细节”不豁免眼褶线、链与吊坠等完整组件的漏画。

去重同样提供 `write_reduction_svg`，以本层 `groupId` 和 SVG 文本写入绑定草稿；未知组、自选路径及错误归属会被拒绝。每次重写清除该草稿的旧预览记录，须重新查看后才可提交，源轮廓保持不变。

绘制、review、去重与补全提供只读的 `read_svg`，读取本轮明确传入的源图、父图或指定草稿源码，便于复用共享曲线。它不依赖终端，不允许读取其他路径或通过链接逃逸运行目录。长源码按字符 `offset` 与 `limit` 明确分页，默认每页 16000 字符、最多 65536 字符，返回文件哈希、总长度与 `nextOffset`；部分页面不会标成完整 SVG，单文件超过 8 MiB 报错。读取不会记录视觉观察，也不能替代 `preview_svg` 自检。工具定义随进程启动加载，已经运行的会话继续使用原定义。

group 的组件覆盖按联合色块判断。踝饰等完全落在本组底形内部时，内部边界留到子层，不因缺少独立 path 判为漏画；联合色块外的独立眼褶线、链坠外露部分等仍须覆盖。

子组 review 区分父范围内的可修缺漏与父底稿已有的范围限制。只有扩大父范围才能恢复的参考区域，在 feedback 中明确记录为上游问题，不要求子组越界修复；父内可修问题仍须返修。该区分不改变程序的严格父范围检查，也不表示上游参考偏差已经修好。

整层去重使用 `prompts/8-同层轮廓去重.md`，先查看带组色的合成预览，再分别检查疑似重复区域。分组名允许分类上的宽容；合理遮挡重叠不直接相减。增量运行的有效旧稿作为 `sourceSvg`，另提供 `originalOutline` 和 `reusedReduction`；未修改的有效旧去重结果保留，不能恢复成去重前的原轮廓。新输出与正式稿逐件比较，只在实际变化时清理该件及其引用者，再发布新稿，最后原子提交 `stages/outline-reduce/layers/<深度>.json`。恢复逐行核对版本，缺失或不匹配的某行不能放行该件，不连带撤销其他有效行。显式选择允许查看同层未选组作去重复核，只把实际改变的组及真实引用者加入后续制作。空去重稿仍由程序跳过模型补形。

正面遮挡补全使用 `prompts/9-正面遮挡补全.md`；`prompts/groups/<完整ID>/completion.md` 可完整替换正文。face 已配置脸型与耳部的指导，不补头顶、后脑或五官。旁边的 `completion.references.json` 可显式列出 `{ "path": "参考图.png", "description": "参考用途" }` 数组，路径相对清单目录；无清单则仅使用本次素体参考，不继承父组参考。即使正文回退到通用提示词，也读取当前完整 ID 下的清单。配置图只用于形状先验，不替代当前角色可见部分。

补全清单也支持 `{ "sibling": "palm", "description": "同手实际掌片" }`，仅显式引用当前父节点下其他直属节点的已审查、去重底形；运行器生成参考 PNG，并将只读源 SVG、版本与用途交给模型，避免依赖同级补全的并发完成顺序。左右手的 `thumb`、`index_finger`、`middle_finger`、`ring_finger`、`little_finger` 十个完整 ID 均配置手指连接先验与同手掌片参考；`hand` 和 `palm` 不套用手指伸入侧提示词。详见 `prompts/groups/README.md` 的适用表。改配置不自动重做已有结果，验证时须删除所测 part 的正式补全 SVG 和对应 completion-check，再从统一入口续跑；轮廓、审查和整层去重可复用。

十指另显式附加 Milly／樱桃的完整指体图例，实际补全图片输入为当前角色、同手掌片、完整指体参考板。用途是核对被遮指身、近端厚度和局部搭接，不能以连通或根端相交替代完整形体验收，不照搬第三方姿势、宽度、朝向和肤色。图片与来源见 `prompts/groups/arms/references/fingers/`；沿用第三方像素本地忽略约定，缺少已配置图片时明确报错。此参考仅作用于 completion，不自动传入 outline/review，也未重跑现有十指。

固定操作约定放在 `prompts/9-补全操作约定.md`，始终追加到本次输入后。每次补全调用重新读取文件，正文及来源路径写入 request.json；文件缺失或为空时直接报错。调整约定无需改代码，程序的原形保留校验仍独立执行。修改提示词不自动重做已有正式补全。

补全 agent 只读输入，通过 `set_completion_paths` 提交新增闭合路径，程序在原 SVG 正文前插入固定的新增层，使其绘制在原形下方。不接受自由 SVG、样式、变换或其他属性。每次重设新增路径后必须重新预览当前草稿的独显与 blend，再由 `submit_completion` 提交遮挡依据。发布前和事实恢复时均验证原正文及全部属性保留，只有必要的输入版本标记可由程序更新；自定义补全适配器也受同一校验。`checkCompletion` 程序核对原形、矢量结构和父范围；视觉合理性来自补全 agent 的提交前自检，不额外创建一轮独立 review。范围仅为当前正面被遮住的轮廓，不扩展到侧面、背面或转身结构。

全部节点完成后默认调用 `mergePartSvgs`，生成 `preview.draft.svg` 并原子发布为 `preview.svg`，不调用模型。只绘制终止叶节点，按 `groups.json` 树顺序嵌套，后项在前；父组只作为保留完整 ID 的逻辑容器，不重复绘制制作底稿。各 part 保留画布、路径、变换和填充，并隔离本地资源 ID；SVG 内记录用于校对分组的 ID／父子关系／kind。完成事实绑定当前树与部件版本，续跑复用，部件或树顺序变化后重建；深度限制留下未完成后代时不会合并。此文件是部件预览，不代表着色或绑定交付。

打开仓库的 `loading/part-preview.html`，加载 preview.svg、参考图与对应 groups.json。只支持 A/B：混合、两侧对比、滑动对比、描边；描边优先取 A 中的 SVG，否则取 B，并叠到另一张图上。未载入匹配分组时隐藏右侧控制；匹配后只显示实际有图形的节点与祖先，点击画布会定位右侧条目。局部单部件 SVG 按完整 ID 匹配子树，最终 preview.svg 还会核对内嵌的整树结构。显隐与描边仅影响页面，不回写文件。

顶部文件卡片悬浮提示“单击更换”，双向箭头交换 A/B，B 和 groups.json 右上角的 × 移除对应文件。“下载”可导出整图或当前放大区域的 PNG，保留对比方式、比例、描边、背景和显隐；整图按原图尺寸，当前区域按屏幕像素密度输出，均不包含工具栏和侧栏。

先准备 `standard.png`：默认直接复制原图（非 PNG 转换为 PNG）；`--standard` 时用 preparation agent（默认 `gpt-6.1-sol-low`）判断嘴部张大、眼睛张开、正视站立、双手位于身体两侧，已符合则复制，否则使用本步骤配置的 image_generation 调整。不额外增加视觉 review，原有画风及换装提示词不变。

随后判断角色是否需要转换为目标参考图的现代日式二次元 Live2D 立绘画风：清晰动漫线稿、干净平涂、硬边二分光影。判断时同时传入标准参考 `standard.png` 和目标画风图，输出 `needsSimplification` 及一句依据 `reason`。姿态、构图、表情和背景不作为简化条件。需要简化时转换画风，否则复制标准参考；简化保留角色设计、衣装、配色与姿态，允许五官画法和头身比动漫化，不锁定原图的半写实脸型与渲染。随后统一进入素体换装，将角色图与连体服款式图一起传入，沿用上游画风、姿态、表情和比例。

简化和素体 agent 通过 SDK 配置显式启用 Codex 内置 `image_generation`。两个生图提示词文件只保留简短的绘制要求；`preparation-agents.ts` 统一附加执行规则，要求 agent 将绘制提示词原样传给生图工具，不自行扩写，只调用一次、生成一张图，生成后直接交付，不检查、返修或重试。这是提示词约束，当前 SDK 没有直接的工具调用次数上限。成功返回 `{ "savedPath": "实际图片路径", "error": null }`，失败返回 `{ "savedPath": null, "error": "失败原因" }`。程序读取真实文件，验证 PNG 签名，再保存到本次运行的 references 目录；这是文件有效性检查，不涉及视觉评价或模型返修。

自定义 function 工具通过 `AgentTask.tools` 注册，类型位于 `function-tools.ts`，包含名称、说明、参数 JSON Schema 和 `execute(argumentsValue, signal)` 回调，无需 MCP 服务或修改全局配置。`tool-agent.ts` 启动 SDK 自带的同版本 Codex，使用 `initialize` → `thread/start(dynamicTools)` → `turn/start` → `item/tool/call` 链路。原生 dynamic tools 属于[官方实验性接口](https://developers.openai.com/codex/app-server#dynamic-tool-calls-experimental)，升级 Codex 版本时需要核对协议。首次分组和绘制开放自带 terminal，使用 `workspace-write`；独立 review 使用 `read-only`，报告和预览由程序工具保存。绘制会话延续时工具定义保持一致，回调绑定当前回合；各组会话独立。超时、失败或提前退出保留日志，调度器统一清理会话。

目标画风参考位于 `resources/简化参考图片.png`，供判断和简化两个步骤使用。连体服款式参考位于 `resources/连体服参考.jpg`，复制自迁移流程的 `可复用结果.jpg`，在素体换装时作为第二张图片输入；仅参考款式，按目标人物的姿势和体型贴合。所有固定提示词和参考资源都来自本模块。

每次 agent 调用都在 `<运行根目录>/<运行名>/part-layering/agents/<时间-步骤名-唯一后缀>/` 下实时保存：

- `request.json`：任务提示词、图片路径及说明、实际拼接的用户提示词、输出 schema 或函数定义、模型、推理强度、超时和工作目录。不保存认证密钥或环境变量。
- `events.jsonl`：带时间戳的 SDK 事件或 App Server 协议消息，逐条追加，包括中间更新、工具参数和图片结果；发送的用户运行配置省略以避免记录凭据。
- `transcript.log`：可读的过程消息、公开的思考摘要、工具调用信息与结果、错误和完成状态。图片的 base64 数据只在原始事件中保留，可读日志中使用简短标记；实际预览 PNG 也单独保存。
- `result.json`：完成／失败状态、会话 ID、用量、耗时、最终回复、图片路径或错误。解析失败、超时和中途退出也保留已写入的过程记录。

终端同步显示步骤进展和日志位置。这里只记录实际发出的事件与公开摘要，不代表完整内部推理。SDK 不提供实时 stderr 事件；它在进程异常退出时给出的错误会写入结果。App Server 失败时也保留进程错误输出。单独调用 `CodexAgents` 时默认保存到其工作目录下的 `.run/agents/`，也可通过 `AgentOptions.logDirectory` 指定位置。已有参考被跳过时终端会说明原因，不创建新的 agent 日志。

每次恢复另存完整请求与结果，前一次失败记录追加 `retry.scheduled`，包含尝试序号、等待时长与原因；终端同步显示等待。恢复不是新一轮视觉返修，不增加 review/feedback 序号。恢复请求明确要求继续未完成工作、复用已成功的工具提交和生图；生图不重复仍依赖提示词，程序没有另加工具次数限制。

底层 `runWorkflow(input, hooks, { maxDepth })` 只负责派发，由 `layering.ts` 提供以下接口：

- `preparation()`：可选，在循环初始化前执行参考准备。
- `initialize(input)`：恢复已保存的分组与进度；显式输入验证前置并选择已有组，`null` 且实际无组时调用首次分组接口。
- `ready()`：只返回全部祖先已完成的未完成组，显式输入再筛选指定分支。底层优先派发浅层就绪组，深度从树根 0 开始。
- `runRound(group)`：按固定顺序执行本组尚未完成的步骤；占位符返回待接入时停止本组本轮处理。

同层依赖满足的组全部进入队列，实际 agent 总并发默认 3，由 `--jobs` / `-j` 调整；组调度不另设并发上限。`layering.ts` 将同层任务固定成批次，前半段、整层去重、后半段依次完成，再发现下一层。`workflow.ts` 仍是通用并发执行器，相同 ID 在一次批次中只派发一次。`maxDepth: 1` 只处理深度 0。异常停止新派发，等待已启动任务收尾；后续依照已发布事实继续。

默认入口内部调用 `prepareReferences({ image, runName, dir, standard }, steps)`；显式组入口调用只读的 `loadPreparedReferences(runName, dir, standard)`。`image` 为可选原图路径，输出位于`<运行根目录>/<runName>/part-layering/references/`：

- `../input/original.<原扩展名>`（相对本管线目录）：首次原图只保存在任务根的 input，用于续跑和补齐缺失参考。
- `standard.png`：标准参考；默认不调姿态，开启 `--standard` 后先判断再按需调整。
- `../preparation/stepNN/`：参考准备的步骤目录，与 raster 共用 `shared/step-section.ts` 的 section/stepNN 驱动和 `shared/step-chain.ts` 的断链重试规则。编号固定：step01 original、step02 options（`options.json` 记录 `{ "standard": boolean }`）、step03 pose（`judgment.json` 姿态判断）、step04 standard、step05 judgment、step06 simplified、step07 base、step08 ready；本次不用的步骤（如未开启 `--standard` 时的 pose）留空编号。`.completed` 记录产物指纹与依赖戳。删除某步的 `.completed` 或产物即重试该步，依赖它的后续步骤随之重做，ready 重做时清空本 part 拆分缓存；已完成步骤的产物在中断期间被替换时拒绝续跑并保留文件。旧任务的 `references/.steps/`、`references/options.json` 与 `preparation.json` 在首次默认流程运行时一次性迁入并删除，指纹仍吻合的步骤直接沿用。
- `judgment.json`：原有画风判断，包含 `needsSimplification` 与 `reason`；兼容不含 `reason` 的旧记录。
- `simplified-subject.png`：需要简化时生成，否则复制 standard.png；旧任务仍可沿用原扩展名。
- `base-subject.png`：以简化参考和连体服款式图为输入生成素体换装参考。

续跑省略标准化选项会沿用保存值，`--no-standard` 显式关闭。已有输出须通过内容指纹校验；不匹配时保留文件并指出不能复用的路径。删除该参考后可重做，后续依赖仍逐项检查；重生内容不变则保留拆分，简化或素体内容改变后仅重置本人物 part 的拆分缓存。详见[续跑及旧任务兼容](../references/workflow-details.md#输入产物与续跑)。

`steps` 提供 `judgeStandard(image, prompt)`、`standardize(inputImage, outputImage, prompt)`、`judge(image, prompt)`、`simplify(inputImage, outputImage, prompt)` 和 `baseSubject(inputImage, outputImage, prompt)` 五个执行接口。每个需要执行的步骤会读取本目录内对应的提示词，并将完整内容作为 `prompt` 传入；跳过的步骤不读取提示词。

- `prompts/0-姿态判断.md`
- `prompts/0-标准姿态.md`
- `prompts/1-参考判断.md`
- `prompts/2-简化图片.md`
- `prompts/3-素体参考.md`

图片步骤结束后必须真的存在对应输出文件，否则抛出错误。没有额外完成标记，不生成线稿／素描。

提示词变更不会自动重做已有参考。验证新版画风判断和换装时使用新的运行名；原运行继续沿用原有输出。

agent 回合默认不设超时；正常入口不传时间上限。只有调用者显式传入 `AgentTask.timeoutMs` 时才按该值取消回合。终端的“agent 回合结束”只表示回合执行结束；最终按组展示 review 是否通过、返修、blocked 或失败，以及当前等待步骤。单组执行失败时停止新派发，等待已启动的组结束，错误结果包含组 ID、步骤、原因及进度路径；其余未启动待办保持未执行。

`pnpm check` 执行类型检查，`pnpm test` 验证参考准备、SDK 日志、原生工具、绘制会话复用与独立只读 review、SVG 预览和父范围、特化提示词、审查提交、两轮返修后继续及中断恢复、真实命令行入口和结果展示，以及组循环的 null 续跑、显式组范围与祖先前置拒绝、旧存储迁移、失败续跑、深度限制、分支并发补位、并发子组登记和合并接口。测试使用本地模拟执行程序和临时文件，不调用模型或生图工具。

共享安装、路径规则、工具配置和临时错误恢复见 [live2d-maker 使用说明](../SKILL.md)。所有相对输入路径从 `<运行根目录>/<name>/` 解析；本管线只管理自身目录。
