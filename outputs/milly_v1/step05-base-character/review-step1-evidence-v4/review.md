# 阶段5 step1独立审查：v4

总判定：需返修。仅发现下述1项本轮明暗问题；不要求重画既有轮廓。审查时未修改候选与参考。

## 版本与输入

- 候选：`step05-base-character/05-1_大明暗与体积.svg`，v4。
- 候选 SHA-256：`01482524473c40cb1964cc81837dc7c91417fdf41b0699f932af1b378d7b6f2c`，与交接一致，审查结束再次核对未变。
- 快照：`step05-base-character/05-1_明暗检查.png`，SHA-256 `34dc5bdd55fa1bb3036cb3612d519260d5b11e5b365a7e3e56eb8d8ded6a13e6`；可见标题、完整组合、局部与底部候选校验值对应v4。
- 实际阶段4：`step04-base-character/04_完整分层平涂.svg`，SHA-256 `d67da72064de035d2c965bd2d8e7d05828dd788be6509d2fd05d871c29d5b630`。
- 彩图：`references/base-character.png`，SHA-256 `c5335b1fee621bac4e56f2777eb74a98c046fd719a3fd266e51a24e058438c3a`。

## 检查范围与分项结论

1. **明暗与体积：需返修。** 独立渲染完整组合，与彩图和实际平涂进行同画布、同尺度并排、50%整图合成叠加和局部对照；检查头发、面部、颈肩、衣身、双臂、手掌/手指、双腿、膝与足。主要亮暗总体成立，脸部未因新明暗改变神态。双踝存在本轮新增的无依据硬弧色阶，见S51-R01。红晕、虹膜层次、局部材质高光未作为本轮缺项。
2. **归属与隐藏延续：通过。** 检查后发、左右侧发及发组组合、完整脸部/耳、颈躯干、双腿、衣身、臂、同data-part手部前后分段及臂手邻接；隐藏延续保留。4个外来投影组均位于承影部件，desc注明下颌、发束或衣口来源。对面部、躯干、双腿分别独显并关闭外来投影，未发现错归属或隐藏底形截断。手腕交界未出现由分件收口造成的色阶；踝部问题属于同一完整腿底形内新增明暗的边缘问题，不属于部件丢失。
3. **平涂保留与组合：通过。** 203个原ID全部保留，原有元素属性未改变。排除新增`s51-*`节点后的完整XML树（包含未具名子节点，忽略排版空白）与阶段4一致。关闭全部`data-stage="05-1"`后与阶段4白底渲染逐像素相同（`restore.json`中的`identical_render: true`）。无重复ID、失效引用、外链、位图或脚本，新增明暗没有覆盖原墨线、造成漏缝或错误遮挡。

## 本轮问题

### S51-R01 — P2：双踝新增完整弧形暗带，造成小腿到脚背的假接缝

- 位置：左踝约`x391–439, y1325–1369`；右踝约`x578–627, y1325–1369`。涉及`s51-surface-015`、`s51-surface-024`及其`*-ankle-turn`渐变。
- 可见差异：彩图的踝前面从小腿到脚背基本连续，颜色变化主要柔和地分布在两侧；v4在两侧均加入了横跨踝前面的U形暗带。其上边界仍是清晰的闭合色面弧线，读成踝部接缝/环带，与参考的柔和转面不一致。平涂没有此色阶；仅关闭这两条新增路径后，环带即消失，已确认由本轮明暗造成。
- 可操作返修：重塑这两处阴影的范围及渐隐，让中央小腿受光面连续进入脚背。去掉跨整个踝前面的硬弧收口；如保留踝侧转面，应依据参考让它在侧方和脚背转折处柔和消退。不要改原脚踝/脚部几何，也不要留待step2高光遮盖。
- 主证据：`ankles-reference-side.png`（同坐标参考/候选，裁切`354 1265 314 214`、3倍）。
- 定位证据：`ankles-added-side.png`（阶段4/候选，裁切与倍率相同）。
- 因果诊断：`ankles-without-new-bands.png`（仅隐藏上述两条路径，其余明暗保留；与主证据候选半幅同坐标、同倍率）。
- 整体位置：`full.png`、`legs-reference-side.png`；中性底完整腿：`legs-isolated.png`、`legs-no-cast.png`。

## 既有差异与下一阶段范围

发束分界、部分发梢形状、脸部/眼睛轮廓、膝部深色墨线、趾部细节与彩图仍有差异，但均由实际阶段4继承，本轮未改变；不作为本轮返修项。虹膜高光/精细层次、红晕与材质光泽属于后续step2。

## 证据索引

以下路径均相对此报告所在目录。

- 整图：`reference-side.png`、`reference-overlay.png`、`flat-vs-shaded-side.png`、`full.png`。
- 同坐标局部：`head-reference-side.png`、`body-reference-side.png`、`legs-reference-side.png`、`ankles-reference-side.png`；对应JSON记录输入校验值、裁切、倍率和合成条件。
- 发组及隐藏：`hair-back.png`、`hair-sides.png`、`hair-parts.png`。
- 颈躯干投影开关：`body-isolated.png`、`body-no-cast.png`。
- 脸部/耳及投影开关：`face-parts.png`、`face-no-cast.png`。
- 腿部投影开关：`legs-isolated.png`、`legs-no-cast.png`。
- 手部跨层及邻接：`hands.png`、`hands-main.png`、`hands-rear.png`、`arms-alone.png`、`arms-hands.png`。
- 衣身：`suit-isolated.png`。
- 投影全局诊断：`cast-only.png`、`no-cast.png`。
- 平涂恢复及结构：`flat.png`、`restore-side.png`、`restore-diff.png`、`restore.json`、`changes.json`。

复验要求：核对新候选SHA与快照，重查S51-R01、双踝上下邻接和完整腿/整图，并确认平涂恢复与原结构保留。该项修好前不建议进入step2。
