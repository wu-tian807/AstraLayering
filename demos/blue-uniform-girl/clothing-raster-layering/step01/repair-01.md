结论：已修复

# clothing-raster-layering step01 / repair-01

已核实并修复 review-01 的 R1–R9，且修好本轮额外发现的右肩尖头、肩端半透明残边和方扣下缘残点。逐处单层、隐藏上层、同逻辑片合看及整图检查通过；最终工程保存并重开核对通过。

工程：`clothing-raster-layering/step01/clothing-depth.kra`。制作报告已更新：`clothing-raster-layering/step01/report.md`。本报告只写 `clothing-raster-layering/step01/repair-01.md.tmp`，不自行发布正式 repair / review。

参考：`clothing-part-layering/references/clothing.png`；穿着参考：`part-layering/references/simplified-subject.png`。定位沿用 1115×1410 原画布；图层 left/right 按角色自身方向。

## 逐项处理结果

### R1 — 画面左袖口斑块与密集尖折

**处理：** 采用三色控制图局部重新生成 d33 下半白布，保留原生成主体；本袖带参考取样恢复连续青色渐变，修顺与白布的过渡。d7 远侧内壁、窄透明口和两端回转保留。

**复验结论：** 袖带无原来的不规则斑块，白布改回较舒缓折面；两深度合看袖口收拢，开口透明，无人体像素。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R1/three-views.png)；[默认合成原图](repair-01-evidence/R1/composite.png)。

- d33：`outer_jacket/right_sleeve | near | d33`；UUID `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}`；[独显](repair-01-evidence/R1/d33-solo.png)、[隐藏上层](repair-01-evidence/R1/d33-uncover.png)。
- d7：`outer_jacket/right_sleeve | far | d7`；UUID `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}`；[独显](repair-01-evidence/R1/d7-solo.png)、[隐藏上层](repair-01-evidence/R1/d7-uncover.png)。

### R2 — 画面左袖窿双黑边

**处理：** 沿本片归属限制的参考取样分别修 d33/d35，补顺各自接边布面，原外边收进搭接；上段恢复单条浅蓝缝，下段自然转为深线。

**复验结论：** 两片独显完整；合成不再同时露出平行黑边，肩端到腋下无线宽突变或新缺口。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R2/three-views.png)；[默认合成原图](repair-01-evidence/R2/composite.png)。

- d33：`outer_jacket/right_sleeve | near | d33`；UUID `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}`；[独显](repair-01-evidence/R2/d33-solo.png)、[隐藏上层](repair-01-evidence/R2/d33-uncover.png)。
- d35：`outer_jacket/jacket_body/right_front/front_panel | complete | d35`；UUID `{877dbbf4-dc9b-42be-93ff-607fd26659bc}`；[独显](repair-01-evidence/R2/d35-solo.png)、[隐藏上层](repair-01-evidence/R2/d35-uncover.png)。

### R3 — 画面右袖窿过粗过黑

**处理：** 协同修 d32/d34 的接边及本片参考线条，保留袖口前后料。额外清掉 d34 肩端取样越出原 alpha 的半透明轮廓；最终复核又修掉 d32 约 (784,352) 的高出尖头，用原生曲线选区沿已有外线收顺。

**复验结论：** 上段蓝缝、下段深线连续；各片归属干净；肩部外轮廓平顺，无尖头、突出残边或重叠粗线。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R3/three-views.png)；[默认合成原图](repair-01-evidence/R3/composite.png)。

- d32：`outer_jacket/left_sleeve | near | d32`；UUID `{975f8a53-72cd-4d9f-a48e-a47f9c946e5e}`；[独显](repair-01-evidence/R3/d32-solo.png)、[隐藏上层](repair-01-evidence/R3/d32-uncover.png)。
- d34：`outer_jacket/jacket_body/left_front/front_panel | complete | d34`；UUID `{fffcff2e-2fe2-4773-81c6-f4f5eedf83de}`；[独显](repair-01-evidence/R3/d34-solo.png)、[隐藏上层](repair-01-evidence/R3/d34-uncover.png)。

