# 狸猫女孩：完整角色素材与脸部九轴参考

本例收录 `tanuki-nine-axis-seven-step-20261109` 在 2026-11-10 完成并接受的当前成果。原画、组装和阴影工程作为来源参考；该任务实际执行范围是头部九轴，没有补写前置管线的执行记录。

![最新脸部九个主姿态](nine-poses.png)

当前九轴交付脸部、五官、已有双耳、固定脖子，以及独立下颌线和下巴投影。头发、头饰及其投影留在完整 KRA 和头部来源素材中，尚未制作它们的九轴运动。此数据供 AstraLayering 工作台读取，尚未导出 Cubism 模型。

| 内容 | 入口 |
| --- | --- |
| 原始角色参考 | [原图](input/original.png) |
| 完整组装来源 | [KRA](character-assembly/step01/character-assembled.kra) · [PNG](character-assembly/step01/character-assembled.png) |
| 原生阴影来源 | [KRA](shadow/step01_mask/character-shadowed.kra) · [PNG](shadow/step01_mask/character-shadowed.png) · [投影关系](shadow/step01_mask/shadows.json) |
| 头部素材来源 | [KRA](nine-axis/step01_preparation/character-nine-axis.kra) · [PNG](nine-axis/step01_preparation/character-nine-axis.png) · [素材与投影归属](nine-axis/step01_preparation/head_parts_manifest.json) |
| 当前脸部九轴 | [模型](nine-axis/step07_jaw-line/deformers.json) · [可编辑 KRA](nine-axis/step07_jaw-line/character-nine-axis.kra) · [完整画布 PNG](nine-axis/step07_jaw-line/character-nine-axis.png) |
| 制作说明和正式检查图 | [最后一步说明](nine-axis/step07_jaw-line/notes.md) · [下颌九姿态](nine-axis/step07_jaw-line/review/nine-jaw.png) |
| 收录范围和真实执行来源 | [归档说明](archive.json) · [归档任务记录](run.json) |

## 在工作台查看

使用支持七步九轴的工作台版本（PR #243），将工作目录切换到本仓库的 `demos/`，选择“狸猫女孩 · 脸部九轴成果”。角色工作台打开 `studio?project=tanuki-girl&workspace=nine-axis`；流程预览可查看来源素材和最后一步的模型、报告与检查图。

在线参考：[脸部九轴工作台](https://gameclaw.woa.com/ai-weapon-spirit/character-layering/studio?project=tanuki-girl&workspace=nine-axis) · [成果预览](https://gameclaw.woa.com/ai-weapon-spirit/character-layering/?name=tanuki-girl&page=preview&stage=6)。

这是供参考的成果快照，已标记为归档。只保留来源工程、头部素材准备和最后一步的正式交付及报告引用图；step02–06 的视频、选帧和模型制作中间目录没有收录。完整原运行任务仍保留，归档不提供原会话续跑。KRA、PNG、SVG 和模型保持源文件内容，少量导出记录中的机器路径改为任务相对路径。

返回[案例索引](../readme.md)。
