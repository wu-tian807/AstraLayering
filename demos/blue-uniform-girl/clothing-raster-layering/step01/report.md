# 衣服分层绘画记录（step01，review-02 修复后）

已完成 23 个原逻辑衣片：14 个单深度衣片各一个完整普通绘画层，9 个双深度衣片各两个普通绘画分片层，共 32 个绘画层。另有 5 个原生显隐控制组、7 个原生透明度蒙版。深度从后到前排列；默认蒙版启用。逐层独显、隐藏上层检查补全、同片合看及整图参考对照均已完成，发现的问题已在本步修正。

工程：`clothing-raster-layering/step01/clothing-depth.kra`。画布 1115 × 1410，透明背景。默认合成 PNG：[重开后合成](evidence/clothing-composite-reopened.png)。

归属依据：`clothing-part-layering/groups.json`；完整衣片 SVG：`clothing-part-layering/parts`；纯衣服参考：`clothing-part-layering/references/clothing.png`；穿着形态参考：`part-layering/references/simplified-subject.png`。

## 生成、配准和复用

采用内置 image_gen 制作本片布面。20 个衣片独立生成，另外 3 个对称衣片在 Krita 中镜像并以三个形体锚点配准；衬衫背面和裙后内布面另有独立生成源。三色控制以红色标出本片可见形体和笔触、黄色标出本片补全、绿色标出透明排除区；黄色遮挡物和绿色输入画面使用中性灰。整体隐藏部件以完整补全形体控制。小衣片放大生成后配准，保留生成 alpha、细描边和包边。

生成和修画规格：只保留本片衣料与固定于本片的纹样，补足隐藏连续布面、自身褶皱和完整边线；不生成人体、相邻片、他物投影或封住真实开口的面。颜色、纹样和线条以参考为准，袖口以穿着时的收拢布边和内壁为准。局部修整保留原生成主体，使用重新生成、Krita 原生选区清理及原生画笔；Python 用于控制图、配准、拆层、组装与导出。

初次制作所用基底生成文件如下（完整绝对路径）；review-01 修复的局部替换来源在下文另列，方扣最终以本片参考取样重做：

| 原 part ID | 初次基底生成源 |
| --- | --- |
| `pleated_skirt/skirt_body` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_6s3db6isZLooIQpUuWhUCyBb.png` |
| `outer_jacket/jacket_body/right_front/front_panel` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_vsbau4Ed6ICpb6A6zXAeGWGH.png` |
| `outer_jacket/jacket_body/left_front/front_panel` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_bFhjQUayBWOG7u8ct8iR1Rvb.png` |
| `outer_jacket/jacket_body/right_front/lapel` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_zq0o42wKK30nFAHx71FiFOtU.png` |
| `outer_jacket/jacket_collar/right_collar_flap` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_73ALmOSCXCurkWbyi0LGT7Ya.png` |
| `outer_jacket/jacket_collar/left_collar_flap` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_wdHSNrCtwV322XXdq20tzgy5.png` |
| `outer_jacket/right_sleeve` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_iRSWaBDvDCmN2SaUGEeuM7Y6.png` |
| `outer_jacket/left_sleeve` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_SmgFqTEBFkjQppwWlFpkgUZO.png` |
| `inner_shirt/shirt_body` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_0zQgbtPIHyKRMBkrKJRRObBV.png` |
| `outer_jacket/jacket_body/back_panel` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_DEiiweRWIkZjBhwdpiJgOQZX.png` |
| `outer_jacket/jacket_collar/collar_root` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_ACBAIHBl9VRnoq42cX7eBjqJ.png` |
| `inner_shirt/shirt_collar/right_collar_leaf` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_c8vHahldc43JzxMlK8koV4QW.png` |
| `inner_shirt/shirt_collar/collar_base` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_zpJ1G3OOWRpRDhWhXV0doyUJ.png` |
| `short_necktie/knot_and_attachment` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_M21TPfRsUaOQxjESBn5UUOFF.png` |
| `short_necktie/hanging_blade` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_oudcSddr5eBpqapuTEEpaMtQ.png` |
| `jacket_front_clasp/right_clasp_wing` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_VugoeB3Qdb17ya1GgYeWWjBQ.png` |
| `jacket_front_clasp/center_buckle` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_mRnAr4rIOlAN5F687IwOtBg4.png` |
| `pleated_skirt/waistband` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_2t7YKkx8Z5SfaOA22A7hM6Fj.png` |
| `inner_shirt/left_sleeve` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_kLJq70gEEDyxDeuc4jnqsGjG.png` |
| `inner_shirt/right_sleeve` | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_OdN6frluPip7q1iGo35XCsqG.png` |

独立后布面：

