# 头部九轴

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。范围为脸部与双耳，以及固定脖子的连接：step03 左右转向（ParamAngleX），step05 上下（ParamAngleY），step06 斜向（四角），不含头发。ParamAngleX / ParamAngleY 处处以度数为值：ParamAngleX −30 / +30（step02 取向左转头视频中转到 30° 的帧，+30 由 step03 镜像），ParamAngleY +25 抬头 / −25 低头（step04 取镜头上下移动视频中的 25° 帧）。各角度只记在 `knowledge/nine-axis/step01_video/references/angles.json`，由程序用来取视频帧、填进 step03、step05、step06 的提示词；agent 交付的关键形键、`deformers.json` 的参数范围与关键形键都是这些度数，工作台的范围读文档本身。改角度幅度只改这个文件。换成 Cubism 默认 ±30 等范围留给以后的导出层。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_video` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_video/upper-body.png`、`crop.json`、`left.mp4`、`up.mp4`、`down.mp4`、`first/{up,down}.png`、`left-up.mp4`、`left-down.mp4`、`frames/`、`videos.json` |
| `step02_views` | `step01_video` 的 `left.mp4` 与 `upper-body.png` | `nine-axis/step02_views/left.png`、`frames/`、`views.json` |
| `step03_angle-x` | 同上的 KRA / PNG，step01 的 `upper-body.png`、`crop.json` 与 step02 的 `left.png` | `nine-axis/step03_angle-x/face-left.json`、`layers/*.png`、`left-check.png`、`deformers.json`、`source.json` |
| `step04_views-y` | `step01_video` 的 `up.mp4`、`down.mp4` 与 `upper-body.png` | `nine-axis/step04_views-y/up.png`、`down.png`、`frames/`、`views.json` |
| `step05_angle-y` | `step03_angle-x` 的 `deformers.json` 与 `layers/`，`step04_views-y` 的 up、down 视角 | `nine-axis/step05_angle-y/face-y.json`、`up-check.png`、`down-check.png`、`deformers.json`、`layers/*.png` |
| `step06_angle-xy` | `step05_angle-y` 的 `deformers.json`，各视角，step01 的 `left-up.mp4`、`left-down.mp4` | `nine-axis/step06_angle-xy/linear.json`、`face-xy.json`、`left-up-check.png`、`left-down-check.png`、`deformers.json`、`layers/*.png` |
| `step07_jaw-line` | `step06_angle-xy`、当前九轴 KRA | `jaw.json`、`deformers.json`、`jaw-check.png`，必要的 KRA/贴图修复 |

步骤名后缀说明各步做什么：`video` 生成全部视频，`views` 取左右视角帧，`views-y` 取上下视角帧，`angle-x` 做角度 X（左右），`angle-y` 做角度 Y（上下），`angle-xy` 做斜向。

路径常量见 `shared/nine-axis.ts`。

## step01_video：生成视频

1. 按脸、头发、头饰形状的不透明范围截取方形头部特写，取景与模板 pink-doll 的参考图一致：上沿为头部最高点，下沿为脸底再往下半个脸高（到肩线），以脸中心为横向中心，四周留 6%；宽度只需容下脸与头饰，长发可被两侧裁掉；超出画布处补灰（128）。裁切框写入 `crop.json`。
2. 以 `upper-body.png` 为首帧同时生成三段 5 秒视频：
   - left：`prompts/视频.md`，只向左转头（向右由 step03 镜像），表情、身体不动，匀速转到最后一帧的正侧面 90°；
   - up：`prompts/groups/up/视频.md`，人物不动、镜头匀速降到下巴正下方仰视，最后一帧到 90°；
   - down：`prompts/groups/down/视频.md`，镜头匀速升到头顶正上方俯视。
3. 从 up、down 视频按 `angles.json` 的度数取帧写为 `first/up.png`、`first/down.png`，再分别以它们为首帧、用 left 的转头提示词生成 `left-up.mp4`、`left-down.mp4`，供 step06 的 agent 作斜向参考。
4. 模型、各视频的首帧、提示词与哈希写入 `videos.json`。

生视频接口为 `video_base_url` / `video_api_key`，须单独填写，不使用生图接口，缺少时报错；模型为 `nine_axis_view_video_model`（默认 seedance-2.5）。需要 ffmpeg。已完成的 step01 保留；来源角色图重做后如需新视频，删除 `nine-axis/step01_video` 及之后的步骤再运行。

## step02_views：向左视角

用 ffmpeg 从 `left.mp4` 取帧：第 `round((帧数−1)×30/90)` 帧即转到 30° 的一帧，缩放到上半身同尺寸后写为 `left.png`；原始帧在 `frames/`，帧号与哈希写入 `views.json`。

## step04_views-y：上下视角

按 `angles.json` 的 up、down 度数（默认都是 25°）从 `up.mp4`、`down.mp4` 取帧：第 `round((帧数−1)×25/90)` 帧，缩放到上半身同尺寸后写为 `up.png`、`down.png`；原始帧、帧号与哈希写入本步 `views.json`。

## step03_angle-x：left 方向的脸部＋双耳透视形变

