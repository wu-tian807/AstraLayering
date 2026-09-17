# Miku v3：头脸还原改进与完整彩图

2026-09-17归档。本轮已生成阶段1—5全部结果，阶段3使用新的五步流程。脸型、头型和发束包脸关系有明显进步；局部眼睑、睫毛、手足线条与头发材质仍需改进。详细观察和同坐标对照见[本轮复核](../../analysis/miku-v3-review/readme.md)。

## 输入与产物

| 内容 | 文件 |
| --- | --- |
| 原始角色与前置平涂 | [原始输入](./references/original-input.jpg)、[前置平涂](./references/flat-color.png) |
| 本轮主参考 | [基础角色彩图](./references/base-character.png)，1037×1517 |
| 辅助参考 | [部件色块](./references/part-colors.png)、[线稿](./references/outline.png)、[色盘PNG](./references/color-palette.png)、[色盘JSON](./references/color-palette.json) |
| 阶段1 | [基础角色与补全范围](./step01-base-character/01_基础角色与补全范围.md) |
| 阶段2 | [完整部件SVG](./step02-base-character/02_完整部件与遮挡.svg)、[结构检查](./step02-base-character/02_结构检查.png) |
| 阶段3 step1 | [头型与发型](./step03-base-character/03-1_头型与发型.svg)、[检查图](./step03-base-character/03-1_头型检查.png) |
| 阶段3 step2 | [面部与表情](./step03-base-character/03-2_面部与表情.svg)、[检查图](./step03-base-character/03-2_面部检查.png) |
| 阶段3 step3 | [其余主轮廓](./step03-base-character/03-3_其余主轮廓.svg)、[检查图](./step03-base-character/03-3_轮廓检查.png) |
| 阶段3 step4 | [其余内部结构线](./step03-base-character/03-4_其余内部结构线.svg)、[检查图](./step03-base-character/03-4_结构线检查.png) |
| 阶段3 step5 | [完整分层线稿](./step03-base-character/03_完整分层线稿.svg)、[检查图](./step03-base-character/03_线稿检查.png) |
| 阶段4 | [完整分层平涂](./step04-base-character/04_完整分层平涂.svg)、[检查图](./step04-base-character/04_填色检查.png) |
| 阶段5 step1 | [大明暗与体积](./step05-base-character/05-1_大明暗与体积.svg)、[检查图](./step05-base-character/05-1_明暗检查.png) |
| 阶段5 step2 | [局部色彩与材质终稿](./step05-base-character/05-2_局部色彩与材质.svg)、[检查图](./step05-base-character/05-2_细节与材质检查.png) |

本轮所有SVG使用1037×1517画布；辅助色块图为1055×1491、线稿为1045×1505，不能将其坐标直接视为主参考坐标。v2使用另一张1024×1536彩图，跨轮观察分别以各自彩图为准。

## 归档与验收状态

26份文件由原`outputs/references`和`outputs/step01-base-character`至`step05-base-character`原样移动，文件哈希逐一核对一致。来源和SHA-256见[归档清单](./归档清单.json)。旧案例保留，源SVG中的历史描述、路径及色盘来源记录未改写。

本次已检查整图、头脸、头顶、手足与发尾，并核对阶段间脸型和眼部路径继承。结论为明显改善、仍有局部差异；不等同于全部隐藏部件和动态遮挡均已验收。终稿metadata注明独立审查不可用，不能登记为已完成独立审查；根title／desc仍沿用05-1，属于记录遗漏，见复核说明。

线稿增加独立审查subagent、增加检查与返修投入目前仅为[候选改进](../../analysis/miku-v3-review/readme.md#pending-review)，尚未修改执行提示词或启用。

使用现有[SVG预览器](../../loading/svg-preview.html)加载本目录彩图与SVG即可比较。返回[案例索引](../readme.md)。
