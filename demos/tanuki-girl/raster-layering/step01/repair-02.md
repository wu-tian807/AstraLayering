结论：已修复

已处理`raster-layering/step01/review-02.md`的全部14项，并清理完整巡检发现的眼角、肘缘、食指根、中指下方和辫缘残笔。以下结论来自逐层独显、隐藏上层、蒙版切换、默认组装及同尺寸参考对照；本轮没有待修的确定问题。

## 输入、产物与检查约定

- 修复工程及默认PNG：`raster-layering/step01/character-depth.kra`、`raster-layering/step01/character-depth.png`。
- 当前总报告：`raster-layering/step01/report.md`，已更新本轮方法、81层映射、35原生蒙版及结构依据；仅本repair写入暂存文件，未自行写正式review/repair。
- 可见参考：`part-layering/references/standard.png`；R03–R05上臂参考：`part-layering/references/base-subject.png`。原图未移动或配准，1倍为原尺寸同坐标并排；放大只等比放大同一区域。
- 上游范围、归属及深度：`part-layering/parts`、`part-layering/groups.json`、`part-layering/occlusion.json`。本轮未改逻辑ID、SVG或深度，沿用有效上游。
- 局部比较图**左参考／中修前／右当前**；四状态依次为**独显默认／本层蒙版停用完整独显／隐藏上层默认／隐藏上层且本层蒙版停用**。每层原尺寸文件另列，避免组合图掩盖归属。默认整图证据在文末，包含各处实际组装状态。

每次局部操作后查看该处完整部件与组装；所有修改保留本件生成主体，特殊细处采用原生画笔或本件原图取样。没有取入邻件、遮挡物、外投影，也没有靠蒙版遮住本件残笔宣称修好。所有框为原画布`[x,y,width,height]`；隐藏部分以本件自身体积、材料和上游职责补全，不照抄原遮挡物。

## 逐项处理

### R01 — 左上睑悬空弧线与外眼角碎线：已修复

原问题框：`[734, 400, 75, 51]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| face/eyes/eye_left/upper_eyelid | D071.00 \| face/eyes/eye_left/upper_eyelid | {af09dcce-619b-4835-a143-7993801fb6f2} | D71 / 完整部件 | [独显默认](repair-02-evidence/final-audit/face__eyes__eye_left__upper_eyelid-D71-solo-default.png) / [独显完整](repair-02-evidence/final-audit/face__eyes__eye_left__upper_eyelid-D71-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/face__eyes__eye_left__upper_eyelid-D71-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/face__eyes__eye_left__upper_eyelid-D71-upper-hidden-complete.png) |

处理：在既有生成上睑上用Krita原生Clear清除悬空弧及外角游离短刺。最终眼角巡检又确认x795–802/y440–448有与主睫尖分离的棕束，已在本层实际清除；没有用蒙版遮住残笔。

检查结果：上睑只保留连续主睫缘与主睫尖；D073独立眼褶、虹膜和高光保留。整只左眼按同画布坐标1倍并排核对，睫缘直接压在眼白上，外角没有第二束悬线。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R01-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R01-states.png) · [eyes-left-1x](repair-02-evidence/final-audit/eyes-left-1x.png) · [eyes-left-3x](repair-02-evidence/final-audit/eyes-left-3x.png)。

### R02 — 左眼白中心补色硬边与浅环带：已修复

原问题框：`[729, 415, 64, 45]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| face/eyes/eye_left/sclera | D065.00 \| face/eyes/eye_left/sclera | {bae934de-9662-492d-a186-6ba8253b1c68} | D65 / 完整部件 | [独显默认](repair-02-evidence/final-audit/face__eyes__eye_left__sclera-D65-solo-default.png) / [独显完整](repair-02-evidence/final-audit/face__eyes__eye_left__sclera-D65-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/face__eyes__eye_left__sclera-D65-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/face__eyes__eye_left__sclera-D65-upper-hidden-complete.png) |

处理：在完整生成眼白上使用Krita原生Airbrush，取本侧眼白自身颜色分次融接内角及中央补全，不删除虹膜后的纹理，不整块替换RGB。

检查结果：近竖直硬界面消失，旧环带融为浅而连续的明暗变化。完整独显保留眼白连续形体和原开口；没有新增下睑线。默认虹膜覆盖与完整揭露分别检查通过。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R02-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R02-states.png) · [eyes-left-1x](repair-02-evidence/final-audit/eyes-left-1x.png) · [eyes-left-3x](repair-02-evidence/final-audit/eyes-left-3x.png)。

