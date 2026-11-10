结论：需要修复

# step01 独立 review-02

已查完当前工程全部 **65 个逻辑部件、69 个绘画分片、17 个原生透明度蒙版**。确认仍有 **9 项、17 个框选位置**需要修复，详见下文。本轮编号 R1–R9 独立于 review-01；没有依据旧报告的“通过”替代实际看图。

## 输入、检查方法与结论范围

- 工程：`../../raster-layering/step01/character-depth.kra`，在本次私有 Krita 5.3.4.1 中重新打开，画布 941×1672。
- 参考：按 `report.md` 确认采用 `../../part-layering/references/base-subject.png`。参考未移动、未配准变形、未改画；全部局部比较使用同一原画布坐标。参考主体外围的抠图杂色不作为需恢复的角色内容。
- 结构：读取 `part-layering/parts/`、`groups.json`、`occlusion.json`，与当前图层树逐项核对。65 个终端部件与 69 个深度分片对应；`neck`、`pelvis` 为无子节点的终端 group，按其实际完整绘画检查。没有把同一逻辑件的深度分片判作重复。
- 已读正式 `review-01.md`、`repair-01.md`；本次从当前 KRA 重新导出独显、蒙版启用独显、隐藏上层及蒙版停用隐藏上层，没有复用旧证据判定完成。
- 每件看完整独显与隐藏上层；整图同坐标对照原图，并对颈肩、衣片、肘腕、掌指、睑线眼内、耳部、嘴角、发束交界、腿间、踝链和足部在原尺寸及等倍率放大下检查。蒙版逐个在默认合成中启停，四个多深度件逐片与整件合看。

[当前默认合成](review-02-evidence/default.png) · [左参考／右当前整图](review-02-evidence/reference-comparison.png) · [带编号整图](review-02-evidence/annotations/composite/marked.png) · [全部问题坐标与图层](review-02-evidence/regions-index.json) · [实际图层树](review-02-evidence/tree.json) · [结构对应核验](review-02-evidence/structure-check.json)

以下只列有确定视觉证据的缺陷。合理隐藏底形、细微色调差异、原生控制导致的正常隐藏均予保留；未发现需要新增部件或重新分配深度的确定问题。上一轮明确的吊饰鬼影、足底黑点、掌指分件缺失等不能据旧结论重列；本轮反馈以当前剩余表现为准。

## 需要修复的问题

### R1：躯干与骨盆衣片仍有可见拼接及断缝线

**图层与位置：** `031.0 | body/torso | complete`、`013.0 | pelvis | complete`。R1a `[379,687,56,62]`，R1b `[508,687,52,62]`；位于腰腹下段两侧。

**当前表现、依据及影响：** 默认合成和隐藏上层均出现两片斜切的浅色布面，躯干底缘能被读成拼贴边；两侧原本连续的细缝线到交界骤停，下方短线与上段的方向、落点没有接上。参考在相同位置是连续布面和一笔顺下的侧缝。这是明确的材质硬边和断线，原尺寸可辨。

**修复方向及保留：** 在两件自身内先对齐同侧缝线的落点、切线与粗细，再按本侧布面的亮暗延续重叠区；消除躯干底缘的斜切色阶。必要时用原生接合蒙版辅助真实重叠，仍需先把两件各自纹理接顺。保留两件完整底形、现有长度位置、已恢复的腿口双边与裆尖材质。

[同坐标原图／两件独显／隐藏上层／默认合成](review-02-evidence/panels/R1.png) · [R1a 工具对照](review-02-evidence/annotations/composite/R1a-comparison.png) · [R1b 工具对照](review-02-evidence/annotations/composite/R1b-comparison.png)

### R2：双腕掌根蒙版启用后仍有肤色补丁边

**图层与位置：** 右腕为 `020.0 | arms/arm_right/forearm | complete`、`021.0 | arms/arm_right/hand/palm | complete`；左腕为 `022.0 | arms/arm_left/forearm | complete`、`029.0 | arms/arm_left/hand/palm | complete`，以及两掌的 `wrist_attachment_blend`。R2a `[280,770,47,39]`，R2b `[609,772,47,40]`。右／左均指角色自身，分别在画面左／右。

**当前表现、依据及影响：** 前臂末端较深，掌根为较浅的近均一面，交界呈曲线或斜切片状；左腕尤其能看出向右下切开的色阶。启用蒙版后边缘有所变淡，但补丁形状仍在。参考腕到掌的明暗沿体积连续，没有这条切换边。

**修复方向及保留：** 在本侧前臂末端和掌根各自延续纵向肤色塑形，先消除局部明暗包络不一致，再调整蒙版使真实重叠平顺。保留腕掌轮廓、拇指根位置、现有掌纹及独立手指；不增加盖在交界上的新肤色片。

[左右腕四视图](review-02-evidence/panels/R2.png) · [R2a 工具对照](review-02-evidence/annotations/composite/R2a-comparison.png) · [R2b 工具对照](review-02-evidence/annotations/composite/R2b-comparison.png) · [右腕蒙版启停](review-02-evidence/inspection/masks-1-4.png) · [左腕蒙版启停](review-02-evidence/inspection/masks-5-8.png)

### R3：右食指及双拇指的隐藏补根仍呈单色帽状拼块

**图层与位置：** R3a `017.0 | arms/arm_right/hand/index_finger | complete`，`[286,831,29,33]`；R3b `018.0 | arms/arm_right/hand/thumb | complete`，`[303,816,24,34]`；R3c `028.0 | arms/arm_left/hand/thumb | complete`，`[611,820,22,32]`。

**当前表现、依据及影响：** 完整独显中，右食指约 y849 有横向硬色界，侧缘暗线到此骤停，上方为均一浅色根帽。双拇指的原有纵向明暗接到补根时，也出现角状或弧状的浅色块边。隐藏上层后这些边仍在，默认被掌片盖住并不代表完整部件已连续。

