结论：已修复

# repair-02 逐项处理结果

已按 [review-02.md](../../raster-layering/step01/review-02.md) 修复9项、17个框选位置，并完成原尺寸及等倍率放大的完整单件、隐藏上层、默认整图检查。[当前KRA](../../raster-layering/step01/character-depth.kra)／[透明PNG](character-depth.png)／[有效绘画报告](../../raster-layering/step01/report.md) 已更新。

原图为 `../../part-layering/references/base-subject.png`。画布 941×1672，RGBA/U8，sRGB-elle-V2-srgbtrc.icc。参考始终使用原画布坐标，没有移动或缩放参考。

本轮仅在已有工程中原生修画、局部原生选区取样、组装与检查，没有调用新的生图。前序生成和取样来源保留在 [返修前完整报告](../../raster-layering/step01/workspace/repair02/before-report.md) 及 [前序生成索引](../../raster-layering/step01/workspace/repair01/generated-source-index.json)。没有新增阴影层、AO、投影、发光或原画不存在的纹理。

## 逐项结果及证据

面板依次为原图、返修前完整单件、返修后完整单件、隐藏上层、默认整图；各列使用同一画布坐标。放大仅为检查，未移动或缩放参考来掩盖偏差。

| review-02 项目 | 位置 | 处理及三视图结果 | 同坐标证据 |
|---|---|---|---|
| R1 衣片接色与侧缝 | R1a [379,687,56,62]；R1b [508,687,52,62] | 两件各自布面先接顺，同侧缝线重新对齐并接到原有腿口双边。新增12px下端接合蒙版；停用它仍无原斜切色阶。完整独显另查到骨盆隐藏根旧断头，已用本件材质清理并补成连续缝线。 自检通过。 | [R1 三视图对照](repair-02-evidence/R1-check.png) |
| R2 双腕掌根 | R2a [280,770,47,39]；R2b [609,772,47,40] | 在本侧前臂与掌根自身恢复连续体积肤色、细边，去掉曲片／斜片补丁。原腕部蒙版保留；启停均核对，未另加肤色覆盖片。 自检通过。 | [R2 三视图对照](repair-02-evidence/R2-check.png) |
| R3 右食指、双拇指补根 | R3a [286,831,29,33]；R3b [303,816,24,34]；R3c [611,820,22,32] | 各指取本指材质延续至根端，保留指甲、长度及叠指暗线。左拇指局部恢复后又检查到掌下接色，已在同指内接顺。独显与隐藏上层均不再出现横向帽边。 自检通过。 | [R3 三视图对照](repair-02-evidence/R3-check.png) |
| R4 颈部底端 | [416,351,107,20] | 本颈纵向柔和明暗延续到三角底端，水平填色上缘消除；默认颈肩不改。未复制 torso 锁骨。 自检通过。 | [R4 三视图对照](repair-02-evidence/R4-check.png) |
| R5 双细鬓发 | R5a [362,231,53,115]；R5b [522,231,53,115] | 恢复连续细灰边、内侧浅灰折面与银白窄亮芯，接通隐藏根和尖梢。原图试贴夹带的邻件像素已整件撤回，最终为本束自身连续原生笔触。根梢、弯度、alpha和层序保持。 自检通过。 | [R5 三视图对照](repair-02-evidence/R5-check.png) |
| R6 双眉 | R6a [407,187,49,14]；R6b [482,187,50,14] | 恢复细边、窄亮芯、渐尖笔触及隐藏眉尾的连续材质；中段小范围恢复本眉原有笔触，排除周围皮肤与发遮尾部。 自检通过。 | [R6 三视图对照](repair-02-evidence/R6-check.png) |
| R7 双上耳露出区 | R7a [379,223,29,32]；R7b [533,223,29,32] | 上耳恢复红褐耳内面、细对耳轮和必要亮边，与原有下耳笔触接通。完整耳形和默认遮挡蒙版保留；不改宽侧发、细鬓发的遮挡范围。 自检通过。 | [R7 三视图对照](repair-02-evidence/R7-check.png) |
| R8 双踝足侧边 | R8a [408,1512,61,75]；R8b [474,1512,61,75] | 用连续曲线修顺原逐像素SVG缺口／凸点，同步修KRA alpha和细轮廓。局部抠图亮边以本腿材质修净；链枝范围保护，足背链根、趾缝、甲缘及前后链独立归属保持。 自检通过。 | [R8 三视图对照](repair-02-evidence/R8-check.png) |
| R9 右眼暗瞳 | [427,216,20,18] | 原暗瞳轮廓与位置恢复为连续近圆／斜椭圆，右侧横向突起清除并接顺周围虹膜。原虹膜外缘、独立高光、剪贴关系及共享开口蒙版保持。 自检通过。 | [R9 三视图对照](repair-02-evidence/R9-check.png) |