### R4 — 胸标上移缩小并被驳头遮住

**处理：** 在 d34 清除旧标识鬼影，按本片参考取样恢复三角标、圆点、黄绿青渐变与完整内外轮廓；d36 驳头位置和深度未改。

**复验结论：** 三角标恢复参考位置及比例，完整露出，与驳头之间有白布留白；独显没有重复旧标。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R4/three-views.png)；[默认合成原图](repair-01-evidence/R4/composite.png)。

- d34：`outer_jacket/jacket_body/left_front/front_panel | complete | d34`；UUID `{fffcff2e-2fe2-4773-81c6-f4f5eedf83de}`；[独显](repair-01-evidence/R4/d34-solo.png)、[隐藏上层](repair-01-evidence/R4/d34-uncover.png)。
- d36：`outer_jacket/jacket_body/left_front/lapel | complete | d36`；UUID `{d0d277c3-7639-458a-bebe-d8a0d2f667ae}`；[独显](repair-01-evidence/R4/d36-solo.png)、[隐藏上层](repair-01-evidence/R4/d36-uncover.png)。

### R5 — 衬衫漏扣、门襟与布面偏离

**处理：** 按三色控制重新生成完整下半本衬衫布面，用相似变换配准后接回原上衣料。参考取样恢复约 (643,588)、(644,623)、(648,666) 三扣；Krita 原生画笔逐笔将两条弯曲门襟延至隐藏下摆。清理生成与旧线叠边，仅用本衬衫布面材料融色。

**复验结论：** 默认可见段三扣齐全，位置和间距恢复；门襟弯曲、不断线，独显下半连续。废弃的梯形/矩形试样及其色块边、重复纹样、漂移圆点均不在最终层内。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R5/three-views.png)；[默认合成原图](repair-01-evidence/R5/composite.png)。

- d22：`inner_shirt/shirt_body | near | d22`；UUID `{dc5f75b1-3c42-4be7-85cf-d19049187fb1}`；[独显](repair-01-evidence/R5/d22-solo.png)、[隐藏上层](repair-01-evidence/R5/d22-uncover.png)。
- d2：`inner_shirt/shirt_body | far | d2`；UUID `{64476358-6b22-4371-8a2d-680990fe8c4a}`；[独显](repair-01-evidence/R5/d2-solo.png)、[隐藏上层](repair-01-evidence/R5/d2-uncover.png)。

### R6 — 前领座游离深色点

**处理：** 用原生选区删除 d23 约 (649,294) 的分离残点，并以本领座笔触修顺附着尖端；d10 后领座保持完整。

**复验结论：** d23 原尺寸与放大独显无游离点；同片合看回转连续，颈口仍透明。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R6/three-views.png)；[默认合成原图](repair-01-evidence/R6/composite.png)。

- d23：`inner_shirt/shirt_collar/collar_base | near | d23`；UUID `{c4121cb2-56f5-4874-817b-0ea842a813da}`；[独显](repair-01-evidence/R6/d23-solo.png)、[隐藏上层](repair-01-evidence/R6/d23-uncover.png)。
- d10：`inner_shirt/shirt_collar/collar_base | far | d10`；UUID `{3e8eed0d-000f-48d0-9f64-932f9083755f}`；[独显](repair-01-evidence/R6/d10-solo.png)、[隐藏上层](repair-01-evidence/R6/d10-uncover.png)。

### R7 — 白翻领前后接头台阶

**处理：** 按同一回转曲线修 d5/d39 顶端，去掉高出方头；本片参考取样沿内缘融接，并清掉取样区硬边。后根窄衣料和搭接均保留。

**复验结论：** 独显各片完整；合看及默认合成上缘平顺，内缘接色、线宽连续，没有封颈口。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R7/three-views.png)；[默认合成原图](repair-01-evidence/R7/composite.png)。

