结论：已修复

# repair-01 逐项处理与验收

依据 [review-01.md](../../raster-layering/step01/review-01.md) 修复原工程，沿用同一 `../../raster-layering/step01/character-depth.kra`。本次按 R1–R13 的全部字母子框及修复过程中发现的问题逐项处理。

当前交付已更新：[KRA](../../raster-layering/step01/character-depth.kra)、[透明 PNG](character-depth.png)、[绘画报告](../../raster-layering/step01/report.md)。65 个逻辑部件、69 个普通绘画分片；17 个原生透明度蒙版、5 个原生控制组。

证据四列固定为：**原参考／完整独显／隐藏上层／默认整图**。参考与当前使用相同原画布坐标，只有检查用的等倍率放大。完整独显停用蒙版及继承透明度，默认导出恢复全部原生控制。

| 项目 | 原问题与相关层 | 处理结果 | 三视图及同坐标对照 |
|---|---|---|---|
| **R1：通过** | 颈根横向带及灰点<br>neck 30、torso 31；颈肩接合蒙版 | 颈根与锁骨上方各自在本件内恢复笔触；颈部过渡改为 3px，且仅在下层完全不透明的真实重叠中变淡，消除双层同时半透明造成的发色漏点。保留颌下与锁骨原有笔触。 | [1号证据](repair-01-evidence/final/check-0.png) |
| **R2a–b：通过** | 三件连体衣材质、深浅边线及缝线<br>breast 32、torso 31、pelvis 13 | 恢复胸部亮暗面、腰腹渐层、裆尖明暗和腿口深边／窄亮边；本件隐藏布面补画并用原生笔触接顺缝线。完整 torso、独立胸片和骨盆保留，未挖遮挡孔或合并。 | [2号证据](repair-01-evidence/final/check-1.png) / [3号证据](repair-01-evidence/final/check-2.png) / [4号证据](repair-01-evidence/final/check-3.png) |
| **R3a–b：通过** | 掌指／腕掌接缝、指甲及叠指画法<br>双手十二件＋forearm 20/22 | 按本侧本件恢复圆润甲面、叠指暗线、掌部有效细褶线；指根按同手肤色整体补画，保留可见笔触力度；掌根用 18px 原生蒙版在真实腕掌重叠中接色。各指长度、补根和归属不变。 | [5号证据](repair-01-evidence/final/check-4.png) / [6号证据](repair-01-evidence/final/check-5.png) |
| **R4a–b：通过** | 圆瞳、虹膜层次、高光及睑线<br>左右眼全部 part，含上睑 42/66 与48/66.5 | 恢复本侧虹膜可见纹理与近圆暗瞳、独立高光和睑线笔锋；眼白为连续本件绘画，不含虹膜环；虹膜清除睑线与高光残影。保留完整眼白／虹膜、原生剪贴、共享开口及两深度上睑。 | [7号证据](repair-01-evidence/final/check-6.png) / [8号证据](repair-01-evidence/final/check-7.png) |
| **R5：通过** | 口腔纵深、舌缘与唇缘接色<br>mouth_interior 50、tongue 52、upper_teeth 53、双唇54/55 | 恢复口腔上壁、舌面明暗、唇缘细亮边和下唇高光；口底、牙、舌、唇分别清理外件残色。上牙改为干净完整牙材质，舌缘保持自身粉色连续；保留共享开口、露牙量、下牙默认隐藏。 | [9号证据](repair-01-evidence/final/check-8.png) |
| **R6a–b：通过** | 双耳饰形体及金属笔触<br>earring_right 33、earring_left 34 | 按各侧原画恢复菱形宝石、短节、柳叶长坠的轮廓宽度和连续金属面；本件完整 alpha 与安装根保留，未复用对侧原画替代不对称朝向。 | [10号证据](repair-01-evidence/final/check-9.png) / [11号证据](repair-01-evidence/final/check-10.png) |
| **R7a–b：通过** | 长发可见分束、折面与尖梢<br>long_hair_right 1、long_hair_left 2 | 恢复原可见区纵向分束、细暗边与尖梢；将本件隐藏发面补成同样的清晰发流，并接顺原先手后方的新旧材质交界。原长度、外弯、分叉、补根和整体位置保留。 | [12号证据](repair-01-evidence/final/check-11.png) / [13号证据](repair-01-evidence/final/check-12.png) / [14号证据](repair-01-evidence/final/check-13.png) / [15号证据](repair-01-evidence/final/check-14.png) |
| **R8：通过** | 左长发中的冠吊饰残影<br>仅 long_hair_left 2；crown_pendant_left 6 保留 | 最终在 x580–622、y135–240 用本件完整发段的材质和纵向笔触清除串纹、菱形切面与 V 形边界；独显与隐藏全部上层均为连续发流。独立吊饰自身原像素保留。 | [16号证据](repair-01-evidence/final/check-15.png) |
| **R9a–d：通过** | 四肢轮廓、关节塑形与腿间分界<br>四臂段、双腿及torso肩端 | 恢复本件细轮廓、边缘亮暗、肘膝局部笔触；两腿各画连续暖褐内侧线。左腿内侧 1–3px 不规则包络同步修正 SVG，填平细缝；左右肘按实际前景部件用 26px 原生重叠蒙版接续，左前臂近端从本件中段延续材质。 | [17号证据](repair-01-evidence/final/check-16.png) / [18号证据](repair-01-evidence/final/check-17.png) / [19号证据](repair-01-evidence/final/check-18.png) / [20号证据](repair-01-evidence/final/check-19.png) |
| **R10a–b：通过** | 足趾缝、甲缘、足底杂点与脏边<br>leg_right 9、leg_left 10 的足部 | 在本件内恢复原趾缝、甲缘、趾腹和足底轮廓；删除左画面拇趾底黑点及横向杂边，原生弧线接顺。保留完整双足、五趾走向及 leg 自属足背链。 | [21号证据](repair-01-evidence/final/check-20.png) / [22号证据](repair-01-evidence/final/check-21.png) |
| **R11a–b：通过** | 踝前链与足背链断接<br>anklet_front 11/12＋对应leg 9/10 | 前链用紧密九珠与连续银丝恢复材质尺度；足背链根在 leg 自身延伸至前链下方并接顺细链节。默认姿态中央接点无悬空，前链与足背链归属分别保留。 | [23号证据](repair-01-evidence/final/check-22.png) / [24号证据](repair-01-evidence/final/check-23.png) |
| **R12a–b：通过** | 前后踝链珠间银丝及端点<br>anklet_back 7/8、anklet_front 11/12 | 前后各件补连续银丝并按本侧前链材质画后半段；合看成完整绕踝环，转接处连续，未以双珠掩盖断口。后链完整绘画与默认隐藏蒙版保留；前链清除源图肤色底边，仅取本件珠面中心笔触。 | [25号证据](repair-01-evidence/final/check-24.png) / [26号证据](repair-01-evidence/final/check-25.png) |
| **R13a–b：通过** | 耳廓、耳甲与细边线<br>ear_right 35、ear_left 36 | 本侧可见内耳笔触恢复到完整本件耳廓中，补对耳轮、耳甲与耳垂的协调明暗；耳垂微小金属残色用本件肤色修净。完整普通人耳范围及默认遮挡蒙版保留，不含发缘或耳饰。 | [27号证据](repair-01-evidence/final/check-26.png) / [28号证据](repair-01-evidence/final/check-27.png) |