### R03 — 左上臂肘侧平行碎线：已修复

原问题框：`[903, 773, 55, 84]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_left/upper_arm | D025.00 \| arms/arm_left/upper_arm | {1af308eb-5bc9-413b-95d7-f542c2c8f4a4} | D25 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_left__upper_arm-D25-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_left__upper_arm-D25-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_left__upper_arm-D25-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_left__upper_arm-D25-upper-hidden-complete.png) |

处理：仅取base-subject.png中本件窄外缘到D025，并用原生Clear清除主轮廓外重复线及完整圆帽多余线；局部续接边线。

检查结果：肘侧外缘为同宽连续单线，无外侧短刺。完整肘圆帽、桃色自身体积暗部保留；默认前臂覆盖内没有新增横向闭合缝。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R03-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R03-states.png)。

### R04 — 右上臂肘侧重复描线：已修复

原问题框：`[520, 773, 55, 56]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_right/upper_arm | D026.00 \| arms/arm_right/upper_arm | {b79e9664-1b7b-4320-ba2b-1d6e893f245d} | D26 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-upper-hidden-complete.png) |

处理：先以本件原图窄外缘取样及原生Clear去重线。完整巡检发现y773–789顶段仍有残外线，进一步Clear、窄肤色笔融接，再用1.7px棕线沿实际外缘续完并局部调浓淡。

检查结果：原第二串平行线、顶部残线和小刺均清除，肘侧单轮廓连续。自身桃色暗部保留，没有把正常体积整体擦白；隐藏上层和默认接合均复核。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R04-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R04-states.png)。

### R05 — 右上臂隐藏肘圆帽描边未续完：已修复

原问题框：`[483, 808, 45, 37]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_right/upper_arm | D026.00 \| arms/arm_right/upper_arm | {b79e9664-1b7b-4320-ba2b-1d6e893f245d} | D26 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_right__upper_arm-D26-upper-hidden-complete.png) |

处理：沿D026既有alpha圆帽逐段画细棕轮廓，使用本件参考颜色和原生画笔接顺两侧可见描边及自身明暗。

检查结果：完整圆弧收口已有连续细线，保留伸入前臂的搭接范围。默认新闭合线被前臂覆盖，肘接合没有额外横缝。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R05-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R05-states.png)。

### R06 — 左掌指根平行线、三角刺与取样起点小阶：已修复

原问题框：`[1054, 1014, 36, 48]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_left/hand/palm | D046.00 \| arms/arm_left/hand/palm | {c8d1ab7e-a975-46b8-882d-ea33f31cfab0} | D46 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_left__hand__palm-D46-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_left__hand__palm-D46-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_left__hand__palm-D46-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_left__hand__palm-D46-upper-hidden-complete.png) |
| arms/arm_left/hand/index_finger | D044.00 \| arms/arm_left/hand/index_finger | {75b7501a-404e-4d69-820c-b19995e3d197} | D44 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_left__hand__index_finger-D44-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_left__hand__index_finger-D44-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_left__hand__index_finger-D44-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_left__hand__index_finger-D44-upper-hidden-complete.png) |

处理：D046原生清掉重复上缘及三角刺，局部只取standard.png本件掌缘；同时修顺D044本件取样起点的小尖阶，以窄肤色笔和细棕线接入完整圆根。

检查结果：掌缘到食指的切线、线宽和接色连续。两层各自完整圆根保留，真实指缝和掌部覆盖范围保留，没有在接触内新增横线。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R06-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R06-states.png) · [hand-left-1x](repair-02-evidence/final-audit/hand-left-1x.png) · [hand-left-3x](repair-02-evidence/final-audit/hand-left-3x.png)。

### R07 — 右掌外缘碎段与接拇指分叉：已修复

