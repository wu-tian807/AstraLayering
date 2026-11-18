结论：需要修复

已在当前 Krita 工程中查完全部 10 个逻辑衣片、15 个绘画深度分片及 5 个透明度蒙版。确定需要修复 1 处：画面左腰有衣身补全侧缘外露。上一轮蝴蝶结、两侧肩带的三项描边问题已修复；本报告的 R1 是本轮新编号。

## 检查对象与方法

- 工程：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra`，1086×1448。
- 衣服参考：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/references/clothing.png`。
- 穿着结构参考：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/simplified-subject.png`。仅用于判断衣服穿着结构，没有检查身体装配。
- 已核对 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/parts/` 全部 13 个 SVG，以及 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/groups.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/occlusion.json`。
- 已阅读正式 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-01.md` 和 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-01.md`；结论依据本轮实际看图。

在 Krita 5.3.1 打开磁盘上的当前工程，逐层切换可见性，重新导出 57 个检查状态：15 片各自独显、逐级隐藏更高层后的补全区、5 个背向蒙版分别停用和启用、同一逻辑 part 前后分片合看，以及整图蒙版两态。逐一查看上述衣片，并将整图、色块图、原尺寸接缝和放大局部与参考对照。参考保留原画布坐标，没有移动或配准；局部放大图明确标注倍率。

## R1 — 左腰衣身补全侧缘露在腰头外侧



- **相关图层**：主修 `D12__camisole/bodice__full`；遮挡对位层为 `D14__pleated_skirt/waistband__front`。
- **位置**：画面左腰，白衣进入黑腰头的左上角以下。原画布框选 bounds 为 `[348,680,18,37]`，异常主要在约 x354–358、y686–708 的短侧缘。
- **当前表现**：白衣隐藏下摆的浅灰白侧缘超出腰头左外缘，形成一段细亮条，末端还有短小突起。原尺寸局部可辨认出腰头旁多出的浅边，放大后能看清白衣边与腰头边并行。隐藏 D12 后该细条消失，D14 自身左缘保持连续，确认来源为衣身补全区，并非腰头高光。
- **参考依据**：纯衣服参考同坐标处，白衣在腰头左上角收进腰头后；其下为连续深色腰头侧缘，没有这段浅色衣身外露。原穿衣角色也表现为上衣收在腰头后。
- **影响**：上衣与腰头的搭接在原尺寸下留下可见的额外边线和小台阶，不满足衔接处无外露补全、无多线及无拼接感的要求。
- **修复方向**：以 D14 当前左外缘为遮挡边界，在 D12 的该段隐藏侧缘局部向内收进约 1–3 个原画布像素，具体以合成中完全藏住浅边为准；从可见衣身进入腰头左上角的位置平滑接到内部下摆，重新接顺本片边缘与明暗。修后分别看 D12 独显、隐藏腰头和全衣合成，并在蒙版两态下复查左腰：本片仍连续完整，合成仅保留参考的腰头侧缘。
- **需要保留**：D12 现有可见衣身轮廓、褶皱、白布过渡及延至约 y730 的完整隐藏下摆；D14 的位置、宽度和轮廓；前后衣片独立层及当前层序。局部调整不得把衣身下摆搭接裁成缺口。

框选工具输出的原尺寸同坐标局部，左参考、右当前：



来源验证，左参考、中当前、右隐藏 D12；6×最近邻仅便于辨认细边：



补充证据：[原尺寸三状态](review-evidence/review02-inspection/verify-left-waist-native.png)、[参考／当前／D12 独显／D14 独显 4×](review-evidence/review02-inspection/detail-left-waist-4x.png)。独立局部：[参考](review-evidence/review02-marked/R1-reference.png)、[当前](review-evidence/review02-marked/R1-current.png)。

框选及清单位于 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-evidence/review02-marked/`；[regions.json](review-evidence/review02-marked/regions.json) 的编号、坐标、图层与本报告一致。

## 全部衣片检查覆盖

下表中的逐片图均来自本轮当前 KRA。左栏为独显且停用蒙版，中栏为隐藏更高层；有蒙版的分片另有右栏启用蒙版的独显状态。前后合看图分别显示蒙版启用、停用两态。原始全画布 PNG 及精确图层名、UUID、范围、导出清单见 [inspection-manifest.json](review-evidence/review02-inspection/inspection-manifest.json)。

