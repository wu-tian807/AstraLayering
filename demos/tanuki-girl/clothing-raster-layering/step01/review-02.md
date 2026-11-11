结论：需要修复

本轮已检查完 **18 个逻辑衣片、25 个深度绘画层及 4 个显隐蒙版**，确认下列 9 项需要修复的问题。检查对象是正式工程 `clothing-raster-layering/step01/clothing-depth.kra`，没有使用暂存工程代替交付。工程及上游分层文件保持只读；本报告仅检查衣服素材，不检查身体装配。

## 检查范围与证据

在 Krita 5.3.4.1 中实际打开交付工程，画布为 1376×2048。逐层导出并看过独显、隐藏更高深度层的累计画面；对同一逻辑 part 的分片分别检查，再合起来检查连续性。所有这些状态均分别在显隐蒙版停用、启用时检查。另与纯衣服参考整图对照，在原尺寸及放大图中检查领袖、腰侧、返回条、绳接头、珠与流苏、下摆及长垂片接回处。

纯衣服参考 `clothing-part-layering/references/clothing.png` 用于线条、颜色、明暗、纹样和可见形体对照；`part-layering/references/simplified-subject.png` 用于理解穿着时的袖口收拢和穿插。两张参考虽然画布尺寸相同，衣服的位置和比例不同，**没有把原穿衣角色移动或缩放后充作同坐标参考**。框选工具的同坐标参考均使用实际纯衣服 PNG。上游 18 个衣片 SVG 已逐件渲染并与工程的对应 part 看图对照，未将单个 part 的预览当作整套色块图。

已读取正式 `report.md`、`review-01.md`、`repair-01.md` 和上游 `groups.json`、`occlusion.json`；本轮结论依据当前工程的新导出图。首轮报告中的“已修复”记录没有代替本轮看图。没有用 PSNR、相似度或其他数值判定画质。

- [工程初始图层树、完整名称及 UUID](review-evidence/review-02/initial-tree.json)
- [本轮导出清单与 18 个 part／25 个深度层映射](review-evidence/review-02/inspection-manifest.json)：蒙版 off/on 两套状态共 138 幅导出，另有初始默认合成。
- [参考、默认合成及蒙版 off/on 整图对照](review-evidence/review-02/inspection/overall.png)
- [默认合成编号框选图](review-evidence/review-02/regions-default/marked-checker.png)，[工具原始框选图](review-evidence/review-02/regions-default/marked.png)，[坐标、图层和说明 JSON](review-evidence/review-02/regions-default/regions.json)
- [固定系绳 off 合看编号框选图](review-evidence/review-02/regions-cord/marked-checker.png)，[工具原始框选图](review-evidence/review-02/regions-cord/marked.png)，[坐标、图层和说明 JSON](review-evidence/review-02/regions-cord/regions.json)

框坐标均为原画布 `[x,y,宽,高]`；局部对照左侧为参考、右侧为当前。工具原图保留，报告中显示的灰格底版本仅将透明像素合成到观察底色，不移动坐标、不修改衣服像素。R3、R4 的当前图来自同一固定系绳两深度分片的蒙版 off 合看，不能用默认整图中后返被隐藏的状态排除这两个问题。

## 确定问题总表

| 编号 | 所属绘画层／蒙版 | 位置与框坐标 | 当前确定问题 |
| --- | --- | --- | --- |
| R1 | d13 内襟前幅 | 领缘续画处；`[610,530,190,145]` | 两条粉线接点有方形台阶、接位及线宽突变 |
| R2 | d02 右后垂片 | y1200–1320 接回区；`[921,1200,85,180]` | 外缘折向突变、小台阶及翻面内缘毛糙 |
| R3 | d12＋d23 固定系绳；d12 显隐蒙版 | 画面左接头；`[480,686,50,55]` | off 合看时圆端封口线横在连续绳中间 |
| R4 | d12＋d23 固定系绳；d12 显隐蒙版 | 画面右接头；`[860,686,40,55]` | off 合看时另一条圆端封口线横在连续绳中间 |
| R5 | d03 画面左后结翼 | 下半部；`[310,750,220,180]` | 自身折面明暗分区、宽度与参考不符 |
| R6 | d04 画面右后结翼 | 下半部；`[866,750,209,180]` | 本侧自身折面布局、明暗与参考不符 |
| R7 | d08＋d15 左袖；`worn range \| sleeve_screen_left` | 内侧白折角；`[439,605,63,67]` | on 状态左斜边缺描线，底角边线过淡 |
| R8 | d09＋d16 右袖；`worn range \| sleeve_screen_right` | 内侧白折角；`[895,605,50,65]` | on 状态右斜边缺描线，底端截平并留小尖点 |
| R9 | d14 外襟前幅 | 下摆襟边与白料交界；`[565,1075,60,138]` | 白料内残留细亮带和断续灰点线 |

