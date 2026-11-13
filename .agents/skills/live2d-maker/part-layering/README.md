# 人物分件与遮挡补全

从参考图准备标准参考、简化图和换装素体，逐层生成部件控制 SVG 与遮挡深度表，交给 [raster-layering](../raster-layering/README.md) 绘制 KRA。模型与默认力度统一见 [模型方案](../references/model-presets.md)，首次安装见 [setup](../references/setup.md)。

## 单独运行本 section

从 skill 根目录执行，数据位于 `<dir>/<name>/part-layering/`：

```sh
pnpm part-layering --name my-character --image /绝对路径/角色.png --knowledge /绝对路径/knowledge
# 姿态标准化按需追加 --standard；单独续跑须带同一选项（总入口续跑沿用总控记录）
pnpm part-layering --name my-character --knowledge /绝对路径/knowledge
# 只处理根层，登记下一层
pnpm part-layering --name my-character --max-depth 1 --knowledge /绝对路径/knowledge
# 选择已有组及后代，需已有参考、祖先与前层成果
pnpm part-layering --name my-character --groups /绝对路径/selection.json --knowledge /绝对路径/knowledge
```

`--dir` 为运行根目录，相对输入从 `<dir>/<name>/` 解析。`--jobs`／`-j`（别名 `--agents`／`-a`）控制全局实际 agent 并发，默认 3。`--max-depth` 从根深度 0 计数，1 制作根层，2 制作至第二层；省略则处理完整树。`--groups` JSON 按 ID 选择本任务已有组，沿用准备参考与前置事实；前层去重尚未完成时需要完整处理该层。独立调试先停止同任务总调度。

## 参考准备

输出 `references/standard.png`、`simplified-subject.png`、`base-subject.png`。标准化选项默认关闭，开启后先判断姿态再按需调整；原图保留在任务 `input/`。素体保留手套、鞋袜和各自饰件，主体衣装以临时连体服替换。步骤目录 `step01_original`～`step07_ready` 依次记录原图、选项、姿态、标准图、简化、素体与就绪，拆分步骤从 `step08_initial` 接续编号。

简化与素体各由一个 preparation agent 完成“判断 → 复制或生图”。简化 agent 另收到画风参考 [简化参考图片.png](../knowledge/part-layering/step05_simplified/references/简化参考图片.png)（只比较画法），素体 agent 另收到连体服款式参考 [连体服参考.jpg](../knowledge/part-layering/step06_base/references/连体服参考.jpg)。图1画法已足够简单（平涂色块、边界清楚、细节概括，有无线稿均可）时，简化 agent 直接复用，只在半写实、厚涂或晕染明显时转换；当前画幅没有主体衣装、角色已是素体或已有合适的临时连体服时，素体 agent 直接复用。复制工具 `reuse_reference` 绑定当前参考与输出位置，PNG 原样复制，其他格式转换为 PNG；需要转换或换装时调用本步骤配置的生图工具。两份完整提示词为 [2-简化图片.md](../knowledge/part-layering/step05_simplified/prompts/2-简化图片.md)、[3-素体参考.md](../knowledge/part-layering/step06_base/prompts/3-素体参考.md)。

