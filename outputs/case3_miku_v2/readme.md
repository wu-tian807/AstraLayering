# case3_miku_v2：线稿参考与色盘复测

2026-09-14归档。本轮已生成阶段2—4结果，阶段5尚未重跑。用户反馈线稿有一定改善、色盘对基础配色帮助明显；脸型偏大、眼白偏少等问题仍未解决。

## 输入与产物

| 内容 | 文件 | 说明 |
| --- | --- | --- |
| 基础角色彩图 | [base-character.png](./references/base-character.png) | 与case1使用的彩图完全相同，复制到本案例便于对照 |
| 前置4线稿参考 | [outline.jpg](./references/outline.jpg) | 本轮阶段3的线稿参考 |
| 前置5色盘 | [PNG](./references/color-palette.png)、[JSON](./references/color-palette.json) | 程序取色结果，已用于本轮阶段4 |
| 阶段2 | [完整部件SVG](./step02-base-character/02_完整部件与遮挡.svg)、[检查图](./step02-base-character/02_结构检查.png) | 沿用阶段2第二次复测的候选，包含已记录的头发与配件问题 |
| 阶段3 step1 | [主轮廓SVG](./step03-base-character/03-1_主轮廓.svg)、[检查图](./step03-base-character/03-1_轮廓检查.png) | 原三步流程的主轮廓轮次 |
| 阶段3 step2 | [内部结构线SVG](./step03-base-character/03-2_内部结构线.svg)、[检查图](./step03-base-character/03-2_结构线检查.png) | 包含五官与手足等内部结构 |
| 阶段3 step3 | [完整线稿SVG](./step03-base-character/03_完整分层线稿.svg)、[检查图](./step03-base-character/03_线稿检查.png) | 本轮实际传入阶段4的版本 |
| 阶段4 | [平涂SVG](./step04-base-character/04_完整分层平涂.svg)、[检查图](./step04-base-character/04_填色检查.png) | 本案例最新产物，基础配色改善，头脸几何问题仍开放 |
| 阶段5 | 尚无本案例产物 | 不用case1的彩图充当本轮结果 |

阶段2生成时的参考准备与回退过程见[第二次复测](../../analysis/stage2-reference-retest/第二次复测/复核.md)。本目录未补造一次新的阶段1，也不表示阶段2由当前已回退的提示词重新运行过。

归档时将原`outputs/step02-base-character`、`step03-base-character`、`step04-base-character`及本轮新增的线稿、色盘统一移入这里。产物内容未改写，旧任务路径和色盘生成时的来源记录保留；逐文件来源与SHA-256见[归档清单](./归档清单.json)。

本次实际改动、改善与待解决项见[迭代记录](../../analysis/case3-miku-v2-review/readme.md)。本案例使用旧三步流程；后续[阶段3五步](../../.agents/skills/svg-layering/workflows/3.建立可用线稿/readme.md)已在[miku_v3](../miku_v3/readme.md)完成实际生成，未覆盖本案例产物。

使用现有[SVG预览器](../../loading/svg-preview.html)加载本案例SVG与参考图即可比较。返回[案例索引](../readme.md)。