## 保护、额外修正与复用

本轮19个逻辑件各仍只有自己的内容，单深度仍各一个普通绘画层。未将耳、饰物或邻发像素置入鬓发，没有把掌纹或别指填入指根，也未把锁骨复制到neck。试贴中的邻件像素和抠图亮边已撤回／修净。左拇指掌下新色阶、骨盆隐藏根旧缝线断头在本轮自查中修好；其余50个绘画层与原有17个蒙版原始像素不变。

以下给出本轮19层的part ID、真实图层名／UUID、深度与最终复用来源；完整69层及全部控制归属见 [report.md](../../raster-layering/step01/report.md)。

| part ID | 实际绘画层／UUID | 深度、区域、父层 | 当前来源／本轮处理 | 视图 |
|---|---|---|---|---|
| `legs/leg_right/leg` | `009.0 \| legs/leg_right/leg \| complete`<br>`{9c64defe-cd1d-47cc-a124-83149984fed6}` | 9 / complete<br>父：ROOT | R8：1512–1590段本腿足踝SVG与alpha修顺，本件内侧材质补齐极窄新边，原有细边恢复并原生接顺；链枝、趾缝、甲缘保留 | [独显](repair-02-evidence/final/legs__leg_right__leg--isolated.png)／[隐藏上层](repair-02-evidence/final/legs__leg_right__leg--reveal.png) |
| `legs/leg_left/leg` | `010.0 \| legs/leg_left/leg \| complete`<br>`{31dfffc8-e688-485e-92f6-e4d8d5197017}` | 10 / complete<br>父：ROOT | R8：同上；前轮内腿接触轮廓修正保持，足背链仍属leg，前后踝链独立 | [独显](repair-02-evidence/final/legs__leg_left__leg--isolated.png)／[隐藏上层](repair-02-evidence/final/legs__leg_left__leg--reveal.png) |
| `pelvis` | `013.0 \| pelvis \| complete`<br>`{9f746d95-b938-40f1-81e3-d54ee20c5345}` | 13 / complete<br>父：ROOT | R1：本件布面与连续侧缝修画；原图本件下段侧缝、腿口双边局部取样；隐藏根以本件干净布面原生取样清理旧断头并接续 | [独显](repair-02-evidence/final/pelvis--isolated.png)／[隐藏上层](repair-02-evidence/final/pelvis--reveal.png) |
| `arms/arm_right/hand/index_finger` | `017.0 \| arms/arm_right/hand/index_finger \| complete`<br>`{17cd49df-01be-4b6a-ba96-3518f814b3f9}` | 17 / complete<br>父：ROOT | R3：本指自身横断材质原生取样 [290,857,12,3]，延续入隐藏根；软接到原指体 | [独显](repair-02-evidence/final/arms__arm_right__hand__index_finger--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_right__hand__index_finger--reveal.png) |
| `arms/arm_right/hand/thumb` | `018.0 \| arms/arm_right/hand/thumb \| complete`<br>`{37bcea3b-7389-4853-ab97-45729c27cb54}` | 18 / complete<br>父：ROOT | R3：本指自身材质原生取样 [312,851,10,3] 延续补根；甲面、末端和叠指暗线保留 | [独显](repair-02-evidence/final/arms__arm_right__hand__thumb--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_right__hand__thumb--reveal.png) |
| `arms/arm_right/forearm` | `020.0 \| arms/arm_right/forearm \| complete`<br>`{1b191d7f-97db-4096-bcd6-8151771e9c8f}` | 20 / complete<br>父：ROOT | R2：本侧腕部体积肤色与细边在自身绘画层接续，近端和其余前臂保留 | [独显](repair-02-evidence/final/arms__arm_right__forearm--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_right__forearm--reveal.png) |
| `arms/arm_right/hand/palm` | `021.0 \| arms/arm_right/hand/palm \| complete`<br>`{61645b96-cab0-474b-9e70-359d03670037}` | 21 / complete<br>父：ROOT | R2：本掌根与本侧前臂末端共用连续肤色塑形方向；本层细轮廓修画，掌纹及独立手指不并入 | [独显](repair-02-evidence/final/arms__arm_right__hand__palm--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_right__hand__palm--reveal.png) |
| `arms/arm_left/forearm` | `022.0 \| arms/arm_left/forearm \| complete`<br>`{8859c2c1-7cd6-46df-a2e9-f904fdb54fe6}` | 22 / complete<br>父：ROOT | R2：同上；保持本侧腕形及左臂既有肘部关系 | [独显](repair-02-evidence/final/arms__arm_left__forearm--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_left__forearm--reveal.png) |
| `arms/arm_left/hand/thumb` | `028.0 \| arms/arm_left/hand/thumb \| complete`<br>`{f1662c0b-1af8-433a-a5a2-35a1f3a20669}` | 28 / complete<br>父：ROOT | R3：原图本指可见段 [611,832,24,44] 局部取样并排除掌片；本指 y847–849 横断材质延续到隐藏根，消除掌下新色阶 | [独显](repair-02-evidence/final/arms__arm_left__hand__thumb--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_left__hand__thumb--reveal.png) |
| `arms/arm_left/hand/palm` | `029.0 \| arms/arm_left/hand/palm \| complete`<br>`{5bd257eb-a516-45c1-87e8-58921e019d92}` | 29 / complete<br>父：ROOT | R2：同上；消除原斜切肤色补丁，原有18px腕接蒙版保留 | [独显](repair-02-evidence/final/arms__arm_left__hand__palm--isolated.png)／[隐藏上层](repair-02-evidence/final/arms__arm_left__hand__palm--reveal.png) |
| `neck` | `030.0 \| neck \| complete`<br>`{15144020-c825-4901-a742-08becc748c51}` | 30 / complete<br>父：ROOT | R4：本颈 [410,348,118,7] 原生取样，沿纵向延续到底端；未取 torso 锁骨 | [独显](repair-02-evidence/final/neck--isolated.png)／[隐藏上层](repair-02-evidence/final/neck--reveal.png) |
| `body/torso` | `031.0 \| body/torso \| complete`<br>`{ba0c4b14-931a-404b-839f-3be36c4824cb}` | 31 / complete<br>父：ROOT | R1：本件腰腹布面原生修画，侧缝落点与切线接续；新增下端原生接合蒙版，完整绘画不裁掉 | [独显](repair-02-evidence/final/body__torso--isolated.png)／[隐藏上层](repair-02-evidence/final/body__torso--reveal.png) |
| `face/ears/ear_right` | `035.0 \| face/ears/ear_right \| complete`<br>`{88643f29-e403-43ed-b8a4-26686a75824b}` | 35 / complete<br>父：ROOT | R7：本耳上耳内红褐材质、对耳轮和窄亮边原生修画，接到保留的下耳；试贴的头发边界像素已撤回 | [独显](repair-02-evidence/final/face__ears__ear_right--isolated.png)／[隐藏上层](repair-02-evidence/final/face__ears__ear_right--reveal.png) |
| `face/ears/ear_left` | `036.0 \| face/ears/ear_left \| complete`<br>`{a3e7fab5-8355-4552-97db-51f5652cd883}` | 36 / complete<br>父：ROOT | R7：同上；左右形状各自保留，y248及以下原有耳垂和细笔触不改 | [独显](repair-02-evidence/final/face__ears__ear_left--isolated.png)／[隐藏上层](repair-02-evidence/final/face__ears__ear_left--reveal.png) |
| `face/eyes/eye_right/iris` | `045.0 \| face/eyes/eye_right/iris \| complete`<br>`{3bce0122-a3f2-4da8-9ace-9532e2066e9a}` | 45 / complete<br>父：face/eyes/eye_right \| iris_highlight_clip | R9：原图本眼暗瞳及紧邻虹膜 [428,217,17,18]，以窄椭圆选区原生取样，扣除独立高光；清除横向拖尾，不取上睑弧 | [独显](repair-02-evidence/final/face__eyes__eye_right__iris--isolated.png)／[隐藏上层](repair-02-evidence/final/face__eyes__eye_right__iris--reveal.png) |
| `face/eyebrows/eyebrow_right` | `056.0 \| face/eyebrows/eyebrow_right \| complete`<br>`{ac4945cf-4446-468c-8a9e-8001b45da597}` | 56 / complete<br>父：ROOT | R6：原生渐尖细灰边和窄亮芯；原图本眉中段 [431,190,20,5] 小范围取样，不含发遮尾部 | [独显](repair-02-evidence/final/face__eyebrows__eyebrow_right--isolated.png)／[隐藏上层](repair-02-evidence/final/face__eyebrows__eyebrow_right--reveal.png) |
| `face/eyebrows/eyebrow_left` | `057.0 \| face/eyebrows/eyebrow_left \| complete`<br>`{573a191c-1809-420e-a658-f7a50f5dbac3}` | 57 / complete<br>父：ROOT | R6：同上；本眉中段原图取样 [487,190,20,5]，隐藏眉尾原生接续 | [独显](repair-02-evidence/final/face__eyebrows__eyebrow_left--isolated.png)／[隐藏上层](repair-02-evidence/final/face__eyebrows__eyebrow_left--reveal.png) |
| `hair/sidelock/sidelock_right` | `059.0 \| hair/sidelock/sidelock_right \| complete`<br>`{9a2a473e-21db-4388-8c91-718162d418ff}` | 59 / complete<br>父：ROOT | R5：在原有完整本束材质上原生连续曲线修画细灰边、银白窄亮面和内侧折面；试贴原图的版本全部撤回 | [独显](repair-02-evidence/final/hair__sidelock__sidelock_right--isolated.png)／[隐藏上层](repair-02-evidence/final/hair__sidelock__sidelock_right--reveal.png) |
| `hair/sidelock/sidelock_left` | `060.0 \| hair/sidelock/sidelock_left \| complete`<br>`{2799914a-e942-4cdb-8749-c2d6ef60234a}` | 60 / complete<br>父：ROOT | R5：同上，按本侧完整alpha配准；没有耳、耳饰、宽侧发或皮肤取样像素 | [独显](repair-02-evidence/final/hair__sidelock__sidelock_left--isolated.png)／[隐藏上层](repair-02-evidence/final/hair__sidelock__sidelock_left--reveal.png) |

