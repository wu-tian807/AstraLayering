# 衣服分层绘制报告

工程 `clothing-raster-layering\step01\clothing-depth.kra`。画布 1254 × 1254，11 个普通绘画层，深度由后到前为 10 到 110。

## 图层与搭接

Krita 图层名与原 part ID 完全一致。区域坐标以画布左上角为原点，像素框为 `(x, y, 宽, 高)`。

| 原 part ID／实际图层名 | 原生 UUID | 最终深度 | 区域与像素框 | 归属与层序依据 |
| --- | --- | ---: | --- | --- |
| `skirt_tier_four` | `{a9d521f0-13ce-4f17-b38b-ecfec1a65865}` | 10 | 末层外展裙面、完整波浪裙边及上收口 `(203, 962, 835, 192)` | 上口短搭量进入第三层下摆后。两翼的裙边转折、褶线和阴影已局部接顺。 |
| `skirt_tier_three` | `{2f17cd15-d015-48a7-b6d7-9fa19189da2c}` | 20 | 第三道裙面、上收口与第三道摆缘 `(255, 820, 730, 215)` | 上口承接第二道摆缘，第三道摆缘覆盖末层上口。保留中间长褶与左右外展。 |
| `skirt_tier_two` | `{9636d74e-ffbb-4aab-b288-8fe79648fd20}` | 30 | 第二道裙面、上收口与第二道摆缘 `(314, 637, 613, 234)` | 上口承接第一道摆缘，下摆覆盖第三道上口，中央偏长的褶面保持连续。 |
| `skirt_tier_one` | `{9fbb62a3-1677-4fc3-a72f-65e7f44b2f60}` | 40 | 腰带下第一道裙面和上收口 `(394, 445, 452, 225)` | 上口进入腰带下缘，第一道摆缘覆盖第二层上口。已接顺两侧上口转入长褶处。 |
| `image_left_shoulder_assembly/right_shoulder_ruffle` | `{e6f46c91-6042-4b6b-9df2-1b21e87b256a}` | 50 | 画面左侧整片肩荷叶、内侧缝根及下收端 `(371, 128, 109, 206)` | 肩带盖住内侧搭口，白领边与胸衣盖住下接点。参考笔触修顺下收端的短轮廓。 |
| `image_left_shoulder_assembly/right_shoulder_strap` | `{490c0d58-fbcc-4d90-a683-f9c90420d8a4}` | 60 | 画面左侧窄带全长、细包边及下端缝接量 `(452, 132, 54, 166)` | 窄带在荷叶缝根前，缝接量连续延伸到白领边与粉包边之后，供下端共同变形。 |
| `image_right_shoulder_assembly/left_shoulder_ruffle` | `{11d60bf3-1d94-4410-805c-738d7d168e4e}` | 70 | 画面右侧整片肩荷叶、内侧缝根及下收端 `(761, 127, 110, 206)` | 肩带盖住内侧搭口，白领边与胸衣盖住下接点。肩顶描边沿自身上缘接至窄带。 |
| `image_right_shoulder_assembly/left_shoulder_strap` | `{6a57402b-06cd-4ad1-bd98-9af80964182c}` | 80 | 画面右侧窄带全长、细包边及下端缝接量 `(736, 133, 57, 180)` | 窄带在荷叶缝根前，缝接量连续延伸到白领边与粉包边之后。 |
| `neckline_ruffle` | `{348c01b1-835c-431c-8fa3-26ceb08abeaf}` | 90 | 整道白色褶冠、两端回折和下沿搭口 `(470, 238, 304, 70)` | 两端压住肩带和荷叶的领端接点。下沿短搭口藏进胸衣包边，褶冠上方保持透明敞口。 |
| `dress_bodice` | `{b6282e41-d197-42bc-b2b3-5e6d137d08a3}` | 100 | 粉包边、抽褶衣身、腰带后的下口 `(468, 277, 309, 169)` | 前压白褶边下沿和肩饰收端。包边两端按纯衣服图的曲线收齐，左下长褶延续到腰带后的搭口。 |
| `waistband` | `{85fea1d3-7512-4f8b-92ba-8416b5537714}` | 110 | 整条前腰束带、上下细走线和圆角 `(484, 429, 275, 38)` | 上缘压住胸衣下口，下缘压住第一道裙片上收口。左右圆角与外轮廓连贯。 |

## 生成、配准与局部修画

