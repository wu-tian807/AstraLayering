# 头部九轴

制作角色的左右转头、抬头、低头和斜向动作，连同五官、耳朵与下颌一起调整。工作台可预览各步骤的模型，并编辑关键形。

网页开启“阴影完成后制作头部九轴”，或在总入口加 `--live`。续跑沿用任务保存的选择，`--no-live` 关闭。

## 依赖与视频配置

九轴需要 **Krita、FFmpeg 和 Seedance 视频服务**。在全局设置选择已安装或解压的 FFmpeg 可执行文件；Krita 与 FFmpeg 共用浏览、扫描和点选功能。

在“管线配置 → 环境与模型”的“视频模型”和“视频服务”中配置，也可以编辑 skill 目录下的 `.env`：

```dotenv
video_provider=volcengine
video_base_url=https://video.example.com/v1
video_api_key=<视频服务密钥>
nine_axis_view_video_model=doubao-seedance-2-5-260628
```

支持火山官方（默认）、OpenRouter 和 OpenAI 视频兼容服务（含 LiteLLM），模型可选预设或手动输入。切换服务时同步选择其支持的模型；旧兼容接口配置设置 `video_provider=openai`。配置示例与预设见[模型配置](../references/model-presets.md#九轴视频模型与服务)。开启 `--live` 或独立运行九轴时，启动前会检查这些配置。

只制作到阴影时，按原流程配置 Krita 和绘图模型即可。

## 独立运行

本管线的先验位于 `knowledge/head-nine-axis/`，前端归为“头部九轴”。头部九轴内部共用提示词和专用工具说明分别在该目录的 `prompts/`、`tools/`；步骤工具说明可再覆盖。自定义 knowledge 也须使用此目录结构，旧 `knowledge/nine-axis/` 不作回退。

```sh
pnpm nine-axis --name my-character --dir /绝对路径/运行根目录 --knowledge /绝对路径/knowledge --krita /绝对路径/krita --ffmpeg /绝对路径/ffmpeg
```

独立 section 启动无状态，每次传入运行目录、knowledge 和软件路径。总调度在 `run.json` 中保存本任务参数并传给 section，网页全局设置提供新任务默认值。

选帧 agent 使用 `extract_video_frame` 工具提取参考帧，工具负责调用指定的 FFmpeg。

## 制作流程

| 步骤 | 内容 |
| --- | --- |
| `step01_preparation` | 整理 KRA 图层 UUID、几何范围与投影关系 |
| `step02_video` | 生成左右转头、抬头和低头的参考视频 |
| `step03_frames` | 选择单轴参考帧 |
| `step04_angles` | 制作单轴模型，同时生成斜角视频 |
| `step05_frames` | 选择斜角参考帧 |
| `step06_angle-xy` | 制作斜角模型 |
| `step07_jaw-line` | 处理下颌与脖子的连接，交付 UUID 模型、KRA 和合成预览 |
| `step08_hair` | left＋right，Y=0；同一 KRA、同一持续会话，按操作依次制作前发、侧发、后发、其余头发与整体协调 |
| `step09_head-accessories` | 基于已完成脸发制作 head_accessories 的 left＋right，Y=0；检查完整组合遮挡和关联投影 |

素材沿用上游工程的尺寸、图层与投影关系。制作角度见 [angles.json](../knowledge/head-nine-axis/step02_video/references/angles.json)。

KRA 是画稿依据，阶段 JSON 是累计变形与图层绑定。`step01_preparation` 只读取上游 shadow（缺省为 assembly）KRA，记录实际来源和 UUID，记录 neutral 几何与原生图层绑定，不预导出像素，不复制未修改的 KRA。left／up／down 各自从 neutral 独立制作，程序合并后供 xy、jaw 继续；每步 JSON 已含上游效果，渲染时只应用一次。

下颌线阶段建立本步可编辑 KRA，保存后将 `source.document` 切到这份工程，`source.geometryDocument` 保留原始单轴几何来源。`edit_nine_axis` 通过 UUID 绑定原生图层，素材由预览工具按需读取；面部阶段暂不开放修改 KRA。工作台与 `view_nine_axis` 共用 KRA 图层解析与内容缓存，KRA 保存后会刷新九轴贴图，即使 JSON 与旧导出 PNG 未变化。面部阶段可用静态头发、头饰辅助观察；头发阶段 agent 的预览只显示已完成脸部、此前完成的发片及当前轮次，尚未制作的其他发片不参与判断。

预览可用 `frames:[{x:0,y:0},{x:-15,y:0},{x:-30,y:0}]` 直接输出同一 KRA／JSON 版本的多帧拼图；`only`／`hidden` 用于局部观察，不改变完整的累计模型。检查图与合成预览可输出 PNG，作者模型不引用素材 PNG。

## 查看与继续

阶段权限、来源链、图层绑定和多帧预览的实现约定见 [KRA 引用与预览](kra-source.md)。

头发步骤只制作 left＋right（X 轴），编辑和预览固定 Y=0；上游脸部的上下、四角几何保留。本步不生成头发的 Y/XY 关键形，交付暴露的 Y 范围为 0。首次复制上游实际 KRA，同一个 agent 先用 Krita 确认发片及对应投影并显式绑定 UUID，再描边、用 edit 做左右形变，不提供 fit。

`agent.json` 的 `initial` 只用于前发首轮。程序在本轮检查通过、KRA 与累计模型等交付齐全后更新 `hair-progress.json`，本次操作即返回；下一次继续 `step08_hair` 时，向同一 `step08_hair` thread 发送下一轮提示词。侧发轮使用 `prompts/侧发制作.md`，仅编辑自己的节点，预览包含已完成前发与脸部。

后发轮使用 `prompts/后发制作.md`，开放前发、侧发、后发及关联投影的协调，脸部及其他未制作内容继续保护。目标是拟合左右参考动画，优先尝试较小形变与遮挡显露，并协调头顶的完整体积；KRA 是否需要改形、补绘或调纹理，由实际画稿和参考决定，不强制每例重画后发。预览包含三个发区与已完成脸部，叠加比较用 edge，纹理与明暗看原色。

其余头发轮使用 `prompts/其余头发制作.md`，从当前 KRA 与模型绑定确认实际尚未制作的发片及投影，在一轮内统一完成左右，不再按发型类型枚举子流程。可按需要协调全部头发，保护脸部、头饰及其他内容。预览只显示已注册的头发与脸部；可见的未绑定 KRA 发片须显式注册，不能留作静态背景。确实没有其余头发时，核对并记录后可直接完成。

其余头发与后续头饰只制作转头的基准姿态，不提前制作物理摆动。优先用整体位置、转动与必要透视表达朝向变化，保留本体固有形态；直段的投影仍应笔直，局部形变须有转面依据。发根和连接段保留完整延伸，在合理相邻表面下留足搭接，并检查端点与中间姿态的持续覆盖。头发轮将需要同步的非头发饰物及挂接关系写入 `notes.md`，由头饰步骤接入。

四轮使用同一份 KRA 和通用 `session.json`，不中途新建 thread；中断仍继续当前轮次，不跳过未通过的产物。前三轮完成时保持头发步骤未完成；其余头发与整体协调通过且交付齐全后，进度记为 `next:"done"`，才完成整个头发步骤。

整个步骤的 `.running`／`.completed`、轮次的 `hair-progress.json`、会话的 `agents/steps/step08_hair/session.json` 分别记录完成状态、待制作轮次和 thread。`hair-progress.json` 的 `completed` 只能按前发→侧发→后发→其余头发累积，`next` 依次为 `front`、`side`、`back`、`remaining`、`done`，通过全部交付检查后才原子更新。每次派发都按 `next` 选择提示词，不根据有没有旧会话退回 `agent.json` 的前发 initial。

| 操作 | 头发步骤中的行为 |
| --- | --- |
| continue | 保留 KRA、模型、轮次和 thread；本轮未通过就继续本轮，已通过就派发下一轮 |
| resume | 保留 KRA、模型和轮次，只清除 thread；新会话仍收到 `next` 对应的前发、侧发、后发或其余头发提示词 |
| retry | 删除整个 `step08_hair` 的产物、轮次、会话和对应尝试记录；从上游 KRA 重新制作前发，不是只重跑后发 |

本轮返回后，作者模型可读、KRA 可读取、当前发片及保护检查、合成导出、非空说明和完整交付检查都在通用 `checkedTurn` 中执行。检查失败时，同一会话最多追加两次修正回合，即首次制作加两次修正；仍失败则保留当前轮次，不标记完成、不派发下一轮。每次手动继续／恢复开始新的操作，重新计算这两次检查修正预算。上轮已通过后丢失产物会在派发前拦截，不自动重做此前已完成的发片；agent 明确返回 error 或调用异常也不等同于交付检查失败。

若其余头发交付和 `next:"done"` 已保存，但进程在写 `.completed` 前中断，继续时只补全整个步骤的完成标记，不再派发 agent。已标记完成的步骤若轮次或交付不一致，会拒绝沿用。

新轮次进度使用 `version:2`。旧 `version:1` 的已通过轮次保持不变；三轮已完成的工程通过程序迁移为 `next:"remaining"` 并接续本轮，保留 KRA、模型和会话，不重跑前三轮。continue／resume 的单步和任务级操作均支持迁移；迁移写进度前先切换旧完成标记，中断后可继续。retry 仍重做整个头发步骤。

头发全部轮次通过后，`step09_head-accessories` 使用独立的通用 step 会话和一份工作 KRA，从头发实际来源继承累计模型；不复用头发的制作 thread，也不新增模型配置项。agent 在 Krita 确认真实饰品、UUID、拆分与投影，再描边和显式注册，通过 edit 制作左右，不提供 fit。作者为 `accessories.json`，新节点在 `head_accessories/`、level=accessory；已完成脸和头发的画稿、绑定、形变及相对顺序保护。预览包括已完成脸发和已注册饰品，未注册静态饰品不混入。

最终可见组合决定遮挡区域的质量要求：持续被挡住的区域保证覆盖余量，转头新露出的边缘和接触点仍需检查，不为裸头预览强制重画不可见顶弧。关联独立投影使用已注册的真实 caster/receiver 与动态 clip；未制作的身体或衣物依赖记录待接入，不越界新增。没有饰品时核对并记录后可完成。

饰品根据真实固定关系随头部或最新发片运动，可使用已有承载 Warp；同一饰物的前后画层和投影保持统一姿态，避免独立补偿拉扯本体或重复随动。自检同时查看独显的本体形态与最终组合的接触、遮挡，区分透视变化与额外弯曲、扭转或惯性摆动。

该步骤沿用通用 continue／resume／retry 和两次交付修正，不另设分轮进度。头发尚在等待下一轮时，顺序流程停止，不提前派发饰品；单独请求饰品也会检查上游完整性。Web 流程展示全部九步，头发卡片只读显示四轮进度，头饰作为独立步骤；继续／恢复／重试仍使用原有步骤入口。工程预览与九轴工作台按最新累计模型的 source.document 选 KRA。

在流程预览中播放视频、查看选帧和模型；进入角色工作台可以调整角度和关键形。完成后通过“导出成果”保存模型、贴图、工程和说明。

`--continue` 保留产物与会话，`--resume` 保留产物并换会话，`--retry` 重做所选步骤。可用 `--step step04_angles/model/up` 选择单个方向。

已产出的非空 MP4 直接沿用，继续时补齐缺失的视频；并发分支失败时，保留已成功的文件。模型和选帧按实际交付文件检查，缺失时在对应步骤处理。[更多恢复操作](../workflow/README.md#故障恢复)。
