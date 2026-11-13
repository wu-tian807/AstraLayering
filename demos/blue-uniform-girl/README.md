# 蓝色制服女孩

部署工作台任务 `111dd` 的静态角色归档，通过既有 `workflow/export-run.ts` 导出。保留原任务名、完成记录、分件 SVG、可编辑 KRA、PNG 和检查报告；目录与工作台显示名采用“蓝色制服女孩”。

![最终阴影成稿](shadow/step01_mask/character-shadowed.png)

## 产物入口

| 阶段 | 可编辑稿与数据 | 画面与报告 |
| --- | --- | --- |
| 原始输入 | [原图](input/original.png) | 1115 × 1410 |
| 人体矢量分件 | [分组](part-layering/groups.json)、[遮挡关系](part-layering/occlusion.json) | [遮挡检查](part-layering/step14_occlusion/inspection.md) |
| 人体栅格分层 | [深度分层 KRA](raster-layering/step01/character-depth.kra)、[软边 KRA](raster-layering/step02/character-soft-edges.kra)、[换装底稿 KRA](raster-layering/step03/character-dressup-base.kra) | [换装底稿 PNG](raster-layering/step03/character-dressup-base.png)、[报告](raster-layering/step03/report.md) |
| 服装矢量分件 | [分组](clothing-part-layering/groups.json)、[遮挡关系](clothing-part-layering/occlusion.json) | [服装参考](clothing-part-layering/references/clothing.png) |
| 服装栅格分层 | [深度分层 KRA](clothing-raster-layering/step01/clothing-depth.kra)、[软边 KRA](clothing-raster-layering/step02/clothing-soft-edges.kra) | [合成 PNG](clothing-raster-layering/step02/composite.png)、[报告](clothing-raster-layering/step02/report.md) |
| 角色组装 | [KRA](character-assembly/step01/character-assembled.kra) | [PNG](character-assembly/step01/character-assembled.png)、[报告](character-assembly/step01/report.md)、[检查记录](character-assembly/step01/verification.json) |
| 阴影成稿 | [KRA](shadow/step01_mask/character-shadowed.kra) | [PNG](shadow/step01_mask/character-shadowed.png)、[报告](shadow/step01_mask/report.md)、[检查总览](shadow/step01_mask/inspection/overview.png) |

## 打开与校验

在工作台 Studio 中打开本目录，或用 Krita 打开对应 KRA。KRA 是可编辑画稿权威，PNG 是其展示投影。[run.json](run.json) 保存六个静态流程的完成状态，[manifest.json](manifest.json) 保存归档文件的大小与 SHA-256。

导出检查未发现缺失的历史图片引用。已校验全部归档文件哈希和七份 KRA 的 ZIP 完整性，并确认组装与阴影 KRA 内的保存合成图分别与对应 PNG 逐像素一致。最终画布为 1115 × 1410；原阴影报告记录 19 个阴影层。此案例到阴影成稿为止，没有九轴变形、绑定或动画结果。

历史报告按导出字节保留，其中部分文字存在编码乱码。上述校验确认归档完整性与保存画面一致性，不代表已完成动画或九轴验收。
