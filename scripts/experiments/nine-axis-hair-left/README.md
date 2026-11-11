# Left 头发液化试验

保存本轮制作代码、输入模型和最后一轮结果，继续研究头发转头的变形方式。

刘海的父 Warp 加局部液化已得到认可。两片侧发分别制作 left，仍需优化：近侧发根偏高、偏向头顶中间，耳前发面太斜、太窄，尚未还原参考中的圆润体积。

[模型、参考图与预览](../../../demos/tanuki-girl/nine-axis/step08_hair/)中，`baseline-hair-x.json` 是认可的刘海加原形侧发，`hair-x.json` 是第 3 次独立重跑的结果。贴图复用案例已有的头部素材。

## 重跑侧发

从仓库根目录执行，先按项目 setup 配置模型服务并安装依赖。每次用新的任务目录，会从同一基线创建新会话。制作提示和工具说明保存在任务的 `workspace`。

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/hair-left-trial
node scripts/experiments/nine-axis-hair-left/trial.mjs . .run/hair-left-trial .agents/skills/live2d-maker/knowledge run .run/hair-left-trial/nine-axis/step08_hair/workspace/side-hair-left-task.md side-hair-left
```

本轮只制作两片侧发的 X=-30、Y=0；两片分别变形，保留刘海、脸部、脖子以及正面和 right。

## 预览与叠图

`prepare.mjs` 加 `--current` 可把最后一轮结果装入新的任务目录，直接查看现状。预览需要 Playwright Chromium 和 PATH 中的 ffmpeg；Python 图片脚本需要 Pillow、NumPy。

```sh
node scripts/experiments/nine-axis-hair-left/prepare.mjs .run/hair-left-preview --current
node scripts/experiments/nine-axis-hair-left/preview.mjs . .run/hair-left-preview side-hair-left side-hair-rerun
python3 scripts/experiments/nine-axis-hair-left/compare.py .run/hair-left-preview
node scripts/experiments/nine-axis-hair-left/edge-overlay.mjs . .run/hair-left-preview
python3 scripts/experiments/nine-axis-hair-left/blend.py .run/hair-left-preview
```

叠图中青色是当前模型的边缘，底图是 left 参考，使用同一画布窗口 `[319,-21,774,774]`。
