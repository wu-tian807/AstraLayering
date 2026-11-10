# clothing-part-layering

启动条件见 [安装与前置](../references/setup.md)。Nano 生图的透明后处理使用 Node／Sharp 双背景差分，不要求 Krita、Python 或自动装包。已有参考续跑不重新处理；后续 raster 的 Krita 前置条件由其管线检查。

运行根目录默认是 `<仓库>/.run`，独立安装时为 `<skill上一级>/.run`；`--dir <绝对路径>` 可更换根目录，显式路径不再额外套 `.run`。下文 `<运行根目录>/<name>/` 为任务目录。后续管线和续跑使用同一 `--name` 与运行根目录；相对输入从该任务目录解析。模型表列出默认值，可在 skill 根目录的 `.env` 配置。

从**简化穿衣图和同一角色的素体图**提取互补的主体衣装，再生成可独立控制的衣服 part 色块及深度表，交给 [clothing-raster-layering](../clothing-raster-layering/README.md) 绘制分层 KRA。衣装保留原款式、局部比例与结构；整套衣装的大小和位置由后续组装适配人物。

调度、agent 适配及文件恢复使用 `../shared/` 的公共实现。本目录保留衣服 preparation、提示词和专项配置，不加载人物先验。各职责默认值与覆盖键以 [模型方案](../references/model-presets.md) 为准。

## 单独运行本 section

需要 Node 24.12+、pnpm，以及外部已配置好的 Codex。先准备同名人物 part 的简化穿衣图与素体图，停止同任务总调度，再从 skill 根目录执行本 section；制作结果保存在衣服 part 目录：

```bash
pnpm clothing-part-layering --name jianma --knowledge /绝对路径/knowledge

# 首次及续跑都通过任务名定位上游
pnpm clothing-part-layering --name jianma --knowledge /绝对路径/knowledge
```

preparation 使用当前配置的生图工具，将两张参考按顺序放入同一次请求；模型与接口配置见[模型与生图通道](../references/model-presets.md)。工具不可用或生成结果无效时明确失败，保留输入供重试，不以原图或脚本结果冒充生图。