## 结构与上游同步

65 个逻辑 part、69 个普通绘画分片和 5 个眼口控制组保持原身份、归属、运动关系与深度。没有新逻辑件或本轮深度拆层；因此 `groups.json`、`occlusion.json` 未改。已将其终端ID与深度逐项和当前KRA核对。

四个历史多深度件保持：冠架61.5/67、额饰62/65为上游预标；左上睑42/66、右上睑48/66.5为上游已记录的先前组装发现。八个分片均保持原UUID、父级及像素。[分片总览](repair-02-evidence/final/multi-depth-slices.png)。

本轮仅新增 torso 的原生透明度蒙版 `pelvis_attachment_blend`，UUID `{3d3120f6-4b89-4dd5-a50c-30e93443720a}`，父层 `031.0 | body/torso | complete`／`{ba0c4b14-931a-404b-839f-3be36c4824cb}`。腰腹下缘12px柔接只在下方本件骨盆布面完全不透明处起效；完整躯干绘画仍保留。现在共18个原生蒙版。

眼内仍各共用上下睑开口，虹膜／高光保持原剪贴；口内共用上下唇开口。默认保持参考睁眼、张口。下牙、后踝链以原生零开口蒙版默认隐藏；停用蒙版可检查完整底图。[前后链独立拼合](repair-02-evidence/final/front-back-rings-check.png)。

