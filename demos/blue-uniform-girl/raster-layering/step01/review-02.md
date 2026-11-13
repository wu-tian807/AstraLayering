结论：需要修复

# 第一步独立复核（review-02）

已完成全部部件检查。确认 **16 处需要修复的问题（R1–R16）**，包括袜腿与衣面轮廓台阶、肘缘残片、指间裂缝、脸底补形、耳/发尖线重、后发拼接及眼部和舌面衔接。编号仅用于本报告，与 review-01 的编号独立。

## 输入、依据与只读检查

- 实际检查工程：`raster-layering/step01/character-depth.kra`，画布 **1115×1410**。读取实际 Krita 节点，核对 `part-layering/parts/`、`part-layering/groups.json`、`part-layering/occlusion.json`：**59 个逻辑 part、60 个普通绘画层、3 个原生组、10 个透明度蒙版**。
- 依据正式 `raster-layering/step01/report.md` 确认参考分工：`part-layering/references/standard.png` 用于头发、脸、双眼、手、袜腿和鞋；`part-layering/references/base-subject.png` 用于裸上臂、颈胸和连体衣。两张参考均保持原尺寸、原坐标，没有移动、缩放或变形。
- 已阅读现有正式 `review-01.md`、`repair-01.md` 和 `report.md` 了解前次问题与修复。其“自检通过”不作为本次通过依据；本次结论来自实际 KRA 的逐层导出与看图。暂存稿不作为完成状态。
- 每个绘画深度分别看过：独显/全部蒙版启用、独显/全部蒙版停用、隐藏所有更高深度/蒙版启用、隐藏所有更高深度/蒙版停用；同时看正常合成、同坐标原图，放大核查衔接。两眼另看原尺寸并排和放大局部；同一逻辑上睑的40与57.5另看合并状态。
- 全图默认蒙版、全部停用蒙版，以及10张蒙版逐一单独启用/停用均已检查。透明PNG证据的灰底检查板只用于显示透明区域；没有把灰底写入工程。没有以PSNR、相似度或其他质量分数替代看图。
- 检查只临时改变内存显隐并导出；每批后恢复，最终恢复原显隐并关闭检查文档，未调用保存。KRA、分层和参考共 **85个输入文件 SHA-256 前后均未变化**。

[只读校验](review-evidence-02/readonly-verification.json) · [Krita恢复/关闭记录](review-evidence-02/krita-close.json) · [节点清单](review-evidence-02/nodes.json) · [完整四状态导出索引](review-evidence-02/exports.json) · [最终导出与检查图一致性](review-evidence-02/export-consistency.json)

## 框选与整体证据

所有框使用原画布 `[x,y,width,height]`。局部工具对照均为**左参考、右当前**；padding只增加上下文。下列图片及本报告所有证据均位于step01，链接按报告目录解析。

[standard范围整图框选](review-evidence-02/annotations/standard/marked.png) · [base-subject范围整图框选](review-evidence-02/annotations/base-subject/marked.png) · [后发独显框选](review-evidence-02/annotations/back-hair-solo/marked.png) · [脸底独显框选](review-evidence-02/annotations/face-solo/marked.png) · [全部框坐标/图层/局部路径](review-evidence-02/regions.json)

[整图对standard](review-evidence-02/whole-standard.png) · [整图对base-subject](review-evidence-02/whole-base-subject.png) · [整图全部蒙版开/关](review-evidence-02/details/whole-mask-toggle.png) · [当前默认KRA导出](review-evidence-02/raw/actual-default.png) · [当前全部蒙版停用导出](review-evidence-02/raw/actual-masks-off.png)

## 确定需要修复的问题

### R1 — 画面右腿内侧轮廓折点

相关图层：`04 \| legs/leg_left/leg`。

位置：原画布 `[579, 1010, 31, 51]`；左右按画面方位描述。

**当前表现：**04袜腿的内侧在约 y1020–1045 出现突出的鼓点和短促折线。独显、隐藏上层及默认合成中均存在。

**参考依据：**standard 同坐标可见袜侧为平顺、稍倾斜的连续边；评判仅使用裙摆以下的可见段，不要求隐藏大腿根照搬另一参考。

**影响：**破坏袜腿原有形体，在原尺寸下留下轮廓突点；上部补形到可见段的切向不连续。

**修复方向：**在04本件内局部收顺该段轮廓，接顺上段补形与下段可见袜侧，再沿实际边缘连续画深蓝外线及邻近体积过渡。

