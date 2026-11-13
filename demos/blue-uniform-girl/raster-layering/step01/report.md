# 人物 raster step01 当前绘画与分层报告

当前结论：**已修复**。本轮 review-02 的 R1–R16 全部修复并逐项自检通过；修画中新发现的完整腿尖点/横线及双虹膜外线头也已修好。

画布1115×1410；59逻辑part、60普通绘画层、3原生组、10透明度蒙版。13个本件绘画层改变，47个绘画层原始像素保持；2张共享眼开口蒙版局部调整，其余8张不变。上游ID、归属、控制职责、SVG和深度表均未改动。保留上睑主体40与同part外尖57.5的合法共同归属。

[KRA](character-depth.kra) · [PNG](character-depth.png) · [本轮逐项结果](repair-evidence-02/results.json) · [前轮正式修复历史](repair-01.md)

## 参考、画面来源与本轮保护

`part-layering/references/standard.png`用于发、脸、双眼、手、袜腿与鞋；`part-layering/references/base-subject.png`用于裸上臂及连体衣。原尺寸、原坐标比对；裙摆/耳/侧发遮住的形体按本件自身合理延续，不把遮挡物画面采入本件。

双眼皮、后发耳顶及舌头先以红/黄/绿三色图重新生成；双眼皮和舌面保留生成结果，耳顶仅局部接回。后发左侧两次生成改变线形，均撤回，最终使用本件相邻生成蓝面取样与Krita原生逐笔续线。其余已有效的生成画面只局部配准、清理或原生描边，保留各自体积与材质，没有整块纯色填形、混入其他部件像素或外来投影。

[本轮三色输入/输出及接受撤回](repair-evidence-02/generation-attempts.json) · [完整生成/复用来源](generation-provenance.json) · [原生操作](repair-evidence-02/operations.json) · [试稿与最终状态](repair-evidence-02/operation-dispositions.json) · [raster细轮廓记录](repair-evidence-02/shape-records.json)

## R1–R16逐项处理

