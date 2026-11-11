结论：需要修复

本次已查完78个逻辑part、81个实际绘画层及34个原生透明度蒙版，确认14项待修问题。主要涉及左眼额外线条与眼白补色硬边、双臂肘缘、掌指描线、孤立笔迹、耳毛根部、辫根显露形状、狸猫下颌线、后踝环端部及双侧红晕。检查在Krita实际工程中完成；未改写工程或分层输入。

## 输入及检查方法

- 工程：`raster-layering/step01/character-depth.kra`，1376×2048，Krita 5.3.4.1。
- 实际可见参考：依据正式`report.md`确认的`part-layering/references/standard.png`；身体及临时连体服辅助参考为`part-layering/references/base-subject.png`。
- 部件范围、共同身份及覆盖/伸入规则依据`part-layering/parts/`、`part-layering/groups.json`、`part-layering/occlusion.json`。已阅读正式`review-01.md`与`repair-01.md`了解已知反馈，再以当前KRA看图确认；暂存记录不作为完成证明。
- 每个实际绘画层均切换并查看四状态：独显/蒙版启用、独显/本层蒙版停用、隐藏上层/蒙版启用、隐藏上层/本层蒙版停用。全部四状态原尺寸PNG、图层UUID、蒙版父层和检查结果见[完整逐层索引](review-02-evidence/audit-index.md)及[机器可读索引](review-02-evidence/audit-index.json)。12页四状态图集全部查看；大面积头发、尾巴、身体和四肢另看原尺寸独显。
- 三个同part多深度对象分别检查各片，再合起来看：辫子D13/D57、骨盆D22.5/D33、狸猫D12/D85.5。另组合检查双眼、口内、双手、双耳。分片数量不作为重复判据。
- 已查看[默认整图/可见参考](review-02-evidence/whole-standard.png)、[默认整图/身体参考](review-02-evidence/whole-base-subject.png)、[全部蒙版停用整图](review-02-evidence/all-masks-disabled-white.png)。蒙版默认全遮的后大腿带、后发圈、口内、小指也已停用查看完整本体。
- 双眼各与参考按同画布坐标、同尺寸1倍并排，另放大检查眼形、轮廓、睫毛、虹膜、高光及睫毛/眼白接合：[左眼1倍](review-02-evidence/eyes-left-1x.png)、[右眼1倍](review-02-evidence/eyes-right-1x.png)、[左眼放大](review-02-evidence/eyes-left-comparison.png)、[右眼放大](review-02-evidence/eyes-right-comparison.png)。肩胸、腰腹、双肘、掌指、发束、头顶及踝环的连接处也逐处放大对照。

所有框坐标为原画布`[x,y,width,height]`。左右名称指角色自身左右。工具生成的局部对照均为**左参考、右当前**；独显对照中参考仍保留原遮挡，隐藏区没有直接可见参考时，以下逐项注明以本件连续形体、色层和上游范围为依据。没有移动、配准或缩放参考来消除差异；放大证据仅等比放大同坐标区域。透明图的灰/白底只用于看清边缘。

## 框选总览

- [默认整图：R01、R06–R08、R10–R11、R13–R14](review-02-evidence/regions/default-standard/marked.png) · [坐标与说明](review-02-evidence/regions/default-standard/regions.json)
- [默认整图/身体参考：R03–R04](review-02-evidence/regions/default-body/marked.png) · [坐标与说明](review-02-evidence/regions/default-body/regions.json)
- [左眼白完整独显：R02](review-02-evidence/regions/sclera-left/marked.png)；[右上臂完整独显：R05](review-02-evidence/regions/upper-arm-right/marked.png)；[左耳毛完整独显：R09](review-02-evidence/regions/ear-fur-left/marked.png)；[后踝环完整独显：R12](review-02-evidence/regions/anklet-back/marked.png)。
- [全部最终问题框及局部路径](review-02-evidence/annotation-index.json)。掌部另有完整独显框选，见R06/R07。

## 确认要修的问题

### R01 — 左上睑多余悬空弧线和外眼角碎线

**相关图层：** `D071.00 | face/eyes/eye_left/upper_eyelid`。UUID见逐层索引。

**位置与当前表现：** 角色左眼，即画面右眼。框[734,400,75,51]；悬空弧约在x744–767/y403–407，外角碎线约在x798–806/y421–442。 黑睫缘上方另有一条灰棕短弧，和睫毛主体分离；外眼角周围有粉棕色短刺和第二层零碎边。独显可确认它们在上睑层，默认合成及1倍并排也能看到。

