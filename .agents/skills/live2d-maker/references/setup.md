# 安装与前置

安装 GitHub 仓库 `wu-tian807/AstraLayering` 中的 `.agents/skills/live2d-maker` **整个目录**；依赖、脚本、提示词和参考图片均已包含，不要只下载本文件。可让 Codex 的 skill 安装器按该仓库路径安装，或自行复制目录到用户的 skills 位置，无需下载 demos 和 archive。使用 skill 安装器时选择 `--method git` 稀疏检出，避免默认 ZIP 下载拉取整个大体积仓库。

定位 [SKILL.md](../SKILL.md) 所在的 skill 根目录，以下命令均从这个目录执行：

```bash
cd /安装位置/live2d-maker
pnpm install --frozen-lockfile
```

安装前先运行 `node --version` 和 `pnpm --version`，确认 Node.js 24.12+、pnpm 10.33.0；后台服务也要使用已验证的 Node 入口。五条管线共用一次安装。完整仓库可在仓库根目录执行一次 `pnpm install --frozen-lockfile`，同时安装工作台与 skill 的依赖，无需在每个管线目录安装。不要把运行任务建在 skill 内。

任务启动后还需展示真实工作台。独立安装的 skill 不包含仓库根目录的 `web/`，按[工作台启动与连接](workbench.md)复用已有服务或补齐网页仓库；执行管线的 skill 路径、任务根目录和 Codex 会话环境沿用本次任务配置。

每次启动总入口或独立管线前，按本次执行范围检查依赖；启动总入口时提前检查整条所选路线的软件和工具依赖，不要等人物 part 跑完才发现后续缺少 Krita。已满足的依赖直接复用。上游产物在对应管线开始前校验，本次路线中将要生成的 KRA、part 等不要求在首次启动时已存在。

首次使用某个 CLI／provider／模型方案，或修改了工具 schema、协议适配、CLI 版本时，按[启动验证条件](validation.md)完成对应检查。只返回一次 `OK` 的连通请求不能证明真实工具可用；必须携带实际工具定义，并验证工具调用与会话恢复。复用仍适用的验证记录，未测项明确写出。

AGV 自定义网关出现重复超时时，分别核对主模型和内部监视调用，查看实际力度、图片数和响应头耗时。不要把供应商拒绝 `MINIMAL` 或 CLI 的 60 秒响应头期限当成模型永久不可用；[AGV 兼容说明](../patches/agv/README.md)提供显式、默认关闭的处理方式。不能提前伪造 HTTP 200 掩盖上游错误。

| 本次执行范围 | 前置依赖 |
| --- | --- |
| 所有管线 | 上述 Node.js / pnpm 依赖与所选模型对应的可用 CLI、登录／provider 环境 |
| 人物／衣服 part | 所需上游输入；新参考准备需要所选生图能力。已有参考续跑不重处理；只做分组、SVG 绘制与 review 不需要额外图像程序 |
| 人物／衣服 raster | 对应 part 产物、Krita 和可操作的显示环境；涉及生图的步骤还需所选生图能力 |
| 穿戴组装 | 两份 KRA、简化穿衣参考、Krita 和可操作的显示环境；不以生图为前置 |

Nano 生图与透明后处理只需要所选接口和已有 Node／Sharp，不再额外要求 Krita、Python 或模型权重。Krita 仍是 raster、组装与阴影绘制等操作 KRA 的步骤的前置依赖；通过 `--krita` 指定已有可执行入口。GPT 返回的原生透明 PNG 直接保留。

具体配置：

- 按 LLM 职责配置检查对应 CLI 与登录／provider，人物和衣服共用模型选择：Codex 默认继承当前 `CODEX_HOME` 或 `~/.codex`；Claude Code、Antigravity 使用显式配置的入口或全局 CLI，并复用已有登录。pnpm 不安装后两者。缺少 CLI 或登录凭据时，展示具体报错并询问用户是安装／登录还是改用已有模型，不自行安装。
- 生图步骤选择 `codex-native` 时，绘制模型必须属于 Codex，并具备外部提供的原生 `image_generation`。选择自定义 OpenAI 或 Google 生图时，检查对应 API URL、key 和协议；Codex 需要通过补丁能力检查并使用原生 imagegen，Claude／AGV 注册本步骤的共享 `image_generation` 工具。纯 KRA 组装不以生图为前置。
- Python 优先复用宿主已有解释器；没有独立解释器时，验证 Krita 内置 Python 插件／脚本环境，保证至少一种实际可用。CLI 本身不保证提供 Python；Krita 内置 Python 也不保证有独立 `python3` 或 `pip` 命令。固定调度、SVG、PNG 读写和缩放已由 Node／Sharp 承担，不统一安装 Pillow、NumPy、PyQt5 等包。辅助脚本确实需要某个包时，只检查该脚本使用的解释器与模块。
- skill 根目录 `.env` 不存在时，先按[推荐模型方案](model-presets.md)让用户确认，再以 [example.env](../example.env) 为基础填写；已有 `.env` 直接复用，不因启动或升级覆盖。按最终配置检查依赖。shell 同名变量优先，密钥不写入报告或提交。