**需要保留：**保留已有袜面渐变、完整隐藏足形和足底外线；不借鞋或裙子像素补袜侧。



[框内当前](review-evidence-02/annotations/standard/R1-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R1-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/leg-right-inner-focus.png)

### R2 — 画面左腿外侧膝下凹口

相关图层：`05 \| legs/leg_right/leg`。

位置：原画布 `[414, 1009, 30, 48]`；左右按画面方位描述。

**当前表现：**05外侧约 x425–430/y1027–1034 有短凹口，转入斜向小腿时形成突出的角；四种检查状态中的自身轮廓相同。

**参考依据：**standard 同坐标外侧从膝下平缓转入小腿，没有该短凹口或角。

**影响：**轮廓产生台阶，影响腿形与原图一致性。

**修复方向：**在05自己的边缘重接这一小段圆滑曲线，统一前后描边粗细，并把内侧袜面明暗接到新边缘。

**需要保留：**保留上方完整袜根和下方整脚补形，不靠上层遮住折点。



[框内当前](review-evidence-02/annotations/standard/R2-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R2-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/leg-left-outer-corrected.png)

### R3 — 画面左腿内侧突变短段

相关图层：`05 \| legs/leg_right/leg`。

位置：原画布 `[522, 988, 25, 43]`；左右按画面方位描述。

**当前表现：**05内侧约 x532–538/y997–1014 从斜边突然转成近竖直短段，再折回斜线；独显与默认合成都有这一段。

**参考依据：**standard 在裙摆以下的同坐标可见轮廓是一条连续斜弧。框上方含少量裙摆上下文，不用于判定隐藏腿根位置。

**影响：**造成原图连续轮廓的折点和局部比例变化。

**修复方向：**依可见斜弧校准05自身接边，局部平顺延续轮廓、深蓝描边和袜面体积，避免再形成硬切段。

**需要保留：**保持同一条腿的整体姿态和完整足形，不整层缩放。



[框内当前](review-evidence-02/annotations/standard/R3-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R3-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/leg-left-inner-corrected.png)

### R4 — 画面左肘多出灰色短枝

相关图层：`23 \| arms/arm_right/forearm`；`25 \| arms/arm_right/upper_arm`。

位置：原画布 `[435, 708, 26, 36]`；左右按画面方位描述。

**当前表现：**约 x449/y718–725 的棕色臂缘外有灰色短枝。25上臂独显可定位到同一残片；23前臂自身圆头没有对应灰片。

**参考依据：**base-subject 同坐标是一条连续暖棕斜弧，透明外侧没有枝状内容。

**影响：**显得像外来残片，并使上臂与前臂衔接处出现毛刺和轮廓台阶。

**修复方向：**清掉25自己轮廓外的灰片，沿本臂曲线修回连续暖棕描边；合上23检查两件重叠后的边线、粗细和肤色。

**需要保留：**保留23/25完整关节补形和自身皮肤明暗；不把前臂画进上臂层。



[框内当前](review-evidence-02/annotations/base-subject/R4-current.png) · [同坐标参考](review-evidence-02/annotations/base-subject/R4-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/elbow-branch-focus.png)

### R5 — 画面右手食指与中指接触裂缝

相关图层：`14 \| arms/arm_left/hand/middle_finger`；`18 \| arms/arm_left/hand/index_finger`；`20 \| arms/arm_left/hand/palm`。

位置：原画布 `[829, 929, 21, 41]`；左右按画面方位描述。

**当前表现：**默认合成在食指18与中指14相接的约 x839–846/y939–958 有一条露出背景的透明/浅灰细缝。停用全部蒙版后，后方手指垫住一部分裂缝，接触边仍不顺；这不能替代默认状态的两指覆盖。

**参考依据：**standard 同坐标两指以连续棕色分界相接，没有露出背景的槽。该处不是原图真实的拇指虎口空隙。

**影响：**破坏手部连续结构，原尺寸能看到异常亮缝。

**修复方向：**在14与18各自绘画层延续自己的接触侧皮肤和暗边，逐段接回自然棕色分界；上根接点合上20掌面复查。食指、中指没有独立指缝蒙版，不通过停用后方指默认遮挡来遮补。

**需要保留：**保留两指完整指根、指身明暗、真实拇指间隙及后方小指/无名指默认遮挡。



[框内当前](review-evidence-02/annotations/standard/R5-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R5-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/finger-slot-focus.png)

