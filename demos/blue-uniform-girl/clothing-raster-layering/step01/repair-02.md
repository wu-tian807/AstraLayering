结论：已修复

# review-02 衣服修复记录

依据：`clothing-raster-layering/step01/review-02.md`；修复工程：`clothing-raster-layering/step01/clothing-depth.kra`。本报告 R1–R6 对应 review-02，本轮已逐项修复并完成最终看图自检。纯衣服参考：`clothing-part-layering/references/clothing.png`；穿着形态参考：`part-layering/references/simplified-subject.png`。

仅在现有生成绘画上局部修整。五个实际分片改画像素；前后分片、真实开口与原生显隐控制保持，不混入身体、相邻衣片或其他部件投影。

### R1 — 衬衫下半亮褶面

原 review 定位框：`[548, 570, 174, 121]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 22 | `inner_shirt/shirt_body` | `inner_shirt/shirt_body \| near \| d22` | `{e64044de-4dd1-4510-bc38-062edfd5633f}` |
| 2 | `inner_shirt/shirt_body` | `inner_shirt/shirt_body \| far \| d2` | `{64476358-6b22-4371-8a2d-680990fe8c4a}` |

处理：按三色控制图重新生成本衬衫下半布料，以均匀比例 0.19、平移 [469.96,545.1] 配准。只接入门襟两侧布面内部，宽羽化位于同片衣料内；原三扣、弯曲门襟及外围轮廓保留。最终采用生成材料，早期叠加参考布面的双暗褶试样已恢复并弃用。

复验：d22 独显、停用蒙版并隐藏更高层、d2/d22 合看和默认合成均已查看。原来的密集尖斜暗面改成宽蓝灰亮褶，下腹回转圆润；三扣间距和门襟连续，可见段没有替换硬边或拼贴色块。d2 后布面未改。

[三视图及合看](repair-02-evidence/R1/three-views.png)；[d22 独显](repair-02-evidence/R1/d22-solo.png)；[d22 隐藏上层](repair-02-evidence/R1/d22-uncover.png)；[d2 独显](repair-02-evidence/R1/d2-solo.png)；[d2 隐藏上层](repair-02-evidence/R1/d2-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R1/same-parts.png)；[默认整图](repair-02-evidence/R1/composite.png)。

### R2 — 左袖带上缘断续黑线

原 review 定位框：`[205, 515, 184, 111]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 33 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| near \| d33` | `{8bd254f1-e3c5-4bda-b5f3-9552c5895ad7}` |
| 7 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| far \| d7` | `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}` |

处理：在原生成袖片上沿自身白布与青带接边，使用 Krita Basic-2 Opacity、3.8px、#188eb6 分段画连续蓝弧线，顺接至袖带末端。保留原白布、青带明暗和收拢形体。

复验：d33 独显、隐藏更高层、d7/d33 合看及整图在原尺寸与放大下复查。接边无原断续黑串、白点或线宽突变，白布至青带接色连续；窄透明口与 d7 内壁保持。

[三视图及合看](repair-02-evidence/R2/three-views.png)；[d33 独显](repair-02-evidence/R2/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R2/d33-uncover.png)；[d7 独显](repair-02-evidence/R2/d7-solo.png)；[d7 隐藏上层](repair-02-evidence/R2/d7-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R2/same-parts.png)；[默认整图](repair-02-evidence/R2/composite.png)。

### R3 — 左袖口回转台阶及短暗尾

