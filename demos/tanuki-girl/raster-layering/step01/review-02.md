结论：需要修复

# 第一步独立 review-02

已查完当前 Krita 工程全部 **78 个逻辑 part、85 个绘画深度片**；确认 **24 项需要修复的问题（R01–R24）**。主要问题是后发缺口及层级、发梢和白背景残片、眼睑混入虹膜线、眉/红晕还原偏差、颈胸和肩带接点、腿口断线，以及隐藏补全端和指部细节。

检查工程：`raster-layering/step01/character-depth.kra`，1376×2048。依据 `raster-layering/step01/report.md`，主参考为 `part-layering/references/standard.png`；胸肩、腰髋和临时白色连体服采用 `part-layering/references/base-subject.png`。原外衣与临时白服之间的差异按已确定的素体范围处理。

已读取 `part-layering/parts/`、`part-layering/groups.json`、`part-layering/occlusion.json`，以及正式 `review-01.md`、`repair-01.md`、`report.md`。本报告所有当前图都从本轮实际打开的 KRA 重新导出；旧报告仅用于了解已知问题。

## 检查方法与覆盖

在独立打开的 Krita 文档中，对85片逐片导出并看过：①停用所有显隐蒙版后的本片独显；②停用蒙版、保留本片及更低深度并隐藏所有上层。另分别看过7个多深度 part 的每片与联合独显，5个蒙版的独显/合成 OFF 与 ON，默认整图与两张实际参考。双眼已按同画布原尺寸并排，并放大检查睫毛、眼轮廓、虹膜、高光及眼白接边；头发、颈肩、领口、胸侧、腰髋、肘腕、手指、腿足、踝饰与尾巴也逐区放大。未用图像评分代替看图。

透明图均另放在中灰底观察，尤其白背景残片、浅边与离散像素。局部放大使用同坐标最近邻；未移动、缩放参考以追求匹配。原始1376×2048导出与所有检查视图均归档。工具框选的显示副本仅按alpha合成到中灰底，编号、框坐标与画布内容不变；原始透明工具图和原始记录同时保留，件外全透明RGB不列作瑕疵。

全画布对照（左 standard、中 base-subject、右当前）；[原尺寸全图](review-evidence/independent-02/whole-native.png)。



双眼原尺寸：左组为 standard 双眼，右组为当前双眼；[放大双眼](review-evidence/independent-02/details/eyes.png)。



## 确定返修项

坐标均为原1376×2048画布 `[x, y, width, height]`。工具框选使用当前 KRA 的默认、独显或联合独显导出；每项明确说明状态。隐藏部件的同坐标参考可能显示遮挡物，参考用于可见材料、线型与姿态，补全形体还依据本件分组/范围。R14、R15、R18、R19要求续完隐藏轮廓，同时保持默认合成没有新增腰线或肘封口线。

### R01 — 狸饰叶片：外形和叶脉改动

相关图层：`D12 | head_accessories/tanuki_ornament/tanuki_body | back`。

位置：`[640, 25, 117, 88]`。当前表现：叶片下缘更低、更圆；右边凹口的开口、下唇轮廓与参考不同，上侧中央凹弧及两尖端也改变。叶脉交点下移，分支改道，外围棕线更粗。

参考依据与确认方式：standard.png 同坐标叶片：下缘较平，右侧有较小的折转凹口，原叶脉交叉及各支脉有固定走向。D12 独显和 D12+D85.5 合看都保有当前差异。

影响：头顶识别性形状、尖端与线条层次被重画成另一种轮廓，未还原原图结构。

修复方向：在 D12 内按原图配准两尖、中央凹弧、右侧凹口和下缘；用本叶片取样或笔触恢复原脉交点、分支与线宽，接顺到狸头接触边。

需要保留：叶片仍归 tanuki_body，狸头与下颌前片的现有连续关系及双爪独立层。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R01-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R01-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R01-comparison-gray.png)。

1=standard；2=默认合成，5倍最近邻。



### R02 — 右侧后发：缺口被耳机带填占

相关图层：`D14 | hair/back_hair`；`D15 | headphones/headband`。

位置：`[731, 488, 80, 75]`。当前表现：默认合成中，右侧颈后红发露出有深边的粉红/红色矩形带片。隐藏 D15 后同位置变成弧形透明缺口；D14 独显也直接显示这块缺口。

参考依据与确认方式：standard.png 该区域是完整红色发面和顺向发缕，没有矩形环带。归属通过实际 KRA 的 D14 独显、D15 独显和停用 D15 合成共同确认。

影响：后发自身不完整，默认层级还让耳机带侵入原图连续发面。仅换层序会留下缺发。

修复方向：先在 D14 补回缺口内的红色发面、明暗和顺向发缕，使发面连为一片；再将这一段 D15 后带置于后发之后。若只需局部深度变化，使用普通深度分片并同步有效 occlusion；完成后复查 D14、headband union 和默认合成。

需要保留：完整耳机U带和 D22.25 接头，耳罩独立内容；保持原颈缘和红色发梢。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R02-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R02-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R02-comparison-gray.png)。

1=standard；2=D14 独显；3=默认合成；4=只停用 D15，5倍。



### R03 — 侧发翼下：不透明白背景残片

相关图层：`D83 | hair/side_hair/side_hair_right`。

位置：`[498, 389, 71, 35]`。当前表现：画面左侧外翻发翼与其下方细发缕之间夹有不透明白楔。D83 独显及灰底默认合成都仍是白色，而周围件外已经透明。

参考依据与确认方式：standard.png 此处白色属于发缕之间的参考背景，细粉发缕沿下缘回接。灰底局部证据确认白楔为实际可见内容，不是透明像素中的RGB。

影响：部件留有件外背景，换底或变形时会出现白色洞盖。

修复方向：在 D83 清掉发翼与细发缕之间的白底和白色毛边，恢复真实透明开口；只沿本件发丝做干净抗锯齿。

需要保留：下方细发缕的尖端、棕粉描边和与大束的连续接合，不把细发缕一并擦掉。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R03-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R03-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R03-comparison-gray.png)。

1=standard；2=D83 独显；3=默认合成，透明区域显示中灰，6倍。



### R04 — 刘海右下尖端：破碎回环与碎点

相关图层：`D84 | hair/bangs`。

位置：`[774, 413, 43, 45]`。当前表现：D84 的右下细尖端出现断续粉灰像素、C形小回环和一块深色碎点。默认合成在外眼角旁留下额外的小粉簇。

参考依据与确认方式：standard.png 同处是沿发丝走向的细尖收笔，没有回环。D84 独显把问题与睫毛及侧发区分开。

影响：尖端形状特征损坏，眼角与头发接点有毛刺。

修复方向：局部重画 D84 此尖端，将细发丝接为连续渐细的原走向，清掉回环及离开主尖端的碎点，按原图保留尖梢位置和线宽变化。

需要保留：真实外眼角钩线、相邻 D82 侧发和上方主刘海轮廓。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R04-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R04-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R04-comparison-gray.png)。

1=standard；2=D84 独显；3=默认合成，7倍。



### R05 — 辫子发圈处：横箍形残边

相关图层：`D57 | hair/braid_right | front`。

位置：`[574, 684, 40, 40]`。当前表现：D57 独显和辫子 union 在发圈遮挡处出现横向直边/色带，两侧有耳状小突起；纵向发缕在这条横箍处被截断。默认发圈下方仍露出小突起。

参考依据与确认方式：standard.png 的深色环带另归 hair_tie_front/back；该位置的头发应在收束后连续伸向辫尾。对照 D57 与 D88 独显可确认横箍形留在头发层中。