## 逐项修复反馈

### R1 — 内襟双粉线的续画接点未接顺

**图层与位置：** `d13 | kimono_body/right_underlap_panel | complete front cloth and outline`。上方粉线接点约 `(668,545)`，下方约 `(627,574)`；相关隐藏领缘也在本片独显中检查。

**当前表现与参考依据：** 两条粉线从原段接到续画段时均有方形凸台，线的中心轨迹和宽度突然改变。默认合成能看到接点，隐藏 d14 后更清楚。参考同处是连续、宽度平稳的粉色包边，没有这样的接头。

**影响：** 可见领口仍有补画接缝；独显补全段也不能作为一条自然延续的完整包边。

**修复方向及保留内容：** 在 d13 本片上局部重画两条粉线的接入段，沿各自原轨迹接顺中心线、两侧边缘、宽度和线色；邻接深色领料以本片笔触或本片参考取样融色。续画到隐藏段时保持同一包边宽度及其与真实外缘的关系。保留内襟真实轮廓及 d14 的覆盖关系，不增加交叠白缝。完成后检查 d13 独显、隐藏 d14 的累计图及默认交叠，原尺寸下接点不再形成台阶。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R1-comparison.png)；[领口独显／隐藏上层放大](review-evidence/review-02/inspection/detail-collar-junction.png)；[内襟完整补全段](review-evidence/review-02/inspection/detail-underlap-completion.png)。

### R2 — 右后垂片接回区轮廓仍有台阶

**图层与位置：** `d02 | rear_drape_screen_right | complete`。画面右长后垂片的内侧外轮廓，即该片画面左边缘，约 y1200–1320；包括相邻浅紫翻面的深色内缘。

**当前表现与参考依据：** 外轮廓由上段近竖直走向突然接成较斜的下段，接回处留下小台阶；翻面内缘局部描线比上下段毛糙、呈细小锯齿。独显和隐藏上层图均能看到。参考同处外缘缓顺连续，翻面内缘为干净、连贯的线。

**影响：** 同一长垂片的修复上下段仍能被看出接回位置，轮廓及翻面线未成为完整连续的一片。

**修复方向及保留内容：** 先在该局部配准真实外轮廓与翻面内缘的上、下轨迹，再以连续笔触修顺接回曲线、描线和 alpha；将邻接料面的色与明暗接自然。保留已恢复的两花、草叶、下轮廓和完整腰后根，不重做整片或移动纹样。独显、整图和灰格／深底观察时，接回区均不应出现突折、台阶或毛边。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R2-comparison.png)；[接回区独显／合成放大](review-evidence/review-02/inspection/detail-right-drape-join.png)；[翻面内缘放大](review-evidence/review-02/inspection/detail-drape-inner-edge.png)；[正确 alpha 合成的深底复查](review-evidence/review-02/inspection/detail-d02-black.png)。透明 PNG 预览曾出现的彩点／白条未在正确 alpha 合成中成立，不列为工程问题。

### R3 — 固定系绳画面左接头留有内部封口线

**图层与位置：** `d12 | front_waist_cord_knot | side/back cord returns`、`d23 | front_waist_cord_knot | front cord turns, horizontal cord, loops and knot`，以及 d12 的 `default hidden | front_waist_cord_knot` 蒙版。接头约 x493–510、y700–731。

**当前表现与参考依据：** 停用 d12 蒙版，合看 d12＋d23 时，d23 左圆端的封口描线留在绳面内部，跨过连续粉白色带形成一条细弧线。分片独显可确认它来自 d23 的端边。参考的绕带绳在此连续转入腰侧；上游分组也说明前后转换沿腰侧绳路，没有独立断开的绳头或横截封口。

**影响：** 默认隐藏后返时不暴露此搭接问题，但完整 part 显示为两段相接的绳，补全区不干净。