原 review 定位框：`[306, 627, 51, 34]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 33 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| near \| d33` | `{8bd254f1-e3c5-4bda-b5f3-9552c5895ad7}` |
| 7 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| far \| d7` | `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}` |

处理：仅修 d33 回转端：原生曲线选区整理 alpha 内缘，从同袖青料取样接顺短尾处，再以本袖邻近青色作 4.1px、opacity 0.8 局部融色。d7 未重画；开口未填实，未通过蒙版掩盖瑕疵。

复验：d33、d7 分别独显，隐藏更高层、两片合看及整图复查。回转端平滑，原台阶、短黑尾及下伸暗凸点消失；窄透明口、完整远内壁和搭接保留。

[三视图及合看](repair-02-evidence/R3/three-views.png)；[d33 独显](repair-02-evidence/R3/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R3/d33-uncover.png)；[d7 独显](repair-02-evidence/R3/d7-solo.png)；[d7 隐藏上层](repair-02-evidence/R3/d7-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R3/same-parts.png)；[默认整图](repair-02-evidence/R3/composite.png)。

### R4 — 左袖窿黑残线及白点

原 review 定位框：`[357, 329, 81, 227]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 33 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| near \| d33` | `{8bd254f1-e3c5-4bda-b5f3-9552c5895ad7}` |
| 35 | `outer_jacket/jacket_body/right_front/front_panel` | `outer_jacket/jacket_body/right_front/front_panel \| complete \| d35` | `{53ed8735-9b01-4161-b7cb-8af60f6b775c}` |

处理：在 d33/d35 各自归属的参考范围内原生取样修肩袖根，中央连续本片材料全不透明，外围在衣料内融接。清除应藏在搭接区内的残边；肩端 y<344 的原外轮廓保留。修画中出现的平行半透明灰线和肩端缺口均恢复重做，最终版本已去除。

复验：两片分别独显、分别隐藏上层、局部合看及默认整图复查。各片补全连续；肩根到腋下只露单条自然蓝缝并转深，无黑残串、白点、平行灰线、肩端缺口或接边台阶。

[三视图及合看](repair-02-evidence/R4/three-views.png)；[d33 独显](repair-02-evidence/R4/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R4/d33-uncover.png)；[d35 独显](repair-02-evidence/R4/d35-solo.png)；[d35 隐藏上层](repair-02-evidence/R4/d35-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R4/same-parts.png)；[默认整图](repair-02-evidence/R4/composite.png)。

### R5 — 右白翻领青包边缺段

原 review 定位框：`[667, 302, 99, 111]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 38 | `outer_jacket/jacket_collar/left_collar_flap` | `outer_jacket/jacket_collar/left_collar_flap \| near \| d38` | `{c2db0fa9-841c-4447-b555-3691ffe295cd}` |
| 4 | `outer_jacket/jacket_collar/left_collar_flap` | `outer_jacket/jacket_collar/left_collar_flap \| far \| d4` | `{f34263dd-950b-43de-8415-2f96af713392}` |

处理：参考取样试版裁掉细包边，已弃用；最终恢复原 d38，在原 alpha 内用 Krita Basic-2 Opacity 沿外缘逐笔补蓝青主边（2.1→7.1px）和布面侧浅青细边（1.8px）。主边沿斜自由边连续接到领尖与下缘；d4 与独立驳头未改。

复验：d38 独显、隐藏更高层、d4/d38 合看及整图复查。斜边上段至领尖包边连续，深蓝到青蓝、窄到宽的过渡自然，无缺段、白沟、圆头硬接或新断线；领根与正常颈口保持。

[三视图及合看](repair-02-evidence/R5/three-views.png)；[d38 独显](repair-02-evidence/R5/d38-solo.png)；[d38 隐藏上层](repair-02-evidence/R5/d38-uncover.png)；[d4 独显](repair-02-evidence/R5/d4-solo.png)；[d4 隐藏上层](repair-02-evidence/R5/d4-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R5/same-parts.png)；[默认整图](repair-02-evidence/R5/composite.png)。

### R6 — 右前片额外亮青带

原 review 定位框：`[674, 498, 181, 275]`，1115×1410 画布。

| 最终深度 | 原 part ID | 当前实际图层名 | 当前 UUID |
| --- | --- | --- | --- |
| 34 | `outer_jacket/jacket_body/left_front/front_panel` | `outer_jacket/jacket_body/left_front/front_panel \| complete \| d34` | `{b1f01629-aee1-4bd0-bef0-7772313408f7}` |
| 36 | `outer_jacket/jacket_body/left_front/lapel` | `outer_jacket/jacket_body/left_front/lapel \| complete \| d36` | `{d0d277c3-7639-458a-bebe-d8a0d2f667ae}` |