### R6 — 完整脸底右颊短促S形内凹

相关图层：`34 \| face/face_base`。

位置：原画布 `[655, 448, 32, 53]`；左右按画面方位描述。

**当前表现：**34完整脸底的画面右颊约 x666/y458–484 有短促内凹—回凸转折，接下颌的切向不顺。独显可见完整S形，默认合成的露出颊边也较原图不平顺。

**参考依据：**standard 可见的颊—下颌趋势为连续圆弧；框中部分确被侧发遮住，隐藏段只据完整脸底自身形体及可见颊线/下颌切向判断，不虚构原图被遮住处的精确轮廓。

**影响：**完整脸底补形有凹折，露出时边缘不自然，影响后续头发运动后的脸形。

**修复方向：**在34用自身皮肤笔触把短凹转折接成自然颊弧，续好暖棕外线与下颌切向；独显和合成分别确认。

**需要保留：**保留完整脸部皮肤层次，不带入耳或侧发内容；不要通过收窄侧发遮住凹口。



[框内当前](review-evidence-02/annotations/standard/R6-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R6-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/cheek-notch-focus.png)

[R6完整脸底独显对照（参考含遮挡）](review-evidence-02/annotations/face-solo/R6-comparison.png) · [R6独显整图框选](review-evidence-02/annotations/face-solo/marked.png)

### R7 — 画面右耳外线过细过浅

相关图层：`32 \| face/ears/ear_left`。

位置：原画布 `[731, 345, 43, 115]`；左右按画面方位描述。

**当前表现：**32可见耳廓的外缘比原图明显细、浅且偏暖，耳尖至外弧下段缺少原图清晰的深色收束。独显耳层同样可见这一线宽/颜色差别。

**参考依据：**standard 同坐标耳外弧有清楚的深蓝黑轮廓；这里比较的是耳本体边线，非要求把邻近头发投影画进耳朵。

**影响：**耳廓立体结构和画面线条风格变弱，与原图及邻近部件线重不一致。

**修复方向：**按本耳原图的线宽和深浅恢复外线，转弯和下端逐渐收细，接回完整耳根补形；维持耳内自身暖色结构。

**需要保留：**保留耳内高光、红色内面和完整耳形，不复制头发像素或暗影。



[框内当前](review-evidence-02/annotations/standard/R7-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R7-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/ear-outline-focus.png)

### R8 — 画面右眼虹膜上缘浅色阶梯边

相关图层：`37 \| face/eyes/eye_left/sclera`；`38 \| face/eyes/eye_left/iris`；`40 \| face/eyes/eye_left/upper_eyelid`；`眼睛开口 left`。

位置：原画布 `[581, 330, 42, 25]`；左右按画面方位描述。

**当前表现：**38虹膜上缘靠左肩、约 x587–601/y337–343 与40睫毛内缘之间残留浅灰青色阶梯边。默认、全部蒙版停用及整眼组合都能看到；虹膜独显上边也呈浅色抗锯齿边。

**参考依据：**standard 本眼同尺寸上缘是平顺深蓝接触，没有这圈浅色台阶。

**影响：**虹膜—睫毛接触不自然，破坏原图眼部轮廓与材质衔接。

**修复方向：**先修38本体上弧的暗边和覆盖，使其和40自身内缘连续接触；再核对37所在眼内组的共享开口。避免只加粗睫毛遮掉不顺的虹膜边。

**需要保留：**保持本眼形状、虹膜层次、高光位置及40/57.5合法深度分片；不把睫毛投影画入眼白。



[框内当前](review-evidence-02/annotations/standard/R8-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R8-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/eye-left-edge-focus.png)

### R9 — 画面左眼虹膜上弧浅灰细边

相关图层：`42 \| face/eyes/eye_right/sclera`；`43 \| face/eyes/eye_right/iris`；`45 \| face/eyes/eye_right/upper_eyelid`；`眼睛开口 right`。

位置：原画布 `[397, 370, 43, 26]`；左右按画面方位描述。

**当前表现：**43虹膜上弧约 x412–429/y375–380 与45睫毛相接处有浅灰细边和阶梯，蒙版开关、整眼组合与隐藏上层状态均可定位。

**参考依据：**standard 本眼的上弧与睫毛衔接为连续深蓝暗边；同尺寸并排可区分当前浅线。

**影响：**眼内出现非参考的亮接线，虹膜上弧和睫毛关系不一致。

