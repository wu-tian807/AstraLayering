# 头部九轴

仅验证左右制作时，可在独立运行目录沿用原始 KRA/PNG 与已完成的 `step01_video` 输入，使用 `pnpm nine-axis --name <任务名> --dir <绝对运行根目录> --knowledge <先验知识目录> --krita <可执行文件> --step step02_angle-x`。该入口只运行左右制作，不生成视频、不推进后续角度；从原始 KRA 验证时不复制已有 `face-left.json`、变形器或导出的贴图。

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。范围为脸部与双耳，以及固定脖子的连接：step02 左右转向（ParamAngleX），step04 抬头与 step05 低头（ParamAngleY），step06 斜向（四角），step07 下颌接触收尾，不含头发。ParamAngleX / ParamAngleY 处处以度数为值：ParamAngleX −30 / +30（step01 取向左转头视频中转到 30° 的帧，+30 由 step02 镜像），ParamAngleY +25 抬头 / −25 低头（step03 取镜头圆弧环绕视频中的 25° 帧）。各角度只记在 [knowledge/nine-axis/step01_video/references/angles.json](../knowledge/nine-axis/step01_video/references/angles.json)，由程序用来取视频帧、填进 step02、step04、step05、step06 的提示词；agent 交付的关键形键、`deformers.json` 的参数范围与关键形键都是这些度数，工作台的范围读文档本身。改角度幅度只改这个文件。换成 Cubism 默认 ±30 等范围留给以后的导出层。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_video` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_video/upper-body.png`、`crop.json`、`left.mp4`、`left.png`、`frames/`、`videos.json`、`views.json` |
| `step02_angle-x` | 同上的 KRA / PNG，step01 的 `upper-body.png`、`crop.json` 与 `left.png` | `nine-axis/step02_angle-x/face-left.json`、`layers/*.png`、`left-check.png`、`deformers.json`、`source.json` |
| `step03_video-y` | `step01_video/upper-body.png`，沿用 step01 裁框 | `nine-axis/step03_video-y/up.mp4`、`down.mp4`、`up.png`、`down.png`、`frames/`、`videos.json`、`views.json` |
| `step04_angle-up` | `step02_angle-x` 的工程与原贴图，`step03_video-y/up.png` | `face-up.json`、独立描线/完整脸预测/拟合报告、`up-check.png`、`deformers.json`、`layers/*.png` |
| `step05_angle-down` | `step04_angle-up` 的工程与原贴图，`step03_video-y/down.png` | `face-down.json`、独立描线/完整脸预测/拟合报告、`down-check.png`、`deformers.json`、`layers/*.png` |
| `step06_angle-xy` | `step05_angle-down` 的 `deformers.json`，step01 的 `left.png` 与 step03 的 `up.png`、`down.png` | `nine-axis/step06_angle-xy/left-up.mp4`、`left-down.mp4`、`videos.json`、`linear.json`、`face-xy.json`、`left-up-check.png`、`left-down-check.png`、`deformers.json`、`layers/*.png` |
| `step07_jaw-line` | `step06_angle-xy`、当前九轴 KRA | `jaw.json`、`deformers.json`、`jaw-check.png`，必要的 KRA/贴图修复 |

七步依次完成左视频与取帧、X 制作、上下视频与取帧、独立 up、独立 down、斜向参考视频与四角制作、下颌接触。路径常量见 [shared/nine-axis.ts](../shared/nine-axis.ts)。

## step01_video：左视频与 left 取帧

1. 按脸、头发、头饰形状的不透明范围截取方形头部特写，取景与模板 pink-doll 的参考图一致：上沿为头部最高点，下沿为脸底再往下半个脸高（到肩线），以脸中心为横向中心，四周留 6%；宽度只需容下脸与头饰，长发可被两侧裁掉；超出画布处补灰（128）。裁切框写入 `crop.json`。
2. 以 `upper-body.png` 为首帧，用 [left 提示词](../knowledge/nine-axis/step01_video/prompts/视频.md)生成 5 秒 `left.mp4`：只向左转头（向右由 step02 镜像），表情、身体不动，匀速转到最后一帧的正侧面 90°。原 left 提示词保留。
3. 用 ffmpeg 按 `angles.json` 的 left 度数（默认 30°）取第 `round((帧数−1)×30/90)` 帧，缩放到正面特写同尺寸后写为本步 `left.png`；原始帧在 `frames/`，帧号与哈希写入 `views.json`。
4. 模型、视频首帧、提示词与哈希写入本步 `videos.json`。本步只生成左视频和 left 帧。

