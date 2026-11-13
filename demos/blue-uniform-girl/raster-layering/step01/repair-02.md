结论：已修复

# review-02 修复与复核记录

R1–R16全部已修复并自检通过；修画中新发现的SELF-1/SELF-2也修好。已保存最新KRA、更新PNG及当前report，保存关闭重开验证通过。本文件为调度器指定暂存报告，未自行写正式repair-02.md或review报告。

## 本轮范围与当前工程

- 工程：`raster-layering/step01/character-depth.kra`，1115×1410，59逻辑part、60绘画层、3原生组、10原生透明度蒙版。
- 13个实际绘画层局部改变，47个实际绘画层原始像素保留。2张共享眼开口上缘局部调整，其他8张蒙版不变。
- 上游ID、归属、SVG、深度及控制职责保留。合法上睑40/57.5共同分片未删除、未重画；后发局部原生取样合并后UUID已同步到当前manifest及report。
- 原图standard与base-subject保持原尺寸原坐标；没有引入其他部件像素、外来投影、发光或新材质。

## 逐项处理结果与三视图证据

每项最终检查完整本件（蒙版停用）、单层默认、隐藏上层（蒙版启用/停用）、默认整图；六栏证据顺序为参考、批前、最终整图、完整独显、隐藏上层蒙版开、隐藏上层蒙版关。完整本件检查板另给原尺寸全形，不只截取问题框。

### R1 — 画面右袜腿内侧折点

结果：**已修复，自检通过**。原画布框 `[579, 1010, 31, 51]`；实际part：`legs/leg_left/leg`。

按standard裙下可见袜侧及本腿自身上下切向，局部横向配准已有生成袜面与深蓝描边；边缘附近等量移动并渐入渐出，保留体积渐变和完整足形。

短鼓点、折线消除；独显连续，正常合成无突点。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R1.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/legs__leg_left__leg-whole.png)。

### R2 — 画面左袜腿膝下外侧凹口

结果：**已修复，自检通过**。原画布框 `[414, 1009, 30, 48]`；实际part：`legs/leg_right/leg`。

只在05本件边缘局部配准，把膝下凹口接成连续转弯；保留原袜面、线宽及隐藏脚形。R3最终返修后另复看此处。

膝下外侧凹口和角消除；R3后本段没有回退。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R2.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/legs__leg_right__leg-whole.png)。

### R3 — 画面左袜腿内侧突变短段

结果：**已修复，自检通过**。原画布框 `[522, 988, 25, 43]`；实际part：`legs/leg_right/leg`。

以裙下原图可见弧与完整本腿自身上下切向约束局部连续弧；撤回扩大配准引入的尖点/横线，恢复含有效R2的本件来源再配准，不从裙摆上方参考外推。

短竖段、折点消除；完整腿也无上方尖点或横线。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R3.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/legs__leg_right__leg-whole.png)。

### R4 — 画面左肘灰色短枝

结果：**已修复，自检通过**。原画布框 `[435, 708, 26, 36]`；实际part：`arms/arm_right/upper_arm`、`arms/arm_right/forearm`。

两次失败清理完整撤回；恢复25本件初始皮肤后，原生选区仅清实际外缘外灰片，再用暖棕3.1px笔触顺自身臂弧续线。23前臂未改。

灰枝与误清透明洞均消除；合上23后关节接边顺，25不含23像素。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R4.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/arms__arm_right__upper_arm-whole.png)。

### R5 — 食指中指接触裂缝

结果：**已修复，自检通过**。原画布框 `[829, 929, 21, 41]`；实际part：`arms/arm_left/hand/middle_finger`、`arms/arm_left/hand/index_finger`。

仅把14中指自身接触侧皮肤及暗边向接触方向延续约2px；18食指、20掌面及后方指默认蒙版保留，按三个相关件组合复核。

默认状态背景细缝闭合；真实拇指空隙与指端分离保留，不靠后方指垫缝。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R5.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/arms__arm_left__hand__middle_finger-whole.png)。

