# 模型方案与配置

配置保存在 skill 根目录 `.env`，对使用该安装的任务生效。第一次使用且 `.env` 不存在时，使用方案 1 默认配置创建；用户已选择方案 2 或自定义时沿用其选择，不重复询问。已有 `.env` 直接复用，用户要求切换或调整时才修改。

完整仓库可在网页 **“管线配置 → 环境与模型”** 中选择模型、预览并保存 `.env`；界面与工作流共用配置解析器。独立 skill 或批量配置可按本页的配置键编辑文件。

每套方案同时包含 **LLM** 和 **生图模型**：`layering_agent_<职责>_model` 选择执行任务的语言模型与思考力度，`layering_<步骤>_image_model` 选择该步骤调用的生图模型。LLM 按职责配置，人物与衣服共用；生图按实际步骤分别配置，完整键见下方[生图模型与配置键](#生图模型与配置键)。

常规配置阅读两套方案与[生图配置键](#生图模型与配置键)；自定义接入时阅读 [CLI 与 provider](#cli-与-provider)和[生图执行](#生图执行与透明处理)，迁移或续跑时阅读[配置覆盖](#配置覆盖与旧键迁移)与[会话记录](#会话与记录)。

| 选择 | LLM | 生图 |
| --- | --- | --- |
| 方案 1（默认） | 全部 `gpt-6.1-sol`，按职责分配力度，见下表 | `codex-native`，继承宿主内置生图工具 |
| 方案 2（混合） | GPT 准备、part 描线／review／去重及分析，Claude SVG 遮挡补全、栅格绘制、组装与阴影，详见下表 | 简化图用 GPT Image Sunburst；素体图和两套 part 遮挡补全参考用 Nano Banana 2.1，其余用 GPT Image Sunburst |
| 自定义 | 在方案 1 或方案 2 上覆盖所需职责 | 按实际生图 agent 覆盖 |

## 方案 1：默认配置

[example.env](../example.env) 是默认配置的唯一来源，维护在 skill 内。启动器以它创建 `.env`，运行时缺省值与 WebUI 默认展示也读取它；修改默认模型或力度时统一更新此文件。已有 `.env` 继续保留用户配置。人物与衣服共用以下语言模型职责；返修沿用对应绘制模型。

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
| 九轴 step02 脸部与双耳转向 | `gpt-6.1-sol-xhigh` | `layering_agent_nine_axis_head_model` |

生图设置为 `layering_default_image_model=codex-native`，全部步骤的生图覆盖键留空，继承宿主 Codex 内置生图工具。具体图像模型版本由宿主决定，复用当前 Codex 登录和 provider。逐步骤键与自定义服务配置见下方[生图表](#生图模型与配置键)。图片数 compact 留空时关闭，已有配置的启停与阈值保持原样。

新安装直接以 `example.env` 创建 `.env`。代码默认值更新不改写已有 `.env`；显式职责配置、兼容旧键和 shell 覆盖继续生效，优先级见[配置覆盖与旧键迁移](#配置覆盖与旧键迁移)。

## 方案 2：混合配置

以 [example.env](../example.env) 为基础，按 [presets/optimized.env](../presets/optimized.env) 替换差异项；差异模板不能单独当作完整 `.env`，运行时只读取 skill 根目录 `.env`。

人物与衣服共用以下语言模型职责；全部 preparation 包括姿态／画风判断、标准化、简化、素体和纯衣服参考准备。

| 职责 | 模型与力度 | `.env` 配置键 |
| --- | --- | --- |
| 全部 preparation | `gpt-6.1-sol-low` | `layering_agent_preparation_model` |
| part 轮廓绘制与返修 | `gpt-6.1-sol-xhigh` | `layering_agent_part_draw_model` |
| part 轮廓 review | `gpt-6.1-sol-xhigh` | `layering_agent_part_review_model` |
| 同层去重／重叠分析 | `gpt-6.1-sol-xhigh` | `layering_agent_part_reduce_model` |
| SVG 遮挡补全 | `claude-sonnet-5-5-xhigh` | `layering_agent_part_completion_model` |
| 首次分组与后续细分组 | `gpt-6.1-sol-xhigh` | `layering_agent_part_groups_model` |
| 最终深度分析 | `gpt-6.1-sol-xhigh` | `layering_agent_part_depth_model` |
| raster step01 绘制与返修 | `claude-opus-5-5-xhigh` | `layering_agent_raster_step01_model` |
| raster step01 review | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step01_review_model` |
| raster step02 | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step02_model` |
| raster step03（仅人物） | `claude-sonnet-5-5-xhigh` | `layering_agent_raster_step03_model` |
| 穿戴组装 | `claude-sonnet-5-5-xhigh` | `layering_agent_assembly_model` |
| 阴影 | `claude-sonnet-5-5-xhigh` | `layering_agent_shadow_model` |
| 九轴 step02 脸部与双耳转向 | `claude-sonnet-5-5-xhigh` | `layering_agent_nine_axis_head_model` |

SVG 合并由程序执行，不配置 LLM。步骤职责、绘图提示词、review 轮次和会话恢复规则保留原有实现。

生图默认使用 `gpt-image-2.5-sunburst`，素体图及人物／衣服遮挡补全参考覆盖为 `gemini-nano-banana-2.1`。各步骤的显式值和继承关系见下方[生图表](#生图模型与配置键)。Sunburst 保留返回的原生透明通道；Nano 颜色素材通过共享后处理恢复透明度，细节见[生图执行与透明处理](#生图执行与透明处理)。

启动前检查已有 Codex 与 Claude CLI、各自登录／模型授权，以及两种生图服务。复用已有凭据；缺失时请用户本地补充或确认自定义调整。

## 生图模型与配置键

### 可选模型与服务连接

生图模型值直接填写下表中的模型 ID；思考力度后缀仅用于 LLM。自定义生图服务的连接参数也保存在同一份 `.env`，与 LLM 的 provider 分别配置。

| 生图模型 | 配套 `.env` 配置与使用条件 |
| --- | --- |
| `codex-native` | 对应步骤的 LLM 使用 Codex harness，复用其登录与宿主生图能力 |
| `gpt-image-2.5-sunburst` | `layering_openai_image_base_url`、`layering_openai_image_api_key`；协议固定为 OpenAI Images |
| `gpt-image-2.5-flare` | 与 Sunburst 共用上述 OpenAI 生图连接配置 |
| `gemini-nano-banana-2.1` | `layering_google_image_base_url`、`layering_google_image_api_key`；`layering_google_image_protocol` 按服务选择 `gemini` 或 `openai` |

OpenAI 兼容服务的 base URL 通常包含 `/v1`，程序追加 `/images/generations` 或 `/images/edits`；Gemini 原生服务的 base URL 通常包含 `/v1beta`，程序追加 `/models/<模型>:generateContent`。按服务提供的地址和协议填写，API 密钥在本机保存。

所有 Codex 步骤都使用补丁版 Codex（`layering_codex_path` 留空即自动准备，构建见 [setup](setup.md#codex-补丁构建与恢复)）；Codex 步骤选具体 GPT／Nano 生图模型时，补丁还须具备原生 image provider v2。Claude／AGV 使用共享生图函数工具。为 Claude／AGV 步骤选择上述 GPT／Nano 服务，并准备对应 API；`codex-native` 对应 Codex 步骤。

### 全局默认与逐步骤覆盖

**步骤键有值时使用该值，留空时继承 `layering_default_image_model`。** 方案 1 将全局默认设为 `codex-native`；方案 2 将其设为 `gpt-image-2.5-sunburst`，再覆盖特定步骤。下表的“继承默认”表示该步骤键留空。

| 生图用途 | `.env` 配置键 | 方案 1 | 方案 2 |
| --- | --- | --- | --- |
| 全局默认 | `layering_default_image_model` | `codex-native` | `gpt-image-2.5-sunburst` |
| 人物姿态标准化 | `layering_part_standardize_image_model` | 继承默认 | 继承默认 |
| 简化穿衣角色参考 | `layering_part_simplify_image_model` | 继承默认 | `gpt-image-2.5-sunburst` |
| 人物素体参考 | `layering_part_base_subject_image_model` | 继承默认 | `gemini-nano-banana-2.1` |
| 纯衣服参考 | `layering_clothing_preparation_image_model` | 继承默认 | `gpt-image-2.5-sunburst` |
| 人物 part 遮挡补全辅助参考 | `layering_part_completion_image_model` | 继承默认 | `gemini-nano-banana-2.1` |
| 衣服 part 遮挡补全辅助参考 | `layering_clothing_completion_image_model` | 继承默认 | `gemini-nano-banana-2.1` |
| 人物 raster step01 绘制 | `layering_raster_step01_image_model` | 继承默认 | 继承默认 |
| 人物 raster step01 review | `layering_raster_step01_review_image_model` | 继承默认 | 继承默认 |
| 人物 raster step01 返修 | `layering_raster_step01_repair_image_model` | 继承默认 | 继承默认 |
| 人物 raster step02 边缘精修 | `layering_raster_step02_image_model` | 继承默认 | 继承默认 |
| 人物 raster step03 换装素体 | `layering_raster_step03_image_model` | 继承默认 | 继承默认 |
| 衣服 raster step01 绘制 | `layering_clothing_raster_step01_image_model` | 继承默认 | 继承默认 |
| 衣服 raster step01 review | `layering_clothing_raster_step01_review_image_model` | 继承默认 | 继承默认 |
| 衣服 raster step01 返修 | `layering_clothing_raster_step01_repair_image_model` | 继承默认 | 继承默认 |
| 衣服 raster step02 边缘精修 | `layering_clothing_raster_step02_image_model` | 继承默认 | 继承默认 |
| 穿戴组装 | `layering_assembly_image_model` | 继承默认 | 继承默认 |
| 阴影法线／深度贴图 | `layering_shadow_maps_image_model` | 继承默认 | 继承默认 |

这些键配置各 agent 的生图工具能力，实际调用按对应步骤的任务要求执行，reviewer 仍只提交反馈。姿态标准化在开启 `standard` 且判断需要调整时执行；阴影 `mask` 分支在 Krita 制作原生蒙版，`layering_shadow_maps_image_model` 用于 `normal-depth` 分支。法线／深度按数据纹理原样返回 RGB，完成时按原画恢复 alpha。

### 修改示例

例如，将**人物 raster step01 的绘制与返修**都改用 Flare，填写以下两个步骤键，并按上表准备 OpenAI 生图连接：

```dotenv
layering_raster_step01_image_model=gpt-image-2.5-flare
layering_raster_step01_repair_image_model=gpt-image-2.5-flare
```

人物 review、衣服绘制和其他步骤继续使用各自配置。调整全局默认时，已有显式步骤值继续优先；希望某一步跟随新默认时，将该步骤键留空。修改后用 `pnpm env:check` 核对每个步骤实际采用的 LLM、生图模型与服务协议。

## 自定义

以用户选择的方案 1 或方案 2 为基础，再确认要覆盖的 LLM 职责、模型与力度，或具体 agent 的生图模型等选项。仅修改选定的键；完整键与默认值见 [example.env](../example.env)，CLI、provider 与生图协议见[下方接入说明](#cli-与-provider)。其余职责沿用已有选择。

生图选 `codex-native` 的步骤必须使用 Codex 模型；换成 Claude Code 或 Antigravity 时，该生图步骤也需要选择自定义生图服务。按最终配置检查实际所需的 CLI、登录和 API；入口或凭据缺失时展示具体问题，并请用户选择安装、登录或调整模型的方案。

新安装复制基础模板；已有配置按方案替换选定键，保持每个键唯一。API URL、协议与密钥使用用户确认的服务，密钥在本地填写，不写进提示词、报告或 Git。shell 同名变量优先于 `.env`，检查生效配置时说明实际覆盖；不修改用户全局 CLI 配置。

切换已有配置的方案时，只替换本次选择的模型与生图差异键；用户只要求调整语言模型时保留全部生图键。图片压缩阈值、CLI 路径、API 和显示环境沿用已有值。修改后执行 `pnpm env:check` 核对[实际生效值](../workflow/README.md#生效配置核对)；套餐调整不撤销用户已开启的图片保护。

## CLI 与 provider

| CLI | 模型枚举 | 入口 |
| --- | --- | --- |
| Codex | `gpt-6.1-sol`、`gpt-6-astra` | `layering_codex_path` 留空自动准备补丁版，填写时检查指定入口的补丁能力；`layering_codex_home` 设置 Codex 子进程的 `CODEX_HOME`（留空沿用 shell 的 `CODEX_HOME`／`~/.codex`） |
| Claude Code | `claude-sonnet-5-5`、`claude-opus-5-5`、`claude-haiku-5-5` | `layering_claude_path`，未填则找全局 `claude` |
| Antigravity（agv） | `gemini-4-argon` | `layering_agv_path`，未填则找全局 `agy`／`agv`／`antigravity` |

支持力度 `low`、`medium`、`high`、`xhigh`。配置路径相对于 skill 根目录；模型是否获授权仍由用户的 CLI 登录或 provider 决定。Claude Code／Antigravity 复用本机入口与登录；启动会报告缺失条件，由 agent 与用户确认安装、登录或改选模型的方案。

例如，将两套 part 的 review 改为 Argon：

```dotenv
layering_agent_part_review_model=gemini-4-argon-high
```

## 主模型连接与模型列表

三种 CLI 统一使用 `layering_<codex|claude|agv>_<api_key|base_url|models>`。只有 AGV 提供 `layering_agv_protocol` 协议选择；Codex 固定使用 Responses，Claude 自定义连接固定使用 Anthropic Messages。连接字段留空时复用已有登录和 provider；主模型与生图各自鉴权，不共用 key。具体字段如下，CLI 路径和生图连接沿用同一份 `.env`：

| CLI | API 密钥 | 服务地址 | 可用模型列表 |
| --- | --- | --- | --- |
| Codex | `layering_codex_api_key` | `layering_codex_base_url` | `layering_codex_models` |
| Claude | `layering_claude_api_key` | `layering_claude_base_url` | `layering_claude_models` |
| AGV | `layering_agv_api_key` | `layering_agv_base_url` | `layering_agv_models` |

| CLI | 协议 | 自定义连接 | 模型列表的原生适配 |
| --- | --- | --- | --- |
| Codex | `responses` | key 必填；URL 留空为 `https://api.openai.com/v1` | 启动前校验列表，App Server 传入步骤选定模型，保留宿主模型元数据 |
| Claude Code | `anthropic`（Messages） | key 必填；URL 留空为 `https://api.anthropic.com` | 每次请求的私有 settings 中生成 `modelPicker` |
| AGV | `genai` 或 `openai` | key 与 URL 都必填；协议留空默认 `genai` | 映射到原生 `AGY_LLM_GATEWAY_MODELS` |

`models` 接受逗号分隔的模型 ID，自动去掉两侧空白和重复项，不写力度后缀或 JSON 数组。例如 `layering_codex_models=gpt-6.1-sol,gpt-6-astra`。留空不限制。列表声明可用模型，具体职责仍由 `layering_agent_<职责>_model` 选择，工作流模型枚举保持上表范围。启动前只核对本次所选步骤；模型不在列表时明确报错，不发起模型请求。列表不证明账号拥有该模型权限。

Claude 的已有 Bedrock／Vertex／Foundry 路由在统一连接留空时继承；填写统一连接与已启用的云平台路由冲突时明确报错。AGV 的 `openai` 模式可以透传，但本项目的 AGV 工具／原图转发及图片容量保护依赖 `genai`；配置保护却选 `openai` 时不会静默忽略。

逐字段优先级为 shell 统一键、shell 旧别名、`.env` 统一键、`.env` 旧别名，最后继承 CLI 登录；空 shell 值屏蔽文件中的同名键。旧 Codex `layering_custom_provider=true` 与 `layering_provider_base_url/api_key`，Claude `ANTHROPIC_API_KEY/BASE_URL`，AGV `AGY_LLM_GATEWAY_API_KEY/URL/MODELS/WIRE_PROTOCOL` 继续兼容。统一 Codex 连接不再需要旧开关。CLI 接收转换后的原生字段，不修改 `process.env` 或全局配置；显式 Claude 连接的 key 优先于继承的 token／key helper，后者仅在本次私有配置中移除。

`pnpm env:check` 展示每个 CLI 的连接来源、地址、协议、模型列表和凭据是否填写，不输出 key／token 值。与 CLI 登录权限和版本检查一起核对，见[生效配置核对](../workflow/README.md#生效配置核对)。

AGV 的 GenAI 网关 base URL 可以包含 `/v1beta`，转发会保留供应商前缀并避免重复追加 API 路径。请求日志记录实际图片数、请求字节数、上游响应头与首条内容时间，正文与鉴权保留在原接口调用环境。

部分供应商需要兼容 CLI 内部请求中的 `MINIMAL`。`layering_agv_minimal_thinking_level` 默认留空，完整保留原生协议；只有实际接口确认不支持时才显式填写 `LOW`、`MEDIUM` 或 `HIGH`，仅替换 MINIMAL。支持 MINIMAL 的上游保持此项留空，各 agent 沿用已选力度。若遇到 CLI 自身 60 秒响应头期限，按[可选 AGV 兼容补丁](../patches/README.md)核对构建并验证；继续复用原 CLI 登录与会话。

## 生图执行与透明处理

Codex 的自定义生图请求通过[原生补丁](../patches/README.md)接入；启动会核对补丁的 `image_provider_version: 2`，为本次请求准备本地生图路由。原生 imagegen 负责工具调用、保存图片与事件，路由复用共享 OpenAI／Google 适配器，模型与凭据通过运行配置传递。`codex-native` 直接使用宿主生图能力。

Claude／AGV 注册与 Codex 原生工具同名的共享 `imagegen` 函数工具，其 [description.md](../knowledge/shared/tools/imagegen/description.md) 与 [schema.json](../shared/tools/imagegen/schema.json) 保持统一；Codex 使用原生工具定义。两条路径共用底层接口实现，绘图任务与验收要求由各管线自己的提示词约定。

参考图按顺序传入，生成结果保存在任务请求目录。共享函数工具返回 `hasAlpha`，原生工具路径也检查实际 PNG 的透明通道，并结合看图验收。

调用者统一提出透明 PNG 要求。GPT 图像模型直接保留返回的原生 alpha。Nano 请求透明背景时，共享适配器在生图前分析第一张目标参考的主体颜色，从纯绿、纯蓝、纯红中推荐一个背景色，并通过[纯色背景要求](../shared/prompts/nano-solid-background.md)明确传给生图模型。原绘制任务完整保留，实际生图请求使用不透明背景。第一张 RGB 图返回后，保留原图并以它作为唯一参考，按[仅换背景要求](../shared/prompts/nano-background-replacement.md)生成第二张白底或黑底图。Node／Sharp 采样两张图四周的实际背景色，通过双背景差分恢复前景颜色和透明度，最终交回一张透明 PNG。两次请求串行执行，共用原模型与协议。明确选择 `auto`／`opaque` 的请求沿用原背景要求与输出。返回真实 alpha 时直接保留。

选色仅分析第一张目标参考的主体色盘，排除透明像素的 RGB 与可识别的原背景。优先避开即使面积很小的同色细节，再比较与主体色相的分离程度；有彩色原背景时使用近不透明颜色锚点降低透色干扰。候选评分、原背景、选色理由写入 `background-selection.json`。没有图像参考时使用纯绿并记录原因；三色都有近色冲突时选综合风险最低者，并记录冲突与风险。选色是推荐，无法凭单张 RGB 图唯一恢复材料透明度。

差分使用 `C = alpha × F + (1-alpha) × B` 的已知背景公式，保留与背景同色的前景信息。仅将接近完全不透明的 alpha 收到 1；90% 和 95% 的材料仍保留半透明值。两张图的前景必须尽量一致，第二次请求仅更换背景；模型换背景时仍可能改变局部颜色或几何，存在 alpha 并不保证无损恢复。

Nano 后处理保持第一张生成图的尺寸和比例；工作流仍负责后续等比缩放与配准。原始 RGB `original.png`、换背景图 `counterpart.png`、透明结果 `transparent.png`、alpha 和处理记录保存在本次请求的 `generated/image-processing/<id>/`。第二张分辨率变化或少量画布取整时，Sharp 等比适配到第一张画布，仅用于差分；适配图另存为 `counterpart-aligned.png`，尺寸变换写入 `counterpartAlignment`。第二次请求失败或取消、实际背景不可靠、画布比例明显不同都会明确报错并指出原图路径。两张图与请求记录完整保留，恢复时沿用这套 Node／Sharp 双背景流程。

## 配置覆盖与旧键迁移

同名 shell 变量优先于 `.env`，优先级按每个键分别计算。LLM 选择顺序为：统一职责键 `layering_agent_<职责>_model` → 同职责下取值一致的旧小步骤键 → 已填写的旧 medium／high 键 → 代码默认值。生图选择顺序为：步骤生图键 → 全局默认生图键 → 旧生图 API 配置的兼容默认 → `codex-native`。修改全局默认时检查已有步骤覆盖，用 `pnpm env:check` 查看最终结果。

旧 `layering_<小步骤>_model` 在同一职责的已填写值一致时继续读取；取值冲突时，明确填写对应的统一职责键。旧 `layering_high_model` 对应两套 raster 的 step01、review／返修与 step02，`layering_medium_model` 对应其余职责，这一兼容映射保持原有含义。

part 遮挡补全分别使用 `layering_part_completion_image_model` 和 `layering_clothing_completion_image_model`。已有配置从 `layering_part_outline_image_model`／`layering_part_outline_repair_image_model` 迁到人物补全键，衣服的对应旧键迁到衣服补全键，保留原选择的生图模型并删除旧键。旧绘制与返修值不一致时先确认补全使用哪一个，不自动替用户选择。

独立 raster reviewer 使用 `layering_agent_raster_step01_review_model`；返修与绘制共用 `layering_agent_raster_step01_model`。原 `layering_agent_raster_step02_review_model` 配置需迁移为新的 step01 键；各自独立的生图键同样从 `raster_step02_review/repair` 改为 `raster_step01_review/repair`，衣服带 `clothing_` 前缀。模型、力度和生图选择保持可自定义，见 [example.env](../example.env)。

## 会话与记录

Codex、Claude／agv 共用 `<步骤>/workspace/` 工作区，中间文件在其内部自由组织。暂不设写入沙箱，各 CLI 均以完全访问权限运行，写入范围由提示词与工具路径约定管理。请求配置、日志和 CLI 私有会话数据在管线的 `agents/` 下；鉴权复用用户环境，不修改全局配置。同一步骤续跑复用工作区；恢复同一 session 时复用原私有会话数据，切换 CLI 或重建会话仍保留已有产物。Antigravity 的 GenAI 自定义网关会转发原始工具定义，并保留工具返回的图片。

所有管线的 agent 步骤共用同一套会话记录：`<管线>/agents/steps/<步骤>/session.json` 保存 ID 和 harness，替换或清除时旧记录追加到同目录的 `session.json.history.jsonl`。part 轮廓绘制与返修共用 `agents/steps/step09_outline/<组路径>/session.json`，补全会反复修改草稿，记在 `agents/steps/step11_completion/<组路径>/session.json`（子组路径为 `<父>/children/<名>`）；raster、组装记在 `agents/steps/<stepNN>/session.json`，阴影记在 `shadow/agents/steps/step01_<模式>/session.json`，同一步骤的绘制与返修共用。独立 reviewer、去重和子组分析等一次性 agent 每次新建，不记录 ID。

每个步骤新建自己的 thread：Codex 恢复 thread 时沿用创建时的工具定义，不接受新工具。重试步骤会连同 `agents/steps/<步骤>/` 一起清除会话。布局转换删除旧任务 `run.json` 中的 `threadId`／`threadHarness`／`threadStep`／`threadHandoff`，不迁移，转换前的会话不再续接；`.running`／`.completed`、两轮 review 和产物检查规则不变。

同一 CLI 内改变模型或力度继续恢复原会话。Codex 的生图模型改变时，重启本请求的原生通道并恢复原 thread，已有产物保留。切换 CLI、以 `--resume`（网页“恢复”）清除会话或会话不可用时新建会话，旧请求记录与产物保留，ID 替换写入历史；不要手动删除会话 ID。新会话读取已有输入、产物及反馈继续。缺产物的正常退出仍报错并展示最后消息，不增加自动空产物重试。

旧 `layering_image_compact_threshold` 仅作用于 Codex，沿用原生带图压缩补丁。新增各 CLI 独立的图片数和请求体 MiB 预算，可按实际路由开启；留空保持原行为。AGV／Claude 接入补丁复用同一视觉压缩模块，原生自动压缩仍保留。配置和恢复边界见 [图片容量保护](../patches/README.md#图片容量保护)。
