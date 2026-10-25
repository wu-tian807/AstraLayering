# 推荐模型方案

配置保存在 skill 根目录 `.env`，对使用该安装的任务生效。第一次使用且 `.env` 不存在时，使用方案 1 默认配置创建；用户已选择方案 2 或自定义时沿用其选择，不重复询问。已有 `.env` 直接复用，用户要求切换或调整时才修改。

| 选择 | LLM | 生图 |
| --- | --- | --- |
| 方案 1（默认） | 全部 `gpt-6.1-sol`，按职责分配力度，见下表 | `codex-native`，继承宿主内置生图工具 |
| 方案 2（混合） | GPT 准备、part 描线／review／去重及分析，Argon 遮挡补全与组装，Claude 栅格绘制与阴影，详见下表 | 简化图用 GPT Image Sunburst；素体图和两套 part 遮挡补全参考用 Nano Banana 2.1，其余用 GPT Image Sunburst |
| 自定义 | 在方案 1 或方案 2 上覆盖所需职责 | 按实际生图 agent 覆盖 |

## 方案 1：默认配置

[example.env](../example.env) 是方案 1 的完整模板，代码在未配置职责时也使用同一组默认值。人物与衣服共用以下语言模型职责；返修沿用对应绘制模型。

| 职责 | 模型与力度 | `.env` 配置键 |
| --- | --- | --- |
| 全部 preparation | `gpt-6.1-sol-low` | `layering_agent_preparation_model` |
| part 轮廓绘制与返修 | `gpt-6.1-sol-medium` | `layering_agent_part_draw_model` |
| part 轮廓 review | `gpt-6.1-sol-medium` | `layering_agent_part_review_model` |
| 同层去重／重叠分析 | `gpt-6.1-sol-high` | `layering_agent_part_reduce_model` |
| SVG 遮挡补全 | `gpt-6.1-sol-high` | `layering_agent_part_completion_model` |
| 首次分组与后续细分组 | `gpt-6.1-sol-high` | `layering_agent_part_groups_model` |
| 最终深度分析 | `gpt-6.1-sol-high` | `layering_agent_part_depth_model` |
| raster step01 绘制与返修 | `gpt-6.1-sol-xhigh` | `layering_agent_raster_step01_model` |
| raster step01 review | `gpt-6.1-sol-xhigh` | `layering_agent_raster_step01_review_model` |
| raster step02 | `gpt-6.1-sol-medium` | `layering_agent_raster_step02_model` |
| raster step03（仅人物） | `gpt-6.1-sol-medium` | `layering_agent_raster_step03_model` |
| 穿戴组装 | `gpt-6.1-sol-xhigh` | `layering_agent_assembly_model` |
| 阴影 | `gpt-6.1-sol-medium` | `layering_agent_shadow_model` |
| 物理结构分析 A | `gpt-6.1-sol-high` | `layering_agent_physics_analysis_model` |
| 物理制作／标定／返修 B | `gpt-6.1-sol-xhigh` | `layering_agent_physics_authoring_model` |
| 物理独立复核 C | `gpt-6.1-sol-xhigh` | `layering_agent_physics_review_model` |

全部生图槽位默认继承 `layering_default_image_model=codex-native`，直接使用宿主 Codex 内置生图工具，具体图像模型版本由宿主决定，不在本方案固定。复用当前 Codex 登录和 provider，无需单独填写生图 API；阴影蒙版在 Krita 制作，不启用生图工具。图片数 compact 留空时关闭，已有配置的启停与阈值保持原样。

新安装直接以 `example.env` 创建 `.env`。代码默认值更新不改写已有 `.env`；显式职责配置、兼容旧键和 shell 覆盖继续生效，优先级见[模型与 harness](agent-models.md)。

## 方案 2：混合配置

以 [example.env](../example.env) 为基础，按 [presets/optimized.env](../presets/optimized.env) 替换差异项；差异模板不能单独当作完整 `.env`，运行时只读取 skill 根目录 `.env`。

人物与衣服共用以下语言模型职责；全部 preparation 包括姿态／画风判断、标准化、简化、素体和纯衣服参考准备。