**修复方向及保留内容：** 局部重做左侧同料搭接及转入形体，让 d23 的前向绳路与 d12 后返连续；描边落在真实转折外缘，不横截过粉白带。接顺色带与上下真实轮廓。保留两个深度绘画层，不能以合层或永久隐藏后返代替修复；也不能直接擦掉默认状态所需的全部转入外边。分别检查 d12、d23、off 合看和默认合成，确保完整绳无内部封口线、默认短转入段仍完整。



证据：[工具局部对照原图](review-evidence/review-02/regions-cord/R3-comparison.png)；[左接头与两个分片放大](review-evidence/review-02/inspection/detail-cord-left-return.png)；[固定绳蒙版 off/on](review-evidence/review-02/inspection/mask-d12.png)。

### R4 — 固定系绳画面右接头留有内部封口线

**图层与位置：** 同 R3 的 d12、d23 及 d12 显隐蒙版；右接头约 x870–886、y700–731。

**当前表现与参考依据：** 蒙版 off 合看时，d23 右圆端描线也成为连续绳面内部的弧形封口线。参考右侧粉白绳连续转入腰侧，该位置没有独立末端；分层结构要求它与本系绳后返连续。

**影响：** 右侧完整绳同样留下分片搭接痕迹，不能只修左侧后判定整个 part 连续。

**修复方向及保留内容：** 按右侧自己的转入曲线修复搭接，消除同料内部的端边，保持粉白带和上下外缘连续。保留真实转入轮廓、双环开口、结芯、两深度片及可恢复后返。复查状态与 R3 相同，左右接头都要通过。



证据：[工具局部对照原图](review-evidence/review-02/regions-cord/R4-comparison.png)；[右接头与两个分片放大](review-evidence/review-02/inspection/detail-cord-right-return.png)。

### R5 — 画面左后结翼的自身折面没有还原

**图层与位置：** `d03 | rear_waist_bow/right_bow_wing | complete`，角色右、画面左的后结翼下半部，约 x310–530、y750–930。

**当前表现与参考依据：** 下部折面比参考更亮、更偏紫；其中深色斜三角更尖锐，亮折面及斜向褶脊的宽度、明暗分区发生改变。参考本侧下部为较宽缓的灰紫折面，过渡更平缓。本项依据结翼自身的下部折面，不将参考袖下的外物投影当作必须画回的内容。

**影响：** 默认合成中结翼的立体折叠观感、色与明暗仍与参考不同，隐藏根完整不能抵消这项可见差异。

**修复方向及保留内容：** 以左侧参考中本结翼可见的自身布料为依据，局部恢复灰紫折面的宽度、褶脊位置和明暗过渡，减弱当前尖锐斜三角造成的错误分区；用绘画或本件参考取样与完整隐藏根接顺。不带入袖子或腰带的投影。保留真实翼尖、外圈描线和下方留空，复查独显及默认合成。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R5-comparison.png)；[本侧整翼与隐藏上层放大](review-evidence/review-02/inspection/detail-bow-left.png)。

### R6 — 画面右后结翼的自身折面没有按本侧还原

**图层与位置：** `d04 | rear_waist_bow/left_bow_wing | complete`，角色左、画面右的后结翼下半部，约 x866–1075、y750–930。

**当前表现与参考依据：** 当前本侧也有尖锐深色斜三角及偏亮紫的窄折面；参考右侧是本侧独立的宽缓灰紫折面布局，褶面宽度与明暗关系不同。独显及默认合成均可确认。本项不要求恢复袖子／腰带投下的阴影。

**影响：** 本侧参考中的衣料折面未还原，两翼独立分层虽已保留，画面内容仍需要分别修正。

**修复方向及保留内容：** 按右侧参考独立恢复自身折面、褶脊与色调，不仅镜像 R5 的结果；局部补画与隐藏根自然过渡。保留独立 d04、真实翼尖和外线，不把其他衣片的投影画进来。右侧独显和默认合成分别复查。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R6-comparison.png)；[本侧整翼与隐藏上层放大](review-evidence/review-02/inspection/detail-bow-right.png)。

### R7 — 左袖收拢白折角缺少完整真实边线

**图层与位置：** `d08 | sleeve_screen_left | complete far sleeve wall; native worn-range mask`、所属 `worn range | sleeve_screen_left` 蒙版，以及相邻同袖分片 `d15 | sleeve_screen_left | near white folds and gathered cuff x253-486`。袖口靠内腰侧的白折角，约 x439–502、y605–672。