| 同一 part ID / 区域 | 生成源 |
| --- | --- |
| `pleated_skirt/skirt_body` / 后侧 d11 | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_wn8dNQPfFsaNj7YKMS2nuyYa.png` |
| `inner_shirt/shirt_body` / 后侧 d2 | `generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_QGvcuFTNmCAxXGObvuyv7xqz.png` |

Krita 镜像复用：

| 目标 part ID | 源 part ID / 源绘画 UUID | 源锚点 → 目标锚点 |
| --- | --- | --- |
| `outer_jacket/jacket_body/left_front/lapel` | `outer_jacket/jacket_body/right_front/lapel` / `{99ac81ac-c0e8-4df6-ab82-13c61e836b72}` | [[530, 376], [474, 432], [593, 510]] → [[679, 381], [749, 432], [679, 500]] |
| `inner_shirt/shirt_collar/left_collar_leaf` | `inner_shirt/shirt_collar/right_collar_leaf` / `{1afc9ee8-5750-4582-9e9d-71f84760b426}` | [[497, 283], [604, 364], [550, 400]] → [[644, 285], [605, 362], [665, 399]] |
| `jacket_front_clasp/left_clasp_wing` | `jacket_front_clasp/right_clasp_wing` / `{b10fddaf-f4a0-46f8-9bd8-710375924ec0}` | [[585, 478], [580, 584], [640, 534]] → [[675, 479], [701, 584], [640, 534]] |

## 原 part ID 与实际绘画层

下表全部是普通绘画层。complete 为完整单深度衣片；far、near 是同一逻辑衣片的后、前深度区域。所有完整 part ID 未改动。带显隐组的绘画层仍单独保留，组只承载原生显隐控制；完整记录见 [layer-records.json](evidence/layer-records.json)。

| 最终深度 | 原 part ID | 实际图层名 | 绘画层 UUID | 区域 / 默认控制 | 独显 |
| --- | --- | --- | --- | --- | --- |
| 1 | `outer_jacket/jacket_body/back_panel` | `outer_jacket/jacket_body/back_panel \| complete \| d1` | `{d65980d6-ab8f-494f-bd94-680b5b363881}` | 完整单片；原生蒙版全隐 | [PNG](evidence/layers/outer_jacket__jacket_body__back_panel__d1.png) |
| 2 | `inner_shirt/shirt_body` | `inner_shirt/shirt_body \| far \| d2` | `{64476358-6b22-4371-8a2d-680990fe8c4a}` | 后侧 / 远侧；原生蒙版全隐 | [PNG](evidence/layers/inner_shirt__shirt_body__d2.png) |
| 3 | `outer_jacket/jacket_collar/collar_root` | `outer_jacket/jacket_collar/collar_root \| complete \| d3` | `{d5126161-e3cf-4e12-a122-dda79e6651af}` | 完整单片；原生蒙版全隐 | [PNG](evidence/layers/outer_jacket__jacket_collar__collar_root__d3.png) |
| 4 | `outer_jacket/jacket_collar/left_collar_flap` | `outer_jacket/jacket_collar/left_collar_flap \| far \| d4` | `{f34263dd-950b-43de-8415-2f96af713392}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_collar__left_collar_flap__d4.png) |
| 5 | `outer_jacket/jacket_collar/right_collar_flap` | `outer_jacket/jacket_collar/right_collar_flap \| far \| d5` | `{46380345-5435-4995-bea2-a1c17edf3ba2}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_collar__right_collar_flap__d5.png) |
| 6 | `outer_jacket/left_sleeve` | `outer_jacket/left_sleeve \| far \| d6` | `{7af74231-3b67-4500-8a6f-9b9a7d8791f6}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__left_sleeve__d6.png) |
| 7 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| far \| d7` | `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__right_sleeve__d7.png) |
| 8 | `inner_shirt/left_sleeve` | `inner_shirt/left_sleeve \| far \| d8` | `{6b8f1300-71be-4b40-9564-07941030af7e}` | 后侧 / 远侧；原生蒙版全隐 | [PNG](evidence/layers/inner_shirt__left_sleeve__d8.png) |
| 9 | `inner_shirt/right_sleeve` | `inner_shirt/right_sleeve \| far \| d9` | `{927e01f3-f285-44fa-9aa0-91cb5cb985e9}` | 后侧 / 远侧；原生蒙版全隐 | [PNG](evidence/layers/inner_shirt__right_sleeve__d9.png) |
| 10 | `inner_shirt/shirt_collar/collar_base` | `inner_shirt/shirt_collar/collar_base \| far \| d10` | `{3e8eed0d-000f-48d0-9f64-932f9083755f}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/inner_shirt__shirt_collar__collar_base__d10.png) |
| 11 | `pleated_skirt/skirt_body` | `pleated_skirt/skirt_body \| far \| d11` | `{e90f4e77-c691-49b3-9de0-783cb7723a76}` | 后侧 / 远侧；实际层像素自然遮挡 | [PNG](evidence/layers/pleated_skirt__skirt_body__d11.png) |
| 20 | `inner_shirt/left_sleeve` | `inner_shirt/left_sleeve \| near \| d20` | `{1bd5ddc5-1e9d-44a6-99c9-3ad3150c3bfb}` | 前侧 / 近侧；原生蒙版全隐 | [PNG](evidence/layers/inner_shirt__left_sleeve__d20.png) |
| 21 | `inner_shirt/right_sleeve` | `inner_shirt/right_sleeve \| near \| d21` | `{9ac3a3a0-8e69-465d-9931-1a8897e2c9b3}` | 前侧 / 近侧；原生蒙版全隐 | [PNG](evidence/layers/inner_shirt__right_sleeve__d21.png) |
| 22 | `inner_shirt/shirt_body` | `inner_shirt/shirt_body \| near \| d22` | `{e64044de-4dd1-4510-bc38-062edfd5633f}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/inner_shirt__shirt_body__d22.png) |
| 23 | `inner_shirt/shirt_collar/collar_base` | `inner_shirt/shirt_collar/collar_base \| near \| d23` | `{c4121cb2-56f5-4874-817b-0ea842a813da}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/inner_shirt__shirt_collar__collar_base__d23.png) |
| 24 | `pleated_skirt/skirt_body` | `pleated_skirt/skirt_body \| near \| d24` | `{18ec5e0c-cd44-45ce-978a-6634cfc49573}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/pleated_skirt__skirt_body__d24.png) |
| 25 | `pleated_skirt/waistband` | `pleated_skirt/waistband \| complete \| d25` | `{cfa95e5e-7469-41fb-b5ec-6870974b8938}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/pleated_skirt__waistband__d25.png) |
| 26 | `short_necktie/hanging_blade` | `short_necktie/hanging_blade \| complete \| d26` | `{ef80ec8a-8ce4-441f-bc3a-d6816614a33b}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/short_necktie__hanging_blade__d26.png) |
| 27 | `short_necktie/knot_and_attachment` | `short_necktie/knot_and_attachment \| complete \| d27` | `{04553e19-559a-40a3-bbc3-846b4f0868e2}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/short_necktie__knot_and_attachment__d27.png) |
| 28 | `inner_shirt/shirt_collar/left_collar_leaf` | `inner_shirt/shirt_collar/left_collar_leaf \| complete \| d28` | `{522a2d60-6d6d-4bee-9809-49ce8868ca81}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/inner_shirt__shirt_collar__left_collar_leaf__d28.png) |
| 29 | `inner_shirt/shirt_collar/right_collar_leaf` | `inner_shirt/shirt_collar/right_collar_leaf \| complete \| d29` | `{1afc9ee8-5750-4582-9e9d-71f84760b426}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/inner_shirt__shirt_collar__right_collar_leaf__d29.png) |
| 30 | `jacket_front_clasp/left_clasp_wing` | `jacket_front_clasp/left_clasp_wing \| complete \| d30` | `{133a0d6a-be41-4624-8034-39bdb9156a95}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/jacket_front_clasp__left_clasp_wing__d30.png) |
| 31 | `jacket_front_clasp/right_clasp_wing` | `jacket_front_clasp/right_clasp_wing \| complete \| d31` | `{b10fddaf-f4a0-46f8-9bd8-710375924ec0}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/jacket_front_clasp__right_clasp_wing__d31.png) |
| 32 | `outer_jacket/left_sleeve` | `outer_jacket/left_sleeve \| near \| d32` | `{975f8a53-72cd-4d9f-a48e-a47f9c946e5e}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__left_sleeve__d32.png) |
| 33 | `outer_jacket/right_sleeve` | `outer_jacket/right_sleeve \| near \| d33` | `{8bd254f1-e3c5-4bda-b5f3-9552c5895ad7}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__right_sleeve__d33.png) |
| 34 | `outer_jacket/jacket_body/left_front/front_panel` | `outer_jacket/jacket_body/left_front/front_panel \| complete \| d34` | `{b1f01629-aee1-4bd0-bef0-7772313408f7}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_body__left_front__front_panel__d34.png) |
| 35 | `outer_jacket/jacket_body/right_front/front_panel` | `outer_jacket/jacket_body/right_front/front_panel \| complete \| d35` | `{53ed8735-9b01-4161-b7cb-8af60f6b775c}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_body__right_front__front_panel__d35.png) |
| 36 | `outer_jacket/jacket_body/left_front/lapel` | `outer_jacket/jacket_body/left_front/lapel \| complete \| d36` | `{d0d277c3-7639-458a-bebe-d8a0d2f667ae}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_body__left_front__lapel__d36.png) |
| 37 | `outer_jacket/jacket_body/right_front/lapel` | `outer_jacket/jacket_body/right_front/lapel \| complete \| d37` | `{99ac81ac-c0e8-4df6-ab82-13c61e836b72}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_body__right_front__lapel__d37.png) |
| 38 | `outer_jacket/jacket_collar/left_collar_flap` | `outer_jacket/jacket_collar/left_collar_flap \| near \| d38` | `{c2db0fa9-841c-4447-b555-3691ffe295cd}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_collar__left_collar_flap__d38.png) |
| 39 | `outer_jacket/jacket_collar/right_collar_flap` | `outer_jacket/jacket_collar/right_collar_flap \| near \| d39` | `{245d9658-a1b2-47aa-84e7-6748f56035ba}` | 前侧 / 近侧；实际层像素自然遮挡 | [PNG](evidence/layers/outer_jacket__jacket_collar__right_collar_flap__d39.png) |
| 40 | `jacket_front_clasp/center_buckle` | `jacket_front_clasp/center_buckle \| complete \| d40` | `{4a8d5063-93b1-445d-8da8-877722e35ae0}` | 完整单片；实际层像素自然遮挡 | [PNG](evidence/layers/jacket_front_clasp__center_buckle__d40.png) |

## 区域、分界、前后对象和拆深度原因