**参考依据：** 这些根部在原图被掌遮住，原图不能直接证明隐藏形状；确定缺陷是当前同一手指内的硬色阶、笔触突然终止。以该指自身可见段的肤色及明暗方向作为接续依据，允许合理补根形状。

**修复方向及保留：** 从本指已有指体向根端整体延续材质和边缘明暗，把帽状边融入连续指体；保留指尖长度、指甲、叠指暗线和现有独立归属。不要复制原图同坐标的掌纹或其他手指来填根。

[三处原图／完整独显／隐藏上层／默认合成](review-02-evidence/panels/R3.png) · [R3a 标记](review-02-evidence/annotations/right-index/marked.png)／[工具对照](review-02-evidence/annotations/right-index/R3a-comparison.png) · [R3b 标记](review-02-evidence/annotations/right-thumb/marked.png)／[工具对照](review-02-evidence/annotations/right-thumb/R3b-comparison.png) · [R3c 标记](review-02-evidence/annotations/left-thumb/marked.png)／[工具对照](review-02-evidence/annotations/left-thumb/R3c-comparison.png)

### R4：颈部底端补全存在水平色阶和单色倒三角

**图层与位置：** `030.0 | neck | complete`，R4 `[416,351,107,20]`，主要为 y359–367 的隐藏底端。

**当前表现、依据及影响：** 本颈纵向柔和明暗在近水平边上突然结束，下端倒三角为单一桃肤色。完整独显和隐藏上层可以清楚读出补片边，默认被 torso 盖住。隐藏区没有直接可见原画可要求照抄，确定问题是同一颈部内部的色阶和明暗骤停。

**修复方向及保留：** 在 neck 本层将已画颈部的连续肤色明暗延伸到底端，消除平直填色上缘；无需添加新的解剖线或阴影。保留颌下原有明暗、颈侧轮廓、底端覆盖余量和默认颈肩接合。参考同坐标的锁骨属于 torso，不得复制入 neck。

[四视图](review-02-evidence/panels/R4.png) · [R4 标记](review-02-evidence/annotations/neck/marked.png) · [R4 工具对照](review-02-evidence/annotations/neck/R4-comparison.png)

### R5：两条细鬓发的可见描边及亮暗折面丢失

**图层与位置：** `059.0 | hair/sidelock/sidelock_right | complete`，R5a `[362,231,53,115]`；`060.0 | hair/sidelock/sidelock_left | complete`，R5b `[522,231,53,115]`。

**当前表现、依据及影响：** 原图两束有清晰细灰暗边、窄亮面和沿弧线收尖的笔触，当前下弧大部变成均匀、偏模糊的白色软带；与原图以及相邻清晰的宽侧发画法不一致。此差异在默认合成、完整独显及隐藏上层中都能定位，不只是细微色调差异。

**修复方向及保留：** 恢复本侧本束原可见段的细边和亮暗面，沿既定弧线接到隐藏根部与尖梢，使宽度、暗边线重及收尖方式连续。保留当前连续的完整根梢、总体长度、外弯位置与侧发前后的层序；不把耳廓或耳饰暗线带入发束。

[左右鬓发四视图](review-02-evidence/panels/R5.png) · [R5a 工具对照](review-02-evidence/annotations/composite/R5a-comparison.png) · [R5b 工具对照](review-02-evidence/annotations/composite/R5b-comparison.png)

### R6：双眉可见段被简化为灰色实心弧

**图层与位置：** `056.0 | face/eyebrows/eyebrow_right | complete`，R6a `[407,187,49,14]`；`057.0 | face/eyebrows/eyebrow_left | complete`，R6b `[482,187,50,14]`。

**当前表现、依据及影响：** 参考两眉具有细暗边和窄亮芯，当前为近均一的灰色填充，细线面层次消失。完整独显显示该简化来自眉自身；合成后眉的笔触和原画不符。

**修复方向及保留：** 在各眉自身内恢复该侧可见眉段的细边、窄亮部和渐尖笔触，再自然延续至遮住的眉尾。保留现有整眉范围、左右位置、长度及独立控制，不把周围肤色或前发作为眉内容。

[双眉四视图](review-02-evidence/panels/R6.png) · [R6a 工具对照](review-02-evidence/annotations/composite/R6a-comparison.png) · [R6b 工具对照](review-02-evidence/annotations/composite/R6b-comparison.png)

### R7：两耳上方露出的三角区没有恢复原有耳内画法

**图层与位置：** `035.0 | face/ears/ear_right | complete`、`036.0 | face/ears/ear_left | complete` 及各自 `face_and_side_hair_default_occlusion`。R7a `[379,223,29,32]`，R7b `[533,223,29,32]`；即宽侧发与细鬓发之间的小块上耳露出区。

**当前表现、依据及影响：** 参考该区是较深的红褐耳内面，与下段耳廓画法相连；当前为浅肤色面和几根新的斜线。下耳已恢复较细的原画笔触，上耳仍保留另一套画法，使同一耳部出现明显深浅和线面断续。停用耳蒙版、看完整耳层可确认来源属于耳自身。

**修复方向及保留：** 恢复本侧上耳实际可见暗面、耳廓细线和必要亮边，在完整耳层内与已恢复的下耳接顺。这是恢复原有耳内绘画，无需新增独立阴影层。保留完整普通人耳形、下耳现有有效笔触、耳垂及默认遮挡范围；不改宽侧发或细鬓发去盖住差异。

[双耳四视图](review-02-evidence/panels/R7.png) · [R7a 工具对照](review-02-evidence/annotations/composite/R7a-comparison.png) · [R7b 工具对照](review-02-evidence/annotations/composite/R7b-comparison.png) · [耳蒙版启停](review-02-evidence/inspection/masks-9-12.png)

### R8：双踝至足背侧边描边缺失，轮廓呈块状凹凸

**图层与位置：** `009.0 | legs/leg_right/leg | complete`，R8a `[408,1512,61,75]`；`010.0 | legs/leg_left/leg | complete`，R8b `[474,1512,61,75]`。