影响：部件携带邻件形状鬼影，发圈移动或头发变形时会暴露横断发面。

修复方向：在 D57 把发圈覆盖的区域重画为同一束收束头发，续接上方亮暗与发缕到下方散尾，清掉横箍形硬边和两侧残耳；环带外形只保留在发圈层。

需要保留：辫子自然收细的形体、前后两片共同运动身份与辫尾原尖梢，不把收束处画成等宽发棒。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R05/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R05/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R05/R05-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R05/R05-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R05/R05-comparison-gray.png)。

1=standard；2=D57 独显；3=D88 独显；4=默认合成，6倍。



### R06 — 左上眼睑：含虹膜外缘残线

相关图层：`D71 | face/eyes/eye_left/upper_eyelid`；`D67 | face/eyes/eye_left/iris`。

位置：`[765, 410, 16, 22]`。当前表现：上眼睑右内侧向眼白内垂下一小段黑色直边。D71 独显仍有它；在默认合成中停用 D67 和 D69 后，这段黑边仍悬在眼白上。

参考依据与确认方式：standard.png 同坐标这段垂边随橙色虹膜右缘，非上睫毛尖或外眼角钩。groups.json 规定深色虹膜外缘归 iris，上睑只领取连体上睫毛与外眼尾。

影响：单层内容归属错误，虹膜移动后会留下固定黑边，破坏眼白与上睑内缘的干净衔接。

修复方向：仅从 D71 清理这段伸入眼白的虹膜残边，并把上睑内缘接成连续弧；核对 D67 本身的完整外缘，必要时在 iris 上补回同件笔触。原尺寸并排复查睫毛、眼白和虹膜，不整体削薄上睑。

需要保留：上睫毛黑色主弧、真实尖睫毛与外眼角勾，虹膜层次及独立白高光。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R06/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R06/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R06/R06-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R06/R06-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R06/R06-comparison-gray.png)。

1=standard；2=默认合成；3=只停用左 iris/highlight，5倍。另见 eye-left-ownership.png 的各层独显。



[各层归属对照：参考、D71、D67、D69、默认](review-evidence/independent-02/details/eye-left-ownership.png)

### R07 — 左眉：发面段线重明显不足

相关图层：`D80 | face/eyebrows/eyebrow_left | back`；`D84.1 | face/eyebrows/eyebrow_left | front`。

位置：`[727, 347, 91, 30]`。当前表现：两个深度片合看虽连续，发面上的左眉仍变成很淡很细的线。外侧弧段和眉尾的粗细、力度比原图弱，原画可辨的完整眉弧在默认合成中不够清楚。

参考依据与确认方式：standard.png 左眉跨发面仍保有柔棕红线，且有可见的厚薄和尾端收笔；不是整条不可见。按本侧同坐标合成与独显 union 核对。

影响：原图眉形的线条特征与表情力度丢失。

修复方向：按本侧参考在 D80/D84.1 共同眉体上恢复原线宽、深浅和渐细收笔；维持分片接边连续，在发面与裸肤段分别调颜色/深度后用默认合成校准。

需要保留：两片是同一逻辑眉体，现有连续身份与本侧弧度差异；无需合并成另一侧镜像或加透明度蒙版。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R07-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R07-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R07-comparison-gray.png)。

1=standard 双眉；2=默认双眉，4倍。左眉另见 eyebrows-left-own.png。



### R08 — 右眉：细化浅化、斜段力度丢失

相关图层：`D81 | face/eyebrows/eyebrow_right | back`；`D84.2 | face/eyebrows/eyebrow_right | front`。

位置：`[599, 347, 86, 31]`。当前表现：D81+D84.2 合看连续，但右眉发面外侧斜段变浅变细，原图由斜段到近平段的厚薄过渡被弱化，末端更难辨。

参考依据与确认方式：standard.png 右眉原有明确的柔棕红斜弧及末端渐隐，发面覆盖处仍可见。按右眉实际长度、高度及弧度核对，未用左眉镜像替代。

影响：眉弧与收笔特征未按原图还原。

修复方向：在 D81/D84.2 联合眉体内逐段恢复本侧线宽、棕红深浅和斜段到平段的转弧，校准尾端渐隐；复看 union 和默认发面上的效果。

需要保留：右眉实际位置和前后片身份，裸肤段与发面段连续。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R08-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R08-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R08-comparison-gray.png)。

1=standard 双眉；2=默认双眉，4倍。右眉另见 eyebrows-right-own.png。



### R09 — 左红晕：红底扩浓、细线缩短

相关图层：`D76 | face/blush_left`。

位置：`[743, 451, 56, 50]`。当前表现：红色底变得更浓、更宽，尤其向眼下扩散；靠面中线的原长线缩短，多个斜线的长度和柔收笔与原图不同。

参考依据与确认方式：standard.png 左颊有浅而局部的红底与纤细渐隐长线。当前 D76 独显确实有红底，问题是红底范围和线形还原不足，不是漏画全部红底。

影响：面部色块范围和原斜线形状、长短层次改变。

修复方向：在 D76 保留红底职责，按原尺寸参考收回扩散范围并降低过浓区；逐线还原本侧位置、长度、倾斜和两端软收笔。用柔笔或本红晕取样接色，最后看默认合成。

需要保留：红底与斜线全部归 D76；脸底保持普通肤色，不能以只剩几条线代替红晕。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R09-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R09-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R09-comparison-gray.png)。

1=standard；2=默认合成；3=D76 独显，5倍。



### R10 — 右红晕：红云过大、下端线形改变

相关图层：`D77 | face/blush_right`。

位置：`[619, 454, 56, 52]`。当前表现：右颊形成比原图大且浓的红云，细线整体下伸、分布与渐隐变化，外侧线收笔较长，多个线之间的红底显著加深。

参考依据与确认方式：standard.png 右颊红底较轻，线与底的浓淡和长度关系清楚。D77 独显和原尺寸合成确认该差异属于红晕层。

影响：原面颊色块、细线密度与收笔未还原。

修复方向：按本侧参考收回红底下缘和外扩范围，重画对应细线的长度、间距与渐隐；不要整层均匀降透明度后保留错误长度，应同时修红底形状和线形。

需要保留：原红晕仍为带红底的一件，当前脸缘、嘴部和侧发保持各自归属。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/standard/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/standard/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/standard/R10-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/standard/R10-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/standard/R10-comparison-gray.png)。

1=standard；2=默认合成；3=D77 独显，5倍。



### R11 — 颈胸交界：浅白横边与短锁骨线

相关图层：`D22 | neck`；`D34 | body/torso`。

位置：`[632, 587, 156, 56]`。当前表现：两耳罩之间、约 y596 的颈胸交界露出细浅白横边；两条锁骨线比参考短、孤立，上胸不再像参考一样顺接颈部肤色。

参考依据与确认方式：base-subject.png 此处是连续颈胸肤色与向内延伸的锁骨弧，不含浅白水平边。D22、D34 独显及默认合成确认横边来自躯干上帽沿与颈部搭接。

影响：原尺寸可看见拼接线，锁骨结构被简化。

修复方向：在 D22/D34 内校准重叠位置与肤色，消除躯干上帽浅白线并以本件笔触接顺颈胸明暗；按辅助参考续画本侧锁骨弧及收笔。若隐藏帽缘需要换前后关系，用深度处理。