原问题框：`[335, 997, 79, 75]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_right/hand/palm | D047.00 \| arms/arm_right/hand/palm | {7956daa1-c37d-405c-a2f5-a3301d9a40bd} | D47 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_right__hand__palm-D47-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_right__hand__palm-D47-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_right__hand__palm-D47-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_right__hand__palm-D47-upper-hidden-complete.png) |
| arms/arm_right/hand/thumb | D043.00 \| arms/arm_right/hand/thumb | {2a0cd4f0-b5a0-402b-bdc4-2e2cc83bb4b4} | D43 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_right__hand__thumb-D43-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_right__hand__thumb-D43-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_right__hand__thumb-D43-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_right__hand__thumb-D43-upper-hidden-complete.png) |
| arms/arm_right/hand/index_finger | D045.00 \| arms/arm_right/hand/index_finger | {ebcc56c8-fa53-4b44-87ca-dc93520ae00a} | D45 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_right__hand__index_finger-D45-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_right__hand__index_finger-D45-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_right__hand__index_finger-D45-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_right__hand__index_finger-D45-upper-hidden-complete.png) |

处理：在D047清分叉、错开的细线端及上侧碎段，沿实际掌缘续成单一细轮廓，并局部取本件掌缘接色。曾发生的裁边试修已恢复后再修，不以缩小掌形掩盖问题。D043/D045为关联接合检查层。

检查结果：完整掌外缘不再分叉、针刺或线宽突然跳变；默认与拇指和食指接顺。完整指根、自身暗部和真实虎口保留，没有新增横线。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R07-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R07-states.png) · [hand-right-1x](repair-02-evidence/final-audit/hand-right-1x.png) · [hand-right-3x](repair-02-evidence/final-audit/hand-right-3x.png)。

### R08 — 左中指下方孤立短划：已修复

原问题框：`[1127, 1067, 18, 11]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| arms/arm_left/hand/middle_finger | D040.00 \| arms/arm_left/hand/middle_finger | {9a262683-d178-410e-a027-de2eb8327641} | D40 / 完整部件 | [独显默认](repair-02-evidence/final-audit/arms__arm_left__hand__middle_finger-D40-solo-default.png) / [独显完整](repair-02-evidence/final-audit/arms__arm_left__hand__middle_finger-D40-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/arms__arm_left__hand__middle_finger-D40-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/arms__arm_left__hand__middle_finger-D40-upper-hidden-complete.png) |

处理：仅在D040原生Clear清除孤立短划。最终8倍完整独显又发现x1125–1127/y1073的3像素浅残笔，已对x1118–1148/y1072–1077局部Clear并复查。

检查结果：悬空短划及浅残笔均消失，指腹下缘、指尖圆度和自身明暗连续；完整独显及默认整手无游离笔迹。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R08-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R08-states.png) · [hand-left-1x](repair-02-evidence/final-audit/hand-left-1x.png) · [hand-left-3x](repair-02-evidence/final-audit/hand-left-3x.png)。

### R09 — 左耳毛隐藏根部尖薄及轮廓未完成：已修复

原问题框：`[793, 280, 40, 32]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| face/ears/ear_left/ear_fur | D018.00 \| face/ears/ear_left/ear_fur | {6412279f-d25f-41c7-9392-cb48663e8821} | D18 / 完整部件 | [独显默认](repair-02-evidence/final-audit/face__ears__ear_left__ear_fur-D18-solo-default.png) / [独显完整](repair-02-evidence/final-audit/face__ears__ear_left__ear_fur-D18-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/face__ears__ear_left__ear_fur-D18-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/face__ears__ear_left__ear_fur-D18-upper-hidden-complete.png) |

处理：重新制作本侧三色控制与中性灰输入，8倍局部生成后缩小配准，仅把y277以下隐藏根替换到既有耳毛；可见毛簇主体整体保留。未镜像另一耳或取入耳壳、头发。

检查结果：隐藏根改为圆顺、有厚度的连续软毛簇，乳色/浅粉毛色及棕轮廓接到可见毛梢。完整独显轮廓续完，耳壳共享开口蒙版保留，默认可见尖簇不变。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R09-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R09-states.png)。

### R10 — 右辫根默认尖束显露与重复外缘：已修复

原问题框：`[564, 482, 70, 112]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| hair/braid_right | D013.00 \| hair/braid_right \| root | {23aa9bc6-b545-4a55-82e2-43e14821b638} | D13 / 完整辫根后片延续到y586，在短后发、脸与颈后；与前片沿原图前景发束轮廓搭接，保留隐藏根部。 | [独显默认](repair-02-evidence/final-audit/hair__braid_right-D13-solo-default.png) / [独显完整](repair-02-evidence/final-audit/hair__braid_right-D13-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/hair__braid_right-D13-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/hair__braid_right-D13-upper-hidden-complete.png) |
| hair/braid_right | D057.00 \| hair/braid_right \| front | {9cbf362a-bc38-461f-8385-446c0b842245} | D57 / 前辫上界沿原图前景发束曲线，隐藏补全根部仍在D13；y580–586接到完整前辫，胸肩前、右耳罩后，无水平截边。 | [独显默认](repair-02-evidence/final-audit/hair__braid_right-D57-solo-default.png) / [独显完整](repair-02-evidence/final-audit/hair__braid_right-D57-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/hair__braid_right-D57-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/hair__braid_right-D57-upper-hidden-complete.png) |

