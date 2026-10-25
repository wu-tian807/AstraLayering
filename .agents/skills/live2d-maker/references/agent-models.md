# 模型与 harness

首次配置时，先按[推荐模型方案](model-presets.md)确认用户选择；已有 `.env` 继续使用，只有用户要求时才调整。

编辑 skill 根目录 `.env`，完整键和默认值见 [example.env](../example.env)。LLM 使用 `layering_agent_<职责>_model=<模型>-<力度>`，人物与衣服共用，同一职责的所有 group／part 共用。最后的后缀是思考力度，不是模型 ID。

| 职责 | 配置名中间部分 | 覆盖步骤 |
| --- | --- | --- |
| preparation | `preparation` | 全部准备 agent，包括姿态／画风判断和生图执行；默认 Codex low |
| part 绘制 | `part_draw` | 人物与衣服轮廓绘制、返修 |
| part review | `part_review` | 人物与衣服独立轮廓 review |
| 去重 | `part_reduce` | 两套 part 的同层去重 |
| 补全 | `part_completion` | 两套 part 的 SVG 遮挡补全 |
| 分组 | `part_groups` | 两套 part 的首次分组及后续细分组 |
| 深度分析 | `part_depth` | 两套 part 最后的遮挡层级规划，写入 occlusion.json |
| raster step01 | `raster_step01` | 人物与衣服的分层、补全、轮廓/画风对齐和 review 返修 |
| raster step02 | `raster_step02` | 人物与衣服的边缘精修，无独立 review |
| raster step01 review | `raster_step01_review` | 两套 raster 的独立 reviewer |
| raster step03 | `raster_step03` | 仅人物的去除连体服 |
| 物理组件分析 | `physics_analysis` | 源层、连接与覆盖范围 |
| 物理绑定 | `physics_authoring` | 固定区、网格与最大约束 |
| 物理动画复核 | `physics_review` | 同求解器模拟、逐帧证据与结论，无生图 |
| 穿戴组装 | `assembly` | 人物与衣服 KRA 组装 |
| 阴影 | `shadow` | 蒙版投影制作与可选法线／深度制作共用语言模型 |

SVG 合并由程序执行，不配置 LLM。内部步骤名和人物／衣服的提示词、日志、产物、review 轮次及续跑规则仍各自保留。

| CLI | 模型枚举 | 入口 |
| --- | --- | --- |
| Codex | `gpt-6.1-sol`、`gpt-6-astra` | SDK 默认入口，或 `layering_codex_path` |
| Claude Code | `claude-sonnet-5-5`、`claude-opus-5-5`、`claude-haiku-5-5` | `layering_claude_path`，未填则找全局 `claude` |
| Antigravity（agv） | `gemini-4-argon` | `layering_agv_path`，未填则找全局 `agy`／`agv`／`antigravity` |

支持力度 `low`、`medium`、`high`、`xhigh`。配置路径相对于 skill 根目录；模型是否获授权仍由用户的 CLI 登录或 provider 决定。pnpm 不安装 Claude Code 或 Antigravity。启动会明确报告缺失入口；缺少 CLI 或登录凭据时，调用 skill 的 agent 询问用户下一步，不自动安装或代替登录。

例如，将两套 part 的 review 改为 Argon：

```dotenv
layering_agent_part_review_model=gemini-4-argon-high
```

默认使用[方案 1](model-presets.md)：全部职责为 `gpt-6.1-sol`，preparation low，part 绘制／review medium，分组／去重／补全／深度 high，raster step01 绘制／返修／review 与组装 xhigh，raster step02、人物 step03 和阴影 medium；生图继承 `codex-native`。方案 2 保留 GPT、Argon 与 Claude 的混合配置。

统一职责配置优先；旧 `layering_<小步骤>_model` 在同一职责的已填写值一致时可以继续读取，冲突时明确指出旧键并要求填写对应统一键，不自动改写 `.env`。显式设置的旧 `layering_medium_model`／`layering_high_model` 仍作为最后的兼容覆盖：high 对应两套 raster 的 step01、review／返修和 step02，medium 对应其余职责；这一历史映射不随方案 1 的模型名称变化。

## 生图选择

每个拥有生图工具的 agent 使用 `layering_<步骤名>_image_model`，未填继承 `layering_default_image_model`，默认 `codex-native`。生图配置保留实际步骤粒度，人物和衣服分别选择：

- preparation：人物标准化、简化、素体，衣服的纯衣服参考准备。
- part：人物／衣服的 SVG 遮挡补全，可生成隐藏结构辅助参考；轮廓绘制、返修及其 reviewer 不配生图。
- raster：人物 step01、step01 review／返修、step02、step03；衣服 step01、step01 review／返修、step02。
- 穿戴组装 agent。