简化与素体步骤各自直接保存最终图片及步骤完成记录。简化的选择理由只保存在 agent 调用日志；素体步骤另写 `step06_base/decision.json`（`{ version, dressed, reason }`）。`dressed: false` 时总控跳过两条衣服管线，组装沿用人物 KRA，阴影照常运行；没有 decision.json 的旧任务按简化图与素体像素是否相同判断，完整规则见 [workflow](../workflow/README.md#姿态与参考)。复制结果原样交付，生图结果在准备函数内部完成后处理；续跑依据已有图片与步骤记录复用。旧任务已完成的图片继续沿用，缺图时按当前单次 agent 流程制作。

preparation 完成后，总控同时推进人物线（本管线逐层制作 → raster）与衣服线（[clothing-part-layering](../clothing-part-layering/README.md) → 衣服 raster），两线共用同一 `--jobs` agent 名额，见 [workflow](../workflow/README.md#总入口)。已完成的参考与选项直接沿用；选项切换与重试规则见 [workflow](../workflow/README.md#姿态与参考)。生成图后处理见 [shared](../shared/README.md#参考图后处理)。

## 逐层制作

第一层按角色需要识别 face、hair、head_accessories、neck、body、arms、pelvis、legs；face 的范围为脸型和耳朵。完整树同深度的节点构成一层，固定本层名单后依次进行：

1. 各组轮廓绘制、自检、独立 review 与返修。
2. 全层轮廓结束后统一去重。
3. 各组直接遮挡补全、自检与直属 group／part 拆分。
4. 各父组补全、自检和直属拆分完成后，立即派发其子组描边与 review，可与本层其他组的补全、拆分并行。下一层统一去重仍等待本层所有父组拆分结束、名单固定且全部子组轮廓就绪；去重完成后才开始该层补全。`--max-depth` 和所选分支仍限制提前派发范围。

轮廓使用纯矢量色块，对照原图可见形体、开口、可靠边缘和联合覆盖；完整位于父底形内的纹样可留给下层。`write_outline_svg` 绑定指定草稿，`preview_svg` 提供独显、blend、edge 与局部观察。`read_svg` 支持本地 SVG 路径及带哈希分页；几何读取与视觉核对分别完成。

常规子轮廓受父完成范围约束。父内可修缺漏返修；贴父边界且需扩大父才能恢复的区域，在反馈记录上游证据，并按当前有效范围验收。`allowOutsideParent=true` 的节点允许越出直接父轮廓，继续检查 SVG、画布、坐标与部件归属。`update_group_note` 可精确修正本组职责说明，reviewer 负责反馈，绘制者负责修改。

同组绘制和返修共用会话，每次 reviewer 使用独立只读上下文。最多两轮正式质量审核，提前通过可结束，第二轮反馈修复完成后进入下一步。原 verdict 与 repairedCandidateHash 保留；服务重试和执行受阻单独记录，质量轮数跨启动累计。

本段的子组描边另有 `copy_parent_region`（schema 在 `part-layering/tools/`，说明与用法在 `knowledge/part-layering/step09_outline/`）：父组完成稿已经完整、本组只是其中分界明确的一部分时，描边 agent 可直接取出作为轮廓草稿；父组缺失、需要重画形状时照常描边。范围由 `maskSvg`（同画布遮罩 SVG，只含封闭形状，父完成稿按其并集用 clipPath 裁剪，分界线可穿过相连形状）给出；`mode=preview`（默认）只叠在原图上预览选中与排除的部分，`mode=crop` 才写入草稿。父稿的补全层标记与旧复制属性不带入，已有 clipPath 可以继续复制。

复制判别保存在本组 `step09_outline/<group>/copy-decision.json`，包含格式版本、`kind`、本组 ID、`needsCompletion`、`reason` 和仅供诊断的判别版本；SVG 不承载流程开关。工具以 2 倍分辨率渲染父稿的填色联合形体，按非零 alpha 的八邻域连通区检查裁剪是否完整保留所选形体，保留路径孔洞和原有裁剪。完整取出独立形体时 `needsCompletion=false`；同一连续形体同时有保留与裁掉的实心区域时为 `true`；仅抗锯齿边缘变化、细小选区或超出检测预算等不确定情况也为 `true`。这是几何判别，不判断人体部件语义；agent 只画遮罩，不能指定补全开关。

程序信任上游引用文件和本组工具判定，不回查父完成稿、遮罩或轮廓的持久指纹，也不因检测版本变化推翻判定；旧记录中的哈希字段兼容读取但不参与判定。本组有效复制记录使轮廓跳过 review；仅 `needsCompletion=false` 且去重稿与本组当前轮廓字节一致时跳过补全与补全检查，否则照常进入补全与检查。记录缺失、损坏、格式版本或组不匹配，以及判定字段不合法时不授权跳过；旧 SVG 属性不作判据，已完成的步骤仍按原有 `.completed` 规则保留。`write_outline_svg` 改写（包括相同文本）以及重新绘制或返修清除记录，继续已有草稿和原字节发布保留记录；程序外直接改稿不自动追溯依赖链。首轮绘制且有父完成稿时才提供，返修不提供；`hiddenInReference` 节点不描边，也不用此工具。

## 去重、补全与拆分

去重确认同一实体、同一控制职责被重复领取后，保留一个完整归属，清理其他副本。独立运动层、隐藏根部和合理接缝允许投影重叠；证据不足时保留并记录疑点。修改件经 `write_reduction_svg`、重新预览和 `submit_reduction` 发布，其他组原字节保留。单组层直接复制。去重清空的重复件由程序发布空结果；原本完全遮挡的节点照常补全。

补全在保留已有 SVG 正文、属性和顺序的基础上，用 `set_completion_paths` 增加直接遮挡下的闭合结构，经独显／blend 自检后 `submit_completion`。生图后先用 `preview_svg` 的 `edge`、`reference` 与 `referenceRegion` 框选生成图中的对应部件，等比居中对齐后核对边缘；`referenceOffset` 提供小范围微调。随后省略 reference 参数，用默认参考图 `blend` 核对真实大小和位置，再查看独显。`crop` 只裁剪最终查看窗口，通常可省略。脸部补完整脸型与双耳，后发补正面联合范围；辅助图用于理解结构，已有路径保护由发布校验执行。

直属拆分基于独立运动、变形、透视、绘制顺序、显隐与剪贴职责，`submit_children` 保存唯一直属结果到 step03/children.json。group 可继续拆分，part 到此终止；空子列表表示当前组本身是最终单元。各节点的 note 记录职责与跨深度区域，固定纹样随所属结构保留。先按构图选择画内可见或需要遮挡补全的实体；完全裁切在画外且无需画内制作的部件省略。手掌与五根完整手指、左右手臂、合理发根与完整发面等先验来自对应 prompts，按实际角色决定节点和深度。

直属节点可分别标记 `allowOutsideParent` 与 `hiddenInReference`，省略均为 false，通常仅写 true。后者表示确实存在、当前画布内仍需制作，且目标结构因遮挡或闭合而整体不可见的节点。局部可见、局部遮挡或仅肤色/材质被覆盖时走正常流程，例如连体服下仍可辨认形体的 torso、breast。标记为 true 时，程序提供空底稿，跳过描边、轮廓 review 和可见轮廓去重，直接由带生图能力的补全 agent 制作非空 SVG，沿用程序检查。闭眼的眼白、虹膜等可以同时标记两项，可见眼睑继续按常规流程处理。note 写明与实际遮挡/裁切部件的显隐关系，供 raster step01 设计完整纹理、复用对称部件并制作原生显隐蒙版；后续阶段保留蒙版与默认闭合状态。

### 提示词与专项参考

通用正文位于 [knowledge/part-layering](../knowledge/part-layering/) 各步骤的 `prompts/`（`4`～`11`），由该步骤的 `agent.json` 声明拼接顺序。`knowledge/part-layering/<stepNN>/prompts/groups/<完整ID>/<同名文件>` 存在时完整替换对应正文，只对当前 ID 生效；没有专项文件的组使用通用正文。补全和拆分各自始终带 `9-补全操作约定.md`、`10-拆分操作约定.md`；变量与引用规则见 [shared](../shared/README.md#提示词模板与动态位置)。

额外参考图在专项正文的 `additionalReferences` 中以路径和用途列出，模型按需要自行查看，不附加图片、不限制工具可读路径；没有专项参考的组不出现该字段。参考素材来源和准备要求保留在对应素材目录的 README。

## 输出与恢复

| 步骤 | 产物／事实位置 |
| --- | --- |
| 首次分组 | `step08_initial/groups.json` |
| 轮廓与复核 | `step09_outline/<id>/outline.svg`、`review.json`、`outline.repairs/` |
| 同层去重 | `step10_reduce/depthNN/<id>.svg` |
| 补全与检查 | `step11_completion/<id>/check.json`；正式 `parts/<id>.svg` |
| 绘制会话 | `agents/steps/step09_outline/<id>`、`agents/steps/step11_completion/<id>` 下的 `session.json` |
| 直属拆分 | `step12_children/<id>/children.json` |
| 整树合并 | `step13_merge/`；正式 `preview.svg` |
| 深度与逐件检查 | `step14_occlusion/`；正式 `occlusion.json` |

分组步骤下的子组目录嵌套为 `<步骤>/<父>/children/<名>`。步骤使用 `.running`／`.completed` 标记，`groups.json` 是名称、note 与结构视图。轮廓与补全会话保存在 `agents/steps/<步骤>/session.json`（步骤路径同上，子组含 `children/<名>`），续跑恢复同一会话；被替换的会话追加到同目录 `session.json.history.jsonl`。重做某步骤会删除其整个会话目录（含历史）。布局转换不改写 `agents/`，转换前的会话不再续接。reviewer、去重、子组分析每次独立调用。

默认草稿：轮廓 `step09_outline/<id>/workspace/outline.draft.svg`，补全 `step11_completion/<id>/workspace/completion.draft.svg`，去重 `step10_reduce/depthNN/workspace/<id>.draft.svg`。工具参数与依赖记录中的相对路径以任务根目录为基准且不能越出，绝对路径照常接受；生图输入与结果路径必须为绝对路径。也可交付其他本地 SVG 路径，通过校验后由程序保存到正式位置，自选源文件保留。整树完成后程序合并终止部件、隔离资源 ID 并发布 preview，保留逻辑父容器。已完成步骤直接沿用；交付缺失时拒绝续跑并提示恢复文件或重试。重试只重做所选步骤，已完成的下游步骤沿用。旧 stages/ 布局可继续浏览，运行时需要当前事实布局；原参考、调用与其他 section 成果保持各自归属。

## 深度规划

preview 完成后 `propose_occlusion` 提交全表，按原图、完整部件和去重轮廓检查候选，`check_occlusion_part` 确认每件与每个区域，最后 `submit_occlusion` 发布。组树表示包含关系，深度表表达绘制前后。

当前输出 v3、back-to-front，每个逻辑 part 对应一行：单深度为 `level`，跨层同动整体用 `levels: [{ level, region }]`。数值唯一、越大越靠前，可用小数插层；每个区域带说明与检查依据，v2 单深度表兼容读取。实际跨层像素由 raster step01 拆分，完整协议见 [shared](../shared/README.md#多深度与上游修正)。

sourceHash 绑定树语义、SVG、参考、preview 和规划提示词；深度记录缺失或输入变化时只重做本步。完整交付包含当前 preview 与通过检查的深度表。单测使用本地模拟；真实艺术质量由制作中的视觉观察与审核确认。