- d5：`outer_jacket/jacket_collar/right_collar_flap | far | d5`；UUID `{46380345-5435-4995-bea2-a1c17edf3ba2}`；[独显](repair-01-evidence/R7/d5-solo.png)、[隐藏上层](repair-01-evidence/R7/d5-uncover.png)。
- d39：`outer_jacket/jacket_collar/right_collar_flap | near | d39`；UUID `{245d9658-a1b2-47aa-84e7-6748f56035ba}`；[独显](repair-01-evidence/R7/d39-solo.png)、[隐藏上层](repair-01-evidence/R7/d39-uncover.png)。

### R8 — 中央方扣放大、圆角改变

**处理：** 按参考重做 d40 的较小圆角方扣、边框和金属明暗；d30/d31 带翼未动。额外清理下边缘残点，以扣件自身邻近笔触取样接顺。

**复验结论：** 扣件大小及收束比例恢复，四角圆润；独显无下缘黑点，两翼各自独立且在扣下自然搭接。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R8/three-views.png)；[默认合成原图](repair-01-evidence/R8/composite.png)。

- d40：`jacket_front_clasp/center_buckle | complete | d40`；UUID `{4a8d5063-93b1-445d-8da8-877722e35ae0}`；[独显](repair-01-evidence/R8/d40-solo.png)、[隐藏上层](repair-01-evidence/R8/d40-uncover.png)。
- d30：`jacket_front_clasp/left_clasp_wing | complete | d30`；UUID `{133a0d6a-be41-4624-8034-39bdb9156a95}`；[独显](repair-01-evidence/R8/d30-solo.png)、[隐藏上层](repair-01-evidence/R8/d30-uncover.png)。
- d31：`jacket_front_clasp/right_clasp_wing | complete | d31`；UUID `{b10fddaf-f4a0-46f8-9bd8-710375924ec0}`；[独显](repair-01-evidence/R8/d31-solo.png)、[隐藏上层](repair-01-evidence/R8/d31-uncover.png)。

### R9 — 前裙下缘青蓝残边与毛刺

**处理：** 在 d24 原 alpha 内用本片深色包边笔触接顺，再以弯曲原生选区清掉附带蓝边和下凸刺；d11 完整蓝色后裙不改。

**复验结论：** d24 独显下缘干净，深包边连续；同片及默认合成蓝后缘仍由 d11 承担，无新缝隙。 已实际检查各相关层独显、隐藏所有更高层、同片合看和默认整图。

[三视图与合看](repair-01-evidence/R9/three-views.png)；[默认合成原图](repair-01-evidence/R9/composite.png)。

- d24：`pleated_skirt/skirt_body | near | d24`；UUID `{18ec5e0c-cd44-45ce-978a-6634cfc49573}`；[独显](repair-01-evidence/R9/d24-solo.png)、[隐藏上层](repair-01-evidence/R9/d24-uncover.png)。
- d11：`pleated_skirt/skirt_body | far | d11`；UUID `{e90f4e77-c691-49b3-9de0-783cb7723a76}`；[独显](repair-01-evidence/R9/d11-solo.png)、[隐藏上层](repair-01-evidence/R9/d11-uncover.png)。

## 生成与局部修画依据

R1、R5 重画均先提交红／黄／绿控制：红保留本片可见依据，黄补全本片，绿输出透明；黄处遮挡物及绿区参考输入抹成中性灰。其余为生成主体上确定的小范围形状、纹样与接缝问题，用 Krita 原生画笔、清理及限定归属的本片参考取样修正。

| 项目 | 最终采用源及输入证据 |
| --- | --- |
| R1 / d33 | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_XlpxzgLT4NeJ7OpE3TKoyCeZ.png`；[控制](repair-01-evidence/final-sources/R1-control.png)、[输入](repair-01-evidence/final-sources/R1-reference.png)、[生成](repair-01-evidence/final-sources/R1-generated.png)、[配准](repair-01-evidence/final-sources/R1-registered.png)。 |
| R5 / d22 | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_84KoETDPYt2RzFjE2dKSRZJC.png`；[控制](repair-01-evidence/final-sources/R5-control.png)、[输入](repair-01-evidence/final-sources/R5-reference.png)、[生成](repair-01-evidence/final-sources/R5-generated.png)、[相似配准](repair-01-evidence/final-sources/R5-registration.json)。 |

