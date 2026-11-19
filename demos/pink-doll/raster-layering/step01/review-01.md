结论：需要修复

# 第一步独立复核

当前 KRA 有 37 处确认需要返修。整图上最明显的是双眼眼白和睑褶色阶、发束拼接、衣身折光、腕掌与髋外缘。独显另确认了刘海中的眉线、上臂和腿根的残线、指根硬拼，以及完全禁用下齿的额外蒙版。

## 输入和检查范围

- 从 `raster-layering/step01/character-depth.kra` 重开工程，并按 `raster-layering/step01/report.md` 使用 `part-layering/references/base-subject.png`。两者均为 1254 × 1254，局部对照使用相同的原画布坐标。参考透明外缘已有的杂边未计入返修。`raster-layering/step01/` 在检查开始时有制作报告 `report.md`，没有正式的 review 或 repair 报告。
- 以 `part-layering/groups.json`、`part-layering/parts/` 的 SVG 和 `part-layering/occlusion.json` 核对了 58 个部件。KRA 的 58 个绘画层覆盖全部部件，实际深度顺序与 `occlusion.json` 一致。4 个无子项的根部件为头饰、颈、躯干、髋；其余 54 项为子部件。当前没有同一逻辑部件的多个深度分片。眼内和口内的组是蒙版容器。
- 从当前 KRA 对每层查看独显与隐藏全部较前层后的原位置。眼口内容另查蒙版开启、关闭的独显。复核整图、双眼及关键衔接时放大同一画布局部。以下独显页每项依次为「关闭蒙版的独显、隐藏较前层、同坐标原图」。

| 检查范围 | 实查层号 | 独显和深度证据 |
| --- | --- | --- |
| 后发、发髻 | 00–04 | [后发](review-01-evidence/layers-hair-back-1.png) · [发髻](review-01-evidence/layers-hair-back-2.png) |
| 双腿、髋、上下臂、颈、躯干 | 05–07、14–15、22–25 | [双腿](review-01-evidence/layers-body-1.png) · [髋颈躯干](review-01-evidence/layers-body-2.png) · [双臂](review-01-evidence/layers-body-3.png) |
| 双掌、十指 | 08–13、16–21 | [角色左手](review-01-evidence/layers-hands-1.png) · [角色右手](review-01-evidence/layers-hands-2.png) |
| 耳、脸底、眉、鼻、腮红 | 26–28、39–41、48–49 | [耳与脸底](review-01-evidence/layers-face-1.png) · [眉鼻与腮红](review-01-evidence/layers-face-2.png) |
| 眼白、虹膜、高光、睫毛、睑褶 | 29–38、55–56 | [角色左眼内部](review-01-evidence/layers-eyes-1.png) · [角色右眼内部](review-01-evidence/layers-eyes-2.png) · [上睑外形](review-01-evidence/layers-eyes-3.png) |
| 口腔、上下齿、舌、上下唇 | 42–47 | [口腔底、下齿、舌](review-01-evidence/layers-mouth-1.png) · [上齿、双唇](review-01-evidence/layers-mouth-2.png) |
| 胸前发、鬓发、刘海、头饰 | 50–54、57 | [长束与鬓发](review-01-evidence/layers-hair-front-1.png) · [刘海和头饰](review-01-evidence/layers-hair-front-2.png) |

**蒙版和剪贴。** 6 张原生透明度蒙版已逐张启停查看。每张均在默认合成和其他蒙版关闭的状态下测试，再隐藏上睑或双唇查看被覆盖的内容。Krita 节点树中未启用继承 Alpha 剪贴。双眼各两张蒙版只改变本眼开口处的眼白、虹膜或高光，关掉后可见上边缘的补绘余量。口内组的共同蒙版按双唇围合区域裁切。下齿层的单独蒙版有问题，见 R22。[双眼蒙版逐张切换](review-01-evidence/mask-control-eyes.png) · [口内两张蒙版逐张切换](review-01-evidence/mask-control-mouth.png)

## 框选证据

位置均为原画布 `[x, y, 宽, 高]`。左右按画面方位描述，层名里的 `left`、`right` 使用角色自身方位。各同坐标对照的左侧为实际参考，右侧为本轮 KRA 导出。独显补全处在原画中被遮住时，左图只说明遮挡位置，返修依据是本部件露出段的笔触走向和上游补全范围。

