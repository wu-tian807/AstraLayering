# 头部九轴

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。九轴全部完成前不接入总控流程与工作台阶段，只能这样单独启动；目前只做脸部与双耳：step02 左右转向（ParamAngleX），step03 上下（ParamAngleY），不含头发，斜向（四角）未做。左右边界关键形 ParamAngleX ±30 对应 step01 left 视角约 45° 的转头，ParamAngleY +30 / −30 对应 up 约 25° 的抬头与 down 约 20° 的低头（±30 是参数值，不是度数）。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_views` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_views/upper-body.png`、`crop.json`、`{left,up,down,left-up,left-down}.png`、`views.json` |
| `step02_angle-x` | 同上的 KRA / PNG 与 `step01_views` 的视角参考 | `nine-axis/step02_angle-x/face-left.json`、`layers/*.png`、`left-check.png`、`deformers.json`、`source.json` |
| `step03_angle-y` | `step02_angle-x` 的 `deformers.json` 与 `layers/`，`step01_views` 的 up、down 视角 | `nine-axis/step03_angle-y/face-y.json`、`up-check.png`、`down-check.png`、`deformers.json`、`layers/*.png` |

步骤名后缀说明各步做什么：`views` 生成视角参考，`angle-x` 做角度 X（左右），`angle-y` 做角度 Y（上下）。

路径常量见 `shared/nine-axis.ts`。

## step01_views：头部视角参考

1. 按脸、头发、头饰形状的不透明范围截取方形头部特写，取景与模板 pink-doll 的参考图一致：上沿为头部最高点，下沿为脸底再往下半个脸高（到肩线），以脸中心为横向中心，四周留 6%；宽度只需容下脸与头饰，长发可被两侧裁掉；超出画布处补灰（128）。裁切框写入 `crop.json`。
2. 五个视角 left、up、down、left-up、left-down 各由一个生图 agent 同时生成：图1 为 `upper-body.png`，图2、图3 为模板角色 pink-doll 的正面与目标姿态（`knowledge/nine-axis/step01_views/references/pink-doll/`），提示词为同目录 `prompts/视角参考.md`，各视角的动作说明在 `prompts/views/<视角>.md`。右侧视角不画：角色常不对称，但脸部形变可以镜像复用。
3. 结果铺在同一灰色上，缩放到上半身同尺寸后写为 `<视角>.png`；模型与各文件哈希写入 `views.json`。

agent 使用 `preparation_agent_model`（默认 gpt-6.1-sol-low），生图模型为 `layering_nine_axis_view_image_model`，留空继承 `layering_default_image_model`。已完成的 step01 保留；来源角色图重做后如需新视角，删除 `nine-axis/step01_views` 再运行。

## step02_angle-x：left 方向的脸部＋双耳透视形变

1. agent（`layering_agent_nine_axis_head_model`）带着 krita 与 view_bitmap 工具启动，提示词 `knowledge/nine-axis/step02_angle-x/prompts/脸部与双耳转向.md` 给出 pink-doll 的拟合方法与教程先验：模板匹配定位五官，父级为圆柱转向加 10×10 平滑残差（对齐向左视角的可见脸轮廓），子级按教程分眉眼、嘴、鼻在父级上补细节，最后牛顿法反解为每层 16×16 warp。不提供固定的拟合库：agent 在本步 `workspace/` 里自写脚本，蒙版、轮廓段、权重、ROI 与远近侧耳等按角色判断并看图检查。
2. agent 只交付向左（−30）：`face-left.json`（脸部中轴 `axis`、各层控制点，按绘制顺序从上到下）、`layers/`、`left-check.png`。不补绘。耳朵不拟合生图像素，近侧耳只随父级平移和横向缩放；远侧耳整体转到脑后、排在脸底之下由脸遮挡，不用透明度隐藏（交付带 `opacity` 会被拒绝）。
3. 程序检查交付，按 id 中的 left/right 配对，把配对图层的 −30 关于中轴镜像为 +30，写出 `deformers.json` 与 `source.json`。

- `deformers.json`：每个脸部图层一个 16×16 warp deformer，控制点为原画像素，关键形在 ParamAngleX −30 / 0 / +30；部件按绘制顺序从上到下排列；`layers/` 是各层贴图，路径相对本步骤目录。
- `character-nine-axis.kra`（pink-doll 人工样例；本步骤暂不生成）：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。

## step03_angle-y：脸部＋双耳的上下形变

1. agent（与 step02 同用 `layering_agent_nine_axis_head_model`）带着 view_bitmap 工具启动，提示词 `knowledge/nine-axis/step03_angle-y/prompts/脸部与双耳上下.md`。沿用 step02 的图层贴图、16×16 网格与绘制顺序，方法同 step02，只把圆柱的转轴换成横轴：父级为横轴圆柱俯仰加 10×10 残差，子级分眉眼、嘴、鼻。抬头（up → +30）与低头（down → −30）分别拟合，不镜像。教程先验以距离关系为主：低头时眉眼距离缩小、嘴变扁、鼻子靠近嘴，抬头相反。双耳都按父级在耳根点的位移随动，不转到脑后。
2. 只做形变本身：抬头、低头时轮廓线的出现与消失不处理，留给后续步骤统一调整。不补绘、不用透明度。
3. agent 交付 `face-y.json`（每个 step02 部件的 "30"、"-30" 关键形）与 `up-check.png`、`down-check.png`。程序检查部件与控制点数和 step02 一致，把 `layers/` 复制到本步，写出含 X、Y 两个参数的 `deformers.json`：X 关键形仍在 `keyforms`，Y 关键形在 `keyformsY`（与 X 共用静止形 `keyforms["0"]`）。

工作台在本步 `deformers.json` 存在时读它，否则读 step02 的。预览把 X、Y 各自相对静止形的位移相加；只有另一角度为 0 时才能编辑该角度的关键形。