需要保留：颈部完整下安装端、耳罩和耳机接头，白服肩带各归自身；不新增颈胸横结构线。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/base/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/base/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/base/R11-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/base/R11-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/base/R11-comparison-gray.png)。

1=base-subject；2=D22 独显；3=D34 独显；4=默认合成，3倍。



### R12 — 画面左肩带—领口：斜截与台阶

相关图层：`D34 | body/torso`；`D35 | body/breast`。

位置：`[600, 615, 45, 90]`。当前表现：D34 细肩带到 D35 胸口上尖端时方向和落点不一致，胸片尖端像被斜切了一刀，线在接点突然重起。

参考依据与确认方式：base-subject.png 同侧肩带与胸口内侧线连续转弯，没有当前截断式尖端；独显与默认合成对照均可辨。

影响：衣料相连处有台阶和断续线，原领口曲线改变。

修复方向：校准 D34 肩带与 D35 领口尖端的接点，将边线、白布厚度、亮暗过渡续成原曲率；补画 D35 被截短的尖端，在默认合成中做到原尺寸无台阶。

需要保留：肩带宽度、原U形领口和胸部体积；辫子仍单独遮挡，不把发缘画进衣料。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/base/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/base/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/base/R12-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/base/R12-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/base/R12-comparison-gray.png)。

1=base-subject；2=D34 独显；3=D35 独显；4=默认合成，4倍。



### R13 — 画面右肩带—领口：断口和肩帽鬼线

相关图层：`D34 | body/torso`；`D35 | body/breast`；`D25 | arms/arm_left/upper_arm`。

位置：`[772, 593, 74, 117]`。当前表现：肩带下段与胸片领口上端不相接，D35 上端是平截/斜截的短头。肩皮肤内还露出一条原图没有的长圆帽弧线。

参考依据与确认方式：base-subject.png 该侧领口线与肩带连续，肩肤内部没有第二条圆帽轮廓；D34 独显及当前合成显示该弧线为肩帽边。

影响：连续领口被拆成两个错位端头，肩部多出安装轮廓，立体结构与原图不符。

修复方向：在 D34/D35 修齐接点、续画原领口内外边和相同白布过渡；对 D34/D25 的肩安装边调整覆盖深度，使本件完整帽沿藏在另一件之后，不把帽边作为肩肤内部结构暴露。

需要保留：完整上臂肩根、肩带与胸片各自体积及可变形身份；不用可见件透明度蒙版抹掉接边。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/base/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/base/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/base/R13-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/base/R13-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/base/R13-comparison-gray.png)。

1=base-subject；2=D34 独显；3=D35 独显；4=默认合成，4倍。肩帽全区另见 shoulders.png。



[肩帽全区参考/当前对照](review-evidence/independent-02/details/shoulders.png)

### R14 — 躯干下补全：外描边未接入圆帽

相关图层：`D32.5 | body/torso | lower_mount`；`D34 | body/torso`。

位置：`[576, 890, 260, 111]`。当前表现：D32.5+D34 联合独显已有圆形下腹和连续白布明暗，但两侧深色外线在分片下端突然停止。新圆帽轮廓主要是浅白边，未延续原侧缘描边。

参考依据与确认方式：base-subject.png 提供躯干可见侧缘的深灰棕线型与布面；隐藏帽形以本件上游范围为依据，不把原图腿口当成帽形模板。联合独显证明这不是单片切边误判。

影响：隐藏补全区与可见区的轮廓笔触中断，本件展开后呈现无描边补片。

修复方向：在 D32.5 补完沿隐藏下腹外轮廓的同材质边线，并在两侧与 D34 的原侧线接顺颜色、粗细和转弧；保持圆帽布面和明暗连续。

需要保留：当前圆形下帽和白布纹理、肚脐与前后深度片；轮廓留在骨盆覆盖之后，默认组合保持原腰部连续，不露新腰线。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R14/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R14/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R14/R14-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R14/R14-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R14/R14-comparison-gray.png)。

1=base-subject；2=D32.5+D34 联合独显，3倍；参考用于原侧线笔触，帽区在原图中被遮挡。



### R15 — 骨盆上补全：帽沿缺原外线延续

相关图层：`D33 | pelvis | front`。

位置：`[558, 849, 298, 100]`。当前表现：D33 上帽已为圆形白布面，但圆弧沿只剩浅白边；左右深色侧线在圆帽两肩处停止，没有接入隐藏弧沿。

参考依据与确认方式：base-subject.png 的可见髋侧边保有深灰棕描边；隐藏上帽依据本件完整范围检查。D33 独显和骨盆 union 均可见断续，非 D22.5/D33 深度片重复。

影响：部件独显的补全轮廓与原线型不连续。

修复方向：在 D33 内按现有圆帽补续本件外描边，重点把左右端接顺到帽弧，恢复原线型和渐变厚薄；白布色与帽面保持自然。

需要保留：完整圆上帽、骨盆前后片与现有髋肤、腿口；新补的隐藏轮廓保持在躯干后，默认不出现原图没有的腰线。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R15/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R15/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R15/R15-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R15/R15-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R15/R15-comparison-gray.png)。

1=base-subject；2=D33 独显，2倍；参考用于可见髋侧原线型，不声称原图有顶帽线。



### R16 — 画面左腿口：白补片截断棕边

相关图层：`D33 | pelvis | front`。

位置：`[586, 950, 76, 68]`。当前表现：裤口沿线中段出现浅白小补片，把深棕外边截断；其后边线以更细浅的线重新开始。D33 独显已经有这个缺口，默认合成仍可见。

参考依据与确认方式：base-subject.png 同段裤口是连续深灰棕外缘，随弧线有自然厚薄；原图没有白布伸出外边吞掉描边的片段。

影响：可见接边断线、粗细突变，局部有贴补感。

修复方向：在 D33 沿整段腿口接回原深棕外线，去除覆盖线的白色突片，把白布边宽、灰内线和棕外线各自连续接齐；从断口两侧渐接原线宽。

需要保留：原腿口曲率、骨盆髋肤及 D24 腿本体位置，不把腿肤或腿投影画入裤口修补。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/base/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/base/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/base/R16-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/base/R16-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/base/R16-comparison-gray.png)。

1=base-subject；2=D33 独显；3=默认合成，5倍。



### R17 — 画面右腿口：断边与布面残线

相关图层：`D33 | pelvis | front`。

位置：`[773, 944, 69, 88]`。当前表现：腿口棕色边线在浅白补片下消失一段，下方重起的线变细；断口上方白布还留有参考没有的短灰斜痕和碎灰线。

参考依据与确认方式：base-subject.png 的裤口深色边连续，附近白布干净，只有原纵向结构缝和腿口灰内线。D33 独显能直接看见白片和灰残线。

影响：可见部件不干净，原裤口描边和布面结构被破坏。

修复方向：在 D33 清去原结构线之外的短灰残痕，以本件白布笔触接色；按原图续接完整腿口棕边，修齐白布厚度与灰内线，避免细线重起和白片硬接。

需要保留：真实纵缝、灰内线、髋肤明暗及 D23 腿位置。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/base/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/base/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/base/R17-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/base/R17-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/base/R17-comparison-gray.png)。

1=base-subject；2=D33 独显；3=默认合成，5倍。



### R18 — 左上臂隐藏肘帽：外线止于补全端

相关图层：`D25 | arms/arm_left/upper_arm`。

位置：`[869, 821, 94, 53]`。当前表现：D25 肘端有圆形肤色帽，但棕色侧轮廓在端部停止，帽沿剩浅白/肤色硬边，局部没有描边延续。