[同尺寸全身对照](review-01-evidence/overall-reference-current.png) · [双眼框图](review-01-evidence/eyes/marked.png) · [头脸框图](review-01-evidence/head/marked.png) · [身体框图](review-01-evidence/body/marked.png) · [后发独显框图](review-01-evidence/base_solo/marked.png) · [刘海独显框图](review-01-evidence/bangs_solo/marked.png)

## 双眼

### R01 画面左眼的眼白分面和睑缘

**位置与层** `[541,178,71,61]`，`34 face/eyes/eye_right/sclera`、`38 face/eyes/eye_right/eyelid_crease`、`56 face/eyes/eye_right/upper_eyelid`，在 `35 face/eyes/eye_right/iris` 邻边核对。原图靠外眼角的眼白有清楚的灰紫斜折，其顶部贴着睫毛内缘，靠鼻侧上方有暖红渐尖睑褶。当前灰紫折面被摊淡，睑褶接近浅黄，睑线上缘与刘海交点出现一段厚平接头，放大后削弱原有的尖收和眼窝层次。按原图从外眼角至虹膜左缘画回斜折明暗，沿睫毛内缘连顺，并将睑褶还原成有色阶、带渐尖的暖线。复核内眼角端点及睫毛接眼白的宽度，保留虹膜下部浅弧、两处高光及外角长钩。[同坐标对照](review-01-evidence/eyes/R01-comparison.png) · [双眼原尺寸](review-01-evidence/eyes-native.png) · [双眼等倍率放大](review-01-evidence/eyes-zoom.png)

### R02 画面右眼的眼白分面和睑缘

**位置与层** `[648,177,68,60]`，`29 face/eyes/eye_left/sclera`、`33 face/eyes/eye_left/eyelid_crease`、`55 face/eyes/eye_left/upper_eyelid`，在 `30 face/eyes/eye_left/iris` 邻边核对。原图虹膜右上方灰紫扇面斜接亮眼白，靠鼻一侧的睑褶颜色明显，外角深钩由厚逐渐变尖。当前灰白交界发软，睑褶变成低反差细弧，外眼角上睫与刘海交界的尖收变成折阶。眼白显得平，睫尖和眼角的细形不清。按该眼自身的原画重画灰紫斜面、睑褶的暖色与两端渐细，分层接顺上睫毛与眼白，逐像素对齐外角尖收并保留原有虹膜亮点、深边和下缘亮弧。[同坐标对照](review-01-evidence/eyes/R02-comparison.png) · [双眼原尺寸](review-01-evidence/eyes-native.png) · [双眼等倍率放大](review-01-evidence/eyes-zoom.png)

## 头发

### R03 头顶分缝接至刘海根部

**位置与层** `[590,24,77,33]`，`04 hair/back_hair/base`、`52 hair/side_hair/side_hair_left`、`53 hair/side_hair/side_hair_right`、`54 hair/bangs`。原画上部细 V 与下部两条渐尖暗弧之间有连续浅发面。当前 V 尖向下拖出重钩，刘海顶部又叠一段小回纹，左右暗弧起笔被压短。整头出现额外接头。沿原画重定同一小段暗弧与浅发面的归属，在刘海根接续两个细尖，清除下面叠到 V 尖的纹线，保留顶弧浅亮边。[同坐标对照](review-01-evidence/head/R03-comparison.png) · [放大及独显](review-01-evidence/close-hair.png)

### R04 刘海发尖压平和残边

**位置与层** `[540,166,175,41]`，`54 hair/bangs`。中央与靠两眼的发尾有多处平截、台阶和暖肤碎边，独显也可见。原图有长短不一的弧形收尖、细小回钩，与脸交界线有连贯的粗细变化。当前缕尾像切齐，原有轻薄发尖变钝。沿每缕原有曲线收笔，保留中央宽缕和真实露额缝，擦除发尖上的肤色边并将暗边接到尖端。[同坐标对照](review-01-evidence/head/R04-comparison.png) · [放大及独显](review-01-evidence/close-hair.png)

### R05 刘海独显带有双眉笔痕