处理：沿 d34 开襟及下摆用本片参考取样恢复白布自然接边，去除额外亮青条；用原生 Basic-2 Opacity 逐笔接顺 4.2px 深色外轮廓，清掉右下边小刺。最终复查另外发现扣翼遮住的开襟上端 alpha 缺口，以本片修前衣料原生局部取样补回，并用 3.5→6px 画笔将上端灰蓝接色平缓转入深蓝外缘。取样没有带入扣翼；d36 未改。

复验：d34、d36 独显、隐藏上层、合看及默认合成复查；另在 [662,470,60,95] 放大检查上端三视图。整条开襟与下摆无额外高饱和亮青带；上端补料连续且不透明，没有缺口或取样半透明条；胸标、圆点、真实口袋青边、驳头青边完整，右下外缘无小刺。

[三视图及合看](repair-02-evidence/R6/three-views.png)；[d34 独显](repair-02-evidence/R6/d34-solo.png)；[d34 隐藏上层](repair-02-evidence/R6/d34-uncover.png)；[d36 独显](repair-02-evidence/R6/d36-solo.png)；[d36 隐藏上层](repair-02-evidence/R6/d36-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R6/same-parts.png)；[默认整图](repair-02-evidence/R6/composite.png)；[开襟上端放大三视图](repair-02-evidence/R6/top-three-views.png)。

## 修画中另外发现并处理的问题

- R4 的试样曾出现半透明平行灰线、肩端取样缺口；已恢复并重做为连续本片材料，保留肩端外轮廓。最终 R4 三视图已复查。
- R6 下摆及右下边细小突出点已清除，原生逐笔外缘连续。
- R6 开襟上端在整图中被扣翼遮住，最终全片独显检查发现 alpha 缺口。已从同片原有边料补回完整布面，并修顺灰蓝到深蓝的接色。局部恢复只取边料，避开旧源更内侧的投影杂色；试样取样条的半透明缺陷已恢复重做，最终三视图布面连续且不透明。未借用扣翼或人体填洞。

## 全片与蒙版最终检查覆盖

全部 32 个实际绘画分片均独显；隐藏所有更高深度、停用相关显隐蒙版看补全区，再对全部 23 个逻辑 part 合看连续性。各分片自身内容完整，同 part 多深度没有合并。原尺寸和放大检查两袖口、两肩袖窿、领根与领尖、驳头、扣翼与方扣、门襟、裙腰和裙摆。

