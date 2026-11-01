# 人物栅格分层与修画

读取同名人物 part 的轮廓、参考、分组与深度，在 Krita 中交付三步工程。模型按职责读取 skill 的 `.env`，默认值见 [模型方案](../references/model-presets.md)；启动环境见 [setup](../references/setup.md)。

## 单独运行本 section

从 skill 根目录执行：

```sh
pnpm raster-layering --name my-character --krita /绝对路径/krita --knowledge /绝对路径/knowledge
# 续跑同样带 --krita 与 --knowledge（独立 section 不保存配置）
# 自定义运行根目录时，首次与续跑均追加 --dir
pnpm raster-layering --name my-character --dir /绝对路径/运行根目录 --knowledge /绝对路径/knowledge --dry-run
# 单独核对指定 Krita 入口
pnpm raster-layering --check-krita --krita /绝对路径/krita
```

数据位于 `<dir>/<name>/raster-layering/`，上游读取相邻 `part-layering/`。每次启动（含续跑）都传 Krita 的实际可执行文件与 `--knowledge` 先验知识目录，本 section 不保存配置；相对输入从 `<dir>/<name>/` 解析。`--dry-run` 检查输入、Krita 与待执行提示词，保持任务文件原样。真实绘制还需要可用显示与操作环境，桌面和 headless 检查见 setup。独立调试前先停止同任务总调度。

三步都在本 section 的私有 Krita 中操作：工作流只准备环境并占名额，agent 通过 `krita` 工具自行启动，section 结束时关闭；私有进程、并发名额与显示见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。

## 三步交付

| 步骤 | 职责与提示词 | 必需成果 |
| --- | --- | --- |
| step01 | [分层与补全](../knowledge/raster-layering/step01/prompts/01-分层与补全.md)，[review](../knowledge/raster-layering/step01/prompts/01-review.md) 与[返修](../knowledge/raster-layering/step01/prompts/01-repair.md) | `character-depth.kra`、`report.md` 与实际执行的 review／repair 报告 |
| step02 | [边缘精修](../knowledge/raster-layering/step02/prompts/02-边缘柔化与去锯齿.md)，逐层自检 | `character-soft-edges.kra`、同名 PNG、`report.md` |
| step03 | [去除临时连体服](../knowledge/raster-layering/step03/prompts/03-去除连体服.md)，补全换装身体底层并自检 | `character-dressup-base.kra`、同名 PNG、`report.md` |

三步的 agent 都有 `krita` 工具；此外按环节注册的流程工具如下（生图工具按 harness 另行提供）：

| 环节 | 工具 |
| --- | --- |
| step01 绘制与返修 | `edit_groups`、`edit_occlusion` |
| step01 review | `annotate_review_regions` |
| step02 绘制 | `locate_pixel_differences` |
| step03 | 无 |