本轮上游形状变更已同步保存到：

- `../../part-layering/parts/legs/leg_right/leg.svg`
- `../../part-layering/parts/legs/leg_left/leg.svg`

两者仅 y1512–1590 的足踝侧边由逐像素小凹凸改为连续曲线，局部约1–2px补齐／收回；KRA同段alpha沿用同一新轮廓。普通皮肤边界与细线一起修顺，没有用实心肤色扩张覆盖珠链空隙。ID、父组和深度不变；左右大腿、前轮左腿y880–1130内缘修正、足部下段和足背链仍保留。SVG前版与路径依据见 [形状记录](../../raster-layering/step01/workspace/repair02/ankle-svg-records.json)。

其余与色块包络的既有差异继续保留：踝链珠间与细银丝之间有实际透明孔隙；右足底已清理的约1px浮点／脏边；正常抗锯齿亚像素覆盖差异。没有部件归属变化或新增深度分片。

新蒙版所属父层、UUID、12px控制区及默认状态见上述结构段；全部18个蒙版逐项记录在 [report.md](../../raster-layering/step01/report.md) 的蒙版表。蒙版启停索引见 [index.json](../../raster-layering/step01/repair-02-evidence/final/masks/index.json)。

## 最终检查与重开

本轮逐件复查65件完整独显与隐藏上层总览，修复的19件另外使用原坐标局部面板查看单件、隐藏上层及默认整图。全部18个原生A/U8蒙版逐一启停，3个眼口共享开口另作临时归零测试后恢复。各次切换未改动绘画或蒙版原始缓冲。