**修复方向：**按本眼原图修43上弧暗边与边缘融色，接好45内缘；复查42所在组共享开口及正常眼白覆盖。

**需要保留：**保留本眼独有的虹膜渐变、青色下部和高光，不镜像另一只眼、不移动整个眼组。



[框内当前](review-evidence-02/annotations/standard/R9-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R9-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/eye-right-edge-focus.png)

### R10 — 画面右眼双眼皮线体积不足

相关图层：`41 \| face/eyes/eye_left/eyelid_crease`。

位置：原画布 `[548, 309, 76, 40]`；左右按画面方位描述。

**当前表现：**41由原图较宽的柔和红褐弧变成细、偏浅的鲑红线；暗中心、上下软边和两端自然收细的层次明显减弱。独显与蒙版开关状态一致。

**参考依据：**standard 同坐标是有红褐暗中心及周围柔和晕染 的双眼皮自身结构线。这条线不是上睫毛投下的灰紫影。

**影响：**眼皮线条与明暗体积偏离原图，眼部表现变平。

**修复方向：**按本眼参考重画弧度、宽度、红褐中心与柔和外晕，逐渐收细两端；使用自身绘画渐变接到透明边，不能用等宽浅线代替。

**需要保留：**保持原睫毛、眼白与高光，继续排除睫毛投影进入41或眼白。



[框内当前](review-evidence-02/annotations/standard/R10-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R10-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/crease-left-focus.png)

### R11 — 画面左眼双眼皮线过窄过平

相关图层：`46 \| face/eyes/eye_right/eyelid_crease`。

位置：原画布 `[365, 353, 77, 40]`；左右按画面方位描述。

**当前表现：**46的上方弧线比本眼原图更窄、更浅，原图中央红褐宽弧与软边层次被压成薄线。独显及所有蒙版状态都相同。

**参考依据：**standard 本眼同坐标双眼皮有较宽的暖红暗中心及柔和过渡；按本眼单独核对，不以另一眼作镜像依据。

**影响：**本眼眼皮体积和线色与原图不符。

**修复方向：**依本眼原图恢复红褐宽弧、暗中心与自然渐淡收口，接回周围透明软边；完成后和原图原尺寸并排看。

**需要保留：**保留本眼睫毛与眼内层次，不恢复已清除的外来睫毛投影。



[框内当前](review-evidence-02/annotations/standard/R11-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R11-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/crease-right-focus.png)

### R12 — 左侧蓝色后发补绘有条块拼接

相关图层：`01 \| hair/back_hair`。

位置：原画布 `[326, 477, 30, 67]`；左右按画面方位描述。

**当前表现：**01在画面左侧深色竖向边附近有突兀亮青窄条；约 y482 起边缘突然变亮，跨过斜向发缕线后又有近水平色阶和块状色差。独显、隐藏上层与默认合成均可见。

**参考依据：**standard 同处蓝色发面和深色发流线连续，没有这一亮条和块状修补界面。

**影响：**原尺寸局部出现补丁感，破坏同一片发面的连续材质与自然融色。

**修复方向：**在01用本件已有发面笔触局部融接亮条和下部色阶，顺着发流重接内部深线，处理前后邻接渐变；不要新增整片均匀填色。

**需要保留：**保留连成一片的实体发缕、斜向结构线和外围回弯；不采侧发、脸或衣领补后发。



[框内当前](review-evidence-02/annotations/standard/R12-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R12-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/hair-left-patch-focus.png)

### R13 — 右侧青蓝发尖下缘缺少原图线重

相关图层：`01 \| hair/back_hair`。

位置：原画布 `[646, 535, 57, 40]`；左右按画面方位描述。

**当前表现：**01画面右侧青蓝尖束的可见下缘变成细浅边，尖端缺少原图深色收尖。独显确认它来自后发本体，非侧发层的遮挡差别。

**参考依据：**standard 此可见发尖下缘有连续、较粗的深蓝轮廓；被衣领遮住的延伸段不作为精确位置依据。

**影响：**发尖轮廓与原图不一致，立体收束变弱，邻近外线粗细突变。

**修复方向：**沿01实际新边缘恢复可见段的深蓝轮廓，适配参考线重并渐细收尖；让线色和内部蓝面自然相接。

**需要保留：**保留青蓝渐变、已补全的自身根部及原图真实发缕间空隙，不能用厚线填掉空隙。