总调度下，本管线在人物 part 的 preparation 完成后即启动，与人物线（人物 part 逐层制作 → 人物 raster）并行，共用整次运行的 `--jobs` 名额，见 [workflow](../workflow/README.md#总入口)；素体判断为 `dressed: false` 时整条管线记为跳过。单独运行时 `--jobs` / `-j` 设置本进程所有步骤共用的 agent 并发上限，默认 3；`--agents` / `-a` 是同义参数。`--max-depth 1` 只完成第一层并登记下一层，省略时一直拆到终止 part。`--groups <JSON路径>` 选择本任务已有的组及其子组；不导入新树、不重新 preparation，须有已完成的参考图和相应前置产物。

## 参考与拆分

1. 按 `--name` 读取同名人物 part 的 `references/simplified-subject.png`与 `references/base-subject.png`，以及 `references/standard.png`（决定统一画布尺寸并用于生成图后处理，其指纹写入 preparation.json），不保存输入副本。缺少时明确提示上游命令与手动放置的路径。使用 [preparation 提示词](../knowledge/clothing-part-layering/step01_preparation/prompts/preparation.md) 提取两图之间的换装衣物，生成统一画布尺寸的透明 `references/clothing.png`。保留衣料、衣服自身附件、薄纱及正常开口，补全遮住的衣料；允许整套衣装等比缩放和移动，衣片间的相对比例与连接保持一致。
2. 查看纯衣服图与原穿衣角色，按外到内检查结构、建立初始 group。纯衣服图是衣片轮廓与绘画标准，原角色用于判断穿插与随动关系。group 表示结构归属，包含关系和数组顺序不代表绘制深度。
3. 逐层执行轮廓绘制、review / 返修、同层去重、遮挡补全、自检及直属 group / part 分析。各父组补全、自检及直属拆分完成后，立即派发其子组描边与 review；下一层统一去重仍等待所有父组拆分结束、名单固定且全部轮廓就绪，再开始该层补全。实际结构决定拆分深度，提前派发遵守 `--max-depth` 和所选分支范围。
4. 合成 `preview.svg`，为所有终止 part 规划并逐件、逐区域检查深度，保存 `occlusion.json`。

绘制者在首次绘制或返修中发现当前组 `note` 的职责或层序说明有误时，可用 `update_group_note` 精确替换唯一匹配的原句。工具只修改本组说明，通过调度器共用的写入队列保存；下一次 review 和后续拆分读取更新后的说明。仅有说明问题时保持正确 SVG，不修改父组或分组树。

此流程的 SVG 是纯色轮廓控制图，review 检查形状、开口、覆盖和归属；配色、纹样、明暗、笔触和透明度表现由后续栅格流程绘制。若反馈混入成品绘画要求，返修者须逐项解释其不适用原因并保留正确色块，不把控制图改成绘画成品。

直属节点支持可选 `allowOutsideParent`（完整形体允许越出直接父轮廓）与 `hiddenInReference`（画布内仍需制作、因遮挡或闭合而整体不可见），省略均按 false。不可见节点使用空底稿直接生图辅助补全 SVG，跳过描边、轮廓 review 和可见轮廓去重，其余格式及归属检查保留。补全生图后使用 `preview_svg` 的 `edge`、`reference`、`referenceRegion` 核对生成图边缘，`referenceOffset` 可选；随后用默认参考图 `blend` 核对定位，并查看独显。`crop` 只控制最终查看窗口。需要的原生显隐蒙版关系由 raster step01 按 note 落实，后续阶段保留。

**独立运动、变形、显隐与控制是拆分的核心标准。** 还要判断一个实体是否需要分处其他部件的前后：若仍是同一运动整体，可保留一个逻辑 part，用多深度区域表达，由 raster step01 拆实际绘画层。开放袖口与衣领只是例子；依据当前衣服的真实结构判断，不机械地给每个开口分两半，不套固定衣服分类。相应职责从 group 的 `note` 传递到具体 part，不能只写在父组里而遗漏具体 part 的区域说明。

单深度 part 使用 level；同动整体跨深度时使用 levels 与文本区域说明，不退回上游拆组，不要求像素分界线。实际绘画分片由 raster step01 实现，不用蒙版伪装。这里输出衣服，不制作身体装配或单独的身体插层文档。

## 输出与恢复

运行目录固定为共享任务下的本管线目录，与启动时的工作目录无关：

```text
<运行根目录>/jianma/clothing-part-layering/
  step01_preparation/          # 生图原始结果与步骤记录
  references/
    clothing.png
  groups.json                  # 归属树视图，可编辑名称与 part 职责说明
  step08_initial/              # 首次分组
  step09_outline/<id>/         # 轮廓与复核；子组嵌套为 <id>/children/<名>
  step10_reduce/depthNN/       # 同层去重
  step11_completion/<id>/      # 补全与检查
  step12_children/<id>/        # 子组拆分
  parts/                       # 完整的分件 SVG，主要交接产物
  step13_merge/  step14_occlusion/  # 合并与遮挡规划的步骤记录
  observations/
  agents/                      # 请求、结果和恢复日志；绘制会话在 steps/<步骤>/session.json
  preview.svg
  occlusion.json               # 全部终止衣片从后到前的深度表
```

同名续跑复用输入与正式文件，不依赖最初的外部图片路径。已完成的 preparation 直接沿用，衣服图缺失时拒绝续跑并提示恢复文件或重试；上游参考重做不会让它自动重画。生成图须为统一画布尺寸且含实际透明区域的 PNG；尺寸与文件检查不代替模型的视觉判断，组装阶段负责衣装与人物的整体配准。

在停止当前进程后，删除 `references/clothing.png` 可重新生成衣服参考；下次启动会先清除依赖旧参考的分组、parts、阶段记录、观察图、预览和深度表。重新制作全部衣服时也可使用新的 `--name`。不要用同一个名字并发启动。

分件恢复与人物 part 相同：每个步骤按自己的 `.running`／`.completed` 标记继续或沿用；重试只重做所选步骤，已完成的下游步骤沿用。

## 验证与代码入口

```bash
pnpm check
```

[run.ts](../shared/part/run.ts) 串联 [preparation.ts](preparation.ts) 与共享 [layering.ts](../shared/part/layering.ts)；[agents.ts](../shared/codex/agents.ts) 和 [tool-agent.ts](../shared/codex/tool-agent.ts) 按各步骤配置的 harness（codex／claude／agv）运行，Codex 步骤经 Codex App Server（CLI 版本由 `@openai/codex-sdk` 依赖固定），见 [模型方案](../references/model-presets.md)。

首次分组和递归拆分分别在 [initial-groups.ts](../shared/part/initial-groups.ts)、[children-agent.ts](../shared/part/children-agent.ts)。

所有衣服提示词都在 [knowledge/clothing-part-layering](../knowledge/clothing-part-layering/)，各步骤由 `agent.json` 声明拼接的文件与工具。

共享测试覆盖衣服参考准备、分组调度与失败恢复。测试范围和历史案例见 [验证记录](VALIDATION.md)。

共享安装、路径规则、工具配置和临时错误恢复见 [live2d-maker 使用说明](../SKILL.md)。所有相对输入路径从 `<运行根目录>/<name>/` 解析；本管线只管理自身目录。