| 原 part ID | 深度 | 独显 | 隐藏更高层 | 同 part 合看 |
| --- | --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` | d1 | [d1](evidence/layers/outer_jacket__jacket_body__back_panel__d1.png) | [d1](repair-02-evidence/inspection/outer_jacket__jacket_body__back_panel__d1__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_body__back_panel__part.png) |
| `inner_shirt/shirt_body` | d2, d22 | [d2](evidence/layers/inner_shirt__shirt_body__d2.png)、[d22](evidence/layers/inner_shirt__shirt_body__d22.png) | [d2](repair-02-evidence/inspection/inner_shirt__shirt_body__d2__uncover.png)、[d22](repair-02-evidence/inspection/inner_shirt__shirt_body__d22__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__shirt_body__part.png) |
| `outer_jacket/jacket_collar/collar_root` | d3 | [d3](evidence/layers/outer_jacket__jacket_collar__collar_root__d3.png) | [d3](repair-02-evidence/inspection/outer_jacket__jacket_collar__collar_root__d3__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_collar__collar_root__part.png) |
| `outer_jacket/jacket_collar/left_collar_flap` | d4, d38 | [d4](evidence/layers/outer_jacket__jacket_collar__left_collar_flap__d4.png)、[d38](evidence/layers/outer_jacket__jacket_collar__left_collar_flap__d38.png) | [d4](repair-02-evidence/inspection/outer_jacket__jacket_collar__left_collar_flap__d4__uncover.png)、[d38](repair-02-evidence/inspection/outer_jacket__jacket_collar__left_collar_flap__d38__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_collar__left_collar_flap__part.png) |
| `outer_jacket/jacket_collar/right_collar_flap` | d5, d39 | [d5](evidence/layers/outer_jacket__jacket_collar__right_collar_flap__d5.png)、[d39](evidence/layers/outer_jacket__jacket_collar__right_collar_flap__d39.png) | [d5](repair-02-evidence/inspection/outer_jacket__jacket_collar__right_collar_flap__d5__uncover.png)、[d39](repair-02-evidence/inspection/outer_jacket__jacket_collar__right_collar_flap__d39__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_collar__right_collar_flap__part.png) |
| `outer_jacket/left_sleeve` | d6, d32 | [d6](evidence/layers/outer_jacket__left_sleeve__d6.png)、[d32](evidence/layers/outer_jacket__left_sleeve__d32.png) | [d6](repair-02-evidence/inspection/outer_jacket__left_sleeve__d6__uncover.png)、[d32](repair-02-evidence/inspection/outer_jacket__left_sleeve__d32__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__left_sleeve__part.png) |
| `outer_jacket/right_sleeve` | d7, d33 | [d7](evidence/layers/outer_jacket__right_sleeve__d7.png)、[d33](evidence/layers/outer_jacket__right_sleeve__d33.png) | [d7](repair-02-evidence/inspection/outer_jacket__right_sleeve__d7__uncover.png)、[d33](repair-02-evidence/inspection/outer_jacket__right_sleeve__d33__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__right_sleeve__part.png) |
| `inner_shirt/left_sleeve` | d8, d20 | [d8](evidence/layers/inner_shirt__left_sleeve__d8.png)、[d20](evidence/layers/inner_shirt__left_sleeve__d20.png) | [d8](repair-02-evidence/inspection/inner_shirt__left_sleeve__d8__uncover.png)、[d20](repair-02-evidence/inspection/inner_shirt__left_sleeve__d20__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__left_sleeve__part.png) |
| `inner_shirt/right_sleeve` | d9, d21 | [d9](evidence/layers/inner_shirt__right_sleeve__d9.png)、[d21](evidence/layers/inner_shirt__right_sleeve__d21.png) | [d9](repair-02-evidence/inspection/inner_shirt__right_sleeve__d9__uncover.png)、[d21](repair-02-evidence/inspection/inner_shirt__right_sleeve__d21__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__right_sleeve__part.png) |
| `inner_shirt/shirt_collar/collar_base` | d10, d23 | [d10](evidence/layers/inner_shirt__shirt_collar__collar_base__d10.png)、[d23](evidence/layers/inner_shirt__shirt_collar__collar_base__d23.png) | [d10](repair-02-evidence/inspection/inner_shirt__shirt_collar__collar_base__d10__uncover.png)、[d23](repair-02-evidence/inspection/inner_shirt__shirt_collar__collar_base__d23__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__shirt_collar__collar_base__part.png) |
| `pleated_skirt/skirt_body` | d11, d24 | [d11](evidence/layers/pleated_skirt__skirt_body__d11.png)、[d24](evidence/layers/pleated_skirt__skirt_body__d24.png) | [d11](repair-02-evidence/inspection/pleated_skirt__skirt_body__d11__uncover.png)、[d24](repair-02-evidence/inspection/pleated_skirt__skirt_body__d24__uncover.png) | [原图](repair-02-evidence/inspection/pleated_skirt__skirt_body__part.png) |
| `pleated_skirt/waistband` | d25 | [d25](evidence/layers/pleated_skirt__waistband__d25.png) | [d25](repair-02-evidence/inspection/pleated_skirt__waistband__d25__uncover.png) | [原图](repair-02-evidence/inspection/pleated_skirt__waistband__part.png) |
| `short_necktie/hanging_blade` | d26 | [d26](evidence/layers/short_necktie__hanging_blade__d26.png) | [d26](repair-02-evidence/inspection/short_necktie__hanging_blade__d26__uncover.png) | [原图](repair-02-evidence/inspection/short_necktie__hanging_blade__part.png) |
| `short_necktie/knot_and_attachment` | d27 | [d27](evidence/layers/short_necktie__knot_and_attachment__d27.png) | [d27](repair-02-evidence/inspection/short_necktie__knot_and_attachment__d27__uncover.png) | [原图](repair-02-evidence/inspection/short_necktie__knot_and_attachment__part.png) |
| `inner_shirt/shirt_collar/left_collar_leaf` | d28 | [d28](evidence/layers/inner_shirt__shirt_collar__left_collar_leaf__d28.png) | [d28](repair-02-evidence/inspection/inner_shirt__shirt_collar__left_collar_leaf__d28__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__shirt_collar__left_collar_leaf__part.png) |
| `inner_shirt/shirt_collar/right_collar_leaf` | d29 | [d29](evidence/layers/inner_shirt__shirt_collar__right_collar_leaf__d29.png) | [d29](repair-02-evidence/inspection/inner_shirt__shirt_collar__right_collar_leaf__d29__uncover.png) | [原图](repair-02-evidence/inspection/inner_shirt__shirt_collar__right_collar_leaf__part.png) |
| `jacket_front_clasp/left_clasp_wing` | d30 | [d30](evidence/layers/jacket_front_clasp__left_clasp_wing__d30.png) | [d30](repair-02-evidence/inspection/jacket_front_clasp__left_clasp_wing__d30__uncover.png) | [原图](repair-02-evidence/inspection/jacket_front_clasp__left_clasp_wing__part.png) |
| `jacket_front_clasp/right_clasp_wing` | d31 | [d31](evidence/layers/jacket_front_clasp__right_clasp_wing__d31.png) | [d31](repair-02-evidence/inspection/jacket_front_clasp__right_clasp_wing__d31__uncover.png) | [原图](repair-02-evidence/inspection/jacket_front_clasp__right_clasp_wing__part.png) |
| `outer_jacket/jacket_body/left_front/front_panel` | d34 | [d34](evidence/layers/outer_jacket__jacket_body__left_front__front_panel__d34.png) | [d34](repair-02-evidence/inspection/outer_jacket__jacket_body__left_front__front_panel__d34__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_body__left_front__front_panel__part.png) |
| `outer_jacket/jacket_body/right_front/front_panel` | d35 | [d35](evidence/layers/outer_jacket__jacket_body__right_front__front_panel__d35.png) | [d35](repair-02-evidence/inspection/outer_jacket__jacket_body__right_front__front_panel__d35__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_body__right_front__front_panel__part.png) |
| `outer_jacket/jacket_body/left_front/lapel` | d36 | [d36](evidence/layers/outer_jacket__jacket_body__left_front__lapel__d36.png) | [d36](repair-02-evidence/inspection/outer_jacket__jacket_body__left_front__lapel__d36__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_body__left_front__lapel__part.png) |
| `outer_jacket/jacket_body/right_front/lapel` | d37 | [d37](evidence/layers/outer_jacket__jacket_body__right_front__lapel__d37.png) | [d37](repair-02-evidence/inspection/outer_jacket__jacket_body__right_front__lapel__d37__uncover.png) | [原图](repair-02-evidence/inspection/outer_jacket__jacket_body__right_front__lapel__part.png) |
| `jacket_front_clasp/center_buckle` | d40 | [d40](evidence/layers/jacket_front_clasp__center_buckle__d40.png) | [d40](repair-02-evidence/inspection/jacket_front_clasp__center_buckle__d40__uncover.png) | [原图](repair-02-evidence/inspection/jacket_front_clasp__center_buckle__part.png) |

独显看图页：[1](evidence/solo-sheet-1.jpg)、[2](evidence/solo-sheet-2.jpg)、[3](evidence/solo-sheet-3.jpg)、[4](evidence/solo-sheet-4.jpg)、[5](evidence/solo-sheet-5.jpg)、[6](evidence/solo-sheet-6.jpg)、[7](evidence/solo-sheet-7.jpg)、[8](evidence/solo-sheet-8.jpg)；隐藏上层页：[1](repair-02-evidence/uncover-sheet-1.png)、[2](repair-02-evidence/uncover-sheet-2.png)、[3](repair-02-evidence/uncover-sheet-3.png)、[4](repair-02-evidence/uncover-sheet-4.png)、[5](repair-02-evidence/uncover-sheet-5.png)、[6](repair-02-evidence/uncover-sheet-6.png)、[7](repair-02-evidence/uncover-sheet-7.png)、[8](repair-02-evidence/uncover-sheet-8.png)；同片合看页：[1](repair-02-evidence/parts-sheet-1.png)、[2](repair-02-evidence/parts-sheet-2.png)、[3](repair-02-evidence/parts-sheet-3.png)、[4](repair-02-evidence/parts-sheet-4.png)、[5](repair-02-evidence/parts-sheet-5.png)、[6](repair-02-evidence/parts-sheet-6.png)。上述页及修改处原画布、原尺寸局部均实际查看。

| 蒙版控制 part / 深度 | 蒙版名 / UUID | 所属层或组 / UUID | 启用／停用证据 |
| --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` / d1 | `outer_jacket/jacket_body/back_panel \| default hidden`<br>`{1114f839-db15-40dd-a7e3-1b52d083e245}` | `outer_jacket/jacket_body/back_panel \| complete \| d1`<br>`{d65980d6-ab8f-494f-bd94-680b5b363881}` | [启用](evidence/layers/outer_jacket__jacket_body__back_panel__d1__default.png) / [停用](evidence/layers/outer_jacket__jacket_body__back_panel__d1__mask-off.png) |
| `inner_shirt/shirt_body` / d2 | `inner_shirt/shirt_body \| default concealed \| d2`<br>`{e3788cde-d110-4303-8428-6bb36de5c26f}` | `inner_shirt/shirt_body \| visibility control \| d2`<br>`{8fc6e546-e307-4676-9453-0ded6ec52c07}` | [启用](evidence/layers/inner_shirt__shirt_body__d2__default.png) / [停用](evidence/layers/inner_shirt__shirt_body__d2__mask-off.png) |
| `outer_jacket/jacket_collar/collar_root` / d3 | `outer_jacket/jacket_collar/collar_root \| default hidden`<br>`{020b5612-5197-41af-8e41-016116b0089e}` | `outer_jacket/jacket_collar/collar_root \| complete \| d3`<br>`{d5126161-e3cf-4e12-a122-dda79e6651af}` | [启用](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__default.png) / [停用](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__mask-off.png) |
| `inner_shirt/left_sleeve` / d8 | `inner_shirt/left_sleeve \| default concealed \| d8`<br>`{73139073-0388-49fc-9523-c45480c8bca8}` | `inner_shirt/left_sleeve \| visibility control \| d8`<br>`{39bed1a5-07a1-48a4-8e3b-cc10483b51a3}` | [启用](evidence/layers/inner_shirt__left_sleeve__d8__default.png) / [停用](evidence/layers/inner_shirt__left_sleeve__d8__mask-off.png) |
| `inner_shirt/right_sleeve` / d9 | `inner_shirt/right_sleeve \| default concealed \| d9`<br>`{c9fa2eb0-a701-4ab0-9111-1d3063c0c0e8}` | `inner_shirt/right_sleeve \| visibility control \| d9`<br>`{dc42b4f3-eb54-4ab0-aa2e-59a7cc800302}` | [启用](evidence/layers/inner_shirt__right_sleeve__d9__default.png) / [停用](evidence/layers/inner_shirt__right_sleeve__d9__mask-off.png) |
| `inner_shirt/left_sleeve` / d20 | `inner_shirt/left_sleeve \| default concealed \| d20`<br>`{7c4217ee-4f04-41c9-b1e6-7ddfd9e8d2fc}` | `inner_shirt/left_sleeve \| visibility control \| d20`<br>`{73eb42ba-5a77-4d33-a876-bc00c38e46f3}` | [启用](evidence/layers/inner_shirt__left_sleeve__d20__default.png) / [停用](evidence/layers/inner_shirt__left_sleeve__d20__mask-off.png) |
| `inner_shirt/right_sleeve` / d21 | `inner_shirt/right_sleeve \| default concealed \| d21`<br>`{a93743a6-fc70-4142-8b46-3626dd4e6344}` | `inner_shirt/right_sleeve \| visibility control \| d21`<br>`{3872ef39-e996-49f5-a3cb-46e881306d54}` | [启用](evidence/layers/inner_shirt__right_sleeve__d21__default.png) / [停用](evidence/layers/inner_shirt__right_sleeve__d21__mask-off.png) |

