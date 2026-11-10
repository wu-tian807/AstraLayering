# 头部九轴

制作角色的左右转头、抬头、低头和斜向动作，连同五官、耳朵与下颌一起调整。工作台可预览各步骤的模型，并编辑关键形。

网页开启“阴影完成后制作头部九轴”，或在总入口加 `--live`。续跑沿用任务保存的选择，`--no-live` 关闭。

## 依赖与视频配置

九轴需要 **Krita、FFmpeg 和 Seedance 视频服务**。在全局设置选择已安装或解压的 FFmpeg 可执行文件；Krita 与 FFmpeg 共用浏览、扫描和点选功能。

在“管线配置 → 环境与模型 → 运行环境”填写视频服务地址、密钥和模型，也可以编辑 skill 目录下的 `.env`：

```dotenv
video_base_url=https://video.example.com/v1
video_api_key=<视频服务密钥>
nine_axis_view_video_model=seedance-2.5
```

支持 Seedance 2.5 和 2.0 系列：2.5 填 `seedance-2.5`；2.0 填 `seedance-2`、`seedance-2-fast` 或 `seedance-2-mini`，也支持对应的 `-las` 型号。视频服务使用 OpenAI Videos API。开启 `--live` 或独立运行九轴时，启动前会检查这些配置。

只制作到阴影时，按原流程配置 Krita 和绘图模型即可。

## 独立运行

```sh
pnpm nine-axis --name my-character --dir /绝对路径/运行根目录 --knowledge /绝对路径/knowledge --krita /绝对路径/krita --ffmpeg /绝对路径/ffmpeg
```

独立 section 启动无状态，每次传入运行目录、knowledge 和软件路径。总调度在 `run.json` 中保存本任务参数并传给 section，网页全局设置提供新任务默认值。

选帧 agent 使用 `extract_video_frame` 工具提取参考帧，工具负责调用指定的 FFmpeg。

## 制作流程

| 步骤 | 内容 |
| --- | --- |
| `step01_preparation` | 整理头部素材、贴图与投影关系 |
| `step02_video` | 生成左右转头、抬头和低头的参考视频 |
| `step03_frames` | 选择单轴参考帧 |
| `step04_angles` | 制作单轴模型，同时生成斜角视频 |
| `step05_frames` | 选择斜角参考帧 |
| `step06_angle-xy` | 制作斜角模型 |
| `step07_jaw-line` | 处理下颌与脖子的连接，交付模型、贴图、KRA 和 PNG |

素材沿用上游工程的尺寸、图层与投影关系。制作角度见 [angles.json](../knowledge/nine-axis/step02_video/references/angles.json)。

## 查看与继续

在流程预览中播放视频、查看选帧和模型；进入角色工作台可以调整角度和关键形。完成后通过“导出成果”保存模型、贴图、工程和说明。

`--continue` 保留产物与会话，`--resume` 保留产物并换会话，`--retry` 重做所选步骤。可用 `--step step04_angles/model/up` 选择单个方向。

已产出的非空 MP4 直接沿用，继续时补齐缺失的视频；并发分支失败时，保留已成功的文件。模型和选帧按实际交付文件检查，缺失时在对应步骤处理。[更多恢复操作](../workflow/README.md#故障恢复)。