**参考依据与影响：** standard.png同侧对应位置是一条连贯上睑，独立眼褶另在D073。当前短弧形成额外第三条线；外角也比参考多出杂线，改变眼形与睫尖。

**修复方向与保留内容：** 清除D071中的悬空弧和外角额外笔迹，按本侧原图取样或续笔恢复连续睑缘及睫尖；保留D073独立眼褶、虹膜和高光。修后单独检查上睑，并将整只左眼与参考原尺寸并排，确认睫缘直接压住眼白。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R01-current.png) · [参考局部](review-02-evidence/regions/default-standard/R01-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R01-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [上睑完整独显放大](review-02-evidence/upper-left-eye-solo.png) · [左眼1倍并排](review-02-evidence/eyes-left-1x.png) · [左眼放大对照](review-02-evidence/eyes-left-comparison.png) · [组合四状态](review-02-evidence/eyes-left-states.png)。



### R02 — 左眼白补全区有硬色块分界

**相关图层：** `D065.00 | face/eyes/eye_left/sclera`。UUID见逐层索引。

**位置与当前表现：** 框[729,415,64,45]；内角白区与中央米色补全的竖向界面约在x735–741/y423–443。 停用本层蒙版后，中央米色区和内眼角较白区域之间呈近乎竖直的硬边；中央补全周围又形成浅色环带，眼白独显呈拼块感。

**参考依据与影响：** standard.png可见的眼白以连续明暗衔接。虹膜后的中心原图被遮住，不能要求照抄隐藏像素，但补全应与同一眼白的角部自然融色。当前硬边使完整眼白不干净，眨眼或虹膜移动时会露出补色块。这里依据画面表现，不据此推断采用了哪种填色工具。

**修复方向与保留内容：** 从本侧眼白可见区域取色，用本件笔触重融中心补全及角部过渡，消除竖边与环带；保留完整眼白、原眼开口和原生蒙版，不挖掉虹膜后的内容，也不新增参考没有的下睑线。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/sclera-left/marked.png) · [当前局部](review-02-evidence/regions/sclera-left/R02-current.png) · [参考局部](review-02-evidence/regions/sclera-left/R02-reference.png) · [同坐标并排](review-02-evidence/regions/sclera-left/R02-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/sclera-left/regions.json)。

**补充观察：** [左右完整眼白独显放大](review-02-evidence/sclera-solo.png) · [左眼组合四状态](review-02-evidence/eyes-left-states.png)。



### R03 — 左上臂肘侧有平行碎线

**相关图层：** `D025.00 | arms/arm_left/upper_arm`。UUID见逐层索引。

**位置与当前表现：** 角色左臂，画面右侧。框[903,773,55,84]，沿肘侧外缘向下的一串短刺。 主外轮廓外侧还有一串平行棕色碎线和小突刺；停用蒙版的完整独显、隐藏上层和默认合成均能定位。

**参考依据与影响：** base-subject.png同处是单一连续细轮廓。当前重复描线造成毛刺、线宽突增，默认肘接合能看出修接痕迹。

**修复方向与保留内容：** 在D025清掉主轮廓外的重复线段，沿本件实际外缘接成同宽、同色、连续的一条线；保留肘端完整形体和自身桃色暗部。修后合看上臂与前臂，检查默认外缘没有双线或尖刺。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-body/marked.png) · [当前局部](review-02-evidence/regions/default-body/R03-current.png) · [参考局部](review-02-evidence/regions/default-body/R03-reference.png) · [同坐标并排](review-02-evidence/regions/default-body/R03-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-body/regions.json)。

**补充观察：** [肘部放大对照](review-02-evidence/elbow-left-comparison.png) · [双臂完整端部](review-02-evidence/arm-caps.png) · [左上臂原尺寸独显](review-02-evidence/native-17.png)。



### R04 — 右上臂肘侧有重复描线

**相关图层：** `D026.00 | arms/arm_right/upper_arm`。UUID见逐层索引。

**位置与当前表现：** 角色右臂，画面左侧。框[520,773,55,56]，主要在x538–565/y782–808附近。 肘侧内缘有第二串碎线与主线并行，局部轮廓增粗并伸出毛刺。完整独显说明残线属于D026，不是相邻前臂的一条合法轮廓。

