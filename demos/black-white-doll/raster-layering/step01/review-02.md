结论：需要修复

# 第一步独立 review-02

已查完当前磁盘 KRA 的 **70 个逻辑部件、75 个实际绘画分片**，确认下列 **15 项**需要修复。工程、上游 SVG、分组和深度文件保持只读。编号为本轮重新编号，不与上一轮 R 编号逐一对应。

## 输入与检查范围

- 当前工程：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/character-depth.kra`，1086 × 1448。
- 实际参考：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/base-subject.png`。依据正式 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/report.md` 确认；未使用另外两张参考代替。
- 结构依据：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/groups.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/occlusion.json`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/parts/`。70 个终止节点包含尚以 group 类型登记的 neck、pelvis；它们也实际检查，未因 kind 字段漏计。工程 part ID 和 75 个深度均与当前分组、深度表对应。
- 已阅读正式 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-01.md`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/repair-01.md` 了解已知问题。旧报告、旧导出及暂存结果没有代替本次看图。

本轮在 Krita 实际打开指定工程。逐片切换独显，目标眼口蒙版停用，查看完整本件；随后启用原开口并隐藏高于本片的绘画层，查看补全和下层组合。全部 75 片均重新导出，按同坐标原图、独显、隐藏上层、默认合成四列逐片看过。五个多深度逻辑部件又分别合片看过。所有 atlas 的裁切、倍率在行头记录；棋盘格仅显示透明，不改变绘画。

另外查看了整图对照、双眼原尺寸并排和同坐标放大，以及肩颈、腋侧、胸部、腰缝、肘、腕、手指、腿踝、鞋口、发束交叉与卷尖。每个眼口蒙版逐个停用／启用后查看 owner 独显，并查看全部控制停用／启用的合成。未使用 PSNR 或相似度数字评价画质。

所有本轮证据位于 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/`。下文问题框为原画布 `[x,y,width,height]`；框选由 reviewer 看图后提交工具，工具未替代判断。参考未移动、缩放或变形来迁就当前；显示放大对同组各列使用相同倍率。右侧注明“独显”的证据确实是本件独显，隐藏区原图只提供遮挡位置、可见笔触和画风依据。





## 确定需要修复的问题

### R1 — 左手掌—拇指交界仍有水平切边

**图层：** `D024.0 | arms/arm_left/hand/palm`；`D022.0 / D024.5 | arms/arm_left/hand/thumb`。

**位置：** `[657,713,31,34]`。

**当前表现与参考依据：** 画面右侧拇指起段约 y720 出现平直浅色接边，掌面、拇指亮面及红暗侧在同一高度换段。单看拇指两个分片合成，指体是连续的；加回掌层后这条接界再次显出，说明还需修掌与前方指身的组合。参考这里是连续的肤色转面，没有横向分界。

**影响：** 原尺寸整图可见一小块贴上的浅肤色片，掌指连接缺少自然体积。

**修复方向：** 先在 D024.0 与 D024.5 的实际重叠处接色、接线，顺着拇指方向融接红暗侧和亮面；调整局部搭接边，使其不以水平色差收口。然后独显两个拇指分片合看，再加回掌层以原尺寸核对。

**需保留：** 保留本指指甲、指尖、整体位置及 22／24.5 两个深度；不要通过整掌覆盖拇指或增加消隐蒙版隐藏接缝。