`locate_pixel_differences` 传 `parts` 时须同时给 `layers`：保存当前 KRA 后用 `krita` 工具导出的 `.ora`，早于 KRA 最后保存会报错。step01 交付时的结构诊断失败只记为“结构检查提示”，不阻止完成，见 [shared](../shared/README.md#多深度与上游修正)。

素体未换装（见 [总控](../workflow/README.md#姿态与参考)）时，step03 不调用 agent，直接把 step02 的 KRA 与 PNG 复制为 step03 成果，并标记为已完成。

每步从上一步成果另存到自己的 stepNN 目录，保留原尺寸、各阶段工程和报告。step01 按完整轮廓逐件生图、配准、补全和修画，对可见形体、画风、隐藏结构及接缝负责；通过 `edit_groups`、`edit_occlusion` 校验并保存分组、归属与深度修正，同步对应上游和当前工程。一个逻辑 part 可有多个绘画深度，实际拆层与指纹同步见 [shared](../shared/README.md#多深度与上游修正)。

step01 reviewer 看图确认确定问题，通过 `annotate_review_regions` 生成带编号框、图层说明与同坐标局部对照。可使用本部件自己的原图可见像素覆盖，补绘与覆盖区靠画笔修自然，其他部件的像素各自保留归属。

step02 沿用已确认结构，用 `locate_pixel_differences` 候选框引导细节检查，并逐层扩展观察全部部件；局部修边缘、残色、锯齿、接缝、描边与瑕疵，保持图层结构和原有光影。step03 先标记涉及连体服的 part，再参考已有皮肤补构型与肤色，保留身体轮廓与换装需要的覆盖范围。

每步交付包含保存、重新打开、逐层显隐与合成核对；记录实际修改、检查和剩余问题。程序校验文件，艺术质量由实际观察确认。

## step01 审核与修复

同一步骤的绘制与返修共用 `agents/steps/<stepNN>/session.json` 记录的 thread，进入下一步骤时新建 thread；reviewer 使用 `raster_step01_review_agent_model` 和独立新上下文。

1. 初次绘制交付后生成 `review-01.md`。通过则完成，有问题则由原绘制会话处理全部反馈，自检后发布 `repair-01.md`。
2. 首轮修复完成后执行 `review-02.md`。通过则完成，有问题则修复并发布 `repair-02.md`，随后进入 step02。

最多两轮质量 review，同一反馈可分多次修复调用。报告先写 `.tmp`，回合与必要交付检查成功后原子发布；review 首行为“结论：通过”或“结论：需要修复”，正式 repair 为“结论：已修复”。仍有问题的修复沿用暂存报告和原会话继续。step02、step03 使用各自绘制自检。

正式 Markdown 决定当前审核环节；调用日志与临时文件用于诊断。受阻、中断与临时服务重试保留当前进度，完成全部必要反馈后才发布 step01 的 `.completed`。

## 会话与恢复

本 section 没有自己的 `run.json`：Krita 路径由每次启动参数或总控传入（运行中的版本见 `krita` 工具状态与 section 的 `krita.json`），旧任务残留的该文件不再读取；各步骤的绘制 threadId 与 harness 记在 `agents/steps/<stepNN>/session.json`；每步 `.running`／`.completed` 记录交付状态。模型从本次启动的 `.env`／环境读取，每个步骤新建自己的绘制会话，从文件读取上一步的工程与报告。各 CLI 的历史与隔离请求目录保留，恢复规则见 [模型与会话](../references/model-presets.md#会话与记录)。

调用记录位于 `agents/steps/<stepNN>/`：绘制的完整展开提示词为 `prompt.md`、结果为 `result.json`，review／repair 按环节名保存 `review-01.prompt.txt`、`review-01.result.json`、`repair-01.prompt.txt`、`repair-01.result.json` 等；`attempts.jsonl`、`events.jsonl` 和 `error.txt` 记录调用与故障；总日志在任务根 `workflow.log`。 CLI 在 `stepNN/workspace/` 中运行，绝对／相对路径约定见 [工作区与产物](../shared/README.md#工作区与产物)。模板维护见 [shared](../shared/README.md#提示词模板与动态位置)。

| 情况 | 恢复行为 |
| --- | --- |
| `.completed` 与必要成果齐全 | 沿用该步骤 |
| `.completed` 但必要成果缺失 | 拒绝运行并列出路径；恢复文件或对该步骤重试 |
| `.running` | 保留工程，继续当前未完成环节与原会话 |
| 目录存在但缺少两个标记 | 删除该目录，建立新会话重跑本步 |
| 上游 part 步骤未完成 | 拒绝运行，不改动本管线 |
| 缺少上游或必要成果 | 报告具体路径，恢复文件或完成对应前置后续跑 |

普通中断按相同 name／dir 续跑。主动重做时先停止当前进程，使用网页“重试”或移除该步骤的完成标记；随后只重建该步骤目录；上游修正、前序工程和已完成的后续步骤保留，后续步骤不会自动重做。需要保留现有成果而更换损坏会话时，使用 `--resume`（网页“恢复”），见 [workflow](../workflow/README.md#恢复方式)。


入口是 [run.ts](run.ts)，步骤与交付定义为 [steps.ts](steps.ts)；共享 runner、输入、会话与审核位于 `shared/raster/`。本 section 单测使用模拟 App Server、真实提示词和临时文件，真实绘图在任务流程中验收。
