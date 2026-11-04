---
name: live2d-maker
description: 从角色参考图制作人物与衣服分层 KRA、透明 PNG、穿戴组装及阴影素材。用于启动或恢复制作、打开工作台、安排巡检和调试单个 section；交付范围为后续绑定使用的静态素材。
---

# Live2D Maker

从实际安装的 skill 根目录执行命令。整条路线为：人物 part 准备完成后，人物 raster 与衣服 part → 衣服 raster 两条线并行，均完成后进入穿戴组装 → 阴影；两条线共用 `--jobs` 个 agent 名额。

## 执行流程

1. **询问并确认参数。** 确定新建或续跑、参考图、任务名、运行根目录、制作范围、姿态标准化与阴影方式；只询问缺失或确需选择的项，已确认或已有记录的不重复问。说明实际保存路径。新安装缺少 `.env` 时读取[模型方案](references/model-presets.md)，默认使用方案 1；用户指定其他方案则沿用，已有 `.env` 不覆盖。
2. **检查并启动。** 首次安装、更新、换机器或依赖异常时读取[安装与前置](references/setup.md)；安装或更新前先按其中[版本选择](references/setup.md#安装方式)确认用户用稳定版还是开发版。确认所选 CLI、登录、生图、Krita 及桌面／headless 操作能力。执行 `pnpm env:check` 核对配置（此命令不验证登录）。按下面示例后台启动，查询真实状态；已有活跃任务接管监听，避免重复启动。
3. **安排定时检查。** 使用宿主的定时能力每 2 小时检查进展并主动恢复可恢复故障，直到所选路线完成或用户取消。记录定时 ID、实际 skill／任务路径、启动参数和操作环境到任务 `monitor.md`。没有定时能力时明确说明，不安装替代定时器。正常阶段由总调度自行推进。
4. **打开 web。** 复用或启动真实工作台，核对其运行根目录与本次 `--dir` 一致，打开 `?name=<任务名>` 并提供可访问链接。独立安装缺少前端、远程连接或巡检／恢复细节，只读 [workflow/README.md](workflow/README.md) 的相应部分。
5. **交付。** 查看合成图，核对实际 KRA、PNG 和报告，给出文件与网页入口及遗留问题；完成或取消后关闭本任务定时检查。

全流程完成并停止后，可在工作台点击“导出成果”或执行 `pnpm export --name <任务名> [--dir <运行根目录>] [--output <目录或.zip>]`；归档只供查看，续跑使用原运行目录。条件与内容见 [workflow/README.md](workflow/README.md#导出成果)。

任务根目录 `<dir>/<name>/` 是相对路径的唯一基准；向 agent 给出和由 agent 填写的任务文件路径一律用绝对路径（Codex 内置生图只接受绝对路径）。各步骤的 `workspace/` 是 CLI 当前目录和草稿区，正式产物与报告留在步骤目录；工作区与产物约定见 [shared](shared/README.md#工作区与产物)，会话规则见[会话与记录](references/model-presets.md#会话与记录)。不在运行期间搬迁文件。

## 启动参数

| 参数 | 含义 |
| --- | --- |
| `--name <任务名>` | 任务目录名；续跑沿用 |
| `--image <参考图>` | 首次原图，推荐绝对路径 |
| `--dir <运行根目录>` | 必须是绝对路径；数据在 `<dir>/<name>/`，`.runtime` 为保留名不能作任务名；默认完整仓库 `.run/`，独立安装为 skill 上一级的 `.run/`，不放 skill 内 |
| `--krita <可执行文件>` | 绘制、组装与阴影需要；总入口续跑复用任务根 `run.json` 记录的值，单独运行 section 时每次都要传。路线含 Krita 时每次启动（含继续／恢复／重试）先检查：只核对可执行文件与显示环境（`DISPLAY`／`WAYLAND_DISPLAY`／`QT_QPA_PLATFORM` 或可用的 Xvfb），不启动 Krita；不通过即拒绝且不改动任何步骤，用 `--krita` 重新指定 |
| `--from / --to <section>` | 连续范围；默认完整六段，section ID 见下表 |
| `--standard / --no-standard` | 是否标准化人物姿态；首次默认关闭，续跑沿用；本次路线须包含 part-layering；已有参考改选项需按 [workflow 规则](workflow/README.md#姿态与参考)重试 |
| `--shadow-mode mask\|normal-depth` | 原生投影蒙版／法线深度；首次默认 `mask`，分支独立恢复 |
| `--jobs <正整数>` | 整次运行所有管线（含 part、raster、组装、阴影）共用的 agent 名额，默认 3；两条并行线不增加总并发 |
| `--background` | 后台制作；省略则前台 |
| `--status --json` | 只查询，不启动模型 |
| `--continue` / `--resume` / `--retry` | 三者互斥，对应网页的继续／恢复／重试。不加 `--section` 时作用于全部 `.running`（中断或失败）步骤；`--section <管线> --step <步骤>` 只处理一个步骤，`--step` 相对该管线目录（如 `step02`、`step02_options`、`step11_completion/head`、`step08_initial`、`step13_merge`、`step14_occlusion`、`step10_reduce/depth01`）且必须同时给 `--section`；只给 `--section` 仅可用于 `--continue` |
| `--stop` | 对应网页的停止，保留产物与续跑记录 |

```sh
pnpm start --name my-character --image /绝对路径/角色.png --krita /绝对路径/krita --background
pnpm start --name my-character --status --json
# 续跑：自定义运行根目录时，每次都加同一 --dir
pnpm start --name my-character --background
# 恢复（新会话、保留产物）/ 重试（删除该步骤产物与会话后只重做该步骤，可指定已完成步骤；已完成的后续步骤沿用）/ 停止
pnpm start --name my-character --resume --background
pnpm start --name my-character --retry --section raster-layering --step step02 --background
pnpm start --name my-character --stop
```

相对输入路径均从 `<dir>/<name>/` 解析。已有记录保存范围与选项；续跑优先只给任务名和原运行根目录。普通中断保留完成标记与工程，按原参数续跑。

## 单独运行一个 section

单跑指使用真实输入制作某一段管线，会调用所选模型并保存该段成果。选择对应 README 检查上游，先用 `pnpm start --name <任务名> [--dir …] --stop` 停止同任务的总调度，再启动该 section。

| section ID／pnpm 入口 | 何时读取 |
| --- | --- |
| [part-layering](part-layering/README.md) | 人物参考准备、拆分；指定组／限深调试 |
| [raster-layering](raster-layering/README.md) | 人物逐层绘制、边缘精修、换装素体 |
| [clothing-part-layering](clothing-part-layering/README.md) | 衣服提取与拆分 |
| [clothing-raster-layering](clothing-raster-layering/README.md) | 衣服分层绘制与精修 |
| [character-assembly](character-assembly/README.md) | 已有两份 KRA，仅做穿戴组装 |
| [shadow](shadow/README.md) | 阴影蒙版或法线／深度 |

素体未换装时总调度跳过两条衣服管线，换装素体与组装直接复制人物成果，见 [总控](workflow/README.md#姿态与参考)。

```sh
# 独立运行穿戴组装：读取已有的人物、衣服 KRA 与简化穿衣参考
pnpm character-assembly --name my-character --dir /绝对路径/运行根目录 --krita /绝对路径/krita --knowledge /绝对路径/knowledge
# 同名续跑沿用绘制会话；独立 section 不保存配置，仍须带 --krita 与 --knowledge
pnpm character-assembly --name my-character --dir /绝对路径/运行根目录 --krita /绝对路径/krita --knowledge /绝对路径/knowledge
# 通过总入口只运行一段，使用后台、状态查询和范围记录
pnpm start --name my-character --dir /绝对路径/运行根目录 --from character-assembly --to character-assembly --krita /绝对路径/krita --background
```

两套 part 的独立入口支持 `--groups <JSON>`、`--max-depth <层数>`；两套 raster、组装、阴影的独立入口支持 `--dry-run` 检查输入和提示词而不调用模型。具体前置与重试见相应 README；代码维护的自动化测试见 [shared](shared/README.md#自动化测试维护用)。

## 头部九轴

已有组装／阴影 KRA 与角色图时，独立使用 `pnpm nine-axis --name <任务名> --dir <绝对运行根目录> --knowledge <先验知识目录> --krita <可执行文件>`，单步可加 `--step <步骤>`；输入与恢复方式见 [nine-axis/README.md](nine-axis/README.md)。四步为 `step01_video`（left/up/down 视频＋取帧）→ `step02_angles`（left/up/down 子组独立三路并行，共享原 KRA neutral 与同一 agent.json）→ `step03_angle-xy`（依赖单轴，agent 自选两角参考帧并制作）→ `step04_jaw-line`。角度配置仍只使用 [step01 的 angles.json](knowledge/nine-axis/step01_video/references/angles.json)。

## 其他按需参考

- **选择／切换模型方案、配置 LLM 或生图**：读 [model-presets.md](references/model-presets.md)；自定义 CLI、provider、生图协议或会话恢复时，按需阅读同页对应章节。保留未要求修改的配置、凭据和图片预算。
- **启动、web 连接、巡检、恢复或交付定位**：读 [workflow/README.md](workflow/README.md)。
- **修改模板／工具定义、接入新 CLI 后验证**：读 [shared/README.md](shared/README.md)。共享工具在 `shared/tools/<名称>/`，管线专属工具在 `<管线>/tools/<名称>/`（如 `part-layering/tools/reuse_reference`、`shadow/tools/inspect_shadow_mask`）。绘制提示词、工具 schema 和运行参考是程序输入，保留各自职责与审核轮数。
- **补丁构建、图片／请求体超限或网关错误**：读 [patches/README.md](patches/README.md)。安装补丁不等于启用容量保护。
