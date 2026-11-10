# Pink Doll：标准化、分层、穿戴组装与阴影成果

本例来自本地任务 `pink-doll`，启用姿态标准化。人物分件与栅格、衣服分件与栅格、穿戴组装及原生阴影蒙版均已完成；阴影于 2026-10-23 完成，物理未运行。这里按任务目录组织成果，保留完整分组树、深度表、SVG、七份关键 KRA、代表性过程图和验收报告。

人物有 **68 个节点、55 个叶子**，衣服有 **9 个节点、7 个叶子**。人物栅格工程有 58 个绘画层，衣服有 8 个；组装保留两者共 66 个原绘画层。阴影工程增加 4 条原生投影，保存后的检查通过且没有警告，详见各阶段报告。

[![输入原图、完整穿戴合成与原生图层立体拆解](../../showcase/pink-doll-reference-composite-exploded.png)](../../showcase/pink-doll-reference-composite-exploded.png)

左半展示原图与完整合成，右半将 66 个源绘画层组合为后发、完整人物、上衣、层叠裙和胸前蝴蝶结五组，沿纵深展示结构。

| 阶段 | 成果入口 |
| --- | --- |
| 输入与标准化 | [原图](input/original.jpg) · [标准化图](part-layering/references/standard.png) · [简化穿衣角色](part-layering/references/simplified-subject.png) · [人物参考](part-layering/references/base-subject.png) |
| 人物分件 | [SVG 预览](part-layering/preview.svg) · [分组树](part-layering/groups.json) · [深度表](part-layering/occlusion.json) |
| 人物分层补全 | [KRA](raster-layering/step01/character-depth.kra) · [工程内预览](raster-layering/step01/character-depth-snapshot.png) · [报告](raster-layering/step01/report.md) · [人工验收记录](raster-layering/step01/review-01.md) |
| 人物边缘修画 | [KRA](raster-layering/step02/character-soft-edges.kra) · [PNG](raster-layering/step02/character-soft-edges.png) · [报告](raster-layering/step02/report.md) |
| 换装素体 | [KRA](raster-layering/step03/character-dressup-base.kra) · [PNG](raster-layering/step03/character-dressup-base.png) · [报告](raster-layering/step03/report.md) |
| 衣服分件 | [纯衣服参考](clothing-part-layering/references/clothing.png) · [SVG 预览](clothing-part-layering/preview.svg) · [分组树](clothing-part-layering/groups.json) · [深度表](clothing-part-layering/occlusion.json) |
| 衣服分层补全 | [KRA](clothing-raster-layering/step01/clothing-depth.kra) · [工程内预览](clothing-raster-layering/step01/clothing-depth-snapshot.png) · [报告](clothing-raster-layering/step01/report.md) · [首次审核](clothing-raster-layering/step01/review-01.md) · [返修](clothing-raster-layering/step01/repair-01.md) · [第二次审核](clothing-raster-layering/step01/review-02.md) |
| 衣服边缘修画 | [KRA](clothing-raster-layering/step02/clothing-soft-edges.kra) · [PNG](clothing-raster-layering/step02/clothing-soft-edges.png) · [报告](clothing-raster-layering/step02/report.md) |
| 穿戴组装 | [KRA](character-assembly/step01/character-assembled.kra) · [PNG](character-assembly/step01/character-assembled.png) · [整体对照](character-assembly/step01/final-overall-comparison.jpg) · [报告](character-assembly/step01/report.md) |
| 阴影蒙版 | [最终 KRA](shadow/step01_mask/character-shadowed.kra) · [最终 PNG](shadow/step01_mask/character-shadowed.png) · [面部对照](shadow/step01_mask/face-review.png) · [投影定义](shadow/step01_mask/shadows.json) · [检查](shadow/step01_mask/inspection.json) · [报告](shadow/step01_mask/report.md) |

![最终穿戴与阴影预览](shadow/step01_mask/character-shadowed.png)

工程包含人物与衣服的独立图层、遮挡补全、穿戴组装和四处阴影投影。文件清单与归档记录见 [manifest.json](manifest.json) 和 [ARCHIVE.md](ARCHIVE.md)。