已通过 edit_occlusion 保存完整有效深度表到 `clothing-part-layering/occlusion.json`，version=3、direction=back-to-front，覆盖全部 23 个逻辑衣片和 32 个深度区域。原逻辑 ID、归属树和 SVG 未改动。拆分仅表达同一衣片的不同绘画深度，不合并已分开的前后衣片。以下区域说明与当前上游深度表一致。

### `outer_jacket/jacket_body/back_panel`

完整肩背至下摆的连续背料，位于 inner_shirt/shirt_body 两个绘画深度及两外套前衣片之后。实际层 outer_jacket/jacket_body/back_panel | complete | d1；原生全黑透明度蒙版附于本绘画层，默认完整投影隐藏，解除时保留全幅白色背料、褶皱和衣摆线。开襟与颈口不会被背料封住。

检查：已独显查看完整背料及整圈轮廓，并切换本层原生蒙版：启用为空，关闭后完整衣片可见；默认整图没有开襟或颈口泄漏。深度1在所有衣服层之后。

### `inner_shirt/shirt_body`

同一逻辑 part 保留两个独立普通绘画层。后面完整布面单独生成，前面保留原生成门襟；后面通过原生蒙版控制默认隐藏，前面以实际层序完成局部遮挡。完整布面不混入折领、领带、外套或人体内容。

- d2：完整独立生成的衬衫肩背和躯干后侧布面，在现有衣身投影内补足连续深蓝衣料，不带前门襟或纽扣。实际层 inner_shirt/shirt_body | far | d2，在 outer_jacket/jacket_body/back_panel 之前、同 ID 前面 d22 之后；与前面沿肩侧、袖窿和腰侧回转连接，不另造背视轮廓。所属独立深度组的原生全黑透明度蒙版默认整体隐藏，颈口保持真实开口。

- d22：完整肩前、胸腹门襟和下端前衣料。实际层 inner_shirt/shirt_body | near | d22；压住 inner_shirt/left_sleeve d20 与 inner_shirt/right_sleeve d21 的袖根，位于 collar_base 前座d23、裙腰d25、领带、折领、扣带与外套前衣片之后。肩侧和腰侧为前后回转分界；默认通过上层衣片的真实像素遮挡肩根、侧边及下端，保留中央门襟。

检查：逐层独显和隐藏上层检查了肩背补全、门襟、下端及整圈边；后片无纽扣和门襟鬼影，前片连续。蒙版切换已核对，默认整图开襟只显示前门襟。

### `outer_jacket/jacket_collar/collar_root`

完整隐藏后领连接布料，位于 outer_jacket/jacket_body/back_panel、inner_shirt/shirt_body 后面之前，两白翻领的后根和 inner_shirt/shirt_collar/collar_base 后领之后。实际层 outer_jacket/jacket_collar/collar_root | complete | d3，原生全黑透明度蒙版附于本层，默认整体隐藏。解除蒙版可见完整白色折根、内侧曲面和外圈细线。

检查：已独显检查全片白色连续折根并切换原生蒙版；默认不封颈口，原始隐藏纹理完整。深度3与两独立前后翻领分片相容。

### `outer_jacket/jacket_collar/left_collar_flap`

同一翻领按颈侧真实回转拆为两个普通绘画层，没有按明暗拆衣片。保留完整生成轮廓与青色包边，修正直切断口和孤立残片；实际局部显隐由后领及前领层序完成。

- d4：画面右侧白翻领颈侧卷根及后向回转，实际层 outer_jacket/jacket_collar/left_collar_flap | far | d4。分界沿内缘曲线：起点(638,270)，经(640,280)、(646,290)、(653,301)至(660,315)，曲线内侧为后根；保留约1.5px同片搭接。位于 collar_root d3之前、collar_base 后领d10及同 ID前领d38之后。默认后领和前领的实际层像素遮挡卷根。

- d38：由颈侧回转向肩胸翻出的完整白领面和领尖，实际层 outer_jacket/jacket_collar/left_collar_flap | near | d38。位于 inner_shirt/shirt_collar/left_collar_leaf、outer_jacket/jacket_body/left_front/front_panel 和 left_front/lapel 之前；上根与d4沿上述弯曲内缘连接。下方驳头仍归独立 lapel，颈口保持透明。

检查：已查看后根、前面独显及同片合看，卷根连续，前面没有直切缺口或残片；默认领口与纯衣服参考和穿衣角色对照通过。

### `outer_jacket/jacket_collar/right_collar_flap`

同片两个普通绘画深度，按颈侧折根而非颜色分界。保留白领生成画面、外圈线与青色细包边，默认由实际前后层自然遮挡回转根。

- d5：画面左侧白翻领短后根和颈侧回转，实际层 outer_jacket/jacket_collar/right_collar_flap | far | d5。分界曲线从(500,270)，经(501,277)、(497,287)、(498,298)、(499,309)至(506,322)，其内侧短卷根归后深度；留约1.5px同片搭接。位于 collar_root d3之前、collar_base 后领d10及同 ID前面d39之后。

- d39：画面左侧完整白色前翻领、领尖和前折根，实际层 outer_jacket/jacket_collar/right_collar_flap | near | d39。由上述颈侧曲线连续转到前面，压住 inner_shirt/shirt_collar/right_collar_leaf、outer_jacket/jacket_body/right_front/front_panel 和 right_front/lapel 的实际搭接；驳头仍独立，中央颈口不封闭。

检查：已查看后根、前面独显、同片连续性及领口放大，前片连续且没有孤立鬼影；领尖与独立驳头相接。

### `outer_jacket/left_sleeve`

袖口按穿衣参考收拢，前后内壁与袖带分层，保留真实窄开口。只含本袖白布、青色条带和自身褶皱，不画手臂或由手臂投下的投影。

- d6：画面右袖收拢口内的远侧内壁和后缘，实际层 outer_jacket/left_sleeve | far | d6。分界沿袖口椭圆回转曲线 M818,650 C842,623 913,580 934,575 C935,594 849,654 818,650，保留约1.5px同片搭接。位于 inner_shirt/left_sleeve 远侧d8与本袖近側d32之后；窄真实透明口保留，内壁不是封口平面。

- d32：完整肩前袖身、青色宽袖口带及近侧衣缘，实际层 outer_jacket/left_sleeve | near | d32，位于 inner_shirt/left_sleeve 近侧d20之前、outer_jacket/jacket_body/left_front/front_panel d34之后。袖口与d6沿上述椭圆两端回转连续。肩根约x776–817、y354–390已局部修平突出尖角并用原生笔刷接顺外圈线；默认根部由前衣片遮挡。

检查：已独显前后片、同片合看、放大袖口与肩缝，并对照穿衣角色；袖口内壁连续、开口透明，肩缝无突出尖角或空隙。

### `outer_jacket/right_sleeve`

袖身、袖带及固定标识保持同一逻辑 part，按穿衣时收拢袖口制作远内壁和窄开口；不包含人体、相邻袖或前衣片的像素。

- d7：画面左袖收拢口内的远侧内壁和后缘，实际层 outer_jacket/right_sleeve | far | d7。分界为 M207,563 C221,551 327,618 337,647 C324,660 219,599 207,563，留约1.5px同片搭接。位于 inner_shirt/right_sleeve 远側d9与本袖近侧d33之后，真实透明口保持，不补封口平面。

- d33：完整肩前白色袖身、固定青色椭圆标识、宽袖口带和近侧衣缘，实际层 outer_jacket/right_sleeve | near | d33。位于 inner_shirt/right_sleeve 近侧d21之前、outer_jacket/jacket_body/right_front/front_panel d35之后；沿上述袖口内缘及两端回转与d7相接。根部由同侧前衣片自然遮挡。

检查：前后独显、同片合看及袖口放大均已检查；包边和内壁连续，开口透明，标识与本袖归属一致。

### `inner_shirt/left_sleeve`

