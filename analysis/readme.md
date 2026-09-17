# 绘画分析与辅助实验

这里保存从旧 `outputs/` 移出的分析和独立实验。它们可为流程设计提供依据，但不是当前主工作流的阶段产物，也不自动构成验收标准。

当前已形成首次完整生成结果。整体评价与剩余误差见[阶段5终稿复核](./stage5-final-review/2026-09-13_阶段5终稿差异与流程链路分析.md#current-assessment)；按具体错误定位阶段的工作清单统一放在[开发进度](../workflows/开发进度.md)。耳机占位等早期误差与头发放大后的局部绘制问题分别追溯，不由问题数量推断整体还原度低。

| 目录 | 用途与入口 |
| --- | --- |
| [miku-v3-review](./miku-v3-review/) | [最新完整结果复核](./miku-v3-review/readme.md)：阶段1—5归档，脸缘与头型改善的同坐标证据，眼睑、手足及材质遗留问题；线稿独立审查与工作投入仅记录、未实施 |
| [case3-miku-v2-review](./case3-miku-v2-review/) | [本轮尝试与下一轮计划](./case3-miku-v2-review/readme.md)：已到阶段4，线稿与色盘的实际反馈，脸型／眼白问题追溯，阶段3五步拆分与阶段5待验证项 |
| [stage4-palette-demo](./stage4-palette-demo/) | [程序取色样例](./stage4-palette-demo/readme.md)：底色候选、明暗对照、来源局部与准确色值；已用于case3阶段4，用户反馈配色帮助明显 |
| [stage2-reference-retest](./stage2-reference-retest/) | [首次候选复核](./stage2-reference-retest/2026-09-13_新旧阶段2头发与发卡复核.md)与[新提示词第二次复测](./stage2-reference-retest/第二次复测/复核.md)：头部、马尾、发卡同坐标对照，记录改善、回退和脸型基准 |
| [part-color-review](./part-color-review/) | [首次优化复测](./part-color-review/2026-09-13_首次优化复测.md)：加长版提示词、用户实际结果与头发分区回退记录；后续精简版仍有部件逻辑不稳定的问题 |
| [stage5-final-review](./stage5-final-review/) | [阶段5终稿差异与流程链路分析](./stage5-final-review/2026-09-13_阶段5终稿差异与流程链路分析.md)：9项具体问题、4张用户原截图、头发实际取色与对应阶段；此前10组对照、几何继承和独立核验保留在[历史详细复核](./stage5-final-review/历史详细复核.md) |
| [base-character-fidelity-review](./base-character-fidelity-review/) | [局部贴合问题记录](./base-character-fidelity-review/局部贴合问题记录.md)：阶段4平涂复核、手部／耳机／鬓发的既有偏差，以及补五官后需连带复核相邻部件的改进方向；含参考、阶段3与阶段4的局部对照 |
| [suzuran-analysis](./suzuran-analysis/) | [绘画策略分析](./suzuran-analysis/绘画策略分析.md)、[源 SVG](./suzuran-analysis/source.svg)、统计脚本与证据；其中的通用提示词保留为历史讨论材料 |
| [physics-band-analysis](./physics-band-analysis/) | [线稿方法分析](./physics-band-analysis/线稿方法分析.md)：比较 baseline 的覆盖度轮廓与 physics-band 的共享节点线带，包含原文件、矢量放大图、接点与填色实验，以及阶段3、阶段4的适配判断 |
| [color-line-cleanup](./color-line-cleanup/) | 针对一张特定标记图的去色、清线实验；查看 [对照图](./color-line-cleanup/comparison.png) 和 [process.py](./color-line-cleanup/process.py)，不作为通用人体分割方案 |
| [svg-preview-tests](./svg-preview-tests/) | [预览器交互检查页](./svg-preview-tests/checks.html)，验证分组、显隐、缩放等行为；使用本目录下归档的 Suzuran 源文件作为样本 |

SVG 显示实验只是对既有图形的显隐或描边调整，不能据此还原作者的真实绘制历史。

检查页需要同源访问 iframe。可在仓库根目录运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/analysis/svg-preview-tests/checks.html`，点击“运行交互检查”。

返回 [主工作流](../workflows/readme.md) 或 [当前验证区](../outputs/readme.md)。