**当前表现与参考依据：** 蒙版 on 后，白料收成细尖折角，其左斜边没有连续深色描边，底角边线过淡；默认合成呈白剪口。停用蒙版可见完整内壁，但白折角底缘描线也偏淡。纯衣服参考该小折角有完整深色边；原穿衣角色的收拢袖口也保留小折角及真实边线。

**影响：** 穿着状态的袖口仍像通过透明边界裁出的白片，内壁折角的结构线没有画完整。

**修复方向及保留内容：** 先将收拢白折角作为本袖的实际折面完成真实边线、底角及与内壁的折叠衔接，在现有近／远侧分片中处理好归属，再调整显隐范围。线粗和线色按本袖参考接顺。不要只沿蒙版剪口补一条在 off 状态布面内部多出来的截线。保留完整隐藏内壁和袖口收拢形体，不要求回到纯衣服图张开的空心袖口，不取样人体或外物投影。d08、d15 分别独显、同袖 off/on 合看及默认整图都要干净。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R7-comparison.png)；[左白折角 off/on 原尺寸局部放大](review-evidence/review-02/inspection/detail-sleeve-corners.png)；[左袖蒙版 off/on 整片](review-evidence/review-02/inspection/mask-d08.png)；[原穿衣角色袖口原坐标局部](review-evidence/review-02/inspection/worn-sleeves-native-context.png)。

### R8 — 右袖白折角被截平且新露斜边未描线

**图层与位置：** `d09 | sleeve_screen_right | complete far sleeve wall; native worn-range mask`、所属 `worn range | sleeve_screen_right` 蒙版，以及 `d16 | sleeve_screen_right | near white folds and gathered cuff x896-1126`。白折角约 x895–945、y605–670。

**当前表现与参考依据：** on 状态新露出的右斜边没有描线，底端被截成一段短平边，两端留有深色小尖点；默认合成中底角近乎白边封口。off 状态原有轮廓完整，能确认问题发生于当前穿着显隐边界。纯衣服参考和原穿衣角色的小白折角均有连续的真实轮廓线。

**影响：** 右侧内壁折角呈剪切形体，既缺边线，又留下截平端和残尖点，未形成干净完整的收拢袖口。

**修复方向及保留内容：** 按本侧穿着折面独立修正收拢边形、底角及连续描线，与完整内壁自然衔接，再修整对应显隐范围。不要仅加一条蒙版截线，也不要简单把左袖镜像覆盖。保留收拢袖口、隐藏完整内壁和两个分片，off/on 独显与同袖合成中都不能留下断边、平剪口或多余内部线。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R8-comparison.png)；[右白折角 off/on 放大](review-evidence/review-02/inspection/detail-sleeve-corners-right.png)；[右袖蒙版 off/on 整片](review-evidence/review-02/inspection/mask-d09.png)；[原穿衣角色袖口原坐标局部](review-evidence/review-02/inspection/worn-sleeves-native-context.png)。

### R9 — 外襟白料内仍有沿襟边的拼接残线

**图层与位置：** `d14 | kimono_body/left_overlap_panel | complete front cloth and outline`。下摆深色襟边的画面右侧、白料内部，约 x565–625、y1075–1213。

**当前表现与参考依据：** 真实深色边线旁仍有一条细亮带，带内／旁边夹着断续灰点线，沿边延伸到近底缘。默认合成与 d14 独显完全同样，原尺寸可见细带，放大及最近邻显示可分辨灰点；不是其他层透出。参考同处白料与深色襟边自然相接，没有第二条细带和断续点线。

**影响：** 大白下摆与深色襟边交界仍保留局部拼接痕迹，单个外襟衣片不够干净。

**修复方向及保留内容：** 在 d14 本片局部修画白料中的细带与灰点，将明暗接回邻近白料，再接顺真实深色襟边；使用本片笔触或本片参考取样并融色，不沿白料形状整块填色。保留真正的深色边线、粉线、底缘、金花和上部褶皱。原尺寸及放大独显／合成均应只剩参考中的真实交界，不能为清点线又削出白缝。



证据：[工具局部对照原图](review-evidence/review-02/regions-default/R9-comparison.png)；[原尺寸与最近邻放大，参考／默认／d14 独显](review-evidence/review-02/inspection/detail-placket-original.png)；[交界放大对照](review-evidence/review-02/inspection/detail-placket-hem.png)。

## 全衣片检查记录

以下各行均已完成逐深度独显、隐藏上层检查、同 part 合看，以及蒙版 off/on 两套状态检查。返回条是同一逻辑衣片的深度分片，未将它们判成重复衣片。表中“未另发现确定问题”仅指本轮该衣片没有需要另立项的明确问题。