hiddenInReference 袖片保留两个普通绘画分片，各自深度组附原生全黑透明度蒙版，默认整体隐藏。解除蒙版可检查完整袖身、袖口内壁及真实开口；没有外套或手臂像素。

- d8：完整内搭袖口的远侧内壁与后衣缘，实际层 inner_shirt/left_sleeve | far | d8。分界曲线 M781,579 C792,554 841,513 856,515 C874,521 815,586 781,579，留约1.5px搭接。位于 outer_jacket/left_sleeve 远侧d6之前、本 ID近侧d20之后。独立深度组原生全黑透明度蒙版默认全隐。

- d20：完整肩前内搭袖身和近侧袖口，实际层 inner_shirt/left_sleeve | near | d20。位于同 ID远侧d8之前、inner_shirt/shirt_body 前面d22和 outer_jacket/left_sleeve 近侧d32之后，沿上述袖口两端回转连续。独立深度组原生全黑透明度蒙版默认全隐，完整深蓝衣料与真实透明口保留。

检查：两分片逐层独显、合看及原生蒙版切换已检查；完整纹理保留，默认合成不从外套袖口露出内搭封口。

### `inner_shirt/right_sleeve`

hiddenInReference 袖片保留完整生成深蓝袖布，初次生成封口已针对开口重新生成后才拆层。两个普通绘画层各有所属深度组原生隐藏蒙版，默认全隐，原始纹理和透明口可检查。

- d9：完整内搭袖口远侧内壁、后缘与回转，实际层 inner_shirt/right_sleeve | far | d9。分界 M271,518 C287,507 354,548 383,583 C370,605 282,553 271,518，留约1.5px搭接。位于 outer_jacket/right_sleeve 远側d7之前、本 ID近側d21之后；独立组原生全黑透明度蒙版默认全隐。

- d21：完整内搭肩前袖身、近側袖口和衣缘，实际层 inner_shirt/right_sleeve | near | d21。位于同 ID远側d9之前、inner_shirt/shirt_body 前面d22及 outer_jacket/right_sleeve 近側d33之后。与d9沿袖口内缘和两端回转连接；独立组原生全黑透明度蒙版默认全隐。

检查：已逐层查看前后布料及同片合看，并切换两组原生蒙版；重新生成后真实透明口完整，无人体填色或外套鬼影。

### `inner_shirt/shirt_collar/collar_base`

同一领座保留两个普通绘画深度，后领和前座共同形成连续领口，未新增独立领座节点。顶缘凸起、前座浮线及局部接头已在已有画面上修整；右回转接头以原生笔刷逐笔补足，保留生成纹理与真实开口。

- d10：完整后领弧及后侧颈根，实际层 inner_shirt/shirt_collar/collar_base | far | d10。后领分界为 M493,270 L649,270 L649,292 C647,301 646,311 643,318 C608,311 564,310 530,315 L501,292 L493,289 Z；右颈侧回转约x635–656、y295–327局部延续归后层，原生笔刷按同片颜色补足接头。位于 collar_root d3、两白翻领后根d4/d5之前，同 ID前座d23之后；后领下内缘界定真实颈口，不填封口。

- d23：两折领根下的完整前领座、中央窄承接及前侧回转，实际层 inner_shirt/shirt_collar/collar_base | near | d23。位于 inner_shirt/shirt_body 前面d22之前，short_necktie/knot_and_attachment d27、两折领d28/d29和外套前翻领d38/d39之后。与d10在两侧颈根回转连接；已清理分片上缘浮线和凸点，完整颈口保持透明，搭接由上层实际衣片自然遮挡。

检查：已独显前后片、隐藏折领和外套翻领检查完整领座，并放大同片合看与整图领口。右回转接头连续，前座没有后领浮线，颈口透明。

### `pleated_skirt/skirt_body`

同一裙身两个独立普通绘画深度。后裙补成完整连续内布面，前裙保留原生成主体及全部条带、标识和前侧描边；后料不只是窄边条。通过前裙实际像素遮住后片重叠区域，参考可见蓝后缘默认保留，真实裙口不封底。

- d11：在既有裙身投影x164–983、y700–1122内独立生成完整连续后侧内布面及蓝色内后摆。实际层 pleated_skirt/skirt_body | far | d11，在同 ID前裙d24之后；默认只有前裙自由边以下蓝色内后缘露出，其余由前片像素遮挡。自由边分界从(171,1019)经(271,1034)、(371,1055)、(471,1085)、(617,1104)、(771,1094)、(871,1077)至(977,1050)，沿真实褶片台阶与两侧回转，不沿青色条带切。后面无青条、三角标识、腰带或裙底封口。

- d24：完整前褶裙面、近侧自由边、青色条带和画面右侧三角标识，实际层 pleated_skirt/skirt_body | near | d24。位于同 ID后裙d11之前、pleated_skirt/waistband d25及两外套前衣摆d34/d35之后。腰根完整补全，前自由边按上述路径拆开，x343–352、447–456、838–849的细尾尖刺已局部去掉，曲线以亚像素边界接顺；与后缘在两侧回转。

检查：已逐层查看完整后布面和前裙，隐藏前裙检查后侧补全，并放大同片合看、自由边及裙腰。前片尖刺修整后独显干净，青条和标识仅在前片，后缘接色连续。

### `pleated_skirt/waistband`

完整贴腰带，实际层 pleated_skirt/waistband | complete | d25，覆盖 inner_shirt/shirt_body 前面下端d22和 pleated_skirt/skirt_body 前面根部d24；两侧延伸位于外套两前衣摆d34/d35之后。腰带贴合连续，无需要单独深度的敞开后腰口；默认通过外套前片自然遮住侧端，完整隐藏料保留。

检查：已独显查看完整腰带、上下外圈细线和侧端补全，并放大裙腰合成；腰根没有空隙、重复线或硬拼接。单深度25相容。

### `short_necktie/hanging_blade`

完整短菱形垂片，实际层 short_necktie/hanging_blade | complete | d26，位于 inner_shirt/shirt_body 前面d22之前、小结short_necktie/knot_and_attachment d27之后。上根完整延伸被小结自然压住，固定银灰色块、细外缘和自身明暗完整，单深度独立控制。

检查：已独显查看垂片全轮廓和上根，并放大领带合成；小结与垂片没有缺口，未混入折领或衬衫像素。

### `short_necktie/knot_and_attachment`

完整小结及短上接段，实际层 short_necktie/knot_and_attachment | complete | d27，覆盖 hanging_blade d26上根，位于 inner_shirt/shirt_collar/left_collar_leaf d28和 right_collar_leaf d29之后。上接段从两领片中央缺口进入，真实搭接由折领像素遮挡，小结主体显示；不另扩展环颈带。

检查：已独显查看完整小结和接段，并放大两折领缺口；结面、上接段及垂片衔接连续，单深度27满足实际覆盖。

### `inner_shirt/shirt_collar/left_collar_leaf`

画面右侧完整前折领，实际层 inner_shirt/shirt_collar/left_collar_leaf | complete | d28，由对侧 right_collar_leaf 在 Krita 中镜像并三点配准复用。覆盖 collar_base 前座d23及 knot_and_attachment d27进入段，外侧根在 outer_jacket/jacket_collar/left_collar_flap 前面d38之后；短翻折下表面仍属本片，颈后回转由 collar_base承担。

检查：已独显查看领面、内外缘和隐藏根部，并合看两领片；镜像后保持左右比例、材质和颜色协调，中央领口与领带缺口开放，未盖掉整条领带。

### `inner_shirt/shirt_collar/right_collar_leaf`

画面左侧完整前折领，实际层 inner_shirt/shirt_collar/right_collar_leaf | complete | d29。覆盖 collar_base 前座d23及 knot_and_attachment d27上接段，外侧根位于 outer_jacket/jacket_collar/right_collar_flap 前面d39之后；前领面和短翻折下表面同层，后领座回转由独立 collar_base深度承担。默认搭接用实际上层像素遮挡。

