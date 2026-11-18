结论：需要修复

已完成全部 10 个逻辑衣片、15 个普通绘画深度分片及 5 个原生透明度蒙版的独立检查。确定要修的是以下 3 处参考描边还原不足；未发现其他有明确图像证据的必修问题。

## 检查对象与方式

- 当前工程：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra`，1086×1448。
- 纯衣服参考：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/references/clothing.png`。
- 原穿衣角色：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/simplified-subject.png`；用于核对肩带、腰口和裙身的穿着结构，本次没有检查身体装配。
- 已读取 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/groups.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/occlusion.json` 及 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/parts/` 的全部衣片 SVG，并将色块范围与当前绘画并排查看。
- 本步现有正式记录为 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/report.md`，未发现正式 review / repair 报告。记录只用于了解已知处理，不作为验收依据。

在 Krita 5.3.1 实际打开当前 KRA，逐层切换可见性并导出：每个绘画分片独显、逐级隐藏更高层以露出搭接补全、5 个蒙版分别启用和停用、同一逻辑 part 的前后分片合看、全衣合成的蒙版两种状态。原始导出均保留画布坐标，参考未移动或配准。另查看原尺寸并排图及 2×/3×最近邻局部图，核查肩带根部、连续领缘、结心与翼尾、白衣与腰头、腰头与褶根和裙摆折角。放大仅用于辨认笔触，不以像素指标判断质量。

## 确定问题与修复反馈

所有 bounds 均为原画布 `[x,y,width,height]`。编号与框选工具的 `regions.json` 一致。以下局部对照均为左参考、右当前。



### R1 — 蝴蝶结自身的深色外缘描边还原不足

- **相关图层**：`D16__chest_bow/right_tail__full`、`D17__chest_bow/left_tail__full`、`D18__chest_bow/right_loop__full`、`D19__chest_bow/left_loop__full`、`D20__chest_bow/center_knot__front`；同源背向结心 `D15__chest_bow/center_knot__rear` 的对应边缘一并保持一致。
- **位置**：bounds `[454,365,179,180]`。重点是两条带尾长边及斜切末端、两结翼上缘与外端、结心左右侧缘。
- **当前表现**：带尾长边和末端接近深灰布面直接截止，参考中可辨认的近黑色细描边未充分保留；结翼外缘和结心侧缘的描边也变淡、变软。此差异在原尺寸对照中可见，独显确认来自各件自身边缘。
- **参考依据**：纯衣服参考同坐标可见连续深色细线，尤其两条带尾斜切端与长边的黑色边线明确；结翼的外缘与折返面边界有清楚区分。
- **影响**：外轮廓线的强度与参考不符，缎带的边缘和折返结构显得软化，未满足参考已有外轮廓、包边完整还原的要求。
- **修复方向**：在各自原绘画层沿已有形体恢复深色细描边，以原尺寸参考确定粗细和深浅；带尾边线连到本件隐藏根部，结翼外缘接顺折返边缘，结心侧缘保持曲线连续。修后同时检查独显及汇合合成，避免加出双重边线。
- **需要保留**：现有缎带渐变、褶皱和完整折返内壁、各件独立层级、隐藏根部、两带尾间透明开口，以及衣身不带蝴蝶结投影的状态。



放大辨认：[蝴蝶结 3×对照](review-evidence/review01-inspection/detail-bow.png)。逐件证据见下方覆盖表中的 D15–D20。

### R2 — 画面左肩带肩顶及外侧轮廓线明显变浅

