# 绘画分析与辅助实验

这里保存从旧 `outputs/` 移出的分析和独立实验。它们可为流程设计提供依据，但不是当前主工作流的阶段产物，也不自动构成验收标准。

| 目录 | 用途与入口 |
| --- | --- |
| [suzuran-analysis](./suzuran-analysis/) | [绘画策略分析](./suzuran-analysis/绘画策略分析.md)、[源 SVG](./suzuran-analysis/source.svg)、统计脚本与证据；其中的通用提示词保留为历史讨论材料 |
| [color-line-cleanup](./color-line-cleanup/) | 针对一张特定标记图的去色、清线实验；查看 [对照图](./color-line-cleanup/comparison.png) 和 [process.py](./color-line-cleanup/process.py)，不作为通用人体分割方案 |
| [svg-preview-tests](./svg-preview-tests/) | [预览器交互检查页](./svg-preview-tests/checks.html)，验证分组、显隐、缩放等行为；使用本目录下归档的 Suzuran 源文件作为样本 |

SVG 显示实验只是对既有图形的显隐或描边调整，不能据此还原作者的真实绘制历史。

检查页需要同源访问 iframe。可在仓库根目录运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/analysis/svg-preview-tests/checks.html`，点击“运行交互检查”。

返回 [主工作流](../workflows/readme.md) 或 [当前验证区](../outputs/readme.md)。