参考依据与确认方式：base-subject.png 可见手臂外线为连续棕边；groups.json 指定 upper_arm 肘端是伸入 forearm 下方的圆弧搭接。此项只针对隐藏伸入帽沿，不判默认肘接缝有裂缝。

影响：本上臂独显时隐藏端的轮廓风格中断，补全只完成了色面。

修复方向：在 D25 的隐藏圆弧端续画本臂棕边和边缘明暗，将两侧线顺势接到帽端；维持端部在前臂之后，复查独显和默认外线仍连续。

需要保留：当前肤色过渡与圆帽范围、默认平顺肘接缝，不在默认肘内露出新封口线。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R18/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R18/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R18/R18-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R18/R18-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R18/R18-comparison-gray.png)。

1=D25 独显；2=D31 独显；3=默认合成，4倍；本项只框 D25 隐藏端。



### R19 — 右上臂隐藏肘帽：浅白硬边无描边

相关图层：`D26 | arms/arm_right/upper_arm`。

位置：`[481, 799, 80, 52]`。当前表现：D26 棕色侧线在肘帽左端明显停笔，圆帽下弧是较浅、较硬的肤色边，未接回本臂深色外线。

参考依据与确认方式：base-subject.png 同臂可见外线连续；本件是伸入 D32 下方的上臂圆帽，隐藏完整轮廓应延续自身线型。

影响：上臂独显补全端的轮廓线未完成。

修复方向：在 D26 隐藏端接续原棕线沿圆帽弧，保留自然粗细与肤色边明暗；不把帽裁短，用现有前臂深度遮住完整补全。

需要保留：目前默认平顺肘接点、完整肩根和上臂长度。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R19/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R19/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R19/R19-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R19/R19-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R19/R19-comparison-gray.png)。

1=D26 独显；2=D32 独显；3=默认合成，5倍；本项只框 D26 隐藏端。



### R20 — 左无名指：亮暗段硬拼

相关图层：`D38 | arms/arm_left/hand/ring_finger`。

位置：`[1055, 1036, 53, 43]`。当前表现：隐藏补全的淡黄亮段与可见暗粉指段在指身中途沿一条硬斜切界线拼接，界线旁轮廓也有小台阶；明暗不是围绕指腹的连续过渡。

参考依据与确认方式：standard.png 可见短指端提供本指暗面和轮廓；groups.json 要求整根无名指，不能只有露出指端。D38 独显显示隐藏段与可见段的硬材料接边。

影响：一根手指呈两块色段拼接，遮挡解除后会暴露硬色界。

修复方向：在 D38 本件内按指腹圆体积接续亮面、暗面和棕边，局部重画跨接边的皮肤过渡，修齐轮廓小台阶；复看独显及原默认露出短指端。

需要保留：原短指端位置、长度与指束遮叠，整根隐藏指身保留；不复制邻指轮廓或投影来盖接边。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R20/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R20/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R20/R20-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R20/R20-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R20/R20-comparison-gray.png)。

1=standard；2=D38 独显；3=D36 独显；4=默认合成，5倍。



### R21 — 右无名指：勺形根段与硬切色界

相关图层：`D39 | arms/arm_right/hand/ring_finger`。

位置：`[296, 1026, 67, 52]`。当前表现：隐藏近掌段膨成很宽的淡色圆勺头，接向窄指身时急缩；淡色与暗粉段间是一条近直线硬界，暗粉段上缘在该处突然换色。

参考依据与确认方式：standard.png 给出本指短圆露出段和同手指束形体。groups.json 要求完整并拢无名指及局部根部搭接，不是增加一个宽圆掌块。D39 独显直接显示扩宽根段和硬界。

影响：隐藏指身比例不合理、颜色拼接明显，独立形变时不能表现同一根指体。

修复方向：在 D39 保留原露出端，依据本手并拢姿势把根部到指身重画为连续合理宽度，接回指腹亮暗和细棕轮廓；根部搭接只留必要局部，消除直切色界。

需要保留：无名指独立身份、原短圆指端和本指与掌/中指/小指的深度关系。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R21/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R21/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R21/R21-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R21/R21-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R21/R21-comparison-gray.png)。

1=standard；2=D39 独显；3=D37 独显；4=默认合成，5倍。



### R22 — 左小指：软色棒缺轮廓和指部细节

相关图层：`D36 | arms/arm_left/hand/little_finger`。

位置：`[1056, 1030, 46, 43]`。当前表现：停用 D36 的 Default closed 蒙版后，小指是一根柔边肤色棒，只有简单粉色下缘明暗；没有本手的深棕外描边，也缺可辨的指端/指腹/指节细节。

参考依据与确认方式：原图本小指全被遮住，standard.png 此坐标不是其完整外观模板；参考同手可见手指的轮廓、端部与明暗语言，groups.json 明确整根小指及指节、指甲、指腹随本件。

影响：隐藏实体只完成通用色形，不能作为画完整的同一只手的手指。

修复方向：在 D36 按当前叠指姿态补画完整小指体积、指腹与指节，并续上同手深棕外线和指端结构；该姿态可见的甲缘细节随本指处理，不能把指甲强画到不应可见的一面。

需要保留：原小指方向、独立控制与根部局部搭接；Default closed 属全遮挡显隐，本蒙版本身不列问题。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R22/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R22/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R22/R22-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R22/R22-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R22/R22-comparison-gray.png)。

1=standard；2=D38 独显；3=D36 蒙版OFF独显；4=默认合成，5倍。另见 masks-all.png OFF/ON。



### R23 — 右小指：缺深色轮廓与指体结构

相关图层：`D37 | arms/arm_right/hand/little_finger`。

位置：`[309, 1021, 55, 40]`。当前表现：D37 蒙版 OFF 的小指为柔肤色棒，外轮廓全浅，指端、指腹和关节没有与同手其余手指一致的线形细节；仅有简单渐变。

参考依据与确认方式：原图右小指全遮挡；依据同手原图手指线型和 groups.json 的完整小指、指节与表面细节要求检查，不声称原图显示了本小指指甲。

影响：独显补全细节不完整，形体像通用色棒。

修复方向：在 D37 依当前并拢姿态重画指体圆转、指腹/指节和同手棕色外边，端部收笔与可见面细节合理接续到根部。

需要保留：完整根部与叠指深度，默认全隐藏状态与本件显隐蒙版；不制造替换手势。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R23/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R23/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R23/R23-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R23/R23-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R23/R23-comparison-gray.png)。

1=standard；2=D39 独显；3=D37 蒙版OFF独显；4=默认合成，5倍。



### R24 — 左腕粉环后段：模糊色棒、缺带边

相关图层：`D28 | arms/arm_left/bracelet_pink_back`。

位置：`[982, 967, 48, 58]`。当前表现：D28 独显为模糊粉色弯棒，深色内外边几乎没有，厚度面和亮暗条带也被软化；与同侧前段及原图环带不是相同笔触语言。

参考依据与确认方式：standard.png 粉环有深色边、清楚亮暗条带与带厚度。后段应是同一粉环绕腕背面的延续，D28 独显、隐藏上层图和同侧 D48 对照确认该差异。

影响：本后段的轮廓与立体结构不完整，转腕后会暴露低细节补全。

修复方向：在 D28 上沿现有后弧补画同环深色内外边、厚度侧面和粉色条带，接顺两端到前段的颜色、线宽与带宽；以本环笔触续画。

需要保留：后段完整弧形、前后夹腕深度及铃铛独立层，不把腕肤或前带投影涂进后环。

