# Expression workflow DSL 0.2

这是显式 DAG 工作流；编号目录只标明步骤归属，执行顺序由 `needs` 决定。定义格式为 YAML，机器 schema 是 [workflow.schema.json](../tools/workflow.schema.json)，解析、检查和状态恢复由 [workflow_plan.py](../tools/workflow_plan.py) 实现。

## 文件结构与数据引用

根对象包含 `schema_version: 0.2.0`、`document_type: expression_workflow`、`id`、`inputs`、`resources`、`models`、`tasks`。未知字段、重复 YAML key、未知引用和循环依赖均报错。

| 字段 | 含义 |
| --- | --- |
| `inputs` | 用户提供的 `file` 或 `text`，每项显式 required；缺失可选项解析成 null |
| `resources` | 相对技能根目录 workflow.yaml 的实际文件，限定在本技能内；不允许绝对路径、`..` 或符号链接越界 |
| `models` | 显式 model/reasoning_effort 配置，供 SKILL 的 agent 调度读取 |
| `tasks.<id>.needs` | 必须成功的上游任务；唯一执行顺序依据 |
| `tasks.<id>.inputs` | 绑定对象，使用下面三种引用；不隐式检索目录 |
| `tasks.<id>.outputs` | 相对运行根的路径及 file/directory 类型；不同任务不能拥有相同或嵌套输出 |
| `outputs.*.checks` | 对输出 JSON 应用已声明的本地 schema；目录输出需额外指定文件 path；可用capability_profile进一步检查跨字段能力 |
| `outputs.*.required_files` | 目录型输出中必须存在的文件，避免空目录冒充交付 |

三种引用没有字符串猜测：

```yaml
inputs:
  original: {input: base_svg}
  recipe: {artifact: author_boundaries.recipe}
  character: {artifact: prepare.prepared, path: character.svg}
  documentation: {resource: rig_contract}
```

`artifact` 的 producer 必须是任务 `needs` 的传递祖先。`path` 只允许目录型产物的成员。产物路径和成员路径不能为绝对路径或含 `..`，不能经符号链接逃出根；文件、目录和内容哈希都在记录时检查。源文件、配置、工具不允许被输出覆盖。

## 三种任务

`agent` 必须声明 `model`、`session`、`prompt`（resource id）。prompt 编写具体职责，计划器负责解析实际路径。`review` 还必须声明 `report`（本任务文件输出名）和 `repair`；reviewer session 不允许与上游作者相同。

`tool` 必须声明 `command`，runtime 只允许 `node` 或 `python3`，entry 只能是本技能根 `tools/` 或编号步骤 `<编号>.<名称>/tools/` 中的资源；跨步骤共用工具放根 tools，单步骤实现放各自步骤 tools。args 是数组，只有常量、`{input: <绑定名>}`、`{output: <输出名>, path: <可选目录成员>}`。没有 shell 模板、eval、goto 或任意代码 JSON。计划器只生成 `argv`，执行 agent 原样传给进程 API；不能把它合成未转义 shell 字符串。

工具使用本技能共享的 tools/svg-source.cjs 与 tools/svg-geometry.js 读取真实SVG，不依赖旧0.2变形器或外部svg_preview.py。各步骤只声明自己的实际依赖：盘点读取 SVG 工具与几何工具；编译额外读取本步骤编译器、共享 runtime 与两个 schema；扫描读取共享 runtime 与 rig schema，不加载编译器。共享 CLI/schema helper 也参与各工具签名。工具间接读取的求值器、运行适配器和 schema 同样以 `inputs.*: {resource: ...}` 声明，并参与签名。它们不需要追加到 argv 或让 agent 逐字读取；声明的作用是准确检测实现依赖变化，避免工具入口未变时复用旧生成结果。

