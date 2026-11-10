# 工作台开发说明

用户操作见 [README.md](README.md)。本页维护接口、文件约定与部署方式。

## 设置与任务参数

| 保存位置 | 内容 |
| --- | --- |
| `.web/settings.json` | 新任务默认运行目录、Krita、FFmpeg、knowledge |
| `<任务>/run.json` | 本任务的总调度参数和 section 状态 |
| skill 根目录 `.env` | 模型、服务连接与运行环境 |
| 浏览器 localStorage | 所选任务、角色工作台基准目录与展开状态 |
| `<任务>/.web-project.json` | 任务显示名称 |

全局设置提供新任务默认值。已有任务通过“执行参数”修改自己的配置；总调度持久化这些参数，每次启动 section 时传入。独立 section 每次显式接收运行目录、knowledge 与所需软件路径。

Krita 和 FFmpeg 使用共享选择与扫描组件。扫描先检查 PATH 和常见安装位置，再遍历目录；各软件独立显示进度和结果，可停止并重新扫描。自动扫描跳过隐藏目录与系统虚拟目录，手动浏览可选择实际安装文件。

## API

| 接口 | 用途与参数 |
| --- | --- |
| `POST /api/task-options` | `{name, ...修改字段}`，保存本任务执行参数 |
| `POST /api/task-action` | `{name, dir, action, section?}`，继续、恢复或重试；省略 section 时处理任务范围 |
| `POST /api/convert-layout` | `{name}`，备份后转换旧任务布局 |
| `GET /api/export` | `dir`、`name`，下载完成任务的成果 ZIP |
| `GET /api/config/environment` | 读取配置和 revision，敏感值隐藏 |
| `POST /api/config/environment/preview` | `{revision, changes}`，预览生效配置 |
| `POST /api/config/environment` | `{revision, changes}`，保存配置；版本冲突返回 409 |
| `GET /api/studio/project` | `folder`，读取角色项目描述 |
| `GET /studio-artifact` | `folder`、`path`，读取项目约定中的工程与贴图 |
| `GET /api/version`、`GET /healthz` | 版本与服务状态 |

任务操作在任务锁内执行。单个步骤由 CLI 的 `--section` 和 `--step` 选择，task-action 接口支持 section 级选择。

环境保存仅更新提交的字段，保留已有密钥、未知配置和注释；写入使用私有临时文件并原子替换。配置在下一次启动或续跑时读取，运行中的请求使用已绑定的启动值。

## 产物与状态

网页从任务目录中的步骤记录和实际文件投影进度。中间文件、正式交付、审核与运行错误分别展示；必需文件缺失时显示异常。九轴视频成功检查非空 MP4，模型阶段检查所需模型、工程与贴图。

以下路径相对 `<运行目录>/<任务名>/`，角色项目契约集中在 [studio-artifacts.ts](../.agents/skills/live2d-maker/shared/studio-artifacts.ts)：

| 用途 | 路径 |
| --- | --- |
| 组装工程与原画 | `character-assembly/step01/character-assembled.kra`、`.png` |
| 法线与深度 | `lighting/normal.png`、`lighting/depth.png` |
| 阴影 | `shadow/step01_mask` 或 `shadow/step01_normal-depth` |
| 九轴素材准备 | `nine-axis/step01_preparation/deformers.json` |
| 九轴单轴模型 | `nine-axis/step04_angles/model/{left,up,down}/deformers.json` 及父合并 |
| 九轴斜角 | `nine-axis/step06_angle-xy/deformers.json` |
| 九轴下颌交付 | `nine-axis/step07_jaw-line/deformers.json`、`character-nine-axis.kra`、`.png` |

流程预览每 4 秒同步变化。过程文件按文件夹分配展示名额，上限为 1000 个；agent 请求与会话由服务器保留。九轴预览使用共享模型和渲染器，中间成果保存后即可读取。

项目自动加载对应工程和贴图；阴影混合预览要求两种模式的来源与组装结果匹配。图层状态变化时暂停旧法线与深度，还原时恢复对应贴图。

## 角色工作台

`?project=<name>` 打开运行目录中的任务，`?folder=<绝对路径>` 打开所选文件夹。`nineStage=x|y|xy|jaw` 选择九轴阶段；旧四步成果保留兼容读取。

Krita 原生合成支持图层属性与已有蒙版。PSD 导入处理连续剪贴链、组不透明度和蒙版停用状态；高级效果、复合矢量蒙版及智能对象按 Krita 导入能力读取。无法完整映射结构时展示保存合成图，使用者可在 Krita 中另存 KRA 后打开。

图层会话最多同时打开 4 个文档、合计 6400 万像素，30 分钟未访问后清理。切换文件、关闭页面和服务退出也清理临时文档。

九轴模型保存使用 revision 处理并发修改。预览范围由可用轴向和弧形边界限制，编辑数据保留完整关键形。

物理草稿 schema 2 使用 KRA 图层 UUID 绑定部件，保存源像素与几何信息；新图层默认关闭，已变化的部件提示确认。草稿保存在本机，网页物理用于预览与调整。

## 版本与发布

Git 检出从 `vX.Y.Z` 标签读取版本，标签后的提交显示为 `+N`；无 Git 的 ZIP 从根 `package.json` 读取。任务的 `createdWith`、`lastRunWith` 保存对应运行版本。

更新检查每天最多查询一次 GitHub，缓存在 `.web/update-check.json`；失败一小时后再试。skill `.env` 中的 `update_check=false` 可关闭查询。

正式发布遵循 [版本打包流程](../docs/releasing.md)。

## 部署

服务默认监听本机。远程部署通过已有反向代理提供同源入口；静态资源、API 和产物使用相对 URL，支持同源子路径。任务写入沿用同源与目录边界检查，SVG 使用 sandbox 响应头。

常驻服务继承可用的 Node、模型 CLI 和 Krita 显示环境。systemd 使用 `KillMode=process`，保留脱离的后台工作流；停止制作使用网页“停止”或 skill 总入口的 `--stop`。

`.run/` 保存制作数据，`.web/` 保存本机服务设置，升级时保留。独立 skill 的工作台连接见 [总流程](../.agents/skills/live2d-maker/workflow/README.md#工作台启动与连接)。

## 检查

按改动运行相关测试，涉及类型时执行 `pnpm check:web`。完整网页测试入口为 `pnpm test:web`，原生合成与浏览器检查记录见 [studio/VALIDATION.md](studio/VALIDATION.md)。