|逻辑衣片|已看深度分片及证据|检查结果|
|---|---|---|
|`camisole/right_shoulder_strap`，画面左肩带|[D03 背向顶帽](review-evidence/review02-inspection/inspect-D03.png)、[D10 完整前段](review-evidence/review02-inspection/inspect-D10.png)、[前后合看](review-evidence/review02-inspection/combined-camisole-right_shoulder_strap.png)|肩顶、外侧细边已恢复；根部完整并藏在领缘后。前后合看没有横向分界或双线。|
|`camisole/left_shoulder_strap`，画面右肩带|[D04 背向顶帽](review-evidence/review02-inspection/inspect-D04.png)、[D11 完整前段](review-evidence/review02-inspection/inspect-D11.png)、[前后合看](review-evidence/review02-inspection/combined-camisole-left_shoulder_strap.png)|描边已恢复；白布、内侧折转线及根部连续，领口开口保留。未见其他确定问题。|
|`camisole/bodice`|[D12 完整衣身](review-evidence/review02-inspection/inspect-D12.png)|领缘、蝴蝶结后布面及隐藏下摆连续，无蝴蝶结鬼影或投影；左腰搭接须修本轮 R1。|
|`chest_bow/center_knot`|[D15 背向束结](review-evidence/review02-inspection/inspect-D15.png)、[D20 正面](review-evidence/review02-inspection/inspect-D20.png)、[前后合看](review-evidence/review02-inspection/combined-chest_bow-center_knot.png)|侧缘细边已恢复，束结连续，遮住四个根部；蒙版开关未引入双线。|
|`chest_bow/right_tail`，画面左带尾|[D16](review-evidence/review02-inspection/inspect-D16.png)|完整隐藏根部、连续长边及斜切端，描边已恢复；没有邻件线条或白衣像素。|
|`chest_bow/left_tail`，画面右带尾|[D17](review-evidence/review02-inspection/inspect-D17.png)|带身和根部连续干净，斜切端描边完整；两带尾间保持敞开。|
|`chest_bow/right_loop`，画面左结翼|[D18](review-evidence/review02-inspection/inspect-D18.png)|外缘描边已恢复；聚拢根部、翼面、折返暗面与内壁连成同片。|
|`chest_bow/left_loop`，画面右结翼|[D19](review-evidence/review02-inspection/inspect-D19.png)|根部完整，折返内壁和下缘线连续；未见色块拼贴或外来笔触。|
|`pleated_skirt/waistband`|[D02 背侧连接](review-evidence/review02-inspection/inspect-D02.png)、[D14 前腰头](review-evidence/review02-inspection/inspect-D14.png)、[前后合看](review-evidence/review02-inspection/combined-pleated_skirt-waistband.png)|本件布面完整，前后对应边缘接顺；左外侧的浅边已确认来自 D12，列入 R1。|
|`pleated_skirt/skirt_body`|[D01 背侧连接](review-evidence/review02-inspection/inspect-D01.png)、[D13 前裙身](review-evidence/review02-inspection/inspect-D13.png)、[前后合看](review-evidence/review02-inspection/combined-pleated_skirt-skirt_body.png)|裙根补全、各褶面、纵褶线与错落下摆连续；后层仅保留本片侧向连接，无远端下摆鬼影。|

5 个背向分片的透明度蒙版启用时，独显均为空；停用后可见各自肩顶、腰侧、裙侧或束结笔触。已分别检查，再合看同一 part 的前后片；这些是计划内深度分片，没有按重复层判错。

## 整图、衔接与上一轮修复复核

- [全衣参考／当前原尺寸并排](review-evidence/review02-inspection/compare-full.png)、[上衣原尺寸](review-evidence/review02-inspection/compare-upper-native.png)、[色块图与上衣](review-evidence/review02-inspection/colormap-upper.png)、[色块图与裙子](review-evidence/review02-inspection/colormap-skirt.png)：整体形体、比例、位置及衣服内部层级未见其他确定问题。
- [连续领缘与肩带根部 2×](review-evidence/review02-inspection/compare-neckline-2x.png)：肩带根部被领缘正常覆盖，中央领缘连续，没有透明断口。
- [蝴蝶结 3×](review-evidence/review02-inspection/compare-bow-3x.png)、[画面左肩带 3×](review-evidence/review02-inspection/compare-straps-3x.png)、[画面右肩带 3×](review-evidence/review02-inspection/compare-right-strap-3x.png)：上一轮三项外轮廓描边问题均已修复，未发现修复新增的双线、明显粗细跳变或接头。
- [腰部 2×](review-evidence/review02-inspection/compare-waist-2x.png)、[裙根 2×](review-evidence/review02-inspection/detail-skirt-root-2x.png)、[裙摆原尺寸](review-evidence/review02-inspection/compare-hem-native.png)：除本轮 R1 左腰细边外，其余腰口、腰头下缘、褶根及下摆折角未见确定的露底、断线或拼接问题。[右腰 4×对照](review-evidence/review02-inspection/detail-right-waist-4x.png)未见同类衣身外露。
- [整图蒙版启用／停用](review-evidence/review02-inspection/masks-composite.png)：前层覆盖正常，开关未引入新的外露接缝；R1 在两态下均存在。

各件布面均能看到绘画明暗和线条，没有发现沿外形整块填色、补全区异色色块拼贴或其他衣片残影。独显未见人体内容或别件投影。参考中蝴蝶结投在白衣上的影子未画进 D12，符合本步要求。该套衣服没有袖子或纱料；领口、带尾间及裙摆外的正常开口保持透明。除 R1 外，不追加没有明确图像证据的修复要求。

## 证据与只读核验

本轮导出和检查图保存在 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-evidence/review02-inspection/`，框选交付副本保存在同级 `review02-marked/`。报告中的图片链接均相对本报告文件。

图层显隐仅在内存中切换，结束时恢复初始图层与蒙版状态，未保存并已关闭本轮打开的文档。工程检查前后 SHA-256 均为 `b94f229f20cc97113f9081e38a3390159e321b381198f2a79a98e4dc54a958e8`；[只读核验记录](review-evidence/review02-inspection/readonly-verification.json)。散列只用于核验文件没有改动，画质结论来自看图。

未改写工程、分层 SVG、groups.json、occlusion.json 或已有正式 review／repair 报告。本次交付为本暂存报告及新增证据。
