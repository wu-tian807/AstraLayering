# 安装与前置

## 依赖一览

| 软件 | 何时需要 |
| --- | --- |
| Node.js 24.12+、Git | 工作台和制作管线 |
| Krita | 人物／衣服绘制、组装、阴影和九轴 |
| Codex CLI，已登录 | 默认模型方案 |
| C/C++ 编译工具 | 构建 Codex 补丁：macOS 用 Xcode Command Line Tools，Windows 用 Visual Studio Build Tools 的 C++ 桌面开发组件，Ubuntu／Debian 用 build-essential |
| Xvfb | Linux 无桌面环境 |
| FFmpeg、Seedance 视频服务 | 九轴 |

Claude、Gemini、GPT Image 和 Nano Banana 的配置见[模型方案](model-presets.md)。按用户选择准备所需软件，复用已有安装和配置。

## 安装方式

使用者安装 [Releases](https://github.com/wu-tian807/AstraLayering/releases) 的最新版本；开发者使用 main。用户尚未说明时问一次，后续沿用。

完整发布包解压后，双击系统对应的 `start-workbench` 文件。启动器会准备 pnpm 10.33.0、项目依赖和默认 `.env`，打开工作台；已有 `.env` 保留。

只安装 skill 时，复制完整的 `.agents/skills/live2d-maker/` 目录。首次配置把 `example.env` 复制为 `.env`，已有配置继续使用，然后执行：

```sh
npm exec --yes --package=pnpm@10.33.0 -- pnpm install --frozen-lockfile
pnpm env:check
```

工作台启动与连接见[总流程](../workflow/README.md#工作台启动与连接)。

## 按执行范围检查

新建任务准备参考图、任务名和运行根目录。绘制、组装、阴影配置 Krita；九轴再配置 FFmpeg 和视频服务。[九轴配置](../nine-axis/README.md#依赖与视频配置)。

网页全局设置是新任务默认值，已有任务在“执行参数”中修改 Krita、knowledge 和制作选项。总调度保存本任务参数并在启动 section 时传入。

**独立 section 启动无状态。** 每次执行都传 `--dir`、`--knowledge` 和所需软件路径：

```sh
pnpm character-assembly --name my-character --dir /绝对路径/运行根目录 --knowledge /绝对路径/knowledge --krita /绝对路径/krita
```

默认制作目录是 `.run/`，导出案例放在 `demos/`。相对路径以任务目录为基准，绝对路径直接使用。自定义 knowledge 使用完整目录；启动时检查必要文件，缺失或空文件会直接报错。

## 模型 CLI 与生图

默认方案使用 `gpt-6.1-sol` 和 Codex 内置生图。先完成 CLI 登录，再运行 `pnpm env:check` 核对模型、CLI 路径和生图配置。

### CLI 准备与补丁构建

第一次使用 Codex 制作时，程序准备补丁版并保存到运行缓存；之后复用。Rust 1.95.0 自动准备，C/C++ 工具链按上表安装。Claude 和 Antigravity 使用各自已登录的 CLI。

### Codex 补丁构建与恢复

也可以提前构建：

```sh
pnpm build:codex
pnpm build:codex --source /绝对路径/codex-source --jobs 4
```

构建进度和日志路径显示在 `workflow.log`。下载或编译失败时，按错误补齐软件、网络或代理配置，再点“继续”。构建细节见[补丁说明](../patches/README.md)。

## Krita 与显示环境

在全局设置中浏览或扫描 Krita，也可以用 `--krita` 指定可执行文件。

| 系统 | 常见入口 |
| --- | --- |
| macOS | `/Applications/krita.app/Contents/MacOS/krita` |
| Windows | `C:\Program Files\Krita (x64)\bin\krita.exe` |
| Linux | 已安装的 `krita`、AppImage 或解包后的 `AppRun` |

每个 section 使用一个私有 Krita 实例；本机并发上限由 `krita_max_instances` 设置，默认 4，满额时排队。agent 通过 `krita` 工具操作，section 结束后清理实例。

Linux 使用当前显示环境；无桌面时安装 Xvfb，程序启动共享虚拟显示。macOS 和 Windows 使用当前桌面。缺少显示依赖时按错误提示补齐，再继续任务。

## 按需功能

[模型与生图配置](model-presets.md) · [网页原生图层配置](../../../../web/README.md#原生合成服务配置linux) · [工作台、巡检与恢复](../workflow/README.md)
