结论：需要修复

# 第一步独立 review

本次已查完全部 **70 个逻辑 part、71 个实际绘画分片**，确认下列 **20 项**需要修复。没有修改工程、上游 SVG、分组或深度文件。所有问题均来自本轮在 Krita 打开的当前 KRA 及其重新导出视图的实际看图；没有用历史验收结论或相似度数字替代检查。

## 输入、检查方法与证据约定

- 当前工程：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/character-depth.kra`，1086 × 1448。
- 实际绘画参考：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/base-subject.png`。已核对 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/report.md` 的“原图与组装对照”，并以交付工作区 `resume-paint.py`、`import-v2.py` 的 `source_doc` 路径核实实际用图；未将 `standard.png` 或 `simplified-subject.png` 当作本次原图。
- 分组、深度与部件依据：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/groups.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/occlusion.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/parts/`。第一步目录中只有正式 `report.md`，没有已有的正式 review／repair 报告可承接。
- 在 Krita 另行打开磁盘工程，逐一切换 71 个绘画层：先禁用开口蒙版独显完整本件，再隐藏高于本层的所有层查看补全区及底层组合。每层均查看独显、隐藏上层及同坐标原图；全量证据是末尾覆盖表对应的 23 张 atlas，每行依次为 **参考／本件独显（蒙版停用）／隐藏上层**。透明区域在 atlas 中加棋盘格，仅用于显示。
- 另外查看默认全图、同尺寸双眼并排图、眼睛和所有衔接重点的同倍率放大图；D001／D005 分片分别看过，并合看 `white-back-combined.png`。两个分片是同一白色后马尾的真实深度安排，本次没有将其判为重复。
- 10 个透明度蒙版逐个查看停用／启用后的 owner 独显和合成。实际仅挂在双眼各自 sclera／iris／highlight 及四件口内内容上；均为眼口开口控制。全部绘画层 `inheritAlpha=false`，无剪贴关系、额外显隐蒙版或其他类型控制层。没有发现用蒙版代替头发、四肢、鞋体真实深度的问题。
- 所有框为原画布 `[x,y,width,height]`；原图未移动、缩放或变形以迁就当前。下文带“独显”的对照右侧是该层本身，并非默认合成；参考中的被遮部位只提供位置、可见边线及画风依据，不冒称可直接看到原图隐藏面。
- 框选工具原始输出保留在 workspace，本报告引用的完整证据副本均已集中至 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/`。编号、坐标、图层和说明同时保存在各 `annotated/*/regions.json`。

默认合成问题总览（隐藏区问题另在各条独显图中标注）：



## 确定需要修复的问题

### R1 — 白色前马尾内卷形体和开隙被改写

**图层／位置：** `D003.0 | hair/ponytail/ponytail_left/ponytail_front`；`[656,346,88,177]`，画面右侧宽卷内缘。

**当前与参考：** 原图内卷左侧保留长条开隙，少量细束从中穿过；当前新增数条较宽的紫灰尖束及相连发面，侵入原开隙，内侧轮廓与卷尖改成多层尖叉。D003 独显也能看到这些新增形体，不能归因为后马尾遮挡。

**影响／修复：** 默认姿态的负形、束缘和卷曲结构不一致。按原图重画这一段可见内轮廓、细束宽度和卷尖，恢复原有开隙；保留完整根部和宽卷体积，不沿遮挡边横切整个马尾，也不挖消隐蒙版。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R2 — 白色后马尾前绕细束变粗、发亮且钝收

**图层／位置：** `D005.0 | hair/ponytail/ponytail_left/ponytail_back | front_sweep`，接 `D001.0 | 同 part | rear_surface`；`[677,422,96,86]`。

**当前与参考：** 原图是带灰紫双侧束缘、宽度渐变的细束；当前更像一条亮白描线，右下回接处突然变宽变白，末端钝厚。分片合看仍有这处变化。

**影响／修复：** 原有细束立体感和收笔特征被压平，分片接处显出人工补线。按参考画出细束两侧边、内部灰紫层次及渐细收笔，分别接顺 D001／D005；保留既定的深度 1／5，不把低位宽卷整体抬到前层。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/white-back-combined.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-03.png`。

### R3 — 黑侧发带入眼尾墨线，眼尾自身不完整

**图层／位置：** `D066.0 | hair/side_hair/side_hair_right`、`D043.0 | face/eyes/eye_right/upper_eyelid`；画面左眼外角 `[465,142,26,26]`。

**当前与参考：** 原图外眼尾是一体收细的墨线。D066 独显在相同位置留下横向黑条和按眼尾截出的台阶；D043 独显的外尖则较短、钝。合成中出现独立小暗点和断续感，侧发移动后还会带走眼尾。

**影响／修复：** 同时违反眼睛形状、部件归属和衔接要求。清掉 D066 的眼尾残笔并接顺其自身发缘；把完整尖钩及浓淡收笔画回 D043，再于原尺寸验证眼睑—眼白—侧发的交界连续。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/black-side/marked.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/black-side/regions.json`。

### R4 — 白侧发在眼尾处留齿口，并截断眼尾尖

**图层／位置：** `D065.0 | hair/side_hair/side_hair_left`、`D042.0 | face/eyes/eye_left/upper_eyelid`；画面右眼外角 `[605,138,21,28]`。

**当前与参考：** D042 独显仍有外尖，但默认合成被 D065 遮断；D065 内缘带有齿形凹口、灰紫短横和浅色孤点。原图此处眼尾连续收尖，发缘没有当前这种拼接齿口。

**影响／修复：** 眼尾收笔、发缘形状及归属不符。先清理侧发中的眼尾形残笔，重画连续自有束缘；在保持完整眼尾的前提下核对真实交叉。如果参考尖端确实位于发前，应同步上游的局部深度安排并作普通绘画分片，不能靠透见蒙版、眼尾形挖洞或把整个眼睑抬前补救。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/white-side/marked.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/white-side/regions.json`。

### R5 — 左手逐指补全平片化，取样段有硬接界

**图层／位置：** 角色左手、画面右侧 `[657,699,45,100]`。完整 ID 前缀为 `arms/arm_left/hand/`：

| 图层 | 本轮独显确认的表现 |
| --- | --- |
| D014.0 little_finger | 基本为浅肤色细片，缺少原画手部的暗侧、亮面及浓淡轮廓。 |
| D016.0 ring_finger | 同样缺少指体转面；隐藏段与指尖通篇接近同一种平涂层次。 |
| D018.0 middle_finger | 粉红原笔触只在部分段保留，宽指根的明暗和边线没有自然延续。 |
| D020.0 index_finger | 约 y754 的浅色补全根段与红暗取样段形成硬斜界，宽度及边线发生阶梯变化。 |
| D022.0 thumb | 根段到原图指身的轮廓深浅、红暗层次突变。 |

**依据／影响／修复：** 原图可见手指有清楚的红暗侧、亮面、细描边和指甲；隐藏面虽无直接图像，仍须延续同件体积及笔触，不能只以浅肤色轮廓占位。逐指画出完整转面和轮廓，融掉补全—取样接界；保留已有原图指甲、指尖位置及自然前后遮挡。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-finger/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-finger/regions.json`。
另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/R5-comparison.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-05.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-06.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-07.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-08.png`。

### R6 — 右手逐指补全缺少层次，根部拼接可见

**图层／位置：** 角色右手、画面左侧 `[387,692,43,106]`。完整 ID 前缀为 `arms/arm_right/hand/`：

| 图层 | 本轮独显确认的表现 |
| --- | --- |
| D015.0 little_finger | 浅肤色平片，描边及转面层次没有延续原画手部。 |
| D017.0 ring_finger | 绝大部分为均匀浅色，指根—指身缺少体积变化。 |
| D019.0 middle_finger | 平整指根与保留的指尖原笔触在颜色、轮廓粗细上明显分段。 |
| D021.0 index_finger | 约 y737 出现横向肤色接界和边线错位，接下方深色指侧后宽度突变。 |
| D023.0 thumb | 根部平薄，接原取样指身的边线和红暗明暗过渡生硬。 |

**依据／影响／修复：** 与 R5 相同，原图的手部体积和颜色层次必须落实到各个完整手指本身。逐件补画暗侧、亮面和完整边线，按当前指身走向融接；不要把几指合成一个手部平片，也不要增加隐藏蒙版。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-finger/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-finger/regions.json`。
另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/R6-comparison.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-06.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-07.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-08.png`。

### R7 — 躯干独显的肩带、领口和衣身结构线未接完

**图层／位置：** `D031.0 | body/torso`；`[471,314,145,118]`。

**当前与参考：** 两肩带内侧线在上胸位置中止，领口补线发虚；左右衣身结构线在约 y414 同时断开，上下切线错位，断口周围有楔形浅色拼接边。原图对应衣缝连续，上游也要求乳房后方为完整胸廓而非缺口。

**影响／修复：** D032 移动或隐藏时会露出断线和拼贴。沿既有走向在 D031 画完肩带、领口及两条结构线，统一线宽、切线与颜色，融平楔形接边；保留 D032 的独立胸部体积，不再烘焙一套乳房到躯干。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/torso/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/torso/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-12.png`。

### R8 — 骨盆上方两条衣缝断开、错位

**图层／位置：** `D012.0 | pelvis`；`[486,505,116,34]`，两断口约在 y517。

**当前与参考：** 独显时，两条斜向衣缝在补全段与原笔触之间留空，端点横向错位；原图同处是连续细缝。默认大部分由 torso 盖住，不能据此判定该部件已经完整。

**影响／修复：** 腰部转动或层间相对移动会露出断缝。沿参考切线接顺两条衣缝并延续至本件完整上沿；保持默认合成已平顺的腰腹颜色和服装边线。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/pelvis/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/pelvis/regions.json`。



### R9 — 颈部自身描边缺失，肩颈接边不顺

**图层／位置：** `D030.0 | neck`，与 `D031.0 | body/torso` 接界；`[498,220,89,69]`。

**当前与参考：** 原图颈侧有随轮廓延续至颈根的细深线；当前颈层独显几乎只有柔色面，侧线被一并去掉，默认轮廓也发虚。颈根两侧与肩面衔接处出现小凸口。

**影响／修复：** 颈部缺少自身结构边，肩颈有拼接痕迹。补回属于颈部的连续轮廓和适度体积边，接顺颈根—肩面切线。**已移除的下巴投影应继续保持移除**，不要为追参考暗面把其他部件的投影重新画入颈层。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-12.png`。

### R10 — 脸底下颌带入两截颈侧线

**图层／位置：** `D035.0 | face/face_base`；`[509,221,70,22]`，下颌与两侧颈线交点附近。

**当前与参考：** 脸底独显仍有两枚向下的短竖钩，对应原图颈侧线的起点。它们在当前合成的下颌沿线形成多余齿点；原图是下颌与颈线相接，并非脸轮廓自带两个钩。

**影响／修复：** 脸底包含颈部线条，脸颈相对运动时会留下鬼影。清掉两截竖钩，只保留连续下颌线，细化其现有台阶边；完整颈线归 D030，与 R9 一起接顺。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/face-base/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/face-base/regions.json`。



### R11 — 左臂描边被削薄，隐藏根段没有接成完整笔触

**图层／位置：** `D026.0 | arms/arm_left/forearm`、`D028.0 | arms/arm_left/upper_arm`；画面右臂 `[603,281,100,396]`。前臂重点是 x约 648–700、y534–659 的两侧可见边及 y约480 的根部。

**当前与参考：** 前臂可见外缘的原深浅描边多段丢失，边线变成一格格浅色台阶；顶部补全盖帽与原段有楔形硬色界。独显上臂隐藏肩根、末端和前臂两端时，原画描边没有延续画完。

**影响／修复：** 默认轮廓已不符原图，关节露出时会再出现平片端部及接界。沿原可见边恢复描边粗细、收笔和抗锯齿，补全区同样画完整轮廓与体积；柔和接回原笔触，不以扩大肤色面遮掉断口。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-forearm/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-forearm/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/R11-comparison.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-10.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-11.png`。

### R12 — 右臂外缘缺线、方阶，补全端部色界明显

**图层／位置：** `D027.0 | arms/arm_right/forearm`、`D029.0 | arms/arm_right/upper_arm`；画面左臂 `[384,281,100,399]`。前臂重点为 x约390–425、y531–654 外侧边及顶部根段。

**当前与参考：** 原图连续而有深浅的外轮廓在当前被削成浅色阶梯，有的段只剩肤色硬边；前臂顶端盖帽色界明显。上臂根部与末端、前臂上下端的描边没有画成完整延续。

**影响／修复：** 可见形体的边线质量下降，隐藏面不满足整件完整要求。恢复参考的连续曲线与浓淡轮廓，在根部延续指向与体积色层并融接，保持现有肩、肘、腕位置。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-forearm/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-forearm/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/R12-comparison.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-10.png`；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-11.png`。

### R13 — 两腿内侧过宽，闭合原有腿间空隙

**图层／位置：** `D010.0 | legs/leg_left/leg`、`D011.0 | legs/leg_right/leg`；裆底下方 `[525,686,36,101]`。

**当前与参考：** 原图从连体服裆底向下已有连续腿间空隙；当前两腿仍相贴一段，随后才突然以宽度阶梯张开。单腿独显也能看到内侧轮廓过直、过宽，故不是鞋体或其他前层的遮挡问题。

**影响／修复：** 腿根宽度、腿间负形和两腿相对关系改变。按原内侧腿缘重画各自形体及描边，恢复连续空隙，保留完整腿根补全；不要整体外移两腿、改变服装裆底或挖一条消隐缝。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R14 — 左踝轮廓出现多级方阶

**图层／位置：** `D010.0 | legs/leg_left/leg`；画面右踝 `[550,1164,64,104]`。

**当前与参考：** 原图小腿至踝为平滑收窄曲线，当前内外缘反复出现横向台阶、缺角和宽度跳变；鞋带上方即可直接看到。

**影响／修复：** 改变踝部曲线和边线粗细，默认合成已有毛刺感。按参考及连续足踝体积修形，重新画完描边和抗锯齿；保留袜面明暗及真鞋带孔。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R15 — 右踝同样阶梯化、宽度突变

**图层／位置：** `D011.0 | legs/leg_right/leg`；画面左踝 `[472,1164,64,105]`。

**当前与参考：** 踝部内外缘多级直角台阶，在原图平顺的窄踝段形成凸块。并非原画的线条收笔。

**影响／修复：** 右踝形体及线形不符。逐段按原收窄方向接顺外轮廓和描边，延续到鞋内完整足部，不能只把可见缺角藏进鞋口。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R16 — 左足补全过宽，从鞋体外露出

**图层／位置：** `D010.0 | legs/leg_left/leg`，与 `D071.0 | legs/leg_left/shoes/shoe_body` 配合；画面右鞋 `[538,1259,89,128]`。

**当前与参考：** 单腿独显的足端呈过宽的球状；合成后棕色袜足从鞋帮两侧、尤其两鞋之间露出。参考这些位置是鞋体外的背景。

**影响／修复：** 完整足部没有被真实鞋体包住，默认轮廓已穿帮。以原鞋位置和合理鞋内足型重新配准、重画足部宽度及脚背—脚趾曲线，再检查各侧鞋口；保留完整脚，不裁成鞋的可见窗口、不加隐藏蒙版。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R17 — 右足也从鞋边露出袜色块

**图层／位置：** `D011.0 | legs/leg_right/leg`，与 `D072.0 | legs/leg_right/shoes/shoe_body` 配合；画面左鞋 `[458,1252,88,134]`。

**当前与参考：** 右足补全同样肥宽，鞋外侧及两鞋之间出现棕色足部；参考鞋外轮廓之外没有这些色块。

**影响／修复：** 鞋足比例和遮挡失真。修正完整足部形体及与鞋帮的配合，保持原鞋体位置、鞋头及厚底形状，不整体放大鞋来遮脚，也不新增非开口蒙版。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/main/regions.json`。



### R18 — 后帮错误复刻前侧扣孔，补全区有穿孔

**图层／位置：** `D009.0 | legs/leg_right/shoes/rear_collar`；`[495,1212,19,18]`。

**当前与参考／上游：** 独显中央的不规则浅区经核实是**透明孔**，不是白色高光。它与 D072 前侧鞋扣孔同坐标；后帮职责是绕踝后连续包覆，原图前扣的孔并不能证明后帮也应穿孔。`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/parts/legs/leg_right/shoes/rear_collar.svg` 的 completion path 也含同一 evenodd 孔，说明该错误已进入上游补全形状。

**影响／修复：** 后帮自身不完整，腿移开后会露不属于本件的洞。先修正该上游后帮补全路径，再在 D009 补画连续后帮材质和边线；保留 D072 本来真实存在的扣孔。不要用腿一直盖住此洞作为完成标准。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/rear-collar/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/rear-collar/regions.json`。



另见：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-04.png`。

### R19 — 白侧内飘带根部与带身硬接

**图层／位置：** `D059.0 | head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_inner`；`[630,126,27,37]`。

**当前与参考：** 独显约 y139 处有黑色楔形硬界，右边缘突然产生台阶，根段纵向高光在此改向，像两个片段拼接。原图的前方结体覆盖这里，不能把这条覆盖界当作内飘带自身的封口或横向结扣。

**影响／修复：** 隐藏补全不是连续干净的同一带面。按带身延续根部宽度、切线和材质明暗，融掉硬界；保留真实纵褶，去掉不属于自身结构的截断暗边。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-ribbon/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/left-ribbon/regions.json`。



### R20 — 黑侧内飘带出现横贯带宽的黑色接带

**图层／位置：** `D061.0 | head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_inner`；`[432,169,21,36]`。

**当前与参考：** 独显约 y180 处，上方灰亮根段横向骤变为黑段，边缘也缩窄，形成带宽级硬接界。原图在这一带受侧发遮挡，没有支持此处另有横缝或结扣的结构依据。

**影响／修复：** 同一飘带的颜色、线宽与轮廓发生突变。沿下方带身向根部连续画完纵向褶面，接顺宽度并融掉横界；保留正常纵褶及斜切带尾，不将遮挡交界烘焙为自己的结构线。



框选与坐标：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-ribbon/marked.png`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/annotated/right-ribbon/regions.json`。



## 已查的控制关系、眼睛与需保留内容

10 个蒙版的停用／启用逐件对照如下。双眼眼白、虹膜、高光以各眼真实开口控制；口内四件由上下唇共同开口控制。启用后消去的都在真实开口之外，开口外的发、耳、肢体、鞋体遮挡由绘画深度承担。本轮没有确定的蒙版或剪贴滥用项。





双眼已先以原尺寸并排查看，再同倍率放大查看两侧眼轮廓、睫毛—眼白衔接、各自虹膜色层、瞳孔及独立高光。需要修复的是 R3／R4 的外眼尾归属和连接；本轮不要求把虹膜、高光或整眼推翻重画。眼褶、下睫毛、眉毛亦分别独显看过，不与侧发鬼影混记。





继续保留：D001／D005 的合法同件深度分片；黑马尾中原图存在的银白细发和粉条；腮红红色底和斜线；已经属于各自层的指甲、眼部独立高光；原图真实鞋扣孔、鞋带及鞋底细节。不要将已去掉的下巴投影恢复到颈层。其余未列出的部件本轮没有发现确定需要返修的问题，不据此提出整层重画。

建议先处理 R18 的上游后帮形状与 R4 的实际交叉归属，再修腿足、马尾可见形体；随后修眼尾／颈线归属、描边和隐藏区接界。每批修后仍需逐层独显及原尺寸合成复查，不能只看默认姿态把问题盖住。

## 全部部件检查覆盖

下表每一行均已完成独显及隐藏上层看图。`无新增确定项`只表示本次未找到新的确定问题。atlas 中第三列为该层及其全部低深度层的实际 Krita 合成，不是用原图伪造的补全视图。D001 与 D005 各自独显过，另见同件合看图。

| 实际分片 | 逻辑 part | 独显／隐藏上层证据 | 对应反馈 |
| --- | --- | --- | --- |
| D001.0（后面） | `hair/ponytail/ponytail_left/ponytail_back` | [查看 atlas-01.png](review-evidence/review01/atlas-01.png) | R2（与 D005 合看） |
| D002.0 | `hair/ponytail/ponytail_right/ponytail_back` | [查看 atlas-01.png](review-evidence/review01/atlas-01.png) | 无新增确定项 |
| D003.0 | `hair/ponytail/ponytail_left/ponytail_front` | [查看 atlas-02.png](review-evidence/review01/atlas-02.png) | R1 |
| D004.0 | `hair/ponytail/ponytail_right/ponytail_front` | [查看 atlas-02.png](review-evidence/review01/atlas-02.png) | 无新增确定项 |
| D005.0（前绕束） | `hair/ponytail/ponytail_left/ponytail_back` | [查看 atlas-03.png](review-evidence/review01/atlas-03.png) | R2（与 D001 合看） |
| D006.0 | `hair/hair_cap` | [查看 atlas-03.png](review-evidence/review01/atlas-03.png) | 无新增确定项 |
| D007.0 | `legs/leg_left/shoes/collar_back` | [查看 atlas-03.png](review-evidence/review01/atlas-03.png) | 无新增确定项 |
| D008.0 | `legs/leg_left/shoes/ankle_strap/ankle_strap_back` | [查看 atlas-04.png](review-evidence/review01/atlas-04.png) | 无新增确定项 |
| D009.0 | `legs/leg_right/shoes/rear_collar` | [查看 atlas-04.png](review-evidence/review01/atlas-04.png) | R18 |
| D010.0 | `legs/leg_left/leg` | [查看 atlas-04.png](review-evidence/review01/atlas-04.png) | R13、R14、R16 |
| D011.0 | `legs/leg_right/leg` | [查看 atlas-05.png](review-evidence/review01/atlas-05.png) | R13、R15、R17 |
| D012.0 | `pelvis` | [查看 atlas-05.png](review-evidence/review01/atlas-05.png) | R8 |
| D014.0 | `arms/arm_left/hand/little_finger` | [查看 atlas-05.png](review-evidence/review01/atlas-05.png) | R5 |
| D015.0 | `arms/arm_right/hand/little_finger` | [查看 atlas-06.png](review-evidence/review01/atlas-06.png) | R6 |
| D016.0 | `arms/arm_left/hand/ring_finger` | [查看 atlas-06.png](review-evidence/review01/atlas-06.png) | R5 |
| D017.0 | `arms/arm_right/hand/ring_finger` | [查看 atlas-06.png](review-evidence/review01/atlas-06.png) | R6 |
| D018.0 | `arms/arm_left/hand/middle_finger` | [查看 atlas-07.png](review-evidence/review01/atlas-07.png) | R5 |
| D019.0 | `arms/arm_right/hand/middle_finger` | [查看 atlas-07.png](review-evidence/review01/atlas-07.png) | R6 |
| D020.0 | `arms/arm_left/hand/index_finger` | [查看 atlas-07.png](review-evidence/review01/atlas-07.png) | R5 |
| D021.0 | `arms/arm_right/hand/index_finger` | [查看 atlas-08.png](review-evidence/review01/atlas-08.png) | R6 |
| D022.0 | `arms/arm_left/hand/thumb` | [查看 atlas-08.png](review-evidence/review01/atlas-08.png) | R5 |
| D023.0 | `arms/arm_right/hand/thumb` | [查看 atlas-08.png](review-evidence/review01/atlas-08.png) | R6 |
| D024.0 | `arms/arm_left/hand/palm` | [查看 atlas-09.png](review-evidence/review01/atlas-09.png) | 无新增确定项 |
| D025.0 | `arms/arm_right/hand/palm` | [查看 atlas-09.png](review-evidence/review01/atlas-09.png) | 无新增确定项 |
| D026.0 | `arms/arm_left/forearm` | [查看 atlas-10.png](review-evidence/review01/atlas-10.png) | R11 |
| D027.0 | `arms/arm_right/forearm` | [查看 atlas-10.png](review-evidence/review01/atlas-10.png) | R12 |
| D028.0 | `arms/arm_left/upper_arm` | [查看 atlas-11.png](review-evidence/review01/atlas-11.png) | R11 |
| D029.0 | `arms/arm_right/upper_arm` | [查看 atlas-11.png](review-evidence/review01/atlas-11.png) | R12 |
| D030.0 | `neck` | [查看 atlas-12.png](review-evidence/review01/atlas-12.png) | R9 |
| D031.0 | `body/torso` | [查看 atlas-12.png](review-evidence/review01/atlas-12.png) | R7、R9接界 |
| D032.0 | `body/breast` | [查看 atlas-12.png](review-evidence/review01/atlas-12.png) | 无新增确定项 |
| D033.0 | `face/ears/ear_left` | [查看 atlas-12.png](review-evidence/review01/atlas-12.png) | 无新增确定项 |
| D034.0 | `face/ears/ear_right` | [查看 atlas-13.png](review-evidence/review01/atlas-13.png) | 无新增确定项 |
| D035.0 | `face/face_base` | [查看 atlas-13.png](review-evidence/review01/atlas-13.png) | R10 |
| D036.0 | `face/eyes/eye_left/sclera` | [查看 atlas-13.png](review-evidence/review01/atlas-13.png) | 无新增确定项 |
| D037.0 | `face/eyes/eye_right/sclera` | [查看 atlas-13.png](review-evidence/review01/atlas-13.png) | 无新增确定项 |
| D038.0 | `face/eyes/eye_left/iris` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | 无新增确定项 |
| D039.0 | `face/eyes/eye_right/iris` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | 无新增确定项 |
| D040.0 | `face/eyes/eye_left/highlight` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | 无新增确定项 |
| D041.0 | `face/eyes/eye_right/highlight` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | 无新增确定项 |
| D042.0 | `face/eyes/eye_left/upper_eyelid` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | R4 |
| D043.0 | `face/eyes/eye_right/upper_eyelid` | [查看 atlas-14.png](review-evidence/review01/atlas-14.png) | R3 |
| D044.0 | `face/eyes/eye_left/lower_eyelashes` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D045.0 | `face/eyes/eye_right/lower_eyelashes` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D046.0 | `face/eyes/eye_left/eyelid_crease` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D047.0 | `face/eyes/eye_right/eyelid_crease` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D048.0 | `face/eyebrows/eyebrow_left` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D049.0 | `face/eyebrows/eyebrow_right` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D050.0 | `face/nose` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D051.0 | `face/blush_left` | [查看 atlas-15.png](review-evidence/review01/atlas-15.png) | 无新增确定项 |
| D052.0 | `face/blush_right` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D053.0 | `face/mouth/mouth_interior` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D054.0 | `face/mouth/lower_teeth` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D055.0 | `face/mouth/tongue` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D056.0 | `face/mouth/upper_teeth` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D057.0 | `face/mouth/upper_lip` | [查看 atlas-16.png](review-evidence/review01/atlas-16.png) | 无新增确定项 |
| D058.0 | `face/mouth/lower_lip` | [查看 atlas-17.png](review-evidence/review01/atlas-17.png) | 无新增确定项 |
| D059.0 | `head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_inner` | [查看 atlas-17.png](review-evidence/review01/atlas-17.png) | R19 |
| D060.0 | `head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_outer` | [查看 atlas-18.png](review-evidence/review01/atlas-18.png) | 无新增确定项 |
| D061.0 | `head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_inner` | [查看 atlas-18.png](review-evidence/review01/atlas-18.png) | R20 |
| D062.0 | `head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_outer` | [查看 atlas-19.png](review-evidence/review01/atlas-19.png) | 无新增确定项 |
| D063.0 | `head_accessories/hair_bows/hair_bow_left/bow_body` | [查看 atlas-19.png](review-evidence/review01/atlas-19.png) | 无新增确定项 |
| D064.0 | `head_accessories/hair_bows/hair_bow_right/bow_body` | [查看 atlas-20.png](review-evidence/review01/atlas-20.png) | 无新增确定项 |
| D065.0 | `hair/side_hair/side_hair_left` | [查看 atlas-20.png](review-evidence/review01/atlas-20.png) | R4 |
| D066.0 | `hair/side_hair/side_hair_right` | [查看 atlas-21.png](review-evidence/review01/atlas-21.png) | R3 |
| D067.0 | `hair/bangs` | [查看 atlas-21.png](review-evidence/review01/atlas-21.png) | 无新增确定项 |
| D068.0 | `head_accessories/hair_clips/hair_clip_upper` | [查看 atlas-21.png](review-evidence/review01/atlas-21.png) | 无新增确定项 |
| D069.0 | `head_accessories/hair_clips/hair_clip_lower` | [查看 atlas-21.png](review-evidence/review01/atlas-21.png) | 无新增确定项 |
| D070.0 | `legs/leg_left/shoes/ankle_strap/ankle_strap_front` | [查看 atlas-22.png](review-evidence/review01/atlas-22.png) | 无新增确定项 |
| D071.0 | `legs/leg_left/shoes/shoe_body` | [查看 atlas-22.png](review-evidence/review01/atlas-22.png) | R16接界（修足） |
| D072.0 | `legs/leg_right/shoes/shoe_body` | [查看 atlas-23.png](review-evidence/review01/atlas-23.png) | R17接界（修足） |


完整原尺寸独显、隐藏上层及蒙版启用导出也已保留在 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/native/`，逐件绝对路径见 `export-index.json`。

## 只读核对与交付状态

- 保存的 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/character-depth.kra`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/groups.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/occlusion.json` 的检查前后 SHA256 完全一致。哈希在这里仅证明未改写输入，不用于画质判断。
- 本轮仅执行打开、图层／蒙版可见性切换、读取与 PNG 导出，没有保存 KRA 或改写任何分层输入。每轮导出均恢复原可见性；最终已核对所有图层／蒙版恢复默认开启，投影与检查开始时逐字节一致，并关闭本轮独立打开的文档且未保存。
- 原生层树、71 分片导出索引、23 张覆盖 atlas 索引及只读核对记录分别位于 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/actual-tree.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/export-index.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/atlas-index.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review01/read-only-verification.json`。
- 没有必要输入缺失、损坏或工具故障。检查完整完成；待修问题不构成 blocked。此文件仅为指定 review 暂存交付，未自行发布正式 review／repair 报告。