## 修复中另发现并已处理

- 本件局部取样的剪贴板会裁到非空选区，已补偿实际偏移，未移动原参考掩盖差异。
- 原颈根抗锯齿边和躯干蒙版同时变淡时会漏出后方发色；改为仅在下层完全不透明的真实重叠中做接合。
- 左右肘的前景部件不同，分别在右前臂／左上臂建立原生接合蒙版；左前臂近端另按本件中段延续材质，消除可见亮块。两掌根增加原生腕部接合。
- 指根补全曾与可见笔触有色阶，最终按本手已确认肤色整体补根，保留原有叠指暗线、指甲和长度。
- 眼白中的虹膜边线、虹膜中的睑线／高光、牙面和舌缘的外件残色、耳垂微小金属点均在所属本件内清除。完整眼白、口底、牙舌仍为连续底形。
- 长发新旧材质交界及左上发段的 V 形明暗均在本件内接顺；最终左长发独显没有吊饰串纹或切面。
- 前链原取样带入的肤色底边清除，最终只保留原珠面中心的本件笔触，珠间银丝和珠形为连续金属绘画。
- 骨盆隐藏根部接线重新画成连续曲线，清除旧断线；足底黑点、横向脏边清理并接顺本件弧线。

## 结构同步及与色块图的差异

