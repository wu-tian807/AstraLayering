# 人物 raster step02 整体精修交付

已完成本轮看图检查和局部精修。交付工程为 1376×2048、RGBA U8，透明背景。实际修改 18 个绘画深度片；其余 68 个绘画片和全部 5 个原生透明度蒙版像素保持第一步结果。78 个逻辑 part、86 个绘画深度片、1 个共享口内组及既有深度、名称、归属、剪贴关系和默认显隐状态均保持。

- [最终 KRA](character-soft-edges.kra)
- [从重开工程导出的 PNG](character-soft-edges.png)
- 中间工程：`raster-layering/step02/workspace/working.kra`，现为已核验最终工程的工作副本。

## 实际输入与检查基准

- 只读输入 KRA：`raster-layering/step01/character-depth.kra`
- 结构和拆片报告：`raster-layering/step01/report.md`
- 第一步主参考：`part-layering/references/standard.png`
- 第一步颈胸、肩、白连体服及腰髋辅助参考：`part-layering/references/base-subject.png`
- 归属与深度：`part-layering/parts/`、`part-layering/groups.json`、`part-layering/occlusion.json`

先把默认合成与主参考并排看，再检查头部、五官、后发/侧发/辫子连接、双臂与腕环、手指接掌、腰髋、双腿、脚踝、脚趾和尾巴。白连体服等素体范围沿用第一步，按辅助参考检查。随后看了全部 86 个绘画片的原始独显，包括默认被原生蒙版闭合的底纹；多深度按第一步共同归属判断，没有把安装帽或深度分片误当成新部件。

最终整图：[灰底并排](evidence/final-whole-gray.png) / [深色底检查](evidence/final-whole-black.png)。局部与参考并排： [头部](evidence/final-head.png)、[双眼放大](evidence/final-eyes.png)、[图左手](evidence/final-left-hand.png)、[图右手](evidence/final-right-hand.png)、[双臂](evidence/final-arms.png)、[躯干](evidence/final-torso.png)、[脚部](evidence/final-feet.png)、[尾巴](evidence/final-tail.png)。每张图左侧是参考，右侧是最终合成。

## 整图问题清单与逐项处理

以下局部修复对照均为同一画布坐标：**左侧修复前、右侧修复后；上排为本件原始独显，下排为默认合成**。未重新配准参考或移动部件。

| 项目 | 所属部件与发现的问题 | 实际处理及核对结果 | 前后局部对照 |
| --- | --- | --- | --- |
| P01 | D44/D45，双侧食指外缘断续脏边与杂色薄点 | 原生橡皮沿各自上下轮廓清外侧残留，再以细暖棕线接回原有描边。保持指根、指缝和肤色体积；独显与接掌合成检查通过。 | [图左手](evidence/repair-hands-left.png) / [图右手](evidence/repair-hands-right.png) |
| P02 | D40/D41，双侧中指下缘不规则碎边 | 逐段清理轮廓外碎边，以本件细线续画下缘；不将掌或邻指画入中指层。 | 同上 |
| P03 | D42/D43，双侧拇指外缘低透明度残色和断续轮廓 | 沿各自弯曲形体清边，细线压感收笔。保留甲面与本件原有明暗，没有扩大为掌面。 | 同上 |
| P04 | D31/D32，前臂轮廓有浅杂边，约 y950 的白色小缺口 | 按既有前臂外形修清边，肤色局部接回缺口，再续细棕轮廓。初试削薄处已从本件原始像素恢复后重画；合成未出现与腕环断开的台阶。 | [前臂](evidence/repair-arms.png) / [缺口放大](evidence/repair-forearm-notches.png) |
| P05 | D14，后发隐藏根部矩形凸角，旁边有离散短线 | 局部橡皮去凸角，再续本件发流轮廓；移除与根部不相连的短线。默认与隐藏区域的本件独显均核对。 | [后发根](evidence/repair-back-root.png) |
| P06 | D14，后发下方隐藏红色边缘台阶及未收束笔触 | 沿自身红发形体整理下缘，细红棕线与局部软红明暗衔接原笔触；不添加脸或耳机投下的投影。 | [后发下缘](evidence/repair-back-hair.png) |
| P07 | D14，红色发梢之间和外缘残留不透明白边，合成出现原图没有的亮线 | 沿三条真实发梢分别逐笔擦除白色残边；发缕间恢复透明开口，并接回本件细暗边。不是把同片发面新增线条分开。 | 同上 |
| P08 | D83，侧发细梢有断开的回声线和碎点 | 清掉外侧碎点，以粉色压感渐细发丝和暖棕细下缘接回同一束发。独显无脱离主体的粉色点。 | [侧发尖](evidence/repair-side-tip.png) |
| P09 | D84，刘海末梢混入两小块黑色睫毛轮廓及下方淡碎点 | 只擦除刘海层上的外来黑片、淡点，续本件粉发尖端细边。真实睫毛仍在 D71；独显干净，默认眼角连接保留。 | [刘海末梢](evidence/repair-bang-tip.png) |
| P10 | D23，长袜脚踝轮廓有白色断点 | 以本件灰棕边线续接左右断点，清理轮廓外浅边；不增加脚踝横缝。 | [脚踝](evidence/repair-stock-ankle.png) |
| P11 | D23/D24，趾尖下缘有低透明度浅点与小残边 | 分别沿每个趾尖自身圆弧清外侧。早先误削第二趾的小段下缘已从本件原始像素恢复；最终趾尖、指甲与趾间线完整。 | [趾尖](evidence/repair-feet.png) |
| P12 | D67/D68，虹膜上部红色层次较碎，边缘有少量粗碎亮点 | 局部低透明度原生软笔加强红色上层体积，少量橙色径向笔触接回纹理；仅在现有暗边内续细线。没有覆盖瞳孔、金色下层或独立高光。越界试笔已恢复，不保留到交付中。 | [眼部独显与合成](evidence/repair-eyes-solo.png) |
| P13 | D71/D72，上睑局部针状小缺口和外侧短线断续 | 暗色细笔补同件小缺口、接回短段；保持两侧睫毛形状及粗细差异，不把眼白或虹膜写进眼睑层。 | 同上 |
| P14 | D35，领口附件上的淡粉残痕、外侧残点和隐藏安装下缘台阶 | 白布局部软/细笔覆盖杂色，清外侧残点；沿既有安装弧线逐笔修顺下缘并去掉修画产生的细残片。合成领口、侧缝和躯干连接不变。 | [领口附件](evidence/repair-cloth-rim.png) |