检查：已独显查看全领面、细轮廓和隐藏根，并放大领口；布面连续，领尖保持本片，中央小结和真实颈口仍露出，单深度29相容。

### `jacket_front_clasp/left_clasp_wing`

画面右側完整扣带翼，实际层 jacket_front_clasp/left_clasp_wing | complete | d30，在 Krita中镜像 right_clasp_wing并三点配准复用。位于 inner_shirt/shirt_body 前面d22之前、outer_jacket/jacket_body/left_front/front_panel d34和 jacket_front_clasp/center_buckle d40之后。外端与中央收束端完整延伸，由前片和扣件实际像素遮住搭接，带面默认显示。

检查：已独显检查完整白色带料、细外缘及两个隐藏端，放大扣带合成；接头无缺口、鬼线或相邻衣片像素，镜像配准后的布面和自身褶皱连续。

### `jacket_front_clasp/right_clasp_wing`

画面左側完整扣带翼，实际层 jacket_front_clasp/right_clasp_wing | complete | d31。位于 inner_shirt/shirt_body 前面d22之前、outer_jacket/jacket_body/right_front/front_panel d35及 jacket_front_clasp/center_buckle d40之后；外端、扣下搭接完整补足，生成的扣下缺口已重新生成修复，默认通过前片和扣件像素自然遮挡。

检查：已独显查看完整翼片及扣下补全区，并放大扣带合成；缺口已补平，轮廓、颜色和细边连续，单深度31满足实际覆盖。

### `outer_jacket/jacket_body/left_front/front_panel`

画面右侧完整外套承载前片，实际层 outer_jacket/jacket_body/left_front/front_panel | complete | d34。覆盖 inner_shirt/shirt_body 前面d22、裙前d24、裙腰d25、left_clasp_wing d30外端及 outer_jacket/left_sleeve d32根部；位于同侧 left_front/lapel d36和 left_collar_flap前面d38之后。固定胸标识、口袋包边和布面褶皱均归本片，后料由独立 back_panel承担。

检查：已独显查看完整前片、驳头下补全、肩根与衣摆，并放大肩袖缝、驳头和裙腰合成；错误黄色补全已重新生成去除，布面连续，固定胸标识归属正确。

### `outer_jacket/jacket_body/right_front/front_panel`

画面左侧完整外套承载前片，实际层 outer_jacket/jacket_body/right_front/front_panel | complete | d35。覆盖 inner_shirt/shirt_body 前面d22、裙前d24、裙腰d25、right_clasp_wing d31外端及 outer_jacket/right_sleeve d33根部；位于 right_front/lapel d37和 right_collar_flap前面d39之后。肩胸至衣摆及驳头下隐藏料连续，固定青色点与口袋边归本片，中央开襟保留。

检查：已独显查看全前片和整圈轮廓，隐藏驳头检查下料，并放大衣身接缝；门襟、衣摆和口袋包边连续，无相邻片或人体像素。

### `outer_jacket/jacket_body/left_front/lapel`

画面右侧完整胸前驳头，实际层 outer_jacket/jacket_body/left_front/lapel | complete | d36，由 right_front/lapel在Krita镜像并三点配准复用。位于 left_front/front_panel d34之前、left_collar_flap前面d38之后；完整短折根、白领面、青色自由边和尖角都归本片，上端搭接由白翻领像素自然遮挡。

检查：已独显检查驳头全轮廓和隐藏折根，并放大翻领、驳头、前片衔接；包边保留完整，配准没有裁细线或拉坏尖角，单深度36相容。

### `outer_jacket/jacket_body/right_front/lapel`

画面左侧完整胸前驳头，实际层 outer_jacket/jacket_body/right_front/lapel | complete | d37。位于 right_front/front_panel d35之前、right_collar_flap前面d39之后；短上接段、完整白色翻出面和青色自由边连续，上端由白翻领自然遮挡，下料仍由独立前片承担。

检查：已独显查看完整驳头及细包边，并放大同侧前片和翻领连接；没有多余空隙、断线或他片像素，单深度37满足实际形体。

### `jacket_front_clasp/center_buckle`

完整中央圆角方扣，实际层 jacket_front_clasp/center_buckle | complete | d40，覆盖 left_clasp_wing d30与 right_clasp_wing d31的中央收束端，位于 inner_shirt/shirt_body 前面d22之前，当前不与两外套前片交叉。扣面固定纹样、金属边和自身明暗同层；无真实孔洞，不臆造开孔。

检查：已放大独显完整扣件、圆角外缘和固定纹样，并查看扣带合成；两翼接在扣下，扣面干净，最高单深度40成立。

## 原生蒙版、所属组与控制证据

整体隐藏的外套背片、后领根，以及两内搭袖的四个深度分片，都保留完整底层纹理和原生透明度蒙版；新生成的衬衫背面也用同样的原生控制。共 7 个全黑蒙版，默认全部启用。5 个组分别承载衬衫背面、两内搭袖的前后深度分片；另 2 个蒙版直接附属于外套背片和后领根绘画层。无需额外剪贴关系。

每个蒙版控制其所属深度分片的完整投影；禁用蒙版后显示原始连续衣料，重新启用后恢复默认全隐。开口来自衣片自身透明度，切换蒙版不会填进人体或布面。普通局部隐藏搭接由实际前层像素自然遮挡。导出的整图使用全部蒙版启用状态。