**参考依据与影响：** base-subject.png对应内缘为连贯单线。当前额外线段改变外缘厚度，在辫尾下方的可见接合区暴露。

**修复方向与保留内容：** 清除D026平行残线和刺，续顺本件肘侧主轮廓；保留自身体积暗部与前臂的现有覆盖关系。不要把正常桃色暗部整体擦白。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-body/marked.png) · [当前局部](review-02-evidence/regions/default-body/R04-current.png) · [参考局部](review-02-evidence/regions/default-body/R04-reference.png) · [同坐标并排](review-02-evidence/regions/default-body/R04-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-body/regions.json)。

**补充观察：** [右肘放大对照](review-02-evidence/elbow-right-comparison.png) · [完整双臂端部](review-02-evidence/arm-caps.png) · [右上臂原尺寸独显](review-02-evidence/native-18.png)。



### R05 — 右上臂伸入肘端的圆帽描边未续完

**相关图层：** `D026.00 | arms/arm_right/upper_arm`。UUID见逐层索引。

**位置与当前表现：** 完整独显框[483,808,45,37]，右上臂下端隐藏圆弧。 肘端补形已连续，但两侧棕色线到下圆弧之前停止；圆弧只剩浅肤色透明度边缘。与左上臂完整圆帽相比，收口描边明显未完成。

**参考依据与影响：** groups.json明确右上臂肘端是伸入侧，保留局部圆弧搭接；base-subject.png可见上臂外缘有棕色描线。隐藏圆帽没有直接可见参考，但应延续本件已有轮廓与体积。当前默认被前臂盖住，独显仍是未画完的部件。

**修复方向与保留内容：** 沿已有圆帽形体续画细棕轮廓，并融接自身肤色与暗部。保留圆弧搭接；合成时检查前臂覆盖仍能隐藏内部闭合线，不把新线暴露成肘部横缝。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/upper-arm-right/marked.png) · [当前局部](review-02-evidence/regions/upper-arm-right/R05-current.png) · [参考局部](review-02-evidence/regions/upper-arm-right/R05-reference.png) · [同坐标并排](review-02-evidence/regions/upper-arm-right/R05-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/upper-arm-right/regions.json)。

**补充观察：** [完整双臂端部放大](review-02-evidence/arm-caps.png) · [右上臂原尺寸独显](review-02-evidence/native-18.png)。



### R06 — 左掌指根多余平行线和三角刺

**相关图层：** `D046.00 | arms/arm_left/hand/palm`；`D044.00 | arms/arm_left/hand/index_finger`。UUID见逐层索引。

**位置与当前表现：** 框[1054,1014,36,48]；上侧平行短线约x1069–1083/y1025–1037，下侧棕色三角刺约x1077–1083/y1053–1058。 左掌走向食指的上缘有第二条短线，默认形成碎阶；完整掌独显的指根下缘还伸出棕色三角刺。这两处都可定位于D046。

**参考依据与影响：** standard.png掌指上外缘连续，未出现当前的平行杂线。下侧三角刺在完整掌上形成多余尖端，影响指根揭露和部件干净程度；不是要求补回铃铛或腕饰投影。

