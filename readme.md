# AstraLayering

把一张角色图做成可编辑的分层素材：拆分人物与衣服，补全遮挡，组装角色，再制作阴影。你可以在工作台查看过程、编辑图层，最后导出 KRA、透明 PNG 和制作报告。

## 人物分层成果

[![Jianma：原图、成品与分层展示](showcase/jianma-reference-composite-exploded.png)](demos/jianma/README.md)

[Jianma](demos/jianma/README.md)：人物、衣服分层，穿戴组装与阴影。

[![Pink Doll：原图、成品与分层展示](showcase/pink-doll-reference-composite-exploded.png)](demos/pink-doll/README.md)

[Pink Doll](demos/pink-doll/README.md)：58 层人物、8 层衣服。

[![Pink Elf：原图、成品与分层展示](showcase/pink-elf-reference-composite-exploded.png)](demos/pink-elf/README.md)

[Pink Elf](demos/pink-elf/README.md)：70 层人物、32 层衣服。

[![Black White Doll：原图、成品与分层展示](showcase/black-white-doll-reference-composite-exploded.png)](demos/black-white-doll/README.md)

[Black White Doll](demos/black-white-doll/README.md)：81 层人物、19 层衣服。

[查看全部案例与工程](demos/readme.md)

## 开始使用

从 [Releases](https://github.com/wu-tian807/AstraLayering/releases) 下载并解压最新版本，发布包附带 Pink Doll 示例。开发者可以克隆仓库。

### 1. 准备软件与仓库

安装 **Node.js 24.12+、Git、Krita**，并登录 **Codex CLI**。使用默认 Codex 方案还需要 C/C++ 编译工具；Linux 无桌面环境需要 Xvfb。具体安装方法见[安装说明](.agents/skills/live2d-maker/references/setup.md)。

### 2. 双击启动文件

| 系统 | 启动文件 |
| --- | --- |
| macOS | [start-workbench.command](start-workbench.command) |
| Linux | [start-workbench.sh](start-workbench.sh) |
| Windows | [start-workbench.cmd](start-workbench.cmd) |

启动器会安装项目依赖、准备默认配置并打开工作台。

### 3. 在网页中启动任务

1. 打开“全局设置”，选择 Krita。运行目录默认是 `.run/`。
2. 点“新建任务”，上传角色图，填写名称。
3. 选择是否标准化姿态，点“新建并开始”。开启标准化会先把角色调整到适合制作的正面姿态；关闭则保留原图姿态。
4. 在“流程预览”查看图层、工程和报告。需要暂停时点“停止”，之后点“继续”。
5. 完成后点“导出成果”，或进入“角色工作台”查看角色。

人物与衣服会并行制作，再进入组装和阴影。全局设置是新任务的默认值；已有任务在“执行参数”中修改。制作数据保存在 `.run/`，导出案例放在 `demos/`。

![选择参考图并创建任务](web/demo-screenshots/11-create-task-guide.gif)

[新建任务录屏](web/demo-screenshots/11-create-task-guide.mp4) · [查看成果录屏](web/demo-screenshots/12-inspect-task-guide.mp4)

### 交给 agent

也可以让 agent 使用 [live2d-maker](.agents/skills/live2d-maker/SKILL.md) 帮你配置、启动和跟进制作：

```text
请使用 $live2d-maker 制作人物与衣服的分层素材。
参考图：/绝对路径/角色.png
任务名：my-character
姿态标准化：开启
```

### 模型设置

默认使用 `gpt-6.1-sol` 和 Codex 内置生图。在“管线配置 → 环境与模型”中可以调整模型、思考力度和服务连接，也可以选用 Claude、Gemini、GPT Image 或 Nano Banana。[查看配置说明](.agents/skills/live2d-maker/references/model-presets.md)。

## 工作台

制作工作台用于启动任务、查看进度和预览每一步的成果。

[![制作流程预览](web/demo-screenshots/10-flow-current.png)](web/demo-screenshots/10-flow-current.png)

角色工作台用于查看图层、调整光照、编辑九轴模型和预览布料摆动。

![角色工作台](web/demo-screenshots/07-studio-overview.png)

[工作台使用说明](web/README.md)

## 最新进展：头部九轴

![头部九轴预览](showcase/tanuki-head-nine-axis.gif)

让角色转头、抬头、低头，连同五官、耳朵和下颌一起运动。

制作时开启“阴影完成后制作头部九轴”，命令行加 `--live`。九轴需要 **FFmpeg 和 Seedance 视频服务**：在全局设置选择 FFmpeg，在管线配置中填写视频服务地址、密钥和模型。支持 Seedance 2.5、2.0 系列，默认 `seedance-2.5`。

[体验九轴工作台](https://gameclaw.woa.com/ai-weapon-spirit/character-layering/studio?project=tanuki-nine-axis-seven-step-20261109&workspace=nine-axis) · [查看制作流程](https://gameclaw.woa.com/ai-weapon-spirit/character-layering/?name=tanuki-nine-axis-seven-step-20261109&page=preview&stage=6) · [九轴配置](.agents/skills/live2d-maker/nine-axis/README.md#依赖与视频配置)

## 布料与光照预览

调整风力，观察裙摆、袖片与飘带的摆动和回弹。

[![裙摆与飘带预览](showcase/jianma-wind-skirt.gif)](showcase/jianma-wind-skirt.mp4)

[观看视频](showcase/jianma-wind-skirt.mp4) · [布料预览说明](tutorial/live2d-guidance/workflows/physics-preview.md)

## 版本与更新

新版见 [Releases](https://github.com/wu-tian807/AstraLayering/releases)，更新内容与迁移方法见 [CHANGELOG](CHANGELOG.md)。升级时保留 `.run/`、`.web/settings.json` 和 `.agents/skills/live2d-maker/.env`。

## 文档入口

[给 agent 的 skill](.agents/skills/live2d-maker/SKILL.md) · [安装与配置](.agents/skills/live2d-maker/references/setup.md) · [工作台](web/README.md) · [案例](demos/readme.md) · [教程](tutorial/live2d-guidance/readme.md)

## 开源协议

[LGPL-3.0-only](LICENSE)，配套条款见 [COPYING](COPYING)。第三方素材和依赖遵循各自的许可。