| part ID / 深度 | 蒙版名 / UUID | 所属绘画层或组 / UUID | 控制与切换证据 |
| --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` / d1 | `outer_jacket/jacket_body/back_panel \| default hidden`<br>`{1114f839-db15-40dd-a7e3-1b52d083e245}` | `outer_jacket/jacket_body/back_panel \| complete \| d1`<br>`{d65980d6-ab8f-494f-bd94-680b5b363881}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/outer_jacket__jacket_body__back_panel__d1__default.png) / [关闭](evidence/layers/outer_jacket__jacket_body__back_panel__d1__mask-off.png) |
| `inner_shirt/shirt_body` / d2 | `inner_shirt/shirt_body \| default concealed \| d2`<br>`{e3788cde-d110-4303-8428-6bb36de5c26f}` | `inner_shirt/shirt_body \| visibility control \| d2`<br>`{8fc6e546-e307-4676-9453-0ded6ec52c07}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/inner_shirt__shirt_body__d2__default.png) / [关闭](evidence/layers/inner_shirt__shirt_body__d2__mask-off.png) |
| `outer_jacket/jacket_collar/collar_root` / d3 | `outer_jacket/jacket_collar/collar_root \| default hidden`<br>`{020b5612-5197-41af-8e41-016116b0089e}` | `outer_jacket/jacket_collar/collar_root \| complete \| d3`<br>`{d5126161-e3cf-4e12-a122-dda79e6651af}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__default.png) / [关闭](evidence/layers/outer_jacket__jacket_collar__collar_root__d3__mask-off.png) |
| `inner_shirt/left_sleeve` / d8 | `inner_shirt/left_sleeve \| default concealed \| d8`<br>`{73139073-0388-49fc-9523-c45480c8bca8}` | `inner_shirt/left_sleeve \| visibility control \| d8`<br>`{39bed1a5-07a1-48a4-8e3b-cc10483b51a3}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/inner_shirt__left_sleeve__d8__default.png) / [关闭](evidence/layers/inner_shirt__left_sleeve__d8__mask-off.png) |
| `inner_shirt/right_sleeve` / d9 | `inner_shirt/right_sleeve \| default concealed \| d9`<br>`{c9fa2eb0-a701-4ab0-9111-1d3063c0c0e8}` | `inner_shirt/right_sleeve \| visibility control \| d9`<br>`{dc42b4f3-eb54-4ab0-aa2e-59a7cc800302}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/inner_shirt__right_sleeve__d9__default.png) / [关闭](evidence/layers/inner_shirt__right_sleeve__d9__mask-off.png) |
| `inner_shirt/left_sleeve` / d20 | `inner_shirt/left_sleeve \| default concealed \| d20`<br>`{7c4217ee-4f04-41c9-b1e6-7ddfd9e8d2fc}` | `inner_shirt/left_sleeve \| visibility control \| d20`<br>`{73eb42ba-5a77-4d33-a876-bc00c38e46f3}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/inner_shirt__left_sleeve__d20__default.png) / [关闭](evidence/layers/inner_shirt__left_sleeve__d20__mask-off.png) |
| `inner_shirt/right_sleeve` / d21 | `inner_shirt/right_sleeve \| default concealed \| d21`<br>`{a93743a6-fc70-4142-8b46-3626dd4e6344}` | `inner_shirt/right_sleeve \| visibility control \| d21`<br>`{3872ef39-e996-49f5-a3cb-46e881306d54}` | 完整分片投影；默认启用全隐、关闭完整可见。[启用](evidence/layers/inner_shirt__right_sleeve__d21__default.png) / [关闭](evidence/layers/inner_shirt__right_sleeve__d21__mask-off.png) |

蒙版切换逐层看图，确认启用时透明、关闭时完整布面可见；原像素未被擦除。[蒙版检查 1](evidence/mask-sheet-1.jpg)、[蒙版检查 2](evidence/mask-sheet-2.jpg)。机器记录 [provenance-and-mask-checks.json](evidence/provenance-and-mask-checks.json) 同时保存蒙版所有者、UUID、控制范围和 PNG 证据；alpha 检查仅核对显隐行为，绘画质量仍以看图验收。

## 本步核实并修好的问题

| 问题 | 已完成修正与检查 | 证据 |
| --- | --- | --- |
| 生成补全混入黄色、外套承载前片补全不连续 | 对有问题的前片局部重新生成，保留连续白色布面与本片固定标识；隐藏驳头看下料、独显看肩胸至衣摆。 | [逐层独显 6](evidence/solo-sheet-6.jpg)、[逐层独显 7](evidence/solo-sheet-7.jpg) |
| 扣带中央补全缺口 | 重新生成完整带翼，保留两端隐藏搭接，镜像复用另一侧并配准；扣下接头无缺口。 | [扣带放大](evidence/clasp-detail.png) |
| 内搭袖被生成封口 | 采用保留真实透明口的重新生成版本，拆近侧布面和远侧内壁，检查同片合看及蒙版关闭状态。 | [同片连续性 3](evidence/continuity-sheet-3.jpg)、[蒙版检查 2](evidence/mask-sheet-2.jpg) |
| 袖口、白翻领和领座用单层时无法表达回转深度 | 沿真实袖口内壁和领根曲线拆为同 ID 的 far/near 普通绘画层；保留约 1.5px 隐藏搭接和原生成轮廓。 | [同片连续性 1](evidence/continuity-sheet-1.jpg)、[同片连续性 2](evidence/continuity-sheet-2.jpg)、[左右袖口](evidence/left-cuff-detail.png) |
| 裙后只有窄边、前侧纹样误入后布面 | 裙后独立生成完整连续内布面，前裙保留条带、三角标识和前侧包边；沿真实前自由边拆深度。 | [后裙独显](evidence/layers/pleated_skirt__skirt_body__d11.png)、[同片连续性 3](evidence/continuity-sheet-3.jpg) |
| 前裙拆边细尾尖刺和亚像素硬边 | 局部去掉细尾，平滑拆边路径并以亚像素边界重分片；完整外圈包边仍在前裙。 | [前裙当前独显](repair-01-evidence/R9/d24-solo.png)、[前裙当前合成](repair-01-evidence/R9/composite.png) |
| 画面右侧袖根多出突出尖角 | 在已有袖片局部清理，保留自己的袖窿轮廓并检查独显及与前片合成。 | [肩袖当前独显](repair-01-evidence/R3/d32-solo.png)、[肩袖当前合成](repair-01-evidence/R3/composite.png) |
| 前领座凸点、浮线及右侧回转接头断续 | 局部原生选区清理凸点和后缘鬼线；接头用 Krita Basic-2 Opacity 按同片颜色逐笔补足并限制在原 alpha 内，保留颈口透明。每次修整均看同片和合成接色。 | [领座当前检查](repair-01-evidence/R6/three-views.png)、[领口放大](evidence/collar-detail.png) |
| 5 个隐藏绘画节点曾未挂入显隐组 | 将原绘画节点重新附回对应原生组，保持 UUID 和底层纹理，检查蒙版关闭时有完整画面。最终递归结构和重开验证均确认 32 个绘画层真实在文档内。 | [蒙版检查 1](evidence/mask-sheet-1.jpg)、[蒙版检查 2](evidence/mask-sheet-2.jpg)、[重开验证](evidence/reopen-verification.json) |

## 对照结论、必要形体差异与验收

每层只包含所属衣片；胸标、袖上椭圆、口袋口和裙条带随承载衣片保留，领带、扣带和扣件仍各自独立。未发现人体像素、邻片鬼影、他物投影、补全脏色或归属遗留冲突。纯衣服参考的颜色、色块、标识、包边与褶皱均已绘出；后侧隐藏料依据 SVG 和衣物连续性补足。本步保留各片生成绘画，不以数字相似度替代视觉验收。

与上游 SVG / 色块轮廓的必要差异：袖口按原穿衣角色收拢，内壁完整且保留窄透明口，不照搬纯衣服图的空心大张口；袖口、领根和裙自由边按实际绘画曲线拆深度；配准保留生成外圈细线，局部去除生成或拆边尖刺。裙后使用完整同投影内布面承接回转，默认只露出参考中的蓝色内后摆，其余由前裙自然覆盖。上述差异服务于实际穿着形体和分层连续性，逻辑衣片归属未改动，未发现未解决的层级冲突。

逐层独显均已看图：

- [独显检查 1](evidence/solo-sheet-1.jpg)
- [独显检查 2](evidence/solo-sheet-2.jpg)
- [独显检查 3](evidence/solo-sheet-3.jpg)
- [独显检查 4](evidence/solo-sheet-4.jpg)
- [独显检查 5](evidence/solo-sheet-5.jpg)
- [独显检查 6](evidence/solo-sheet-6.jpg)
- [独显检查 7](evidence/solo-sheet-7.jpg)
- [独显检查 8](evidence/solo-sheet-8.jpg)

隐藏上层检查补全及整圈轮廓、同片前后合看：

- [同片连续性 1](evidence/continuity-sheet-1.jpg)、[2](evidence/continuity-sheet-2.jpg)、[3](evidence/continuity-sheet-3.jpg)
- [领口](evidence/collar-detail.png)、[画面左袖口](evidence/left-cuff-detail.png)、[画面右袖口](evidence/right-cuff-detail.png)
- [扣带](evidence/clasp-detail.png)、[裙腰](evidence/waist-detail.png)、[裙摆](evidence/hem-detail.png)

最终整图与纯衣服参考及原穿衣角色对照：比例和位置与衣服控制范围相符；颈口、袖口透明；肩袖缝、翻领与驳头缺口、领座回转、扣带收束、裙腰和裙自由边在原尺寸及放大下衔接连续。没有发现本步仍需修复的空隙、断口、重复线、尖刺或接色断层。



## review-01 修复历史

已逐项修复 R1–R9，并修正最终检查发现的右肩尖头、肩端半透明残边及方扣下缘残点。此节保留前轮处理历史；本轮再次发现的遗留问题及当前修画来源见 review-02 当前有效记录。原生成主体保留，局部采用重新生成、本片参考取样及 Krita 原生画笔；归属、23 个逻辑 ID、32 个深度区域及 7 个显隐蒙版不变。

| 项目 | 当前修复与复验 | 三视图证据 |
| --- | --- | --- |
| R1 / d33、d7 | 采用三色控制图局部重新生成 d33 下半白布，保留原生成主体；本袖带参考取样恢复连续青色渐变，修顺与白布的过渡。d7 远侧内壁、窄透明口和两端回转保留。<br>复验：袖带无原来的不规则斑块，白布改回较舒缓折面；两深度合看袖口收拢，开口透明，无人体像素。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R1/three-views.png) |
| R2 / d33、d35 | 沿本片归属限制的参考取样分别修 d33/d35，补顺各自接边布面，原外边收进搭接；上段恢复单条浅蓝缝，下段自然转为深线。<br>复验：两片独显完整；合成不再同时露出平行黑边，肩端到腋下无线宽突变或新缺口。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R2/three-views.png) |
| R3 / d32、d34 | 协同修 d32/d34 的接边及本片参考线条，保留袖口前后料。额外清掉 d34 肩端取样越出原 alpha 的半透明轮廓；最终复核又修掉 d32 约 (784,352) 的高出尖头，用原生曲线选区沿已有外线收顺。<br>复验：上段蓝缝、下段深线连续；各片归属干净；肩部外轮廓平顺，无尖头、突出残边或重叠粗线。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R3/three-views.png) |
| R4 / d34、d36 | 在 d34 清除旧标识鬼影，按本片参考取样恢复三角标、圆点、黄绿青渐变与完整内外轮廓；d36 驳头位置和深度未改。<br>复验：三角标恢复参考位置及比例，完整露出，与驳头之间有白布留白；独显没有重复旧标。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R4/three-views.png) |
| R5 / d22、d2 | 按三色控制重新生成完整下半本衬衫布面，用相似变换配准后接回原上衣料。参考取样恢复约 (643,588)、(644,623)、(648,666) 三扣；Krita 原生画笔逐笔将两条弯曲门襟延至隐藏下摆。清理生成与旧线叠边，仅用本衬衫布面材料融色。<br>复验：默认可见段三扣齐全，位置和间距恢复；门襟弯曲、不断线，独显下半连续。废弃的梯形/矩形试样及其色块边、重复纹样、漂移圆点均不在最终层内。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R5/three-views.png) |
| R6 / d23、d10 | 用原生选区删除 d23 约 (649,294) 的分离残点，并以本领座笔触修顺附着尖端；d10 后领座保持完整。<br>复验：d23 原尺寸与放大独显无游离点；同片合看回转连续，颈口仍透明。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R6/three-views.png) |
| R7 / d5、d39 | 按同一回转曲线修 d5/d39 顶端，去掉高出方头；本片参考取样沿内缘融接，并清掉取样区硬边。后根窄衣料和搭接均保留。<br>复验：独显各片完整；合看及默认合成上缘平顺，内缘接色、线宽连续，没有封颈口。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R7/three-views.png) |
| R8 / d40、d30、d31 | 按参考重做 d40 的较小圆角方扣、边框和金属明暗；d30/d31 带翼未动。额外清理下边缘残点，以扣件自身邻近笔触取样接顺。<br>复验：扣件大小及收束比例恢复，四角圆润；独显无下缘黑点，两翼各自独立且在扣下自然搭接。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R8/three-views.png) |
| R9 / d24、d11 | 在 d24 原 alpha 内用本片深色包边笔触接顺，再以弯曲原生选区清掉附带蓝边和下凸刺；d11 完整蓝色后裙不改。<br>复验：d24 独显下缘干净，深包边连续；同片及默认合成蓝后缘仍由 d11 承担，无新缝隙。 | [独显／隐藏上层／合看及合成](repair-01-evidence/R9/three-views.png) |

R1 新生成源：`generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_XlpxzgLT4NeJ7OpE3TKoyCeZ.png`；[三色控制](repair-01-evidence/final-sources/R1-control.png)、[灰底参考输入](repair-01-evidence/final-sources/R1-reference.png)、[生成画面](repair-01-evidence/final-sources/R1-generated.png)。

review-01 R5 当轮采用源：`generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_84KoETDPYt2RzFjE2dKSRZJC.png`；[三色控制](repair-01-evidence/final-sources/R5-control.png)、[灰底参考输入](repair-01-evidence/final-sources/R5-reference.png)、[生成画面](repair-01-evidence/final-sources/R5-generated.png)、[配准记录](repair-01-evidence/final-sources/R5-registration.json)。下半衣料输入为原画布 (420,450)–(790,750) 的 3 倍裁图；相似配准采用均匀比例 0.2671011279433142，保持材质和线条比例。门襟下端逐笔延续，Basic-2 Opacity，4.3px，#101c37，opacity 0.98。取样仅属于本衬衫，未引入扣带、外套边线或它们的投影。

review-01 当轮没有结构变更，无需再次调用 edit_groups / edit_occlusion；其上游文件与当轮 review 时一致，[归属与深度核对](repair-01-evidence/structure-verification.json)。最终图层 UUID、来源与蒙版检查已同步至 [当前图层记录](evidence/layer-records.json) 和 [绘画来源与蒙版证据](evidence/provenance-and-mask-checks.json)。

[最终整图对照](repair-01-evidence/reference-vs-final.png)；完整 32 个隐藏上层导出与 23 个逻辑衣片合看见 [检查索引](repair-01-evidence/inspection/manifest.json)。全部独显、隐藏上层、同片合看及 7 个蒙版两状态均已实际看图；保存重开无变化，详见 [本轮重开验证](repair-01-evidence/reopen-verification.json)。

## review-02 修复后的当前有效记录

本轮 R1–R6 全部修复，并修正过程中发现的接边半透明残线、肩端缺口、右前片下缘小刺及扣翼遮挡的开襟上端缺口。实际改画像素为 d22、d33、d34、d35、d38；其余 27 个绘画分片未改。前后分片、归属、深度区域、原生蒙版及显隐组保持。

### R1 — 衬衫下半亮褶面

处理：按三色控制图重新生成本衬衫下半布料，以均匀比例 0.19、平移 [469.96,545.1] 配准。只接入门襟两侧布面内部，宽羽化位于同片衣料内；原三扣、弯曲门襟及外围轮廓保留。最终采用生成材料，早期叠加参考布面的双暗褶试样已恢复并弃用。

复验：d22 独显、停用蒙版并隐藏更高层、d2/d22 合看和默认合成均已查看。原来的密集尖斜暗面改成宽蓝灰亮褶，下腹回转圆润；三扣间距和门襟连续，可见段没有替换硬边或拼贴色块。d2 后布面未改。

[三视图及合看](repair-02-evidence/R1/three-views.png)；[d22 独显](repair-02-evidence/R1/d22-solo.png)；[d22 隐藏上层](repair-02-evidence/R1/d22-uncover.png)；[d2 独显](repair-02-evidence/R1/d2-solo.png)；[d2 隐藏上层](repair-02-evidence/R1/d2-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R1/same-parts.png)；[默认整图](repair-02-evidence/R1/composite.png)。

### R2 — 左袖带上缘断续黑线

处理：在原生成袖片上沿自身白布与青带接边，使用 Krita Basic-2 Opacity、3.8px、#188eb6 分段画连续蓝弧线，顺接至袖带末端。保留原白布、青带明暗和收拢形体。

复验：d33 独显、隐藏更高层、d7/d33 合看及整图在原尺寸与放大下复查。接边无原断续黑串、白点或线宽突变，白布至青带接色连续；窄透明口与 d7 内壁保持。

[三视图及合看](repair-02-evidence/R2/three-views.png)；[d33 独显](repair-02-evidence/R2/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R2/d33-uncover.png)；[d7 独显](repair-02-evidence/R2/d7-solo.png)；[d7 隐藏上层](repair-02-evidence/R2/d7-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R2/same-parts.png)；[默认整图](repair-02-evidence/R2/composite.png)。

### R3 — 左袖口回转台阶及短暗尾

处理：仅修 d33 回转端：原生曲线选区整理 alpha 内缘，从同袖青料取样接顺短尾处，再以本袖邻近青色作 4.1px、opacity 0.8 局部融色。d7 未重画；开口未填实，未通过蒙版掩盖瑕疵。

复验：d33、d7 分别独显，隐藏更高层、两片合看及整图复查。回转端平滑，原台阶、短黑尾及下伸暗凸点消失；窄透明口、完整远内壁和搭接保留。

[三视图及合看](repair-02-evidence/R3/three-views.png)；[d33 独显](repair-02-evidence/R3/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R3/d33-uncover.png)；[d7 独显](repair-02-evidence/R3/d7-solo.png)；[d7 隐藏上层](repair-02-evidence/R3/d7-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R3/same-parts.png)；[默认整图](repair-02-evidence/R3/composite.png)。

### R4 — 左袖窿黑残线及白点

处理：在 d33/d35 各自归属的参考范围内原生取样修肩袖根，中央连续本片材料全不透明，外围在衣料内融接。清除应藏在搭接区内的残边；肩端 y<344 的原外轮廓保留。修画中出现的平行半透明灰线和肩端缺口均恢复重做，最终版本已去除。

复验：两片分别独显、分别隐藏上层、局部合看及默认整图复查。各片补全连续；肩根到腋下只露单条自然蓝缝并转深，无黑残串、白点、平行灰线、肩端缺口或接边台阶。

[三视图及合看](repair-02-evidence/R4/three-views.png)；[d33 独显](repair-02-evidence/R4/d33-solo.png)；[d33 隐藏上层](repair-02-evidence/R4/d33-uncover.png)；[d35 独显](repair-02-evidence/R4/d35-solo.png)；[d35 隐藏上层](repair-02-evidence/R4/d35-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R4/same-parts.png)；[默认整图](repair-02-evidence/R4/composite.png)。

### R5 — 右白翻领青包边缺段

处理：参考取样试版裁掉细包边，已弃用；最终恢复原 d38，在原 alpha 内用 Krita Basic-2 Opacity 沿外缘逐笔补蓝青主边（2.1→7.1px）和布面侧浅青细边（1.8px）。主边沿斜自由边连续接到领尖与下缘；d4 与独立驳头未改。

复验：d38 独显、隐藏更高层、d4/d38 合看及整图复查。斜边上段至领尖包边连续，深蓝到青蓝、窄到宽的过渡自然，无缺段、白沟、圆头硬接或新断线；领根与正常颈口保持。

[三视图及合看](repair-02-evidence/R5/three-views.png)；[d38 独显](repair-02-evidence/R5/d38-solo.png)；[d38 隐藏上层](repair-02-evidence/R5/d38-uncover.png)；[d4 独显](repair-02-evidence/R5/d4-solo.png)；[d4 隐藏上层](repair-02-evidence/R5/d4-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R5/same-parts.png)；[默认整图](repair-02-evidence/R5/composite.png)。

### R6 — 右前片额外亮青带

处理：沿 d34 开襟及下摆用本片参考取样恢复白布自然接边，去除额外亮青条；用原生 Basic-2 Opacity 逐笔接顺 4.2px 深色外轮廓，清掉右下边小刺。最终复查另外发现扣翼遮住的开襟上端 alpha 缺口，以本片修前衣料原生局部取样补回，并用 3.5→6px 画笔将上端灰蓝接色平缓转入深蓝外缘。取样没有带入扣翼；d36 未改。

复验：d34、d36 独显、隐藏上层、合看及默认合成复查；另在 [662,470,60,95] 放大检查上端三视图。整条开襟与下摆无额外高饱和亮青带；上端补料连续且不透明，没有缺口或取样半透明条；胸标、圆点、真实口袋青边、驳头青边完整，右下外缘无小刺。

[三视图及合看](repair-02-evidence/R6/three-views.png)；[d34 独显](repair-02-evidence/R6/d34-solo.png)；[d34 隐藏上层](repair-02-evidence/R6/d34-uncover.png)；[d36 独显](repair-02-evidence/R6/d36-solo.png)；[d36 隐藏上层](repair-02-evidence/R6/d36-uncover.png)；[局部同片／相关片合看](repair-02-evidence/R6/same-parts.png)；[默认整图](repair-02-evidence/R6/composite.png)；[开襟上端放大三视图](repair-02-evidence/R6/top-three-views.png)。

本轮 R1 生图采用内置 image_gen；最终源：`generated/generated_images/01a1c628-8b70-7341-9347-d17b48dc7786/call_e68qvtYCQjZyaCpyvLqjANYX.png`。输入裁图为原画布 (435,520)–(785,750)，放大 3 倍。红色只提供本衬衫可见布面的形体和笔触，黄色补连续隐藏衣料，绿色透明排除；黄、绿输入抹为中性灰，并排除白扣翼与外套。修画规格为宽圆蓝灰亮褶、自身暗褶与柔和过渡、保留三扣和弯曲门襟，不加入邻片或其投影。

[三色控制](repair-02-evidence/final-sources/R1-control.png)、[灰底参考输入](repair-02-evidence/final-sources/R1-reference.png)、[最终生成源](repair-02-evidence/final-sources/R1-generated.png)、[配准画面](repair-02-evidence/final-sources/R1-registered.png)、[相似配准记录](repair-02-evidence/final-sources/R1-registration.json)。R2/R5 为原生逐笔修线，[R2 坐标](repair-02-evidence/final-sources/R2-stroke.json)、[R5 坐标](repair-02-evidence/final-sources/R5-stroke.json)；R3 来源为[同袖青料](repair-02-evidence/final-sources/R3-own-cyan.png)；R4/R6 的参考源仅选取各自衣片，R6 上端补料为[本片原有边料](repair-02-evidence/final-sources/R6-before-d34-own.png)。完整当前来源与蒙版所有者见 [来源记录](evidence/provenance-and-mask-checks.json)。

没有新增逻辑节点、拆分或深度变更，无需再次调用 edit_groups / edit_occlusion；35 个上游输入与 review-02 核对一致，见 [结构与未改分片核对](repair-02-evidence/structure-verification.json)。袖口相对纯衣服色块图保持穿着时的收拢形态及窄透明开口；配准保留生成细线，局部修画边缘按真实衣料接边整理。未发现遗留归属或层级冲突。

[最终参考对照](repair-02-evidence/reference-vs-final.png)、[32 个隐藏上层与 23 个逻辑片合看索引](repair-02-evidence/inspection/manifest.json)、[本轮重开核对](repair-02-evidence/reopen-verification.json)。全部独显、隐藏上层、同片合看、默认整图及 7 蒙版两状态已实际查看；默认蒙版全部启用。

## 保存重开验证

已保存正式 clothing-depth.kra，关闭文档、丢弃旧节点引用后重新打开，并重新获取节点。递归核对 32 个绘画层、5 个组、7 个透明度蒙版；所有绘画层底层像素非空，名称、UUID、父组、后到前顺序、显隐、锁定、透明度和混合模式与保存前一致。全部原始绘画像素、蒙版像素及默认合成像素保存前后完全一致；默认 7 个蒙版均启用。重开后导出 PNG 并看图确认画面无变化。

[验证结论](evidence/reopen-verification.json)、[保存前节点与像素记录](evidence/reopen-before.json)、[重开后节点与像素记录](evidence/reopen-after.json)。哈希只用于检验保存完整性，绘画验收依据上述看图记录。

本记录已按 review-02 本次修复更新；逐项结论写入 repair-02.md.tmp，由调度器发布正式 repair 报告。