生视频接口为 `video_base_url` / `video_api_key`，须单独填写，不使用生图接口，缺少时报错；模型为 `nine_axis_view_video_model`（默认 seedance-2.5）。需要 ffmpeg。来源角色图重做后如需新视频，从 step01 重试并按新来源重做受影响后续步骤；已有真实任务目录在运行期间不搬迁。

## step02_angle-x：left 方向的脸部＋双耳透视形变

1. agent 带着 `krita`、`edit_nine_axis`、`fit_nine_axis`、`view_bitmap` 与 `view_nine_axis` 启动。从原 KRA 导出脸与固定脖子，`edit_nine_axis.importParts` 创建初始网格，不自动建解剖分组。agent 描真实可见脸缘，结合原画与带图先验预测完整闭合 left 脸底，先检查无遮挡素脸，再由 `fit_nine_axis` 自动求脸底 Warp；五官可一轮批量液化，然后回看完整脸。
2. `create_warp`、`reparent`、`remove_warp` 由 agent 定义组级与父子 Warp；部件始终保留自己的局部网格。父级调整影响后代，局部编辑不影响兄弟或父级。编辑工具接受画布位置，自动反解父级，原子保存作者文件 `face-left.json` 并返回 revision。预览可显示组级网格、只看某一组，再恢复带脖子的完整脸。控制点少而清楚，平滑曲线与渲染细分分开。
3. left 帧是可见脸型和五官的唯一视觉目标。`face-trace.json` 用 SVG path 记录源线和目标线，在眼窝、颧颊、颌角、下巴等转折拆段；可见区域标 `visible`，遮挡补全标 `occluded`。教程只用于后者，不以通用脸型改变可见轮廓。求解使用同一平滑 Warp 与父级反解，保留其他节点；补全与可见曲线冲突时自动弱化。父级不足时补局部关键形或子 Warp。`parameterInterpolation.x: "ellipse"` 可给出弧线，额外中间形按实际过渡补。
4. 脖子从首次导入就进入参考与完整预览，不能挂到头部 Warp，也不能平移、倾斜、拉长。接缝先检查顶部覆盖与下颌线，记录角度和缺口；脖子顶部延长与最终接触调整统一在 step07 处理。已有线/蒙版复用，不能为了当前脖子的长度改变应有脸型。默认形蒙版在线下方，转头只裁掉接触区。每次调整都检查 −30、−15、0、+15、+30 的完整脸。耳朵整体贴着脸缘，远侧放到脸后，不用透明度隐藏。
5. `face-left.json` 为 version 2，含 `axis`、`deformers`（可空）与 top-first `parts`。程序镜像组合后的向左形变，再反解到右侧节点的父级空间；不要求左右采用相同层级，写出 `deformers.json` 与 `source.json`。

`face-trace.json.completion` 保存完整闭合 source/target 脸型，各分段由同一轮廓拆出；皮肤与头发交界不能作为外脸缘。先读[带图脸型补全先验](../knowledge/nine-axis/step02_angle-x/references/completion/脸型补全先验.md)，参考圆脸视频、教程和不同脸型原生模型的左转脸底，只补视频被遮挡的结构。

`fit_nine_axis.inspect` 先叠出描线与完整 target 素脸，并返回完整 source/target 的 `completionCheck`；分段偏离完整脸型时拒绝拟合。保存 `face-completion-check.png`，实际变形后的单独脸底用 `view_nine_axis` 另存 `face-base-left-check.png`。`fit` 将曲线自动采样为对应点，返回逐段平均/最大误差，保存 `fit-report.json`。拟合到描线仍须确认描线贴住视频。`view_nine_axis.reference` 返回参考／当前／50% 叠加三联图，固定正面 axis，不按五官重新对齐；`left-fit-check.png` 保存整脸对比，`far-side-check.png` 放大画面左侧眼窝到颊部，不能只检查一段下颌。本轮为待用户验收的候选，用户明确通过前不能宣称流程稳定。描线格式见 [拟合工具](../knowledge/shared/tools/fit_nine_axis/description.md)。

