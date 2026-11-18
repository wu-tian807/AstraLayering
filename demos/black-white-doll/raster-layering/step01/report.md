# Step01 分层人物绘画交付（repair-02 更新）

结论：review-02 的 **15 项**已逐项修复。当前 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/character-depth.kra` 为 **70 个逻辑part、77 个普通绘画分片、10 个原生眼口开口蒙版**，画布1086 × 1448，RGBA/U8。默认导出为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/character-depth.png`。本轮逐项记录和证据见 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-02.md.tmp`。

实际参考始终为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/base-subject.png`。对照采用固定同坐标、同倍率，未移动、缩放或变形参考来迁就工程。形体、线条与接色按看图判断；像素散列只核对保护结果和保存重开，不代替画质验收。

## 本轮保护与输入同步

沿用现有KRA及成功的生成结果。本轮修整16个逻辑part，另外 **54 件原生绘画像素逐字节未变**。返修前75个绘画owner UUID全部保留，包括原先66个非马尾逻辑件的原始owner；只新增两层眉毛深度分片。10个原生开口蒙版的UUID、所属owner和原始选区像素均保留，未重建或改挂。保护记录为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/records/painting-preservation-audit.json`。

上游 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/groups.json` 仍为70个终止ID，包含无子节点的neck、pelvis；马尾仍为整组→左右两条→每侧前后两件，共四件。分组未变。深度表已通过edit_occlusion同步为77个区域；未新增独立逻辑节点。当前parts-manifest、layer-map、paint-records及native-solo索引都对应70／77。全部70件取样、三色控制图、选区和深度缓存重新构建，活动目录为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/controls-repair02`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/selection-masks-repair02`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/depth-regions-repair02`，不继续使用旧76件或75片活动缓存。

当前groups SHA256：`2ab37e5da152002ce1d420c9ae1274614917058422984273c92196b842525bdb`；occlusion SHA256：`cd5e647b528456567cb42d5e7738c968289356c52d1d6fd97f6231daac87a88d`。每件SVG指纹与同步依据见 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/records/metadata-sync.json` 及 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/cache-index.json`。

## 深度、形状与共同运动

| 来源 | 原part ID | 深度 | 区域与理由 |
| --- | --- | --- | --- |
| 预先标注 | hair/ponytail/ponytail_left/ponytail_back | 1／5 | 后发面／前绕细束，保持共同运动。 |
| repair-01 | arms/arm_left/hand/thumb | 22／24.5 | 掌后圆根／掌前游离指身与指甲。 |
| repair-01 | arms/arm_right/hand/thumb | 23／25.5 | 掌后圆根／掌前游离指身与指甲。 |
| repair-01 | face/eyes/eye_left/upper_eyelid | 42／65.5 | 发后主弧／白侧发前外眼尾。 |
| repair-01 | face/eyes/eye_right/upper_eyelid | 43／66.5 | 发后主弧／黑侧发前外眼尾。 |
| repair-02组装核实 | face/eyebrows/eyebrow_left | 48／67.1 | 发下完整延续／原图可见的跨白发与刘海长弧。 |
| repair-02组装核实 | face/eyebrows/eyebrow_right | 49／67.2 | 发下端部余量／原图可见的跨黑发与刘海长弧。 |

本轮新增的两层仅持有原眉毛自己的笔触；发下段和发前段保持同一part归属和共同运动。所有实际分片都是普通绘画层。没有给头发挖洞、局部透明或加透眉蒙版；没有将眉线烘焙进头发。

本轮源形状修改为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/parts/arms/arm_right/hand/middle_finger.svg`：约y750–781的分段鼓包改为平顺渐细曲线，末端位置和整体弯向保留；已有绘画只局部重新配准并以原生笔触接顺。对应ID和深度19保持，SVG、当前绘画及缓存同步。

repair-01 对两腿完整足踝和右后鞋帮孔的源SVG修正继续保留；本轮未重新改写这些有效绘画。一般遮挡仍由真实深度承担，眼尾42／65.5、43／66.5，拇指22／24.5、23／25.5以及后马尾1／5均保持。

## 本轮绘画处理