**当前表现、依据及影响：** 原图足踝两侧是连续细轮廓，当前在前链下方至足背上段出现多处小凸点、方形凹口和阶梯状外缘，原有细暗边大段中断。独显与默认合成一致，属于 leg 本层边界，不能归咎于前踝链或背景。原尺寸就有破碎边感，放大能看到实际轮廓被局部切碎。

**修复方向及保留：** 在各 leg 自身修顺这一段 alpha 外缘和连续细描边，去掉局部凸点、补齐凹口，使足踝曲线与原可见形体一致；保留完整腿足、既有趾缝和甲缘、现已接通的足背链根。前后踝链仍各自独立，足背链仍归 leg，不用实心肤色外扩掩盖珠链空隙。

[双踝四视图](review-02-evidence/panels/R8.png) · [R8a 工具对照](review-02-evidence/annotations/composite/R8a-comparison.png) · [R8b 工具对照](review-02-evidence/annotations/composite/R8b-comparison.png)

### R9：右眼暗瞳被画成横向扁斑

**图层与位置：** `045.0 | face/eyes/eye_right/iris | complete`，R9 `[427,216,20,18]`，画面左眼的虹膜中央。

**当前表现、依据及影响：** 原图暗瞳为近圆／斜椭圆的连续暗形，当前左右拉宽，右缘拖出明显突起，成为横向扁斑。完整 iris 独显可见同样形状，默认合成中也改变了视线中心的形体。

**修复方向及保留：** 在本 iris 内按该眼原有可见暗瞳的轮廓、位置和边缘深浅恢复连续暗形，清除右侧横向拖出部分并接顺虹膜纹理。保留完整虹膜、现有独立高光、虹膜外缘、眼白剪贴及上下睑共享开口；不新增瞳孔 part，也不改眼睑来掩盖。

[原图／虹膜独显／隐藏上层／默认合成](review-02-evidence/panels/R9.png) · [R9 工具对照](review-02-evidence/annotations/composite/R9-comparison.png)

## 逐件检查覆盖

下表每行均已实际看过。独显“停用”同时停用显隐蒙版及继承透明度，以看完整本件；“启用”保留蒙版但关闭独显时无底件可继承的透明度依赖。隐藏上层保留所有不高于本件最高深度的绘画，分别导出蒙版停用和启用状态。原生剪贴与默认层序在整图及蒙版逐个切换中另行检查。多深度逻辑件的独显是分片合看，逐片证据列在后节。

“未另列问题”表示本轮没有确定需要修复的额外缺陷，不覆盖该件作为 R1、R2 相邻接续对象所需的配合调整。