### R6 — 完整脸底右颊S形内凹

结果：**已修复，自检通过**。原画布框 `[655, 448, 32, 53]`；实际part：`face/face_base`。

在34自己的皮肤、暖棕线与颊弧局部配准，依可见下颌与完整脸底切向接顺；隐藏发段依据本脸合理延续。

短促内凹回凸消除；完整脸底及默认露出颊弧均连续。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R6.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__face_base-whole.png)。

### R7 — 耳外轮廓线细浅

结果：**已修复，自检通过**。原画布框 `[731, 345, 43, 115]`；实际part：`face/ears/ear_left`。

沿32实际耳外弧用Krita原生深蓝黑5.8/4.2/2.8px笔触恢复线重，锁定自身alpha，转弯与下根逐渐收细；保留耳内暖面。

耳外弧深色收束恢复；耳形、内红色体积及高光保留，无头发投影。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R7.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__ears__ear_left-whole.png)。

### R8 — 画面右虹膜浅色阶梯边

结果：**已修复，自检通过**。原画布框 `[581, 330, 42, 25]`；实际part：`face/eyes/eye_left/iris`。

38自身上弧原生深蓝笔触及alpha锁定融色；共享眼开口只在40自身抗锯齿内缘下增加约1px承接；最终原生清理完整上弧多余线头，保留虹膜体积。40/57.5均未重画。

虹膜与睫毛连续深蓝接触；完整上弧干净，眼内组开关均正常。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R8.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__eyes__eye_left__iris-whole.png)。

### R9 — 画面左虹膜浅灰细边

结果：**已修复，自检通过**。原画布框 `[397, 370, 43, 26]`；实际part：`face/eyes/eye_right/iris`。

43按本眼独立画深蓝上弧，保留独有渐变与青色下部；共享开口只在45自身内缘下增加约1px承接；最终清掉完整上弧外小线头。

浅灰接线消除；完整轮廓干净，未镜像另一眼或移动眼组。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R9.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__eyes__eye_right__iris-whole.png)。

### R10 — 画面右双眼皮体积不足

结果：**已修复，自检通过**。原画布框 `[548, 309, 76, 40]`；实际part：`face/eyes/eye_left/eyelid_crease`。

三色重新生成41完整弧线，整张方图等比回120px原坐标；接受红褐较宽暗中心、柔和透明边与收细两端，再原生低不透明度暖色融接。

红褐中心、软边和眼皮体积恢复；原尺寸眼形、睫毛、高光保留。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R10.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__eyes__eye_left__eyelid_crease-whole.png)。

### R11 — 画面左双眼皮过窄过平

结果：**已修复，自检通过**。原画布框 `[365, 353, 77, 40]`；实际part：`face/eyes/eye_right/eyelid_crease`。

按本眼参考三色重新生成46完整弧线，整张方图等比回120px；原生暖红融色，独立核查弧度、宽度、软边及两端。

暖红较宽中心与渐淡收口恢复；未恢复外来睫毛投影。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R11.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__eyes__eye_right__eyelid_crease-whole.png)。

### R12 — 左后发条块拼接

结果：**已修复，自检通过**。原画布框 `[326, 477, 30, 67]`；实际part：`hair/back_hair`。

两次三色生成均因新增/改变发流线撤回；恢复本件原画，从同件相邻无其他暗线的蓝面局部取样融接亮条和色阶。撤回错误横线及S支线后，Krita沿明确本件曲线逐笔续单条深蓝线并收细末端。

亮条、水平色阶与补丁感消除；蓝面连续，保留单条原发流线，未带侧发/脸/衣领像素。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R12.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/hair__back_hair-whole.png)。

### R13 — 右青蓝发尖下缘线重不足

结果：**已修复，自检通过**。原画布框 `[646, 535, 57, 40]`；实际part：`hair/back_hair`。

针对review02真实右尖束[646,535,57,40]，沿01自己的下缘以4→2.8→1.8px深蓝原生笔触恢复描边并收尖。