**修复方向与保留内容：** 在掌层清掉额外平行线和三角刺，沿真实外轮廓修顺切线、线宽和颜色。合看D044及其余各指，保留各指完整根部、掌部覆盖侧范围与真实指缝；接触内不额外画横向闭合线。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R06-current.png) · [参考局部](review-02-evidence/regions/default-standard/R06-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R06-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [掌部完整独显框选](review-02-evidence/regions/palm-left/marked.png) · [掌独显参考/当前](review-02-evidence/regions/palm-left/R06-comparison.png) · [掌部独显放大](review-02-evidence/palms-solo.png) · [左手放大对照](review-02-evidence/hand-left-comparison.png) · [左手四状态](review-02-evidence/hand-left-states.png)。



### R07 — 右掌外轮廓碎段及接拇指尖刺

**相关图层：** `D047.00 | arms/arm_right/hand/palm`；`D043.00 | arms/arm_right/hand/thumb`；`D045.00 | arms/arm_right/hand/index_finger`。UUID见逐层索引。

**位置与当前表现：** 框[335,997,79,75]；掌侧长轮廓约x399–405/y1037–1046，另查掌上缘x338–355/y1001–1025。 右掌上侧外轮廓有碎段；掌侧长线在接拇指附近分成尖刺和错开的细线，默认外缘线宽、深浅突然变化。完整掌独显可看到分叉线端，不能仅用拇指遮住它。

**参考依据与影响：** standard.png这些位置是连续的一条掌部外线。当前分叉及突变使掌指接合显出修接痕迹。腕饰下的大块投影已按分层目标移除，该色差不作为本问题依据。

**修复方向与保留内容：** 清理D047分叉和多余线端，沿本件外缘续成单一轮廓，再接顺D043拇指及D045食指默认交界的线宽和颜色。保留本件暗部、各指完整根部和掌部覆盖范围；不在接触内新增横线。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R07-current.png) · [参考局部](review-02-evidence/regions/default-standard/R07-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R07-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [右掌独显框选](review-02-evidence/regions/palm-right/marked.png) · [右掌参考/当前](review-02-evidence/regions/palm-right/R07-comparison.png) · [完整掌部放大](review-02-evidence/palms-solo.png) · [右手放大对照](review-02-evidence/hand-right-comparison.png) · [右手四状态](review-02-evidence/hand-right-states.png)。



### R08 — 左中指下方孤立短划

**相关图层：** `D040.00 | arms/arm_left/hand/middle_finger`。UUID见逐层索引。

**位置与当前表现：** 框[1127,1067,18,11]；指尖下方约x1130–1136/y1072–1073。 左中指下方有一条与指腹轮廓不连接的浅棕短划。完整独显与默认合成都能看到，属于本层游离笔迹。

**参考依据与影响：** standard.png同位置为空背景，连续指腹线留在手指边缘；当前短划破坏独显部件的干净程度，并在默认图形成悬空线。

**修复方向与保留内容：** 仅清除这条孤立短划，保留指腹连续下缘、指尖圆度和自身明暗。修后同时看D040完整独显及整只左手。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R08-current.png) · [参考局部](review-02-evidence/regions/default-standard/R08-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R08-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [中指完整独显放大](review-02-evidence/middle-left-solo.png) · [左手放大对照](review-02-evidence/hand-left-comparison.png)。



### R09 — 左耳毛隐藏根部尖薄且描边未续完

**相关图层：** `D018.00 | face/ears/ear_left/ear_fur`。UUID见逐层索引。

**位置与当前表现：** 完整独显框[793,280,40,32]，主要在x795–820/y284–309的下侧斜边和尖端。 可见毛簇的棕线沿毛梢延续，但到隐藏根部停止；下侧根部拉成尖薄三角，斜边只剩浅色透明外缘。尖端与毛簇主体的厚度、色层衔接突兀。

**参考依据与影响：** groups.json要求同一连续毛簇，根部随本侧耳根及耳内面运动；standard.png可见毛梢有明确棕色轮廓与浅粉/乳色体积。隐藏根部本身被耳壳、头发盖住，应据自身延续，不能把它当作无需完成的裁切残角。

**修复方向与保留内容：** 保留目前可见尖簇，续画根部毛色层次与轮廓，收顺斜边和尖薄端，使根部成为合理连续的软毛簇。保留耳壳开口蒙版；不要镜像另一耳替代本侧形体，也不要借入耳缘或外部头发。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/ear-fur-left/marked.png) · [当前局部](review-02-evidence/regions/ear-fur-left/R09-current.png) · [参考局部](review-02-evidence/regions/ear-fur-left/R09-reference.png) · [同坐标并排](review-02-evidence/regions/ear-fur-left/R09-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/ear-fur-left/regions.json)。

**补充观察：** [两侧完整耳毛独显放大](review-02-evidence/ear-fur-solo.png) · [左耳四状态](review-02-evidence/ears-left-states.png) · [左耳可见参考对照](review-02-evidence/ear-left-comparison.png)。



### R10 — 辫根默认显露的尖束形状及外缘重复线

**相关图层：** `D013.00 | hair/braid_right | root`；`D057.00 | hair/braid_right | front`。UUID见逐层索引。

**位置与当前表现：** 框[564,482,70,112]；抬起尖束约x574–590/y487–514，外缘碎线约y536–586。 当前辫根向上额外抬起一个尖束，改变短后发间的白色开口；下方辫外缘仍有平行/断续描线。D013和D057联合完整独显是相连的，本问题不指称两片重复或断开。

**参考依据与影响：** standard.png在该白色开口下的辫根转接更低且平顺，没有当前向上突出的尖束；外缘为连续单线。当前差异改变发束轮廓及其与后发的遮挡形状。