证据：[工具整图编号框（灰底）](review-evidence/independent-02/marks/R24/marked-gray.png)；[框坐标与图层记录](review-evidence/independent-02/marks/R24/regions.json)；[同坐标参考局部](review-evidence/independent-02/marks/R24/R24-reference.png)；[当前局部（灰底）](review-evidence/independent-02/marks/R24/R24-current-gray.png)；[工具左参考/右当前（灰底）](review-evidence/independent-02/marks/R24/R24-comparison-gray.png)。

1=standard；2=D28 独显；3=默认合成，5倍。



## 显隐蒙版 OFF / ON 核查

5个原生透明度蒙版均逐个检查停用/启用状态，并看过独显和全图合成。它们控制的都是上游标明在本参考姿态全遮挡的部件，未发现可见部件挂用于透见、融合或局部消隐的透明度蒙版。D36/D37的绘画缺陷列为R22/R23，蒙版本身不列问题。

| 蒙版父层/组 | OFF检查 | ON检查 | 判断 |
| --- | --- | --- | --- |
| `D10 \| legs/leg_left/thigh_band_back` | 后腿带完整可见；[独显](review-evidence/independent-02/masks/mask0-solo-0.png) / [合成](review-evidence/independent-02/masks/mask0-full-0.png) | 默认全隐藏；[独显](review-evidence/independent-02/masks/mask0-solo-1.png) / [合成](review-evidence/independent-02/masks/mask0-full-1.png) | 全遮挡显隐用途，已看OFF/ON |
| `D36 \| arms/arm_left/hand/little_finger` | 左小指完整底图可见；[独显](review-evidence/independent-02/masks/mask1-solo-0.png) / [合成](review-evidence/independent-02/masks/mask1-full-0.png) | 默认全隐藏；[独显](review-evidence/independent-02/masks/mask1-solo-1.png) / [合成](review-evidence/independent-02/masks/mask1-full-1.png) | 全遮挡显隐用途，已看OFF/ON |
| `D37 \| arms/arm_right/hand/little_finger` | 右小指完整底图可见；[独显](review-evidence/independent-02/masks/mask2-solo-0.png) / [合成](review-evidence/independent-02/masks/mask2-full-0.png) | 默认全隐藏；[独显](review-evidence/independent-02/masks/mask2-solo-1.png) / [合成](review-evidence/independent-02/masks/mask2-full-1.png) | 全遮挡显隐用途，已看OFF/ON |
| `D56 \| head_accessories/hair_tie_back` | 后发圈完整可见；[独显](review-evidence/independent-02/masks/mask3-solo-0.png) / [合成](review-evidence/independent-02/masks/mask3-full-0.png) | 默认全隐藏；[独显](review-evidence/independent-02/masks/mask3-solo-1.png) / [合成](review-evidence/independent-02/masks/mask3-full-1.png) | 全遮挡显隐用途，已看OFF/ON |
| `D61-64 \| Shared mouth opening` | 口腔、舌、上/下牙四片共同可见；[独显](review-evidence/independent-02/masks/mask4-solo-0.png) / [合成](review-evidence/independent-02/masks/mask4-full-0.png) | 默认全隐藏；[独显](review-evidence/independent-02/masks/mask4-solo-1.png) / [合成](review-evidence/independent-02/masks/mask4-full-1.png) | 全遮挡显隐用途，已看OFF/ON |



上图每行四列依次是：独显OFF、独显ON、合成OFF、合成ON。[蒙版名称与边界](review-evidence/independent-02/masks.json)；[原生图层及UUID](review-evidence/independent-02/tree.json)。

## 多深度同件检查

以下7个 part 已分别看各片，再联合看完整性；多片按既有深度职责检查，不判为重复。

| 逻辑 part | 深度片 | 联合独显与判断 |
| --- | --- | --- |
| `head_accessories/tanuki_ornament/tanuki_body` | `D12`, `D85.5` | [联合独显](review-evidence/independent-02/union/head_accessories__tanuki_ornament__tanuki_body.png)；已逐片/联合查看；关联R01 |
| `hair/braid_right` | `D13`, `D57` | [联合独显](review-evidence/independent-02/union/hair__braid_right.png)；已逐片/联合查看；关联R05 |
| `headphones/headband` | `D15`, `D22.25` | [联合独显](review-evidence/independent-02/union/headphones__headband.png)；已逐片/联合查看；关联R02 |
| `pelvis` | `D22.5`, `D33` | [联合独显](review-evidence/independent-02/union/pelvis.png)；已逐片/联合查看；关联R15, R16, R17 |
| `body/torso` | `D32.5`, `D34` | [联合独显](review-evidence/independent-02/union/body__torso.png)；已逐片/联合查看；关联R11, R12, R13, R14 |
| `face/eyebrows/eyebrow_left` | `D80`, `D84.1` | [联合独显](review-evidence/independent-02/union/face__eyebrows__eyebrow_left.png)；已逐片/联合查看；关联R07 |
| `face/eyebrows/eyebrow_right` | `D81`, `D84.2` | [联合独显](review-evidence/independent-02/union/face__eyebrows__eyebrow_right.png)；已逐片/联合查看；关联R08 |

单片切边不作为本件不完整的依据；例如躯干 R14 在联合图里仍缺外线，眉毛 R07/R08 则是联合与合成中的原线型还原差异。

## 全部85绘画片的检查索引

下表每行均已独显及隐藏全部上层查看；灰底联图左为独显、右为隐藏上层。同一联图包含5行部件，按本表顺序排列。无关联编号表示该片本轮未发现确定要修的问题，不代表可以替代返修后的再次自查。[完整覆盖JSON（含UUID）](review-evidence/independent-02/coverage.json)。

