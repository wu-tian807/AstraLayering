# clothing-raster-layering

读取 [clothing-part-layering](../clothing-part-layering/README.md) 已完成的衣服 part，顺序生成衣服分层 KRA，再进行边缘修画与最多两轮 review。最终美术交付为 `step02/clothing-soft-edges.kra`；报告、控制图和检查截图留作内部过程证据。

本目录独立持有从 `raster-layering` 复制的 TypeScript 调度、输入快照、会话及标记恢复代码，不导入原流程实现。仅有两步，绘制与 reviewer 均使用 `gpt-6-astra / xhigh`。

## 启动

需要 Node 24.12+、pnpm、已安装的 Krita，以及能提供绘制所需工具的外部 Codex 环境。在仓库根目录执行：

```bash
pnpm --dir workflow-next/clothing-raster-layering install --frozen-lockfile
pnpm --dir workflow-next/clothing-raster-layering start --name test --input ../clothing-part-layering/.run/test --krita /path/to/krita

# 续跑使用已保存的输入、Krita 路径和绘制会话
pnpm --dir workflow-next/clothing-raster-layering start --name test
```

`--input` 传分件运行根目录即可，自动使用其中的 `parts/`；也接受直接传 `parts/`。上述 `pnpm --dir` 会切换工作目录，所以输入相对本模块，也可直接使用绝对路径。首次将 `parts/`、参考图、分组、深度表和预览保存到任务的 `input/`。开始前应完成上游全部分件及深度规划；不要把 `--max-depth` 暂停后的部分结果作为成品输入。

`--krita` 必须显式指定可执行文件，脚本只校验它，不下载安装或搜索路径。`--check-krita` 仅检查安装；`--dry-run` 检查路径和 Krita 并打印待执行提示词，不调用模型、不创建或重置任务文件。已保存任务可显式更新 `--krita`；换输入应使用新名字。

生图只调用 Codex 内置 `image_generation`。订阅或 API、provider、鉴权及工具实际可用性由外部 Codex 配置；工作流不接管它们、不注册替代生图工具。Krita 的显示环境及 computer use / Python 操作能力也沿用外部执行环境。启用工具的配置项不保证服务端实际提供该工具；不可用时应明确受阻，不能生成完成标记。

## 两步制作

- **step01：分件生图、补全与拼装。** 根据 `input/parts/` 和深度表逐件制作 RGB 控制图，清掉生成输入中的遮挡物和其他部件，使用内置生图生成当前衣片。逐张检查、必要时重生，在 Krita 中配准、收边和修画，保存 `clothing-depth.kra` 与 `report.md`。
- **step02：边缘修画及 review / 修复。** 将第一步工程另存为 `clothing-soft-edges.kra`，逐层处理锯齿、残色、过硬线条和补全接缝；保持画布、结构、名称、深度、薄纱透明度与开口。初次绘制后由独立 reviewer 检查，再由原绘制会话解决反馈。

纯衣服参考 `input/references/clothing.png` 是绘画标准，原穿衣角色用于理解穿插关系。每个终止衣片对应一个完整绘画层，按深度排列，无蒙版、无子节点。已经拆开的前后衣片保留独立图层，即使共同运动也不合并。交付衣服分层，不制作身体装配或身体插层说明。

reviewer 每次新建上下文，读取当前 KRA、参考及已有正式 Markdown；不保存或恢复其 threadId。`review-01.md` 有问题时，原绘制 agent 必须全部解决并完成自检，才发布 `repair-01.md`，然后开始第二次 review。第一次无问题直接结束；第二次有问题也须全部修完，发布 `repair-02.md` 后结束，不再做第三次 review。

两次上限只针对 review，不限制解决同一份反馈的修复调用。无法解决或工具受阻时保留未完成状态。只有初次绘制和必要 review / 修复全部结束、KRA 及报告存在，才把第二步标记为 `.completed`。程序的文件检查不代替逐层看图和保存后重开核对。

## 文件与续跑

```text
workflow-next/clothing-raster-layering/.run/test/
  run.json
  input/
    parts/
    references/
    groups.json
    occlusion.json
    preview.svg
  step01/
    .completed
    clothing-depth.kra
    report.md
  step02/
    .running                  # 完成全部 review / 修复后改为 .completed
    clothing-soft-edges.kra
    report.md
    review-01.md
    repair-01.md              # 有问题时才产生
    review-02.md              # 第一轮有问题且修完后才产生
    repair-02.md              # 第二轮有问题时才产生
```

各步还会保存实际提示词、请求事件、结果、错误及绘制中间文件。`run.json` 只保存输入来源、Krita、模型配置和共用绘制 `threadId`，不保存步骤完成状态。两步绘制与所有修复持续使用同一 thread；中断续跑需要同一 Codex 环境保留该会话历史，恢复失败会报错，不静默换会话。

| 文件情况 | 下次同名启动 |
| --- | --- |
| `.completed` 存在 | 跳过该步；第二步还会检查正式 review / repair 是否齐备 |
| `.running` 存在 | 保留现有工程与日志，继续原绘制 thread 和未完成环节 |
| 步骤目录存在，两个标记都没有 | 清空该步及后续步骤目录，重置绘制 thread 后重跑 |
| 某份正式 review / repair 被删除 | 从该环节接续，清除后续反馈记录，保留当前 KRA 与绘制 thread |

`.running` 表示已开始但未完成，不表示系统进程仍在运行。报告先写 `.tmp`，只有模型回合成功、报告结论有效且交付检查通过后才发布正式 Markdown；日志和暂存文件不算完成事实。

先停止当前进程，再删除标记触发重跑。例如从第二步重新制作：

```bash
rm workflow-next/clothing-raster-layering/.run/test/step02/.completed
pnpm --dir workflow-next/clothing-raster-layering start --name test
```

这会保留第一步及输入副本，清空第二步目录并创建新绘制 thread。要从第一步重跑就删除 `step01/.completed`；未完成步骤也可删除其 `.running` 触发相同重置。重跑会删除对应步骤的工程和日志。若只想继续修画，保留标记并同名启动即可。同一个名字一次只启动一个进程。

## 验证与代码入口

```bash
pnpm --dir workflow-next/clothing-raster-layering check
pnpm --dir workflow-next/clothing-raster-layering test
```

[steps.ts](steps.ts) 定义两步模型与输入输出，[workflow.ts](workflow.ts) 顺序执行，[run-store.ts](run-store.ts) 管理配置和标记，[review.ts](review.ts) 调度新 reviewer 与原绘制会话。完整正文位于 [prompts](prompts/)；review / repair 文件名由调度器替换占位符，提示词不固定轮次。

自动测试模拟 SDK 响应，覆盖输入快照、路径补全、同线程续跑、删除标记重置、两轮反馈全部修复及最终完成标记。尚未用这套新流程实际跑完生图、Krita 绘制和视觉验收。