掌指接缝只在各自所属层的交接处修色、修线。掌面只用本掌干净材质，指根及长指接段用原生柔笔接续亮面和红暗侧；原图指甲、指尖及整体位置保留。右掌外缘的闭合盖帽暗点清净后按真手缘接回中指。试修时误带的邻指细线已撤回，最终没有将其他指或袜面像素留进本件。取样导入的预乘透明度暗边也已修正：最终保留本件原生透明度，以直通RGBA写回并重新看图。

白前马尾下卷按三色控制图局部生成，再按本件原图笔触局部取样修回可见发流和弯曲灰紫色带，去除新增竖亮条、叉形亮束；扎点、开隙和正常细束完整保留。白后马尾细束以原生画笔恢复双侧边、亮面和宽度变化，保持1／5实际交叉。

躯干隐藏衣缝以本件衣料取样清掉旧折线，再画连续切向和渐变浓淡的细曲线；胸部保持独立。腰部左衣缝分别在torso与pelvis局部对齐原笔触，线旁底色和抗锯齿一起接顺。两上臂局部生成干净皮肤，去掉衣物轮廓形残线和暗楔，保留自身轮廓及体积。左右局部材质适合镜像复用：右上臂采用左侧新生成材质的镜像，按x_source=1088−x独立配准，原右臂透明形状和owner均保留。

双眉只修正实际可见弧的深度，并将偏红褐笔触修回参考深色，透明度与细弧粗细保留；左眉发下短尾补成完整延续。脸底两侧颊颌细线在本件上画完，不带颈线、耳发或下巴投影。白侧眼尾按原图本件色素局部取样分离背景，恢复回挑细钩与灰红细尾，不改眼白、虹膜或独立高光。

本轮局部生成结果与输入：

- 白前马尾下卷：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/agents/2026-11-16T10-45-24-524Z-raster_step01-unktoq/cli-data/codex/generated_images/01a1e3f6-3d40-79e1-bcac-50f9603dd4c9/call_05a059f03e2a4656b3aedce6ae90fc2d.png`；取样 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/repair02/inputs/white-curl-sample.png`，控制 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/repair02/inputs/white-curl-control.png`。
- 上臂干净皮肤：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/agents/2026-11-16T10-45-24-524Z-raster_step01-unktoq/cli-data/codex/generated_images/01a1e3f6-3d40-79e1-bcac-50f9603dd4c9/call_7a8b5125088e41e5bc8ff55c702c4489.png`；取样 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/repair02/inputs/upper-arm-left-sample.png`，控制 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/repair02/inputs/upper-arm-left-control.png`。

三色含义为红色本件可见依据、黄色本件补全、绿色件外透明；输入遮挡物与件外内容已置中性灰。后发按已读补充保持连续发面和自身体积。成功生成结果保留，修整在已有画面局部进行；没有沿轮廓整块重填本件。完整逐件生成来源、原生修整与复用记录见 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/paint-records.json`，新生成记录为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/records/generation-sources.json`。

## 与粗色块及源补全形状的差异

- 右中指局部鼓包的源路径已修正并同步，不以裁掉凸点后留切边的方式交付。
- 两眉按原图可见交叉分到发前；发下原有补全面保留。左眉极端细尾补回源轮廓规定的隐藏延续。头发形状及透明度不变。
- 右掌外缘接点的原生反锯齿按真实手缘局部接顺，未移动手掌或整指。其他指的细轮廓和眼尾的细钩以原图为准，可越出粗像素色块的边缘；不为消除碎线简化原形。
- 白前马尾只修局部材质与多余亮束，保留既有完整主形；后发细束宽度和转面回到原参考，不更改逻辑归属。
- 前轮两腿窄足与后帮错误孔的有效上游修正继续沿用；前鞋体真实扣孔、原图黑发银白细发和粉条、腮红红底与斜线、指甲和眼高光均保留。

## 原生开口控制与归属

10个透明度蒙版只属于双眼各自sclera／iris／highlight及mouth_interior／lower_teeth／tongue／upper_teeth，限制真实眼口开口。全部绘画层inheritAlpha=false，没有剪贴或一般遮挡显隐蒙版。默认与参考一致为睁眼、张嘴；下牙由舌和下唇自然遮挡。