| 逻辑部件 | 实际深度 | 完整独显／蒙版启用 | 隐藏上层：停用／启用 | 本轮结果 |
|---|---|---|---|---|
| `hair/back_hair/long_hair_right` | 1.0 | [停用](review-02-evidence/isolated/01-hair__back_hair__long_hair_right.png)／[启用](review-02-evidence/masked/01-hair__back_hair__long_hair_right.png) | [停用](review-02-evidence/reveal-off/01-hair__back_hair__long_hair_right.png)／[启用](review-02-evidence/reveal/01-hair__back_hair__long_hair_right.png) | 未另列问题 |
| `hair/back_hair/long_hair_left` | 2.0 | [停用](review-02-evidence/isolated/02-hair__back_hair__long_hair_left.png)／[启用](review-02-evidence/masked/02-hair__back_hair__long_hair_left.png) | [停用](review-02-evidence/reveal-off/02-hair__back_hair__long_hair_left.png)／[启用](review-02-evidence/reveal/02-hair__back_hair__long_hair_left.png) | 未另列问题 |
| `hair/back_hair/cap` | 3.0 | [停用](review-02-evidence/isolated/03-hair__back_hair__cap.png)／[启用](review-02-evidence/masked/03-hair__back_hair__cap.png) | [停用](review-02-evidence/reveal-off/03-hair__back_hair__cap.png)／[启用](review-02-evidence/reveal/03-hair__back_hair__cap.png) | 未另列问题 |
| `hair/bun` | 4.0 | [停用](review-02-evidence/isolated/04-hair__bun.png)／[启用](review-02-evidence/masked/04-hair__bun.png) | [停用](review-02-evidence/reveal-off/04-hair__bun.png)／[启用](review-02-evidence/reveal/04-hair__bun.png) | 未另列问题 |
| `head_accessories/crown_pendants/crown_pendant_right` | 5.0 | [停用](review-02-evidence/isolated/05-head_accessories__crown_pendants__crown_pendant_right.png)／[启用](review-02-evidence/masked/05-head_accessories__crown_pendants__crown_pendant_right.png) | [停用](review-02-evidence/reveal-off/05-head_accessories__crown_pendants__crown_pendant_right.png)／[启用](review-02-evidence/reveal/05-head_accessories__crown_pendants__crown_pendant_right.png) | 未另列问题 |
| `head_accessories/crown_pendants/crown_pendant_left` | 6.0 | [停用](review-02-evidence/isolated/06-head_accessories__crown_pendants__crown_pendant_left.png)／[启用](review-02-evidence/masked/06-head_accessories__crown_pendants__crown_pendant_left.png) | [停用](review-02-evidence/reveal-off/06-head_accessories__crown_pendants__crown_pendant_left.png)／[启用](review-02-evidence/reveal/06-head_accessories__crown_pendants__crown_pendant_left.png) | 未另列问题 |
| `legs/leg_right/anklet_back` | 7.0 | [停用](review-02-evidence/isolated/07-legs__leg_right__anklet_back.png)／[启用](review-02-evidence/masked/07-legs__leg_right__anklet_back.png) | [停用](review-02-evidence/reveal-off/07-legs__leg_right__anklet_back.png)／[启用](review-02-evidence/reveal/07-legs__leg_right__anklet_back.png) | 未另列问题 |
| `legs/leg_left/anklet_back` | 8.0 | [停用](review-02-evidence/isolated/08-legs__leg_left__anklet_back.png)／[启用](review-02-evidence/masked/08-legs__leg_left__anklet_back.png) | [停用](review-02-evidence/reveal-off/08-legs__leg_left__anklet_back.png)／[启用](review-02-evidence/reveal/08-legs__leg_left__anklet_back.png) | 未另列问题 |
| `legs/leg_right/leg` | 9.0 | [停用](review-02-evidence/isolated/09-legs__leg_right__leg.png)／[启用](review-02-evidence/masked/09-legs__leg_right__leg.png) | [停用](review-02-evidence/reveal-off/09-legs__leg_right__leg.png)／[启用](review-02-evidence/reveal/09-legs__leg_right__leg.png) | R8a |
| `legs/leg_left/leg` | 10.0 | [停用](review-02-evidence/isolated/10-legs__leg_left__leg.png)／[启用](review-02-evidence/masked/10-legs__leg_left__leg.png) | [停用](review-02-evidence/reveal-off/10-legs__leg_left__leg.png)／[启用](review-02-evidence/reveal/10-legs__leg_left__leg.png) | R8b |
| `legs/leg_right/anklet_front` | 11.0 | [停用](review-02-evidence/isolated/11-legs__leg_right__anklet_front.png)／[启用](review-02-evidence/masked/11-legs__leg_right__anklet_front.png) | [停用](review-02-evidence/reveal-off/11-legs__leg_right__anklet_front.png)／[启用](review-02-evidence/reveal/11-legs__leg_right__anklet_front.png) | 未另列问题 |
| `legs/leg_left/anklet_front` | 12.0 | [停用](review-02-evidence/isolated/12-legs__leg_left__anklet_front.png)／[启用](review-02-evidence/masked/12-legs__leg_left__anklet_front.png) | [停用](review-02-evidence/reveal-off/12-legs__leg_left__anklet_front.png)／[启用](review-02-evidence/reveal/12-legs__leg_left__anklet_front.png) | 未另列问题 |
| `pelvis` | 13.0 | [停用](review-02-evidence/isolated/13-pelvis.png)／[启用](review-02-evidence/masked/13-pelvis.png) | [停用](review-02-evidence/reveal-off/13-pelvis.png)／[启用](review-02-evidence/reveal/13-pelvis.png) | R1 |
| `arms/arm_right/hand/little_finger` | 14.0 | [停用](review-02-evidence/isolated/14-arms__arm_right__hand__little_finger.png)／[启用](review-02-evidence/masked/14-arms__arm_right__hand__little_finger.png) | [停用](review-02-evidence/reveal-off/14-arms__arm_right__hand__little_finger.png)／[启用](review-02-evidence/reveal/14-arms__arm_right__hand__little_finger.png) | 未另列问题 |
| `arms/arm_right/hand/ring_finger` | 15.0 | [停用](review-02-evidence/isolated/15-arms__arm_right__hand__ring_finger.png)／[启用](review-02-evidence/masked/15-arms__arm_right__hand__ring_finger.png) | [停用](review-02-evidence/reveal-off/15-arms__arm_right__hand__ring_finger.png)／[启用](review-02-evidence/reveal/15-arms__arm_right__hand__ring_finger.png) | 未另列问题 |
| `arms/arm_right/hand/middle_finger` | 16.0 | [停用](review-02-evidence/isolated/16-arms__arm_right__hand__middle_finger.png)／[启用](review-02-evidence/masked/16-arms__arm_right__hand__middle_finger.png) | [停用](review-02-evidence/reveal-off/16-arms__arm_right__hand__middle_finger.png)／[启用](review-02-evidence/reveal/16-arms__arm_right__hand__middle_finger.png) | 未另列问题 |
| `arms/arm_right/hand/index_finger` | 17.0 | [停用](review-02-evidence/isolated/17-arms__arm_right__hand__index_finger.png)／[启用](review-02-evidence/masked/17-arms__arm_right__hand__index_finger.png) | [停用](review-02-evidence/reveal-off/17-arms__arm_right__hand__index_finger.png)／[启用](review-02-evidence/reveal/17-arms__arm_right__hand__index_finger.png) | R3a |
| `arms/arm_right/hand/thumb` | 18.0 | [停用](review-02-evidence/isolated/18-arms__arm_right__hand__thumb.png)／[启用](review-02-evidence/masked/18-arms__arm_right__hand__thumb.png) | [停用](review-02-evidence/reveal-off/18-arms__arm_right__hand__thumb.png)／[启用](review-02-evidence/reveal/18-arms__arm_right__hand__thumb.png) | R3b |
| `arms/arm_right/upper_arm` | 19.0 | [停用](review-02-evidence/isolated/19-arms__arm_right__upper_arm.png)／[启用](review-02-evidence/masked/19-arms__arm_right__upper_arm.png) | [停用](review-02-evidence/reveal-off/19-arms__arm_right__upper_arm.png)／[启用](review-02-evidence/reveal/19-arms__arm_right__upper_arm.png) | 未另列问题 |
| `arms/arm_right/forearm` | 20.0 | [停用](review-02-evidence/isolated/20-arms__arm_right__forearm.png)／[启用](review-02-evidence/masked/20-arms__arm_right__forearm.png) | [停用](review-02-evidence/reveal-off/20-arms__arm_right__forearm.png)／[启用](review-02-evidence/reveal/20-arms__arm_right__forearm.png) | R2（相邻前臂） |
| `arms/arm_right/hand/palm` | 21.0 | [停用](review-02-evidence/isolated/21-arms__arm_right__hand__palm.png)／[启用](review-02-evidence/masked/21-arms__arm_right__hand__palm.png) | [停用](review-02-evidence/reveal-off/21-arms__arm_right__hand__palm.png)／[启用](review-02-evidence/reveal/21-arms__arm_right__hand__palm.png) | R2 |
| `arms/arm_left/forearm` | 22.0 | [停用](review-02-evidence/isolated/22-arms__arm_left__forearm.png)／[启用](review-02-evidence/masked/22-arms__arm_left__forearm.png) | [停用](review-02-evidence/reveal-off/22-arms__arm_left__forearm.png)／[启用](review-02-evidence/reveal/22-arms__arm_left__forearm.png) | R2（相邻前臂） |
| `arms/arm_left/upper_arm` | 23.0 | [停用](review-02-evidence/isolated/23-arms__arm_left__upper_arm.png)／[启用](review-02-evidence/masked/23-arms__arm_left__upper_arm.png) | [停用](review-02-evidence/reveal-off/23-arms__arm_left__upper_arm.png)／[启用](review-02-evidence/reveal/23-arms__arm_left__upper_arm.png) | 未另列问题 |
| `arms/arm_left/hand/index_finger` | 24.0 | [停用](review-02-evidence/isolated/24-arms__arm_left__hand__index_finger.png)／[启用](review-02-evidence/masked/24-arms__arm_left__hand__index_finger.png) | [停用](review-02-evidence/reveal-off/24-arms__arm_left__hand__index_finger.png)／[启用](review-02-evidence/reveal/24-arms__arm_left__hand__index_finger.png) | 未另列问题 |
| `arms/arm_left/hand/middle_finger` | 25.0 | [停用](review-02-evidence/isolated/25-arms__arm_left__hand__middle_finger.png)／[启用](review-02-evidence/masked/25-arms__arm_left__hand__middle_finger.png) | [停用](review-02-evidence/reveal-off/25-arms__arm_left__hand__middle_finger.png)／[启用](review-02-evidence/reveal/25-arms__arm_left__hand__middle_finger.png) | 未另列问题 |
| `arms/arm_left/hand/little_finger` | 26.0 | [停用](review-02-evidence/isolated/26-arms__arm_left__hand__little_finger.png)／[启用](review-02-evidence/masked/26-arms__arm_left__hand__little_finger.png) | [停用](review-02-evidence/reveal-off/26-arms__arm_left__hand__little_finger.png)／[启用](review-02-evidence/reveal/26-arms__arm_left__hand__little_finger.png) | 未另列问题 |
| `arms/arm_left/hand/ring_finger` | 27.0 | [停用](review-02-evidence/isolated/27-arms__arm_left__hand__ring_finger.png)／[启用](review-02-evidence/masked/27-arms__arm_left__hand__ring_finger.png) | [停用](review-02-evidence/reveal-off/27-arms__arm_left__hand__ring_finger.png)／[启用](review-02-evidence/reveal/27-arms__arm_left__hand__ring_finger.png) | 未另列问题 |
| `arms/arm_left/hand/thumb` | 28.0 | [停用](review-02-evidence/isolated/28-arms__arm_left__hand__thumb.png)／[启用](review-02-evidence/masked/28-arms__arm_left__hand__thumb.png) | [停用](review-02-evidence/reveal-off/28-arms__arm_left__hand__thumb.png)／[启用](review-02-evidence/reveal/28-arms__arm_left__hand__thumb.png) | R3c |
| `arms/arm_left/hand/palm` | 29.0 | [停用](review-02-evidence/isolated/29-arms__arm_left__hand__palm.png)／[启用](review-02-evidence/masked/29-arms__arm_left__hand__palm.png) | [停用](review-02-evidence/reveal-off/29-arms__arm_left__hand__palm.png)／[启用](review-02-evidence/reveal/29-arms__arm_left__hand__palm.png) | R2 |
| `neck` | 30.0 | [停用](review-02-evidence/isolated/30-neck.png)／[启用](review-02-evidence/masked/30-neck.png) | [停用](review-02-evidence/reveal-off/30-neck.png)／[启用](review-02-evidence/reveal/30-neck.png) | R4 |
| `body/torso` | 31.0 | [停用](review-02-evidence/isolated/31-body__torso.png)／[启用](review-02-evidence/masked/31-body__torso.png) | [停用](review-02-evidence/reveal-off/31-body__torso.png)／[启用](review-02-evidence/reveal/31-body__torso.png) | R1 |
| `body/breast` | 32.0 | [停用](review-02-evidence/isolated/32-body__breast.png)／[启用](review-02-evidence/masked/32-body__breast.png) | [停用](review-02-evidence/reveal-off/32-body__breast.png)／[启用](review-02-evidence/reveal/32-body__breast.png) | 未另列问题 |
| `head_accessories/earrings/earring_right` | 33.0 | [停用](review-02-evidence/isolated/33-head_accessories__earrings__earring_right.png)／[启用](review-02-evidence/masked/33-head_accessories__earrings__earring_right.png) | [停用](review-02-evidence/reveal-off/33-head_accessories__earrings__earring_right.png)／[启用](review-02-evidence/reveal/33-head_accessories__earrings__earring_right.png) | 未另列问题 |
| `head_accessories/earrings/earring_left` | 34.0 | [停用](review-02-evidence/isolated/34-head_accessories__earrings__earring_left.png)／[启用](review-02-evidence/masked/34-head_accessories__earrings__earring_left.png) | [停用](review-02-evidence/reveal-off/34-head_accessories__earrings__earring_left.png)／[启用](review-02-evidence/reveal/34-head_accessories__earrings__earring_left.png) | 未另列问题 |
| `face/ears/ear_right` | 35.0 | [停用](review-02-evidence/isolated/35-face__ears__ear_right.png)／[启用](review-02-evidence/masked/35-face__ears__ear_right.png) | [停用](review-02-evidence/reveal-off/35-face__ears__ear_right.png)／[启用](review-02-evidence/reveal/35-face__ears__ear_right.png) | R7a |
| `face/ears/ear_left` | 36.0 | [停用](review-02-evidence/isolated/36-face__ears__ear_left.png)／[启用](review-02-evidence/masked/36-face__ears__ear_left.png) | [停用](review-02-evidence/reveal-off/36-face__ears__ear_left.png)／[启用](review-02-evidence/reveal/36-face__ears__ear_left.png) | R7b |
| `face/face_base` | 37.0 | [停用](review-02-evidence/isolated/37-face__face_base.png)／[启用](review-02-evidence/masked/37-face__face_base.png) | [停用](review-02-evidence/reveal-off/37-face__face_base.png)／[启用](review-02-evidence/reveal/37-face__face_base.png) | 未另列问题 |
| `face/eyes/eye_left/sclera` | 38.0 | [停用](review-02-evidence/isolated/38-face__eyes__eye_left__sclera.png)／[启用](review-02-evidence/masked/38-face__eyes__eye_left__sclera.png) | [停用](review-02-evidence/reveal-off/38-face__eyes__eye_left__sclera.png)／[启用](review-02-evidence/reveal/38-face__eyes__eye_left__sclera.png) | 未另列问题 |
| `face/eyes/eye_left/iris` | 39.0 | [停用](review-02-evidence/isolated/39-face__eyes__eye_left__iris.png)／[启用](review-02-evidence/masked/39-face__eyes__eye_left__iris.png) | [停用](review-02-evidence/reveal-off/39-face__eyes__eye_left__iris.png)／[启用](review-02-evidence/reveal/39-face__eyes__eye_left__iris.png) | 未另列问题 |
| `face/eyes/eye_left/highlight` | 40.0 | [停用](review-02-evidence/isolated/40-face__eyes__eye_left__highlight.png)／[启用](review-02-evidence/masked/40-face__eyes__eye_left__highlight.png) | [停用](review-02-evidence/reveal-off/40-face__eyes__eye_left__highlight.png)／[启用](review-02-evidence/reveal/40-face__eyes__eye_left__highlight.png) | 未另列问题 |
| `face/eyes/eye_left/lower_eyelid` | 41.0 | [停用](review-02-evidence/isolated/41-face__eyes__eye_left__lower_eyelid.png)／[启用](review-02-evidence/masked/41-face__eyes__eye_left__lower_eyelid.png) | [停用](review-02-evidence/reveal-off/41-face__eyes__eye_left__lower_eyelid.png)／[启用](review-02-evidence/reveal/41-face__eyes__eye_left__lower_eyelid.png) | 未另列问题 |
| `face/eyes/eye_left/upper_eyelid` | 42.0, 66.0 | [停用](review-02-evidence/isolated/42-face__eyes__eye_left__upper_eyelid.png)／[启用](review-02-evidence/masked/42-face__eyes__eye_left__upper_eyelid.png) | [停用](review-02-evidence/reveal-off/42-face__eyes__eye_left__upper_eyelid.png)／[启用](review-02-evidence/reveal/42-face__eyes__eye_left__upper_eyelid.png) | 未另列问题 |
| `face/eyes/eye_left/eyelid_crease` | 43.0 | [停用](review-02-evidence/isolated/43-face__eyes__eye_left__eyelid_crease.png)／[启用](review-02-evidence/masked/43-face__eyes__eye_left__eyelid_crease.png) | [停用](review-02-evidence/reveal-off/43-face__eyes__eye_left__eyelid_crease.png)／[启用](review-02-evidence/reveal/43-face__eyes__eye_left__eyelid_crease.png) | 未另列问题 |
| `face/eyes/eye_right/sclera` | 44.0 | [停用](review-02-evidence/isolated/44-face__eyes__eye_right__sclera.png)／[启用](review-02-evidence/masked/44-face__eyes__eye_right__sclera.png) | [停用](review-02-evidence/reveal-off/44-face__eyes__eye_right__sclera.png)／[启用](review-02-evidence/reveal/44-face__eyes__eye_right__sclera.png) | 未另列问题 |
| `face/eyes/eye_right/iris` | 45.0 | [停用](review-02-evidence/isolated/45-face__eyes__eye_right__iris.png)／[启用](review-02-evidence/masked/45-face__eyes__eye_right__iris.png) | [停用](review-02-evidence/reveal-off/45-face__eyes__eye_right__iris.png)／[启用](review-02-evidence/reveal/45-face__eyes__eye_right__iris.png) | R9 |
| `face/eyes/eye_right/highlight` | 46.0 | [停用](review-02-evidence/isolated/46-face__eyes__eye_right__highlight.png)／[启用](review-02-evidence/masked/46-face__eyes__eye_right__highlight.png) | [停用](review-02-evidence/reveal-off/46-face__eyes__eye_right__highlight.png)／[启用](review-02-evidence/reveal/46-face__eyes__eye_right__highlight.png) | 未另列问题 |
| `face/eyes/eye_right/lower_eyelid` | 47.0 | [停用](review-02-evidence/isolated/47-face__eyes__eye_right__lower_eyelid.png)／[启用](review-02-evidence/masked/47-face__eyes__eye_right__lower_eyelid.png) | [停用](review-02-evidence/reveal-off/47-face__eyes__eye_right__lower_eyelid.png)／[启用](review-02-evidence/reveal/47-face__eyes__eye_right__lower_eyelid.png) | 未另列问题 |
| `face/eyes/eye_right/upper_eyelid` | 48.0, 66.5 | [停用](review-02-evidence/isolated/48-face__eyes__eye_right__upper_eyelid.png)／[启用](review-02-evidence/masked/48-face__eyes__eye_right__upper_eyelid.png) | [停用](review-02-evidence/reveal-off/48-face__eyes__eye_right__upper_eyelid.png)／[启用](review-02-evidence/reveal/48-face__eyes__eye_right__upper_eyelid.png) | 未另列问题 |
| `face/eyes/eye_right/eyelid_crease` | 49.0 | [停用](review-02-evidence/isolated/49-face__eyes__eye_right__eyelid_crease.png)／[启用](review-02-evidence/masked/49-face__eyes__eye_right__eyelid_crease.png) | [停用](review-02-evidence/reveal-off/49-face__eyes__eye_right__eyelid_crease.png)／[启用](review-02-evidence/reveal/49-face__eyes__eye_right__eyelid_crease.png) | 未另列问题 |
| `face/mouth/mouth_interior` | 50.0 | [停用](review-02-evidence/isolated/50-face__mouth__mouth_interior.png)／[启用](review-02-evidence/masked/50-face__mouth__mouth_interior.png) | [停用](review-02-evidence/reveal-off/50-face__mouth__mouth_interior.png)／[启用](review-02-evidence/reveal/50-face__mouth__mouth_interior.png) | 未另列问题 |
| `face/mouth/lower_teeth` | 51.0 | [停用](review-02-evidence/isolated/51-face__mouth__lower_teeth.png)／[启用](review-02-evidence/masked/51-face__mouth__lower_teeth.png) | [停用](review-02-evidence/reveal-off/51-face__mouth__lower_teeth.png)／[启用](review-02-evidence/reveal/51-face__mouth__lower_teeth.png) | 未另列问题 |
| `face/mouth/tongue` | 52.0 | [停用](review-02-evidence/isolated/52-face__mouth__tongue.png)／[启用](review-02-evidence/masked/52-face__mouth__tongue.png) | [停用](review-02-evidence/reveal-off/52-face__mouth__tongue.png)／[启用](review-02-evidence/reveal/52-face__mouth__tongue.png) | 未另列问题 |
| `face/mouth/upper_teeth` | 53.0 | [停用](review-02-evidence/isolated/53-face__mouth__upper_teeth.png)／[启用](review-02-evidence/masked/53-face__mouth__upper_teeth.png) | [停用](review-02-evidence/reveal-off/53-face__mouth__upper_teeth.png)／[启用](review-02-evidence/reveal/53-face__mouth__upper_teeth.png) | 未另列问题 |
| `face/mouth/lower_lip` | 54.0 | [停用](review-02-evidence/isolated/54-face__mouth__lower_lip.png)／[启用](review-02-evidence/masked/54-face__mouth__lower_lip.png) | [停用](review-02-evidence/reveal-off/54-face__mouth__lower_lip.png)／[启用](review-02-evidence/reveal/54-face__mouth__lower_lip.png) | 未另列问题 |
| `face/mouth/upper_lip` | 55.0 | [停用](review-02-evidence/isolated/55-face__mouth__upper_lip.png)／[启用](review-02-evidence/masked/55-face__mouth__upper_lip.png) | [停用](review-02-evidence/reveal-off/55-face__mouth__upper_lip.png)／[启用](review-02-evidence/reveal/55-face__mouth__upper_lip.png) | 未另列问题 |
| `face/eyebrows/eyebrow_right` | 56.0 | [停用](review-02-evidence/isolated/56-face__eyebrows__eyebrow_right.png)／[启用](review-02-evidence/masked/56-face__eyebrows__eyebrow_right.png) | [停用](review-02-evidence/reveal-off/56-face__eyebrows__eyebrow_right.png)／[启用](review-02-evidence/reveal/56-face__eyebrows__eyebrow_right.png) | R6a |
| `face/eyebrows/eyebrow_left` | 57.0 | [停用](review-02-evidence/isolated/57-face__eyebrows__eyebrow_left.png)／[启用](review-02-evidence/masked/57-face__eyebrows__eyebrow_left.png) | [停用](review-02-evidence/reveal-off/57-face__eyebrows__eyebrow_left.png)／[启用](review-02-evidence/reveal/57-face__eyebrows__eyebrow_left.png) | R6b |
| `face/nose` | 58.0 | [停用](review-02-evidence/isolated/58-face__nose.png)／[启用](review-02-evidence/masked/58-face__nose.png) | [停用](review-02-evidence/reveal-off/58-face__nose.png)／[启用](review-02-evidence/reveal/58-face__nose.png) | 未另列问题 |
| `hair/sidelock/sidelock_right` | 59.0 | [停用](review-02-evidence/isolated/59-hair__sidelock__sidelock_right.png)／[启用](review-02-evidence/masked/59-hair__sidelock__sidelock_right.png) | [停用](review-02-evidence/reveal-off/59-hair__sidelock__sidelock_right.png)／[启用](review-02-evidence/reveal/59-hair__sidelock__sidelock_right.png) | R5a |
| `hair/sidelock/sidelock_left` | 60.0 | [停用](review-02-evidence/isolated/60-hair__sidelock__sidelock_left.png)／[启用](review-02-evidence/masked/60-hair__sidelock__sidelock_left.png) | [停用](review-02-evidence/reveal-off/60-hair__sidelock__sidelock_left.png)／[启用](review-02-evidence/reveal/60-hair__sidelock__sidelock_left.png) | R5b |
| `head_accessories/bun_ornament` | 61.0 | [停用](review-02-evidence/isolated/61-head_accessories__bun_ornament.png)／[启用](review-02-evidence/masked/61-head_accessories__bun_ornament.png) | [停用](review-02-evidence/reveal-off/61-head_accessories__bun_ornament.png)／[启用](review-02-evidence/reveal/61-head_accessories__bun_ornament.png) | 未另列问题 |
| `head_accessories/crown_frame` | 61.5, 67.0 | [停用](review-02-evidence/isolated/62-head_accessories__crown_frame.png)／[启用](review-02-evidence/masked/62-head_accessories__crown_frame.png) | [停用](review-02-evidence/reveal-off/62-head_accessories__crown_frame.png)／[启用](review-02-evidence/reveal/62-head_accessories__crown_frame.png) | 未另列问题 |
| `head_accessories/forehead_pendant` | 62.0, 65.0 | [停用](review-02-evidence/isolated/63-head_accessories__forehead_pendant.png)／[启用](review-02-evidence/masked/63-head_accessories__forehead_pendant.png) | [停用](review-02-evidence/reveal-off/63-head_accessories__forehead_pendant.png)／[启用](review-02-evidence/reveal/63-head_accessories__forehead_pendant.png) | 未另列问题 |
| `hair/side_hair/side_hair_right` | 63.0 | [停用](review-02-evidence/isolated/64-hair__side_hair__side_hair_right.png)／[启用](review-02-evidence/masked/64-hair__side_hair__side_hair_right.png) | [停用](review-02-evidence/reveal-off/64-hair__side_hair__side_hair_right.png)／[启用](review-02-evidence/reveal/64-hair__side_hair__side_hair_right.png) | 未另列问题 |
| `hair/side_hair/side_hair_left` | 64.0 | [停用](review-02-evidence/isolated/65-hair__side_hair__side_hair_left.png)／[启用](review-02-evidence/masked/65-hair__side_hair__side_hair_left.png) | [停用](review-02-evidence/reveal-off/65-hair__side_hair__side_hair_left.png)／[启用](review-02-evidence/reveal/65-hair__side_hair__side_hair_left.png) | 未另列问题 |