本次未拆分、合并或重命名逻辑 part，没有新增绘画深度。`groups.json` 和 `occlusion.json` 的既定 ID／层序保留。预先标注的冠架、额饰双深度，以及上游先前组装发现的左右上睑双深度，都按原深度保留并逐片检查。

唯一上游形状调整为 `../../part-layering/parts/legs/leg_left/leg.svg`：y880–1130 内侧接触边 1–3px 局部补齐／收回，与当前 KRA 同步。新增 4 个原生接合蒙版不构成新逻辑部件，完整绘画仍在原图层。

绕踝链的珠间透明空隙与银丝小于实心色块外包络；右腿足底黑点清理有约 1px 包络内收。以上差异已在绘画报告列明，其余没有归属变更或用遮挡物像素填补底件。

## 蒙版、分片及整图检查

17 个蒙版均在原生 A/U8 状态下启用／停用检查。下牙及后踝链停用默认隐藏蒙版后有完整纹理；前后链在隐藏腿部时合为连续环。两眼和口内的 3 个共享开口测试归零，随后恢复，全部绘画及蒙版缓冲与切换前相同。

[全部蒙版停用](repair-01-evidence/final/all-masks-off.png) · [眼口开口归零测试](repair-01-evidence/final/aperture-zero-test.png) · [前后踝链合看](repair-01-evidence/final/front-back-rings-check.png) · [原生控制验证](../../raster-layering/step01/repair-01-evidence/final/mask-checks.json)

所有 65 个逻辑件的三视图文件均已由最终工程导出。逐件来源、图层名／UUID、区域、最终深度和蒙版所属位置见 [report.md](../../raster-layering/step01/report.md) 的完整映射及 [实际图层树](../../raster-layering/step01/repair-01-evidence/final/tree.json)。

## 保存、重开及最终状态

已保存指定工程，关闭并重新打开，确认画布 941×1672、RGBA/U8、原色彩配置；69 个绘画层、17 个透明度蒙版、5 个控制组全部存在。91 个节点的名称、UUID、父子与根层顺序、显隐和剪贴状态一致，86 份绘画／蒙版缓冲像素一致，差异列表为空。默认 PNG 在保存前、重开后及交付版的解码像素一致。

[保存前 PNG](repair-01-evidence/final/preclose.png) · [重开后 PNG](repair-01-evidence/final/reopened.png) · [重开核对结果](../../raster-layering/step01/repair-01-evidence/final/reopen-verification.json) · [交付检查](../../raster-layering/step01/repair-01-evidence/final/delivery-check.json)

看图确认本轮 R1–R13 已处理完成；没有本轮未解决项。保存状态为参考的睁眼／张口姿态，默认下牙与后踝链隐藏，全部接合及开口蒙版启用。

过程中出现的进度对话框提示、导出等待和一次编译前语法错误均已恢复；实际文件验证通过，没有因工具状态冒充完成。