- **相关图层**：`D10__camisole/right_shoulder_strap__front`、`D03__camisole/right_shoulder_strap__rear`。
- **位置**：bounds `[373,167,39,143]`，画面左肩带圆弧肩顶及画面左侧长边，直到进入领缘的可见段。
- **当前表现**：肩顶及外侧长边呈浅灰软边，参考中的连续深色外轮廓线明显减弱；带内的暗色折转线仍然存在。背向顶帽停用蒙版后可见相同笔触。
- **参考依据**：纯衣服参考同位置的肩顶及外侧边有清楚深色描边，原穿衣角色也保留窄带的明确轮廓。
- **影响**：轮廓线与参考强度不符，白色窄带的边界缺少参考中的清晰度。
- **修复方向**：沿本件肩顶和外侧长边补回与参考相当的连续深色细线，接顺领缘遮住之前的可见段。D03 顶帽与 D10 对应笔触同步处理，合看时肩顶不出现重复线或深度分界横线。
- **需要保留**：白布渐变、带内折转线、当前窄带形体与位置、延至 y328 的完整隐藏根部、领口透明开口及背向蒙版默认启用。



放大辨认：[画面左肩带 3×对照](review-evidence/review01-inspection/detail-left-strap.png)。

### R3 — 画面右肩带肩顶及外侧轮廓线明显变浅

- **相关图层**：`D11__camisole/left_shoulder_strap__front`、`D04__camisole/left_shoulder_strap__rear`。
- **位置**：bounds `[677,167,39,143]`，画面右肩带圆弧肩顶及画面右侧长边。
- **当前表现**：肩顶和外侧边变成浅灰软边，深色外轮廓描边明显弱于参考；独显与前后分片合看均可确认。
- **参考依据**：纯衣服参考同位置的肩顶和画面右侧长边均有连续深色细线，其强度与带内折转线相协调。
- **影响**：与参考及其他清楚描边的衣片边缘不一致，肩带外缘的线条还原不足。
- **修复方向**：在 D11 恢复圆弧肩顶及外侧长边的深色细线，按参考控制粗细、色深及抗锯齿；D04 的对应顶帽保持一致，蒙版两种状态及前后合看均应连续。
- **需要保留**：当前布面明暗、带内折转线、窄带比例与位置、领缘搭接、前后独立绘画层、背向默认隐藏和透明领口。



放大辨认：[画面右肩带 3×对照](review-evidence/review01-inspection/detail-right-strap.png)。

## 全部衣片检查覆盖

