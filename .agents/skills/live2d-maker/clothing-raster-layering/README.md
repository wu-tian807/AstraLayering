# clothing-raster-layering

运行根目录默认是 `<仓库>/.run`，独立安装时为 `<skill上一级>/.run`；`--dir <绝对路径>` 可更换根目录，显式路径不再额外套 `.run`。下文 `<运行根目录>/<name>/` 为任务目录。后续管线和续跑使用同一 `--name` 与运行根目录；相对输入从该任务目录解析。模型在 skill 根目录的 `.env` 配置，默认值见 [example.env](../example.env) 与[模型方案](../references/model-presets.md)。

读取 [clothing-part-layering](../clothing-part-layering/README.md) 已完成的衣服 part，顺序生成衣服分层 KRA，完成最多两轮轮廓 review／修复，再精修柔边。最终美术交付为 `step02/clothing-soft-edges.kra`；报告、控制图和检查截图留作内部过程证据。

顺序调度、上游产物读取、会话及标记恢复使用 `../shared/raster/` 的公共实现；本目录保留衣服步骤定义和提示词。仅有两步，模型按职责读取 `.env`，默认值见 [模型方案](../references/model-presets.md)。

## 单独运行本 section

需要 Node 24.12+、pnpm、已安装的 Krita，以及所配置模型对应 harness（Codex、Claude Code 或 AGV）的 CLI 与登录；`krita` 等流程工具由工作流注册。先准备同名衣服 part 的轮廓、参考、分组与深度，停止同任务总调度，再从 skill 根目录执行本 section：

```bash
pnpm clothing-raster-layering --name jianma --krita /path/to/krita --knowledge /path/to/knowledge

# 续跑沿用绘制会话；独立 section 不保存配置，仍须带 --krita 与 --knowledge
pnpm clothing-raster-layering --name jianma --krita /path/to/krita --knowledge /path/to/knowledge
```