| 编号 | 处理及最终观察 | 证据 |
|---|---|---|
| R1 | **自检通过**。按standard裙下可见袜侧及本腿自身上下切向，局部横向配准已有生成袜面与深蓝描边；边缘附近等量移动并渐入渐出，保留体积渐变和完整足形。 短鼓点、折线消除；独显连续，正常合成无突点。 | [六栏](repair-evidence-02/issues/R1.png) / [完整本件](repair-evidence-02/issues/legs__leg_left__leg-whole.png) |
| R2 | **自检通过**。只在05本件边缘局部配准，把膝下凹口接成连续转弯；保留原袜面、线宽及隐藏脚形。R3最终返修后另复看此处。 膝下外侧凹口和角消除；R3后本段没有回退。 | [六栏](repair-evidence-02/issues/R2.png) / [完整本件](repair-evidence-02/issues/legs__leg_right__leg-whole.png) |
| R3 | **自检通过**。以裙下原图可见弧与完整本腿自身上下切向约束局部连续弧；撤回扩大配准引入的尖点/横线，恢复含有效R2的本件来源再配准，不从裙摆上方参考外推。 短竖段、折点消除；完整腿也无上方尖点或横线。 | [六栏](repair-evidence-02/issues/R3.png) / [完整本件](repair-evidence-02/issues/legs__leg_right__leg-whole.png) |
| R4 | **自检通过**。两次失败清理完整撤回；恢复25本件初始皮肤后，原生选区仅清实际外缘外灰片，再用暖棕3.1px笔触顺自身臂弧续线。23前臂未改。 灰枝与误清透明洞均消除；合上23后关节接边顺，25不含23像素。 | [六栏](repair-evidence-02/issues/R4.png) / [完整本件](repair-evidence-02/issues/arms__arm_right__upper_arm-whole.png) |
| R5 | **自检通过**。仅把14中指自身接触侧皮肤及暗边向接触方向延续约2px；18食指、20掌面及后方指默认蒙版保留，按三个相关件组合复核。 默认状态背景细缝闭合；真实拇指空隙与指端分离保留，不靠后方指垫缝。 | [六栏](repair-evidence-02/issues/R5.png) / [完整本件](repair-evidence-02/issues/arms__arm_left__hand__middle_finger-whole.png) |
| R6 | **自检通过**。在34自己的皮肤、暖棕线与颊弧局部配准，依可见下颌与完整脸底切向接顺；隐藏发段依据本脸合理延续。 短促内凹回凸消除；完整脸底及默认露出颊弧均连续。 | [六栏](repair-evidence-02/issues/R6.png) / [完整本件](repair-evidence-02/issues/face__face_base-whole.png) |
| R7 | **自检通过**。沿32实际耳外弧用Krita原生深蓝黑5.8/4.2/2.8px笔触恢复线重，锁定自身alpha，转弯与下根逐渐收细；保留耳内暖面。 耳外弧深色收束恢复；耳形、内红色体积及高光保留，无头发投影。 | [六栏](repair-evidence-02/issues/R7.png) / [完整本件](repair-evidence-02/issues/face__ears__ear_left-whole.png) |
| R8 | **自检通过**。38自身上弧原生深蓝笔触及alpha锁定融色；共享眼开口只在40自身抗锯齿内缘下增加约1px承接；最终原生清理完整上弧多余线头，保留虹膜体积。40/57.5均未重画。 虹膜与睫毛连续深蓝接触；完整上弧干净，眼内组开关均正常。 | [六栏](repair-evidence-02/issues/R8.png) / [完整本件](repair-evidence-02/issues/face__eyes__eye_left__iris-whole.png) |
| R9 | **自检通过**。43按本眼独立画深蓝上弧，保留独有渐变与青色下部；共享开口只在45自身内缘下增加约1px承接；最终清掉完整上弧外小线头。 浅灰接线消除；完整轮廓干净，未镜像另一眼或移动眼组。 | [六栏](repair-evidence-02/issues/R9.png) / [完整本件](repair-evidence-02/issues/face__eyes__eye_right__iris-whole.png) |
| R10 | **自检通过**。三色重新生成41完整弧线，整张方图等比回120px原坐标；接受红褐较宽暗中心、柔和透明边与收细两端，再原生低不透明度暖色融接。 红褐中心、软边和眼皮体积恢复；原尺寸眼形、睫毛、高光保留。 | [六栏](repair-evidence-02/issues/R10.png) / [完整本件](repair-evidence-02/issues/face__eyes__eye_left__eyelid_crease-whole.png) |
| R11 | **自检通过**。按本眼参考三色重新生成46完整弧线，整张方图等比回120px；原生暖红融色，独立核查弧度、宽度、软边及两端。 暖红较宽中心与渐淡收口恢复；未恢复外来睫毛投影。 | [六栏](repair-evidence-02/issues/R11.png) / [完整本件](repair-evidence-02/issues/face__eyes__eye_right__eyelid_crease-whole.png) |
| R12 | **自检通过**。两次三色生成均因新增/改变发流线撤回；恢复本件原画，从同件相邻无其他暗线的蓝面局部取样融接亮条和色阶。撤回错误横线及S支线后，Krita沿明确本件曲线逐笔续单条深蓝线并收细末端。 亮条、水平色阶与补丁感消除；蓝面连续，保留单条原发流线，未带侧发/脸/衣领像素。 | [六栏](repair-evidence-02/issues/R12.png) / [完整本件](repair-evidence-02/issues/hair__back_hair-whole.png) |
| R13 | **自检通过**。针对review02真实右尖束[646,535,57,40]，沿01自己的下缘以4→2.8→1.8px深蓝原生笔触恢复描边并收尖。 可见下缘线重和收尖恢复；青蓝体积、根部及真实发缕空隙保留。 | [六栏](repair-evidence-02/issues/R13.png) / [完整本件](repair-evidence-02/issues/hair__back_hair-whole.png) |
| R14 | **自检通过**。三色重生本件耳顶局部，整张图等比回120px；原生局部取样接回后发并保留自身alpha及青蓝楔形，后续以自身软暗发流线跨接界面。 完整后发水平材质缝与窄竖色带融顺；合上耳正常，无耳线、肤色或耳投影。 | [六栏](repair-evidence-02/issues/R14.png) / [完整本件](repair-evidence-02/issues/hair__back_hair-whole.png) |
| R15 | **自检通过**。29本件衣面边缘局部配准去灰蓝凸段，与27自己的外缘接顺；两件各自完整覆盖、面料笔触与结构线保留。 躯干—骨盆组合外缘连续，无侧向台阶；没有带入裸腿肤色。 | [六栏](repair-evidence-02/issues/R15.png) / [完整本件](repair-evidence-02/issues/pelvis-whole.png) |
| R16 | **自检通过**。三色生成完整50粉红舌面，保留生成体积；仅本件上弧局部纵向注册成圆弧，再Krita局部1.5px软化与玫红气笔体积过渡。48口内、牙和唇保持独立。 上弧圆顺，口内—舌面过渡柔和；独显无折角，不含牙线、唇线或外来影。 | [六栏](repair-evidence-02/issues/R16.png) / [完整本件](repair-evidence-02/issues/face__mouth__tongue-whole.png) |