[框内当前](review-evidence-02/annotations/standard/R13-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R13-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/hair-right-tip-focus.png)

### R14 — 发饰下方后发补全留下硬接边

相关图层：`01 \| hair/back_hair`。

位置：原画布 `[721, 350, 36, 48]`；左右按画面方位描述。

**当前表现：**01独显时，已恢复的发缕在原耳顶附近约 y360–371 留下近水平材质边，下面有一条窄竖色带；自身暗线在此停顿/突变。默认耳层会遮住部分问题，后发完整补形仍能看到拼接。

**参考依据：**standard 上方可见青蓝楔形亮带与发流方向有明确依据；下方被耳遮住的区域不作逐像素比较，只按同一片后发的形体、线条和材质连续性判断。

**影响：**后发独显不是自然连续的同一发面，耳运动或隐藏时会露出硬接痕迹。

**修复方向：**在01把上方自己的发流线和渐变继续画过接边，融掉水平界面及竖色带，使补全成为同一材质；先独显确认，再合上耳和侧发检查。

**需要保留：**保留已修回的青蓝楔形亮带及本件自身结构，不把耳廓线、肤色或耳投影延续进后发。



[框内当前](review-evidence-02/annotations/back-hair-solo/R14-current.png) · [同坐标参考](review-evidence-02/annotations/back-hair-solo/R14-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/hair-wedge-seam-focus.png)

### R15 — 连体衣左腰胯接边台阶

相关图层：`27 \| body/torso`；`29 \| pelvis`。

位置：原画布 `[461, 781, 31, 33]`；左右按画面方位描述。

**当前表现：**约 x474–480/y786–793 的左外缘出现侧向台阶及灰蓝凸边；29独显可定位到同样短段，合上27后仍不顺。

**参考依据：**base-subject 同坐标连体衣外缘是连续斜弧，没有侧向台阶。

**影响：**同一衣面在躯干—骨盆衔接处暴露错位和硬边。

**修复方向：**在29自己的边缘收顺凸段，和27连续对齐，再接回深蓝线和面料柔和明暗；保持两件各自完整覆盖。

**需要保留：**保留原图面料高光、腰胯结构线及底边，避免把裸腿肤色或其他件轮廓画进衣面。



[框内当前](review-evidence-02/annotations/base-subject/R15-current.png) · [同坐标参考](review-evidence-02/annotations/base-subject/R15-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/suit-left-edge-focus.png)

### R16 — 舌头右上缘折角与硬融色

相关图层：`48 \| face/mouth/mouth_interior`；`50 \| face/mouth/tongue`。

位置：原画布 `[520, 467, 42, 22]`；左右按画面方位描述。

**当前表现：**50舌面右上缘约 x535–555/y472–480 从弧顶突然折成较直的斜边，红色口内与粉色舌面之间出现硬界面；舌头独显和正常口部组合都能定位。

**参考依据：**standard 同坐标舌面上缘更圆顺，口内—舌面体积色阶柔和，没有当前短折角和硬粉色边。

**影响：**舌头本身形体偏平、补绘痕迹可见，正常口形与原图不一致。

**修复方向：**重画50自身上缘弧度和粉色体积渐变，与48口内自然接触；只修各自材质，合上上牙与唇开口后检查可见轮廓。

**需要保留：**保留完整舌面、正常牙齿露出带和上下唇关系，不把牙或唇的线画进舌层。



[框内当前](review-evidence-02/annotations/standard/R16-current.png) · [同坐标参考](review-evidence-02/annotations/standard/R16-reference.png) · [放大及独显/隐藏上层证据](review-evidence-02/details/mouth-top-focus.png)

## 全部部件检查覆盖

下表每行对应一个实际绘画深度。每行的六栏检查板依次是：参考、独显蒙版开、独显蒙版关、默认合成、隐藏更高层蒙版开、隐藏更高层蒙版关；已逐一看过。完整原尺寸PNG和UUID见四状态索引。表中“未另发现确定问题”表示已查完本件的完整补形、轮廓、内容归属、线色、明暗与衔接，不表示免除相关组合接点的修复。

