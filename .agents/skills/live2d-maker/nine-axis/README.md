# 头部九轴

独立入口：`pnpm nine-axis --name <任务名> --dir <绝对运行根目录> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。总入口加 `--live` 可在阴影完成后自动继续，首次默认不启动；`--no-live` 关闭续接，继续／恢复／重试省略时沿用任务保存的选择。显式范围仍优先，单跑支持 `--from nine-axis --to nine-axis`。

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

## 依赖与视频配置

开启总入口 `--live` 后，阴影完成会进入九轴 section；独立运行 `pnpm nine-axis` 或选择九轴执行范围也使用同一依赖。需要 ffmpeg、Krita 与显示环境，以及可用的 Seedance 视频服务。默认只运行到阴影的路线不需要视频配置。

在 skill 根目录 `.env` 配置下列三项；已有配置和 shell 覆盖仍按原有优先级生效：

```dotenv
video_base_url=https://video.example.com/v1
video_api_key=<视频服务密钥>
nine_axis_view_video_model=seedance-2.5
```

视频模型支持 `seedance-2.5`、`seedance-2.0` 系列，默认 `seedance-2.5`；使用 2.0 时将模型字段改为 `seedance-2.0`，并确认服务账号拥有该模型权限。视频服务需要支持图生视频的 OpenAI Videos API 形式：`POST /videos` 和 `GET /videos/<id>/content`。生图模型或生图 API 不能代替这项配置。网页可在“管线配置 → 环境与模型 → 运行环境”编辑同名字段，保存后用于下一次启动或恢复。

ffmpeg 用于解码视频、读取帧数与提取参考帧。当前程序先使用启动环境变量 `ASTRA_STUDIO_FFMPEG` 指定的可执行文件，否则查找 PATH 中的 `ffmpeg`。Windows 使用解压后的 `ffmpeg.exe`，当前须指定正斜杠绝对路径，例如 `C:/Tools/ffmpeg/bin/ffmpeg.exe`：现有查找代码尚未处理 Windows PATH 中的 `.exe` 后缀或反斜杠显式路径。macOS、Linux 可指定适配本机 CPU 架构的便携二进制，具有执行权限即可。指定便携路径无需修改系统 PATH，也不需要管理员安装。

当前版本尚未自动下载便携 ffmpeg。缺少可执行文件时会明确报错；手动安装或配置便携路径后再继续。

## 素材与投影

agent 确认部件与投影关系，程序根据上游已有的 part／图层对应关系执行导出。已确认 UUID 优先于接收容器的名称。底层保留自身绘画与自身蒙版，外部独立投影单独导出；头发、头饰及其投影保留原尺寸和坐标，供后续继续制作。

投影来源决定制作归属与运动来源；接收面和蒙版决定显示时的裁切。例如刘海投到脸上的阴影随头发进入后续阶段，下巴投到脖子的阴影在脸部连接阶段处理。记录使用真实工程关系，不规定某一种阴影的字段名或部件名。

## 制作与交付

各方向沿用原来的描边、补全、Warp 拟合、五官与过渡制作指引，仅迁移提示词位置和更新输入／输出路径。头发遮挡下的脸缘补全仍由各方向 agent 完成，下颌阶段处理下缘连接。

当前最后一步交付脸、五官、已有耳朵及固定脖子连接的九轴模型和实际引用贴图；共享头发、头饰素材继续作为后续输入保留。工作台读取交付模型声明的范围。全流程导出包含完成阶段的正式模型、贴图、工程与说明，排除 workspace 和 agent 会话。

工作台按实际步骤展示进展，读取各步骤事实与本次调度活动，显示真实 Krita 排队、名额占用与进程使用状态。九轴栏目只有一个缩略头，随页面鼠标位置自动运动；可用轴向／角度取自当前保存模型。半抬头／半低头时侧转范围沿弧线收窄，鼠标进入禁区后沿边界切向滑动。该限制仅作用于效果展示，完整角色工作台与模型关键形不变。视频生成后即可播放，选帧保存后即可看图；普通编辑与拟合持续发布当前模型，可在九轴预览中查看中间结果，完成标记仍由调度器管理。旧四步成果保持原目录并可浏览，不因查看网页而移动或重跑。

## 参数与恢复

角度仍只读取 [angles.json](../knowledge/nine-axis/step02_video/references/angles.json)，表示制作关键形的度数标签。参考、SVG、trace 与模型使用共同裁框和原画布坐标。

`--continue` 保留产物与原会话，`--resume` 保留产物并清除所选会话，`--retry` 重做所选未完成分支并保留已完成兄弟。重试单轴模型不会删除斜角视频，重试斜角制作不会重生视频。
