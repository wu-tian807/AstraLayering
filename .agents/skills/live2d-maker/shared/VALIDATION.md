# 共享运行时验证

首次使用新的模型方案、CLI 或 provider，以及修改协议适配／工具 schema 后，按本次路线验证。记录版本、实际配置来源、检查结果与日志位置；不能把命令存在、一次 `OK` 或模拟服务器通过写成完整实测。用户要求停管线时不执行真实模型或生图检查。

### 自动检查

从 skill 根目录执行：

```bash
pnpm test:agents
# 修改 TypeScript 后再检查类型；相同源码的通过记录可以复用。
pnpm check
```

`test:agents` 不调用真实模型或生图服务，覆盖以下条件：

| 条件 | 通过标准 |
| --- | --- |
| 方案 1 默认、方案 2 混合与自定义配置 | 全部 LLM 职责和独立生图选择完整；人物／衣服职责共享，但工具和提示词覆盖保留；本地非空值优先、启动环境回退与旧配置冲突有对应断言 |
| 模型与生图组合 | 所有生图步骤拒绝非 Codex harness 配原生 imagegen；缺少所选生图 URL／key、CLI 或 Codex 生图补丁能力时，启动前明确报错；CLI 本地版本探测能识别文件存在但解释器／动态库缺失的情况 |
| 真实工具目录 | 读取 `shared/tools/`、`shadow/tools/`、`clothing-part-layering/tools/` 的全部 schema.json 与 knowledge 中的 description.md，管线自有工具只出现在该管线的 catalog；不以只含简单字符串的测试工具代替；可空类型、嵌套数组、枚举、数值约束、oneOf 和 additionalProperties 等逐字段保留 |
| Gemini 请求 | 实际 HTTP 适配路径用 parametersJsonSchema 传完整 JSON Schema，不能把 type 数组塞进受限的 parameters；保留 CLI 原生工具；重复准备不重复注册；camelCase／snake_case 原生声明均可处理 |
| 工具调用与返回 | 原参数、null 值、工具说明、文本、全部返回图片及 thought signature 不丢失；下一回合还能恢复上回合的工具结果 |
| Codex 原生生图 | `codex-native` 不注入补丁生图配置；GPT／Nano 使用原生工具；不同请求的路由／模型隔离，保存图片事件与原 thread 续跑保留 |
| 自定义生图协议 | Gemini 原生和 OpenAI 兼容的生图／编辑请求保留提示词与输入图片，输入文件不修改；输出落在请求目录，跨任务路径被拒绝 |
| 会话恢复 | 同 CLI 修改模型／力度恢复原会话；切换 CLI 或会话失效创建替代会话并记录历史，已有产物保留 |
| 会话配置隔离 | 三种 harness 共用任务内的会话路径注册；Codex 模型目录探测与 App Server 使用同一私有配置根，只迁入认证文件。新会话隔离，重连复用原数据；任务移动后可解析，数据目录、workspace 与配置文件的路径逃逸被拒绝。管线显式 provider 配置和动态工具保留，宿主个人指令与扩展不自动载入 |
| 故障与状态 | 只按通道给出的结构化错误码判断临时错误并沿用会话重试，错误文本只能否决、不能触发重试；正常退出却无产物展示最后消息；取消、失败及进程退出的总控状态明确，不把已退出进程展示为运行中 |

自动回归覆盖配置、传输与恢复；新服务另按下节检查实际调用和制作效果。

### 新环境的真实验证

在实际 `.env`、任务目录及隔离请求环境中执行最小验证，记录哪些是实测，哪些仍是模拟覆盖。测试文件和请求记录放在 `<dir>/<name>/runtime/`，不写入用户全局配置。已通过的同版本、同配置检查不反复执行。

1. **带真实工具测试所选 harness。** 用现有 `CodexAgents`／`runCliTask` 调用路径，载入 `ToolCatalog` 的实际共享及管线覆盖定义。请求必须携带真实 schema，尤其包含 write_groups 的可空 note 和 propose_occlusion 的单／多深度 oneOf；只询问模型是否能回复不算通过。工具回调使用测试数据，不能修改正式成果。
2. **验证调用和续会话。** 让模型实际调用一个无副作用测试工具，核对参数与返回值，再以该 session/threadId 发第二回合。测试工具也包含可空字段，并返回小型测试图片，确认下一回合能读取。纯连通、注册、执行、带图返回、恢复是不同验证项，不能相互替代。
3. **按所选生图方式验证。** 原生 Codex 要确认实际注册 imagegen；自定义服务要使用本次配置的协议、模型与输入图片。首次正式准备步骤产出合格图片后可作为该生图组合的实测证据，记录尺寸／透明通道与实际产物；不能据此宣称另外的模型或协议也通过。无必要不额外生图。
4. **验证所需软件。** 每次启动都对显式 Krita 入口做不启动 Krita 的轻量检查；真实验证由 agent 经本 section 私有 Krita 的 `krita` 工具完成保存 KRA、重新打开和查看／导出图像，脚本运行在 Krita 自带的 Python 中。Linux 无显示时框架启动共享 Xvfb（`-noreset`），已设 `QT_QPA_PLATFORM` 时沿用该设置；使用 Xvfb 时验证它能从工作流环境启动。Nano 双背景处理用已有 Node／Sharp，无抠图模型推理步骤；版本命令不是全部验收。
5. **核对续跑和展示。** 检查总控进程、锁、真实阶段与工作台一致。恢复时核对准备图内容指纹，已完成的步骤不能重新生图。取消后检查任务所属的绘制子进程，不能只看总控 PID 消失。

发现确定的请求格式错误时先修适配并补回归，不用重复重试掩盖。修复不更换用户选定模型、不删产物、不修改绘图提示词与审核轮次。缺少 CLI／凭据的处理和安装确认沿用[安装与前置](../references/setup.md)。

### 验证记录

任务 monitor.md 至少记录：代码／CLI 版本与配置位置、实际覆盖的步骤或工具集、模拟／真实验证区别、结果和请求日志、未测项。重用证据时说明适用范围。不能使用“所有情况都通过”代替这些记录；新的问题补具体回归和检查条件。

## 自动化测试（维护用）

```sh
pnpm test
# 只验证一个共享模块
node --import ./shared/tests/ignore-local-env.ts --test shared/tests/step-models.test.ts
pnpm check
```

自动回归使用本地模拟，不证明上游授权、实际绘图质量或全部协议兼容。临时服务退避、会话恢复与宿主巡检见 [workflow](../workflow/README.md)。

配置规则与视频适配的无模型回归：

```sh
node --import ./shared/tests/ignore-local-env.ts --test shared/tests/model-patterns.test.ts shared/tests/default-configuration.test.ts nine-axis/tests/video-providers.test.ts workflow/tests/configuration-startup.test.ts
```

覆盖同一份浏览器／管线通配语法、追加规则与自定义路由、静态图片参数、三种视频协议、密钥隔离及启动失败日志。