本轮逐项检查停用后的完整内容、参考开口启用、闭合测试及恢复默认；全部绘画像素未改，原始选区准确恢复。当前owner、UUID和控制区域如下，记录 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/opening-control-check.json`。本轮未重建这些蒙版；旧轮次的历史UUID仅留于来源记录。

| part／owner | owner UUID | 原生蒙版名 | 蒙版 UUID | 共同控制区域 |
| --- | --- | --- | --- | --- |
| face/eyes/eye_left/sclera<br>D036.0 &#124; face/eyes/eye_left/sclera | {d6a48281-13a3-48d9-b9b4-0f6744c809a4} | OPENING &#124; eye_left &#124; shared aperture | {2f703e78-ba71-4c64-b272-d340fb5b8d6a} | eye_left<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_left__opening.png |
| face/eyes/eye_left/iris<br>D038.0 &#124; face/eyes/eye_left/iris | {3e729b40-ba98-43f7-bcd7-c165fe64d54b} | OPENING &#124; eye_left &#124; shared aperture | {e35b204c-17be-42d3-9431-da250ca1eedf} | eye_left<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_left__opening.png |
| face/eyes/eye_left/highlight<br>D040.0 &#124; face/eyes/eye_left/highlight | {f6d14c01-e53e-45cd-b6fc-1deabd15c97b} | OPENING &#124; eye_left &#124; shared aperture | {c72fa4cd-dc6e-4d93-8267-0950c3e8ef93} | eye_left<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_left__opening.png |
| face/eyes/eye_right/sclera<br>D037.0 &#124; face/eyes/eye_right/sclera | {b0846450-9172-4195-9173-adbc29ab66ca} | OPENING &#124; eye_right &#124; shared aperture | {54b755d2-eced-433a-8527-9b960ca081b5} | eye_right<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_right__opening.png |
| face/eyes/eye_right/iris<br>D039.0 &#124; face/eyes/eye_right/iris | {9ff9f155-33df-4bba-b4dc-364ab7882f6e} | OPENING &#124; eye_right &#124; shared aperture | {9383eaf3-c36b-453b-a78c-39ee6bf7adee} | eye_right<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_right__opening.png |
| face/eyes/eye_right/highlight<br>D041.0 &#124; face/eyes/eye_right/highlight | {281fe8f6-7c28-4b2a-84a2-ed885292fbec} | OPENING &#124; eye_right &#124; shared aperture | {f6b437ec-2d88-48fd-9604-cf03dde7b630} | eye_right<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/eye_right__opening.png |
| face/mouth/mouth_interior<br>D053.0 &#124; face/mouth/mouth_interior | {905b720d-3f33-49dc-b613-21464d968db2} | OPENING &#124; mouth &#124; shared aperture | {d59f8575-e70c-4aa0-abae-b9e985258d31} | mouth<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/mouth__opening.png |
| face/mouth/lower_teeth<br>D054.0 &#124; face/mouth/lower_teeth | {25e6a366-46b0-4fb5-9cf1-4b1252d3edd6} | OPENING &#124; mouth &#124; shared aperture | {552e3474-ae73-4ba8-aed7-009a2be45c19} | mouth<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/mouth__opening.png |
| face/mouth/tongue<br>D055.0 &#124; face/mouth/tongue | {61e61d10-ee32-4cf7-92fa-17440a9a1d9d} | OPENING &#124; mouth &#124; shared aperture | {e83b6cd2-3a28-4c18-8335-8562c7114bc7} | mouth<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/mouth__opening.png |
| face/mouth/upper_teeth<br>D056.0 &#124; face/mouth/upper_teeth | {2e5dc718-2c60-4632-bd4d-e88005b2c5ad} | OPENING &#124; mouth &#124; shared aperture | {3c23808f-8647-46ed-8650-fd7fe0f39797} | mouth<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/feature-local-v70/mouth__opening.png |







## 对照、覆盖与磁盘重开

本轮对16件修整部件逐项查看完整独显、隐藏上层、默认整图；重点同坐标四列图的顺序为参考／本件独显／隐藏上层／整图。七个多深度part的14个实际分片也分别检查三视图。全部70件的当前三视图均重新导出，未修整的54件用像素保护记录确认原画保留。修改问题逐项证据见repair-02.md.tmp。











KRA已保存、关闭并从指定磁盘路径重开。层树、UUID、名称、类型、深度顺序、默认可见性、画布和色彩配置一致，所有绘画像素、原生蒙版选区及合成RGBA像素一致。最终合成像素SHA256为 `93565392ab0c66913abc346e76d7fac7dfb002377a142871ba66a9d048230205`，记录 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/save-reopen-verification.json`。该散列只证明保存重开不改变像素，不是画质指标。结构核对无未知层、无空深度分片或越出配准画布的层；上游SVG绑定、70个ID与77个深度均与KRA一致。