- `deformers.json`：version 2。无贴图的 `deformers` 和带贴图的 bottom-first `parts` 分开，`parent` 引用 Warp，绘制顺序独立于变形层级。每个节点有 `bbox`、`cols`、`rows`、`keyforms`；节点的局部形先形变，再依次通过父级。贴图保留原画布的 `textureBounds`，路径为本步 `layers/` 相对路径。工作台能选择父级或部件、拖动组合后的控制点并保存。完整字段与操作见 [编辑工具](../knowledge/shared/tools/edit_nine_axis/description.md)。
- `character-nine-axis.kra`（需要像素修复时由 agent 在 Krita 保存）：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。

X 的描边复用 part-layering 的 `preview_svg`：先独立辨认可见形体，用闭合纯色色块的填色边缘起稿，整图 blend 后以重叠选框放大，用 blend/edge 核对。远侧眼尾外侧到颊部保留视频中的陡边、转折和笔锋，实际显露的脸缘不能整段归为遮挡；遮挡补全最后加入，不移动已核对的可见段。source 对同坐标无遮挡原脸底，target 默认对指定 left 帧。九轴以 `referenceAlignment: 'canvas'` 复用同一工具实现，参考不居中、不重新缩放，不开放生成图的 referenceRegion/referenceOffset；已有 Part 补全仍沿用原对齐方式。两份检查过的 SVG 生成 trace 后再求 Warp。已有真实管线产物可按本步 review-feedback.md 续修，保留已确认区域；工具与拟合技术检查通过仍须由用户确认视觉效果。

## step03_video-y：上下视频与 up/down 取帧

沿用 `step01_video/upper-body.png` 和 `crop.json` 的取景，以同一正面特写同时生成 up、down 两段视频。提示词由本步 `agent.json` 的 `prompts/视频.md` 入口按 group 替换为 [up](../knowledge/nine-axis/step03_video-y/prompts/groups/up/视频.md) 或 [down](../knowledge/nine-axis/step03_video-y/prompts/groups/down/视频.md)。

两段统一 5 秒，从正面 0° 匀速到末帧 90°。人物完全静止；镜头绕穿过头部中心、沿画面左右方向的固定水平轴作圆弧环绕，以头部中心为固定目标，保持环绕半径与焦距，不推近或变焦放大。up 沿圆弧向下，到头部正下方垂直向上仰视；down 沿圆弧向上，到头部正上方垂直向下俯视。

按仍位于 step01 的 `angles.json` 的 up、down 度数（默认都是 25°），各取第 `round((帧数−1)×25/90)` 帧，缩放到正面特写同尺寸后写为本步 `up.png`、`down.png`。本步保留 `up.mp4`、`down.mp4`、原始 `frames/`、视频来源与哈希 `videos.json`，帧号与哈希写入 `views.json`。left-up/down 参考视频在 step06 才生成。

## step04_angle-up 与 step05_angle-down：独立的俯仰制作

up 从已完成 X 的 `deformers.json` 建立 `face-up.json`，新增 Y=0 与抬头端点；down 从 up 建立独立 `face-down.json`，新增低头端点。每步拥有自己的 agent 会话、提示词、SVG/trace、补全预测、拟合报告和检查图，可以单独运行或重试。down 保留 up 的工程但只制作低头，不镜像抬头或复用其目标描线。四角从 down 的完整上下工程继续。

两步使用与 left 相同的制作方式：先辨认可见实体脸缘，复用 Part 的 `preview_svg` 做闭合纯色色块描边与局部 blend/edge 核对；可见段标 visible，再结合原画与带图先验补全隐藏的额头、太阳穴、脸颊和下颌。每个方向独立选择适用脸型。分别先看完整 source/target 素脸双图，再用 `fit_nine_axis` 自动求本步端点，最后另看真正变形后的脸底。视频可见区域是唯一目标，教程和原生模型仅指导遮挡补全，不硬套五官距离规则。

俯仰重点检查下颌弧度、下巴位置、可见额顶及整体纵深，以及眉眼/鼻嘴/嘴颏距离、眼睑、虹膜与口腔层。五官可一轮批量液化后微调。Warp 分组、父子和局部修正由 agent 自定；程序保护已制作的 X，down 还保护 up 的端点和中间姿态。脖子始终固定并参加接触对照，顶部补足与最终消线留 step07。