素体未换装（`dressed: false`）时总控把本管线记为“完成（跳过）”，见 [总控](../workflow/README.md#姿态与参考)；此时上游衣服 part 没有产物，单独运行会因缺少输入而失败。

按 `--name` 直接读取 `<运行根目录>/<name>/clothing-part-layering/` 的 parts、参考、groups.json 与 occlusion.json，不接受额外输入路径、不复制上游产物。缺失时列出具体路径，提示先执行对应上游管线或手动放置产物。

`--krita` 必须显式指定可执行文件，脚本只校验它，不下载安装或搜索路径。`--check-krita` 仅检查安装；`--dry-run` 检查路径和 Krita 并打印待执行提示词，不调用模型、不创建或重置任务文件。本 section 不保存配置，每次启动都要传 `--krita` 与 `--knowledge`；总入口由任务根 `run.json` 记录并传入。换输入应使用新名字。

生图按 [模型与通道](../references/model-presets.md) 选择宿主原生能力或自定义接口。订阅或 API、provider 与鉴权由所选 harness 的 CLI 配置，Claude／AGV 使用共享生图工具 `imagegen`。Krita 可执行文件由外部提供；工作流不启动 Krita，只准备私有配置、桥接插件与（Linux 无显示时）共享 Xvfb 并占用名额，agent 通过 `krita` 工具自行启动并以 Python 操作，section 结束时由工作流关闭，详见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。启用工具的配置项不保证服务端实际提供该工具；不可用时应明确受阻，不能生成完成标记。

## 两步制作

- **step01：分件生图、补全与拼装。** 根据 `../clothing-part-layering/parts/` 和深度表逐件制作 RGB 控制图，清掉生成输入中的遮挡物和其他部件，使用内置生图生成当前衣片。逐张检查、必要时重生，在 Krita 中配准、收边和修画，保存 `clothing-depth.kra` 与 `report.md`，再由独立 reviewer 检查轮廓、画风与补绘衔接，反馈交回绘制会话。
- **step02：边缘精修。** 将第一步工程另存为 `clothing-soft-edges.kra`，逐层处理锯齿、残色、过硬线条和补全接缝；保持画布、结构、名称、深度、薄纱透明度与开口。完成自检后交付，不另跑 reviewer。

纯衣服参考 `../clothing-part-layering/references/clothing.png` 是绘画标准，原穿衣角色用于理解穿插关系。单深度衣片对应一个完整绘画层，多深度 part 对应多个保持共同归属与连续性的绘画分片层，按深度排列，无蒙版、无子节点。已经拆开的前后衣片保留独立图层，即使共同运动也不合并。交付衣服分层，不制作身体装配或身体插层说明。

reviewer 每次新建上下文，读取当前 KRA、参考及已有正式 Markdown；不保存或恢复其 threadId。`review-01.md` 有问题时，原绘制 agent 必须全部解决并完成自检，才发布 `repair-01.md`，然后开始第二次 review。第一次无问题直接结束；第二次有问题也须全部修完，发布 `repair-02.md` 后结束，不再做第三次 review。

两次上限只针对 review，不限制解决同一份反馈的修复调用。无法解决或工具受阻时保留未完成状态。只有初次绘制和必要 review / 修复全部结束、KRA 及报告存在，才把第一步标记为 `.completed`。程序的文件检查不代替逐层看图和保存后重开核对。

## 文件与续跑

```text
<运行根目录>/jianma/clothing-raster-layering/
  step01/
    .completed                # 完成轮廓 review / 修复后写入
    clothing-depth.kra
    report.md
    review-01.md
    repair-01.md              # 有问题时才产生
    review-02.md              # 第一轮有问题且修完后才产生
    repair-02.md              # 第二轮有问题时才产生
  step02/
    .completed                # 边缘精修与自检完成
    clothing-soft-edges.kra
    report.md
```

各步还会保存实际提示词、请求事件、结果、错误及绘制中间文件。本 section 没有自己的 `run.json`，配置由每次启动参数或总控传入；各步绘制 threadId 与 harness 记在 `agents/steps/<stepNN>/session.json`。模型配置从 `.env`、环境变量及代码默认值读取；旧任务残留的 `clothing-raster-layering/run.json` 不再读取或改写。每步新建自己的绘制 thread，本步的绘制与所有修复在同一 harness 中持续使用它。

| 文件情况 | 下次同名启动 |
| --- | --- |
| `.completed` 存在 | 核对必要交付后沿用该步；交付缺失时拒绝运行并列出路径 |
| `.running` 存在 | 保留现有工程与日志，继续原绘制 thread 和未完成环节 |
| 步骤目录存在，两个标记都没有 | 清空该步目录，重置绘制 thread 后重跑 |
| `.running` 中某份正式 review / repair 被删除 | 从该环节接续，清除后续反馈记录，保留当前 KRA 与绘制 thread |
| 上游 occlusion 步骤未完成 | 拒绝运行，不改动本管线 |

`.running` 表示已开始但未完成，不表示系统进程仍在运行。报告先写 `.tmp`，只有模型回合成功、报告结论有效且交付检查通过后才发布正式 Markdown；日志和暂存文件不算完成事实。

先停止当前进程，再用重试重做某一步，不要手动删除标记。例如从第二步重新制作：

```bash
pnpm start --name jianma --retry --section clothing-raster-layering --step step02
```

这会保留第一步及上游产物，删除第二步目录、会话与 agent 尝试记录，下次运行时创建新绘制 thread。重试 `step01` 只重做第一步，已完成的第二步沿用。若只想继续修画，保留标记并同名启动即可。同一个名字一次只启动一个进程。

## 验证与代码入口

```bash
pnpm check
```

[steps.ts](steps.ts) 定义两步模型与输入输出，[workflow.ts](../shared/raster/workflow.ts) 顺序执行，[run-store.ts](../shared/raster/run-store.ts) 管理配置和标记，[review.ts](../shared/raster/review.ts) 调度新 reviewer 与原绘制会话。完整正文位于 [knowledge/clothing-raster-layering](../knowledge/clothing-raster-layering/)；review / repair 文件名由 `{review_round}` 给出，提示词不固定轮次。

自动测试模拟 App Server 响应，覆盖上游产物读取、路径补全、同线程续跑、两轮反馈全部修复及最终完成标记。

现已完成 [2026-10-19 真实实跑](https://github.com/wu-tian807/AstraLayering/blob/main/demos/jianma/clothing-raster-layering/README.md)：两步及两轮 review／修复结束，保存并重开核对 69 个普通绘画层，导出透明合成 PNG。该运行由外部交接接受前襟跨深度拆层及合理的色块修正，并使用专用 Codex 的临时图片计数压缩补丁；案例说明保留这些边界，关键 KRA 与过程图片可直接查看，LLM 中间记录保留本地。本次已接入通用多深度与 step01 拆层、写回协议；可选图片压缩功能现已接入，需显式配置并使用补丁版 Codex，见 [配置说明](../workflow/README.md)。

共享安装、路径规则、工具配置和临时错误恢复见 [live2d-maker 使用说明](../SKILL.md)。所有相对输入路径从 `<运行根目录>/<name>/` 解析；本管线管理自身步骤目录，step01 绘制／返修通过 `edit_groups`、`edit_occlusion` 校验并保存对应上游结构，工具失败会直接反馈到当前绘制会话。

多深度与工具协议见 [共享说明](../shared/README.md#多深度与上游修正)。step01 既处理已标注区域，也处理组装中新发现的跨深度；自行拆 KRA 层并记录映射，必要时局部补画，通常只需切分现有像素。后续步骤与 reviewer 保留这些分片，不将同一 part 的多层当作重复。

step01 重点修轮廓缺口、错位和明显画风差异，可用本部件原图可见像素覆盖来拟合，不能串入其他部件；补绘和覆盖间接缝用画笔修自然。step01 的优化主要依靠 reviewer 的框选结果：reviewer 看图确认形体、画风和衔接问题，用框选工具标记位置、相关图层并生成局部对照，绘制者按编号返修。step02 先把整套衣服与参考并排看，列出衣片瑕疵、接缝不足和画风差异的清单，再逐项在所属衣片上用 Krita 修画；结论靠看图，不做像素差异比对。模型配置见 [模型与 harness](../references/model-presets.md)，各步骤预览为最新保存 KRA 的合成画面。