**位置与层** `[545,149,160,23]`，`54 hair/bangs`、`39 face/eyebrows/eyebrow_left`、`40 face/eyebrows/eyebrow_right`。两眉关闭后，细发缕上仍可见与原画眉线同高、同走向的横笔。原图在发缝和贴着细缕的位置都能接读眉形，上游把眉线交给独立眉层。当前残笔会随刘海移动并留在眉关闭时。沿发缕方向重画污染区，接回发丝明暗，把露出的连续眉迹交还双眉，通过实际重叠、细缕的边缘覆盖来复现参考眉弧。完成后分别隐藏眉和刘海核对。[默认对照](review-01-evidence/head/R05-comparison.png) · [独显框选对照](review-01-evidence/bangs_solo/R05-comparison.png) · [刘海与双眉并列独显](review-01-evidence/close-brow-ownership.png)

### R06 画面左鬓发断线和细尖残色

**位置与层** `[510,181,74,121]`，`53 hair/side_hair/side_hair_right`。外眼角旁纵发纹出现折断，靠耳短钩有浅白边，长尖线条的渐细不如原画连续。短钩上的浅色在独显时仍露出，和脸肤相接时像多一圈毛边。沿原图恢复从眼角到耳前的两条弧线，分别留住短钩和长尖。在本层清掉夹带的浅色并补回本束渐变，把耳底留给耳层。[同坐标对照](review-01-evidence/head/R06-comparison.png) · [放大及独显](review-01-evidence/close-hair.png)

### R07 画面右鬓发断线和亮碎点

**位置与层** `[674,173,73,128]`，`52 hair/side_hair/side_hair_left`。原图眼角到长梢有连贯窄深线，短尖由弯曲发面自然收细。当前内线有阶梯、局部双暗边，独显短尖最末留有孤立亮点。顺着原画线的弧向和压笔宽度接线，融掉双暗边之间的硬色，短尖用本束色干净收笔，保留短尖与长束之间实际的分叉。[同坐标对照](review-01-evidence/head/R07-comparison.png) · [放大及独显](review-01-evidence/close-hair.png)

### R08 画面左髻编股粘连

**位置与层** `[451,76,84,105]`，`03 hair/bun/bun_right`。黑结下方和圆珠侧的原图能逐股认出环抱、交叠与深缝。当前相邻股界发灰，有平行软重线，独显时近内根接入处也有不随发股弧向的暗痕。黑结下露出的股数和体积不清。沿可见发股逐股取样或复画，再顺弧延伸至黑结与前发后方，抹去双边，只保留发股自身的褶面暗部。[同坐标对照](review-01-evidence/head/R08-comparison.png) · [带头饰及独显放大](review-01-evidence/close-head-detail.png)

### R09 画面右髻叠压和亮面丢失

**位置与层** `[716,63,83,115]`，`02 hair/bun/bun_left`。原图从上到下是清楚的亮股搭暗股，外侧股面还有细亮笔触。当前中下编带成团发灰，新增的浅灰影线挤占深缝，独显内根有横向接纹。逐股恢复交错压叠次序、亮面窄笔和深缝端点，隐藏内根顺现有股线纵向补画，保留外轮廓各小弧的起伏。[同坐标对照](review-01-evidence/head/R09-comparison.png) · [放大及独显](review-01-evidence/close-head-detail.png)

### R10 画面左髻下的外发根断接

**位置与层** `[489,144,46,103]`，`04 hair/back_hair/base`、`01 hair/back_hair/lock_right`、`53 hair/side_hair/side_hair_right`。原图髻底旁的浅轮廓顺后发一直下行。当前约 y170 的浅条平切并错开，下方变成深阶，露出的外发根无法连读。对齐三层共用的弧线切向，把原图细亮边自然延续进根端。重画交界的暗面和渐窄亮带，保持髻在根端前的遮挡。[同坐标对照](review-01-evidence/head/R10-comparison.png) · [根段独显](review-01-evidence/close-back-roots.png)

### R11 画面右髻下的外发根断接

**位置与层** `[715,141,43,102]`，`04 hair/back_hair/base`、`00 hair/back_hair/lock_left`、`52 hair/side_hair/side_hair_left`。髻底以下的窄浅边在参考连续下弯，当前浅边短截并露深色小台阶。外缘和中间发面像两块贴片。按本侧原画从髻底延到长束，缩薄浅边并跨层接顺内外线，把平截藏入真实叠压范围。[同坐标对照](review-01-evidence/head/R11-comparison.png) · [根段独显](review-01-evidence/close-back-roots.png)

### R12 画面左后束下段拼带与发尖

