# Milly v1：自动调度完整流程

2026-09-20归档。已完成参考准备、阶段1—5绘制和四个指定节点的独立审查。用户反馈：限制前置生图worker自行检查和反复重生后，这轮执行明显顺畅。

## 本轮运行记录

| 项目 | 本轮记录 |
| --- | --- |
| 完整运行耗时 | 约2小时50分钟 |
| 额度消耗 | Pro5x约10%额度 |
| Token消耗 | 约5kw token |

以上为用户提供的本轮实测估算，作为完整运行的投入参考，不代表每个角色的固定成本；额度周期及token统计口径未细分。

## 参考与产物

主参考及正式SVG均为1024×1536。最终SVG保留17个角色部件归属，背景另计。

| 内容 | 文件 |
| --- | --- |
| 前置角色简化 | [简化角色图](./references/flat-color-output.png) |
| 主参考 | [基础角色彩图](./references/base-character.png) |
| 辅助参考 | [部件色块](./references/part-colors.png)、[线稿](./references/line-art.png)、[色盘PNG](./reference-palette/color-palette.png)、[色盘JSON](./reference-palette/color-palette.json) |
| 阶段1 | [基础角色与补全范围](./step01-base-character/01_基础角色与补全范围.md) |
| 阶段2 | [完整部件与遮挡](./step02-base-character/02_完整部件与遮挡.svg)、[检查图](./step02-base-character/02_结构检查.png) |
| 阶段3 | [五步产物目录](./step03-base-character/)、[完整分层线稿](./step03-base-character/03_完整分层线稿.svg)、[检查图](./step03-base-character/03_线稿检查.png) |
| 阶段4 | [完整分层平涂](./step04-base-character/04_完整分层平涂.svg)、[检查图](./step04-base-character/04_填色检查.png) |
| 阶段5 step1 | [大明暗与体积](./step05-base-character/05-1_大明暗与体积.svg)、[检查图](./step05-base-character/05-1_明暗检查.png) |
| 阶段5 step2 | [局部色彩与材质终稿](./step05-base-character/05-2_局部色彩与材质.svg)、[检查图](./step05-base-character/05-2_细节与材质检查.png) |

## 独立审查记录

以下结论来自本轮已有review报告；归档时核对了报告中的候选SHA-256与实际SVG，四项一致。

| 节点 | 最终记录 | 本轮处理的问题 |
| --- | --- | --- |
| 阶段2 | [v2通过](./step02-base-character/review-evidence-v2/review.md) | 收回左上顶发外缘，恢复翘发环内空隙 |
| 阶段3 step2 | [v2通过](./step03-base-character/review-step2-evidence-v2/review-report.md) | 修正右侧卷发内线穿过前景分界形成的交叉 |
| 阶段4 | [v1通过](./step04-base-character/review-evidence-v1/review-report.md) | 基础配色、部件归属及线稿保留通过 |
| 阶段5 step1 | [v5通过](./step05-base-character/review-step1-evidence-v5/review.md) | 消除双踝新增的硬弧暗带，保留连续转面 |

阶段5 step2按现行流程由worker自查，未另设独立review。各review通过范围以原报告为准。

## 归档观察与遗留项

本次查看了基础彩图、终稿的实际渲染与最终检查图。整体姿态、头身关系和主要轮廓保持较好，眼部层次、反光和局部肤色已经补上，具备完整彩图的观感。头发内部线条与发梢仍比参考更硬、分段更明显，发色的明暗和光泽较简化；膝部、指趾等局部墨线也仍有差异。后续可按线稿与材质分别研究，本次保留原作品。

终稿已有`05-2`元数据，但根`title`／`desc`仍沿用阶段4平涂描述。这是文件说明的遗留项，归档时未改写已生成SVG。

## 归档来源

原`working/`的324份文件已整体移入本目录，包含全部参考、正式阶段产物、review报告和证据，移动前后逐文件SHA-256一致。详见[归档清单](./归档清单.json)。本轮参考目录保存的是四张前置结果，最初原画与服装复用素材不在这份`working/`快照内。

原报告和诊断JSON中的绝对路径保留生成时记录；原`/Users/wutian/Desktop/coding/AstraLayering/working/`对应本目录。历史review证据对应各自候选，不等同于当前最终版本。

使用现有[SVG预览器](../../loading/svg-preview.html)加载本轮彩图与SVG进行对比。返回[案例索引](../readme.md)。
