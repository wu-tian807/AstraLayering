# 头部九轴

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。九轴全部完成前不接入总控流程与工作台阶段，只能这样单独启动；目前只做脸部与双耳：step02 左右转向（ParamAngleX），step04 上下（ParamAngleY），不含头发，斜向（四角）未做。ParamAngleX / ParamAngleY 处处以度数为值：ParamAngleX −30 / +30（step01 的 left 取向左转头视频中转到 30° 的帧，+30 由 step02 镜像），ParamAngleY +25 抬头 / −25 低头（step03 取镜头上下移动视频中的 25° 帧）。各角度只记在 `knowledge/nine-axis/step01_views/references/angles.json`，由程序用来取视频帧、填进 step02、step04 的提示词；agent 交付的关键形键、`deformers.json` 的参数范围与关键形键都是这些度数，工作台的范围读文档本身。改角度幅度只改这个文件。换成 Cubism 默认 ±30 等范围留给以后的导出层。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_views` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_views/upper-body.png`、`crop.json`、`left.png`、`left.mp4`、`frames/`、`views.json` |
| `step02_angle-x` | 同上的 KRA / PNG 与 `step01_views` 的视角参考 | `nine-axis/step02_angle-x/face-left.json`、`layers/*.png`、`left-check.png`、`deformers.json`、`source.json` |
| `step03_views-y` | `step01_views` 的 `upper-body.png` | `nine-axis/step03_views-y/up.png`、`down.png`、`up.mp4`、`down.mp4`、`frames/`、`views.json` |
| `step04_angle-y` | `step02_angle-x` 的 `deformers.json` 与 `layers/`，`step03_views-y` 的 up、down 视角 | `nine-axis/step04_angle-y/face-y.json`、`up-check.png`、`down-check.png`、`deformers.json`、`layers/*.png` |

步骤名后缀说明各步做什么：`views` 生成左右视角参考，`views-y` 生成上下视角参考，`angle-x` 做角度 X（左右），`angle-y` 做角度 Y（上下）。

路径常量见 `shared/nine-axis.ts`。

## step01_views：头部视角参考

1. 按脸、头发、头饰形状的不透明范围截取方形头部特写，取景与模板 pink-doll 的参考图一致：上沿为头部最高点，下沿为脸底再往下半个脸高（到肩线），以脸中心为横向中心，四周留 6%；宽度只需容下脸与头饰，长发可被两侧裁掉；超出画布处补灰（128）。裁切框写入 `crop.json`。
2. 生成一段向左转头视频（只需向左，向右由 step02 镜像）：首帧为 `upper-body.png`，提示词为 `prompts/转头.md`（只转头，表情、身体不动，匀速转到最后一帧的正侧面 90°）。
3. 用 ffmpeg 取帧：第 `round((帧数−1)×30/90)` 帧即转到 30° 的一帧，缩放到上半身同尺寸后写为 `left.png`；视频存为 `left.mp4`，原始帧在 `frames/`，模型、帧号与各文件哈希写入 `views.json`。

生视频接口为 `layering_video_base_url` / `layering_video_api_key`，留空沿用 OpenAI 生图代理（`layering_openai_image_*`）；模型为 `nine_axis_view_video_model`（默认 seedance-2.5）。需要 ffmpeg。已完成的 step01 保留；来源角色图重做后如需新视角，删除 `nine-axis/step01_views` 再运行。

## step03_views-y：上下视角参考

1. 以 step01 的 `upper-body.png` 为首帧生成两段 5 秒视频，人物不动、只有镜头移动，都在最后一帧到 90°：
   - up：`prompts/视角视频.md`，镜头匀速降到下巴正下方仰视，脸看起来抬起；
   - down：`prompts/groups/down/视角视频.md`，镜头匀速升到头顶正上方俯视，脸看起来低下。
2. 按 `angles.json` 的 up、down 度数（默认都是 25°）取帧：第 `round((帧数−1)×25/90)` 帧，缩放到上半身同尺寸后写为 `up.png`、`down.png`；视频、原始帧、模型、帧号与哈希写入本步 `views.json`。

