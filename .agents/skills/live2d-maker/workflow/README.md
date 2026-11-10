# 总流程、工作台与恢复

人物分块准备完成后，人物绘制与衣服分块／绘制并行，随后组装角色、制作阴影。加 `--live` 继续头部九轴。所有管线共用 `--jobs` 个 agent 名额，默认 3。

## 总入口

在 skill 目录执行：

```sh
pnpm start --name my-character --image /绝对路径/角色.png --krita /绝对路径/krita --background
pnpm start --name my-character --status --json
pnpm start --name my-character --continue --background
pnpm start --name my-character --stop
```

`--from`、`--to` 指定制作范围，`--dir` 指定运行根目录。总调度在任务 `run.json` 中保存参数，续跑沿用；网页全局设置用于新任务默认值，已有任务在“执行参数”中修改。

独立 section 启动无状态，每次传入 `--dir`、`--knowledge` 和所需软件路径。九轴需要 Krita、FFmpeg 和 Seedance 视频配置，选帧 agent 调用 `extract_video_frame` 工具。[参数与独立入口](../SKILL.md#单独运行一个-section)。

### 姿态与参考

`--standard` 开启姿态标准化，`--no-standard` 保留原图姿态，默认关闭。已有参考沿用保存的选择；要调整已采用的标准化选项，使用新任务名。画法足够简单时直接沿用原图；没有独立衣服时，自动跳过两条衣服管线。

## 生效配置核对

```sh
pnpm env:check
```

查看实际模型、CLI 路径和生图配置，CLI 登录另外确认。网页“管线配置 → 环境与模型”修改 `.env`，保存后用于下一次启动或续跑。[模型配置](../references/model-presets.md)。

## 输入、产物与续跑

```text
.run/<任务名>/
├── input/                    原图
├── run.json                  总调度参数与状态
├── workflow.log              运行日志
├── part-layering/            人物分块
├── raster-layering/          人物绘制
├── clothing-part-layering/   衣服分块
├── clothing-raster-layering/ 衣服绘制
├── character-assembly/       穿戴组装
├── shadow/                   阴影
└── nine-axis/                头部九轴
```

相对路径以任务目录为基准，绝对路径直接使用。每个步骤的 `workspace/` 放草稿，步骤目录放正式产物与报告，`agents/steps/<步骤>/session.json` 保存绘制会话。

自定义运行根目录时，所有操作传同一个 `--dir`。更新程序时保留任务目录、`.web/settings.json` 和 `.env`。旧布局任务在网页点“转换目录”，程序先完整备份再转换。

## 工作台启动与连接

完整仓库双击系统对应的 `start-workbench` 文件，或在仓库根目录执行：

```sh
npm exec --yes --package=pnpm@10.33.0 -- pnpm install --frozen-lockfile
pnpm web --port 4387
```

复用已有工作台，确认全局设置的运行目录与任务 `--dir` 一致。打开 `http://127.0.0.1:4387/?name=<任务名>` 查看任务；远程使用已有访问入口。独立 skill 安装需要另备对应版本的工作台，安装见[setup](../references/setup.md)。

网页关闭后，后台制作继续运行。常驻服务与代理配置见[工作台部署](../../../../web/README.md#部署)。

## 定时巡检

使用宿主的定时能力每 2 小时查看状态、日志和产物，处理可恢复故障，直到完成或用户取消。在任务 `monitor.md` 记录定时 ID、任务路径、参数与运行环境。宿主没有定时能力时告知用户。

正常推进交给总调度；发现失败时，查看对应步骤的错误和最新消息，按下文继续、恢复或重试。完成后交付成果并关闭定时检查。

## 故障恢复

### 恢复方式

| 操作 | 效果 |
| --- | --- |
| 继续／`--continue` | 保留产物与会话，从中断处接着做 |
| 恢复／`--resume` | 保留产物，换新会话继续 |
| 重试／`--retry` | 删除所选步骤的产物与会话，重新制作 |
| 停止／`--stop` | 停止制作，保留进度 |

```sh
pnpm start --name my-character --resume --background
pnpm start --name my-character --retry --section raster-layering --step step02 --background
```

`--section` 和 `--step` 选择单个步骤；省略时处理任务中需要恢复的步骤。操作前检查本任务的 knowledge、软件和视频配置，配置错误先修正再继续。

## 交付与自动化测试

查看合成图，核对实际 KRA、PNG 和报告，再给出文件与网页入口。维护代码时运行受影响的定向测试，测试方式见[共享模块](../shared/README.md#自动化测试维护用)。

## 导出成果

全流程完成后，在网页点“导出成果”，或执行：

```sh
pnpm export --name my-character --output /绝对路径/my-character.zip
pnpm export --name my-character --output /绝对路径/demos/my-character
```

导出包含工程、正式产物、报告及报告引用的图片，可在工作台浏览。运行任务留在 `.run/`，案例放到 `demos/`；继续制作使用原任务。