**修复方向与保留内容：** 按原图校正两片默认显露的根轮廓，去掉额外尖束显露与重复外线；沿发流修顺分界及搭接，保留两片共同part、完整隐藏辫根和已正确的前后层级。只调整真实需显露的边，不删除隐藏根部来换取合成接近。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R10-current.png) · [参考局部](review-02-evidence/regions/default-standard/R10-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R10-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [辫根放大对照](review-02-evidence/braid-comparison.png) · [同part两片联合四状态](review-02-evidence/braid-states.png)。



### R11 — 狸猫前下颌轮廓分段、过平

**相关图层：** `D012.00 | head_accessories/tanuki_ornament/tanuki_body`；`D085.50 | head_accessories/tanuki_ornament/tanuki_body | foreground jaw`。UUID见逐层索引。

**位置与当前表现：** 框[668,216,78,16]，双爪之间的下颌底边。 当前棕色下颌线呈数段近水平短划，中间及两端有浅色断段；D085.5启用蒙版独显可看到当前显露边将轮廓收成分段平线。两片完整狸猫联合仍是连续形体。

**参考依据与影响：** standard.png双爪之间保有连贯、缓弯的本件深棕下颌轮廓。当前分段平线丢失下颌弧度与描边连续性。参考中下方投在头发上的粉暗色带是外投影，不要求画回狸猫或头发层。

**修复方向与保留内容：** 在tanuki_body自身续成与参考相符的连续下颌弧线，再修D085.5原生显露边使线条完整露出并接顺两端；保留D12/D85.5共同part及完整后主体、发根和爪的层级，不恢复外投影。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R11-current.png) · [参考局部](review-02-evidence/regions/default-standard/R11-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R11-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [头顶下颌放大对照](review-02-evidence/head-comparison.png) · [狸猫两片联合四状态](review-02-evidence/tanuki-states.png) · [前下颌蒙版启用独显](review-02-evidence/layers/75/solo-default.png)。



### R12 — 后粉踝环隐藏回转端部急窄成尖片

**相关图层：** `D011.00 | legs/leg_right/anklet_back`。UUID见逐层索引。

**位置与当前表现：** 完整独显框[571,1768,21,31]，粉色后弧左端回转和下斜端。 回转后突然收窄成颈口，再伸出扁平尖斜片；该小段的厚度及粉色管状体积未自然延续。它仍连接在后弧上，本问题不指称断开，也不把蒙版裁出的米色弧小片当作外来残色。

**参考依据与影响：** standard.png及同part可见粉环都是有厚度的管状环带。隐藏端原图没有直接形态参考，应合理续成同一粉管；当前急窄口与尖片在完整部件上形成不自然端部。

**修复方向与保留内容：** 局部重画左回转及端部，恢复连续厚度、内外缘和自身粉色明暗，收成圆顺端。保留前后环现有搭接和默认腿侧位置；保护同层米色弧，勿借入腿、铃或前环像素。修后看完整两弧及默认前后粉环接合。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/anklet-back/marked.png) · [当前局部](review-02-evidence/regions/anklet-back/R12-current.png) · [参考局部](review-02-evidence/regions/anklet-back/R12-reference.png) · [同坐标并排](review-02-evidence/regions/anklet-back/R12-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/anklet-back/regions.json)。

**补充观察：** [完整两弧独显放大](review-02-evidence/ankle-solo.png) · [前后环可见对照](review-02-evidence/ankle-comparison.png) · [后环完整原尺寸](review-02-evidence/layers/02/solo-complete.png)。



### R13 — 左红晕细线过宽过浓

**相关图层：** `D076.00 | face/blush_left`。UUID见逐层索引。

**位置与当前表现：** 角色左颊，画面右侧。框[746,456,51,40]。 当前六条细线更宽、更浓，柔化后形成厚桃色条带；中部线间的红色容易黏在一起。1倍同尺寸并排也能看出线群比参考厚重。

**参考依据与影响：** standard.png本侧为较细、分明且逐渐淡出的线，叠在弥散红底上。这里需修的是线心宽度及红色分布，不是要求删掉红底，也不是仅凭细微像素浓淡差异判错。