7 个原生全黑透明度蒙版均逐一切换查看：启用时所属分片全隐，停用后完整底层绘画可见；不依靠删除底层纹理。控制范围为各自完整深度分片投影，蒙版所有者和默认状态未变。已看 [蒙版页 1](evidence/mask-sheet-1.jpg)、[蒙版页 2](evidence/mask-sheet-2.jpg)、[全部蒙版停用整图](repair-02-evidence/inspection/all-masks-off.png) 及默认整图，最终全部蒙版启用。没有新增剪贴关系。

## 结构、归属和形体对照

上游 `groups.json`、`occlusion.json` 和 parts 共 35 个文件与 review-02 原输入一致。当前仍为 23 个逻辑 ID、32 个普通绘画深度分片、5 个组、7 个透明度蒙版；最终深度与区域、分界、前后对象及拆分理由沿用 `clothing-part-layering/occlusion.json` 和更新后的 `clothing-raster-layering/step01/report.md`。未新增独立控制需要或穿插，故没有结构变更，无需调用 edit_groups / edit_occlusion。见 [核对记录](repair-02-evidence/structure-verification.json)。

袖口相对上游纯衣服色块图保留穿着时的收拢布边、完整内壁和窄透明口；此项是既有必要形体差异，本轮未改回空心大张口。局部修线保留本片自由边和配准細线，原尺寸接缝连续。未发现未解决的色块归属或层序冲突。各片仍只含自己衣料和本片固定纹样，正常颈口、袖口及开襟未填实；未加入人体或邻片像素、他物投影。

