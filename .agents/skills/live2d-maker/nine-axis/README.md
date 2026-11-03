# 头部九轴

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。九轴全部完成前不接入总控流程与工作台阶段，只能这样单独启动；目前只做脸部与双耳：step03 左右转向（ParamAngleX），step05 上下（ParamAngleY），step06 斜向（四角），不含头发。ParamAngleX / ParamAngleY 处处以度数为值：ParamAngleX −30 / +30（step02 取向左转头视频中转到 30° 的帧，+30 由 step03 镜像），ParamAngleY +25 抬头 / −25 低头（step04 取镜头上下移动视频中的 25° 帧）。各角度只记在 `knowledge/nine-axis/step01_video/references/angles.json`，由程序用来取视频帧、填进 step03、step05、step06 的提示词；agent 交付的关键形键、`deformers.json` 的参数范围与关键形键都是这些度数，工作台的范围读文档本身。改角度幅度只改这个文件。换成 Cubism 默认 ±30 等范围留给以后的导出层。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_video` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_video/upper-body.png`、`crop.json`、`left.mp4`、`up.mp4`、`down.mp4`、`first/{up,down}.png`、`left-up.mp4`、`left-down.mp4`、`frames/`、`videos.json` |
| `step02_views` | `step01_video` 的 `left.mp4` 与 `upper-body.png` | `nine-axis/step02_views/left.png`、`frames/`、`views.json` |
| `step03_angle-x` | 同上的 KRA / PNG，step01 的 `upper-body.png`、`crop.json` 与 step02 的 `left.png` | `nine-axis/step03_angle-x/face-left.json`、`layers/*.png`、`left-check.png`、`deformers.json`、`source.json` |
| `step04_views-y` | `step01_video` 的 `up.mp4`、`down.mp4` 与 `upper-body.png` | `nine-axis/step04_views-y/up.png`、`down.png`、`frames/`、`views.json` |
| `step05_angle-y` | `step03_angle-x` 的 `deformers.json` 与 `layers/`，`step04_views-y` 的 up、down 视角 | `nine-axis/step05_angle-y/face-y.json`、`up-check.png`、`down-check.png`、`deformers.json`、`layers/*.png` |
| `step06_angle-xy` | `step05_angle-y` 的 `deformers.json`，各视角，step01 的 `left-up.mp4`、`left-down.mp4` | `nine-axis/step06_angle-xy/linear.json`、`face-xy.json`、`left-up-check.png`、`left-down-check.png`、`deformers.json`、`layers/*.png` |

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

1. agent（`nine_axis_head_agent_model`）带着 krita、view_bitmap 与 view_nine_axis 工具启动，提示词 `knowledge/nine-axis/step03_angle-x/prompts/脸部与双耳转向.md` 给出目标、教程纯脸的转头样子与要保护的地方。agent 用 krita 导出脸部图层，像在 Cubism 里拖手柄那样直接改 `face-left.json` 的控制点：先拉脸底大形，再调五官与耳朵；每改一次用 view_nine_axis（按程序组装交付、用工作台渲染器画，可用 grid 叠出部件网格与控制点）预览，看起来对了才算做好。脚本只帮着成片挪点，不拿参考图自动拟合。每层一个 warp（脸底 32×32，其余 16×16）。
2. agent 只交付向左（−30）：`face-left.json`（脸部中轴 `axis`、各层控制点，按绘制顺序从上到下）、`layers/`、`left-check.png`。不补绘。耳朵整只刚性随动，近侧耳根贴着脸缘；远侧耳整体转到脑后、排在脸底之下由脸遮挡，不用透明度隐藏（交付带 `opacity` 会被拒绝）。
3. 程序检查交付，按 id 中的 left/right 配对，把配对图层的 −30 关于中轴镜像为 +30，写出 `deformers.json` 与 `source.json`。

- `deformers.json`：每个脸部图层一个 warp deformer（脸底 32×32，其余 16×16），控制点为原画像素，关键形在 ParamAngleX −30 / 0 / +30（度数）；部件按绘制顺序从上到下排列；`layers/` 是各层贴图，路径相对本步骤目录。
- `character-nine-axis.kra`（pink-doll 人工样例；本步骤暂不生成）：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。

## step05_angle-y：脸部＋双耳的上下形变

1. agent（与 step03 同用 `nine_axis_head_agent_model`）带着 view_bitmap 与 view_nine_axis 工具启动，提示词 `knowledge/nine-axis/step05_angle-y/prompts/脸部与双耳上下.md`。沿用 step03 的图层贴图、网格与绘制顺序，像 step03 那样直接改控制点、用 view_nine_axis 预览，照 step04 视角帧与教程纯脸（`references/tutorial/` 的正面、低头、抬头网格与 3D 模型对照）摆出抬头（up → +25）与低头（down → −25），不镜像：头的大小不变、脸变扁；低头时网格中间下弯、头顶一圈饱满、下巴变尖，抬头时下半张脸饱满、下巴变圆润；低头时眉眼距离缩小、嘴变扁、鼻子靠近嘴，抬头相反。耳朵贴着脸缘随动。
2. 只做形变本身：抬头、低头时轮廓线的出现与消失不处理，留给后续步骤统一调整。不补绘、不用透明度。
3. agent 交付 `face-y.json`（每个 step03 部件的 "25"、"-25" 关键形）与 `up-check.png`、`down-check.png`。程序检查部件与控制点数和 step03 一致，把 `layers/` 复制到本步，写出含 X、Y 两个参数的 `deformers.json`：X 关键形仍在 `keyforms`，Y 关键形在 `keyformsY`（与 X 共用静止形 `keyforms["0"]`）。

工作台在本步 `deformers.json` 存在时读它，否则读 step03 的。斜向角未做时预览把 X、Y 各自相对静止形的位移相加；只有另一角度为 0 时才能编辑该角度的关键形。

## step06_angle-xy：脸部＋双耳的斜向（四角）

1. 程序把 step03 的向左与 step05 的抬头、低头相对静止形的位移相加，写出左上（ParamAngleX −30, ParamAngleY +25）、左下（−30, −25）的起始形 `linear.json`。
2. agent（`nine_axis_head_agent_model`）带着 view_bitmap 与 view_nine_axis 启动，提示词 `knowledge/nine-axis/step06_angle-xy/prompts/脸部与双耳斜向.md`：从起始形出发照教程直接改控制点手动斜切、用 view_nine_axis 预览，把两个角调得好看、从正面到四角过渡顺滑。提示词里带教程斜切要点与 `references/tutorial/` 的教程斜切截图（左上、左下的眉眼腮与嘴，左下做完的鼻嘴下巴）。
3. 斜向参考由 agent 需要时自己用 ffmpeg 从 step01 的 `left-up.mp4`、`left-down.mp4` 取帧：头从抬头、低头首帧匀速向左转，最后一帧到侧面 90°，向左度数处的一帧即斜向角（有几度误差），只作形状参考。
4. agent 交付 `face-xy.json`（每个部件的 "-30,25"、"-30,-25" 关键形）与两张对照图。程序检查部件与控制点数和 step05 一致，按左右配对镜像出右上 "30,25"、右下 "30,-25"，写出 `deformers.json`：四角在 `keyformsXY`，键为 "X,Y" 度数。

工作台在本步 `deformers.json` 存在时优先读它，在 X、Y 的 3×3 关键形之间双线性插值；停在斜向角上（两个角度都在关键形上）时也能拖动编辑该角。轮廓线的出现与消失留给后续步骤。