全部部件的同坐标五列检查图保存在 [inspection/parts/](review-02-evidence/inspection/parts/)，每件依次为原参考、完整独显、蒙版启用独显、隐藏上层、默认整图局部。[原始导出索引](review-02-evidence/index.json) 列出全部 65 件与图层名。

## 蒙版与深度分片检查

17 个透明度蒙版都逐个在默认合成中启用／停用看过；同名蒙版按所属对象分别计数。下牙及后踝链的完整绘画在停用控制后的独显中存在，默认隐藏符合参考。前后链去掉腿部后合看成连续环，本轮不要求重画链环或更改其归属。肩、肘等接合蒙版停用产生的正常覆盖边不单列为问题；默认启用仍存在的腕部补丁已列 R2。

| 控制对象 | 蒙版 | 实看证据 |
|---|---|---|
| 左右后踝链、右肘、右腕 | 后链默认隐藏×2、upper_arm_attachment_blend、wrist_attachment_blend | [1–4 启停局部](review-02-evidence/inspection/masks-1-4.png) |
| 左肘、左腕、躯干颈肩、胸片 | forearm_attachment_blend、wrist_attachment_blend、neck_and_shoulder_attachment_blend、torso_attachment_blend | [5–8 启停局部](review-02-evidence/inspection/masks-5-8.png) |
| 左右耳、左右眼内开口 | face_and_side_hair_default_occlusion×2、upper_and_lower_eyelid_opening×2 | [9–12 启停局部](review-02-evidence/inspection/masks-9-12.png) |
| 下牙、上牙根、口内开口、右细鬓发根 | default_closed_or_back_occlusion、upper_lip_root_occlusion、upper_and_lower_lip_opening、side_hair_root_occlusion | [13–16 启停局部](review-02-evidence/inspection/masks-13-16.png) |
| 左细鬓发根 | side_hair_root_occlusion | [17 启停局部](review-02-evidence/inspection/masks-17-17.png) |