## 最终采用来源

本轮 R1 生图采用内置 image_gen；最终源：`generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_e68qvtYCQjZyaCpyvLqjANYX.png`。输入裁图为原画布 (435,520)–(785,750)，放大 3 倍。红色只提供本衬衫可见布面的形体和笔触，黄色补连续隐藏衣料，绿色透明排除；黄、绿输入抹为中性灰，并排除白扣翼与外套。修画规格为宽圆蓝灰亮褶、自身暗褶与柔和过渡、保留三扣和弯曲门襟，不加入邻片或其投影。

[三色控制](repair-02-evidence/final-sources/R1-control.png)、[灰底参考输入](repair-02-evidence/final-sources/R1-reference.png)、[最终生成源](repair-02-evidence/final-sources/R1-generated.png)、[配准画面](repair-02-evidence/final-sources/R1-registered.png)、[相似配准记录](repair-02-evidence/final-sources/R1-registration.json)。R2/R5 为原生逐笔修线，[R2 坐标](repair-02-evidence/final-sources/R2-stroke.json)、[R5 坐标](repair-02-evidence/final-sources/R5-stroke.json)；R3 来源为[同袖青料](repair-02-evidence/final-sources/R3-own-cyan.png)；R4/R6 的参考源仅选取各自衣片，R6 上端补料为[本片原有边料](repair-02-evidence/final-sources/R6-before-d34-own.png)。完整当前来源与蒙版所有者见 [来源记录](evidence/provenance-and-mask-checks.json)。

