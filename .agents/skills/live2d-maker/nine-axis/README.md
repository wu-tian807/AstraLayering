# 头部九轴

独立入口：`pnpm nine-axis --name <任务名> --dir <绝对运行根目录> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。总入口支持 `--from nine-axis --to nine-axis`。

完整目标包含脸、五官、头发与头饰。当前实现到脸部＋五官九轴的中间交付，头发和头饰的九轴制作后续再做。

| 步骤 | 职责 | 主要产物 |
| --- | --- | --- |
| `step01_preparation` | 一次整理上游头部素材与投影关系；原工程只读 | 可编辑工程副本、完整画布 PNG、共同 neutral、原尺寸贴图、头发与头饰参考、独立投影及其来源／接收关系 |
| `step02_video` | 从共同正面生成单轴视频 | upper-body.png、crop.json、left/up/down.mp4、videos.json |
| `step03_frames` | agent 选择单轴参考帧，程序执行帧提取 | 目标 PNG、原帧、selected-frames.json、views.json |
| `step04_angles` | model 与 video 两支并发 | model：left/up/down 独立模型与合并；video：left-up/down 原片 |
| `step05_frames` | 使用 step04 的视频选择斜角参考帧 | 目标 PNG、原帧、selected-frames.json |
| `step06_angle-xy` | 基于 step04 单轴模型和 step05 参考帧完成斜角 | 描边、trace、face-xy.json、deformers.json、模型实际引用贴图 |
| `step07_jaw-line` | 完成下颌与固定脖子连接 | jaw.json、deformers.json、模型实际引用贴图、本步 KRA／PNG、说明与姿态对照 |

顺序使用共同 section 调度；step04 两支与 model 内三个方向使用共同 group 调度。没有单独的九轴调度系统。每个真实步骤／分支独立保存完成标记、会话、作者与草稿；中断后沿用已完成分支。单跑支持 `--step step04_angles/model/up`，也可选择 model 或 video。

## 素材与投影

agent 确认部件与投影关系，程序根据上游已有的 part／图层对应关系执行导出。已确认 UUID 优先于接收容器的名称。底层保留自身绘画与自身蒙版，外部独立投影单独导出；头发、头饰及其投影保留原尺寸和坐标，供后续继续制作。

投影来源决定制作归属与运动来源；接收面和蒙版决定显示时的裁切。例如刘海投到脸上的阴影随头发进入后续阶段，下巴投到脖子的阴影在脸部连接阶段处理。记录使用真实工程关系，不规定某一种阴影的字段名或部件名。

## 制作与交付

各方向沿用原来的描边、补全、Warp 拟合、五官与过渡制作指引，仅迁移提示词位置和更新输入／输出路径。头发遮挡下的脸缘补全仍由各方向 agent 完成，下颌阶段处理下缘连接。

当前最后一步交付脸、五官、已有耳朵及固定脖子连接的九轴模型和实际引用贴图；共享头发、头饰素材继续作为后续输入保留。工作台读取交付模型声明的范围。全流程导出包含完成阶段的正式模型、贴图、工程与说明，排除 workspace 和 agent 会话。

工作台按实际步骤展示进展。视频生成后即可播放，选帧保存后即可看图；普通编辑与拟合持续发布当前模型，可在九轴预览中查看中间结果，完成标记仍由调度器管理。旧四步成果保持原目录并可浏览，不因查看网页而移动或重跑。

## 参数与恢复

角度仍只读取 [angles.json](../knowledge/nine-axis/step02_video/references/angles.json)，表示制作关键形的度数标签。参考、SVG、trace 与模型使用共同裁框和原画布坐标。

`--continue` 保留产物与原会话，`--resume` 保留产物并清除所选会话，`--retry` 重做所选未完成分支并保留已完成兄弟。重试单轴模型不会删除斜角视频，重试斜角制作不会重生视频。