1. agent 带着 `krita`、`edit_nine_axis`、`view_bitmap` 与 `view_nine_axis` 启动。导出脸与固定脖子的图层后，`edit_nine_axis.importParts` 创建小尺寸的初始网格，不自动建解剖分组。agent 参照教程先调脸型，再调眉眼的大形，随后嘴、鼻，最后回看完整脸与脖子的连接。
2. `create_warp`、`reparent`、`remove_warp` 由 agent 定义组级与父子 Warp；部件始终保留自己的局部网格。父级调整影响后代，局部编辑不影响兄弟或父级。编辑工具接受画布位置，自动反解父级，原子保存作者文件 `face-left.json` 并返回 revision。预览可显示组级网格、只看某一组，再恢复带脖子的完整脸。控制点少而清楚，平滑曲线与渲染细分分开。
3. 脸侧轮廓按额头、眼窝、颧颊、下颌形成起伏；眉眼上半部透视更强，瞳孔分割尽量横平竖直，嘴下半部透视更强，鼻、嘴、下巴对齐。父级不能兼顾的部位用局部关键形或子 Warp 补偿。`parameterInterpolation.x: "ellipse"` 提供经过 −30、0、+30 的弧线；增加中间关键形时保留采样结果后改为分段线性插值。
4. 脖子从首次导入就进入参考与完整预览，不能挂到头部 Warp，也不能平移、倾斜、拉长。接缝先检查顶部覆盖与下颌线，记录角度和缺口；脖子顶部延长与最终接触调整统一在 step07 处理。已有线/蒙版复用，不能为了当前脖子的长度改变应有脸型。默认形蒙版在线下方，转头只裁掉接触区。每次调整都检查 −30、−15、0、+15、+30 的完整脸。耳朵整体贴着脸缘，远侧放到脸后，不用透明度隐藏。
5. `face-left.json` 为 version 2，含 `axis`、`deformers`（可空）与 top-first `parts`。程序镜像组合后的向左形变，再反解到右侧节点的父级空间；不要求左右采用相同层级，写出 `deformers.json` 与 `source.json`。

教程定义结构与制作顺序，角色视频是具体形变的拟合目标。先确认裁框、尺度和眼线/鼻嘴对齐，再叠加可见轮廓，按偏差修正父级与局部网格；保留眼尾、颧颊、下颌转折和下巴收尖的线条节奏。头发遮住的脸缘仍依教程构造，不追着发丝拟合。`left-fit-check.png` 保存前后叠加，`video-fit.json` 可记录参考哈希、可见区、对齐方式与测量结果。

- `deformers.json`：version 2。无贴图的 `deformers` 和带贴图的 bottom-first `parts` 分开，`parent` 引用 Warp，绘制顺序独立于变形层级。每个节点有 `bbox`、`cols`、`rows`、`keyforms`；节点的局部形先形变，再依次通过父级。贴图保留原画布的 `textureBounds`，路径为本步 `layers/` 相对路径。工作台能选择父级或部件、拖动组合后的控制点并保存。完整字段与操作见 [编辑工具](../knowledge/shared/tools/edit_nine_axis/description.md)。
- `character-nine-axis.kra`（需要像素修复时由 agent 在 Krita 保存）：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。

## step05_angle-y：脸部＋双耳的上下形变

`edit_nine_axis {}` 从当前 X 的 `deformers.json` 建立完整 version 2 的 `face-y.json`。保留 `deformers`、局部 `parts`、裁切、贴图与来源，在 `keyformsY` 制作上下端点，不再交付平铺部件的坐标补丁。后续阶段的作者源带 `authoring.stage` 与 `upstreamSha256`；来源变动会拒绝旧数据，须按新上游重新制作。

agent 沿用或重新安排自己的 Warp 层级，先调大形再补整眼、嘴及独立部件；新增节点自动有当前阶段的关键形。改挂/拆分应保留已有部件在画布上的 X 姿态。Y 重点是眉眼、眼嘴、嘴颏的距离：低头缩短、嘴变扁，下脸收窄；抬头眉眼拉开、嘴变高，下颊和下颌饱满。没有耳朵时跳过，不假造图层。

固定脖子从开始进入完整预览；脸型、下颌线和蒙版同步检查上下遮盖并记录需求，脖子顶部延长与最终接触调整统一在 step07。`up-check.png`、`down-check.png` 用共享工作台渲染与参考并排。程序验证已制作的 X，继承贴图并输出本步 `deformers.json`。

## step06_angle-xy：斜向四角

`linear.json` 是完整层级的初始文档，各节点局部 X/Y 位移相加。`edit_nine_axis {}` 建立 `face-xy.json`，agent 制作 `keyformsXY` 左上、左下，程序镜像组合后的结果，再反解到右侧父级。自定义镜像名称用 `mirror_pair`，也支持完整 `left/right` 词的自动配对。

四角沿用教程的手动斜切，中轴留作参考，整体上下微移由预览决定。保留 X 侧脸额头、眼窝、颧颊、下颌的起伏，以及 Y 的五官距离；不能把左转轮廓强推成全外凸蛋形。父级负责大形，整眼/嘴的层级与独立部件补细节。单独 X/Y 姿态受保护。

用 `view_nine_axis` 检查左右四角和轴到四角的过渡，放大瞳孔、口腔层与固定脖子接触。交付完整作者源及左右上/下检查图，程序继承贴图并输出 `deformers.json`。斜向参考视频与生成机制沿用。

## step07_jaw-line：下颌接触收尾

`edit_nine_axis {}` 从当前四角建立完整 `jaw.json`。复用已拆好的线、蒙版、脸色扩展；根据实际缺口补绘或增加局部 Warp。蒙版 `role: "mask"` 只作裁切源，线用 `clip: {by: [...], invert: true}`。静止保留原线，转动只擦掉压进脖子的接触段，其他线保持粗细与浓淡。贴图修复由私有 Krita 保存副本，原工程与 UUID 保留。

脖子固定、不进头部 Warp。顶部需要补足时沿原两侧向上绘制，与下部连成直线，不能拉斜或拉长。九宫格 `jaw-check.png` 使用同一工作台渲染检查九个角度与中间值；程序继承贴图，完成本步 `deformers.json`。

工作台默认读取完成的最高阶段；URL `nineStage=x|y|xy|jaw` 可明确比较对应阶段。version 2 是当前作者与运行格式，未发布旧格式不做兼容适配。视频生成不变。