## 保存、重开及交付

最终实际修画结束后保存正式 KRA，关闭文档并丢弃旧文档、节点和视图引用，再从正式路径重新打开、重新获取全部节点。保存前后完整树结构、名称、UUID、父组、层序、显隐、锁定、透明度、混合模式一致；32 个绘画层均非空，原始绘画像素、7 个蒙版像素及默认合成像素一致。默认蒙版全部启用，重开后 PNG 已看图，画面无变化。像素哈希仅检查保存完整性，不用于绘画质量结论。

[重开结论](repair-02-evidence/reopen-verification.json)、[保存前记录](repair-02-evidence/reopen-before.json)、[重开后记录](repair-02-evidence/reopen-after.json)、[重开默认 PNG](repair-02-evidence/clothing-composite-reopened.png)、[最终参考对照](repair-02-evidence/reference-vs-final.png)。

已更新：`clothing-raster-layering/step01/clothing-depth.kra`、`clothing-raster-layering/step01/evidence/clothing-composite.png`、`clothing-raster-layering/step01/evidence/clothing-composite-reopened.png`、全片验收 PNG、`clothing-raster-layering/step01/report.md`、当前 UUID 与来源记录。本修复结论写入 `clothing-raster-layering/step01/repair-02.md.tmp`，不自行发布正式 repair 或 review 报告。

R1–R6 与本轮另发现问题均已修复，自检无待处理项。