| 逻辑衣片 | 深度绘画层 | 本轮结果 | 同片证据 |
| --- | --- | --- | --- |
| p01 `rear_drape_screen_left` | d01 | 未另发现确定问题；花、三条草叶、翻面、根及底角已看 | [独显](review-evidence/review-02/logical-off/p01.png) |
| p02 `rear_drape_screen_right` | d02 | R2；两花、草叶及底角已看 | [独显](review-evidence/review-02/logical-off/p02.png) |
| p03 `rear_waist_bow/right_bow_wing` | d03 | R5；隐藏根、外圈及留空已看 | [独显](review-evidence/review-02/logical-off/p03.png) |
| p04 `rear_waist_bow/left_bow_wing` | d04 | R6；独立本侧根、外圈及留空已看 | [独显](review-evidence/review-02/logical-off/p04.png) |
| p05 `rear_waist_bow/central_knot_root` | d05 | off 有完整结根，on 为空；未另发现确定问题 | [蒙版切换](review-evidence/review-02/inspection/mask-d05.png) |
| p06 `kimono_body/right_underlap_panel` | d06＋d13 | R1；侧返、隐腰料面与下摆已看 | [合看](review-evidence/review-02/logical-off/p06.png) |
| p07 `kimono_body/left_overlap_panel` | d07＋d14 | R9；侧返、领口、金花及下摆已看 | [合看](review-evidence/review-02/logical-off/p07.png) |
| p08 `sleeve_screen_left` | d08＋d15 | R7；完整远壁与收拢状态分别已看 | [off](review-evidence/review-02/logical-off/p08.png)／[on](review-evidence/review-02/logical-on/p08.png) |
| p09 `sleeve_screen_right` | d09＋d16 | R8；完整远壁与收拢状态分别已看 | [off](review-evidence/review-02/logical-off/p09.png)／[on](review-evidence/review-02/logical-on/p09.png) |
| p10 `inner_waist_wrap` | d10＋d17 | 未另发现确定问题；隐藏金带后完整本料及返回搭接已看 | [合看](review-evidence/review-02/logical-off/p10.png) |
| p11 `outer_waist_band` | d11＋d18 | 未另发现确定问题；隐藏绳后金料、深外线及侧返已看 | [合看](review-evidence/review-02/logical-off/p11.png) |
| p12 `front_waist_cord_knot` | d12＋d23 | R3、R4；双环、结芯及真实环孔已看 | [off](review-evidence/review-02/logical-off/p12.png)／[on](review-evidence/review-02/logical-on/p12.png) |
| p13 `front_pendant_screen_left/right_free_cord` | d19 | 未另发现确定问题；长色带、根及插珠端已看 | [独显](review-evidence/review-02/logical-off/p13.png) |
| p14 `front_pendant_screen_right/left_free_cord` | d20 | 未另发现确定问题；本侧长色带、根及插珠端已看 | [独显](review-evidence/review-02/logical-off/p14.png) |
| p15 `front_pendant_screen_left/right_tassel` | d21 | 未另发现确定问题；隐藏珠后束根、纹与真实弧底已看 | [独显](review-evidence/review-02/logical-off/p15.png) |
| p16 `front_pendant_screen_right/left_tassel` | d22 | 未另发现确定问题；隐藏珠后束根、纹与真实弧底已看 | [独显](review-evidence/review-02/logical-off/p16.png) |
| p17 `front_pendant_screen_left/right_terminal_bead` | d24 | 未另发现确定问题；珠面及绳／束根接点已看 | [独显](review-evidence/review-02/logical-off/p17.png) |
| p18 `front_pendant_screen_right/left_terminal_bead` | d25 | 未另发现确定问题；本侧珠面、高光及两接点已看 | [独显](review-evidence/review-02/logical-off/p18.png) |

逐深度独显总览：[d01–02](review-evidence/review-02/inspection/solo-01-02.png)、[d03–05](review-evidence/review-02/inspection/solo-03-05.png)、[d06–12](review-evidence/review-02/inspection/solo-06-12.png)、[d13–14](review-evidence/review-02/inspection/solo-13-14.png)、[d15–18](review-evidence/review-02/inspection/solo-15-18.png)、[d19–25](review-evidence/review-02/inspection/solo-19-25.png)。