**位置与层** `[417,455,88,216]`，`01 hair/back_hair/lock_right`。原画外细股和宽股的内线各自长向收束，腕边暗尖有渐收轮廓。当前细股回到宽股处出现短横缝，宽股内部是突变的直向色带，独显尖端前可见笔纹被盖断。沿同一发束的长轴复画明暗与末端细线，将横缝两侧融成一股。原图外侧细股的狭缝、腕边后发尖及前臂的遮挡位置均可作为形状锚点。[同坐标对照](review-01-evidence/head/R12-comparison.png) · [放大及独显](review-01-evidence/close-hair-low.png)

### R13 画面右后束下段拼带与发尖

**位置与层** `[740,455,87,216]`，`00 hair/back_hair/lock_left`。原图从外股逐渐隐入宽股的折面，当前变成短横接缝和深浅大色带，独显下梢处旧线在补片边中止。按参考的宽暗褶和外细缕分别补接，在末端收细暗线并融掉拼片横边，保留细缕与宽股间原有的空气缝及腕旁两处发尖。[同坐标对照](review-01-evidence/head/R13-comparison.png) · [放大及独显](review-01-evidence/close-hair-low.png)

### R14 画面左胸前束的根端横纹

**位置与层** `[496,156,69,246]`，`51 hair/front_long_hair/front_long_hair_right`、`53 hair/side_hair/side_hair_right`。关闭鬓发后，前束根端有成排横纹，接到露出段时成碎深带。原图可循鬓发下的纵纹和暗折读到肩前，当前连接处发面显得起皱。把根端补为纵向顺发纹，按本侧参考取样接回宽亮部与内暗折，根端继续由鬓发的实际深度覆盖。[同坐标对照](review-01-evidence/head/R14-comparison.png) · [放大及独显](review-01-evidence/close-hair-low.png)

### R15 画面右胸前束的根端横纹

**位置与层** `[689,157,64,246]`，`50 hair/front_long_hair/front_long_hair_left`、`52 hair/side_hair/side_hair_left`。独显上端成排横线，露出段的两道暗色纹呈锯齿状跳色。原图这里是一条连续长面带着转折暗面。把色阶和结构线沿本侧发流接回鬓发下方，保留原来的长弧宽度与内暗外亮关系，清除横纹和补片碎边。[同坐标对照](review-01-evidence/head/R15-comparison.png) · [放大及独显](review-01-evidence/close-hair-low.png)

### R16 颈两侧后发出现横弧

**位置与层** `[547,280,158,60]`，`04 hair/back_hair/base`。参考颈两侧是连续下行的深发缕。当前前方叠着横穿纵纹的暗弧，关闭脸、颈、衣身后仍留在后发，形成看似另一部件边线的痕迹。沿本件长发流去掉横弧并补接纵线及折面；颈的剪影由 `24 neck` 的实体叠压获得。[合成对照](review-01-evidence/head/R16-comparison.png) · [独显框选对照](review-01-evidence/base_solo/R16-comparison.png)

### R17 中央后发的隐藏下沿截断发纹

**位置与层** `[533,578,187,74]`，`04 hair/back_hair/base`。参考这里被躯干盖住。独显两侧有小尖，中段多条宽缕则同时被两段斜直裁边截断，纹理直接碰到透明，缺少自然收笔。隐藏上层或换姿时会读成裁片边。以当前后发补全范围为边界，顺各缕既有方向画出合理收拢与前后层次，让深褶线和明暗逐缕结束，留住两侧回尖，最终核对整图无新增露段。[独显框选对照](review-01-evidence/base_solo/R17-comparison.png) · [下沿放大](review-01-evidence/close-base-tip.png)

## 面部与开口

### R18 画面左颊红晕扁平

**位置与层** `[563,231,45,30]`，`28 face/face_base`、`49 face/blush_right`。参考的红晕集中在排线周围，向肤底柔化，近脸侧另有小亮部。当前独立腮红多为淡线和极浅底，合成转成一片更均匀的粉色，脸侧小亮部消失。把原图局部暖红底及有浓淡的斜线画入腮红层，普通肤色渐变和颊侧小亮部留在脸底。关掉腮红核对脸底仍干净。[同坐标对照](review-01-evidence/head/R18-comparison.png) · [独显与放大](review-01-evidence/close-face.png)

