# Jianma v4 实际运行记录

本目录保存角色分层流程的实际输入、选项、阶段产物与当前审查记录；当前完整素体位于 [clothing/character.svg](refinement/groups/clothing/character.svg)，后续衣装制作见 [jianma_clothing](../jianma_clothing/readme.md)。

[完整运行记录](运行记录.md) · [本轮选项](options.json) · [部件清单](structure/parts.yaml) · [成果展示](../../demos/jianma-current-case/readme.md)

## 已完成部件

下列 SVG 是对应部件完成时的完整角色状态；后续部件可能仍是色块，继续使用时以本轮最后实际成稿为准。

| 部件 | 阶段成稿 |
| --- | --- |
| face | [脸部与独立效果](refinement/groups/face/6.投影与高光效果/character.svg) |
| eyes | [镜像组装与成稿](refinement/groups/eyes/6.镜像组装与成稿审查/character.svg) |
| mouth | [嘴部着色成稿](refinement/groups/mouth/3.嘴部着色成稿/character.svg) |
| hair | [头发与关联投影](refinement/groups/hair/5.关联投影与成稿/character.svg) |
| body | [身体承影与成稿](refinement/groups/body/5.身体承影与成稿/character.svg) |
| lower_body | [双腿与足部](refinement/groups/lower_body/3.双腿与足部成稿/character.svg) |
| arms | [双手着色与承影](refinement/groups/arms/5.双手着色与承影成稿/character.svg) |
| physics_details | [配饰着色与效果](refinement/groups/physics_details/5.着色与效果成稿/character.svg) |
| clothing | [整理后的素体](refinement/groups/clothing/character.svg) |

本角色没有额外实际运行的 special_parts / generic 制作结果，不能据此宣称这些类别已实跑通过。

## 保留范围与证据

- [reviews/refinement](reviews/refinement/) 保存当前各部件的独立审查、返修与证据；历史报告反映当时被审版本，不能代替当前稿状态。
- [嘴部耗时调查](嘴部耗时调查.md) 保留当时的耗时定位。

## 与当前技能的关系

这些记录按原运行原样保存，旧路径和旧字段可能仍出现；例如 `hair_reference_needed` 是历史选项，当前头发模板已不使用它决定是否生成参考。

原 `workflows/` 现在位于 [`.agents/skills/live2d-layering/`](../../.agents/skills/live2d-layering/readme.md)，原 `workflow_clothing/` 现在位于 [`.agents/skills/live2d-clothing/`](../../.agents/skills/live2d-clothing/readme.md)；续跑使用新技能并核对实际输入与阶段内容，历史脚本中的本机绝对路径需按环境调整。

本目录记录静态素材制作；动画绑定、动作范围与投影动态跟随仍需后续验证。