| 深度 | 实际部件图层 | 检查板 | 本次结果 |
|---|---|---|---|
| 1 | `01 \| hair/back_hair` | [六栏](review-evidence-02/sheets/0001.png) | R12、R13、R14 |
| 2 | `02 \| legs/leg_left/shoes/cuff_back` | [六栏](review-evidence-02/sheets/0002.png) | 未另发现确定问题 |
| 3 | `03 \| legs/leg_right/shoes/cuff_back` | [六栏](review-evidence-02/sheets/0003.png) | 未另发现确定问题 |
| 4 | `04 \| legs/leg_left/leg` | [六栏](review-evidence-02/sheets/0004.png) | R1 |
| 5 | `05 \| legs/leg_right/leg` | [六栏](review-evidence-02/sheets/0005.png) | R2、R3 |
| 6 | `06 \| legs/leg_left/shoes/shoe_front` | [六栏](review-evidence-02/sheets/0006.png) | 未另发现确定问题 |
| 7 | `07 \| legs/leg_right/shoes/shoe_front` | [六栏](review-evidence-02/sheets/0007.png) | 未另发现确定问题 |
| 8 | `08 \| arms/arm_left/bracelet_back` | [六栏](review-evidence-02/sheets/0008.png) | 未另发现确定问题 |
| 9 | `09 \| arms/arm_right/bracelet_back` | [六栏](review-evidence-02/sheets/0009.png) | 未另发现确定问题 |
| 10 | `10 \| arms/arm_left/hand/little_finger` | [六栏](review-evidence-02/sheets/0010.png) | 完整小指已看；默认遮挡有效 |
| 11 | `11 \| arms/arm_right/hand/little_finger` | [六栏](review-evidence-02/sheets/0011.png) | 完整小指已看；默认遮挡有效 |
| 12 | `12 \| arms/arm_left/hand/ring_finger` | [六栏](review-evidence-02/sheets/0012.png) | 完整无名指已看；默认遮挡有效 |
| 13 | `13 \| arms/arm_right/hand/ring_finger` | [六栏](review-evidence-02/sheets/0013.png) | 未另发现确定问题 |
| 14 | `14 \| arms/arm_left/hand/middle_finger` | [六栏](review-evidence-02/sheets/0014.png) | R5接触侧 |
| 15 | `15 \| arms/arm_right/hand/middle_finger` | [六栏](review-evidence-02/sheets/0015.png) | 未另发现确定问题 |
| 16 | `16 \| arms/arm_left/hand/thumb` | [六栏](review-evidence-02/sheets/0016.png) | 未另发现确定问题 |
| 17 | `17 \| arms/arm_right/hand/thumb` | [六栏](review-evidence-02/sheets/0017.png) | 未另发现确定问题 |
| 18 | `18 \| arms/arm_left/hand/index_finger` | [六栏](review-evidence-02/sheets/0018.png) | R5接触侧 |
| 19 | `19 \| arms/arm_right/hand/index_finger` | [六栏](review-evidence-02/sheets/0019.png) | 未另发现确定问题 |
| 20 | `20 \| arms/arm_left/hand/palm` | [六栏](review-evidence-02/sheets/0020.png) | R5上根接点复查 |
| 21 | `21 \| arms/arm_right/hand/palm` | [六栏](review-evidence-02/sheets/0021.png) | 未另发现确定问题 |
| 22 | `22 \| arms/arm_left/forearm` | [六栏](review-evidence-02/sheets/0022.png) | 未另发现确定问题 |
| 23 | `23 \| arms/arm_right/forearm` | [六栏](review-evidence-02/sheets/0023.png) | R4组合接点 |
| 24 | `24 \| arms/arm_left/upper_arm` | [六栏](review-evidence-02/sheets/0024.png) | 未另发现确定问题 |
| 25 | `25 \| arms/arm_right/upper_arm` | [六栏](review-evidence-02/sheets/0025.png) | R4残片来源 |
| 26 | `26 \| neck` | [六栏](review-evidence-02/sheets/0026.png) | 未另发现确定问题 |
| 27 | `27 \| body/torso` | [六栏](review-evidence-02/sheets/0027.png) | R15组合接点 |
| 28 | `28 \| body/breast` | [六栏](review-evidence-02/sheets/0028.png) | 未另发现确定问题 |
| 29 | `29 \| pelvis` | [六栏](review-evidence-02/sheets/0029.png) | R15台阶来源 |
| 30 | `30 \| arms/arm_left/bracelet_front` | [六栏](review-evidence-02/sheets/0030.png) | 未另发现确定问题 |
| 31 | `31 \| arms/arm_right/bracelet_front` | [六栏](review-evidence-02/sheets/0031.png) | 未另发现确定问题 |
| 32 | `32 \| face/ears/ear_left` | [六栏](review-evidence-02/sheets/0032.png) | R7 |
| 33 | `33 \| face/ears/ear_right` | [六栏](review-evidence-02/sheets/0033.png) | 未另发现确定问题 |
| 34 | `34 \| face/face_base` | [六栏](review-evidence-02/sheets/0034.png) | R6 |
| 35 | `35 \| face/blush_left` | [六栏](review-evidence-02/sheets/0035.png) | 红色底、斜纹和柔和融色已画出；未另发现确定问题 |
| 36 | `36 \| face/blush_right` | [六栏](review-evidence-02/sheets/0036.png) | 红色底、斜纹及浅色亮点已看；未另发现确定问题 |
| 37 | `37 \| face/eyes/eye_left/sclera` | [六栏](review-evidence-02/sheets/0037.png) | R8组合接触 |
| 38 | `38 \| face/eyes/eye_left/iris` | [六栏](review-evidence-02/sheets/0038.png) | R8 |
| 39 | `39 \| face/eyes/eye_left/highlight` | [六栏](review-evidence-02/sheets/0039.png) | 未另发现确定问题 |
| 40 | `40 \| face/eyes/eye_left/upper_eyelid` | [六栏](review-evidence-02/sheets/0040.png) | R8组合接触 |
| 41 | `41 \| face/eyes/eye_left/eyelid_crease` | [六栏](review-evidence-02/sheets/0041.png) | R10 |
| 42 | `42 \| face/eyes/eye_right/sclera` | [六栏](review-evidence-02/sheets/0042.png) | R9组合接触 |
| 43 | `43 \| face/eyes/eye_right/iris` | [六栏](review-evidence-02/sheets/0043.png) | R9 |
| 44 | `44 \| face/eyes/eye_right/highlight` | [六栏](review-evidence-02/sheets/0044.png) | 未另发现确定问题 |
| 45 | `45 \| face/eyes/eye_right/upper_eyelid` | [六栏](review-evidence-02/sheets/0045.png) | R9组合接触 |
| 46 | `46 \| face/eyes/eye_right/eyelid_crease` | [六栏](review-evidence-02/sheets/0046.png) | R11 |
| 47 | `47 \| face/nose` | [六栏](review-evidence-02/sheets/0047.png) | 未另发现确定问题 |
| 48 | `48 \| face/mouth/mouth_interior` | [六栏](review-evidence-02/sheets/0048.png) | R16组合融色 |
| 49 | `49 \| face/mouth/lower_teeth` | [六栏](review-evidence-02/sheets/0049.png) | 完整下牙已看；默认隐藏符合开口控制 |
| 50 | `50 \| face/mouth/tongue` | [六栏](review-evidence-02/sheets/0050.png) | R16 |
| 51 | `51 \| face/mouth/upper_teeth` | [六栏](review-evidence-02/sheets/0051.png) | 完整牙面及露出带两状态已看；未另发现确定问题 |
| 52 | `52 \| face/mouth/lower_lip` | [六栏](review-evidence-02/sheets/0052.png) | 未另发现确定问题 |
| 53 | `53 \| face/mouth/upper_lip` | [六栏](review-evidence-02/sheets/0053.png) | 未另发现确定问题 |
| 54 | `54 \| face/eyebrows/eyebrow_left` | [六栏](review-evidence-02/sheets/0054.png) | 未另发现确定问题 |
| 55 | `55 \| face/eyebrows/eyebrow_right` | [六栏](review-evidence-02/sheets/0055.png) | 未另发现确定问题 |
| 56 | `56 \| hair/bangs` | [六栏](review-evidence-02/sheets/0056.png) | 未另发现确定问题 |
| 57 | `57 \| hair/side_hair/side_hair_left` | [六栏](review-evidence-02/sheets/0057.png) | 未另发现确定问题 |
| 57.5 | `57.5 \| face/eyes/eye_left/upper_eyelid [outer_spike]` | [六栏](review-evidence-02/sheets/57.5.png) | 自身外尖及与40合并均已看；不是重复层 |
| 58 | `58 \| hair/side_hair/side_hair_right` | [六栏](review-evidence-02/sheets/0058.png) | 未另发现确定问题 |
| 59 | `59 \| head_accessories` | [六栏](review-evidence-02/sheets/0059.png) | 未另发现确定问题 |