| 职责 | 模型与力度 | `.env` 配置键 |
| --- | --- | --- |
| 全部 preparation | `gpt-6.1-sol-low` | `layering_agent_preparation_model` |
| part 轮廓绘制与返修 | `gpt-6.1-sol-xhigh` | `layering_agent_part_draw_model` |
| part 轮廓 review | `gpt-6.1-sol-xhigh` | `layering_agent_part_review_model` |
| 同层去重／重叠分析 | `gpt-6.1-sol-xhigh` | `layering_agent_part_reduce_model` |
| SVG 遮挡补全 | `gemini-4-argon-high` | `layering_agent_part_completion_model` |
| 首次分组与后续细分组 | `gpt-6.1-sol-xhigh` | `layering_agent_part_groups_model` |
| 最终深度分析 | `gpt-6.1-sol-xhigh` | `layering_agent_part_depth_model` |
| raster step01 绘制与返修 | `claude-opus-5-5-xhigh` | `layering_agent_raster_step01_model` |
| raster step01 review | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step01_review_model` |
| raster step02 | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step02_model` |
| raster step03（仅人物） | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step03_model` |
| 穿戴组装 | `gemini-4-argon-high` | `layering_agent_assembly_model` |
| 阴影 | `claude-sonnet-5-5-xhigh` | `layering_agent_shadow_model` |

SVG 合并由程序执行，不配置 LLM。步骤职责、绘图提示词、review 轮次和会话恢复规则保留原有实现。

简化图使用 `gpt-image-2.5-sunburst`，保留模型返回的原生透明通道；素体图及人物／衣服遮挡补全参考使用 `gemini-nano-banana-2.1`；标准化、纯衣服参考准备、两套 raster、组装及可选阴影贴图使用默认的 `gpt-image-2.5-sunburst`。选择具体模型与工具是否实际生图是两件事，原有任务仍决定使用范围，reviewer 仍只提交反馈。已有 `.env` 仅在用户要求切换相应步骤时更新。

启动前检查已有 Codex、Antigravity 与 Claude CLI、各自登录／模型授权，以及两种生图服务。Sunburst 填写 `layering_openai_image_base_url` 和 `layering_openai_image_api_key`；Nano 填写 `layering_google_image_base_url`、`layering_google_image_api_key` 与 `layering_google_image_protocol`，Google 协议按实际服务选择 `gemini` 或 `openai`。复用已有凭据；缺失时请用户本地补充或确认自定义调整，不自行安装 CLI 或登录。

Codex 选择具体 GPT／Nano 生图模型时使用补丁版原生 imagegen，未指定 `layering_codex_path` 时按需自动构建补丁；Claude／Argon 注册共享生图函数工具。所有配置在启动前按实际角色和生图选择检查，`codex-native` 无法与 Claude／Argon 配对。本次不改变生图后处理、等比缩放或配准流程。

阴影两分支共用 `layering_agent_shadow_model` 的 LLM 职责，蒙版直接在 Krita 绘制，不启用生图工具；法线／深度生图由 `layering_shadow_maps_image_model` 配置，省略时沿用既有默认生图模型、provider 与协议。法线／深度按数据纹理原样返回 RGB，不经过 Nano 颜色素材的背景抠图；完成时按原画恢复 alpha。

## 自定义

以用户选择的方案 1 或方案 2 为基础，再确认要覆盖的 LLM 职责、模型与力度，或具体 agent 的生图模型等选项。仅修改选定的键；完整键与默认值见 [example.env](../example.env)，模型、harness 与生图协议见[模型与 harness](agent-models.md)。不要替用户调整未指定的步骤。

生图选 `codex-native` 的步骤必须使用 Codex 模型；换成 Claude Code 或 Antigravity 时，该生图步骤也需要选择自定义生图服务。按最终配置检查实际所需的 CLI、登录和 API；入口或凭据缺失时展示问题并询问下一步，不自行安装 CLI 或替用户登录。

确认后复制基础模板，按方案替换已有键，不追加同名配置。API URL、协议与密钥使用用户确认的服务，密钥在本地填写，不写进提示词、报告或 Git。shell 同名变量优先于 `.env`，检查生效配置时说明实际覆盖；不修改用户全局 CLI 配置。

切换已有配置的方案时，只替换本次选择的模型与生图差异键；用户只要求调整语言模型时保留全部生图键。不要重新复制完整 `example.env` 覆盖 `.env`，以免清空已确认的图片压缩阈值、CLI 路径、API 和显示环境。修改后执行 `pnpm env:check` 核对[实际生效值](workflow-details.md#生效配置核对)；套餐调整不撤销用户已开启的图片保护。