R5 使用完整下半衣料生成接回上半，最终配准为均匀比例 0.2671011279433142。原生画笔沿两条三次曲线逐笔延至 y722，Basic-2 Opacity，4.3px，#101c37，opacity 0.98。三个可见纽扣仅取样衬衫自身，门襟旁融色仅复用本衬衫生成布面。先前试作出现的梯形、矩形拼贴边、重复扣与漂移点均恢复后重做，未留在最终层。原生取样全过程日志包含弃用尝试，不能当作最终来源清单；最终来源以本节及 [来源记录](repair-01-evidence/provenance-and-mask-checks.json) 为准。

## 当前分层、控制与检查覆盖

保留 23 个逻辑 part、32 个普通绘画分片、5 个原生显隐组、7 个透明度蒙版。逻辑归属、深度及前后分片未变，未合并已拆开的衣片。仅局部像素及原生合并后的绘画 UUID 更新。当前 KRA 与上游 groups / occlusion 深度一一相符，上游文件与 review 时一致，[结构核对](repair-01-evidence/structure-verification.json)。无需修改 SVG 或再次提交结构工具。

| 最终深度 | 原 part ID / 实际完整图层名 | 当前绘画 UUID |
| --- | --- | --- |
| d1 | `outer_jacket/jacket_body/back_panel`<br>`outer_jacket/jacket_body/back_panel \| complete \| d1` | `{d65980d6-ab8f-494f-bd94-680b5b363881}` |
| d2 | `inner_shirt/shirt_body`<br>`inner_shirt/shirt_body \| far \| d2` | `{64476358-6b22-4371-8a2d-680990fe8c4a}` |
| d3 | `outer_jacket/jacket_collar/collar_root`<br>`outer_jacket/jacket_collar/collar_root \| complete \| d3` | `{d5126161-e3cf-4e12-a122-dda79e6651af}` |
| d4 | `outer_jacket/jacket_collar/left_collar_flap`<br>`outer_jacket/jacket_collar/left_collar_flap \| far \| d4` | `{f34263dd-950b-43de-8415-2f96af713392}` |
| d5 | `outer_jacket/jacket_collar/right_collar_flap`<br>`outer_jacket/jacket_collar/right_collar_flap \| far \| d5` | `{46380345-5435-4995-bea2-a1c17edf3ba2}` |
| d6 | `outer_jacket/left_sleeve`<br>`outer_jacket/left_sleeve \| far \| d6` | `{7af74231-3b67-4500-8a6f-9b9a7d8791f6}` |
| d7 | `outer_jacket/right_sleeve`<br>`outer_jacket/right_sleeve \| far \| d7` | `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}` |
| d8 | `inner_shirt/left_sleeve`<br>`inner_shirt/left_sleeve \| far \| d8` | `{6b8f1300-71be-4b40-9564-07941030af7e}` |
| d9 | `inner_shirt/right_sleeve`<br>`inner_shirt/right_sleeve \| far \| d9` | `{927e01f3-f285-44fa-9aa0-91cb5cb985e9}` |
| d10 | `inner_shirt/shirt_collar/collar_base`<br>`inner_shirt/shirt_collar/collar_base \| far \| d10` | `{3e8eed0d-000f-48d0-9f64-932f9083755f}` |
| d11 | `pleated_skirt/skirt_body`<br>`pleated_skirt/skirt_body \| far \| d11` | `{e90f4e77-c691-49b3-9de0-783cb7723a76}` |
| d20 | `inner_shirt/left_sleeve`<br>`inner_shirt/left_sleeve \| near \| d20` | `{1bd5ddc5-1e9d-44a6-99c9-3ad3150c3bfb}` |
| d21 | `inner_shirt/right_sleeve`<br>`inner_shirt/right_sleeve \| near \| d21` | `{9ac3a3a0-8e69-465d-9931-1a8897e2c9b3}` |
| d22 | `inner_shirt/shirt_body`<br>`inner_shirt/shirt_body \| near \| d22` | `{dc5f75b1-3c42-4be7-85cf-d19049187fb1}` |
| d23 | `inner_shirt/shirt_collar/collar_base`<br>`inner_shirt/shirt_collar/collar_base \| near \| d23` | `{c4121cb2-56f5-4874-817b-0ea842a813da}` |
| d24 | `pleated_skirt/skirt_body`<br>`pleated_skirt/skirt_body \| near \| d24` | `{18ec5e0c-cd44-45ce-978a-6634cfc49573}` |
| d25 | `pleated_skirt/waistband`<br>`pleated_skirt/waistband \| complete \| d25` | `{cfa95e5e-7469-41fb-b5ec-6870974b8938}` |
| d26 | `short_necktie/hanging_blade`<br>`short_necktie/hanging_blade \| complete \| d26` | `{ef80ec8a-8ce4-441f-bc3a-d6816614a33b}` |
| d27 | `short_necktie/knot_and_attachment`<br>`short_necktie/knot_and_attachment \| complete \| d27` | `{04553e19-559a-40a3-bbc3-846b4f0868e2}` |
| d28 | `inner_shirt/shirt_collar/left_collar_leaf`<br>`inner_shirt/shirt_collar/left_collar_leaf \| complete \| d28` | `{522a2d60-6d6d-4bee-9809-49ce8868ca81}` |
| d29 | `inner_shirt/shirt_collar/right_collar_leaf`<br>`inner_shirt/shirt_collar/right_collar_leaf \| complete \| d29` | `{1afc9ee8-5750-4582-9e9d-71f84760b426}` |
| d30 | `jacket_front_clasp/left_clasp_wing`<br>`jacket_front_clasp/left_clasp_wing \| complete \| d30` | `{133a0d6a-be41-4624-8034-39bdb9156a95}` |
| d31 | `jacket_front_clasp/right_clasp_wing`<br>`jacket_front_clasp/right_clasp_wing \| complete \| d31` | `{b10fddaf-f4a0-46f8-9bd8-710375924ec0}` |
| d32 | `outer_jacket/left_sleeve`<br>`outer_jacket/left_sleeve \| near \| d32` | `{975f8a53-72cd-4d9f-a48e-a47f9c946e5e}` |
| d33 | `outer_jacket/right_sleeve`<br>`outer_jacket/right_sleeve \| near \| d33` | `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}` |
| d34 | `outer_jacket/jacket_body/left_front/front_panel`<br>`outer_jacket/jacket_body/left_front/front_panel \| complete \| d34` | `{fffcff2e-2fe2-4773-81c6-f4f5eedf83de}` |
| d35 | `outer_jacket/jacket_body/right_front/front_panel`<br>`outer_jacket/jacket_body/right_front/front_panel \| complete \| d35` | `{877dbbf4-dc9b-42be-93ff-607fd26659bc}` |
| d36 | `outer_jacket/jacket_body/left_front/lapel`<br>`outer_jacket/jacket_body/left_front/lapel \| complete \| d36` | `{d0d277c3-7639-458a-bebe-d8a0d2f667ae}` |
| d37 | `outer_jacket/jacket_body/right_front/lapel`<br>`outer_jacket/jacket_body/right_front/lapel \| complete \| d37` | `{99ac81ac-c0e8-4df6-ab82-13c61e836b72}` |
| d38 | `outer_jacket/jacket_collar/left_collar_flap`<br>`outer_jacket/jacket_collar/left_collar_flap \| near \| d38` | `{4359e5cc-efc4-42b6-b83c-a7dbaf7a6cfd}` |
| d39 | `outer_jacket/jacket_collar/right_collar_flap`<br>`outer_jacket/jacket_collar/right_collar_flap \| near \| d39` | `{245d9658-a1b2-47aa-84e7-6748f56035ba}` |
| d40 | `jacket_front_clasp/center_buckle`<br>`jacket_front_clasp/center_buckle \| complete \| d40` | `{4a8d5063-93b1-445d-8da8-877722e35ae0}` |