## 原生组、同part深度分片与眼睛

- `眼内开合 left`：37/38/39及共享开口、高光范围蒙版，和40/41/57.5合看；[蒙版开/关与原图](review-evidence-02/details/group-eye_left.png)。已核查眼形、睫毛、眼白、虹膜暗边/青蓝层次及高光；确定问题见R8、R10。
- `眼内开合 right`：42/43/44及共享开口、高光范围蒙版，和45/46合看；[蒙版开/关与原图](review-evidence-02/details/group-eye_right.png)。本眼独立按原图核查，确定问题见R9、R11。
- 双眼另作[原尺寸并排](review-evidence-02/details/eyes-native.png)，再按R8–R11局部放大核对接触线和双眼皮。没有把应去掉的睫毛投影缺失列为修复项。
- `口内开合`及48–53口内/牙/舌/上下唇分别检查，再合看[口部蒙版开/关](review-evidence-02/details/group-mouth.png)。停用开口后完整牙面、舌面和口内自然露出，不据此判为默认多余线；正常组合的问题见R16。
- **40与57.5是同一个`face/eyes/eye_left/upper_eyelid`的合法深度分片**。两片分别独显和隐藏上层，再[合并开/关蒙版](review-evidence-02/details/group-left_lid_fragments.png)看连续性；没有发现片间裂缝、重复内容或不合归属。保留此拆片。

