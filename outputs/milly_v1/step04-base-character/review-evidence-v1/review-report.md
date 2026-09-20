# 阶段4基础填色独立审查：通过

候选版本：v1。总判定：**通过**，无待返修问题。

候选 SVG：`/Users/wutian/Desktop/coding/AstraLayering/working/step04-base-character/04_完整分层平涂.svg`  
SHA-256：`d67da72064de035d2c965bd2d8e7d05828dd788be6509d2fd05d871c29d5b630`

## 输入与版本

- 基础彩图：`references/base-character.png`，1024×1536，SHA-256 `c5335b1fee621bac4e56f2777eb74a98c046fd719a3fd266e51a24e058438c3a`。与色盘 JSON 标注的来源校验值一致。
- 阶段3输入：`step03-base-character/03_完整分层线稿.svg`，SHA-256 `cabbe49bfa1edc9032d9e40886392e02029d1ad015c94779dbf342ae431f94c8`。
- 色盘：`reference-palette/color-palette.png` 与 `reference-palette/color-palette.json`，已看图并核对来源、候选色与明暗对照色。
- 候选快照：`step04-base-character/04_填色检查.png`，2800×2380，SHA-256 `53c56601114de9b60a9ef6566c56f2880a74fc8528c64febdda8b5d6f1b6db3f`。这是一张检查排版图，不与原画布直接作像素差分；其组合、局部与独显内容已和独立渲染对照查看。
- 审查结束前重新核对候选 SVG，其 SHA-256 仍与交接值一致。参考和候选均未修改。

## 实际检查范围

重新渲染完整 SVG；查看原画布整图并排、正常合成后50%透明叠加、白底及移除背景后的中性底组合。局部对照使用相同原图坐标和相同倍率：头部 `(345,30,320,280)` 3倍；躯干 `(365,290,280,490)` 2倍；左手 `(275,720,85,145)` 4倍；右手 `(655,720,85,145)` 4倍；双足 `(348,1340,320,140)` 3倍。

中性底逐一实际查看全部17个角色 data-part：后发、翘发、左右侧发、刘海、发夹、头脸、左右耳、躯干、泳装、左右臂、左右手、左右腿足。左右手按 data-part 合看后，再分别查看前掌和后侧弯指；头脸按 data-part 合看后，再分别查看脸与五官、前置眉线，并关闭整个 head-face 核对所属五官、色区和眉线同时消失。另查看左右眼完整眼白／虹膜／瞳孔与上下眼睑的6倍分离渲染，以及隐藏头发、配件和服装后的完整身体组合。

静态核对全部143条路径及其所属层：所有图形节点都有ID；候选无重复ID、失效引用、外链、嵌图、脚本或 CSS 样式。对照阶段3，原有ID全部保留，所有路径 `d`、变换、描边属性和原有ID的相对DOM顺序不变。新增ID仅为置底的独立背景组与背景矩形。结构检查用于定位，结论同时依据实际渲染。

## 分项结论

| 项目 | 结论 | 主要依据 |
| --- | --- | --- |
| 配色与色区 | 通过 | 橙发、暖肤色、浅蓝白泳装、暖棕虹膜、深灰发夹和粉色口腔的关系与参考相符；没有把明显头发暗部、膝部暖暗或泳装侧面阴影固化为底色。眼白和上牙保留真实浅白色区，手足甲片使用近肤色淡粉色。 |
| 归属与补全 | 通过 | 全部角色部件均已赋色，隐藏发体、完整头脸、耳部、衣下躯干与腿根、臂腕搭接及后侧弯指均延续所属底色。跨层手掌／弯指、头脸／五官／眉线归属一致，独显无白色占位或遮挡物颜色混入。 |
| 线稿与遮挡 | 通过 | 填色未改变阶段3的路径几何、描边或角色层序；正常组合中未见必要墨线被盖住、色缝或越界。双眼开口、嘴形、手势、指间孔洞、发环负空间、发夹间隙和双腿间空隙保持。 |

三处眼内反光路径保留ID及几何，并以 `display="none"` 暂存；这符合本轮不绘制高光／反光的纯色平涂范围，不作为漏填或表情回归。虹膜内墨线、瞳孔和眼睑均保留。后续材质阶段可继续处理眼内反光。

## 证据索引

以下路径均相对本报告所在目录：

- 整图与原图：`full.png`、`reference-side.png`、`reference-overlay.png`、`full-no-background.png`。
- 重点色区与接触：`head-side.png`、`head-overlay.png`、`torso-side.png`、`hand-left-side.png`、`hand-right-side.png`、`feet-side.png`。
- 与阶段3对照：`baseline-head-side.png`、`structure-changes.json`。完整结构差分记录全部有ID元素的填色及显隐变化。
- 全部部件独显：`part-hair-back.png`、`part-hair-cowlick.png`、`part-hair-left.png`、`part-hair-right.png`、`part-hair-bangs.png`、`part-hair-clips.png`、`part-head-face.png`、`part-ear-left.png`、`part-ear-right.png`、`part-body-core.png`、`part-bodysuit.png`、`part-arm-left.png`、`part-arm-right.png`、`part-hand-left.png`、`part-hand-right.png`、`part-leg-left.png`、`part-leg-right.png`。
- 隐藏与跨层验证：`body-uncovered.png`、`head-without-face.png`、`face-without-brows.png`、`brows-only.png`、`hand-left-main.png`、`hand-left-rear.png`、`hand-right-main.png`、`hand-right-rear.png`。
- 眼部内层：`eye-left-inner.png`、`eye-right-inner.png`、`eye-left-lids.png`、`eye-right-lids.png`。
- 对照和独显图对应的同名 JSON 记录输入 SHA-256、裁切、倍率和显隐选择。

本结论限于阶段4底色、色区、归属补全及填色后的线稿／遮挡保留；没有把缺少阶段5明暗与材质作为问题，也没有重做阶段3全部线质精修。未发现因本轮着色新暴露、影响继续推进的明确上游错误。
