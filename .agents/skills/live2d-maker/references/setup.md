# 安装与前置

首次安装、换机器、切换 CLI／provider 或遇到依赖问题时读取本页。模型选择见 [model-presets](model-presets.md)，启动、web 连接与巡检见 [workflow](../workflow/README.md)。

## 依赖一览

完整启动依赖表（每项一行，注明必选／可选与何时需要）在[项目首页 · 准备软件与仓库](../../../../readme.md#1-准备软件与仓库)；独立安装 skill 时见 [GitHub 上的首页](https://github.com/wu-tian807/AstraLayering#1-准备软件与仓库)。概括如下：

- **必选：** Node.js 24.12+、Git、Krita（只跑分块时可不装）。
- **默认必选：** Codex CLI 与登录；使用 Codex 时还需要 C/C++ 工具链，Rust 自动准备。
- **可选：** Claude Code CLI（`claude-*` 模型）、Antigravity CLI（`gemini-4-argon`）、GPT Image 生图服务、Nano Banana 生图服务。
- **Linux 无桌面时必选：** Xvfb。
- **仅九轴必选：** FFmpeg 和独立 Seedance 视频服务；其他 section 不要求。

缺少依赖时，说明实际需要安装、配置的软件，**确认所选方案后再执行**。已有针对该机器和方案的授权直接沿用，方案或范围改变时再确认。

## 安装方式

**先选版本。** 首次拉取或更新仓库前，问一次用户是使用者还是开发者，已说明的不重复问：

- **使用者（稳定版）：** 安装 [Releases](https://github.com/wu-tian807/AstraLayering/releases) 中最新的发布版本，可下载 `AstraLayering-vX.Y.Z.zip`，或检出同名 tag `vX.Y.Z`。更新时比较当前版本（根目录 `package.json` 的 `version`）与最新发布版本，有更新的发布版本才升级，不直接拉取 `main`。
- **开发者（最新版）：** 克隆或拉取 `main`。`main` 可能包含未完整验证的改动，不保证能跑通。

**完整仓库：** 按首页准备依赖后，双击对应系统的 start-workbench 启动文件。脚本通过 npm 准备 pnpm 10.33.0、安装依赖、在缺少时创建默认 `.env` 并打开前端，任务在网页新建与运行。已有配置原样复用。维护者也可在仓库根目录执行 `pnpm install --frozen-lockfile`，同时安装工作台与 skill 依赖。

**独立 skill：** 需要 `wu-tian807/AstraLayering` 中 `.agents/skills/live2d-maker` 整个目录，包含运行代码、提示词、参考图和锁文件。使用 skill 安装器时选择 `--method git` 稀疏检出，控制大仓库下载量。agent 从 SKILL.md 所在目录执行：

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```

各 section 共用一次安装，任务存放在 skill 外的运行根目录。完整仓库默认 `<仓库>/.run/<任务名>/`；独立 skill 默认其上一级的 `.run/`。`demos/` 用于导出与展示成果；网页的旧目录设置会覆盖默认值，可在“全局设置”改回 `.run/`。独立 skill 的网页由完整仓库提供：已有服务直接复用，缺少时按 [workflow](../workflow/README.md#工作台启动与连接)在 skill 外准备工作台 checkout，保持版本、任务目录与原执行环境一致。

## 按执行范围检查

| 范围 | 前置条件 |
| --- | --- |
| 全部管线 | Node.js 24.12+、pnpm 10.33.0；所选 harness 的 CLI、登录／provider 与模型授权 |
| 人物／衣服 part | 所需参考／上游；新参考与补全辅助图需要相应生图能力 |
| 人物／衣服 raster | 完整 part 输入、Krita、可用的显示环境与所选生图能力 |
| 穿戴组装 | 人物素体 KRA、衣服 KRA、简化穿衣参考、Krita 与显示环境 |
| 阴影 | 对应组装与参考、Krita 与显示环境；normal-depth 模式另需生图能力 |
| 头部九轴 | 上游 KRA／PNG、Krita 与显示环境、ffmpeg；独立视频服务的 `video_base_url`、`video_api_key` 与 `nine_axis_view_video_model`，支持 `seedance-2.5`、`seedance-2.0` 系列 |

总入口 `--live` 表示阴影完成后进入九轴 section。只有九轴需要 FFmpeg 和视频服务；网页在“全局设置 → FFmpeg 可执行文件”选择本机已安装或解压的文件，Krita 与 FFmpeg 均可手填路径、浏览或自动扫描后点选结果，扫描可查看进度并停止；CLI 使用 `--ffmpeg <完整路径>`。保存和启动时检查文件及 `-version`；程序不自动下载。视频配置支持 `seedance-2.5`／`seedance-2.0` 系列，见[九轴依赖与视频配置](../nine-axis/README.md#依赖与视频配置)。

独立 section 的启动无状态：每次启动及续跑都传入 `--dir`、`--knowledge` 和该段需要的软件路径；九轴须传 `--krita` 与 `--ffmpeg`。全局设置由网页保存，作为新任务默认值；已有任务可在执行参数中修改 Krita 与 knowledge，由总控保存到任务根 `run.json`，调用方每次传给 section；section 只沿用工程、完成标记和绘制会话。九轴选帧使用 `extract_video_frame` 工具，由工具内部消费本次 FFmpeg 完整路径，agent 不查找可执行文件。本次路径也保留在兼容执行环境：`ASTRA_STUDIO_FFMPEG` 指向该文件，目录加入 PATH；不向制作提示词拼接路径或软件说明。

```sh
pnpm nine-axis --name my-character --dir /绝对路径/.run --knowledge /绝对路径/knowledge --krita /绝对路径/krita --ffmpeg /绝对路径/ffmpeg
```

总入口在启动前检查整条所选路线的软件条件，上游成果在各 section 开始时验证。已有软件和仍有效的验证记录直接复用。每次启动检查所选 CLI 的本地版本；路线含 Krita 时还检查 Krita 路径与显示环境（不启动 Krita）；登录、工具和绘图能力在实际调用时核对。

## 模型 CLI 与生图

- **配置：** `.env` 缺少时以 `example.env` 创建默认方案，已有选择沿用。职责、CLI 路径、provider 与各生图协议的自定义见[模型方案与配置](model-presets.md)。主模型使用[统一连接字段](model-presets.md#主模型连接与模型列表)，shell 统一键或旧别名优先于文件；API 密钥只保存在本地配置。
- **Codex：** 复用 `CODEX_HOME`／`~/.codex` 的登录与授权；`.env` 的 `codex_home` 可为工作流的 Codex 另设 `CODEX_HOME`（相对路径以 skill 根目录为基准）。`codex-native` 使用宿主内置 imagegen，只能用于 LLM 是 Codex 的步骤；其他 harness 的生图步骤需改选 GPT Image 或 Nano 服务，填写对应 API URL、key 与协议。
- **Claude Code／Antigravity：** 复用已有 CLI 入口与登录，同样通过共享生图工具 imagegen 调用所选生图服务。CLI 由用户已有安装提供，或按用户确认的方案安装；pnpm 只负责项目依赖。
- **核对：** 在实际后台启动环境执行 `pnpm env:check`，核对实际 skill、配置文件、模型、生图、CLI、图片预算与 shell 覆盖。此命令只预览配置，不验证登录；真实工具调用与恢复验证见 [shared](../shared/README.md#启动验证)。首次正式准备产生合格图片后，可记录为该生图组合的实际证据。

### CLI 准备与补丁构建

**Codex：** 所有 Codex 步骤都使用补丁版，程序自动构建并缓存；只用 Claude／AGV 时不构建。`codex_path` 留空即可启用，指定已有入口时检查补丁能力后复用。Git 和平台 C/C++ 编译工具需要本机提供；Rust 1.95.0 自动复用或临时安装，详见下节。补丁功能与能力要求见 [patches · 原生 Codex 补丁](../patches/README.md#原生-codex-补丁)。

**Claude Code：** 复用已安装的 CLI 与登录，无需修改或重新编译 CLI，也不需要 Rust 或 C/C++ 工具链。图片数／请求体保护、可选去重及支持的服务路由见 [patches · 图片容量保护](../patches/README.md#图片容量保护)；遇到结构化拒绝时的恢复机制与边界见 [Claude Code 拒绝后的会话恢复](../patches/README.md#claude-code-拒绝后的会话恢复)。

**AGV：** 复用已安装的 CLI 与登录。启用 `agv_unlimited_response_header_timeout=true` 时，程序准备独立的受控副本，不需要 Rust；适用构建、60 秒响应头期限及验证见 [patches](../patches/README.md#agv-自定义网关的响应头期限)。

图片数和请求体预算按服务限制配置，通过 `env:check` 核对；切换模型或升级时沿用已有预算。

### Codex 补丁构建与恢复

需要 Git、平台 C/C++ 编译工具及该版 Codex 的平台依赖。首次需要构建时，程序先检查工具链：Windows 检查 Visual Studio 的 MSVC 组件或 `cl`，macOS／Linux 检查 `CC`／`CXX` 指定的命令或 `cc`／`c++`；构建日志中的缺少链接器等错误也会给出安装指引。缺少依赖时，网页与 `workflow.log` 直接显示需要安装的软件和处理方法；安装完成后点网页「继续」（命令行 `--continue`），程序重新检查后接着构建，已有会话和制作产物保留。

Rust 1.95.0 可用时复用；不可用时提示并从官方 Rust 站点下载、校验安装器，在临时目录使用独立 `RUSTUP_HOME` / `CARGO_HOME` 和 `--no-modify-path` 安装。构建成功或失败均清理，不改系统命令、用户 Rust、shell 设置或 Codex 全局配置；安装和构建日志保存在缓存内。

也可在 `live2d-maker` 目录下提前准备，命令输出实际二进制路径：

```sh
pnpm build:codex
# 已有对应官方源码时可创建独立 worktree：
pnpm build:codex --source /absolute/codex-source --jobs 4
```

使用 `--source` 时应保留该源码仓库，worktree 共享它的 Git 对象。手工测试可把输出路径传给 [patches 中的验证脚本](../patches/README.md#本地模拟验证)，无需修改 `.env`。

- **查看进度：** 源码下载、检出和 Rust 准备有新输出时，按约 20 秒的间隔汇报最近一行；编译阶段按约 30 秒的间隔汇报，并显示已编译的 crate 数与耗时。完整输出持续写入缓存目录的 `build.log`，工作流日志显示阶段进度和日志路径。
- **长时间无输出：** 连续 3 分钟无新输出会提示检查网络，也可能是在链接大文件；提示本身不会终止命令。可继续等待，或停止任务、配置 `HTTPS_PROXY` 等代理后继续，也可指定已构建且通过能力检查的 `codex_path`。另有 Git HTTP 低速保护：传输持续 10 分钟低于 1000 字节／秒时，Git 会结束该下载；这与 3 分钟无输出提示分别处理。
- **Windows 检出与缓存：** 构建用 Git 子进程固定 LF 换行、启用长路径并设置下载低速保护，保留用户的代理、证书和凭据设置，不修改用户 Git 配置。已有缓存中尚未应用补丁的源码无法通过补丁检查时，重新获取一次；新检出的源码仍不兼容时明确失败。已应用补丁的源码和通过哈希校验的可执行缓存继续复用，无需手动清空整个缓存。

## Krita 与显示环境

**Krita 本体需提前安装，可由 agent 按已确认的方案协助安装。** 工作流自动准备其私有配置和桥接插件；其他基础依赖仍须按上方[依赖一览](#依赖一览)准备。先检查已有安装、用户路径和任务记录；`--krita` 传实际可执行文件，后台与恢复进程复用同一路径。Linux 解包的 AppImage 可传 `AppRun` 或 `usr/bin/krita`，自动使用其内置 Python 与 `libstdcpp-fallback`，必要时用 `ASTRA_STUDIO_KRITA_PYTHONHOME`／`ASTRA_STUDIO_KRITA_PYTHONPATH` 覆盖。

- **私有进程：** 每个 section 一个私有 Krita，使用临时资源目录和随附的桥接插件；Linux／macOS 使用独立配置，Windows 共享偏好的边界见下条。agent 通过 `krita` 工具按需启动、查看状态与 pid、执行 Python 脚本，崩溃或卡死时自行重启；section 结束（完成、失败或停止）时由工作流关闭并清理。框架不替 agent 启动 Krita。
- **Windows 用户偏好：** Windows 的 Qt 使用系统已知文件夹定位配置，不受 APPDATA／LOCALAPPDATA／XDG 环境变量重定向影响。工作流共享用户的 kritarc、kritadisplayrc、窗口布局与最近文件；只确保 `[python] enable_astra_bridge=true`，保留其他配置，不恢复旧文件覆盖新偏好，也不修改全局 ResourceDirectory。每个 section 建立临时启动目录，通过目录联接复用已安装的 Krita 二进制、库和内置资源，让嵌入式 Python 能找到本 section 的私有桥接。插件、资源数据库和通信文件留在私有目录，不安装到用户 pykrita 目录；section 结束后清理启动目录，不删除原安装。
- **对话框：** 桥接插件自动取消会卡住无人值守界面的对话框（例如导出参数框），并在工具结果中给出提示。
- **并发上限：** 本机同时运行的 Krita 数量由 `.env` 的 `krita_max_instances` 限制（默认 4，跨任务计算；名额锁位于系统临时目录的 `astra-krita.slots`，可用 `ASTRA_STUDIO_KRITA_SLOTS` 改位置）。需要 Krita 的 section 在开始步骤前占一个名额，持有到 section 结束；名额用满时排队等待。声明 `krita: false` 的步骤不占名额，其 agent 也没有 krita 工具。网页在 section 占用或排队等待 Krita 时显示标识。
- **显示：** Linux 已设置 `DISPLAY`、`WAYLAND_DISPLAY` 或 `QT_QPA_PLATFORM` 时直接沿用，不启动 Xvfb；都没有时工作流启动一个共享的 Xvfb（以 `-noreset` 运行），多个 section 的 Krita 共用它。Xvfb 需要本机安装（`apt install xvfb` 等），不在 PATH 时用 `ASTRA_STUDIO_XVFB` 指定路径。macOS 与 Windows 使用当前桌面。

缺少 Xvfb 时，任务会记录为失败，并在网页与 `workflow.log` 中显示具体依赖、安装方法和显示环境配置提示。补齐后点「继续」（命令行 `--continue`），会重新检查并沿用已有会话和产物接着运行。

Krita 用法只写在 [krita 工具说明](../knowledge/shared/tools/krita/description.md)，随需要 Krita 的步骤提供。

## 按需功能

- **Nano 透明图：** 使用共享 Node／Sharp 双背景差分，第一张纯色背景 RGB 加第二张仅换背景的图恢复 alpha；原图、alpha 和处理报告保存在请求的 generated/image-processing/。两次串行生图会增加一次调用；第一张已有真实 alpha 时直接保留。失败时保留原图供诊断，透明边缘与半透明材质仍按制作流程复核。完整协议见[生图执行与透明处理](model-presets.md#生图执行与透明处理)。
- **网页原生图层编辑：** 由工作台自己的 Krita 原生合成服务负责（独立 Krita 进程，Linux 需要 Xvfb），不使用制作任务的 Krita；配置见工作台 checkout 的 web/README.md。阴影蒙版检查是 agent 在本 section Krita 中调用的 `inspect_shadow_mask` 工具，无需另配 CLI 或回执，见 [shadow](../shadow/README.md)。普通流程浏览与独立布料示例可直接在现代浏览器查看。
- **浏览器自动验证：** 按需要安装 Playwright／Chromium。资料重建、历史案例与归档脚本的 Python 包按实际执行范围准备；日常运行 Node 管线只需上述基础依赖。

操作记录区分本地版本、配置预览、真实工具调用、会话恢复和绘画验收，并保留各自适用范围。完成检查后按 [SKILL.md](../SKILL.md) 启动、安排巡检并展示工作台。