可见下缘线重和收尖恢复；青蓝体积、根部及真实发缕空隙保留。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R13.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/hair__back_hair-whole.png)。

### R14 — 耳顶后发补形硬接边

结果：**已修复，自检通过**。原画布框 `[721, 350, 36, 48]`；实际part：`hair/back_hair`。

三色重生本件耳顶局部，整张图等比回120px；原生局部取样接回后发并保留自身alpha及青蓝楔形，后续以自身软暗发流线跨接界面。

完整后发水平材质缝与窄竖色带融顺；合上耳正常，无耳线、肤色或耳投影。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R14.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/hair__back_hair-whole.png)。

### R15 — 连体衣左腰胯接边台阶

结果：**已修复，自检通过**。原画布框 `[461, 781, 31, 33]`；实际part：`pelvis`、`body/torso`。

29本件衣面边缘局部配准去灰蓝凸段，与27自己的外缘接顺；两件各自完整覆盖、面料笔触与结构线保留。

躯干—骨盆组合外缘连续，无侧向台阶；没有带入裸腿肤色。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R15.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/pelvis-whole.png)。

### R16 — 舌右上缘折角与硬融色

结果：**已修复，自检通过**。原画布框 `[520, 467, 42, 22]`；实际part：`face/mouth/tongue`、`face/mouth/mouth_interior`。

三色生成完整50粉红舌面，保留生成体积；仅本件上弧局部纵向注册成圆弧，再Krita局部1.5px软化与玫红气笔体积过渡。48口内、牙和唇保持独立。

上弧圆顺，口内—舌面过渡柔和；独显无折角，不含牙线、唇线或外来影。

三视图及同坐标参考：[六栏最终对照](repair-evidence-02/issues/R16.png)；[完整部件独显/隐藏上层](repair-evidence-02/issues/face__mouth__tongue-whole.png)。

## 修画中新发现并处理的问题

**SELF-1：完整腿新尖点和横线。** R3扩大注册试稿以不合适的上方趋势外推，完整独显暴露新尖点/横线。该试稿撤回，从保留R2的本件来源改用完整腿自身上下切向，最终连续弧配准后再看独显、隐藏上层、整图和R2局部。最终无尖点/横线，完整足形保留。[最终整腿](repair-evidence-02/issues/legs__leg_right__leg-whole.png) / [注册记录](repair-evidence-02/R3-no-spike-registration.json)。

**SELF-2：两只完整虹膜上弧外小线头。** 完整独显发现R8/R9原生修边在上缘之外留下小线头，默认共享蒙版掩住了它们。仅用Krita原生选区清理本件原完整上弧外多余alpha；原生成虹膜体积及修好的深蓝边色保留。两眼分别重新看完整独显、隐藏上层和正常眼组合，外缘干净、深蓝接触保留。[left完整](repair-evidence-02/issues/face__eyes__eye_left__iris-whole.png) / [right完整](repair-evidence-02/issues/face__eyes__eye_right__iris-whole.png) / [原生清理记录](repair-evidence-02/iris-cap-cleanup.json)。

**失败试稿撤回。** R4未清净及误清矩形洞已恢复原件后重修；R12两次三色生成、取样横线和自动拟合S支线均撤回。最终保留本件安全蓝面取样与单条原生曲线；没有用遮挡层或纯色块掩盖试稿缺陷。[撤回/最终操作说明](repair-evidence-02/operation-dispositions.json)。

## 原尺寸眼、原生接缝与完整形体复核

两只眼分别按standard原尺寸并排看，再放大R8–R11；眼形、上睑轮廓、连体睫毛和高光位置保留，虹膜暗边直接接上睑。双眼皮暖红褐中心、柔和透明边与收口恢复，未把睫毛投影恢复进眼白或眼皮。合法40/57.5共同分片保持原始画面。