**在实际任务环境里验证。** 后台 CLI 和网页发起的任务应复用同一环境，不能只检查交互终端。Claude Code／Antigravity 的每次请求有受控的配置与临时目录，使用隔离 HOME；宿主 `pip --user` 装的包可能不可见。已有虚拟环境或解释器可直接复用，不把凭据隔离改成共享用户 HOME。Krita 的 Python 插件在 Krita 进程内检查，不能用系统 Python 的 `import krita` 作为验收；Krita 自带的 PyQt5 也无需再为系统 Python 安装一份。

在这个环境从实际 skill 根目录执行 `pnpm env:check`，检查[生效配置](workflow-details.md#生效配置核对)。此命令只展示配置，不验证安装、登录或工具能力。总入口及独立管线启动前会对所选 Codex／Claude／AGV 实际执行本地 `--version`，在子进程中复用当前 Node 路径；版本检查不发送模型请求，也不证明已登录。再按[启动验证条件](validation.md)验证本次路线的真实工具与登录能力。已确认使用图片数保护时，核对报告中的启用状态和阈值，不能只以补丁二进制存在作为通过条件；切换模型方案或升级时不清空已有阈值、凭据与路径。

**Nano 双背景透明后处理。** 共享适配器按参考主体颜色推荐纯绿、纯蓝或纯红背景，生成第一张 RGB 图；保留这张图，再以它作为唯一参考，仅将背景换成白色或黑色。Node／Sharp 采样两张图边缘的实际背景色，通过双背景差分恢复前景 RGB 和 alpha；调用者仍得到一张透明 PNG。两次请求串行执行，因此比单次生图多一次请求耗时与费用。若第一张已经有真实 alpha，直接保留，不调用第二次。

这条路径不需要 ViTMatte、PyTorch、Transformers、PyMatting、FFmpeg 或额外 Python 环境，skill 不再附带抠图权重或执行自动安装。现有运行根目录中的旧 `.runtime/matting/` 缓存不再使用，不会自动删除。其他用途的 Python、Krita 和运行缓存保持各自原有规则。

原始 RGB 图、第二张换背景图、alpha 和处理报告保存在任务请求的 `generated/image-processing/<id>/`，两次生图使用同一 provider 与协议。第二次请求失败、取消、画布比例明显变化或缺少可靠纯色背景时，明确报错并指出已保留的原图路径，不用单图猜测透明度。图像模型仍可能改变细节，半透明材料和边缘需要按原流程看图验收；第二张的分辨率变化或少量画布取整由 Sharp 等比适配到第一张画布，仅用于差分，并另存适配后的观测图及尺寸记录。最终输出使用第一张尺寸，后续等比缩放与对齐仍由工作流负责。

需要 Krita 时，先检查已记录的路径、用户给出的路径或当前系统的已有安装。若已安装且操作环境可用，直接复用；不要重复安装。缺少 Krita 或必要操作组件时，由你准备安装方案并执行，不能只报缺失后让用户自行处理。

**安装前必须先向用户说明当前系统上实际要安装和配置的内容，并确认以下方案；等用户确认后再安装。** 这是用户明确要求的安装确认。已有针对该机器和方案的确认可沿用，方案或安装范围发生变化时再确认。

- **桌面版 Krita + computer use：有桌面的用户优先推荐。** 使用适配当前系统的 Krita 官方原生安装包，便于在真实应用窗口中操作。检查并配置宿主实际可用的截图、鼠标和键盘操作能力，说明所需组件及系统权限；不能把安装 Krita 等同于已具备 computer use，也不默认以容器或虚拟显示代替用户桌面。
- **Headless Krita：用于无桌面的运行环境，或用户明确选择时。** 安装 Krita 并配置当前系统支持的无桌面显示环境供脚本操作，例如 Linux 上的虚拟显示。它仍使用 Krita；逐层看图、修画、保存重开和验收要求保持不变。根据实际系统确定可行配置，不假定所有平台支持相同方案。

安装或复用后，确认 Krita 能启动，并用所选方式验证能操作文档、读取图像和保存文件。桌面方案验证实际 computer use 操作，headless 方案验证脚本及图像查看路径；只有 `--version` 成功还不足以证明绘图环境可用。把得到的 Krita 绝对路径通过 `--krita` 传入管线，显示环境配置应传给后台进程和后续恢复进程，并记录在任务的 `monitor.md` 供巡检复用。

安装由调用 skill 的 agent 在确认后处理；工作流脚本仍只检查明确传入或已保存的可执行路径，不自动下载或探索安装位置。路径检查可用 `pnpm raster-layering --check-krita --krita /绝对路径/krita`。

Krita 的路径检查和实际启动使用工作流加载的同一环境，包括 `.env` 中已有的显示、动态库与 Python 配置。Linux 真实启动检查会拒绝没有 DISPLAY、WAYLAND_DISPLAY 或显式 Qt 平台配置的环境，并说明桌面／headless 配置路径。Xvfb 是 Linux 无桌面方案的外部程序，不由 pnpm 安装，也不是桌面用户的统一必装项；仓库负责正确传递环境和清晰报告缺失。agent 仍须确认可操作文档、查看图像并保存；程序版本检查不替代这些操作验证。

## 可选功能与历史脚本

- 工作台浏览进度、图片和分组树不要求额外 Python 包。启用网页原生图层合成器时，当前实现需要带 Python 插件的 Krita 和 Xvfb（即使宿主有桌面，也会启动独立显示）；部署说明见[工作台启动与连接](workbench.md)，详细环境项见工作台 checkout 的 `web/README.md`。
- Linux headless 绘图需要所选显示方案，例如 Xvfb；桌面 computer use 使用宿主已有能力，不统一要求 xdotool 或 Playwright。
- Git 用于仓库安装、工作台配置历史浏览与补丁构建。自行构建 Codex 补丁才需要 Rust 1.95.0 和平台编译工具；复用现成二进制不需要构建链。
- 普通网页使用现代浏览器。Playwright／Chromium 仅用于浏览器自动验证，不是运行制作管线的必装项。
- `archive/`、`demos/`、`rigging/` 和资料重建脚本的 Pillow、NumPy、SciPy、OpenCV、lxml、PyYAML 等依赖只在实际执行相应脚本时成立，不纳入 skill 默认安装。读取已生成的头发参考图不需要重建图片的 Python 包。

默认[方案 1](model-presets.md)全部使用 `gpt-6.1-sol`：preparation low；两套 part 绘制／review medium，分组／去重／补全／深度 high；两套 raster step01 绘制／返修／review 与组装 xhigh；raster step02、人物 step03 和阴影 medium。生图使用 `codex-native`，复用宿主内置工具；不固定底层图像模型版本，无需单独填写生图 API。方案 2 为可选混合配置。LLM 按职责覆盖，生图按拥有工具的实际 agent 覆盖，见 [模型与 harness](agent-models.md) 和 [example.env](../example.env)。使用 Codex 时需要补丁版：它修正失败流的错误读取，并承载自定义生图和按图片数 compact；Claude／AGV 不要求 Codex 补丁。未指定入口时自动构建，缺 Rust 1.95.0 会提示并安装到临时目录，结束后清理。Git 和平台 C/C++ 编译依赖仍须可用。AGV 用 `layering_agv_unlimited_response_header_timeout=true` 开启独立副本的自动准备，见 [patches](../patches/README.md)。Nano 透明后处理使用已有 Node／Sharp，不安装 Python 包或抠图权重。
环境变量、图片阈值、临时错误重试和工具配置细节见 [配置与工作流细节](workflow-details.md)。

组件摆动物理使用 skill 自带 `shared/physics-core`、`shared/physics-evidence` 和 `shared/character-render`，可独立安装运行，不依赖 `web/` 或工作台服务。原任务目录、上游产物及模型配置继续复用；离线图像证据需要 Playwright 浏览器和带插件的 Krita，依赖见 skill package.json。数值标定不需要浏览器，前端可引用同一共享实现。

所有操作 Krita 的 agent 自动收到同一份[环境与故障恢复说明](../shared/krita/environment.md)，沿用现有 shell、computer use 或已验证 bridge。私有进程的 macOS 配置、Python 资源和 HOME 必须一致；不能把一次自建启动器失败直接当作不可恢复阻塞。

动态提示词只在 Markdown 已声明的 `{变量名}` 位置展开，位置由模板决定。Krita 说明使用各阶段的 `{krita_environment}`；全文有来源路径与开始／结束标记。生图规则、运行信息、恢复与 CLI 说明等均有显式模板，见[提示词模板与动态位置](prompt-templates.md)。最终提示词在请求目录 `prompt.md` 和既有阶段记录中可直接审查，不新增执行工具，不修改全局或隐藏系统提示词。