- 各部件用三色控制图与中性灰遮除图生成。深度 10–40 的纹理来自 `clothing-raster-layering\step01\workspace\lower.generated.png`，深度 50–110 的纹理来自 `clothing-raster-layering\step01\workspace\upper.generated.png`。按各自轮廓和裙边褶角配准，保留生成的衣料纹理、细描边及包边。两侧肩饰分别使用各侧的生成画面和本侧参考，保留原有不对称。
- 局部修画取样自 `clothing-part-layering\references\clothing.png` 的同一衣片，使用 Krita 原生绘画层合成。修顺肩顶接线、左肩荷叶下端、左下胸衣褶线、首层裙片腰侧抽褶和末层两翼裙边。末层两翼的残短痕以附近布面取色，用 Krita 软笔刷逐笔收干净。 [末层褶线修画对照](inspection/hem-fold-repair.png)
- 胸衣包边两端按参考收回原补全色块中伸入白褶可见区的部分，约在 x=473–517 与 x=727–771。胸衣下口的隐藏搭量保留。右肩荷叶肩顶按参考接顺带缘附近的窄描边。其余差异是个别褶尖位置和明暗过渡的绘画差异。
- 成画沿用 `clothing-part-layering\groups.json` 的终止 part 归属与 `clothing-part-layering\occlusion.json` 的单深度。穿衣图显示两侧为自由展开的荷叶边，肩带与前领为独立衣片，领口为真实敞口。逐处比对后，现有深度可表达这些搭接关系。

## 显隐与验收

- 11 个衣片都默认可见。`hiddenInReference` 蒙版、剪贴控制与开合区域检查均为不适用。逐层关闭其余各层查看完整轮廓及藏量，复位后检查领口、肩根、腰带与四道裙层接缝。 [上身独显](inspection/isolated-upper.png) · [四层裙片独显](inspection/isolated-lower.png)
- 对照纯衣服图和 `part-layering\references\simplified-subject.png` 的穿着形状，复核两肩、方领开口、腰线和末层裙边，放大查看原尺寸接缝。 [参考对照](inspection/reference-check.png) · [接缝对照](inspection/seam-check.png)
- 最终保存后在 Krita 重新打开，核对 11 层名称、UUID、类型、顺序、默认显隐和图层像素。保存前后逐层及合成像素一致。独显检查后恢复默认状态。 [透明合成 PNG](inspection/clothing-composite.png)

## 第一轮返修

- 完成 R1–R19。重接两侧肩带纵包边和荷叶缝根，整理两端白褶回折及整条下沿搭口。胸衣下口和四道裙片的褶形均延续进藏量，领口敞口保持透明。 [肩带及荷叶](repair-01-evidence/shoulders.png) · [领端及胸衣下口](repair-01-evidence/connections.png) · [领褶及第一层腰口](repair-01-evidence/gathers-upper.png)
- 局部生成来源为 `clothing-raster-layering\step01\workspace\round01\upper-repair.generated.png` 与 `clothing-raster-layering\step01\workspace\round01\skirt-repair.generated.png`。结合本片取样和原生软笔刷，修补第二道裙片左上角自身搭量与描边，收齐末层裙片的两翼转角和亮短划。现有 11 个 part 的归属、UUID 和深度继续对应上表。 [裙层和末层细节](repair-01-evidence/skirt-details.png)
- 逐项完成单层、隐藏上层和合成检查。保存后重新在 Krita 打开，逐层和合成像素与保存前一致。更新了用于验收的透明合成、参考对照、接缝对照和两张独显图。 [透明合成](inspection/clothing-composite.png) · [接缝对照](inspection/seam-check.png)

## 第二轮返修

- 完成 R1–R19，恢复肩荷叶根部的扇褶、领端细轮廓、胸衣腰口的圆收褶和四层裙片连续上口。左、右外翼及三处裙摆凹口按同片参考收线。 [肩部](repair-02-evidence/shoulder-folds.png) · [领端](repair-02-evidence/neck-corners.png) · [衣身与腰口](repair-02-evidence/waist-and-neck-gathers.png) · [裙缘接点](repair-02-evidence/hem-and-side-joins.png)
- 第二轮生图来源为 `clothing-raster-layering\step01\workspace\round02\details.generated.png` 与 `clothing-raster-layering\step01\workspace\round02\skirts.generated.png`。结合可见参考取样、藏量的褶线配准及 Krita 原生细笔触修复。原 part 归属、UUID 与单深度继续对应上表。 [第二层上口](repair-02-evidence/r10-gathers.png) · [第三层上口](repair-02-evidence/r11-gathers.png) · [第四层上口](repair-02-evidence/r12-gathers.png)
- 逐处检查单层、隐藏上层及整图。保存后重开确认图层和像素一致。验收图已从当前工程重新导出。 [透明 PNG](inspection/clothing-composite.png) · [原尺寸接缝](inspection/seam-check.png)