```yaml
build_rig:
  kind: tool
  needs: [author_boundaries]
  inputs:
    svg: {artifact: prepare.prepared, path: character.svg}
    recipe: {artifact: author_boundaries.recipe}
  outputs:
    compiled: {path: compiled/rig, type: directory}
  command:
    runtime: node
    entry: build_tool
    args: [--svg, {input: svg}, --recipe, {input: recipe}, --out-dir, {output: compiled}]
  repair: {max_rounds: 2, targets: [author_boundaries]}
```

## 运行与记录

以下命令从skill目录执行，都显式绑定同一输入和运行根；`--text` 传文字，`--input` 传文件。Python API `Workflow(...).bind(...)` 也可用于现有调度器。状态文件只有调度控制器写，多个 worker 不并发改同一状态。

```bash
python3 tools/workflow_plan.py validate
python3 tools/workflow_plan.py plan \
  --run-root /absolute/output --input base_svg=/absolute/character.svg \
  --state /absolute/output/run-state.json --out /absolute/output/plan.json
```

不存在的 state 视为新运行。plan 不执行节点；`ready` 是现在可派发的任务，`waiting` 是有上游未成功，`succeeded` 是输入及产物仍匹配的已完成任务。按配置中 ready 工具的 argv 执行并取得真实成功退出码，或接收 agent 完整交付后记录：

```bash
python3 tools/workflow_plan.py record \
  --run-root /absolute/output --input base_svg=/absolute/character.svg \
  --state /absolute/output/run-state.json --task inspect --status succeeded
```

record 会检查依赖已经成功、输入成员实际存在、所有声明输出文件/目录及其 schema，再记录当前输入签名和产物哈希。不能提前 record 下游或用空路径当成功。工具退出码由调度器负责如实提供；文件校验不能证明它之前运行成功。

review report 使用 [review.schema.json](../contracts/review.schema.json)。`pass` 必须没有未解决 issues；`revise` 的每项 issue 包含 target、失败参数组合、SVG id、图像证据和具体建议；`blocked` 说明实际缺项。evidence 路径一律相对本轮 run root，记录器确认实际文件存在且没有越界。record review 的 `succeeded` 是“提交报告”，最终节点状态由报告 verdict 决定。

```bash
python3 tools/workflow_plan.py record \
  --run-root /absolute/output --input base_svg=/absolute/character.svg \
  --state /absolute/output/run-state.json --task scan_boundaries --status failed \
  --reason 'mouth.open=0.5, mouth.form=-1: lower lip crosses upper lip'
python3 tools/workflow_plan.py repair \
  --run-root /absolute/output --input base_svg=/absolute/character.svg \
  --state /absolute/output/run-state.json --task scan_boundaries --target author_boundaries \
  --reason 'Align the actual upper/lower contact edges at the failing combination'
```

## 返修与失效

`repair.targets` 只能指向本 gate 的上游 author agent；不能指向未来节点或执行任意跳转。review `revise` 要按报告指定的 target 集合返修，避免遗漏或扩大修改。每次 repair 消耗本 gate 的一个持久 round，最多 `max_rounds`（schema 上限 5，本流程用 2）。超限明确失败并交代具体原因，不偷偷重置计数。

返修清除目标与传递后继的成功记录，其他成功记录和产物原样保留。执行顺序仍然是同一个 DAG，repair 不添加循环边。旧候选目录可以供作者比较，但没有新的成功记录就不能向后发布。总控可以保存旧 review/recipe 到独立 `history/`，不将历史路径混入当前 artifact 引用。

续跑逐节点校验：任务定义、实际输入内容、prompt/工具/契约资源、模型配置、直接依赖产物及输出哈希。任何改变使对应任务及后继重新等待/执行；未受影响分支继续复用。失败或 blocked 状态不会自行重试，必须有明确 repair 记录。缺少有意义的进展条件时如实报告具体阻塞。

工具环境恢复、作者自身输出修正等不需要改上游的情况使用 `retry --task <id> --reason <实际变化>`。它只重开该 failed/blocked 任务及后继，不允许绕过 reviewer 的 revise（后者必须 repair）。任务必须声明 `retry: {max_rounds: 1}`，次数保存在同一 state 中，不能无限重试；用法与 repair 相同但不传 --target。