保存后关闭指定KRA，再从指定路径重新打开。69个绘画层、18个蒙版、5个组，共92个节点的名称、UUID、父子关系、顺序、显隐、剪贴状态及87份绘画／蒙版缓冲均与关闭前相同。默认PNG在保存前、重开后和交付文件的解码像素一致；KRA ZIP完整性通过。19个绘画层有本轮修复，其余50个绘画层及原有17个蒙版的像素与返修前完全一致。哈希只用于持久化和保护检查，不代替看图。

[重开核验](../../raster-layering/step01/repair-02-evidence/final/reopen-verification.json) · [实际图层树](../../raster-layering/step01/repair-02-evidence/final/tree.json) · [交付及保留清单](../../raster-layering/step01/repair-02-evidence/final/delivery-check.json) · [蒙版数据检查](../../raster-layering/step01/repair-02-evidence/final/mask-checks.json)

[蒙版启停1](repair-02-evidence/final/mask-switches-1.png)／[2](repair-02-evidence/final/mask-switches-2.png)／[3](repair-02-evidence/final/mask-switches-3.png) · [全部蒙版停用](repair-02-evidence/final/all-masks-off.png) · [眼口开口归零检查](repair-02-evidence/final/aperture-zero-test.png)。归零图用于验证控制，不是另画的闭眼／闭嘴姿态；最终已恢复参考开口。

绘画自检：本轮review-02的9项、17处均已处理并通过当前保存画面的三视图检查，未列未解决问题。

- 身体：[完整独显](repair-02-evidence/final/isolated-body.png)／[隐藏上层](repair-02-evidence/final/reveal-body.png)
- 双手：[完整独显](repair-02-evidence/final/isolated-hands.png)／[隐藏上层](repair-02-evidence/final/reveal-hands.png)
- 双眼：[完整独显](repair-02-evidence/final/isolated-eyes.png)／[隐藏上层](repair-02-evidence/final/reveal-eyes.png)
- 脸耳口眉：[完整独显](repair-02-evidence/final/isolated-face-mouth.png)／[隐藏上层](repair-02-evidence/final/reveal-face-mouth.png)
- 头发：[完整独显](repair-02-evidence/final/isolated-hair.png)／[隐藏上层](repair-02-evidence/final/reveal-hair.png)
- 饰件：[完整独显](repair-02-evidence/final/isolated-jewelry.png)／[隐藏上层](repair-02-evidence/final/reveal-jewelry.png)
- 腿足与踝链：[完整独显](repair-02-evidence/final/isolated-legs.png)／[隐藏上层](repair-02-evidence/final/reveal-legs.png)

KRA SHA256：`69ed424cb649801d8466b8853c6c6ae097196b148e4f399ece54a99bbfaeeaf0`。PNG SHA256：`2512717b9b62462273b4b9582f20f052f48b9ac7e19025f4bfeb35b4379b6b43`。这些值只标记本次交付文件，不用于绘画质量评价。

过程中的一次 `QProgressDialog` 自动取消提示已通过后续实际保存、导出和重开复核排除。没有必要输入缺失、损坏或遗留工具故障。本报告是交调度器发布的暂存文件，未自行写正式repair报告。