隐藏上层累计 off/on 总览：[d01–03](review-evidence/review-02/inspection/cumulative-01-03.png)、[d04–06](review-evidence/review-02/inspection/cumulative-04-06.png)、[d07–09](review-evidence/review-02/inspection/cumulative-07-09.png)、[d10–12](review-evidence/review-02/inspection/cumulative-10-12.png)、[d13–15](review-evidence/review-02/inspection/cumulative-13-15.png)、[d16–18](review-evidence/review-02/inspection/cumulative-16-18.png)、[d19–21](review-evidence/review-02/inspection/cumulative-19-21.png)、[d22–24](review-evidence/review-02/inspection/cumulative-22-24.png)、[d25](review-evidence/review-02/inspection/cumulative-25-25.png)。每幅对应累计到该深度，更高层隐藏，完整原尺寸 PNG 路径列于导出清单。

完整逻辑 part 总览：[衣身及后件](review-evidence/review-02/inspection/logical-body.png)、[袖子](review-evidence/review-02/inspection/logical-sleeves.png)、[腰料](review-evidence/review-02/inspection/logical-waist.png)、[固定系绳](review-evidence/review-02/inspection/logical-cord.png)、[垂饰](review-evidence/review-02/inspection/logical-pendants.png)。

其余已看过的衔接／纹样细查：[左领袖](review-evidence/review-02/inspection/detail-sleeve-left.png)、[右领袖](review-evidence/review-02/inspection/detail-sleeve-right.png)、[左腰侧](review-evidence/review-02/inspection/detail-waist-left.png)、[右腰侧](review-evidence/review-02/inspection/detail-waist-right.png)、[自由绳](review-evidence/review-02/inspection/detail-cords.png)、[珠与流苏](review-evidence/review-02/inspection/detail-bead-tassel.png)、[内襟下摆](review-evidence/review-02/inspection/detail-inner-hem.png)、[外襟下摆](review-evidence/review-02/inspection/detail-outer-hem.png)、[左垂片花草及底角](review-evidence/review-02/inspection/detail-left-drape-art.png)、[右垂片花草及底角](review-evidence/review-02/inspection/detail-right-drape-art.png)。

实际上游色块形体／当前 part 对照：[p01–02](review-evidence/review-02/inspection/parts-01-02.png)、[p03–05](review-evidence/review-02/inspection/parts-03-05.png)、[p06–07](review-evidence/review-02/inspection/parts-06-07.png)、[p08–09](review-evidence/review-02/inspection/parts-08-09.png)、[p10–14](review-evidence/review-02/inspection/parts-10-14.png)、[p15–18](review-evidence/review-02/inspection/parts-15-18.png)。

## 蒙版、归属与保留要求

四个蒙版均已实际切换检查：d05 和 d12 的默认全黑状态隐藏已画出的结根／后返，停用后内容仍完整；d08、d09 停用后有完整远侧袖壁，启用后保留收拢范围。蒙版数量本身不作为错误，R7、R8 指向切换后真实可见衣料边线和边形的问题。

除上述编号外，本轮未发现需要另立项的人体内容、其他衣片残线／鬼影、外物投影、整片纯色形状填充或前后衣片错误合层。已经检查真实绳环孔、袖口内壁、两垂片之间及衣片外侧的透明留空；这些正常开口不能为了“完整”被填死。本轮没有确定需要修复的纱料透明度问题。

首轮已处理的长垂片花草、金带深外线、自由绳长色带、流苏外线，以及下摆新增深斜褶的去除，本轮均重新看过；没有原样重复列出旧问题。R1、R2、R9 是当前仍可见的局部接顺／清理不足，需以本轮证据继续修复。

修复后应针对 R1–R9 所属层重新检查独显、隐藏上层、同逻辑 part 合看及默认整图；涉及蒙版的 R3、R4、R7、R8 必须同时满足 off/on 两种状态。保留现有独立前后衣片和共同归属的深度分片，以局部绘画、取样接顺及合理形体修正完成，不能依靠隐藏问题区或合层消除检查证据。

## 只读核验

工程初始与检查结束的 SHA-256 相同：

`f50b70369394ba2cffa243fe98e4e931536796fc924e63ca07a1d5aee6c0df55`

Krita 中图层名称、类型、UUID、层序、范围、透明度与显隐状态均已恢复至打开工程时的状态。本轮没有保存 KRA、改写上游分层或发布正式 review／repair 报告。核验结果见 [read-only-verification.json](review-evidence/review-02/read-only-verification.json)。本轮交付为此暂存报告及所引用的本步证据。