[全部蒙版停用合成](review-02-evidence/all-masks-off.png) · [蒙版与所属节点及全图导出索引](review-02-evidence/mask-index.json) · [双侧前后踝链合看](review-02-evidence/inspection/rings.png)

四个多深度逻辑件的全部八片已逐片看过，并同件合看接续、默认合成看层序；本轮未发现分片自身的确定断口，也没有将分片判成重复。

| 逻辑件 | 分片逐个导出 | 合看 |
|---|---|---|
| `face/eyes/eye_left/upper_eyelid` | [42.0](review-02-evidence/slices/42-face__eyes__eye_left__upper_eyelid--042.0.png) · [66.0](review-02-evidence/slices/42-face__eyes__eye_left__upper_eyelid--066.0.png) | [整件](review-02-evidence/isolated/42-face__eyes__eye_left__upper_eyelid.png) |
| `face/eyes/eye_right/upper_eyelid` | [48.0](review-02-evidence/slices/48-face__eyes__eye_right__upper_eyelid--048.0.png) · [66.5](review-02-evidence/slices/48-face__eyes__eye_right__upper_eyelid--066.5.png) | [整件](review-02-evidence/isolated/48-face__eyes__eye_right__upper_eyelid.png) |
| `head_accessories/crown_frame` | [61.5](review-02-evidence/slices/62-head_accessories__crown_frame--061.5.png) · [67.0](review-02-evidence/slices/62-head_accessories__crown_frame--067.0.png) | [整件](review-02-evidence/isolated/62-head_accessories__crown_frame.png) |
| `head_accessories/forehead_pendant` | [62.0](review-02-evidence/slices/63-head_accessories__forehead_pendant--062.0.png) · [65.0](review-02-evidence/slices/63-head_accessories__forehead_pendant--065.0.png) | [整件](review-02-evidence/isolated/63-head_accessories__forehead_pendant.png) |