下表的“逐层”图左栏为独显、中栏为隐藏上层；有蒙版的分片另有右栏启用蒙版的状态。小衣片为最近邻放大，大衣片为原尺寸局部。每个原始状态 PNG 也保存在同一证据目录，清单见 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-evidence/review01-inspection/inspection-manifest.json`。

|逻辑 part|已看实际分片与逐层证据|同 part 合看与结果|
|---|---|---|
|`camisole/right_shoulder_strap`（画面左）|[D03 背顶帽](review-evidence/review01-inspection/inspection-D03.png)、[D10 前段](review-evidence/review01-inspection/inspection-D10.png)|[蒙版启用/停用合看](review-evidence/review01-inspection/combined-camisole-right_shoulder_strap.png)；形体、根部完整；修 R2。|
|`camisole/left_shoulder_strap`（画面右）|[D04 背顶帽](review-evidence/review01-inspection/inspection-D04.png)、[D11 前段](review-evidence/review01-inspection/inspection-D11.png)|[蒙版启用/停用合看](review-evidence/review01-inspection/combined-camisole-left_shoulder_strap.png)；形体、根部完整；修 R3。|
|`camisole/bodice`|[D12 完整衣身](review-evidence/review01-inspection/inspection-D12.png)|领缘连续，蝴蝶结后为完整白布，无翼尾鬼影；下摆补全连续，未混入黑腰头。未见其他确定问题。|
|`chest_bow/center_knot`|[D15 背向连接](review-evidence/review01-inspection/inspection-D15.png)、[D20 正面](review-evidence/review01-inspection/inspection-D20.png)|[蒙版启用/停用合看](review-evidence/review01-inspection/combined-chest_bow-center_knot.png)；束结本体连续；修 R1 对应边缘。|
|`chest_bow/right_tail`（画面左）|[D16](review-evidence/review01-inspection/inspection-D16.png)|根部及斜切端完整，无其他衣片像素；修 R1 对应边缘。|
|`chest_bow/left_tail`（画面右）|[D17](review-evidence/review01-inspection/inspection-D17.png)|根部及斜切端完整，与另一条间开口透明；修 R1 对应边缘。|
|`chest_bow/right_loop`（画面左）|[D18](review-evidence/review01-inspection/inspection-D18.png)|聚拢根部、折返暗面和内壁连续；修 R1 对应边缘。|
|`chest_bow/left_loop`（画面右）|[D19](review-evidence/review01-inspection/inspection-D19.png)|聚拢根部、折返暗面和内壁连续；修 R1 对应边缘。|
|`pleated_skirt/waistband`|[D02 背侧连接](review-evidence/review01-inspection/inspection-D02.png)、[D14 前腰头](review-evidence/review01-inspection/inspection-D14.png)|[蒙版启用/停用合看](review-evidence/review01-inspection/combined-pleated_skirt-waistband.png)；两侧连接和前布面完整，未见缺口、脏色或拼接台阶。|
|`pleated_skirt/skirt_body`|[D01 背侧连接](review-evidence/review01-inspection/inspection-D01.png)、[D13 前裙身](review-evidence/review01-inspection/inspection-D13.png)|[蒙版启用/停用合看](review-evidence/review01-inspection/combined-pleated_skirt-skirt_body.png)；褶根补全、连续裙面、纵褶及错落下摆完整，无远端残影。|

5 个背向层默认启用透明度蒙版后独显为空，停用后分别显示自身顶帽、侧接或束结笔触；它们是同 part 的深度分片，没有按“重复层”判错。前后分片合看未见新增台阶或双线。

### 整体与衔接证据

- [全画布参考与当前](review-evidence/review01-inspection/compare-full.png)；[上衣原尺寸对照](review-evidence/review01-inspection/compare-upper-native.png)。
- [色块范围：上衣](review-evidence/review01-inspection/colormap-upper.png)；[色块范围：裙子](review-evidence/review01-inspection/colormap-lower.png)。形体、比例、位置及当前衣服内部层级未见其他确定问题。
- [腰部 2×接缝](review-evidence/review01-inspection/compare-waist-2x.png)；[裙根 2×接缝](review-evidence/review01-inspection/detail-root.png)；[裙摆原尺寸对照](review-evidence/review01-inspection/compare-hem-native.png)。白衣与腰头、腰头与褶根衔接未见露底、断口、错位或外露搭接。
- [整体蒙版启用与停用](review-evidence/review01-inspection/masks-composite-native.png)。背向连接由前片正常覆盖，未见蒙版开关引入的接缝。

各衣片可见布面均有绘画明暗和线条，未发现沿外形整块填色、补全区色块拼贴或邻件线条残影；未见人体或其他部件投影混入独立衣片。参考衣服没有袖子或纱料；领口及带尾之间的正常开口保留。纯衣服参考中翼尾在白衣上的投影已移除，符合本步要求，不列为缺失。

## 证据位置与只读核验

- 框选及原尺寸同坐标参考/当前/对照：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-evidence/review01-marked/`；其中 `regions.json` 记录 R1–R3 的坐标、图层和修复说明。
- 本次实际 KRA 导出与检查图：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-evidence/review01-inspection/`。
- KRA 打开前及检查结束的 SHA-256 均为 `990a9b9627ce0bd68e1f116edb2386c4de442ad34acb2616d71e62f1fab3d037`。可见性操作只发生在内存，恢复初始图层/蒙版状态后关闭，未保存工程；核验记录为该检查图目录的 `readonly-verification.json`。此散列仅核验文件未改动，不用于画质判断。
- 未修改 KRA、parts SVG、groups.json、occlusion.json 或原有正式记录。本次仅交付本暂存报告与新增证据，未进行修画。