各深度区域、分界、前后对象及复用依据保留于更新后的制作报告；完整机器清单：[layer-records.json](repair-01-evidence/layer-records.json)。

检查覆盖：32 个绘画分片逐层独显及隐藏所有更高层均已看；23 个逻辑衣片各自合看；双肩、袖口回转、领座、白翻领、标识、扣带、门襟、裙腰及裙前后摆在原尺寸及放大下对照。全部分片和同片的原尺寸检查导出见 [inspection/manifest.json](repair-01-evidence/inspection/manifest.json)。各处修改后均重新检查单层、隐藏上层与整图。

独显观察板：[1](evidence/solo-sheet-1.jpg)、[2](evidence/solo-sheet-2.jpg)、[3](evidence/solo-sheet-3.jpg)、[4](evidence/solo-sheet-4.jpg)、[5](evidence/solo-sheet-5.jpg)、[6](evidence/solo-sheet-6.jpg)、[7](evidence/solo-sheet-7.jpg)、[8](evidence/solo-sheet-8.jpg)。

隐藏上层观察板：[1](repair-01-evidence/uncover-sheet-1.png)、[2](repair-01-evidence/uncover-sheet-2.png)、[3](repair-01-evidence/uncover-sheet-3.png)、[4](repair-01-evidence/uncover-sheet-4.png)、[5](repair-01-evidence/uncover-sheet-5.png)、[6](repair-01-evidence/uncover-sheet-6.png)、[7](repair-01-evidence/uncover-sheet-7.png)、[8](repair-01-evidence/uncover-sheet-8.png)。

