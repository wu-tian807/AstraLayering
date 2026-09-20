# 阶段3 step2 v2定向复验：通过

候选：`/Users/wutian/Desktop/coding/AstraLayering/working/step03-base-character/03-2_面部与表情.svg`  
版本：v2  
SHA-256：`26c5e70ef297c5b4dc44ef51079f7fd82d596445d5be9e1a9c6fbb2d4e6f58c4`

总判定：**通过**。交接SHA-256与实际候选一致。H01已解决，受影响邻接和整图未发现回归，可进入下一节点。

## H01复验

原问题：右侧卷发约`x=580–594,y=237–260`的短弧穿过前景分界及邻接内弧，形成两个X交点。

v2已调整`hair-right-inner-locks`的两段内弧：短弧从`(583.7,246)`开始，避开前景发束；相邻内弧在`(586,254)`与其汇合，原两处交叉均已消除。正常头部组合和6倍局部图均显示合理的收束关系；卷发内部层次仍在，没有改成缺失内层的空白块。

证据：

- `hair-curl-right-side.png`：左原彩图、右v2，裁切`(565,217,65,68)`、6倍。
- `hair-curl-right-overlay.png`：同坐标、正常合成后50%整图叠加。
- `parts-hair-right.png`：中性底独显右侧发束及所属墨线。

## 回归与版本检查

- 独立重新渲染v2，并检查头部同坐标并排、叠加、右侧发束独显以及整图。
- 与v1留存的诊断SVG逐ID比较，排除该诊断已记录的填色差异后，唯一属性变化为`hair-right-inner-locks`的`d`；没有新增或删除ID。右侧发束闭合底形、外轮廓、脸缘、五官路径和部件顺序保持一致。
- v1独立整图渲染与v2重新渲染的像素差异仅位于右侧头发局部`x=579–639,y=220–260`，该区域以外像素一致。头型、五官神态、配件、身体姿态和接触关系无回归。
- 静态结构检查未发现重复ID、失效引用、外链、嵌图或脚本。
- v1已通过的眼部实际开口、头脸及主要发束完整性在本次修改中未受影响，原结论继续成立。

证据：`head-reference-side.png`、`head-reference-overlay.png`、`full.png`、`v1-v2-full-diff.png`、`v1-v2-full.json`、`structure-changes.json`。旧版本证据与报告位于相邻的`review-step2-evidence-v1`目录。

## 分项结论

| 项目 | 结论 |
| --- | --- |
| 头型发型与神态 | 通过 |
| 头部构造与线条 | 通过，H01已解决 |
| 完整性与组合遮挡 | 通过 |

本结论限于阶段3前两步的头型、头发与面部表情；身体其余线稿、全局线质精修、配色及材质由后续阶段验收。无待返修问题。

证据目录：`/Users/wutian/Desktop/coding/AstraLayering/working/step03-base-character/review-step2-evidence-v2/`。