这张配置表描述工具能力；原任务要求继续约束使用范围，reviewer 仍只提交反馈。姿态／画风判断、首次分组、part 轮廓绘制／返修／review、去重、细分组和深度分析没有开启生图，不增加生图配置。

part 遮挡补全分别使用 `layering_part_completion_image_model` 和 `layering_clothing_completion_image_model`。已有配置从 `layering_part_outline_image_model`／`layering_part_outline_repair_image_model` 迁到人物补全键，衣服的对应旧键迁到衣服补全键，保留原选择的生图模型并删除旧键。旧绘制与返修值不一致时先确认补全使用哪一个，不自动替用户选择。

| 选择 | 配置 |
| --- | --- |
| `codex-native` | 直接继承外部 Codex 原生 imagegen，不启用生图补丁；模型必须属于 Codex |
| `gpt-image-2.5-sunburst`／`gpt-image-2.5-flare` | `layering_openai_image_base_url`、`layering_openai_image_api_key`；协议为 `openai` |
| `gemini-nano-banana-2.1` | `layering_google_image_base_url`、`layering_google_image_api_key`；`layering_google_image_protocol` 明确选择 `gemini` 或 `openai` |

所有拥有生图工具的步骤，`codex-native` 与非 Codex harness 的组合都会在启动前报错。Codex 选择具体 GPT 或 Nano Banana 模型时，使用同一份[原生补丁](../patches/codex/README.md)：配置对应 API；`layering_codex_path` 留空时按需自动构建，也可显式指定已有补丁。启动前检查 `image_provider_version: 2`。工作流为本请求启动本地生图路由，原生 imagegen 负责工具调用、保存图片和事件；路由复用共享 OpenAI／Google 协议适配，模型与凭据不进入提示词。`codex-native` 不启动此路由，也不注入自定义生图配置。

Claude／AGV 继续注册共享 `image_generation` 函数工具，不使用 Codex 补丁。其 [description.md](../shared/tools/image_generation/description.md) 与 [schema.json](../shared/tools/image_generation/schema.json) 保持统一；Codex 使用原生工具定义。两条路径共用同一底层接口实现，调用者都只关心绘图要求和参考图。绘图任务与验收要求保持各管线自己的版本。

OpenAI 兼容协议在 base URL 后追加 `/images/generations` 或 `/images/edits`；Gemini 原生协议追加 `/models/<模型>:generateContent`。参考图按顺序传入，输入文件不修改，生成结果保存在任务请求目录。接口是否能输出透明通道由模型能力决定；共享函数工具返回 `hasAlpha`，原生工具路径也应检查实际 PNG。棋盘格图不等于透明通道，仍须按原要求看图和验收。

调用者统一提出透明 PNG 要求。GPT 图像模型保留返回的原生 alpha，不走纯色抠图。Nano 请求透明背景时，共享适配器在生图前分析第一张目标参考的主体颜色，从纯绿、纯蓝、纯红中推荐一个背景色，并通过[纯色背景要求](../shared/prompts/nano-solid-background.md)明确传给生图模型。原绘制任务完整保留，实际生图请求使用不透明背景。第一张 RGB 图返回后，保留原图并以它作为唯一参考，按[仅换背景要求](../shared/prompts/nano-background-replacement.md)生成第二张白底或黑底图。Node／Sharp 采样两张图四周的实际背景色，通过双背景差分恢复前景颜色和透明度，最终交回一张透明 PNG。两次请求串行执行，共用原模型与协议。明确选择 `auto`／`opaque` 的请求不追加要求、不抠图。返回真实 alpha 时直接保留。

选色忽略透明像素的 RGB 和可识别的原背景，不让后续控制图／画风参考的颜色参与主体色盘。优先避开即使面积很小的同色细节，再比较与主体色相的分离程度；有彩色原背景时使用近不透明颜色锚点降低透色干扰。候选评分、原背景、选色理由写入 `background-selection.json`。没有图像参考时使用纯绿并记录原因；三色都有近色冲突时选综合风险最低者并记录冲突，不声称能无误判。选色是推荐，无法凭单张 RGB 图唯一恢复材料透明度。

差分使用 `C = alpha × F + (1-alpha) × B` 的已知背景公式，不把与背景同色的前景直接删掉。仅将接近完全不透明的 alpha 收到 1；90% 和 95% 的材料仍保留半透明值。两张图的前景必须尽量一致，第二次请求不再执行原绘制任务；模型换背景时仍可能改变局部颜色或几何，存在 alpha 并不保证无损恢复。

