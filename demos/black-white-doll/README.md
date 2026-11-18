# Black White Doll：标准化、分层、换装与阴影结果

本案例由已完成的制作任务正式导出，启用 standard，完成到投影阴影。人物有 101 个节点、70 个叶子，衣服有 13 个节点、10 个叶子。

| 阶段 | 正式结果 |
| --- | --- |
| 输入与参考 | [原图](input/original.png) · [Standard](part-layering/references/standard.png) · [简化图](part-layering/references/simplified-subject.png) · [Base subject](part-layering/references/base-subject.png) · [衣服](clothing-part-layering/references/clothing.png) |
| 人物部件 | [SVG 总图](part-layering/preview.svg) · [分组](part-layering/groups.json) · [深度](part-layering/occlusion.json) |
| 人物 step01 | [KRA](raster-layering/step01/character-depth.kra) · [工程预览](raster-layering/step01/composite.png) · [报告](raster-layering/step01/report.md) |
| 人物 step02 | [KRA](raster-layering/step02/character-soft-edges.kra) · [PNG](raster-layering/step02/character-soft-edges.png) · [报告](raster-layering/step02/report.md) |
| 人物 step03 | [KRA](raster-layering/step03/character-dressup-base.kra) · [PNG](raster-layering/step03/character-dressup-base.png) · [报告](raster-layering/step03/report.md) |
| 衣服部件 | [SVG 总图](clothing-part-layering/preview.svg) · [分组](clothing-part-layering/groups.json) · [深度](clothing-part-layering/occlusion.json) |
| 衣服 step01 | [KRA](clothing-raster-layering/step01/clothing-depth.kra) · [工程预览](clothing-raster-layering/step01/composite.png) · [报告](clothing-raster-layering/step01/report.md) |
| 衣服 step02 | [KRA](clothing-raster-layering/step02/clothing-soft-edges.kra) · [PNG](clothing-raster-layering/step02/composite.png) · [报告](clothing-raster-layering/step02/report.md) |
| 穿戴组装 | [KRA](character-assembly/step01/character-assembled.kra) · [PNG](character-assembly/step01/character-assembled.png) · [报告](character-assembly/step01/report.md) |
| 投影阴影 | [最终 KRA](shadow/step01_mask/character-shadowed.kra) · [最终 PNG](shadow/step01_mask/character-shadowed.png) · [面部检查](shadow/step01_mask/face-review.png) · [投影定义](shadow/step01_mask/shadows.json) · [验收](shadow/step01_mask/inspection.json) · [报告](shadow/step01_mask/report.md) |

![最终结果](shadow/step01_mask/character-shadowed.png)

归档包含正式工程、图像、SVG 部件、分组、深度、报告及报告引用的图片。最终 KRA、PNG 和原图与制作任务中的文件逐字节一致。

[manifest.json](manifest.json) 记录导出文件的大小和 SHA-256。任务会话、凭据和临时缓存留在本地运行目录。
