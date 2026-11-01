# character-assembly

在人物和衣服 raster 都完成后，用一个绘制 agent 将两份 KRA 组装成穿戴工程，尽可能贴近简化穿衣角色参考。读取 skill 根目录 `.env` 的 `assembly_agent_model`，默认值统一见 [模型方案](../references/model-presets.md)，组装后由绘制者自检。

## 单独运行本 section

先准备下表中的人物 KRA、衣服 KRA 与简化穿衣参考，再从 skill 根目录执行。同任务的总调度先停止，保持单一执行入口。该命令调用组装模型并保存穿戴成果：

```bash
# 先检查输入、Krita 和提示词
pnpm character-assembly --name jianma --krita /绝对路径/krita --knowledge /绝对路径/knowledge --dry-run
# 开始组装
pnpm character-assembly --name jianma --krita /绝对路径/krita --knowledge /绝对路径/knowledge
# 续跑（独立 section 不保存配置，仍须带 --krita 与 --knowledge）
pnpm character-assembly --name jianma --krita /绝对路径/krita --knowledge /绝对路径/knowledge
# 自定义运行根目录时，首次和续跑均加 --dir
pnpm character-assembly --name jianma --dir /绝对路径/运行根目录 --krita /绝对路径/krita --knowledge /绝对路径/knowledge
```

默认任务目录是 `<仓库>/.run/<name>/`，独立安装时为 `<skill上一级>/.run/<name>/`；显式 `--dir` 则使用 `<dir>/<name>/`。本入口只读取同名任务的这三个输入，不复制文件，不自动运行上游：

| 输入 | 任务目录内的位置 |
| --- | --- |
| 人物素体 | `raster-layering/step03/character-dressup-base.kra` |
| 衣服终稿 | `clothing-raster-layering/step02/clothing-soft-edges.kra` |
| 简化穿衣参考 | `part-layering/references/simplified-subject.png` |

素体未换装时不需要衣服终稿：step01 不调用 agent，直接复制人物 KRA 与 PNG 为 `character-assembled.*`；旧任务若已画出衣服，仍按原输入组装。

缺少文件时，终端给出对应上游命令与手动放置的具体路径。可用完整成果归档作为输入，不要求搬入上游的 agent 会话或状态标记。

[完整绘制提示词](../knowledge/character-assembly/step01/prompts/01-人物与衣服组装.md) 先对照简化穿衣参考，将整套衣装等比缩放、平移到人物的对应位置，再调整穿插与局部贴合。局部修画解决组装产生的边界和接缝问题；漏肤可用原生可关闭的透明度遮罩处理，保留透纱效果。已有部件的发色、材质、笔触和描边差异保留并记录。不随意拆分现有部件或新增绘画层，不覆盖两份输入工程。

`locate_pixel_differences` 的可选 `parts` 参数按当前 KRA 部件路径自动选择范围，包含后代与多个深度分片，范围随衣物缩放、位移和遮罩更新；无需手写框坐标。首次合成和最终保存重开后按衣物及接缝相关部件检查，整体穿戴关系由目视核对。部件路径可加 `character:` 或 `clothing:` 前缀限定来自人物或衣服工程。选择 `parts` 时必须同时传 `layers`：保存 KRA 后用 `krita` 工具导出的 `.ora`，早于 KRA 最后保存会报错；`part_padding` 默认 8 像素，用于检查部件周边的接缝与漏肤。`parts` 不填或空数组仍为全图检测；人物、衣服 step02 共用同一可选能力。工具同时输出检测范围预览和差异候选，候选由 agent 按本阶段职责判断。

CLI 在 `character-assembly/step01/workspace/` 中运行，提示词给出两份 KRA、参考图和输出目录的绝对路径，不含 Krita 路径；Krita 由本 section 的 `krita` 工具启动与操作，见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。交付位置：

```text
character-assembly/
└── step01/
    ├── character-assembled.kra
    ├── character-assembled.png
    ├── report.md
    └── .completed
```

报告简述调整、遮罩用途和剩余差异。绘制 agent 负责保存重开、检查图层及合成效果；调度器在交付齐全后写 `.completed`。

复用 raster 的顺序调度、临时错误重试、日志和异常说明。这个入口新建自己的绘制 thread，中断保留 `.running` 并恢复原 thread；已完成时跳过。需要重做时用 `pnpm start --name <任务名> --retry --section character-assembly --step step01`（或网页「重试」），清理组装步骤并重建 thread，保留上游工程。只有一个步骤，不调用第二个绘制者或 reviewer，也不提供上游深度修改工具。

`--dry-run` 检查上游和指定的 Krita、显示本次完整提示词，不调用模型、不写文件。配置与安装见 [SKILL.md](../SKILL.md)。