## 当前完整图层映射（从后到前）

| 原part ID | 实际图层名 | UUID | 最终深度 | 区域／控制职责 | 复用 |
| --- | --- | --- | --- | --- | --- |
| hair/ponytail/ponytail_left/ponytail_back | D001.0 &#124; hair/ponytail/ponytail_left/ponytail_back &#124; rear_surface | {97f63bbf-cdba-4e09-9ce7-9e33ea689fb1} | 1 | 画面右侧马尾的外侧下垂后发面、内侧后方延伸、较低宽卷及底部回绕细梢；均在 hair/ponytail/ponytail_left/ponytail_front 的中央宽卷之后，并在 arms/arm_left/upper_arm、arms/arm_left/forearm 之后。与前方区域的分界沿同一外绕细束的两条束缘及其汇入外侧后发面的连接，不沿横向腰线或辅助填色划分。 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/ponytail/ponytail_right/ponytail_back | D002.0 &#124; hair/ponytail/ponytail_right/ponytail_back | {c51a8a72-68f6-46a4-b3c4-019b4572ba2d} | 2 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/ponytail/ponytail_left/ponytail_front | D003.0 &#124; hair/ponytail/ponytail_left/ponytail_front | {d57b889c-1e87-4bb7-ad0c-9813c75ad853} | 3 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/ponytail/ponytail_right/ponytail_front | D004.0 &#124; hair/ponytail/ponytail_right/ponytail_front | {704ac90b-23ae-425c-8700-d65b179edb8b} | 4 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/ponytail/ponytail_left/ponytail_back | D005.0 &#124; hair/ponytail/ponytail_left/ponytail_back &#124; front_sweep | {21c33243-4378-486e-af36-6916afe1b117} | 5 | 同一后发面所属的一条细窄外绕束，在画面约 x680–760、y425–503 从内侧斜向右下掠过中央宽卷；尤其 x716–756、y469–501 可见连续双侧束缘压过 hair/ponytail/ponytail_left/ponytail_front。该连续细束及其接入外侧后发面的局部在中央宽卷之前，仍在 arms/arm_left/forearm 后。按细束自身两侧边缘追踪，进入后发面处沿束缘汇合过渡；不得把整个低位宽卷抬前。 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/hair_cap | D006.0 &#124; hair/hair_cap | {94c4693b-9af1-4887-849b-a44c4e8ae1fa} | 6 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_left/shoes/collar_back | D007.0 &#124; legs/leg_left/shoes/collar_back | {f81f5ff1-1813-4858-84e8-836e21a39123} | 7 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_left/shoes/ankle_strap/ankle_strap_back | D008.0 &#124; legs/leg_left/shoes/ankle_strap/ankle_strap_back | {33bd2a01-497b-49b6-aa70-a900ef58bcb5} | 8 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_right/shoes/rear_collar | D009.0 &#124; legs/leg_right/shoes/rear_collar | {955e9986-5704-44c4-bc4a-3857278ec12f} | 9 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_left/leg | D010.0 &#124; legs/leg_left/leg | {cefe2b59-92ac-4b75-92c1-23a71a91d23a} | 10 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_right/leg | D011.0 &#124; legs/leg_right/leg | {5f4aafde-aafd-4b83-9467-33e594de7f3b} | 11 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| pelvis | D012.0 &#124; pelvis | {b9061b38-ae00-46a4-96d4-509567f3dae9} | 12 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/little_finger | D014.0 &#124; arms/arm_left/hand/little_finger | {43a6cefa-c016-413f-b3f8-2e77901d9244} | 14 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/little_finger | D015.0 &#124; arms/arm_right/hand/little_finger | {1c41aedd-be72-4586-a485-cedaed9115a7} | 15 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/ring_finger | D016.0 &#124; arms/arm_left/hand/ring_finger | {bc4240c8-ca4b-4846-85b2-ad08825f7da2} | 16 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/ring_finger | D017.0 &#124; arms/arm_right/hand/ring_finger | {ac1ace21-7413-43bb-9e12-c1fd8000fbf7} | 17 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/middle_finger | D018.0 &#124; arms/arm_left/hand/middle_finger | {70a48136-79a4-4fb3-89ff-618c1841d27b} | 18 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/middle_finger | D019.0 &#124; arms/arm_right/hand/middle_finger | {1d21298b-68e3-47b5-ae9e-e456892a274d} | 19 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/index_finger | D020.0 &#124; arms/arm_left/hand/index_finger | {a7f3b5a6-bd56-4178-848d-1d040d23ab61} | 20 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/index_finger | D021.0 &#124; arms/arm_right/hand/index_finger | {46a2f005-f975-479d-b963-0899922da2ba} | 21 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/thumb | D022.0 &#124; arms/arm_left/hand/thumb &#124; root_behind_palm | {0da721a0-936e-483f-802b-060acea54fe9} | 22 | 完整拇指近端圆根及掌下承接段，约 y702–720，沿拇指根与掌心相接的弯曲截面进入掌后；保留连续完整原生指体底画。 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/thumb | D023.0 &#124; arms/arm_right/hand/thumb &#124; root_behind_palm | {b431a766-e0cf-4756-b5bb-7db516654159} | 23 | 拇指完整近端圆根及掌下延续，约 y695–719，藏在本侧掌部 D025 后；不抬前完整补全圆根。 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/palm | D024.0 &#124; arms/arm_left/hand/palm | {9e935d1f-a24a-450d-ae8b-e2a0206823f6} | 24 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/hand/thumb | D024.5 &#124; arms/arm_left/hand/thumb &#124; front_finger | {015927e5-ba89-4a67-8d46-e443548a96ba} | 24.5 | 同一拇指由根部转出的可见指身、甲面和细外缘，约 x659–680、y719–755，在本侧掌部 D024 的补全前；前后分片沿 x664/y720 至 x680/y720 左右的根部曲线连续衔接。指身仍盖食指，不把整根圆头抬到掌前。 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/palm | D025.0 &#124; arms/arm_right/hand/palm | {fedc19dc-c14c-49d3-9740-39837d6b2fad} | 25 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/hand/thumb | D025.5 &#124; arms/arm_right/hand/thumb &#124; front_finger | {9d109ffc-ebfe-4fe5-abea-32c63216c36b} | 25.5 | 同一拇指从掌侧转出的短指身、甲面与红暗外缘，约 x401–426、y714–755，位于 D025 掌补全前、食指前。根身分界沿约 x402/y714 至 x421/y720 的自然弯曲截面，两个分片连续同动。 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/forearm | D026.0 &#124; arms/arm_left/forearm | {b3aaaf3b-975b-49e6-ba87-29a5886811ed} | 26 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/forearm | D027.0 &#124; arms/arm_right/forearm | {77745b28-7235-486b-8afa-f3fbf816bd4a} | 27 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_left/upper_arm | D028.0 &#124; arms/arm_left/upper_arm | {f10018ea-0b99-4738-a459-405dcb2c318f} | 28 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| arms/arm_right/upper_arm | D029.0 &#124; arms/arm_right/upper_arm | {4323d60b-9de3-43a0-ad2e-ed4b7505a560} | 29 | 完整逻辑部件 | {"sourcePart":"arms/arm_left/upper_arm","operation":"Mirror local generated pale-skin material and register x_source=1088-x; preserve right native alpha/edges."} |
| neck | D030.0 &#124; neck | {7c9213b7-ec58-4bbd-a966-2ec28be4c5ff} | 30 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| body/torso | D031.0 &#124; body/torso | {facc9531-601b-4dcd-9af7-108430d288c3} | 31 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| body/breast | D032.0 &#124; body/breast | {1961dad3-adb0-4599-96b0-ef2d4e295527} | 32 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/ears/ear_left | D033.0 &#124; face/ears/ear_left | {7ef45aa6-e5e7-4a98-bfff-26dd2a2eae86} | 33 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/ears/ear_right | D034.0 &#124; face/ears/ear_right | {f2b91761-c1f0-4adc-9a0b-25f7a7481322} | 34 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/face_base | D035.0 &#124; face/face_base | {5120839e-f4ec-4fc8-9539-ecb251cfc63b} | 35 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/sclera | D036.0 &#124; face/eyes/eye_left/sclera | {d6a48281-13a3-48d9-b9b4-0f6744c809a4} | 36 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/sclera | D037.0 &#124; face/eyes/eye_right/sclera | {b0846450-9172-4195-9173-adbc29ab66ca} | 37 | 完整逻辑部件 | [{"id":"face/eyes/eye_right/sclera","reuseSource":"face/eyes/eye_left/sclera","sourceUUID":"{d6a48281-13a3-48d9-b9b4-0f6744c809a4}","targetUUID":"{b0846450-9172-4195-9173-adbc29ab66ca}","mirrorX":true,"sourceBounds":[565,141,40,31],"targetBounds":{"left":481,"top":141,"width":39,"height":31},"reason":"The complete frontal sclera is a symmetric white curved surface. Mirror the clean complete painted surface; preserve independent original upper lids, iris designs, glints and side-specific anatomical apertures."}] |
| face/eyes/eye_left/iris | D038.0 &#124; face/eyes/eye_left/iris | {3e729b40-ba98-43f7-bcd7-c165fe64d54b} | 38 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/iris | D039.0 &#124; face/eyes/eye_right/iris | {9ff9f155-33df-4bba-b4dc-364ab7882f6e} | 39 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/highlight | D040.0 &#124; face/eyes/eye_left/highlight | {f6d14c01-e53e-45cd-b6fc-1deabd15c97b} | 40 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/highlight | D041.0 &#124; face/eyes/eye_right/highlight | {281fe8f6-7c28-4b2a-84a2-ed885292fbec} | 41 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/upper_eyelid | D042.0 &#124; face/eyes/eye_left/upper_eyelid &#124; main_arc | {0e0d66d6-a711-46ee-abb6-eee2a0abd8a2} | 42 | 左上眼睑主体、上睫毛弧及发下连续部分，在眼白虹膜前、刘海和白侧发后；不把整只眼睑抬到头发前。 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/upper_eyelid | D043.0 &#124; face/eyes/eye_right/upper_eyelid &#124; main_arc | {8689f19d-ec05-43f9-8f35-70a804dd539b} | 43 | 右上眼睑主弧、上睫毛及发下延续，在眼白虹膜前、黑侧发和刘海后。 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/lower_eyelashes | D044.0 &#124; face/eyes/eye_left/lower_eyelashes | {914ddc36-1348-41cb-87bc-7c853b002beb} | 44 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/lower_eyelashes | D045.0 &#124; face/eyes/eye_right/lower_eyelashes | {c716fdf1-2523-44a7-9ed7-79bbeb38b357} | 45 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/eyelid_crease | D046.0 &#124; face/eyes/eye_left/eyelid_crease | {9a787a45-40ed-4f18-91be-dba46cd1f213} | 46 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/eyelid_crease | D047.0 &#124; face/eyes/eye_right/eyelid_crease | {58270692-50f3-4801-a480-f4610f4c53da} | 47 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyebrows/eyebrow_left | D048.0 &#124; face/eyebrows/eyebrow_left &#124; under_hair | {d32221bf-3766-450f-8410-748229a621fd} | 48 | 完整左眉发下延续和两端被实发遮住的补全细弧，保留于脸前、白侧发与刘海后；约 x559 以左的细尾和参考不可见余量。 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyebrows/eyebrow_right | D049.0 &#124; face/eyebrows/eyebrow_right &#124; under_hair | {856910fe-47bf-42f8-a68d-f74f70b1cd6f} | 49 | 右眉完整发下延续及参考被黑发遮住的极端余量，约 x479 以左、x522 以右的补全尾端，仍在黑侧发和刘海后。 | 保留本件原生独立绘画；来源见paint-records.json |
| face/nose | D050.0 &#124; face/nose | {aab8c80d-398a-45ce-aedc-976af0befae7} | 50 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/blush_left | D051.0 &#124; face/blush_left | {1f620ecb-977b-4b2e-9b58-baedb6970eb5} | 51 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/blush_right | D052.0 &#124; face/blush_right | {aa0acd6d-b31c-4317-a00f-cec348df4558} | 52 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/mouth_interior | D053.0 &#124; face/mouth/mouth_interior | {905b720d-3f33-49dc-b613-21464d968db2} | 53 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/lower_teeth | D054.0 &#124; face/mouth/lower_teeth | {25e6a366-46b0-4fb5-9cf1-4b1252d3edd6} | 54 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/tongue | D055.0 &#124; face/mouth/tongue | {61e61d10-ee32-4cf7-92fa-17440a9a1d9d} | 55 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/upper_teeth | D056.0 &#124; face/mouth/upper_teeth | {2e5dc718-2c60-4632-bd4d-e88005b2c5ad} | 56 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/upper_lip | D057.0 &#124; face/mouth/upper_lip | {e4879604-e0f1-495d-8266-a4bf9afcc88e} | 57 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/mouth/lower_lip | D058.0 &#124; face/mouth/lower_lip | {e8651430-d57d-4076-b308-8a825bd5cac1} | 58 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_inner | D059.0 &#124; head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_inner | {c823e52b-0f1d-4511-adb4-8ee2d7066a33} | 59 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_outer | D060.0 &#124; head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_outer | {f8313e75-669e-4097-87f6-58e9eb395548} | 60 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_inner | D061.0 &#124; head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_inner | {6fe1c271-2b7f-4ec7-9d57-6bd704a57b2a} | 61 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_outer | D062.0 &#124; head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_outer | {ff19d310-cc7d-410b-b4b9-31ad38e4e39c} | 62 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_left/bow_body | D063.0 &#124; head_accessories/hair_bows/hair_bow_left/bow_body | {85ec8913-cffb-413f-a79d-34c0736070b8} | 63 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_bows/hair_bow_right/bow_body | D064.0 &#124; head_accessories/hair_bows/hair_bow_right/bow_body | {6816993f-3e68-4555-8372-9fea1df67c6c} | 64 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/side_hair/side_hair_left | D065.0 &#124; hair/side_hair/side_hair_left | {5ff9fec7-57c1-4140-8880-2620c0f1d61a} | 65 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_left/upper_eyelid | D065.5 &#124; face/eyes/eye_left/upper_eyelid &#124; outer_corner | {da4b2000-d9bd-49fd-a542-759ab4d0c165} | 65.5 | 画面右眼外眦尖钩约 x603–619、y142–162，尤其 x610–617、y147–152 的细尖压在白侧发内缘之前。沿本件墨线内部与主体搭接，保留完整尖端和渐细收笔；同一逻辑上眼睑的普通绘画分片。 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/side_hair/side_hair_right | D066.0 &#124; hair/side_hair/side_hair_right | {f455cb05-e140-443f-aaa2-55f9be847b1e} | 66 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyes/eye_right/upper_eyelid | D066.5 &#124; face/eyes/eye_right/upper_eyelid &#124; outer_corner | {c4298322-c043-410d-b944-d0cbc9624540} | 66.5 | 画面左眼外眦尖钩约 x468–483、y145–164，特别 x469–477、y149–153 压在黑侧发自有内缘之前；沿本件墨线内部与主体连续接回，保持尖钩和浓淡收笔。 | 保留本件原生独立绘画；来源见paint-records.json |
| hair/bangs | D067.0 &#124; hair/bangs | {02e3bf05-8979-471b-ba16-65a3278f0964} | 67 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyebrows/eyebrow_left | D067.1 &#124; face/eyebrows/eyebrow_left &#124; reference_visible_arc | {9f5f79ba-a26e-43d3-8f75-a4b3cf3b103a} | 67.1 | 原图画面右侧参考可见的左眉长弧，约 x559–601、y111–128；跨白侧发及刘海的可见线段在发前，按同一眉毛的普通绘画分片与发下段连续衔接，不移动整眉或改变细弧。 | 保留本件原生独立绘画；来源见paint-records.json |
| face/eyebrows/eyebrow_right | D067.2 &#124; face/eyebrows/eyebrow_right &#124; reference_visible_arc | {b7d71c64-a823-4389-b951-546f730261dc} | 67.2 | 原图画面左侧参考可见的右眉长弧，约 x479–522、y112–128；跨黑侧发和刘海的可见线段在发前，与同眉发下段连续。保留本侧独立弯向，不等形复制另一眉。 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_clips/hair_clip_upper | D068.0 &#124; head_accessories/hair_clips/hair_clip_upper | {e18850a5-af43-4a81-9a0c-ea918d8ed66c} | 68 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| head_accessories/hair_clips/hair_clip_lower | D069.0 &#124; head_accessories/hair_clips/hair_clip_lower | {9fd7575e-3753-4c54-9ba2-238ff98ddd1d} | 69 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_left/shoes/ankle_strap/ankle_strap_front | D070.0 &#124; legs/leg_left/shoes/ankle_strap/ankle_strap_front | {ea86465c-5c11-4067-9d88-2c81286854d6} | 70 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_left/shoes/shoe_body | D071.0 &#124; legs/leg_left/shoes/shoe_body | {1f2ec0b4-f30d-4cb4-a240-c3a6a35c1b5e} | 71 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |
| legs/leg_right/shoes/shoe_body | D072.0 &#124; legs/leg_right/shoes/shoe_body | {9b22ae4f-7193-468d-abc4-b71337ede87f} | 72 | 完整逻辑部件 | 保留本件原生独立绘画；来源见paint-records.json |

