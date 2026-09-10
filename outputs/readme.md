# 当前主工作流验证区

`outputs/` 只保存当前主工作流的分阶段实操结果、对应输入和验收状态。它用于验证 [workflows](../workflows/readme.md) 的提示词是否能稳定推进，不是最终成品画廊。

## 当前验证：基础连体服角色

| 内容 | 文件 | 状态 |
| --- | --- | --- |
| 基础角色彩图 | [references/base-character.png](./references/base-character.png) | 阶段1、阶段2共同的形状与遮挡依据 |
| 已确认的部件色块图 | [references/part-colors.jpg](./references/part-colors.jpg) | 提供可见部件归属，不表示深度或隐藏形状 |
| 阶段1 | [01_基础角色与补全范围.md](./step01-base-character/01_基础角色与补全范围.md) | 通过，提供关键点与补全范围 |
| 阶段2 | [02_完整部件与遮挡.svg](./step02-base-character/02_完整部件与遮挡.svg)、[02_结构检查.png](./step02-base-character/02_结构检查.png) | 基本通过，存在一个局部搭接待修；尚未进入精修线稿 |

阶段2已保留完整头脸、后脑发体与衣下身体，当前姿态下的组合和拆层基本成立。待修项是发顶黄色刘海与青色侧发交界露出少量红色脸底；马尾回环、发梢、手足的曲线精修留到阶段3。本次整理保留了被评审的 SVG 原样。

四格检查图从同一份 SVG 渲染，分别查看整体、身体、完整头脸与发束拆件。后续结果仍需同时核对合成外观与独立部件，不能只凭 SVG 语法有效就宣布通过。

## 目录边界

- 已整理的 SVG 展示与画法对比放在 [demos](../demos/readme.md)。
- 早期失败的 step01、step02 放在 [output_bad_cases/001](../output_bad_cases/001/readme.md)。
- Suzuran 绘画策略分析、清线实验和预览器检查放在 [analysis](../analysis/readme.md)。
- 临时渲染脚本、缓存和重复试画不作为新的正式阶段结果混入这里。
