---
name: live2d-maker
description: 从角色参考图制作人物与衣服分层 KRA、透明 PNG、穿戴组装及阴影。用于配置、启动、续跑制作和打开工作台，也可开启头部九轴。
---

# Live2D Maker

在安装好的 skill 目录执行命令。人物与衣服并行制作，完成后组装、制作阴影；加 `--live` 继续头部九轴。

## 执行流程

1. 确定参考图、任务名、运行目录、制作范围和是否标准化姿态。沿用用户已确认的选择及已有任务参数，只补问缺失信息。
2. 按[安装说明](references/setup.md)准备环境，运行 `pnpm env:check` 核对模型配置。已有任务先查状态；正在运行的任务直接跟进。
3. 后台启动，打开工作台中的任务页面并给出链接。复用已有工作台，确保网页和 CLI 使用同一个运行根目录。
4. 使用宿主的定时能力每 2 小时检查进展、处理可恢复故障。在任务 `monitor.md` 记下任务路径、启动参数和定时 ID；宿主没有定时能力时告知用户。
5. 完成后查看合成图，核对 KRA、PNG 和报告，给出文件及网页入口，关闭本任务的定时检查。

## 启动与续跑

```sh
pnpm start --name my-character --image /绝对路径/角色.png --krita /绝对路径/krita --background
pnpm start --name my-character --status --json
pnpm start --name my-character --continue --background
pnpm start --name my-character --stop
```

默认任务目录是 `<仓库>/.run/<任务名>/`，独立安装时在 skill 上一级的 `.run/`。自定义运行目录用 `--dir`，以后每次操作都传同一个目录。相对路径以任务目录为基准，绝对路径直接使用；给绘制 agent 的文件路径使用绝对路径。

| 参数 | 用途 |
| --- | --- |
| `--name`、`--image`、`--dir` | 任务名、首次参考图、运行根目录 |
| `--krita` | Krita 可执行文件，绘制、组装、阴影和九轴使用 |
| `--ffmpeg` | FFmpeg 可执行文件，仅九轴使用 |
| `--from`、`--to` | 制作范围，默认人物分块到阴影 |
| `--live`、`--no-live` | 开启或关闭阴影后的九轴制作，续跑沿用已保存选择 |
| `--standard`、`--no-standard` | 开启或关闭姿态标准化，默认关闭 |
| `--shadow-mode mask\|normal-depth` | 投影蒙版或法线／深度，默认 mask |
| `--jobs` | 全流程共用的 agent 并发名额，默认 3 |
| `--background` | 后台运行 |

网页全局设置提供新任务的默认值。总调度在任务 `run.json` 中维护本任务参数，已有任务可在“执行参数”中调整 Krita、knowledge 和制作选项。

- `--continue`：保留产物和会话，从中断处继续。
- `--resume`：保留产物，换新会话继续。
- `--retry`：删除所选步骤的产物与会话，重新制作。

单步操作使用 `--section <管线> --step <步骤>`，例如 `--retry --section raster-layering --step step02`。制作成功以实际交付文件为准，详细操作见[总流程](workflow/README.md)。

## 单独运行一个 section

先停止同一任务的总调度，再单独启动所需管线。独立 section 启动无状态：**每次传入 `--dir`、`--knowledge` 和所需软件路径**。总调度负责保存参数并传给 section；独立入口沿用工程和会话。

```sh
pnpm character-assembly --name my-character --dir /绝对路径/运行根目录 --knowledge /绝对路径/knowledge --krita /绝对路径/krita
```

| 管线 | 用途 |
| --- | --- |
| [part-layering](part-layering/README.md) | 人物参考准备与拆分 |
| [raster-layering](raster-layering/README.md) | 人物绘制、精修、换装素体 |
| [clothing-part-layering](clothing-part-layering/README.md) | 衣服提取与拆分 |
| [clothing-raster-layering](clothing-raster-layering/README.md) | 衣服绘制与精修 |
| [character-assembly](character-assembly/README.md) | 人物与衣服组装 |
| [shadow](shadow/README.md) | 阴影蒙版或法线／深度 |
| [nine-axis](nine-axis/README.md) | 头部九轴 |

## 头部九轴

网页开启“阴影完成后制作头部九轴”，或总入口加 `--live`。准备 Krita、FFmpeg 和 Seedance 视频配置后即可制作；模型默认 `seedance-2.5`。[查看九轴配置](nine-axis/README.md#依赖与视频配置)。

选帧 agent 调用 `extract_video_frame` 工具即可，FFmpeg 路径由工具使用。

## 交付与参考

完成后点击“导出成果”，或运行 `pnpm export --name <任务名> --output <目录或.zip>`。导出案例放在 `demos/`，继续制作使用 `.run/` 中的任务。

[安装](references/setup.md) · [模型配置](references/model-presets.md) · [工作台与恢复](workflow/README.md) · [工具和产物约定](shared/README.md) · [Codex 补丁](patches/README.md)