## 10个显隐蒙版逐一检查

每张蒙版均从工程原显隐恢复后单独切换开/关并看过；各部件另做全部蒙版开/关。三张后方手指与下牙默认全隐藏，只控制显示，不代表绘画缺失。

| 编号 | 蒙版及父节点 | 开/关对照 | 观察 |
|---|---|---|---|
| M01 | `后方手指默认遮挡` → `10 \| arms/arm_left/hand/little_finger` | [开/关](review-evidence-02/details/mask-01.png) | 停用可见完整小指；默认遮挡有效 |
| M02 | `后方手指默认遮挡` → `11 \| arms/arm_right/hand/little_finger` | [开/关](review-evidence-02/details/mask-02.png) | 停用可见完整小指；默认遮挡有效 |
| M03 | `后方手指默认遮挡` → `12 \| arms/arm_left/hand/ring_finger` | [开/关](review-evidence-02/details/mask-03.png) | 停用可见完整无名指；默认遮挡有效；停用后会垫住R5部分缝隙 |
| M04 | `高光虹膜范围 left` → `39 \| face/eyes/eye_left/highlight` | [开/关](review-evidence-02/details/mask-04.png) | 高光完整绘画保留；范围开关已看 |
| M05 | `眼睛开口 left` → `眼内开合 left` | [开/关](review-evidence-02/details/mask-05.png) | 共享开口已看；R8接触边在全开/全关均残留 |
| M06 | `高光虹膜范围 right` → `44 \| face/eyes/eye_right/highlight` | [开/关](review-evidence-02/details/mask-06.png) | 高光完整绘画保留；范围开关已看 |
| M07 | `眼睛开口 right` → `眼内开合 right` | [开/关](review-evidence-02/details/mask-07.png) | 共享开口已看；R9接触边在全开/全关均残留 |
| M08 | `下牙默认遮挡` → `49 \| face/mouth/lower_teeth` | [开/关](review-evidence-02/details/mask-08.png) | 停用可见完整牙面；默认隐藏有效 |
| M09 | `上牙露出带` → `51 \| face/mouth/upper_teeth` | [开/关](review-evidence-02/details/mask-09.png) | 完整上牙与连续露出带均已看 |
| M10 | `上下唇开口` → `口内开合` | [开/关](review-evidence-02/details/mask-10.png) | 完整口内与正常开口均已看；不将停用后的完整补形当默认瑕疵 |

[全部组/蒙版导出记录](review-evidence-02/groups-masks.json)

## 修复后复核要求

按R1–R16逐处修到自身绘画连续、原尺寸无接痕，再重新检查涉及部件的独显、隐藏上层和正常组合；显隐蒙版开/关都要看。双眼分别按原图原尺寸并排复核，不能通过加粗遮挡层或写入外来投影掩盖虹膜接边。后发R14、脸底R6须在上层隐藏时确认补形本身已接顺。其余已完整补好的脚形、隐藏手指/下牙、合法上睑深度分片及原有细节应保留。

本次只交付独立review，没有修改工程或分层文件。上述16项均有实际KRA导出、同坐标参考和编号框选证据；没有将尚不确定的微小高光差异、透明图片显示器伪影或合理遮挡控制列为问题。
