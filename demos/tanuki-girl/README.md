# 狸猫女孩：分层、组装与阴影

![阴影完成稿](shadow/step01_mask/character-shadowed.png)

本版来自 `tanuki-raster-rerun-20261111`，人物 raster 重新制作后完成组装与阴影，于 2026-11-14 按 `pnpm export` 导出。画布为 1376 × 2048，衣服沿用同一角色已完成的分层工程。

本版完成到阴影，九轴尚未制作。案例只包含本次正式产物、报告和完成记录；继续制作使用原运行任务。

| 内容 | 文件 |
| --- | --- |
| 角色参考图 | [PNG](input/original.png) |
| 人物分层 | [KRA](raster-layering/step01/character-depth.kra) · [PNG](raster-layering/step01/composite.png) |
| 人物柔边 | [KRA](raster-layering/step02/character-soft-edges.kra) · [PNG](raster-layering/step02/character-soft-edges.png) |
| 换装素体 | [KRA](raster-layering/step03/character-dressup-base.kra) · [PNG](raster-layering/step03/character-dressup-base.png) |
| 衣服分层 | [KRA](clothing-raster-layering/step01/clothing-depth.kra) · [PNG](clothing-raster-layering/step01/composite.png) |
| 组装角色 | [KRA](character-assembly/step01/character-assembled.kra) · [PNG](character-assembly/step01/character-assembled.png) |
| 阴影 | [KRA](shadow/step01_mask/character-shadowed.kra) · [PNG](shadow/step01_mask/character-shadowed.png) · [投影关系](shadow/step01_mask/shadows.json) |

从角色工作台“打开项目”选择本目录即可浏览。导出来源与文件清单见 [manifest.json](manifest.json)。