处理：D057新增本件原生透明度蒙版，仅校正前辫根在短后发后的默认显露。D013/D057实际清掉重复外线并按本件发缘取样续接；最终又修清D013 y535–553的小尖端。

检查结果：额外向上尖束不再侵占短后发开口，默认根转接更低且平顺，外缘为连续单线。停用蒙版时两片完整根部仍在，联合完整与搭接连续；D13/D57共同hair/braid_right身份和深度保留。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R10-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R10-states.png)。

### R11 — 狸饰前下颌轮廓分段过平：已修复

原问题框：`[668, 216, 78, 16]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| head_accessories/tanuki_ornament/tanuki_body | D012.00 \| head_accessories/tanuki_ornament/tanuki_body | {9aee0d16-dbe7-4cf6-9b3f-0d333c289ae5} | D12 / 狸饰主体后部与完整下颌底形，在后发和前发后；下颌可见前缘另由同件D85.5分片承接。 | [独显默认](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D12-solo-default.png) / [独显完整](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D12-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D12-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D12-upper-hidden-complete.png) |
| head_accessories/tanuki_ornament/tanuki_body | D085.50 \| head_accessories/tanuki_ornament/tanuki_body \| foreground jaw | {81b543f2-3b44-45b5-bffc-95a0a600e5d5} | D85.5 / 同一狸饰的完整下颌前缘与隐藏接合片，在完整前发之后、双爪之前；原生接合蒙版只露出原图下颌范围，补全发根保留在后。 | [独显默认](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D85.5-solo-default.png) / [独显完整](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D85.5-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D85.5-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/head_accessories__tanuki_ornament__tanuki_body-D85.5-upper-hidden-complete.png) |

处理：只取standard.png中本件下颌缓弧至自身深棕描线止的小段到D085.5，再扩顺该层原生蒙版显露边。没有取入下方粉色头发投影带。

检查结果：双爪之间下颌为连续缓弯的本件深棕轮廓，两端接顺。D12完整后主体与下颌底形、D85.5完整搭接片及发根均保留；沿用repair-01的已有两深度分工。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R11-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R11-states.png)。

### R12 — 后粉踝环隐藏回转端急窄成尖片：已修复

原问题框：`[571, 1768, 21, 31]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| legs/leg_right/anklet_back | D011.00 \| legs/leg_right/anklet_back | {983e52d0-a0a3-42ed-8e7e-e40049314823} | D11 / 完整部件 | [独显默认](repair-02-evidence/final-audit/legs__leg_right__anklet_back-D11-solo-default.png) / [独显完整](repair-02-evidence/final-audit/legs__leg_right__anklet_back-D11-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/legs__leg_right__anklet_back-D11-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/legs__leg_right__anklet_back-D11-upper-hidden-complete.png) |

处理：先尝试复用已成功的三色生成C形粉管并局部配准；默认桥段丢失后恢复原生成接合主体，改在本件既有绘画上用原生笔逐段画连续管厚、粉色明暗、内外缘及圆顺斜回端，再清内缘短叉。不是整体采用该次C形配准。

检查结果：完整粉管回转没有急窄颈口和扁尖片，厚度、内外缘及圆端自然延续。默认前后环接合和腿侧位置保留，同层米弧的保护区像素检查一致；未取入腿、铃、前环或投影。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R12-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R12-states.png)。

### R13 — 左红晕线心过宽过浓：已修复