[双眼原尺寸](repair-evidence-02/eyes-native.png) · [整头原尺寸](repair-evidence-02/head-native.png) · [手部接触](repair-evidence-02/hand-native.png) · [口部](repair-evidence-02/mouth-native.png) · [后发完整](repair-evidence-02/issues/hair__back_hair-whole.png) · [脸底完整](repair-evidence-02/issues/face__face_base-whole.png)

完整两腿、关节补形、各手指自身明暗、脸底、耳廓、虹膜、双眼皮、后发、骨盆及舌面均检查本件全形；修复区域连续、无新增缺口/外件鬼影。其他47个实际绘画层原像素与批前一致，保留review-02已检查过的完整纹理；本轮完整原画仍逐件导出供后续核查。

## 蒙版逐一开关、完整底层与恢复证据

10张原生蒙版逐一切换开/关并看图：三张后方指默认全隐藏，停用后完整指身仍在；下牙默认隐藏、上牙露出带有效且完整牙面保留；两高光范围与两眼共享开口各自有效；口内依上下唇共享开口。

眼开口left/right仅在上睑自身抗锯齿内缘下方约1px承接，分别92/93个选区像素改变；下沿仍为眼白下沿，眼白、虹膜、高光共用开口。两眼及口共用开口归零后内件一起隐藏，再恢复原选区，底层绘画BGRA完全没变。最终所有蒙版启用原默认控制，导出PNG也是该状态。

- M01 `后方手指默认遮挡` → `10 | arms/arm_left/hand/little_finger`：并拢手姿后方手指默认整体不可见；可单独解除检查完整指身。[开/关证据](repair-evidence-02/masks/00-comparison.png)；蒙版UUID `{06c0d344-178f-4185-b953-a9ed4cc37ebc}`，所属UUID `{e24c2a96-a10f-4610-bc8c-d41e53f31f45}`。
- M02 `后方手指默认遮挡` → `11 | arms/arm_right/hand/little_finger`：并拢手姿后方手指默认整体不可见；可单独解除检查完整指身。[开/关证据](repair-evidence-02/masks/01-comparison.png)；蒙版UUID `{a557dafb-b0ff-46c4-88dd-a390e968eea9}`，所属UUID `{49267e18-4add-4309-8aa9-e030f5b6be36}`。
- M03 `后方手指默认遮挡` → `12 | arms/arm_left/hand/ring_finger`：并拢手姿后方手指默认整体不可见；可单独解除检查完整指身。[开/关证据](repair-evidence-02/masks/02-comparison.png)；蒙版UUID `{83eb02f1-3940-4058-bacf-aeaac4af2b78}`，所属UUID `{3b283a3e-8e41-4af0-bcaa-8f6e57dfc86a}`。
- M04 `高光虹膜范围 left` → `39 | face/eyes/eye_left/highlight`：左高光随虹膜并限于虹膜内部。[开/关证据](repair-evidence-02/masks/03-comparison.png)；蒙版UUID `{4ea9dc55-ede2-48ce-9270-2f1eaacb036f}`，所属UUID `{38d785a0-2b85-4126-a5d4-2d995993c0cb}`。
- M05 `眼睛开口 left` → `眼内开合 left`：左眼上眼睑内缘—眼白下沿共同开口；裁切眼白、虹膜、高光。[开/关证据](repair-evidence-02/masks/04-comparison.png)；蒙版UUID `{ec448c7c-5c37-470a-b8b5-d3deeb129eea}`，所属UUID `{94d3ca79-8e5c-4b9f-98d2-f5aa0b82bd09}`。
- M06 `高光虹膜范围 right` → `44 | face/eyes/eye_right/highlight`：右高光随虹膜并限于虹膜内部。[开/关证据](repair-evidence-02/masks/05-comparison.png)；蒙版UUID `{ab4087a9-f7c6-4c0e-9b31-a7e58be174df}`，所属UUID `{5b2f210f-f4fd-4df9-b302-1c9cd63f747e}`。
- M07 `眼睛开口 right` → `眼内开合 right`：右眼上眼睑内缘—眼白下沿共同开口；裁切眼白、虹膜、高光。[开/关证据](repair-evidence-02/masks/06-comparison.png)；蒙版UUID `{724c8473-73f7-446c-acd6-6af70e70b7df}`，所属UUID `{f4505ea6-0e42-4b78-8c9e-e53184232b3d}`。
- M08 `下牙默认遮挡` → `49 | face/mouth/lower_teeth`：下嘴与舌面控制下牙默认整体不可见。[开/关证据](repair-evidence-02/masks/07-comparison.png)；蒙版UUID `{4ef4f667-6607-458d-ab72-855884296f24}`，所属UUID `{cfd92245-2bed-4dd6-8962-aa81b90e43c8}`。
- M09 `上牙露出带` → `51 | face/mouth/upper_teeth`：上唇控制整片上牙根部及窄露出带。[开/关证据](repair-evidence-02/masks/08-comparison.png)；蒙版UUID `{582994c8-f7c8-49a0-994c-c1a1924ede30}`，所属UUID `{076da129-6653-41b1-89ac-b83043cdb5a1}`。
- M10 `上下唇开口` → `口内开合`：上下唇内缘及嘴角共同开口；裁切口腔、上下牙、舌面。[开/关证据](repair-evidence-02/masks/09-comparison.png)；蒙版UUID `{804808d6-e706-4cdb-80c0-cbd4c3867f2b}`，所属UUID `{6cda5519-1733-4803-91f3-f8015f0a8d67}`。