[逐片、整件与参考的同坐标检查图](review-02-evidence/inspection/slices.png)。冠架安装根 61.5／可见前冠 67、额饰安装根 62／可见前片 65、左右上睑 42＋66／48＋66.5 均与有效 occlusion 定义相符，予以保留。

## 只读核验与修复后复核

本次未保存或改动 KRA、参考、parts、groups、occlusion。Krita 中只切换临时显隐与继承透明度并导出；检查末恢复所有原始显隐及继承状态，默认投影与开始时一致，然后关闭检查文档且未保存。工程、groups、occlusion 及全部 parts 文件的检查前后 SHA-256 一致。哈希仅用于证明输入未改和导出恢复一致，绘画判断来自上述实际看图。

一次批量导出返回了被桥接自动取消的 Krita 对话框提示；该批 60 张实际文件均已核对可解码，后续批次成功，全部 268 张逐件／分片导出完整，恢复默认投影亦一致，因此没有遗漏检查或工具故障阻断。

[只读与导出完整性核验](review-02-evidence/read-only-verification.json) · [Krita 最终显隐状态](review-02-evidence/krita-final-state.json) · [恢复后的默认合成](review-02-evidence/restored-default.png)

修复时先处理 R1、R2 的默认可见接缝和 R8 的真实轮廓凹凸，再接顺 R3、R4 的隐藏根部，恢复 R5–R7、R9 的明确原画线面／形体。每项均在所属部件自身完成；修后同时复核完整独显、隐藏上层、默认合成，涉及蒙版或深度分片的继续启停与分片合看。上述 9 项仍待修复，本次审核不通过。