## 本轮修整部件三视图索引

| 本轮修整part | 当前深度 | 原生三视图（绝对路径） |
| --- | --- | --- |
| hair/ponytail/ponytail_left/ponytail_front | 3 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_front__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_front__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_front__full.png |
| hair/ponytail/ponytail_left/ponytail_back | 1／5 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_back__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_back__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/hair__ponytail__ponytail_left__ponytail_back__full.png |
| body/torso | 31 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/body__torso__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/body__torso__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/body__torso__full.png |
| pelvis | 12 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/pelvis__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/pelvis__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/pelvis__full.png |
| face/face_base | 35 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__face_base__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__face_base__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__face_base__full.png |
| arms/arm_left/upper_arm | 28 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__upper_arm__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__upper_arm__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__upper_arm__full.png |
| arms/arm_right/upper_arm | 29 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__upper_arm__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__upper_arm__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__upper_arm__full.png |
| face/eyebrows/eyebrow_left | 48／67.1 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_left__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_left__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_left__full.png |
| face/eyebrows/eyebrow_right | 49／67.2 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_right__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_right__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyebrows__eyebrow_right__full.png |
| face/eyes/eye_left/upper_eyelid | 42／65.5 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyes__eye_left__upper_eyelid__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyes__eye_left__upper_eyelid__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/face__eyes__eye_left__upper_eyelid__full.png |
| arms/arm_left/hand/palm | 24 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__palm__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__palm__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__palm__full.png |
| arms/arm_left/hand/thumb | 22／24.5 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__thumb__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__thumb__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__thumb__full.png |
| arms/arm_right/hand/palm | 25 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__palm__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__palm__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__palm__full.png |
| arms/arm_right/hand/middle_finger | 19 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__middle_finger__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__middle_finger__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__middle_finger__full.png |
| arms/arm_right/hand/index_finger | 21 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__index_finger__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__index_finger__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_right__hand__index_finger__full.png |
| arms/arm_left/hand/index_finger | 20 | D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__index_finger__solo.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__index_finger__below.png<br>D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/arms__arm_left__hand__index_finger__full.png |

全量索引：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/final-all/index.json`；多深度实际分片：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/physical-fragments/physical-index.json`；16件重点四列证据：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/focus-final-changed/index.json`。结构与保护记录集中在 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-evidence/repair02/records`。前轮报告已存于 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/workspace/repair02/before/report.md`，本报告中的结构、UUID和绘画状态为当前有效输入。


## 脸底与双耳定向更新（2026-11-18）

按确认的新轮廓及补全重跑正式 step01，替换 face/face_base、face/ears/ear_left、face/ears/ear_right 三个原生绘画图层，并同步后续已保存 KRA 中的同一图层。保留原生 UUID、其他部件、表情层和既有阴影。复核及绘画报告：D:/Resources/workspace/AstraLayering/.run/face-ears-redraw-20261117/raster-layering/step01/。旧版备份：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/backups/face-ears-before-20261117/。