| 实际图层（由后向前） | 独显 / 隐藏上层 / 灰底联图 | 关联问题 |
| --- | --- | --- |
| `D0 \| tail` | 已看：[独显](review-evidence/independent-02/solo/D0.png) / [隐藏上层](review-evidence/independent-02/below/D0.png) / [联图](review-evidence/independent-02/sheets/layers-00-04.png) | — |
| `D10 \| legs/leg_left/thigh_band_back` | 已看：[独显](review-evidence/independent-02/solo/D10.png) / [隐藏上层](review-evidence/independent-02/below/D10.png) / [联图](review-evidence/independent-02/sheets/layers-00-04.png) | — |
| `D11 \| legs/leg_right/anklet_back` | 已看：[独显](review-evidence/independent-02/solo/D11.png) / [隐藏上层](review-evidence/independent-02/below/D11.png) / [联图](review-evidence/independent-02/sheets/layers-00-04.png) | — |
| `D12 \| head_accessories/tanuki_ornament/tanuki_body \| back` | 已看：[独显](review-evidence/independent-02/solo/D12.png) / [隐藏上层](review-evidence/independent-02/below/D12.png) / [联图](review-evidence/independent-02/sheets/layers-00-04.png) | R01 |
| `D13 \| hair/braid_right \| back` | 已看：[独显](review-evidence/independent-02/solo/D13.png) / [隐藏上层](review-evidence/independent-02/below/D13.png) / [联图](review-evidence/independent-02/sheets/layers-00-04.png) | — |
| `D14 \| hair/back_hair` | 已看：[独显](review-evidence/independent-02/solo/D14.png) / [隐藏上层](review-evidence/independent-02/below/D14.png) / [联图](review-evidence/independent-02/sheets/layers-05-09.png) | R02 |
| `D15 \| headphones/headband` | 已看：[独显](review-evidence/independent-02/solo/D15.png) / [隐藏上层](review-evidence/independent-02/below/D15.png) / [联图](review-evidence/independent-02/sheets/layers-05-09.png) | R02 |
| `D16 \| face/ears/ear_left/ear_interior` | 已看：[独显](review-evidence/independent-02/solo/D16.png) / [隐藏上层](review-evidence/independent-02/below/D16.png) / [联图](review-evidence/independent-02/sheets/layers-05-09.png) | — |
| `D17 \| face/ears/ear_right/ear_interior` | 已看：[独显](review-evidence/independent-02/solo/D17.png) / [隐藏上层](review-evidence/independent-02/below/D17.png) / [联图](review-evidence/independent-02/sheets/layers-05-09.png) | — |
| `D18 \| face/ears/ear_left/ear_fur` | 已看：[独显](review-evidence/independent-02/solo/D18.png) / [隐藏上层](review-evidence/independent-02/below/D18.png) / [联图](review-evidence/independent-02/sheets/layers-05-09.png) | — |
| `D19 \| face/ears/ear_right/ear_fur` | 已看：[独显](review-evidence/independent-02/solo/D19.png) / [隐藏上层](review-evidence/independent-02/below/D19.png) / [联图](review-evidence/independent-02/sheets/layers-10-14.png) | — |
| `D20 \| face/ears/ear_left/ear_shell` | 已看：[独显](review-evidence/independent-02/solo/D20.png) / [隐藏上层](review-evidence/independent-02/below/D20.png) / [联图](review-evidence/independent-02/sheets/layers-10-14.png) | — |
| `D21 \| face/ears/ear_right/ear_shell` | 已看：[独显](review-evidence/independent-02/solo/D21.png) / [隐藏上层](review-evidence/independent-02/below/D21.png) / [联图](review-evidence/independent-02/sheets/layers-10-14.png) | — |
| `D22 \| neck` | 已看：[独显](review-evidence/independent-02/solo/D22.png) / [隐藏上层](review-evidence/independent-02/below/D22.png) / [联图](review-evidence/independent-02/sheets/layers-10-14.png) | R11 |
| `D22.25 \| headphones/headband \| terminals` | 已看：[独显](review-evidence/independent-02/solo/D22p25.png) / [隐藏上层](review-evidence/independent-02/below/D22p25.png) / [联图](review-evidence/independent-02/sheets/layers-10-14.png) | — |
| `D22.5 \| pelvis \| back` | 已看：[独显](review-evidence/independent-02/solo/D22p5.png) / [隐藏上层](review-evidence/independent-02/below/D22p5.png) / [联图](review-evidence/independent-02/sheets/layers-15-19.png) | — |
| `D23 \| legs/leg_left/leg` | 已看：[独显](review-evidence/independent-02/solo/D23.png) / [隐藏上层](review-evidence/independent-02/below/D23.png) / [联图](review-evidence/independent-02/sheets/layers-15-19.png) | — |
| `D24 \| legs/leg_right/leg` | 已看：[独显](review-evidence/independent-02/solo/D24.png) / [隐藏上层](review-evidence/independent-02/below/D24.png) / [联图](review-evidence/independent-02/sheets/layers-15-19.png) | — |
| `D25 \| arms/arm_left/upper_arm` | 已看：[独显](review-evidence/independent-02/solo/D25.png) / [隐藏上层](review-evidence/independent-02/below/D25.png) / [联图](review-evidence/independent-02/sheets/layers-15-19.png) | R13, R18 |
| `D26 \| arms/arm_right/upper_arm` | 已看：[独显](review-evidence/independent-02/solo/D26.png) / [隐藏上层](review-evidence/independent-02/below/D26.png) / [联图](review-evidence/independent-02/sheets/layers-15-19.png) | R19 |
| `D27 \| arms/arm_left/bracelet_green_back` | 已看：[独显](review-evidence/independent-02/solo/D27.png) / [隐藏上层](review-evidence/independent-02/below/D27.png) / [联图](review-evidence/independent-02/sheets/layers-20-24.png) | — |
| `D28 \| arms/arm_left/bracelet_pink_back` | 已看：[独显](review-evidence/independent-02/solo/D28.png) / [隐藏上层](review-evidence/independent-02/below/D28.png) / [联图](review-evidence/independent-02/sheets/layers-20-24.png) | R24 |
| `D29 \| arms/arm_right/bracelet_cream_back` | 已看：[独显](review-evidence/independent-02/solo/D29.png) / [隐藏上层](review-evidence/independent-02/below/D29.png) / [联图](review-evidence/independent-02/sheets/layers-20-24.png) | — |
| `D30 \| arms/arm_right/bracelet_pink_back` | 已看：[独显](review-evidence/independent-02/solo/D30.png) / [隐藏上层](review-evidence/independent-02/below/D30.png) / [联图](review-evidence/independent-02/sheets/layers-20-24.png) | — |
| `D31 \| arms/arm_left/forearm` | 已看：[独显](review-evidence/independent-02/solo/D31.png) / [隐藏上层](review-evidence/independent-02/below/D31.png) / [联图](review-evidence/independent-02/sheets/layers-20-24.png) | — |
| `D32 \| arms/arm_right/forearm` | 已看：[独显](review-evidence/independent-02/solo/D32.png) / [隐藏上层](review-evidence/independent-02/below/D32.png) / [联图](review-evidence/independent-02/sheets/layers-25-29.png) | — |
| `D32.5 \| body/torso \| lower_mount` | 已看：[独显](review-evidence/independent-02/solo/D32p5.png) / [隐藏上层](review-evidence/independent-02/below/D32p5.png) / [联图](review-evidence/independent-02/sheets/layers-25-29.png) | R14 |
| `D33 \| pelvis \| front` | 已看：[独显](review-evidence/independent-02/solo/D33.png) / [隐藏上层](review-evidence/independent-02/below/D33.png) / [联图](review-evidence/independent-02/sheets/layers-25-29.png) | R15, R16, R17 |
| `D34 \| body/torso` | 已看：[独显](review-evidence/independent-02/solo/D34.png) / [隐藏上层](review-evidence/independent-02/below/D34.png) / [联图](review-evidence/independent-02/sheets/layers-25-29.png) | R11, R12, R13, R14 |
| `D35 \| body/breast` | 已看：[独显](review-evidence/independent-02/solo/D35.png) / [隐藏上层](review-evidence/independent-02/below/D35.png) / [联图](review-evidence/independent-02/sheets/layers-25-29.png) | R12, R13 |
| `D36 \| arms/arm_left/hand/little_finger` | 已看：[独显](review-evidence/independent-02/solo/D36.png) / [隐藏上层](review-evidence/independent-02/below/D36.png) / [联图](review-evidence/independent-02/sheets/layers-30-34.png) | R22 |
| `D37 \| arms/arm_right/hand/little_finger` | 已看：[独显](review-evidence/independent-02/solo/D37.png) / [隐藏上层](review-evidence/independent-02/below/D37.png) / [联图](review-evidence/independent-02/sheets/layers-30-34.png) | R23 |
| `D38 \| arms/arm_left/hand/ring_finger` | 已看：[独显](review-evidence/independent-02/solo/D38.png) / [隐藏上层](review-evidence/independent-02/below/D38.png) / [联图](review-evidence/independent-02/sheets/layers-30-34.png) | R20 |
| `D39 \| arms/arm_right/hand/ring_finger` | 已看：[独显](review-evidence/independent-02/solo/D39.png) / [隐藏上层](review-evidence/independent-02/below/D39.png) / [联图](review-evidence/independent-02/sheets/layers-30-34.png) | R21 |
| `D40 \| arms/arm_left/hand/middle_finger` | 已看：[独显](review-evidence/independent-02/solo/D40.png) / [隐藏上层](review-evidence/independent-02/below/D40.png) / [联图](review-evidence/independent-02/sheets/layers-30-34.png) | — |
| `D41 \| arms/arm_right/hand/middle_finger` | 已看：[独显](review-evidence/independent-02/solo/D41.png) / [隐藏上层](review-evidence/independent-02/below/D41.png) / [联图](review-evidence/independent-02/sheets/layers-35-39.png) | — |
| `D42 \| arms/arm_left/hand/thumb` | 已看：[独显](review-evidence/independent-02/solo/D42.png) / [隐藏上层](review-evidence/independent-02/below/D42.png) / [联图](review-evidence/independent-02/sheets/layers-35-39.png) | — |
| `D43 \| arms/arm_right/hand/thumb` | 已看：[独显](review-evidence/independent-02/solo/D43.png) / [隐藏上层](review-evidence/independent-02/below/D43.png) / [联图](review-evidence/independent-02/sheets/layers-35-39.png) | — |
| `D44 \| arms/arm_left/hand/index_finger` | 已看：[独显](review-evidence/independent-02/solo/D44.png) / [隐藏上层](review-evidence/independent-02/below/D44.png) / [联图](review-evidence/independent-02/sheets/layers-35-39.png) | — |
| `D45 \| arms/arm_right/hand/index_finger` | 已看：[独显](review-evidence/independent-02/solo/D45.png) / [隐藏上层](review-evidence/independent-02/below/D45.png) / [联图](review-evidence/independent-02/sheets/layers-35-39.png) | — |
| `D46 \| arms/arm_left/hand/palm` | 已看：[独显](review-evidence/independent-02/solo/D46.png) / [隐藏上层](review-evidence/independent-02/below/D46.png) / [联图](review-evidence/independent-02/sheets/layers-40-44.png) | — |
| `D47 \| arms/arm_right/hand/palm` | 已看：[独显](review-evidence/independent-02/solo/D47.png) / [隐藏上层](review-evidence/independent-02/below/D47.png) / [联图](review-evidence/independent-02/sheets/layers-40-44.png) | — |
| `D48 \| arms/arm_left/bracelet_pink_front` | 已看：[独显](review-evidence/independent-02/solo/D48.png) / [隐藏上层](review-evidence/independent-02/below/D48.png) / [联图](review-evidence/independent-02/sheets/layers-40-44.png) | — |
| `D49 \| arms/arm_right/bracelet_pink_front` | 已看：[独显](review-evidence/independent-02/solo/D49.png) / [隐藏上层](review-evidence/independent-02/below/D49.png) / [联图](review-evidence/independent-02/sheets/layers-40-44.png) | — |
| `D50 \| arms/arm_left/bell` | 已看：[独显](review-evidence/independent-02/solo/D50.png) / [隐藏上层](review-evidence/independent-02/below/D50.png) / [联图](review-evidence/independent-02/sheets/layers-40-44.png) | — |
| `D51 \| arms/arm_left/bracelet_green_front` | 已看：[独显](review-evidence/independent-02/solo/D51.png) / [隐藏上层](review-evidence/independent-02/below/D51.png) / [联图](review-evidence/independent-02/sheets/layers-45-49.png) | — |
| `D52 \| arms/arm_right/bracelet_cream_front` | 已看：[独显](review-evidence/independent-02/solo/D52.png) / [隐藏上层](review-evidence/independent-02/below/D52.png) / [联图](review-evidence/independent-02/sheets/layers-45-49.png) | — |
| `D56 \| head_accessories/hair_tie_back` | 已看：[独显](review-evidence/independent-02/solo/D56.png) / [隐藏上层](review-evidence/independent-02/below/D56.png) / [联图](review-evidence/independent-02/sheets/layers-45-49.png) | — |
| `D57 \| hair/braid_right \| front` | 已看：[独显](review-evidence/independent-02/solo/D57.png) / [隐藏上层](review-evidence/independent-02/below/D57.png) / [联图](review-evidence/independent-02/sheets/layers-45-49.png) | R05 |
| `D58 \| headphones/earcups/earcup_left` | 已看：[独显](review-evidence/independent-02/solo/D58.png) / [隐藏上层](review-evidence/independent-02/below/D58.png) / [联图](review-evidence/independent-02/sheets/layers-45-49.png) | — |
| `D59 \| headphones/earcups/earcup_right` | 已看：[独显](review-evidence/independent-02/solo/D59.png) / [隐藏上层](review-evidence/independent-02/below/D59.png) / [联图](review-evidence/independent-02/sheets/layers-50-54.png) | — |
| `D60 \| face/face_base` | 已看：[独显](review-evidence/independent-02/solo/D60.png) / [隐藏上层](review-evidence/independent-02/below/D60.png) / [联图](review-evidence/independent-02/sheets/layers-50-54.png) | — |
| `D61 \| face/mouth/mouth_interior` | 已看：[独显](review-evidence/independent-02/solo/D61.png) / [隐藏上层](review-evidence/independent-02/below/D61.png) / [联图](review-evidence/independent-02/sheets/layers-50-54.png) | — |
| `D62 \| face/mouth/tongue` | 已看：[独显](review-evidence/independent-02/solo/D62.png) / [隐藏上层](review-evidence/independent-02/below/D62.png) / [联图](review-evidence/independent-02/sheets/layers-50-54.png) | — |
| `D63 \| face/mouth/lower_teeth` | 已看：[独显](review-evidence/independent-02/solo/D63.png) / [隐藏上层](review-evidence/independent-02/below/D63.png) / [联图](review-evidence/independent-02/sheets/layers-50-54.png) | — |
| `D64 \| face/mouth/upper_teeth` | 已看：[独显](review-evidence/independent-02/solo/D64.png) / [隐藏上层](review-evidence/independent-02/below/D64.png) / [联图](review-evidence/independent-02/sheets/layers-55-59.png) | — |
| `D65 \| face/eyes/eye_left/sclera` | 已看：[独显](review-evidence/independent-02/solo/D65.png) / [隐藏上层](review-evidence/independent-02/below/D65.png) / [联图](review-evidence/independent-02/sheets/layers-55-59.png) | — |
| `D66 \| face/eyes/eye_right/sclera` | 已看：[独显](review-evidence/independent-02/solo/D66.png) / [隐藏上层](review-evidence/independent-02/below/D66.png) / [联图](review-evidence/independent-02/sheets/layers-55-59.png) | — |
| `D67 \| face/eyes/eye_left/iris` | 已看：[独显](review-evidence/independent-02/solo/D67.png) / [隐藏上层](review-evidence/independent-02/below/D67.png) / [联图](review-evidence/independent-02/sheets/layers-55-59.png) | R06 |
| `D68 \| face/eyes/eye_right/iris` | 已看：[独显](review-evidence/independent-02/solo/D68.png) / [隐藏上层](review-evidence/independent-02/below/D68.png) / [联图](review-evidence/independent-02/sheets/layers-55-59.png) | — |
| `D69 \| face/eyes/eye_left/highlight` | 已看：[独显](review-evidence/independent-02/solo/D69.png) / [隐藏上层](review-evidence/independent-02/below/D69.png) / [联图](review-evidence/independent-02/sheets/layers-60-64.png) | — |
| `D70 \| face/eyes/eye_right/highlight` | 已看：[独显](review-evidence/independent-02/solo/D70.png) / [隐藏上层](review-evidence/independent-02/below/D70.png) / [联图](review-evidence/independent-02/sheets/layers-60-64.png) | — |
| `D71 \| face/eyes/eye_left/upper_eyelid` | 已看：[独显](review-evidence/independent-02/solo/D71.png) / [隐藏上层](review-evidence/independent-02/below/D71.png) / [联图](review-evidence/independent-02/sheets/layers-60-64.png) | R06 |
| `D72 \| face/eyes/eye_right/upper_eyelid` | 已看：[独显](review-evidence/independent-02/solo/D72.png) / [隐藏上层](review-evidence/independent-02/below/D72.png) / [联图](review-evidence/independent-02/sheets/layers-60-64.png) | — |
| `D73 \| face/eyes/eye_left/eyelid_crease` | 已看：[独显](review-evidence/independent-02/solo/D73.png) / [隐藏上层](review-evidence/independent-02/below/D73.png) / [联图](review-evidence/independent-02/sheets/layers-60-64.png) | — |
| `D74 \| face/eyes/eye_right/eyelid_crease` | 已看：[独显](review-evidence/independent-02/solo/D74.png) / [隐藏上层](review-evidence/independent-02/below/D74.png) / [联图](review-evidence/independent-02/sheets/layers-65-69.png) | — |
| `D75 \| face/nose` | 已看：[独显](review-evidence/independent-02/solo/D75.png) / [隐藏上层](review-evidence/independent-02/below/D75.png) / [联图](review-evidence/independent-02/sheets/layers-65-69.png) | — |
| `D76 \| face/blush_left` | 已看：[独显](review-evidence/independent-02/solo/D76.png) / [隐藏上层](review-evidence/independent-02/below/D76.png) / [联图](review-evidence/independent-02/sheets/layers-65-69.png) | R09 |
| `D77 \| face/blush_right` | 已看：[独显](review-evidence/independent-02/solo/D77.png) / [隐藏上层](review-evidence/independent-02/below/D77.png) / [联图](review-evidence/independent-02/sheets/layers-65-69.png) | R10 |
| `D78 \| face/mouth/lower_lip` | 已看：[独显](review-evidence/independent-02/solo/D78.png) / [隐藏上层](review-evidence/independent-02/below/D78.png) / [联图](review-evidence/independent-02/sheets/layers-65-69.png) | — |
| `D79 \| face/mouth/upper_lip` | 已看：[独显](review-evidence/independent-02/solo/D79.png) / [隐藏上层](review-evidence/independent-02/below/D79.png) / [联图](review-evidence/independent-02/sheets/layers-70-74.png) | — |
| `D80 \| face/eyebrows/eyebrow_left \| back` | 已看：[独显](review-evidence/independent-02/solo/D80.png) / [隐藏上层](review-evidence/independent-02/below/D80.png) / [联图](review-evidence/independent-02/sheets/layers-70-74.png) | R07 |
| `D81 \| face/eyebrows/eyebrow_right \| back` | 已看：[独显](review-evidence/independent-02/solo/D81.png) / [隐藏上层](review-evidence/independent-02/below/D81.png) / [联图](review-evidence/independent-02/sheets/layers-70-74.png) | R08 |
| `D82 \| hair/side_hair/side_hair_left` | 已看：[独显](review-evidence/independent-02/solo/D82.png) / [隐藏上层](review-evidence/independent-02/below/D82.png) / [联图](review-evidence/independent-02/sheets/layers-70-74.png) | — |
| `D83 \| hair/side_hair/side_hair_right` | 已看：[独显](review-evidence/independent-02/solo/D83.png) / [隐藏上层](review-evidence/independent-02/below/D83.png) / [联图](review-evidence/independent-02/sheets/layers-70-74.png) | R03 |
| `D84 \| hair/bangs` | 已看：[独显](review-evidence/independent-02/solo/D84.png) / [隐藏上层](review-evidence/independent-02/below/D84.png) / [联图](review-evidence/independent-02/sheets/layers-75-79.png) | R04 |
| `D84.1 \| face/eyebrows/eyebrow_left \| front` | 已看：[独显](review-evidence/independent-02/solo/D84p1.png) / [隐藏上层](review-evidence/independent-02/below/D84p1.png) / [联图](review-evidence/independent-02/sheets/layers-75-79.png) | R07 |
| `D84.2 \| face/eyebrows/eyebrow_right \| front` | 已看：[独显](review-evidence/independent-02/solo/D84p2.png) / [隐藏上层](review-evidence/independent-02/below/D84p2.png) / [联图](review-evidence/independent-02/sheets/layers-75-79.png) | R08 |
| `D85 \| head_accessories/hair_bell` | 已看：[独显](review-evidence/independent-02/solo/D85.png) / [隐藏上层](review-evidence/independent-02/below/D85.png) / [联图](review-evidence/independent-02/sheets/layers-75-79.png) | — |
| `D85.5 \| head_accessories/tanuki_ornament/tanuki_body \| front` | 已看：[独显](review-evidence/independent-02/solo/D85p5.png) / [隐藏上层](review-evidence/independent-02/below/D85p5.png) / [联图](review-evidence/independent-02/sheets/layers-75-79.png) | — |
| `D86 \| head_accessories/tanuki_ornament/paw/paw_left` | 已看：[独显](review-evidence/independent-02/solo/D86.png) / [隐藏上层](review-evidence/independent-02/below/D86.png) / [联图](review-evidence/independent-02/sheets/layers-80-84.png) | — |
| `D87 \| head_accessories/tanuki_ornament/paw/paw_right` | 已看：[独显](review-evidence/independent-02/solo/D87.png) / [隐藏上层](review-evidence/independent-02/below/D87.png) / [联图](review-evidence/independent-02/sheets/layers-80-84.png) | — |
| `D88 \| head_accessories/hair_tie_front` | 已看：[独显](review-evidence/independent-02/solo/D88.png) / [隐藏上层](review-evidence/independent-02/below/D88.png) / [联图](review-evidence/independent-02/sheets/layers-80-84.png) | — |
| `D89 \| legs/leg_left/thigh_band_front` | 已看：[独显](review-evidence/independent-02/solo/D89.png) / [隐藏上层](review-evidence/independent-02/below/D89.png) / [联图](review-evidence/independent-02/sheets/layers-80-84.png) | — |
| `D90 \| legs/leg_right/anklet_front` | 已看：[独显](review-evidence/independent-02/solo/D90.png) / [隐藏上层](review-evidence/independent-02/below/D90.png) / [联图](review-evidence/independent-02/sheets/layers-80-84.png) | — |

## 完成范围与只读核验

已完成全部部件、所有多深度片、全部显隐蒙版和指定整图/眼睛/接缝检查，无必要输入缺失或工具故障。分组树的78个叶部件ID与KRA实际78个逻辑part/85片对应；检查中没有新增、删改或重排输入文件。

本轮只在独立文档中临时改变显隐以导出；每批及结束均恢复原显隐，未保存 KRA。工程、groups/occlusion、部件SVG及参考PNG的前后SHA256一致。该哈希仅核验输入未修改，未用于质量判断。[只读核验](review-evidence/independent-02/read-only-verification.json)；[Krita结束显隐核验](review-evidence/independent-02/krita-final-state.json)。

正式review/repair文件保持原样。本轮完整报告仅写入 `raster-layering/step01/review-02.md.tmp`，报告引用图全部保存在 `raster-layering/step01/review-evidence/independent-02/`。
