# 当前主工作流验证区

`outputs/` 只保存当前主工作流的分阶段实操结果、对应输入和验收状态。它用于验证 [workflows](../workflows/readme.md) 的提示词是否能稳定推进，不是最终成品画廊。

**首个完整生成结果已完成：阶段1—5已有产物，阶段5终稿已完成制作与独立审查返修复验。** 展示见[左右对比与完整部件树](../demos/first-complete-case/readme.md)，后续问题与方向统一记录在[开发进度](../workflows/开发进度.md)。阶段6尚未制定或执行。

## 案例索引

| 案例 | 当前状态 | 入口 |
| --- | --- | --- |
| case1_miku | 首次完整生成，阶段1—5产物保留 | 下方首例记录与[完整展示](../demos/first-complete-case/readme.md) |
| case2 | 已有参考和阶段1—2产物，本次一并归档 | [案例说明](./case2/readme.md) |
| case3_miku_v2 | 线稿参考与色盘复测，已到阶段4；阶段5待跑，头脸几何仍需修正 | [产物与参考](./case3_miku_v2/readme.md)、[尝试与问题记录](../analysis/case3-miku-v2-review/readme.md) |

2026-09-14：原根目录下的`step02-base-character`、`step03-base-character`和`step04-base-character`已移入`case3_miku_v2`。本轮新增的线稿和色盘也归入该案例，首例正式产物保持原样。

## 首例验证：基础连体服角色

| 内容 | 文件 | 状态 |
| --- | --- | --- |
| 原始输入 | [references/original-input.jpg](./case1_miku/references/original-input.jpg) | 整条流程最初的角色参考，作为前置0平涂生成的输入 |
| 平涂角色图（前置0输出） | [references/flat-color-output.jpg](./case1_miku/references/flat-color-output.jpg) | 保留原服装的平涂结果，作为前置2服装替换的角色输入 |
| 基础角色彩图（前置2输出） | [references/base-character.png](./case1_miku/references/base-character.png) | 换上基础连体服后，作为主流程阶段1、阶段2共同的形状与遮挡依据 |
| 已确认的部件色块图（前置3输出） | [references/part-colors.jpg](./case1_miku/references/part-colors.jpg) | 提供可见部件归属，不表示深度或隐藏形状 |
| 阶段1 | [01_基础角色与补全范围.md](./case1_miku/step01-base-character/01_基础角色与补全范围.md) | 通过，提供关键点与补全范围 |
| 阶段2 | [02_完整部件与遮挡.svg](./case1_miku/step02-base-character/02_完整部件与遮挡.svg)、[02_结构检查.png](./case1_miku/step02-base-character/02_结构检查.png) | 阶段2历史快照，已继续推进至阶段5；该轮搭接记录和早期造型偏差供后续追溯 |
| 阶段2外观核对 | [02_参考图叠加对照.png](./case1_miku/step02-base-character/02_参考图叠加对照.png) | 用户提供的 SVG 与参考彩图叠加截图，直观展示轮廓吻合度 |

阶段2已保留完整头脸、后脑发体与衣下身体，当前姿态下的组合和拆层基本成立。该轮曾记录发顶黄色刘海与青色侧发交界露出少量红色脸底，并将马尾回环、发梢、手足曲线转入阶段3精修。这段描述保留阶段2当时的状态；当前完整结果与不足见下方阶段5及终稿复核，历史SVG保留原样。

四格检查图从同一份 SVG 渲染，分别查看整体、身体、完整头脸与发束拆件。后续结果仍需同时核对合成外观与独立部件，不能只凭 SVG 语法有效就宣布通过。

本次运行环境、模型强度与阶段耗时记录在 [工作流 README](../workflows/readme.md)。

## 线稿、平涂与彩图验证

首例的参考、阶段规划和阶段1—5产物现已统一收纳在`outputs/case1_miku/`；各阶段继续使用独立子目录，避免与后续案例混放。

| 内容 | 文件 | 本轮复核状态 |
| --- | --- | --- |
| 阶段3最终线稿 | [03_完整分层线稿.svg](./case1_miku/step03-base-character/03_完整分层线稿.svg) | 已生成；手部、耳机和鬓发仍存在局部贴合偏差，此前通过结论不覆盖这些新确认的问题 |
| 阶段4平涂 | [04_完整分层平涂.svg](./case1_miku/step04-base-character/04_完整分层平涂.svg)、[04_填色检查.png](./case1_miku/step04-base-character/04_填色检查.png) | 基础填色符合本轮平涂范围；既有局部贴合问题保持开放，非整稿无遗留通过 |
| 阶段5 step1 | [05-1_大明暗与体积.svg](./case1_miku/step05-base-character/05-1_大明暗与体积.svg)、[05-1_明暗检查.png](./case1_miku/step05-base-character/05-1_明暗检查.png) | 主要接缝已修正；原稿留存，双手的局部明暗在step2副本中进一步回修 |
| 阶段5 step2终稿 | [05-2_局部色彩与材质.svg](./case1_miku/step05-base-character/05-2_局部色彩与材质.svg)、[05-2_细节与材质检查.png](./case1_miku/step05-base-character/05-2_细节与材质检查.png) | 已完成制作、独立审查及返修复验；脸部等主要彩图表现成立，既有造型和部分色面／全图线色差距保持开放 |

2026-09-12：按用户要求，先记录既有问题，暂不修复源SVG。用户指出早期部件图没有五官，使耳机侵占眼角附近空间不易被察觉；补出五官后应连带核对耳机、鬓发与脸廓。详见[局部贴合问题记录及同坐标对照](../analysis/base-character-fidelity-review/局部贴合问题记录.md)。

2026-09-13：[阶段5终稿复核与链路分析](../analysis/stage5-final-review/2026-09-13_阶段5终稿差异与流程链路分析.md)补入4张用户原截图和实际头发取色，按9项问题定位阶段：局部线稿与配件构造主要追溯阶段2／3，虹膜上下色域、头发颜色与投影关系主要对应阶段5。整体形体保持较好。阶段6尚未执行；历史诊断副本不是正式产物。

## 目录边界

- 已整理的 SVG 展示与画法对比放在 [demos](../demos/readme.md)。
- 早期失败的 step01、step02 放在 [output_bad_cases/001](../output_bad_cases/001/readme.md)。
- Suzuran 绘画策略分析、清线实验和预览器检查放在 [analysis](../analysis/readme.md)。
- 临时渲染脚本、缓存和重复试画不作为新的正式阶段结果混入这里。