**修复方向与保留内容：** 按本侧原图收窄线心、降低过浓的条带并修渐细尾端；保留原有不同长短、排列与弥散红底，线和底自然融色。先在原尺寸对照调线宽，再放大查有无硬边，不用整体加模糊代替细线。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R13-current.png) · [参考局部](review-02-evidence/regions/default-standard/R13-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R13-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [双颊1倍并排](review-02-evidence/blush-1x.png) · [双颊放大对照](review-02-evidence/blush-comparison.png) · [左红晕完整独显](review-02-evidence/layers/65/solo-complete.png)。



### R14 — 右红晕线群加宽并与底色黏连

**相关图层：** `D077.00 | face/blush_right`。UUID见逐层索引。

**位置与当前表现：** 角色右颊，画面左侧。框[619,459,52,42]。 当前右侧线群呈较宽的软条带，多条线的上半部和底色黏连；参考可分辨的细线间隔被压弱，整体更浓重。

**参考依据与影响：** standard.png右颊的细线有本侧独立长短、淡尾和间隔，不能用左侧镜像替代。1倍与放大对照均能看到当前线条宽度/红色分布的偏离。

**修复方向与保留内容：** 按右侧自身参考减窄、减浓并修淡尾，保留本侧线群位置和弥散红底，线间留出自然间隔。避免镜像左颊或擦掉红色底；原尺寸逐侧对照后再看本层独显。

**框选和局部证据：** [原画布框选](review-02-evidence/regions/default-standard/marked.png) · [当前局部](review-02-evidence/regions/default-standard/R14-current.png) · [参考局部](review-02-evidence/regions/default-standard/R14-reference.png) · [同坐标并排](review-02-evidence/regions/default-standard/R14-comparison.png) · [框坐标/图层说明](review-02-evidence/regions/default-standard/regions.json)。

**补充观察：** [双颊1倍并排](review-02-evidence/blush-1x.png) · [放大对照](review-02-evidence/blush-comparison.png) · [右红晕完整独显](review-02-evidence/layers/66/solo-complete.png)。



## 本次检查中已核实的结构与保留要求

- 辫子、骨盆、狸猫的两深度分片联合完整形体连续；三者共同part归属和现有深度分工有效。辫子与狸猫的待修项仅为R10/R11所述显露轮廓及线条。
- 当前肩胸和腰腹接合、两腿完整大腿过渡，未确认首轮所述明显断线、矩形补色块或台阶仍存在；不沿用旧报告自动重复列项。[肩胸对照](review-02-evidence/shoulders-comparison.png) · [腰腹对照](review-02-evidence/waist-comparison.png) · [大腿对照](review-02-evidence/thigh-comparison.png)。
- 右眼原尺寸及放大已查，未确认新增确定待修项；左眼需处理R01/R02。原图不对称的两眼不能互相镜像替代。眼内高光层未确认旧眼白矩形或虹膜鬼影仍存在。
- 前臂近肘端及掌指接触边属于覆盖侧，不仅凭这些人工接触边没有横向闭合描线就判缺陷；不要求为覆盖侧外扩余量或给默认接合增加横线。R05仅针对上臂伸入圆帽已有外轮廓未续完。R06/R07仅针对看清的多余线刺及外轮廓接合突变。
- 已去掉的衣物、腕饰/铃铛/耳罩/狸猫等外来投影不要求画回皮肤、头发或邻件。眉线选择性显露、闭嘴口内隐藏和后环带默认遮挡按其实际控制检查，不当作孔洞或部件缺失。

建议先修显露结构与曲线R10/R11，再修各所属层的轮廓、游离笔迹和隐藏收口，最后调整眼白融色与双颊线群。每项修后应同时复核完整独显、隐藏上层、蒙版开关、默认连接；双眼另做原尺寸逐眼对照。不能只用蒙版遮住完整部件瑕疵来宣称修好。

## 只读及检查结束状态

Krita只对本次打开的文档进行显隐切换和PNG导出，没有调用保存或写回KRA。检查结束已恢复81层及34蒙版原默认显隐，恢复后的默认PNG与本次初始导出像素一致：[Krita结束核对](review-02-evidence/krita-final-check.json)。

KRA、groups.json、occlusion.json检查前后SHA256一致：[只读核对及参考/parts最终快照](review-02-evidence/readonly-check.json)。其中参考和parts哈希是最终快照，未冒充不存在的前后比对；这些输入全程只读。哈希仅核实输入保存状态，不作为绘画质量判断。本次只写暂存review及证据，没有修改正式review/repair报告或运行标记。

报告完整，全部部件检查已完成；当前仍有上述14项确定问题，交由绘制会话逐项修复。
