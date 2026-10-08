# Jianma 衣装实际运行案例

本轮在 [Jianma v4 素体](../jianma_v4/refinement/groups/clothing/character.svg) 上，依据[用户穿衣参考](inputs/outfit_reference.png)完成衣装还原；保留正式阶段产物与最终交付，未重新绘制或覆盖原产物。

[运行记录](运行记录.md) · [完整穿戴稿](final/character.svg) · [独立衣装](final/clothing.svg) · [部件与效果索引](final/clothing-index.json) · [成稿对照](final/成稿对照.png)

![默认穿戴预览](final/preview.png)

## 过程文件

| 目录 | 实际内容 |
| --- | --- |
| [1.衣装结构与穿戴分析](1.衣装结构与穿戴分析/) | 结构安排与补全要求 |
| [2.按需补全参考](2.按需补全参考/) | 实际生成的衣装补全参考 |
| [3.衣装线稿](3.衣装线稿/) | 8 批线稿、结构对照、独立审查与首轮未通过版本 |
| [4.衣装色盘](4.衣装色盘/) | 原图取色与材料层次依据 |
| [5.分批着色与成稿](5.分批着色与成稿/) | 8 批着色，每批保存当时完整角色状态 |
| [final](final/) | 本轮最终交付 |

2026-10-08 已清理原运行 `tmp/` 中的临时绘制脚本、诊断图与显隐副本。最终 SVG、索引、预览、参考及正式阶段产物保持原始内容；运行记录中临时路径仅作历史记录。

当前技能入口为 [`$live2d-clothing`](../../.agents/skills/live2d-clothing/readme.md)；旧记录中的 `workflow_clothing/` 是当时的目录名，历史脚本保留当时环境路径，复用时需适配。

衣装集合须按索引插入素体的实际层位；本次完成静态默认穿戴与隐藏补形，尚未完成动态绑定验收，具体准备情况及纱袖控制范围问题见[动画素材核查](../../analysis/clothing-animation-readiness-20260927/动画素材核查.md)。