原问题框：`[746, 456, 51, 40]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| face/blush_left | D076.00 \| face/blush_left | {ca37add8-d856-488a-b759-0b232721ea78} | D76 / 完整部件 | [独显默认](repair-02-evidence/final-audit/face__blush_left-D76-solo-default.png) / [独显完整](repair-02-evidence/final-audit/face__blush_left-D76-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/face__blush_left-D76-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/face__blush_left-D76-upper-hidden-complete.png) |

处理：保留生成弥散红底，局部清旧宽浓条带；以Krita Basic-2画笔1.5px、0.5浓度按本侧参考逐条画6条不同长短细线并修淡尾，不用整体模糊替代细线。

检查结果：原厚桃色黏连条带消除，细线间隔与不同长短恢复，红底仍在且接色自然。1倍与3倍本侧并排均检查；细线略有浓淡/清晰度差异，不影响已修的宽浓黏连问题。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R13-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R13-states.png) · [blush-left-1x](repair-02-evidence/final-audit/blush-left-1x.png) · [blush-left-3x](repair-02-evidence/final-audit/blush-left-3x.png)。

### R14 — 右红晕宽条带与底色黏连：已修复

原问题框：`[619, 459, 52, 42]`。最终检查区域及参考见[区域记录](repair-02-evidence/final-audit/final-region-specs.json)。

| 原part ID | 实际层名 | UUID | 最终深度／区域 | 单层与隐藏上层证据 |
|---|---|---|---|---|
| face/blush_right | D077.00 \| face/blush_right | {46a2ebd3-7d04-4147-9e1f-b7e1a632c2a3} | D77 / 完整部件 | [独显默认](repair-02-evidence/final-audit/face__blush_right-D77-solo-default.png) / [独显完整](repair-02-evidence/final-audit/face__blush_right-D77-solo-complete.png) / [隐藏上层默认](repair-02-evidence/final-audit/face__blush_right-D77-upper-hidden-default.png) / [隐藏上层完整](repair-02-evidence/final-audit/face__blush_right-D77-upper-hidden-complete.png) |

处理：保留本侧生成红底，以同类原生窄笔按右侧自身参考重画6条独立位置/长短的细线及淡尾；没有镜像左侧。

检查结果：宽软条带和上半部黏连已消除，线间自然间隔恢复，右侧独立排列及弥散红底保留。完整独显及原尺寸逐侧并排检查通过。

证据：[参考／修前／当前](repair-02-evidence/final-audit/R14-comparison.png) · [局部四状态](repair-02-evidence/final-audit/R14-states.png) · [blush-right-1x](repair-02-evidence/final-audit/blush-right-1x.png) · [blush-right-3x](repair-02-evidence/final-audit/blush-right-3x.png)。

## 生成、取样与原生修画记录

R09重新生成采用`repair02/R09-root-neutral-source.png`和`repair02/R09-root-three-color-control.png`，生成规格为`raster-layering/step01/workspace/repair02/R09-generation-spec.json`。成功结果：`generated/generated_images/01a1af41-b650-7940-963e-902ed98b7e4e/call_XZVfb9mNUifGbQp9QhWmjHwB.png`。配准结果为`repair02/R09-generated-registered.png`，仅按`repair02/R09-local-completion-selection.png`替换根部；没有裁掉可见毛簇外圈。

R12尝试的来源为`repair01/ankle-final/generated-pink-return-registered.png`，原锚点561,1746、56×49。本轮C形配准未用于最终默认接合，已恢复并在原生成主体上局部原生笔修。米弧保护依据和结果见`raster-layering/step01/workspace/repair02/cream-protection.json`：保护区域y≥1787及y1783–1786米色像素检查一致，未进行邻件像素恢复。

全部14批原生请求、所属part/UUID、取样来源及修前本件字节备份见`raster-layering/step01/workspace/repair02/journal.json`。最后巡检追加批次`R06-root-continuity`、`final-residue-clean`、`R04-last-edge-continuity`、`R04-last-edge-reblend`、`R04-last-edge-tone`、`R01-last-corner-branch`已纳入对应项目，最后一次更新后重新导出全部最终证据并保存重开。

## 层序与拆分依据

- **上游预标**：右辫D13/D57保持共同`hair/braid_right`归属。repair-01 R14将旧y502水平界修为沿发流的曲线，后根延至y586，y580–586搭接。本轮repair-02 R10仅新增D57本件接合蒙版和局部轮廓修画，不新增深度；前辫仍在胸肩前、右耳罩后，完整根部保留在两片绘画中。
- **首轮组装发现**：骨盆D22.5/D33继续沿用。髋肤后片在双腿后，白服前片、腿口线和完整上接帽盖在双腿前、torso后，共同归属`pelvis`；本件材料分界藏在腿口线内，蒙版只控制默认搭接。
- **repair-01 R13组装发现**：狸饰D12/D85.5继续沿用，共同归属`head_accessories/tanuki_ornament/tanuki_body`。D12为完整后主体及下颌底形，D85.5为完整前下颌和隐藏搭接，位于发铃D85后、双爪D86/D87前。本轮repair-02 R11只修本件弧线及现有蒙版显露边，不再次拆层。

本轮逻辑part ID、SVG、groups和occlusion深度均未改变，实际81层深度与上游一一对应；不需要重复调用edit_groups/edit_occlusion。绘画层树没有另造运动节点。新增D57原生蒙版及D85.5显露边修正的依据、实际UUID和控制区域见下表，作为后续有效工程的控制记录。

## 与上游色块形状的差异

- 左耳毛D18隐藏根由旧尖薄补形修成有厚度的圆顺毛根，仅替换y277以下局部；可见毛簇保留，耳壳开口仍按原生控制，不借入邻件。
- 后踝环D11隐藏粉管端由急窄尖片修成连续厚度的圆管回转与圆顺斜端，保护同层米弧。沿用既有腿侧约7像素局部生成形差和约1像素隐藏搭接，按真实环位接顺；没有移动腿或参考。
- D44左食指隐藏根外缘的取样起点小尖阶作细微圆顺修接，完整根和可见长指形保留。repair-01已有D45右食指隐藏根由直阶改圆顺、略宽的延续继续沿用。
- D57默认显露边按原图前景辫根校正，完整根纹理没有删除。右辫曲线分界及6像素搭接、骨盆两材料分片、狸饰前下颌分片属于既有记录，不是本轮新增逻辑拆分。
- 耳内面与耳缘沿用约2像素隐藏搭接；左腿既有完整大腿过渡和内侧腿根补全保留，膝足、袜口不移动。颈侧既有约3像素生成轮廓差异继续记录，描边沿本件形体且排除下颌、耳罩投影。
- 眼白中心以连续浅明暗补全，隐藏中心没有直接可见像素参考；两侧红晕细线仍有轻微浓淡或清晰度差异，保留弥散红底和各侧独立排列。当前不追求逐像素还原，已消除review-02指出的硬补色边及宽浓黏连线带。

以上调整没有改变部件归属、比例、整件位置或共同运动关系。其他部件投影没有画回皮肤、头发、狸饰或环带。透明度蒙版只负责开口/遮挡关系，不用于隐藏本件尚未修好的笔迹。

## 原生显隐与完整内容检查

最终78个逻辑part对应81个普通绘画层、35个原生透明度蒙版。新增蒙版唯一是R10前辫D57接合蒙版：

- 父层：`D057.00 | hair/braid_right | front`，UUID `{9cbf362a-bc38-461f-8385-446c0b842245}`。
- 蒙版：`Native depth contact | braid front under short back hair`，UUID `{5bae3814-9e0d-4186-8868-3f604bd8ea12}`，默认启用，控制part为`hair/back_hair`、`hair/braid_right`。
- 区域：前辫根仅显露本侧原图前景发束，完整根部保留，额外抬起尖束在短后发后。开口文件：`repair02/R10-front-opening.png`。
- 检查：[D57默认](repair-02-evidence/final-audit/hair__braid_right-D57-solo-default.png) / [D57完整](repair-02-evidence/final-audit/hair__braid_right-D57-solo-complete.png)，并联合D13查看根部连续。纹理实际保留，不新增独立运动节点。

D85.5既有下颌蒙版UUID `{83b15e97-1f1e-43f0-bf9c-db321934abbd}`已续顺显露边，仍挂在同一狸饰前下颌层。其余蒙版职责保留；全部父层名/UUID、蒙版名/UUID、控制part和默认/完整证据已列于更新的report.md。

两眼各自眼白、虹膜和高光共享本侧开口，内缘由上睑及眼白下沿定义，分别执行关闭眼内开口测试后恢复默认睁眼。口腔、舌和上下牙列共用上下唇开口，默认空选区闭嘴；停用蒙版时完整口内材质仍存在，再恢复默认闭合。后大腿带、小指、后发圈及后环的默认遮挡职责保留，完整内容逐层切换查看。证据：[控制检查JSON](repair-02-evidence/final-audit/native-control-check.json) / [眼内关闭近图](repair-02-evidence/final-audit/eyes-native-closed-closeup.png) / [完整口内材质](repair-02-evidence/final-audit/mouth-complete-own-material.png)。所有默认显隐已恢复，PNG使用蒙版启用状态。

## 看图检查与默认状态

每次局部操作后均看独显、停用本层蒙版的完整独显、隐藏上层及默认组装；单层原尺寸四状态与UUID见[81层索引](repair-02-evidence/final-audit/audit-index.md)和[JSON索引](repair-02-evidence/final-audit/index.json)。四列依次为solo-default、solo-complete、upper-hidden-default、upper-hidden-complete；局部比较图为左参考／中修前／右当前。隐藏区依据本件连续形体和色层，不照抄遮挡物。

最终11页81层图集均实际查看，最后眼角清理后刷新了受影响层、全部图集及14项局部对照，并再次查看受影响第8页；[刷新记录](repair-02-evidence/final-audit/atlas-refresh.json)与当前KRA哈希相同。多深度辫、骨盆、狸饰逐片再联合检查。双眼、双手、双侧红晕另作同坐标1倍及3倍检查，接合处局部放大；[可见参考整图](repair-02-evidence/final-audit/whole-standard-gray.png)、[身体参考整图](repair-02-evidence/final-audit/whole-base-gray.png)也已查看。没有移动或缩放参考来掩盖偏差，未使用PSNR等数值判断绘画质量。

35个蒙版均实际为Krita原生透明度蒙版，父绘画层保留完整纹理。两眼各自眼白/虹膜/高光共用本侧上睑内缘与眼白下缘围成的开口，默认睁眼；左右眼分别检查，初始复用历史保留，但本轮没有镜像替代原图的不对称细节。口内四件共用上下唇定义的默认空开口，默认闭嘴；后大腿带、小指和后发圈保持原闭合隐藏职责。测试关闭眼内开口、停用口内蒙版查看完整内容后，全部恢复默认状态。证据：[原生控制检查](repair-02-evidence/final-audit/native-control-check.json) · [眼内关闭近图](repair-02-evidence/final-audit/eyes-native-closed-closeup.png) · [口内完整材质](repair-02-evidence/final-audit/mouth-complete-own-material.png)。默认PNG在所有蒙版恢复启用后导出。

## 保存与实际重开

最终修画后保存正式KRA及蒙版启用的默认PNG，然后实际关闭工程并重新打开。81绘画层、35原生蒙版的顺序、名称、UUID、类型、默认显隐、透明度、混合模式、alpha lock等属性一致；全画布原始绘画字节、蒙版选区字节与默认PNG像素均一致，重开未改写KRA。报告整理没有再次改变工程像素。

- KRA SHA256：`0bbc778f0a5a1e0e17e434ec03e5906bb8bf7f13fa3b876234a3b5cd71cc733d`
- 默认PNG像素SHA256（QImage ARGB32／本机BGRA字节序）：`de97d68d51d058b30d9b63f259b5b21296dd0e4e589f05f7d5a9fb7a7612bf35`

证据：[重开核对](repair-02-evidence/final-audit/reopen-check.json) · [保存前快照](repair-02-evidence/final-audit/before-reopen-snapshot.json) · [重开后快照](repair-02-evidence/final-audit/after-reopen-snapshot.json) · [重开默认PNG](repair-02-evidence/final-audit/after-reopen.png)。哈希仅证明保存状态，不代替绘画验收。

历史Node.clone崩溃路径已停用并从保存点恢复；本轮沿用原生节点编辑，没有克隆重建树。曾被拦截的局部图片不重复原读取方式。本轮眼角改用缩小灰度版本成功读取，随后完成最后棕束清理并检查最终四状态；不存在缺少关键图像导致的持续阻塞。

## 交付核对

14项最终四状态和局部对照、81层四状态索引、11页完整图集、双眼/双手/双红晕1倍与放大、整图对照及实际重开记录均齐全。[最终看图记录](repair-02-evidence/final-audit/visual-check.json)关联最终KRA哈希，用于定位证据版本，不作为绘画质量数值评分。本次更新正式KRA、PNG、report.md及本暂存repair-02.md.tmp，未自行发布正式repair/review，未改运行标记或会话配置。
