# Left 头发液化试验

本目录保留基于 tanuki-girl demo 的历史 left 转头试验。当前正式制作使用 [step08_hair 工作流](../../../.agents/skills/live2d-maker/nine-axis/README.md)：同一 KRA 和会话依次制作前发、侧发、后发的 left＋right，原生 UUID 按需读取素材，拟合参考并检查连续运动。continue、resume 与 retry 按该工作流的轮次记录执行。

刘海、侧发与后发都可单独优化。原发型、完整头型和转头自然感优先，参考帧只辅助理解转向与空间关系，不要求逐线一致。后发默认保持原形，依靠前侧发相对它的运动与遮挡体现层次；必要时才局部微调。原素材已有的凸台、截断或衔接缺陷应标明，不靠扭曲整片掩盖。

[历史输入模型](https://github.com/wu-tian807/AstraLayering/blob/25cfd46e2bbed0cdc89d9a5c7c68a003823afc13/demos/tanuki-girl/nine-axis/step08_hair/hair-x.json)及其贴图来自旧版 demo。当前 `demos/tanuki-girl` 已替换为完成到阴影的新版本；复现实验时，先在独立检出中恢复上述提交的狸猫女孩归档，再执行下列命令。脚本默认从该归档的 `hair-x.json` 开始，`--current` 也表示此行为；只有显式传 `--baseline` 才读取历史 `baseline-hair-x.json`，该文件目前不在仓库中。

## 按参考优化刘海或侧发

从仓库根目录执行，先按项目 setup 配置模型服务并安装依赖。每次使用新任务目录，会从当前 demo 创建新会话。`prepare.mjs` 复制各范围的任务提示、工具说明与通用比较要求到任务的 `workspace`。

若导出的参考 PNG 缺失，准备脚本按 `references/left-reference.json` 中记录的视频和 frameIndex 恢复目标帧，并以同一视频的第 0 帧恢复正面参考，不另选目标帧；按已记录的完整画布窗口归一化为 774×774，不作特征对齐。来源记录在 `workspace/input-provenance.json`。需 PATH 中有 ffmpeg，或传 `--ffmpeg /绝对路径/ffmpeg`；教程 JPG 缺失不影响准备。

只优化刘海及其专用父 Warp：

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/bangs-left-trial
node scripts/experiments/nine-axis-hair-left/trial.mjs . .run/bangs-left-trial .agents/skills/live2d-maker/knowledge run .run/bangs-left-trial/nine-axis/step08_hair/workspace/bangs-left-task.md bangs-left
```

只优化两片侧发及其专用父 Warp：

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/hair-left-trial
node scripts/experiments/nine-axis-hair-left/trial.mjs . .run/hair-left-trial .agents/skills/live2d-maker/knowledge run .run/hair-left-trial/nine-axis/step08_hair/workspace/side-hair-left-task.md side-hair-left
```

两种范围都只编辑 X=-30、Y=0，保留范围外的节点、正面和 right。`trial.mjs` 自动把 [通用优化目标](hair-reference-review.md) 附在所选任务提示后，并把实际发送内容写入 `workspace/effective-task.md`，因此自定义刘海或侧发提示也使用同一套优化目标。

从已经完成的刘海结果继续侧发时，准备阶段可显式选择该模型及其同目录贴图：

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/side-after-bangs --source-model .run/bangs-left-trial/nine-axis/step08_hair/hair-x.json
node scripts/experiments/nine-axis-hair-left/trial.mjs . .run/side-after-bangs .agents/skills/live2d-maker/knowledge run .run/side-after-bangs/nine-axis/step08_hair/workspace/side-hair-left-task.md side-hair-left
```

## 继续后发

从侧发结果继续后发时，使用同样的单 agent 流程：

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/back-after-side --source-model .run/side-after-bangs/nine-axis/step08_hair/hair-x.json
node scripts/experiments/nine-axis-hair-left/trial.mjs . .run/back-after-side .agents/skills/live2d-maker/knowledge run .run/back-after-side/nine-axis/step08_hair/workspace/back-hair-left-task.md back-hair-left
node scripts/experiments/nine-axis-hair-left/preview.mjs . .run/back-after-side back-hair-left
```

后发范围只允许编辑 `hair/back_hair` 和其专用 Warp，保留刘海、侧发与辫子。后发可以检查后保持原形，完成检查不要求产生形变。整套头发共五片：刘海、左右侧发、后发和一条独立辫子。

## 优化目标

一个制作 agent 在同一回合内完成调整与自检。各片头发共用 [优化目标](hair-reference-review.md)：原发型和头型完整，前后发衔接自然、发面有体积，后发尽量少动。edge、blend 和原色模型都是观察手段，参考边线不重合本身不是失败。

## Agent 内的比较

`view_nine_axis` 带参考图时默认使用 `mode="edge"`，显式设置 `mode="blend"` 才使用 50% 叠图。两者都提供参考／当前／叠图三联图，并使用 `reference={path:"nine-axis/step08_hair/references/left.png",bounds:[319,-21,774,774]}` 保持画布坐标；不自动平移、缩放或重居中参考。不带参考图时仍是当前模型的原色预览。

- edge 把实际渲染的可见透明轮廓以青色叠到参考上，作为整头和局部几何校对的默认方式；不含棋盘、控制网格或裁剪产生的假边。用 only 单看刘海／近侧发／远侧发，分区放大可靠可见轮廓。
- 内部分束线与高光看当前原色模型，需要时用 blend 辅助。
- 修形后看目标发片与相邻发片的组合，以及 X=0、-7.5、-15、-22.5、-30 的自然过渡。left 参考仅对应 -30°，辅助理解朝向，不要求匹配其轮廓。

## 预览与叠图

以下是侧发实验原有的离线预览与边缘脚本。预览需要 Playwright Chromium 和 PATH 中的 ffmpeg；Python 图片脚本需要 Pillow、NumPy。`compare.py` 还需提供上一版截图的绝对路径；agent 内的 blend/edge 比较不依赖这些离线脚本。

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/hair-left-preview --current
node scripts/experiments/nine-axis-hair-left/preview.mjs . .run/hair-left-preview side-hair-left side-hair-rerun
python3 scripts/experiments/nine-axis-hair-left/compare.py .run/hair-left-preview /绝对路径/previous-left.png
node scripts/experiments/nine-axis-hair-left/edge-overlay.mjs . .run/hair-left-preview
python3 scripts/experiments/nine-axis-hair-left/blend.py .run/hair-left-preview
```

叠图中青色是当前模型的边缘，底图是 left 参考，使用同一画布窗口 `[319,-21,774,774]`。