未发现未解决的归属或层级冲突。袖口保持穿着时收拢形体、窄透明口及完整远侧内壁；颈口和裙口保留。每层只含本衣片，未用人体或邻片填补，未加入他物投影。隐藏后料与纯衣服图可见轮廓的必要差异仍按 SVG 及原穿衣角色确定，详细理由见制作报告。画风不要求逐像素一致；本轮以看图检查完整性、线条和接色，未用数字相似度代替验收。

## 显隐蒙版两状态

| 受控 part / 深度 | 蒙版名称 / UUID | 所属绘画层或组 / UUID | 控制区域和证据 |
| --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` / d1 | `outer_jacket/jacket_body/back_panel \| default hidden`<br>`{1114f839-db15-40dd-a7e3-1b52d083e245}` | `outer_jacket/jacket_body/back_panel \| complete \| d1`<br>`{d65980d6-ab8f-494f-bd94-680b5b363881}` | 完整深度分片投影；[启用全隐](evidence/layers/outer_jacket__jacket_body__back_panel__d1__default.png) / [停用显示完整衣料](evidence/layers/outer_jacket__jacket_body__back_panel__d1__mask-off.png)。 |
| `inner_shirt/shirt_body` / d2 | `inner_shirt/shirt_body \| default concealed \| d2`<br>`{e3788cde-d110-4303-8428-6bb36de5c26f}` | `inner_shirt/shirt_body \| visibility control \| d2`<br>`{8fc6e546-e307-4676-9453-0ded6ec52c07}` | 完整深度分片投影；[启用全隐](evidence/layers/inner_shirt__shirt_body__d2__default.png) / [停用显示完整衣料](evidence/layers/inner_shirt__shirt_body__d2__mask-off.png)。 |
| `outer_jacket/jacket_collar/collar_root` / d3 | `outer_jacket/jacket_collar/collar_root \| default hidden`<br>`{020b5612-5197-41af-8e41-016116b0089e}` | `outer_jacket/jacket_collar/collar_root \| complete \| d3`<br>`{d5126161-e3cf-4e12-a122-dda79e6651af}` | 完整深度分片投影；[启用全隐](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__default.png) / [停用显示完整衣料](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__mask-off.png)。 |
| `inner_shirt/left_sleeve` / d8 | `inner_shirt/left_sleeve \| default concealed \| d8`<br>`{73139073-0388-49fc-9523-c45480c8bca8}` | `inner_shirt/left_sleeve \| visibility control \| d8`<br>`{39bed1a5-07a1-48a4-8e3b-cc10483b51a3}` | 完整深度分片投影；[启用全隐](evidence/layers/inner_shirt__left_sleeve__d8__default.png) / [停用显示完整衣料](evidence/layers/inner_shirt__left_sleeve__d8__mask-off.png)。 |
| `inner_shirt/right_sleeve` / d9 | `inner_shirt/right_sleeve \| default concealed \| d9`<br>`{c9fa2eb0-a701-4ab0-9111-1d3063c0c0e8}` | `inner_shirt/right_sleeve \| visibility control \| d9`<br>`{dc42b4f3-eb54-4ab0-aa2e-59a7cc800302}` | 完整深度分片投影；[启用全隐](evidence/layers/inner_shirt__right_sleeve__d9__default.png) / [停用显示完整衣料](evidence/layers/inner_shirt__right_sleeve__d9__mask-off.png)。 |
| `inner_shirt/left_sleeve` / d20 | `inner_shirt/left_sleeve \| default concealed \| d20`<br>`{7c4217ee-4f04-41c9-b1e6-7ddfd9e8d2fc}` | `inner_shirt/left_sleeve \| visibility control \| d20`<br>`{73eb42ba-5a77-4d33-a876-bc00c38e46f3}` | 完整深度分片投影；[启用全隐](evidence/layers/inner_shirt__left_sleeve__d20__default.png) / [停用显示完整衣料](evidence/layers/inner_shirt__left_sleeve__d20__mask-off.png)。 |
| `inner_shirt/right_sleeve` / d21 | `inner_shirt/right_sleeve \| default concealed \| d21`<br>`{a93743a6-fc70-4142-8b46-3626dd4e6344}` | `inner_shirt/right_sleeve \| visibility control \| d21`<br>`{3872ef39-e996-49f5-a3cb-46e881306d54}` | 完整深度分片投影；[启用全隐](evidence/layers/inner_shirt__right_sleeve__d21__default.png) / [停用显示完整衣料](evidence/layers/inner_shirt__right_sleeve__d21__mask-off.png)。 |

7 个蒙版均实际切换两状态并看图：启用时受控分片透明，停用时底层完整布面保留；真实开口由衣料 alpha 保持。最终全部恢复默认启用。[观察板1](evidence/mask-sheet-1.jpg)、[观察板2](evidence/mask-sheet-2.jpg)、[全蒙版停用整图](repair-01-evidence/inspection/all-masks-off.png)。复用来源与蒙版所有者记录已同步至 [来源与蒙版清单](repair-01-evidence/provenance-and-mask-checks.json)。

## 保存重开与交付核对

最终在 Krita 5.3.4.1 保存正式 KRA，关闭文档、丢弃旧节点引用后重开并重新获取节点。32 个绘画层、5 个组、7 个透明度蒙版均存在，23 个逻辑 ID 可追溯。名称、UUID、父组、层序、显隐、锁定、opacity、混合模式、图层原始像素、蒙版像素及默认合成均与保存前一致；全部绘画层底层非空，默认 7 个蒙版启用。差异列表为空。

[重开核对结论](repair-01-evidence/reopen-verification.json)、[保存前记录](repair-01-evidence/reopen-before.json)、[重开后记录](repair-01-evidence/reopen-after.json)。像素哈希仅用于持久化核对；绘画质量以已完成的图像验收为准。重开 PNG 已实际查看，最终画面无变化。

[最终参考对照](repair-01-evidence/reference-vs-final.png)、[重开后的默认透明 PNG](repair-01-evidence/clothing-composite-reopened.png)。验收 PNG、制作报告及来源/UUID 记录均已更新。本轮不另写身体插层或装配说明。