[实际变更层名清单](evidence/changed-parts.json)与[对第一步的结构/像素核对](evidence/upstream-verification.json)一致。修改只涉及上述 18 个绘画片。

## 眼睛、画风和未改区域的核对

两只眼睛分别与原图按原尺寸并排，另看 4 倍放大。核对眼形、上/下眼轮廓、睫毛连接眼白、虹膜暗红—橙—金色层次、瞳孔及高光。最终保留两侧各自眼形及原有高光分层；虹膜局部修整融入已有纹理，没有新添眼白上的独立细线。

- 图像左眼：[原尺寸](evidence/eye-image-left-1x.png) / [4 倍](evidence/eye-image-left-4x.png)
- 图像右眼：[原尺寸](evidence/eye-image-right-1x.png) / [4 倍](evidence/eye-image-right-4x.png)

主头发的浅粉面、亮带、红色内发、侧发与辫子的厚薄关系保持第一步绘画；本步只修局部缺陷，不全层改变明暗。脸型、鼻口、耳朵、狸饰、眉毛多深度接合、耳机、辫子/发圈、尾巴与腿之间连接，经整图及局部检查后保持原样。上臂肘部局部浅棕笔触与辅助参考的自身转折对应，未误擦成平面。掌根和多深度躯干片的安装形状按既定部件职责保留；合成不露新切线。

全片独显联图索引（数字沿用工作区的绘画片遍历顺序）：[0–11](evidence/solo-contact-0.png)、[12–23](evidence/solo-contact-12.png)、[24–35](evidence/solo-contact-24.png)、[36–47](evidence/solo-contact-36.png)、[48–59](evidence/solo-contact-48.png)、[60–71](evidence/solo-contact-60.png)、[72–83](evidence/solo-contact-72.png)、[84–85](evidence/solo-contact-84.png)。细小件的原尺寸轮廓以 KRA 独显和局部放大为准，联图是索引。

## 绘画方法和过程恢复

修画使用 Krita 原生 Basic-5 Size 和 Airbrush Soft，按检查问题手选位置、逐段给出笔画与压感。细线通过局部 6 倍画布原生笔刷绘制后缩回原尺度，再只合入所属部件的局部区域；橡皮也使用同样的原生笔刷轨迹。没有按参考逐像素改色、自动阈值清边、全层模糊、全局羽化或公式批量修复；没有生成新的整件替换图，也没有添加邻件投影。

修画测试中曾发现前臂过薄、虹膜细线越界、隐藏安装边内切及趾尖误削；均只取本件原始/已检查的阶段像素恢复后，重新进行局部原生修画。最终证据展示实际留下的结果。工作区脚本和 `native-stroke-log.json` 是过程记录，包含已撤回的试笔，不能整套重放来覆盖交付。

中间几次 save/saveAs 返回 true，但桥接同时捕获并取消 QProgressDialog，未据此宣称保存完成。最后正式保存与真实关闭/重开均为 ok:true，并通过全像素复核，因此当前没有未恢复的工具故障。

## 保存重开与最终验收

正式保存后关闭工程并从 `character-soft-edges.kra` 重新打开。核对全部 92 个非根节点的类型、名称、UUID、父子/兄弟顺序、显隐、opacity、blend、inheritAlpha、alphaLocked、locked、组 passThrough、bounds，以及 86 个绘画片和 5 个蒙版的全画布像素及默认投影：与保存前完全一致。

与第一步输入另作核对：结构及默认状态完全保持，全部蒙版像素不变，只有列明的 18 个绘画片像素发生改变。没有修改输入 KRA、groups.json 或 occlusion.json。

PNG 从该重开工程导出，为 1376×2048 RGBA，件外透明；与 KRA mergedimage 以及最后实际看过的合成解码像素完全一致，KRA ZIP 完整性通过。哈希用于保存稳定性验证，画质结论来自看图。

- [重开核对](evidence/reopen-verification.json)
- [第一步结构保护核对](evidence/upstream-verification.json)
- [KRA/PNG 完整性及像素核对](evidence/artifact-verification.json)

本轮最终回看未发现清单中仍未处理的缺块、外来残片、错误接缝或新添分割线。未解决问题：无。后续投影阶段及绑定运动测试不属于本轮静态绘画验收；本工程保留了所需部件底纹和既有控制结构。