### R19 画面右颊红晕失去局部层次

**位置与层** `[657,228,49,30]`，`28 face/face_base`、`48 face/blush_left`。参考排线有局部红底承托，靠鬓发有小块浅亮，当前红晕底与周围泛粉接近，排线及亮面的层次弱。按本侧参考控制暖红底的面积和软度，恢复排线每笔的起收及近鬓发亮面，保持淡入肤色并避开鬓发描边。[同坐标对照](review-01-evidence/head/R19-comparison.png) · [独显与放大](review-01-evidence/close-face.png)

### R20 鼻点上方亮笔缺失

**位置与层** `[625,229,13,14]`，`41 face/nose`、`28 face/face_base`。参考有小暗点、周围微暖皮肤及其上方小浅亮点；当前鼻层只有近乎直立的暗点，脸底对应高光也没有。鼻面体积被压成一个符号。取回同坐标的鼻部亮笔和暖晕，暗点按原形保留柔边，范围局限在鼻部。[同坐标对照](review-01-evidence/head/R20-comparison.png) · [独显与放大](review-01-evidence/close-face.png)

### R21 上下唇接线和嘴角硬化

**位置与层** `[610,250,44,34]`，`42 face/mouth/mouth_interior`、`44 face/mouth/tongue`、`45 face/mouth/upper_teeth`、`46 face/mouth/lower_lip`、`47 face/mouth/upper_lip`。原图上唇两端圆收，下唇的 U 线由深转淡并带浅亮肤边，口角深色斜接舌的暖面。当前上端近乎平角，嘴角加厚，唇边亮带丢失，齿带和舌面之间的分段更板直。沿原画逐侧复原嘴角弧度及线宽渐变，将齿带、口角深色和舌面按各自笔触分层接顺，最后以修妥的双唇内缘核对开口。[同坐标对照](review-01-evidence/head/R21-comparison.png) · [放大及独显](review-01-evidence/close-face.png)

### R22 下齿蒙版整层熄灭

**位置与层** `[617,272,31,12]`，`43 face/mouth/lower_teeth`、`46 face/mouth/lower_lip`、`下唇覆盖 ｜默认下齿隐藏`、`上下唇开口 ｜默认微笑`。参考默认微笑看不见下齿，上游说明其位置在舌和下唇后。独显 43 时，单独启用前一张蒙版会令整层透明，禁用才见完整齿带。保留共同开口、只关闭下齿专用蒙版时，合成保持同一默认微笑；关闭共同开口后才见下唇外的齿带。额外的全层熄灭会阻断下齿在其他实际开口状态的显示。修复时解除下齿专用蒙版，保留下齿绘画，仍由舌、下唇自身叠压和共同双唇开口控制显露。检查默认姿态及扩大开口时齿带仅在开口内露出。[位置对照](review-01-evidence/head/R22-comparison.png) · [逐张切换](review-01-evidence/mask-control-mouth.png) · [只关闭下齿专用蒙版](review-01-evidence/mask-mouth-default.png)

## 肩颈、躯干与手臂

### R23 颈根多出描边

**位置与层** `[555,287,150,69]`，`24 neck`、`25 body`。原图颈根到锁骨用肤面软过渡，颈侧与后发之间有深而顺的结构边。当前颈根出现一条灰细硬弧，靠左右支点的轮廓变虚，锁骨附近亮部偏窄。颈和躯干看得见切片边。复原两侧结构线的走势与端点，用相邻肤色软接颈根，接回锁骨的淡亮层次。保留原图结构，避免把下颌或头发的投影烙进颈层。[同坐标对照](review-01-evidence/body/R23-comparison.png) · [肩颈等倍率对照](review-01-evidence/joins-top.png)

### R24 画面左肩断边和上臂残线

**位置与层** `[482,332,73,181]`，`23 arms/arm_right/upper_arm`、`25 body`。参考肩外线从圆肩连续下行。当前肩弧有浅色断点；独显上臂内侧另有纵向红褐断边和两小段深直线，独显躯干肩片也带断线。露肩时有破口，上层移开时会暴露临时裁边。修净两个层内的重线，沿肩弧与上臂的体积方向渐接肤色和高光，恢复外缘这一段的连续描边，靠肘保留自然暖面。[同坐标对照](review-01-evidence/body/R24-comparison.png) · [上臂独显](review-01-evidence/close-arm.png) · [圆肩和躯干独显](review-01-evidence/close-joints.png)

