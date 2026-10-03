# SVG 参数边界工作流

现在的工作流由模型设计有限的边界关键形，程序连续插值原 SVG 的相同路径。模型像 rig 作者一样调整闭眼、最大张口等极值和二维组合，不在运行时重画表情。**本阶段只验参数的可达范围，不制作情绪预设、替换或附件。**

```text
真实节点盘点与原稿渲染
  → 模型确定参数范围与完整运动区域
  → 原 SVG 恒等复制与素材能力记录
  → 模型手工设计 min/default/max 与二维/三维组合关键形
  → 程序编译同拓扑数值关键形
  → 程序渲染边界、组合角点与中间值
  → 独立逐 case 视觉审查 + 连续拖动（有限定向返修）
  → 可离线加载的 SVG + 参数 JSON + 作者关键形与证据
```

[workflow.yaml](workflow.yaml) 是调度权威，[SKILL.md](SKILL.md) 定义执行职责；[basic-face-v1](docs/basic-face-v1.md) 固定12轴基本面部能力；[形变契约](docs/boundary-rig.md) 定义 0.3 `boundary_recipe` 和 `boundary_rig`。调度 DSL 仍为 0.2，与角色 rig 版本分开。历史输出不覆盖、不自动迁移。

```text
执行 live2d-expressions skill 的 SVG 参数边界工作流。
角色 SVG：<完整分层 SVG 的绝对路径>
输出目录：<新的绝对输出目录>
原画参考：<可选>
需求：<可选，例如完整闭眼、足够大的张口、嘴型宽度与嘴角联动>
```

模型负责最大张口、闭眼接触、嘴型形状与邻域跟随；用户只调连续参数。标准能力是双眼各开合/弧形、双眉各高度/角度/弧形、嘴开合/形状。每眼采用二维、每眉三维、嘴二维的完整联合关键形；每轴的实际几何效果必须经工具验证，眼curve在闭眼时也不能失效。嘴至少联合创作开合与嘴型的二维关键形，眼睛的眼皮、阴影、睫毛和裁剪必须共同考虑。不能仅把睫毛压扁、单独移动唇线，或把范围缩到不可用来避开失败。

原 SVG 字节和结构始终不变。作者 JSON 只改变既有几何的坐标并保持拓扑；不增加器官，不补图，不修改设计好的睫毛束数。中性、每轴极值、二维角点和内插样本都会生成图像，独立 reviewer 必须逐项记录所见。数值合法和连续不等于美术通过。

工具归属见 [工具说明](tools/readme.md)：共享能力留根 `tools/`，盘点、编译、扫描分别在 `1.inspect`、`5.build-rig`、`6.scan-boundaries` 的 `tools/`；模型提示词也随步骤保存。参数预览由审查和交付共用，仍在 `tools/preview/`。

从本skill目录运行，依赖安装见 [tools/package.json](tools/package.json) 与 [tools/requirements.txt](tools/requirements.txt)。最小命令：

```bash
python3 tools/workflow_plan.py validate
python3 tools/workflow_plan.py plan \
  --run-root /absolute/output \
  --input base_svg=/absolute/character.svg \
  --text 'requirements=完整闭眼和足够大的二维嘴型范围' \
  --out /absolute/output/plan.json
```

计划器不会调用模型。调度 agent 根据 ready 节点的真实 prompt、输入和 argv 执行，使用 `record` / `repair` 留存结果。具体命令见 [DSL 文档](docs/workflow-dsl.md)。

交付目录包含 `character.svg`、`controls.json`、`authoring/`、`evidence/`、`preview/` 和 `acceptance.md`。controls 中不存在预设也应能正常加载；工作台显示连续参数、范围、原中性复位。试调数据不随游戏存档导出或同步。

维护检查：

```bash
python3 tools/tests/test_expression_workflow.py -v
```

夹具验证 DAG、路径、状态恢复、边界审查证据与有限返修，不能替代真实角色跑测。