框选与原坐标：[R1 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[combined-D022.0.png](review-evidence/review02/combined-D022.0.png)。

### R2 — 右手掌下缘与长指根有硬接和轮廓顿点

**图层：** `D025.0 | arms/arm_right/hand/palm`；`D019.0 | arms/arm_right/hand/middle_finger`；`D021.0 | arms/arm_right/hand/index_finger`。

**位置：** `[386,726,37,28]`。

**当前表现与参考依据：** 画面左侧掌层下缘约 y735 形成浅色近水平接带；掌的外侧收尾还留出一个暗色小台阶。下方指根的深红侧面从此突然开始。参考掌面到长指的亮面、外轮廓和暗侧连续，未出现这条接带。D025 独显及隐藏上层视图可定位到掌的下缘。

**影响：** 掌与指像两个相接的片段，外缘多出顿点；默认组装仍有拼接感。

**修复方向：** 以当前掌缘与 D019／D021 指根的重叠位置为修复范围，接顺外侧弧线，融掉掌的直切色边及其暗点，再沿指根画出连续的肤色转面。分别看掌、各指和组合，避免只在最终合成上盖一条肤色。

**需保留：** 保留独立指层、本件原有指甲与指尖，以及掌前拇指的正确前后关系。



框选与原坐标：[R2 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-09.png](review-evidence/review02/atlas-09.png)。

### R3 — 左食指补画段到远端取样段仍有斜切接段

**图层：** `D020.0 | arms/arm_left/hand/index_finger`。

**位置：** `[659,749,20,33]`。

**当前表现与参考依据：** D020 独显中，上段圆润亮面到约 y755 的暗红细段时突然收窄；侧缘和明暗一起换段，红侧接点呈硬斜界。参考可见手指的暗侧与细描边沿指身连续延伸。合成中，这一段仍表现为红暗条的突接。此条右侧框选证据是食指独显，参考含邻指，仅用本指可见笔触核对。

**影响：** 本件自身的形体、边线和接色不连续，分开后比整手中更明显。

**修复方向：** 沿食指自身侧缘重画接点前后的小段，逐渐收窄宽度、接续红暗侧与亮面，融顺已有取样远段；确保没有横切或斜切色界。

**需保留：** 保留原图本指远端的细描边和指尖，不借用邻指覆盖接点，也不重填整个指形。



框选与原坐标：[R3 整画布标记](review-evidence/review02/annotated/left-index/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/left-index/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-07.png](review-evidence/review02/atlas-07.png)。

### R4 — 右中指中下段外缘有鼓包、折点

**图层：** `D019.0 | arms/arm_right/hand/middle_finger`。

**位置：** `[405,752,20,36]`。

**当前表现与参考依据：** D019 独显在约 y760 的右缘向外鼓出台阶，深红侧面在此发生变化，随后又骤然收回。参考可见长指侧缘是连续曲线；当前这一块是本件边缘的局部折点，在隐藏上层和合成中也使指侧变得厚钝。

**影响：** 完整指体轮廓不干净，收细的方向和粗细变化被局部块状凸起打断。

**修复方向：** 局部修顺鼓出处的指缘，使中段到末段渐变收窄；同时融顺暗侧色带及其边线，避免仅擦掉凸点后留下新的切边。

**需保留：** 保留指的总体弯向、末端位置以及相邻食指、拇指的独立归属。



框选与原坐标：[R4 整画布标记](review-evidence/review02/annotated/right-middle/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/right-middle/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-06.png](review-evidence/review02/atlas-06.png)。

### R5 — 白前马尾宽卷底部被额外尖束和竖向亮条改写

**图层：** `D003.0 | hair/ponytail/ponytail_left/ponytail_front`。

**位置：** `[656,474,91,75]`。

**当前表现与参考依据：** 原图宽卷由竖向下落平顺转入底部回卷，底部是连续的灰紫转面与细长收笔。当前 D003 在转弯处增加明显的浅白竖条，并在底边形成数条细尖、叉形亮束；这些形状同时存在于本件独显和整图，不是后发或前绕束的遮挡造成。

**影响：** 原有宽卷的转向、灰紫层次和收笔特征发生变化，局部有贴上亮条的观感。

**修复方向：** 以参考同坐标的宽卷转面为准，恢复连续的弯曲色带、底部束缘和收细方向；清理多出的竖条及叉形细束，把隐藏延续顺发流融入已有发面。

**需保留：** 保留完整扎点、长条开隙、正常穿行细束及马尾主轮廓；不要以整块填色抹平发纹，或沿手臂遮挡边横切马尾。



框选与原坐标：[R5 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[white-curl.png](review-evidence/review02/white-curl.png)。

### R6 — 白后马尾前绕束被压成淡紫细线

**图层：** `D005.0 | hair/ponytail/ponytail_left/ponytail_back | front_sweep`；`D001.0 | hair/ponytail/ponytail_left/ponytail_back | rear_surface`。

**位置：** `[677,422,96,86]`。

**当前表现与参考依据：** 参考前绕束有可辨的双侧束缘、浅亮束面和宽度渐变，跨过中央宽卷后再回接。D005 当前几乎是一条均匀淡紫线，内部亮面宽度和暗侧层次消失，末端回接也被压平。D001／D005 单独看及同 part 合看均可确认，不是多层重复。

**影响：** 细发束从有厚度的形体退化为单线，原图的粗细变化和立体结构丢失。

**修复方向：** 按原图逐段恢复该束的两侧边、亮面、灰紫转面及渐细走向，接顺 D005 与 D001 的回接；在原尺寸核对束宽，再放大看边线。

**需保留：** 保留同一后马尾的 1／5 深度关系，低位宽卷仍在前卷后方；不要把整片后发抬到前层。



框选与原坐标：[R6 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[combined-D001.0.png](review-evidence/review02/combined-D001.0.png)。

### R7 — 躯干隐藏胸廓中的衣缝有硬折和线宽接段

**图层：** `D031.0 | body/torso`。

**位置：** `[496,368,91,51]`。

**当前表现与参考依据：** 停用乳房前层、查看 D031 时，两条补全衣缝在胸廓中段先突然转成近竖直段，再急转回腰线，局部浓淡、线宽也发生接段。原图可见衣缝是随体面平顺变化的曲线；隐藏胸廓允许按自身形体合理续画，但当前折点没有得到平滑过渡。

**影响：** 躯干本件独显的结构线不自然；前置乳房发生位移后会露出明显的折线补缝。

**修复方向：** 沿躯干自身转面重画两条隐藏衣缝，使用连续切向和渐变曲率接回上下已有线段，同时统一局部浓淡与线宽。补全区保留自身衣料明暗，不照抄前凸乳房的轮廓，也不以粗直线贯穿。

**需保留：** 保留完整无洞的躯干底形、肩带、领口及现有衣料渐变；修线时不要损坏前置 breast。



框选与原坐标：[R7 整画布标记](review-evidence/review02/annotated/torso/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/torso/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-11.png](review-evidence/review02/atlas-11.png)。

### R8 — 躯干—骨盆接处的画面左衣缝仍有细段台阶

**图层：** `D031.0 | body/torso`；`D012.0 | pelvis`。

**位置：** `[490,509,18,24]`。

**当前表现与参考依据：** 约 y518 的层间交界处，画面左衣缝由较深较宽的上段突然变细、变浅，并有小幅偏折；原图相同位置是一条自然连续的曲线。将 torso、pelvis 独显与整图并排，可对应到两层的交接点。

**影响：** 原尺寸有可辨的线条接段，放大可见粗细和走向不顺。

**修复方向：** 局部对齐两层衣缝中心线和切向，接顺粗细、浓淡及抗锯齿；同步检查线旁底色，消掉接点，最后恢复整图在原尺寸确认。

**需保留：** 保留已有腰腹比例、骨盆位置、左右衣缝路径和皮肤／衣料归属，不为接一条线移动整个部件。



框选与原坐标：[R8 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[torso-pelvis.png](review-evidence/review02/torso-pelvis.png)。

### R9 — 左上臂内留有躯干交界形残线和暗楔

**图层：** `D028.0 | arms/arm_left/upper_arm`。

**位置：** `[613,357,27,88]`。

**当前表现与参考依据：** D028 独显可见自有内缘之外，臂面内部还留有一条向上收尖的暗线和深色楔形。把同坐标原图放在旁边，暗线走向对应前方躯干／衣料与手臂的交界；补全后它仍被印在连续肤色面内，成为双重边界。原图没有在完整上臂中部单独画这样一条解剖结构线。

**影响：** 部件带入其他部件造成的交界残影／投影形暗色，独显不干净；躯干移开后会露出假沟槽。

**修复方向：** 清理内部的衣物交界残线与尖楔，把该区融回连续的本件臂面转明暗；沿真正臂缘保留描边和自有转面，不把整条内侧暗部一并抹平。

**需保留：** 保留肩端完整搭接余量、正常内外轮廓和肘部衔接；一般遮挡继续交给 torso 的真实深度。



框选与原坐标：[R9 整画布标记](review-evidence/review02/annotated/left-arm/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/left-arm/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-10.png](review-evidence/review02/atlas-10.png)。

### R10 — 右上臂内留有同类衣物交界残影

**图层：** `D029.0 | arms/arm_right/upper_arm`。

**位置：** `[448,357,29,88]`。

**当前表现与参考依据：** D029 独显中，自有内侧轮廓与臂面内部的弯折暗线同时存在，暗线下端扩成深色尖楔。参考同坐标显示该走向来自前方躯干衣料的边缘及接触暗部；完成隐藏臂面后，这一形状仍留在本件内部。

**影响：** 右上臂独显出现附着在皮肤上的假折面，不能作为干净、可分离的同一部件。

**修复方向：** 局部去掉衣物轮廓形暗线和尖楔，延续本件皮肤亮面、暗侧及真正内缘，使遮挡由 torso 的前后关系承担；独显、隐藏 torso、整图依次核对。

**需保留：** 保留完整肩端、臂体体积、肘端搭接和自有轮廓，不使用局部消隐蒙版。



框选与原坐标：[R10 整画布标记](review-evidence/review02/annotated/right-arm/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/right-arm/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-10.png](review-evidence/review02/atlas-10.png)。

### R11 — 角色左眉的参考可见长弧被白发遮掉

**图层：** `D048.0 | face/eyebrows/eyebrow_left`；`D065.0 | hair/side_hair/side_hair_left`；`D067.0 | hair/bangs`。

**位置：** `[558,110,44,17]`。

**当前表现与参考依据：** 画面右侧参考中可辨的眉弧沿发束交叉处向两端延伸；当前合成只剩发间短段。D048 独显确实有完整眉弧，丢失发生在加入 D065／D067 后。以原坐标同尺寸看，现有可见眉长和眉尾均与参考不同。

**影响：** 默认表情中的眉形、长度和与发束交叉关系不符；当前“眉在发后”的统一安排不足以还原可见线。

**修复方向：** 逐段核对参考中可见眉头、眉尾与发束的交叉，修正必要的普通绘画分片／局部深度，并同步上游 occlusion 与映射，使原图可见线仍由同一 eyebrow part 提供。之后同时检查完整眉独显及默认可见弧。

**需保留：** 保留完整发下眉形、独立眉节点与细弧粗细；不要把眉线烘焙入头发，不用透见蒙版解决一般交叉。



框选与原坐标：[R11 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[brows.png](review-evidence/review02/brows.png)。

### R12 — 角色右眉被黑发遮成中央短横

**图层：** `D049.0 | face/eyebrows/eyebrow_right`；`D066.0 | hair/side_hair/side_hair_right`；`D067.0 | hair/bangs`。

**位置：** `[476,110,47,19]`。

**当前表现与参考依据：** 画面左侧原图眉头至眉尾是一条较长的可见细弧；当前只在中央发隙留下短横，参考可见的两端没有出现。D049 独显有完整眉线，合成缺失与 D066／D067 覆盖一致。

**影响：** 与参考的眉形、长度及表情线索不一致，不能以独显完整代替默认姿态的还原。

**修复方向：** 按本侧参考核对眉／发交叉，恢复对应可见线段的正确局部层级和归属；如需同眉多深度分片，同步结构记录后逐片、合片复查。

**需保留：** 保留本侧眉弧的独立形状及发下连续部分，不把另一侧直接等形复制，也不将眉线画进黑发。



框选与原坐标：[R12 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[brows.png](review-evidence/review02/brows.png)。

### R13 — 画面左侧颊—下颌轮廓有无描边断段

**图层：** `D035.0 | face/face_base`。

**位置：** `[477,194,23,29]`。

**当前表现与参考依据：** 在黑侧发下方，D035 的深色轮廓先有一小段，随后中断，直到更低的下颌才重新出现；中间只有肤色透明边。独显和整图均可见。原图这里的深色轮廓从侧颊连续接到下颌，没有这段浅色断口。

**影响：** 脸部外轮廓不完整，肤色边与下颌墨线之间有明显粗细／有无描边突变。

**修复方向：** 在 face_base 上补画连续的颊颌描边，按原图接顺线色、粗细和收势，并向发下合理延续；逐段检查两个端点的抗锯齿和脸型。

**需保留：** 保留现有脸型、位置及独立 neck，不重新带入颈线或头发轮廓。



框选与原坐标：[R13 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[atlas-12.png](review-evidence/review02/atlas-12.png)。

### R14 — 画面右侧颊线在接入下颌前中断

**图层：** `D035.0 | face/face_base`。

**位置：** `[590,190,26,30]`。

**当前表现与参考依据：** D035 下颌墨线在约 x596／y211 处停止，其上至侧颊、发下的外缘只剩浅肤色，独显可直接看到断段；原图在这一段仍有连续深色轮廓。当前侧发没有遮住整段，因此默认整图也露出无描边边缘。

**影响：** 另一侧脸部外轮廓同样不完整，颊颌衔接的线条与参考不一致。

**修复方向：** 沿本件真实脸缘延续细描边至遮挡下，接顺下颌已有墨线；在不改变脸宽和下颌位置的前提下修复端点、线宽与浓淡。

**需保留：** 保留独立脸底及颈部归属，避免把耳部、侧发或下巴投影补进 face_base。



框选与原坐标：[R14 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[jaw-right.png](review-evidence/review02/jaw-right.png)。

### R15 — 角色左眼外眼尾的回挑细钩缩短、变直

**图层：** `D065.5 | face/eyes/eye_left/upper_eyelid | outer_corner`；`D042.0 | face/eyes/eye_left/upper_eyelid | main_arc`。

**位置：** `[609,142,15,18]`。

**当前表现与参考依据：** 画面右眼外角参考末端有向外再上挑的细收笔，带很细的灰红抗锯齿尾。当前 D065.5 末端缩成较短、较直的三角尖；D042／D065.5 合看及默认合成均未恢复原来的回钩。双眼原尺寸并排后再放大可定位到该细节。

**影响：** 眼尾形状特征被简化，尖端、钩形及收笔与参考不一致。

**修复方向：** 在本眼 upper_eyelid 的外角分片局部恢复原图细钩的长度、上挑方向、渐细墨线及抗锯齿，接顺主弧边线；先以原尺寸确认形，再放大清理接点。

**需保留：** 保留 42／65.5 的同件深度、现有眼白、虹膜层次与独立高光，不把眼尾笔触放回侧发层。



框选与原坐标：[R15 整画布标记](review-evidence/review02/annotated/main/marked.png)；`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotated/main/regions.json`。该目录同时保留独立参考与当前局部 PNG。



补充证据：[combined-D042.0.png](review-evidence/review02/combined-D042.0.png)。

## 眼睛、控制关系与保留内容

双眼已各自与参考同尺寸并排，再放大检查眼轮廓、睫毛、眼白、虹膜层次、高光和交界。本轮确定的眼部形状问题是 R15；R11／R12 是眼上方眉毛的可见线问题。未把两眼不同的原有设计当作不一致，也未把虹膜下部浅粉色层次误归高光。





原生树仅含 75 个普通绘画层及 10 个透明度蒙版。全部绘画层 `inheritAlpha=false`，没有剪贴关系、额外显隐控制或一般遮挡蒙版。10 个蒙版分别挂于左右眼 sclera／iris／highlight 和 mouth_interior／lower_teeth／tongue／upper_teeth。停用与启用的变化限制在真实眼口开口；未发现将头发、四肢、鞋体交叉交给蒙版的问题。眼睑外角、拇指及后马尾的交叉由普通深度分片承担。





| owner 图层 | 停用／启用逐件对照 |
| --- | --- |
| `D036.0 &#124; face/eyes/eye_left/sclera` | [OFF／ON](review-evidence/review02/control-D036.0.png) |
| `D037.0 &#124; face/eyes/eye_right/sclera` | [OFF／ON](review-evidence/review02/control-D037.0.png) |
| `D038.0 &#124; face/eyes/eye_left/iris` | [OFF／ON](review-evidence/review02/control-D038.0.png) |
| `D039.0 &#124; face/eyes/eye_right/iris` | [OFF／ON](review-evidence/review02/control-D039.0.png) |
| `D040.0 &#124; face/eyes/eye_left/highlight` | [OFF／ON](review-evidence/review02/control-D040.0.png) |
| `D041.0 &#124; face/eyes/eye_right/highlight` | [OFF／ON](review-evidence/review02/control-D041.0.png) |
| `D053.0 &#124; face/mouth/mouth_interior` | [OFF／ON](review-evidence/review02/control-D053.0.png) |
| `D054.0 &#124; face/mouth/lower_teeth` | [OFF／ON](review-evidence/review02/control-D054.0.png) |
| `D055.0 &#124; face/mouth/tongue` | [OFF／ON](review-evidence/review02/control-D055.0.png) |
| `D056.0 &#124; face/mouth/upper_teeth` | [OFF／ON](review-evidence/review02/control-D056.0.png) |

下牙在当前原图完全被舌／下唇遮住，中央白亮细条属于下唇高光，已按分组说明核对；没有因开口下看不到下牙而误报缺失。腮红的红色底与斜线、原图指甲、黑马尾银白细发及粉条、鞋上真实扣孔均需保留。颈部去除下巴投影后的浅色合成不作为缺陷；本目标要求部件不烘焙其他部件投影。未列入问题的检查点不代表允许用遮挡掩盖本轮已列缺陷。

## 多深度部件合片检查

以下五件分别看过所有分片的三种视图，并合起来看连续性。多片并未被判为重复层。

| 逻辑 part | 物理深度 | 合片证据 | 结果 |
| --- | --- | --- | --- |
| `hair/ponytail/ponytail_left/ponytail_back` | 1／5 | [合片](review-evidence/review02/combined-D001.0.png) | R6 |
| `arms/arm_left/hand/thumb` | 22／24.5 | [合片](review-evidence/review02/combined-D022.0.png) | 合片连续；加回掌层后存在 R1 |
| `arms/arm_right/hand/thumb` | 23／25.5 | [合片](review-evidence/review02/combined-D023.0.png) | 合片连续；另有 R2 掌指衔接问题 |
| `face/eyes/eye_left/upper_eyelid` | 42／65.5 | [合片](review-evidence/review02/combined-D042.0.png) | R15 |
| `face/eyes/eye_right/upper_eyelid` | 43／66.5 | [合片](review-evidence/review02/combined-D043.0.png) | 未确认合片断口或归属问题 |

## 全部部件检查覆盖

每行都已看过“完整独显（目标蒙版停用）／隐藏上层（正常开口）／默认合成对照”。同一逻辑 part 只在下表列一次，多个深度写在同一行；atlas 逐片保留，因此多片在同一行可能链接两张 atlas。单片原画布 PNG 位于 `D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/solo/`、`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/below/`，分片名称、UUID、坐标及 atlas 对应见下列完整索引。

- 原生树：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/layer-tree.json`。
- 逐片 atlas 索引：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/atlas-index.json`。
- 结构与覆盖记录：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/coverage.json`。
- 框选总索引：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/annotations-index.json`。

| 逻辑 part | 逐片图层（已看独显／隐藏上层／合成） | 四列 atlas | 确定问题 |
| --- | --- | --- | --- |
| `hair/ponytail/ponytail_left/ponytail_back` | D001.0／D005.0 | [atlas-01](review-evidence/review02/atlas-01.png)、[atlas-02](review-evidence/review02/atlas-02.png) | R6 |
| `hair/ponytail/ponytail_right/ponytail_back` | D002.0 | [atlas-01](review-evidence/review02/atlas-01.png) | 未确认需修问题 |
| `hair/ponytail/ponytail_left/ponytail_front` | D003.0 | [atlas-01](review-evidence/review02/atlas-01.png) | R5 |
| `hair/ponytail/ponytail_right/ponytail_front` | D004.0 | [atlas-02](review-evidence/review02/atlas-02.png) | 未确认需修问题 |
| `hair/hair_cap` | D006.0 | [atlas-02](review-evidence/review02/atlas-02.png) | 未确认需修问题 |
| `legs/leg_left/shoes/collar_back` | D007.0 | [atlas-03](review-evidence/review02/atlas-03.png) | 未确认需修问题 |
| `legs/leg_left/shoes/ankle_strap/ankle_strap_back` | D008.0 | [atlas-03](review-evidence/review02/atlas-03.png) | 未确认需修问题 |
| `legs/leg_right/shoes/rear_collar` | D009.0 | [atlas-03](review-evidence/review02/atlas-03.png) | 未确认需修问题 |
| `legs/leg_left/leg` | D010.0 | [atlas-04](review-evidence/review02/atlas-04.png) | 未确认需修问题 |
| `legs/leg_right/leg` | D011.0 | [atlas-04](review-evidence/review02/atlas-04.png) | 未确认需修问题 |
| `pelvis` | D012.0 | [atlas-04](review-evidence/review02/atlas-04.png) | R8 |
| `arms/arm_left/hand/little_finger` | D014.0 | [atlas-05](review-evidence/review02/atlas-05.png) | 未确认需修问题 |
| `arms/arm_right/hand/little_finger` | D015.0 | [atlas-05](review-evidence/review02/atlas-05.png) | 未确认需修问题 |
| `arms/arm_left/hand/ring_finger` | D016.0 | [atlas-05](review-evidence/review02/atlas-05.png) | 未确认需修问题 |
| `arms/arm_right/hand/ring_finger` | D017.0 | [atlas-06](review-evidence/review02/atlas-06.png) | 未确认需修问题 |
| `arms/arm_left/hand/middle_finger` | D018.0 | [atlas-06](review-evidence/review02/atlas-06.png) | 未确认需修问题 |
| `arms/arm_right/hand/middle_finger` | D019.0 | [atlas-06](review-evidence/review02/atlas-06.png) | R2、R4 |
| `arms/arm_left/hand/index_finger` | D020.0 | [atlas-07](review-evidence/review02/atlas-07.png) | R3 |
| `arms/arm_right/hand/index_finger` | D021.0 | [atlas-07](review-evidence/review02/atlas-07.png) | R2 关联 |
| `arms/arm_left/hand/thumb` | D022.0／D024.5 | [atlas-07](review-evidence/review02/atlas-07.png)、[atlas-08](review-evidence/review02/atlas-08.png) | R1 |
| `arms/arm_right/hand/thumb` | D023.0／D025.5 | [atlas-08](review-evidence/review02/atlas-08.png)、[atlas-09](review-evidence/review02/atlas-09.png) | 未确认需修问题 |
| `arms/arm_left/hand/palm` | D024.0 | [atlas-08](review-evidence/review02/atlas-08.png) | R1 |
| `arms/arm_right/hand/palm` | D025.0 | [atlas-09](review-evidence/review02/atlas-09.png) | R2 |
| `arms/arm_left/forearm` | D026.0 | [atlas-09](review-evidence/review02/atlas-09.png) | 未确认需修问题 |
| `arms/arm_right/forearm` | D027.0 | [atlas-10](review-evidence/review02/atlas-10.png) | 未确认需修问题 |
| `arms/arm_left/upper_arm` | D028.0 | [atlas-10](review-evidence/review02/atlas-10.png) | R9 |
| `arms/arm_right/upper_arm` | D029.0 | [atlas-10](review-evidence/review02/atlas-10.png) | R10 |
| `neck` | D030.0 | [atlas-11](review-evidence/review02/atlas-11.png) | 未确认需修问题 |
| `body/torso` | D031.0 | [atlas-11](review-evidence/review02/atlas-11.png) | R7、R8 |
| `body/breast` | D032.0 | [atlas-11](review-evidence/review02/atlas-11.png) | 未确认需修问题 |
| `face/ears/ear_left` | D033.0 | [atlas-12](review-evidence/review02/atlas-12.png) | 未确认需修问题 |
| `face/ears/ear_right` | D034.0 | [atlas-12](review-evidence/review02/atlas-12.png) | 未确认需修问题 |
| `face/face_base` | D035.0 | [atlas-12](review-evidence/review02/atlas-12.png) | R13、R14 |
| `face/eyes/eye_left/sclera` | D036.0 | [atlas-13](review-evidence/review02/atlas-13.png) | 未确认需修问题 |
| `face/eyes/eye_right/sclera` | D037.0 | [atlas-13](review-evidence/review02/atlas-13.png) | 未确认需修问题 |
| `face/eyes/eye_left/iris` | D038.0 | [atlas-13](review-evidence/review02/atlas-13.png) | 未确认需修问题 |
| `face/eyes/eye_right/iris` | D039.0 | [atlas-14](review-evidence/review02/atlas-14.png) | 未确认需修问题 |
| `face/eyes/eye_left/highlight` | D040.0 | [atlas-14](review-evidence/review02/atlas-14.png) | 未确认需修问题 |
| `face/eyes/eye_right/highlight` | D041.0 | [atlas-14](review-evidence/review02/atlas-14.png) | 未确认需修问题 |
| `face/eyes/eye_left/upper_eyelid` | D042.0／D065.5 | [atlas-15](review-evidence/review02/atlas-15.png)、[atlas-23](review-evidence/review02/atlas-23.png) | R15 |
| `face/eyes/eye_right/upper_eyelid` | D043.0／D066.5 | [atlas-15](review-evidence/review02/atlas-15.png)、[atlas-23](review-evidence/review02/atlas-23.png) | 未确认需修问题 |
| `face/eyes/eye_left/lower_eyelashes` | D044.0 | [atlas-15](review-evidence/review02/atlas-15.png) | 未确认需修问题 |
| `face/eyes/eye_right/lower_eyelashes` | D045.0 | [atlas-16](review-evidence/review02/atlas-16.png) | 未确认需修问题 |
| `face/eyes/eye_left/eyelid_crease` | D046.0 | [atlas-16](review-evidence/review02/atlas-16.png) | 未确认需修问题 |
| `face/eyes/eye_right/eyelid_crease` | D047.0 | [atlas-16](review-evidence/review02/atlas-16.png) | 未确认需修问题 |
| `face/eyebrows/eyebrow_left` | D048.0 | [atlas-17](review-evidence/review02/atlas-17.png) | R11 |
| `face/eyebrows/eyebrow_right` | D049.0 | [atlas-17](review-evidence/review02/atlas-17.png) | R12 |
| `face/nose` | D050.0 | [atlas-17](review-evidence/review02/atlas-17.png) | 未确认需修问题 |
| `face/blush_left` | D051.0 | [atlas-18](review-evidence/review02/atlas-18.png) | 未确认需修问题 |
| `face/blush_right` | D052.0 | [atlas-18](review-evidence/review02/atlas-18.png) | 未确认需修问题 |
| `face/mouth/mouth_interior` | D053.0 | [atlas-18](review-evidence/review02/atlas-18.png) | 未确认需修问题 |
| `face/mouth/lower_teeth` | D054.0 | [atlas-19](review-evidence/review02/atlas-19.png) | 未确认需修问题 |
| `face/mouth/tongue` | D055.0 | [atlas-19](review-evidence/review02/atlas-19.png) | 未确认需修问题 |
| `face/mouth/upper_teeth` | D056.0 | [atlas-19](review-evidence/review02/atlas-19.png) | 未确认需修问题 |
| `face/mouth/upper_lip` | D057.0 | [atlas-20](review-evidence/review02/atlas-20.png) | 未确认需修问题 |
| `face/mouth/lower_lip` | D058.0 | [atlas-20](review-evidence/review02/atlas-20.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_inner` | D059.0 | [atlas-20](review-evidence/review02/atlas-20.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_left/ribbon_tails/ribbon_tail_outer` | D060.0 | [atlas-21](review-evidence/review02/atlas-21.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_inner` | D061.0 | [atlas-21](review-evidence/review02/atlas-21.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_right/ribbon_tails/ribbon_tail_outer` | D062.0 | [atlas-21](review-evidence/review02/atlas-21.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_left/bow_body` | D063.0 | [atlas-22](review-evidence/review02/atlas-22.png) | 未确认需修问题 |
| `head_accessories/hair_bows/hair_bow_right/bow_body` | D064.0 | [atlas-22](review-evidence/review02/atlas-22.png) | 未确认需修问题 |
| `hair/side_hair/side_hair_left` | D065.0 | [atlas-22](review-evidence/review02/atlas-22.png) | R11 交叉关联 |
| `hair/side_hair/side_hair_right` | D066.0 | [atlas-23](review-evidence/review02/atlas-23.png) | R12 交叉关联 |
| `hair/bangs` | D067.0 | [atlas-24](review-evidence/review02/atlas-24.png) | R11、R12 交叉关联 |
| `head_accessories/hair_clips/hair_clip_upper` | D068.0 | [atlas-24](review-evidence/review02/atlas-24.png) | 未确认需修问题 |
| `head_accessories/hair_clips/hair_clip_lower` | D069.0 | [atlas-24](review-evidence/review02/atlas-24.png) | 未确认需修问题 |
| `legs/leg_left/shoes/ankle_strap/ankle_strap_front` | D070.0 | [atlas-25](review-evidence/review02/atlas-25.png) | 未确认需修问题 |
| `legs/leg_left/shoes/shoe_body` | D071.0 | [atlas-25](review-evidence/review02/atlas-25.png) | 未确认需修问题 |
| `legs/leg_right/shoes/shoe_body` | D072.0 | [atlas-25](review-evidence/review02/atlas-25.png) | 未确认需修问题 |

## 只读核对与交付

检查前后对当前 KRA、groups、occlusion、实际参考及 parts 目录共 **105 个输入文件**核对，磁盘内容均未改变。未调用工程保存、未改上游分层、未写正式 review／repair 文件。记录：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-evidence/review02/read-only-audit.json`。散列仅证明只读，不参与画质结论。

本轮检查完整结束，没有必要输入缺失或工具故障。报告结论为“需要修复”；修复范围以 R1—R15 为准。反馈包含明确位置、图层、参考依据、影响和局部修复方向，未将未确认的差异列为待修问题。

交付暂存报告：`D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/raster-layering/step01/review-02.md.tmp`。