[共用开口归零/恢复](repair-evidence-02/common-opening-zero-head.png) · [全图默认/全停用/恢复](repair-evidence-02/whole-mask-comparison.png) · [蒙版记录](mask-verification.json)

## 结构、UUID、来源及形状记录

本轮未新增、合并或拆分part，无新穿插分片；59终止ID及每件深度与groups/occlusion逐项匹配。上游84个分层/参考输入哈希与独立review-02相同。局部raster轮廓修顺记录在shape-records，原SVG整体范围与控制职责继续有效，因此没有调用结构编辑工具或重启上游。

后发由原生本件局部取样合并更换UUID；最终实际层名/UUID、全部59件复用来源、蒙版所属层/组及控制区已更新到report.md和layer-manifest.json。六次三色生成的控制/输入/输出及接受/撤回记录保存于正式证据目录，保留既有生成来源记录。

[当前报告及全部图层映射](report.md) · [当前manifest](layer-manifest.json) · [生成来源](generation-provenance.json) · [本轮三色输入/输出](repair-evidence-02/generation-attempts.json) · [本轮细轮廓](repair-evidence-02/shape-records.json) · [上游验证](repair-evidence-02/input-verification.json)

## 最后保存、关闭重开与像素一致性

最后保存 `raster-layering/step01/character-depth.kra`，关闭文档后从磁盘重新打开，waitForDone并重新建立视图。重开结果：59逻辑part、60绘画层、3组、10原生蒙版；完整节点树、名称、UUID、父子关系、位置、显隐、不透明度、混合模式、全部绘画原始BGRA、全部蒙版选区及合成原始像素逐项完全一致。深度顺序1–59加57.5，默认蒙版全部启用。

`character-depth.png`、最终默认合成、蒙版恢复合成、重开合成以及KRA内`mergedimage.png`解码RGBA逐像素完全一致。59个part默认PNG也更新；13个修改件默认PNG和对应单层蒙版启用证据一致。导出及蒙版检查未改动底层像素。

[重开验证](reopen-verification.json) · [重开前完整快照](reopen-before.json) · [正式PNG/KRA一致性](repair-evidence-02/export-consistency.json) · [59个默认部件PNG](repair-evidence-02/default-part-exports.json) · [最终逐项JSON](repair-evidence-02/results.json)

画面质量依据实际目视检查；上述哈希与RGBA比较仅证明保存/重开、导出和保护项没有变化，不用质量分数替代看图。当前没有已知待修项。