生视频接口、模型与 ffmpeg 同 step01。step01 重做后本步随之重做。

## step02_angle-x：left 方向的脸部＋双耳透视形变

1. agent（`nine_axis_head_agent_model`）带着 krita 与 view_bitmap 工具启动，提示词 `knowledge/nine-axis/step02_angle-x/prompts/脸部与双耳转向.md` 给出方法与教程先验。五官与脸底分开做：五官在 left.png 中露出来，按模板匹配定位、竖轴圆柱转向，再分眉眼、嘴、鼻拟合到 left.png 的五官像素；脸底轮廓常被头发遮住，先按教程画出转过去的整条轮廓（头的大小不变、远侧往上收、近侧往左下移、下颌底连续、不画后脑，并包住拟合好的五官），再以轮廓对应与五官锚点做一个平滑的整体变形（只在脸底不透明区内求）；合起来看时五官位置不对只整组平移。最后导出为每层 warp（脸底 32×32，其余 16×16）。不提供固定的拟合库：agent 在本步 `workspace/` 里自写脚本，蒙版、轮廓段、权重、ROI 与远近侧耳等按角色判断并看图检查。
2. agent 只交付向左（−30）：`face-left.json`（脸部中轴 `axis`、各层控制点，按绘制顺序从上到下）、`layers/`、`left-check.png`。不补绘。耳朵不拟合生图像素，近侧耳只随父级平移和横向缩放；远侧耳整体转到脑后、排在脸底之下由脸遮挡，不用透明度隐藏（交付带 `opacity` 会被拒绝）。
3. 程序检查交付，按 id 中的 left/right 配对，把配对图层的 −30 关于中轴镜像为 +30，写出 `deformers.json` 与 `source.json`。

- `deformers.json`：每个脸部图层一个 warp deformer（脸底 32×32，其余 16×16），控制点为原画像素，关键形在 ParamAngleX −30 / 0 / +30（度数）；部件按绘制顺序从上到下排列；`layers/` 是各层贴图，路径相对本步骤目录。
- `character-nine-axis.kra`（pink-doll 人工样例；本步骤暂不生成）：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。

## step04_angle-y：脸部＋双耳的上下形变

1. agent（与 step02 同用 `nine_axis_head_agent_model`）带着 view_bitmap 工具启动，提示词 `knowledge/nine-axis/step04_angle-y/prompts/脸部与双耳上下.md`。沿用 step02 的图层贴图、网格与绘制顺序，目标是让脸型的变形对齐 step03 视频帧里的脸型，方法同 step02：父级为绕横轴转动的球加一层平滑位移，子级分眉眼、嘴、鼻。抬头（up → +25）与低头（down → −25）分别拟合，不镜像。教程先验（`references/tutorial/` 的正面、低头、抬头网格与 3D 模型对照）：头的大小不变、脸变扁；低头时网格中间下弯、头顶一圈饱满、下巴变尖，抬头时下半张脸饱满、下巴变圆润；低头时眉眼距离缩小、嘴变扁、鼻子靠近嘴，抬头相反。双耳都按父级在耳根点的位移随动，不转到脑后。
2. 只做形变本身：抬头、低头时轮廓线的出现与消失不处理，留给后续步骤统一调整。不补绘、不用透明度。
3. agent 交付 `face-y.json`（每个 step02 部件的 "25"、"-25" 关键形）与 `up-check.png`、`down-check.png`。程序检查部件与控制点数和 step02 一致，把 `layers/` 复制到本步，写出含 X、Y 两个参数的 `deformers.json`：X 关键形仍在 `keyforms`，Y 关键形在 `keyformsY`（与 X 共用静止形 `keyforms["0"]`）。

工作台在本步 `deformers.json` 存在时读它，否则读 step02 的。预览把 X、Y 各自相对静止形的位移相加；只有另一角度为 0 时才能编辑该角度的关键形。
