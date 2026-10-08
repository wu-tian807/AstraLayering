# 完整成稿案例

`outputs/` 只保留已产出完整人物、完整衣装或完整独立展示的案例。必要参考、正式阶段产物与当前审查记录随案例保存；局部试验、未完成运行、旧失败轮次和临时文件已移出仓库。

## 成果索引

| 案例 | 实际结果 | 成稿入口 |
| --- | --- | --- |
| Jianma v4 | 完整分层素体，含眼口、头发、身体、手足与配饰 | [素体 SVG](jianma_v4/refinement/groups/clothing/character.svg) · [制作记录](jianma_v4/readme.md) |
| Jianma clothing | 完整默认穿戴稿、独立衣装与穿插索引 | [穿戴 SVG](jianma_clothing/final/character.svg) · [独立衣装](jianma_clothing/final/clothing.svg) · [衣装索引](jianma_clothing/final/clothing-index.json) · [说明](jianma_clothing/readme.md) |
| Jianma 2D / Opus 5.5 | workflow-next 第 1–5 步完成，保存组合后的完整 SVG | [成稿 SVG](jianma2d-opus55-20261005/refinement/character.svg) · [预览](jianma2d-opus55-20261005/refinement/preview.png) · [未解决项](jianma2d-opus55-20261005/未解决项.md) |
| Milly v1 | 旧流程阶段 1–5 的完整彩图与指定审查记录 | [成稿 SVG](milly_v1/step05-base-character/05-2_局部色彩与材质.svg) · [说明](milly_v1/readme.md) |
| Miku v3 | 旧流程阶段 1–5 的完整彩图，保留头脸校准结果 | [成稿 SVG](miku_v3/step05-base-character/05-2_局部色彩与材质.svg) · [说明](miku_v3/readme.md) |
| 首例 Miku | 首次完整阶段 1–5 结果与拆层展示 | [成稿 SVG](case1_miku/step05-base-character/05-2_局部色彩与材质.svg) · [完整展示](../demos/first-complete-case/readme.md) |
| Pelican bicycle | 可直接打开的完整鹈鹕自行车展示 | [展示页面](pelican-bicycle/index.html) · [预览](pelican-bicycle/preview.png) |

成稿指已有完整主体产物，不表示所有美术问题或动态绑定均已验收。具体限制以对应案例记录为准。

## 2026-10-08 清理

移出了 `case2`、`case3_miku_v2`、`cute-girl-2d`、`elf-face-2d`、`jianma_expression2`、`jianma_v1`、`jianma_v2`、`jianma2d`、`jianma2d_full`。同时移出旧失败案例目录、独立测试素材目录、空工具目录中的缓存，以及完整案例中的临时文件、旧失败轮次和重复快照。

保留的成稿、参考与正式阶段产物未重绘；已入库的旧文件可从清理前的 Git 历史查阅。旧运行记录中的已移除路径仅作历史记录。

展示与必要说明见 [demos](../demos/readme.md)；当前工作流见 [人物分层技能](../.agents/skills/live2d-layering/readme.md) 与 [workflow-next](../workflow-next/live2d-layering/readme.md)；使用 [SVG 预览器](../loading/svg-preview.html) 查看分组与显隐。