### R25 画面右肩白台阶和上臂残边

**位置与层** `[695,332,76,181]`，`15 arms/arm_left/upper_arm`、`25 body`。参考肩外弧是从肩峰过到右臂的连续轮廓，当前约 y356–366 出现白色台阶。独显上臂的臂长方向有硬直色阶，躯干肩片内有几段未接起来的线，使肩端像两张切片重贴。按本侧原图接回肩外线，并以圆肩遮住近端，去掉两片内部的假边，顺肤面的暖—浅变化融接直条。[同坐标对照](review-01-evidence/body/R25-comparison.png) · [上臂独显](review-01-evidence/close-arm.png) · [圆肩和躯干独显](review-01-evidence/close-joints.png)

### R26 躯干布面增加斜褶和重线

**位置与层** `[511,330,232,217]`，`25 body`。参考连体服胸腹以轻柔连续明暗和两条纵向车缝塑形。当前中胸到腰有额外斜波亮纹，车缝灰散、起锯齿；独显时两条肩带下还多出向下并行、与主缝相叠的残线。布面厚薄和缝线结构偏离原图。以原图同材布面取样和低对比笔触重塑露面，补形顺真正的肩带与车缝，删掉不属于结构的并行残线，留住领口原有双线。[同坐标对照](review-01-evidence/body/R26-comparison.png) · [放大及独显](review-01-evidence/close-body-paint.png)

### R27 腰口拼接及髋前布面

**位置与层** `[515,529,218,197]`，`25 body`、`07 pelvis`。原图两条腰缝穿过同材布面时连续收向腿口，髋前大面平缓。当前在两层接头附近可见缝线角度和笔宽变化，髋前约 y600–630 有硬横色差与多余斜褶，裆端包边发灰。调齐两层腰口的色阶与车缝切向，在隐藏搭接处留出连续布面；按原画复原腿口双线与裆底短边，保留腿口自身的深浅边。[同坐标对照](review-01-evidence/body/R27-comparison.png) · [放大及独显](review-01-evidence/close-body-paint.png) · [腰口独显接点](review-01-evidence/close-joints.png)

### R28 画面左腕与掌外线断口

**位置与层** `[438,641,42,62]`，`22 arms/arm_right/forearm`、`21 arms/arm_right/hand/palm`。原图外侧线从前臂细收进掌缘；当前交点露出短浅口，原本连续的深边被截开。延伸前臂下缘和掌体腕根的覆盖量，使两线在同一笔宽、方向和色值下接合，同时连续接入掌侧肤色。[同坐标对照](review-01-evidence/body/R28-comparison.png) · [放大及两层独显](review-01-evidence/close-arm.png)

### R29 画面右腕与掌边台阶

**位置与层** `[768,641,43,62]`，`14 arms/arm_left/forearm`、`13 arms/arm_left/hand/palm`。原图的腕窝和细暖侧缘平滑接到掌侧。当前交点轮廓有小台阶，浅色从接点跳出，腕掌仍可看出拼接。对齐两层外轮廓和侧缘暗笔，到接头两侧逐渐融合亮肤和暖色；搭接伸入另一层的实际遮挡区，复看独显和合成。[同坐标对照](review-01-evidence/body/R29-comparison.png) · [放大及两层独显](review-01-evidence/close-arm.png)

### R30 画面左手虎口断线及指根补片

**位置与层** `[423,698,47,76]`，`16–21 arms/arm_right/hand/…`，其中 `16 ring_finger`、`17 middle_finger`、`18 index_finger`、`19 little_finger`、`20 thumb`、`21 palm`。原图虎口暖暗三角和内屈三指的外侧折线连续，浅掌外缘逐步变暖。当前三角上沿断成点状，内屈指近端正面有浅色截面，17、18 独显可见硬横线。按原图把虎口弧归给掌、指缘归给正确手指，从远指继续画出圆滑的指根体积和侧面明暗，清除横截色阶，保证掌下正常搭接。保留原有拇指甲亮部及三个露出指尖的叠压。[同坐标对照](review-01-evidence/body/R30-comparison.png) · [各指与掌体独显](review-01-evidence/close-left-fingers.png)

### R31 画面右手掌指灰隙和暗线串层

