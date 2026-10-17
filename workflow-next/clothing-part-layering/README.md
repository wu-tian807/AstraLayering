# clothing-part-layering

从**简化后的穿衣角色图**提取纯衣服，再生成可独立控制的衣服 part 色块及深度表，交给 [clothing-raster-layering](../clothing-raster-layering/README.md) 绘制分层 KRA。输入暂时固定为穿衣角色图，以保留衣服与角色身形、姿态和坐标的对应关系。

本目录独立持有从 `part-layering` 复制的 TypeScript 调度、Codex SDK / App Server 适配及文件恢复代码，不导入原流程实现，也不包含原流程的人体先验。所有文字 agent 使用 `gpt-6.1-sol / xhigh`。

## 启动

需要 Node 24.12+、pnpm，以及外部已配置好的 Codex。以下命令在仓库根目录执行：

```bash
pnpm --dir workflow-next/clothing-part-layering install --frozen-lockfile
pnpm --dir workflow-next/clothing-part-layering start --name test --image /path/to/simplified-character.png

# 续跑只需任务名，使用已经保存的输入
pnpm --dir workflow-next/clothing-part-layering start --name test
```

preparation 只使用 Codex 内置 `image_generation`。订阅、API、模型服务、鉴权以及该工具的实际可用性统一由外部 Codex 环境提供；工作流只启用和调用工具，不管理 provider、不直连生图 API、不注册替代生图工具。内置工具不可用或生成结果无效时明确失败，保留输入供重试，不以原图或脚本结果冒充生图。

`--jobs` / `-j` 设置所有步骤共用的 agent 并发上限，默认 3；`--agents` / `-a` 是同义参数。`--max-depth 1` 只完成第一层并登记下一层，省略时一直拆到终止 part。`--groups <JSON路径>` 选择本任务已有的组及其子组；不导入新树、不重新 preparation，须有已完成的参考图和相应前置产物。

## 参考与拆分

1. 将输入原样保存为 `references/simplified-character.<原扩展名>`，支持 PNG、JPEG、WebP。使用 [preparation 提示词](prompts/preparation.md) 去除人物和衣服之外的饰品，生成同画布的透明 `references/clothing.png`。保留衣料、衣服自带附件、薄纱及正常开口，补全被移除对象遮住的衣料；不移动、居中或重新设计衣服。
2. 查看纯衣服图与原穿衣角色，按外到内检查结构、建立初始 group。纯衣服图是衣片轮廓与绘画标准，原角色用于判断穿插与随动关系。group 表示结构归属，包含关系和数组顺序不代表绘制深度。
3. 逐层执行轮廓绘制、review / 返修、同层去重、遮挡补全、自检及直属 group / part 分析。完成当前层后继续下一层，实际结构决定拆分深度。
4. 合成 `preview.svg`，为所有终止 part 规划并逐件检查固定深度，保存 `occlusion.json`。

**独立运动、变形、显隐与控制是拆分的核心标准。** 还要判断一个实体是否需要分处其他部件的前后：此时即使共同运动，也必须拆成可以分别排序的衣片。开放袖口与衣领只是例子；依据当前衣服的真实结构判断，不机械地给每个开口分两半，不套固定衣服分类。相应职责从 group 的 `note` 传递到具体 part，不能只写在父组里而最后仍输出一个整体图层。

终止 part 必须能用一个固定深度表示。若发现上游漏拆，明确报告结构冲突；不能靠局部蒙版伪装成正确分层。这里输出衣服，不制作身体装配或单独的身体插层文档。

## 输出与恢复

运行目录固定在本模块内，与启动时的工作目录无关：

```text
workflow-next/clothing-part-layering/.run/test/
  references/
    simplified-character.png   # 扩展名随实际输入保留
    clothing.png
    preparation-prompt.md
    preparation.json           # 来源、生成图和提示词指纹；不保存鉴权
  groups.json                  # 归属树、part 职责及分析依据
  parts/                       # 完整的分件 SVG，主要交接产物
  stages/                      # 轮廓、检查及中间成果
  observations/
  agents/                      # 请求、结果和恢复日志
  preview.svg
  occlusion.json               # 全部终止衣片从后到前的深度表
```

同名续跑复用输入与正式文件，不依赖最初的外部图片路径。preparation 校验保存的输入与衣服图指纹，检测到被改写时拒绝静默沿用；生成图也须为原画布尺寸且含实际透明区域的 PNG。尺寸与文件检查不代替模型的视觉判断。

在停止当前进程后，删除 `references/clothing.png` 可重新生成衣服参考；下次启动会先清除依赖旧参考的分组、parts、阶段记录、观察图、预览和深度表。重新制作全部衣服时也可使用新的 `--name`。不要用同一个名字并发启动。

分件恢复沿用复制的文件事实机制：有效正式 SVG、报告及输入指纹决定哪些工作可复用；删除或修改上游轮廓会使其下游失效，只删除某件补全则只重新制作该件及实际引用它的依赖。深度表失效只重做最终深度规划。这里不使用栅格流程的 `step01/.completed` 标记。

## 验证与代码入口

```bash
pnpm --dir workflow-next/clothing-part-layering check
pnpm --dir workflow-next/clothing-part-layering test
```

[run.ts](run.ts) 串联 [preparation.ts](preparation.ts) 与本地 [layering.ts](layering.ts)；[agents.ts](agents.ts) 和 [tool-agent.ts](tool-agent.ts) 使用同版本 Codex SDK / App Server。首次分组和递归拆分分别在 [initial-groups.ts](initial-groups.ts)、[children-agent.ts](children-agent.ts)。所有衣服提示词都在本目录 [prompts](prompts/)。

自动测试覆盖 preparation 的内置工具请求、缓存及失败恢复、穿插衣片的独立产物、分组调度与依赖失效。模型响应使用测试替身，不构成实际生图或视觉质量验收。preparation 提示词沿用已人工认可的衣服提取试验；这套独立工作流仍需在配置好内置工具的环境中完成真实运行验收。