SELF-1：R3试稿的新尖点/横线已撤回并修净；SELF-2：两只完整虹膜外缘的原生线头已局部清理。最终证据都从最新KRA重新导出，不引用失败试稿作为完成依据。

[两眼原尺寸并排](repair-evidence-02/eyes-native.png) · [整头原尺寸](repair-evidence-02/head-native.png) · [手部原尺寸](repair-evidence-02/hand-native.png) · [口部原尺寸](repair-evidence-02/mouth-native.png) · [默认/全停用/恢复整图](repair-evidence-02/whole-mask-comparison.png)

## 实际part、图层UUID及来源

下表记录当前KRA全部59个逻辑part及60个实际绘画层。复用关系沿用原生成来源；修改件叠加本轮局部修画，具体取样/笔触记录见来源及操作JSON。后发原生局部取样合并更换过UUID，表中和manifest均采用最终重开后的UUID。

| Part ID | 实际图层名与UUID | 复用/绘画来源 | 完整画面 |
|---|---|---|---|
| `hair/back_hair` | `01 | hair/back_hair`<br>`{fa24462a-dbf9-4a69-b750-3ea97e41153b}` | 本件原生成；本轮局部修画；本轮三色重生 | [完整](repair-evidence-02/full-paint/hair__back_hair.png) |
| `legs/leg_left/shoes/cuff_back` | `02 | legs/leg_left/shoes/cuff_back`<br>`{c7e21fcd-d954-4109-acf1-63cabfccac75}` | 本件原生成 | [完整](repair-evidence-02/full-paint/legs__leg_left__shoes__cuff_back.png) |
| `legs/leg_right/shoes/cuff_back` | `03 | legs/leg_right/shoes/cuff_back`<br>`{69d40173-b7bc-41ff-b092-8bb57526da61}` | 本件原生成 | [完整](repair-evidence-02/full-paint/legs__leg_right__shoes__cuff_back.png) |
| `legs/leg_left/leg` | `04 | legs/leg_left/leg`<br>`{874466af-a8fd-455a-aa1a-4394f2c00e6a}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/legs__leg_left__leg.png) |
| `legs/leg_right/leg` | `05 | legs/leg_right/leg`<br>`{5af994ba-f02d-41ea-a44a-f44ddab7d654}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/legs__leg_right__leg.png) |
| `legs/leg_left/shoes/shoe_front` | `06 | legs/leg_left/shoes/shoe_front`<br>`{3b0f36c9-3065-485d-918d-394523b87ff3}` | 本件原生成 | [完整](repair-evidence-02/full-paint/legs__leg_left__shoes__shoe_front.png) |
| `legs/leg_right/shoes/shoe_front` | `07 | legs/leg_right/shoes/shoe_front`<br>`{68bc7cc0-95b4-498a-8685-4acfe0ee4380}` | 本件原生成 | [完整](repair-evidence-02/full-paint/legs__leg_right__shoes__shoe_front.png) |
| `arms/arm_left/bracelet_back` | `08 | arms/arm_left/bracelet_back`<br>`{23b0c987-5944-4ca2-b0f7-d97e3248db0b}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__bracelet_back.png) |
| `arms/arm_right/bracelet_back` | `09 | arms/arm_right/bracelet_back`<br>`{04a63182-d2f1-40e5-b8cd-ecdd6a2cbb8b}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__bracelet_back.png) |
| `arms/arm_left/hand/little_finger` | `10 | arms/arm_left/hand/little_finger`<br>`{e24c2a96-a10f-4610-bc8c-d41e53f31f45}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__little_finger.png) |
| `arms/arm_right/hand/little_finger` | `11 | arms/arm_right/hand/little_finger`<br>`{49267e18-4add-4309-8aa9-e030f5b6be36}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__little_finger.png) |
| `arms/arm_left/hand/ring_finger` | `12 | arms/arm_left/hand/ring_finger`<br>`{3b283a3e-8e41-4af0-bcaa-8f6e57dfc86a}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__ring_finger.png) |
| `arms/arm_right/hand/ring_finger` | `13 | arms/arm_right/hand/ring_finger`<br>`{4510cb4e-68bb-41e1-b8f5-f8f0f0ce8c2f}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__ring_finger.png) |
| `arms/arm_left/hand/middle_finger` | `14 | arms/arm_left/hand/middle_finger`<br>`{77dd7450-bfed-474a-9430-874a4e35f190}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__middle_finger.png) |
| `arms/arm_right/hand/middle_finger` | `15 | arms/arm_right/hand/middle_finger`<br>`{0c6436cb-0783-44e4-915e-43662c767392}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__middle_finger.png) |
| `arms/arm_left/hand/thumb` | `16 | arms/arm_left/hand/thumb`<br>`{bf191541-773a-4056-9e34-01cc88e4ca22}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__thumb.png) |
| `arms/arm_right/hand/thumb` | `17 | arms/arm_right/hand/thumb`<br>`{21d7568a-f9c4-416d-937a-1c663eb52b68}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__thumb.png) |
| `arms/arm_left/hand/index_finger` | `18 | arms/arm_left/hand/index_finger`<br>`{36299159-6089-4cfe-ba16-b3c65ec98710}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__index_finger.png) |
| `arms/arm_right/hand/index_finger` | `19 | arms/arm_right/hand/index_finger`<br>`{cee017cc-0abc-4690-a295-6ee7d8f12b4c}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__index_finger.png) |
| `arms/arm_left/hand/palm` | `20 | arms/arm_left/hand/palm`<br>`{a3cf3b02-afd4-4e7d-ac0e-6b3c6a9bdf1c}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__hand__palm.png) |
| `arms/arm_right/hand/palm` | `21 | arms/arm_right/hand/palm`<br>`{8dfddf91-2cc2-4ccc-a0e3-84812b3478bc}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__hand__palm.png) |
| `arms/arm_left/forearm` | `22 | arms/arm_left/forearm`<br>`{29bb2c4d-bdae-4cb3-b603-14ee0741e6dd}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__forearm.png) |
| `arms/arm_right/forearm` | `23 | arms/arm_right/forearm`<br>`{3beed03f-949d-4f3a-9353-13e87e8989bd}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__forearm.png) |
| `arms/arm_left/upper_arm` | `24 | arms/arm_left/upper_arm`<br>`{ac87d5b7-6c85-46bf-a23b-33a6b18b22aa}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__upper_arm.png) |
| `arms/arm_right/upper_arm` | `25 | arms/arm_right/upper_arm`<br>`{decfd947-28d2-4860-8930-4dfed8188037}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/arms__arm_right__upper_arm.png) |
| `neck` | `26 | neck`<br>`{68b98b37-a38c-4a70-8a26-fb87bb0cbe33}` | 本件原生成 | [完整](repair-evidence-02/full-paint/neck.png) |
| `body/torso` | `27 | body/torso`<br>`{1630b7d7-6097-4334-84b5-2a48b92064d4}` | 本件原生成 | [完整](repair-evidence-02/full-paint/body__torso.png) |
| `body/breast` | `28 | body/breast`<br>`{337c5213-e37a-4929-8120-79f04a3a5aa1}` | 本件原生成 | [完整](repair-evidence-02/full-paint/body__breast.png) |
| `pelvis` | `29 | pelvis`<br>`{8077f372-abff-4fe4-99dd-2f7ab598740c}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/pelvis.png) |
| `arms/arm_left/bracelet_front` | `30 | arms/arm_left/bracelet_front`<br>`{7f3567bd-d211-4b7a-bb5f-818ad5d3bb05}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_left__bracelet_front.png) |
| `arms/arm_right/bracelet_front` | `31 | arms/arm_right/bracelet_front`<br>`{96cddaae-29c8-45df-b682-87d65a38d5d3}` | 本件原生成 | [完整](repair-evidence-02/full-paint/arms__arm_right__bracelet_front.png) |
| `face/ears/ear_left` | `32 | face/ears/ear_left`<br>`{2b674aab-ffe3-41d3-a0fa-55462a22040a}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/face__ears__ear_left.png) |
| `face/ears/ear_right` | `33 | face/ears/ear_right`<br>`{e6e34b95-dec1-4923-bb8e-2d2eb4ac4a1f}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__ears__ear_right.png) |
| `face/face_base` | `34 | face/face_base`<br>`{c3f39273-f952-456f-aa58-4cfd3ee4b101}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/face__face_base.png) |
| `face/blush_left` | `35 | face/blush_left`<br>`{c1f6358e-afa3-4af4-bbc0-07432ad35e95}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__blush_left.png) |
| `face/blush_right` | `36 | face/blush_right`<br>`{e2db8f94-dac4-49a0-9f58-e447b3960664}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__blush_right.png) |
| `face/eyes/eye_left/sclera` | `37 | face/eyes/eye_left/sclera`<br>`{0d6b92bf-92d0-494b-acf9-c7a6d133c5c0}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_left__sclera.png) |
| `face/eyes/eye_left/iris` | `38 | face/eyes/eye_left/iris`<br>`{79ed3649-fddc-4bf8-b9fc-0267f7e9d4c1}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/face__eyes__eye_left__iris.png) |
| `face/eyes/eye_left/highlight` | `39 | face/eyes/eye_left/highlight`<br>`{38d785a0-2b85-4126-a5d4-2d995993c0cb}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_left__highlight.png) |
| `face/eyes/eye_left/upper_eyelid` | `40 | face/eyes/eye_left/upper_eyelid`<br>`{c3ca46a1-bc2b-4c65-ab25-ae532b8e67c1}`<br>`57.5 | face/eyes/eye_left/upper_eyelid [outer_spike]`<br>`{e1477f07-0c7c-4d2b-ac85-5049561f43fe}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_left__upper_eyelid.png) |
| `face/eyes/eye_left/eyelid_crease` | `41 | face/eyes/eye_left/eyelid_crease`<br>`{2de44cab-5ac3-49c4-a5a0-b84429a0818c}` | 本件原生成；本轮局部修画；本轮三色重生 | [完整](repair-evidence-02/full-paint/face__eyes__eye_left__eyelid_crease.png) |
| `face/eyes/eye_right/sclera` | `42 | face/eyes/eye_right/sclera`<br>`{14a479b6-89ad-4a9f-ad72-d21873a39134}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_right__sclera.png) |
| `face/eyes/eye_right/iris` | `43 | face/eyes/eye_right/iris`<br>`{58cb7d99-1303-47b8-8317-5b18387cf4e3}` | 本件原生成；本轮局部修画 | [完整](repair-evidence-02/full-paint/face__eyes__eye_right__iris.png) |
| `face/eyes/eye_right/highlight` | `44 | face/eyes/eye_right/highlight`<br>`{5b2f210f-f4fd-4df9-b302-1c9cd63f747e}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_right__highlight.png) |
| `face/eyes/eye_right/upper_eyelid` | `45 | face/eyes/eye_right/upper_eyelid`<br>`{2397666a-3d0c-482b-bd9f-4e48785e77ae}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyes__eye_right__upper_eyelid.png) |
| `face/eyes/eye_right/eyelid_crease` | `46 | face/eyes/eye_right/eyelid_crease`<br>`{4ca54efb-c6fb-451f-a1ac-b29fb3ce1de7}` | 本件原生成；本轮局部修画；本轮三色重生 | [完整](repair-evidence-02/full-paint/face__eyes__eye_right__eyelid_crease.png) |
| `face/nose` | `47 | face/nose`<br>`{701f1a49-8a4c-497e-8bb8-710deea1d56e}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__nose.png) |
| `face/mouth/mouth_interior` | `48 | face/mouth/mouth_interior`<br>`{2835ab5e-38b6-44ab-a436-6010fcfa217f}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__mouth__mouth_interior.png) |
| `face/mouth/lower_teeth` | `49 | face/mouth/lower_teeth`<br>`{cfd92245-2bed-4dd6-8962-aa81b90e43c8}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__mouth__lower_teeth.png) |
| `face/mouth/tongue` | `50 | face/mouth/tongue`<br>`{3befd481-21d8-44a8-96bc-a4ab7e95a6d0}` | 本件原生成；本轮局部修画；本轮三色重生 | [完整](repair-evidence-02/full-paint/face__mouth__tongue.png) |
| `face/mouth/upper_teeth` | `51 | face/mouth/upper_teeth`<br>`{076da129-6653-41b1-89ac-b83043cdb5a1}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__mouth__upper_teeth.png) |
| `face/mouth/lower_lip` | `52 | face/mouth/lower_lip`<br>`{49667a5f-c28a-4103-89b3-a8bd132ee9e5}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__mouth__lower_lip.png) |
| `face/mouth/upper_lip` | `53 | face/mouth/upper_lip`<br>`{3c5522af-747a-4063-92cd-1d5098b84d6d}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__mouth__upper_lip.png) |
| `face/eyebrows/eyebrow_left` | `54 | face/eyebrows/eyebrow_left`<br>`{29fe8dcd-4637-48dc-b6d6-873445abd084}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyebrows__eyebrow_left.png) |
| `face/eyebrows/eyebrow_right` | `55 | face/eyebrows/eyebrow_right`<br>`{fcd3d071-f0f5-4ba1-b691-ddf2eec5ccf1}` | 本件原生成 | [完整](repair-evidence-02/full-paint/face__eyebrows__eyebrow_right.png) |
| `hair/bangs` | `56 | hair/bangs`<br>`{d8460341-1a17-4ea7-85e2-55efc4e6b0b3}` | 本件原生成 | [完整](repair-evidence-02/full-paint/hair__bangs.png) |
| `hair/side_hair/side_hair_left` | `57 | hair/side_hair/side_hair_left`<br>`{d0910d01-e059-41dd-a4f6-0e1eef1138bd}` | 本件原生成 | [完整](repair-evidence-02/full-paint/hair__side_hair__side_hair_left.png) |
| `hair/side_hair/side_hair_right` | `58 | hair/side_hair/side_hair_right`<br>`{78ad74b6-ab8f-4b6a-a7e9-7b4d20188fbf}` | 本件原生成 | [完整](repair-evidence-02/full-paint/hair__side_hair__side_hair_right.png) |
| `head_accessories` | `59 | head_accessories`<br>`{f9d0168b-70a0-4328-ae5e-3a1f137a6579}` | 本件原生成 | [完整](repair-evidence-02/full-paint/head_accessories.png) |

[当前节点/深度/片UUID清单](layer-manifest.json) · [全部59件默认蒙版PNG索引](repair-evidence-02/default-part-exports.json) · [13修改件完整四状态](repair-evidence-02/exports.json)

上睑40与57.5仍为`face/eyes/eye_left/upper_eyelid`的两个深度分片；两片原始像素、位置及共同运动身份均保留，没有删除“重复层”。后发取样merge仅更换本件绘画节点UUID，未改变其身份或深度。上游84个分层/参考文件与独立review-02哈希一致，终止ID及全表深度逐项匹配；未启动上游流程。

## 10张原生透明度蒙版

全部逐一切换检查。默认保持原参考开口及后方部件遮挡；停用后可见完整纹理。两眼开口上睑内缘下仅预留约1px承接，分别92/93个选区像素变化，下缘仍以眼白下沿定义，共享控制眼白、虹膜和高光；口内共用上下唇开口。

| 蒙版/UUID | 所属层或组/UUID | 控制区域与检查 | 证据 |
|---|---|---|---|
| `后方手指默认遮挡`<br>`{06c0d344-178f-4185-b953-a9ed4cc37ebc}` | `10 | arms/arm_left/hand/little_finger`<br>`{e24c2a96-a10f-4610-bc8c-d41e53f31f45}` | 并拢手姿后方手指默认整体不可见；可单独解除检查完整指身；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/00-comparison.png) |
| `后方手指默认遮挡`<br>`{a557dafb-b0ff-46c4-88dd-a390e968eea9}` | `11 | arms/arm_right/hand/little_finger`<br>`{49267e18-4add-4309-8aa9-e030f5b6be36}` | 并拢手姿后方手指默认整体不可见；可单独解除检查完整指身；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/01-comparison.png) |
| `后方手指默认遮挡`<br>`{83eb02f1-3940-4058-bacf-aeaac4af2b78}` | `12 | arms/arm_left/hand/ring_finger`<br>`{3b283a3e-8e41-4af0-bcaa-8f6e57dfc86a}` | 并拢手姿后方手指默认整体不可见；可单独解除检查完整指身；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/02-comparison.png) |
| `高光虹膜范围 left`<br>`{4ea9dc55-ede2-48ce-9270-2f1eaacb036f}` | `39 | face/eyes/eye_left/highlight`<br>`{38d785a0-2b85-4126-a5d4-2d995993c0cb}` | 左高光随虹膜并限于虹膜内部；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/03-comparison.png) |
| `眼睛开口 left`<br>`{ec448c7c-5c37-470a-b8b5-d3deeb129eea}` | `眼内开合 left`<br>`{94d3ca79-8e5c-4b9f-98d2-f5aa0b82bd09}` | 左眼上眼睑内缘—眼白下沿共同开口；裁切眼白、虹膜、高光；本轮上内缘局部承接已更新；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/04-comparison.png) |
| `高光虹膜范围 right`<br>`{ab4087a9-f7c6-4c0e-9b31-a7e58be174df}` | `44 | face/eyes/eye_right/highlight`<br>`{5b2f210f-f4fd-4df9-b302-1c9cd63f747e}` | 右高光随虹膜并限于虹膜内部；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/05-comparison.png) |
| `眼睛开口 right`<br>`{724c8473-73f7-446c-acd6-6af70e70b7df}` | `眼内开合 right`<br>`{f4505ea6-0e42-4b78-8c9e-e53184232b3d}` | 右眼上眼睑内缘—眼白下沿共同开口；裁切眼白、虹膜、高光；本轮上内缘局部承接已更新；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/06-comparison.png) |
| `下牙默认遮挡`<br>`{4ef4f667-6607-458d-ab72-855884296f24}` | `49 | face/mouth/lower_teeth`<br>`{cfd92245-2bed-4dd6-8962-aa81b90e43c8}` | 下嘴与舌面控制下牙默认整体不可见；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/07-comparison.png) |
| `上牙露出带`<br>`{582994c8-f7c8-49a0-994c-c1a1924ede30}` | `51 | face/mouth/upper_teeth`<br>`{076da129-6653-41b1-89ac-b83043cdb5a1}` | 上唇控制整片上牙根部及窄露出带；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/08-comparison.png) |
| `上下唇开口`<br>`{804808d6-e706-4cdb-80c0-cbd4c3867f2b}` | `口内开合`<br>`{6cda5519-1733-4803-91f3-f8015f0a8d67}` | 上下唇内缘及嘴角共同开口；裁切口腔、上下牙、舌面；选区不变；开关已看，完整底层保留 | [开/关](repair-evidence-02/masks/09-comparison.png) |

[开口归零/恢复原尺寸](repair-evidence-02/common-opening-zero-head.png) · [蒙版检查与像素保持](mask-verification.json) · [眼开口局部变更依据](repair-evidence-02/eye-opening-underlap.json)

## 保存、重开与交付一致性

最后保存权威KRA后关闭并重新打开：60绘画层、59逻辑件、3组、10蒙版的完整树、UUID、位置、混合模式、不透明度、显隐、全部绘画BGRA、蒙版选区及合成像素完全一致。10张蒙版最终均启用原默认控制。重开后的合成、正式PNG、最终默认导出、蒙版恢复导出及KRA内mergedimage的解码RGBA完全一致。

全部59个默认part PNG已更新，导出保持蒙版启用；导出过程未改变底层绘画、蒙版或最终合成。哈希只用于持久化和未修改输入核验；画面质量由原尺寸、独显、隐藏上层与合成目视检查判定。

[重开验证](reopen-verification.json) · [PNG/KRA精确一致性](repair-evidence-02/export-consistency.json) · [上游输入保持](repair-evidence-02/input-verification.json)