Nano 后处理不改变第一张生成图尺寸和比例；工作流仍负责后续等比缩放与配准。原始 RGB `original.png`、换背景图 `counterpart.png`、透明结果 `transparent.png`、alpha 和处理记录保存在本次请求的 `generated/image-processing/<id>/`。第二张分辨率变化或少量画布取整时，Sharp 等比适配到第一张画布，仅用于差分；适配图另存为 `counterpart-aligned.png`，尺寸变换写入 `counterpartAlignment`。第二次请求失败或取消、实际背景不可靠、画布比例明显不同都会明确报错并指出原图路径。两张图与请求记录完整保留，不回退到单图抠色或抠图模型，也不自动安装 Python 包。

主模型网关与生图接口各自鉴权。Codex 默认继承当前用户配置；自定义 Codex provider 沿用 `layering_custom_provider` 和 provider URL／key。Claude／agv 可复用其已有登录，也可在 `.env` 填写 CLI 原生环境变量，例如 `ANTHROPIC_API_KEY`／`ANTHROPIC_BASE_URL`，或 `AGY_LLM_GATEWAY_API_KEY`／`AGY_LLM_GATEWAY_URL`／`AGY_LLM_GATEWAY_MODELS`／`AGY_LLM_GATEWAY_WIRE_PROTOCOL`。密钥不写入提示词、报告或 Git。

AGV 的 GenAI 网关 base URL 可以包含 `/v1beta`，转发会保留供应商前缀并避免重复追加 API 路径。请求日志记录实际图片数、请求字节数、上游响应头与首条内容时间，不记录正文或鉴权。

部分供应商不接受 CLI 内部请求使用的 `MINIMAL`。`layering_agv_minimal_thinking_level` 默认留空，完整保留原生协议；只有实际接口确认不支持时才显式填写 `LOW`、`MEDIUM` 或 `HIGH`，仅替换 MINIMAL。支持 MINIMAL 的上游无需设置，不统一降低或改写 agent 的力度。若遇到 CLI 自身 60 秒响应头期限，按[可选 AGV 兼容补丁](../patches/agv/README.md)核对构建并验证；不自动安装、修改全局 CLI 或重建会话。

## 会话与记录

Claude／agv 的每次请求有独立工作区、私有配置和临时文件，均在 `<dir>/<name>/` 的 `agents/<请求>/` 下。仅从用户环境复用鉴权信息，隔离 CLI 的会话、项目设置及工具配置，不修改用户的全局配置。恢复同一 session 时复用原请求的私有会话数据；后续请求仍各有独立工作区。Antigravity 的 GenAI 自定义网关会转发原始工具定义，并保留工具返回的图片。

part 绘制 ID 和 harness 记录在各管线 `groups/<完整groupID>/step01/session.json`（子组嵌套为 `groups/<父>/children/<名>`），绘制与返修共用，重跑轮廓步骤时随目录一起重置；补全会反复修改草稿，同样把 ID 记在 `step02/session.json`，中断续跑时恢复同一会话，重跑补全步骤时随目录一起重置。独立 reviewer、去重和子组分析等一次性 agent 每次新建，不记录 ID。换线程时旧记录追加到 `session.json.history.jsonl`。raster 的绘制 ID 仍记录在本管线 `run.json`，`.running`／`.completed`、两轮 review 和产物检查规则不变。

同一 CLI 内改变模型或力度继续恢复原会话。Codex 的生图模型改变时，重启本请求的原生通道并恢复原 thread，已有产物保留。切换 CLI、删除 ID 或会话不可用时新建会话，旧请求记录与产物保留，ID 替换写入历史；新会话读取已有输入、产物及反馈继续。缺产物的正常退出仍报错并展示最后消息，不增加自动空产物重试。

旧 `layering_image_compact_threshold` 仅作用于 Codex，沿用原生带图压缩补丁。新增各 CLI 独立的图片数和请求体 MiB 预算，可按实际路由开启；留空保持原行为。AGV／Claude 接入补丁复用同一视觉压缩模块，原生自动压缩仍保留。配置和恢复边界见 [图片容量保护](../patches/README.md#图片容量保护)。

独立 raster reviewer 使用 `layering_agent_raster_step01_review_model`；返修与绘制共用 `layering_agent_raster_step01_model`。原 `layering_agent_raster_step02_review_model` 配置需迁移为新的 step01 键；各自独立的生图键同样从 `raster_step02_review/repair` 改为 `raster_step01_review/repair`，衣服带 `clothing_` 前缀。模型、力度和生图选择保持可自定义，见 [example.env](../example.env)。