## 参数边界与真实视觉覆盖

工作流为 `inspect → scope → prepare → author_boundaries → build_rig → scan_boundaries → review_boundaries → deliver`。没有 compose、情绪预设、替换/附件或重复最终构建。角色 rig 使用 0.3 `boundary_recipe` / `boundary_rig`；本调度格式仍为 0.2。

标准流程必需 [basic-face-v1](basic-face-v1.md)：双眼开合/弧形、双眉高度/角度/弧形和嘴开合/形状共12轴。recipe/rig的profile可选以兼容历史局部试验；本流程在scope、recipe、compiled/final controls的 `checks` 中显式要求该profile。门禁校验每组恰有一个联合region、完整min/default/max和实际笛卡尔积。

```yaml
checks:
  - path: controls.json
    schema: controls_schema
    capability_profile: basic-face-v1
```

模型创作有限的参数边界：每轴 min/default/max，每眼联合open×curve，眉联合height×angle×curve，嘴默认联合创作 open=[0,1] × form=[-1,0,1] 六个形，程序插值半开用于九宫格审查。发现中间缺陷时才增加有依据的纠形关键点；不要求模型逐帧绘制。

review任务可以声明以下门禁，report_input必须是上游真实工具产物：

```yaml
review_boundaries:
  kind: review
  coverage:
    report_input: scan_report
    capability_profile: basic-face-v1
    controls_input: controls
  inputs:
    scan_report: {artifact: scan_boundaries.evidence, path: report.json}
    controls: {artifact: build_rig.compiled, path: controls.json}
```

指定capability_profile时必须同时指定controls_input。记录器对照真实controls验证全部联合作者格点的扫描覆盖，并要求scan capabilities包含12轴有效几何变化以及双眼闭合时curve的两项效果。渐变变化不计入几何实效；这些数值由运行内核计算，不能用作者声明填补。通用局部工作流可只声明report_input，但不得据此声称基本面部能力完成。

总览按20张分页，contact-sheet.png与后续分页仅用于定位，不能替代visual_cases原图。工具在完成原始帧后持久化scan-state.json（输入及帧SHA）；若仅总览/报告组装失败，按 [形变契约](../docs/boundary-rig.md) 的finalize命令恢复，在哈希不变且进程真实成功退出后再记录scan成功。缺少状态、输入或图像变动不能用恢复绕过重新扫描，也不能补造计时或美术通过。

扫描报告提供 `visual_cases` 数组，每项至少有 `id`、完整 `parameters`、相对报告所在目录的 `image`、`kind`。清单包括原中性、每轴min/max、相互影响轴的组合角点和内插中间值。扫描只生成证据，不能给美术pass。

review报告的 `checked_cases` 逐项绑定相同id/parameters，image改为相对本轮run root。每项写result和具体视觉观察；必须真实看过对应PNG。`continuous_review` 记录是否实际拖动、覆盖参数、真实证据与观察。记录器拒绝重复/未知case、参数错配、图像替换、缺图、pass缺case或缺连续审查。它只能验证证据和声明的一致性，不能代替reviewer判断美术。

例如扫描报告在 `evidence/boundaries/report.json`，其中image为 `frames/mouth_open_1_form_1.png`；review对应image应为 `evidence/boundaries/frames/mouth_open_1_form_1.png`，不能改用漂亮的中性总览图。

`revise` 可报告已经看到的失败case，无需为没有看完的范围伪造通过；返修只修改author_boundaries及其后继，不重跑原稿盘点。pass要求清单全部实际通过以及全部参数连续审查。交付只验证打包的加载/调参/复位，不再重复同一组完整审图。

原 SVG 恒等保留；准备报告changes/added_ids必须为空。同拓扑关键形保存坐标变化，默认恢复原稿，不新增器官，不修改睫毛束数，不以新洞替代变形。规格、作者recipe、运行controls、调度state与review报告分工独立。用户只调可用参数，技术上限和邻域约束由作者负责。