**位置与层** `[775,698,51,76]`，`08–13 arms/arm_left/hand/…`，其中 `08 little_finger`、`09 ring_finger`、`10 middle_finger`、`11 index_finger`、`12 thumb`、`13 palm`。参考拇指后方为连续暖暗的指根与虎口，当前掌下一小条灰隙夹在硬亮肤块和弯指之间。08、09 独显可见额外暗笔和方折，暖指层次在合成时变成拼片。清除各指上不随自身形体的线，圆接近端暖侧面，把缺的接触区补在实际相连的掌指层，保持浅色拇指、浅色外指和三枚暖指现有前后关系。[同坐标对照](review-01-evidence/body/R31-comparison.png) · [各指与掌体独显](review-01-evidence/close-right-fingers.png)

## 腿、袜口和鞋扣

### R32 画面左髋外缘断线和衣口残弧

**位置与层** `[497,608,125,134]`，`06 legs/leg_right`。参考从发尖下方到大腿外侧是连续深轮廓，目前上段掉线，约 y690 后突然恢复。独显的大腿根还有一条与衣口同走向的暗暖斜弧及相邻补色，像衣口仍留在皮肤上。沿露出段重接原外描边并向遮挡内部续笔，擦除独显残弧后按大腿自身的圆转渐变融色，髋衣口仍交由 `07 pelvis` 覆盖。[同坐标对照](review-01-evidence/body/R32-comparison.png) · [解除遮挡与独显](review-01-evidence/close-leg-root.png)

### R33 画面右髋外缘断线和衣口残弧

**位置与层** `[626,608,126,134]`，`05 legs/leg_left`。参考髋外缘在发梢后出露后保持细深线，当前发尖下方至较低位置轮廓变成一段浅平切边，随后跳回深线。独显内侧有一条贴合衣口走向的斜弧和色块交界。按该侧参考恢复外缘等宽渐细的连续笔触，隐藏近端以同一肤色明暗过渡接回腿体并去掉衣口残影，保持髋衣口和发尖的实际深度关系。[同坐标对照](review-01-evidence/body/R33-comparison.png) · [解除遮挡与独显](review-01-evidence/close-leg-root.png)

### R34 画面左袜口波纹重影

**位置与层** `[529,1061,68,57]`，`06 legs/leg_right`。参考袜口顶边是一条清楚的波纹，荷叶翻边以裙摆暗线和布褶立体。当前肤面上另叠一条平移波纹，荷叶边波谷留有灰色碎线。擦除重复的肤面波纹，从真波峰、波谷逐段接回复原的轮廓，重画翻边窄高光和底部软暗。[同坐标对照](review-01-evidence/body/R34-comparison.png) · [双袜独显放大](review-01-evidence/close-boot.png)

### R35 画面右袜口波纹重影

**位置与层** `[651,1061,73,57]`，`05 legs/leg_left`。参考上口各波弧清晰，当前多出一条退位淡弧，在两端还有进入小腿肤面的短线，荷叶底边与折面混在一起。清理假顶线及端点碎笔，按本侧原图接唯一袜口实体边，分别画清褶面阴影与下沿条线。[同坐标对照](review-01-evidence/body/R35-comparison.png) · [双袜独显放大](review-01-evidence/close-boot.png)

### R36 画面左鞋扣与鞋带交接粗糙

**位置与层** `[526,1137,51,61]`，`06 legs/leg_right`。原图金扣内孔及带边分明，当前内角有不规则重线，扣下及带边出现淡色碎边。扣孔和真正带边难以分清。局部按该只鞋参考的金色亮边、孔形与深线复画，维持孔内亮面并擦掉带边外的碎线，保留带宽和鞋整体形状。[同坐标对照](review-01-evidence/body/R36-comparison.png) · [双鞋放大](review-01-evidence/close-shoes.png)

### R37 画面右鞋扣下短线

**位置与层** `[681,1137,46,69]`，`05 legs/leg_left`。原图鞋带端接扣后，扣下鞋面干净。当前扣下有横向短灰线，金扣亮部和鞋带端的轮廓叠混，像多一截细带。清除扣下短线，按本侧参考原位置接齐扣孔、扣亮边与带端，维持鞋面柔色渐变和鞋带弧度。[同坐标对照](review-01-evidence/body/R37-comparison.png) · [双鞋放大](review-01-evidence/close-shoes.png)