两步带图先验分别见 [up](../knowledge/nine-axis/step04_angle-up/references/completion/脸型补全先验.md) 与 [down](../knowledge/nine-axis/step05_angle-down/references/completion/脸型补全先验.md)。工具由步骤绑定参考帧、作者文件和 Y 方向，复用同一拟合实现，不增加角度猜测或另一套液化算法。各步保存 source/target SVG、face-trace.json、trace-check、face-completion-check、face-base-<方向>-check、fit-report，以及完整/叠加/颊颌/五官/固定脖子/过渡检查图。数值与几何检查不能代替用户视觉验收。

## step06_angle-xy：斜向选帧、描边与自动拟合

从 `step05_angle-down/deformers.json` 的完整 X/up/down 工程继续。本步以原 up/down 参考帧为首帧，沿用 step01 的 left 提示词，分别生成约5秒 `left-up.mp4`、`left-down.mp4`，再启动斜向 agent。来源、提示词和哈希保存在 `videos.json`，不提前放到其他步骤或 knowledge。

agent 实际查看全片多帧与候选附近画面，独立选择合适的 left-up/left-down 帧。根据既有 left 的侧转幅度、各自 up/down 的俯仰感、远近眼显露、鼻嘴侧移和额顶/下颌投影判断；不强制两段同时间，不把时间比例当作精确角度。原帧保存 `frames/`，只等比规范化到固定 box，保存同名 PNG。`selected-frames.json` 的 `frames` 中每角记录 `video`、`path`、实际 `frameIndex` 和/或 `timeSeconds`、原片/PNG 哈希及选帧理由。此后该角始终对着已选 PNG 描边、拟合；更换帧后重新处理该角。

`linear.json` 只是局部 X/Y 位移叠加的完整层级起点。`edit_nine_axis {}` 建立 `face-xy.json`；agent 复用 Part 的 `preview_svg` 以闭合纯色色块描可见脸缘、补全隐藏额顶/颊颌，分别保存每角 SVG 与 trace。`preview_svg` 的 blend/edge 显式给对应角的 `reference`，保持原坐标。分类脸型与带图教程只指导隐藏结构，当前视频决定可见轮廓、五官与笔锋。补全指南见 [斜向先验](../knowledge/nine-axis/step06_angle-xy/references/completion/脸型补全先验.md)。

`fit_nine_axis` 的 `corner=left-up|left-down` 绑定已选 PNG 与工程角，自动求该角 Warp；两角分别保存报告。分组、父子关系、局部微调仍由 agent 决定，五官可一轮批量调整。先看完整预测脸，再看原贴图实际形变，放大远侧眼尾到颊部的竖向轮廓及颊颌/下巴。程序完成前检查两角选帧哈希、同裁框尺寸及拟合报告引用，参考或描线改变后必须重新拟合；这些检查不替 agent 选帧。

上游单独 X/Y 与已正确的另一角受保护。右侧镜像组合后的结果，再反解到相应父级；自定义镜像名称用 `mirror_pair` 或完整 `left/right` 词。实际检查左右四角、轴到四角及两左角之间的过渡，五官不融化或分离，网格不折叠。脖子从开始参与参考并保持固定，接触收尾留 step07。

交付完整作者源、原贴图、选帧记录、每角描边/补全/实际脸底/五官/接触检查图，以及过渡、原轴保护与右侧镜像检查图；输出 `deformers.json`。视觉效果由用户验收，不能仅凭完成标记或拟合残差宣称稳定。

## step07_jaw-line：下颌接触收尾

`edit_nine_axis {}` 从当前四角建立完整 `jaw.json`。复用已拆好的线、蒙版、脸色扩展；根据实际缺口补绘或增加局部 Warp。蒙版 `role: "mask"` 只作裁切源，线用 `clip: {by: [...], invert: true}`。静止保留原线，转动只擦掉压进脖子的接触段，其他线保持粗细与浓淡。贴图修复由私有 Krita 保存副本，原工程与 UUID 保留。

脖子固定、不进头部 Warp。顶部需要补足时沿原两侧向上绘制，与下部连成直线，不能拉斜或拉长。九宫格 `jaw-check.png` 使用同一工作台渲染检查九个角度与中间值；程序继承贴图，完成本步 `deformers.json`。

工作台默认读取完成的最高阶段；URL `nineStage=x|up|down|y|xy|jaw` 可明确比较对应阶段。version 2 是当前作者与运行格式，未发布旧格式不做兼容适配。
