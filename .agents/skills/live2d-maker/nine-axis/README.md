# 头部九轴

入口：`pnpm nine-axis --name <任务名> --knowledge <先验知识目录>`。九轴全部完成前不接入总控流程与工作台阶段，只能这样单独启动；目前 step01 已能运行；step02 的变形器与补绘仍由人工拟合制作（pink-doll），用来固定后续工作流应生成的格式。状态记在各步骤目录的完成标记。

| 步骤 | 输入 | 交付 |
| --- | --- | --- |
| `step01_turn` | 角色工作台当前的角色图（阴影蒙版完成时为 `shadow/step01_mask/character-shadowed.png`，否则为 `character-assembly/step01/character-assembled.png`），以及 `part-layering/parts/{face,hair,head_accessories}.svg` | `nine-axis/step01_turn/upper-body.png`、`crop.json`、`{left,up,down,left-up,left-down}.png`、`views.json` |
| `step02_head` | 同上的 KRA / PNG 与 `step01_turn` 的视角参考 | `nine-axis/step02_head/deformers.json`、`layers/*.png`、`character-nine-axis.kra`、同名 PNG、`source.json` |

路径常量见 `shared/nine-axis.ts`。

## step01_turn：头部视角参考

1. 按脸、头发、头饰形状的不透明范围截取方形头部特写，取景与模板 pink-doll 的参考图一致：上沿为头部最高点，下沿为脸底再往下半个脸高（到肩线），以脸中心为横向中心，四周留 6%；宽度只需容下脸与头饰，长发可被两侧裁掉；超出画布处补灰（128）。裁切框写入 `crop.json`。
2. 五个视角 left、up、down、left-up、left-down 各由一个生图 agent 同时生成：图1 为 `upper-body.png`，图2、图3 为模板角色 pink-doll 的正面与目标姿态（`knowledge/nine-axis/step01_turn/references/pink-doll/`），提示词为同目录 `prompts/视角参考.md`，各视角的动作说明在 `prompts/views/<视角>.md`。右侧视角不画：角色常不对称，但脸部形变可以镜像复用。
3. 结果铺在同一灰色上，缩放到上半身同尺寸后写为 `<视角>.png`；模型与各文件哈希写入 `views.json`。

agent 使用 `layering_agent_preparation_model`（默认 gpt-6.1-sol-low），生图模型为 `layering_nine_axis_view_image_model`，留空继承 `layering_default_image_model`。已完成的 step01 保留；来源角色图重做后如需新视角，删除 `nine-axis/step01_turn` 再运行。

## step02_head

- `deformers.json`：每个头部图层一个 16×16 warp deformer，控制点为原画像素，关键形在 ParamAngleX −30 / 0 / +30；`layers/` 是各层贴图，路径相对本步骤目录。
- `character-nine-axis.kra`：在来源 KRA 上补绘转头露出的区域（例如后发被脸遮住的内层与外轮廓线），其他图层与 UUID 不变，因此阴影 `shadows.json` 的绑定仍然有效。旧 KRA 不覆盖。
- `source.json`：`{version: 1, sourceDocument, sourceColor, sourceKraHash, sourceColorHash, updatedAt}`，记录制作时的来源工程。

载入顺序：工作台先按既有规则选出组装或阴影 KRA；若 `source.json` 指向的正是这份 KRA / PNG 且哈希一致，改为载入 `character-nine-axis.kra` 与同名 PNG。来源变化时退回所选 KRA，并标记九轴 KRA 待重做，不混用旧补绘。
