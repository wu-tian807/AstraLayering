结论：需要修复

已完成实际 Krita 工程全部 **59/59 个逻辑部件**的独显、隐藏上层补全区、蒙版启用/停用检查，并检查整图、关节和发面衔接、双眼原尺寸及同倍率放大对照。确认 **35 项需要修复的问题**，用框选工具标出 **37 个区域**；R1-H、R2-H 是同层足部补充定位框，分别归入 R1、R2。

本报告为独立目视 review。未修改或保存 KRA，未改写上游分层文件；检查只临时改变 Krita 内存中的显隐并导出证据，结束时恢复原显隐。报告和证据为本次新增交付。当前没有必要输入缺失、损坏或阻止检查的工具故障。

## 检查依据与范围

- 实际工程：`raster-layering/step01/character-depth.kra`，画布 1115 × 1410。结论依据本次从该工程导出的绘画与合成。
- 依据 `raster-layering/step01/report.md` 确认实际采用的参考：`part-layering/references/standard.png` 用于原有可见头部、眼睛、手、露出四肢、袜与鞋；`part-layering/references/base-subject.png` 用于去除外衣后的连体素体、裸露上臂和颈胸承接。两张实际参考均为 1115 × 1410，未平移、缩放或变形来消除偏差。
- 分层依据：`part-layering/parts`、`part-layering/groups.json`、`part-layering/occlusion.json`；交付映射辅助核对使用 `raster-layering/step01/layer-manifest.json`。
- step01 中没有已有正式 review / repair Markdown；已有 report.md 及过程材料只用于了解预期结构和已做操作，未以其自检结论代替看图。workspace 中的试验和撤回修画不计为最终完成状态。
- 实际 59 个绘画 ID 与上游 occlusion 的 59 条记录、groups.json 的 59 个末级节点一一对应，层序与 1–59 对应。groups.json 中 neck、pelvis、head_accessories 是未继续细分的末级 group，其余 56 个末级节点为 part；本工程沿用这些末级 ID 各交付一件绘画。另有 3 个眼口控制组、10 个原生透明度蒙版。当前没有同一 part 的多个深度分片。腕环前后段、鞋前体与后口原本就是独立 part，未判为重复。
- 每层分别检查本件独显（蒙版开/关）及只保留本层和后方层的补全合成（蒙版开/关）；眼、嘴还检查了本组组装与蒙版开/关。看过整图原尺寸对照，并在相同倍率放大图中核对眼睛、肘、掌指、颈胸、胸腰、鞋口和头发。
- 原图真正的虎口空隙、回弯发束内部空隙和眼褶与睫毛之间的肤色间隙应保留。隐藏区没有精确原图像素时，只对明确的断口、硬接、毛刺、缺轮廓及不合理形体提出修复，不要求臆造像素与遮挡物一致。
- 未确认需新增/重复/合并部件或调整深度层序的问题。没有仅凭外观推断制作方式、或以质量分数判定通过；以下仅列能在证据图中明确确认的绘画及接合问题。

## 整图和框选索引

- [standard 整图同尺寸对照](review-evidence-01/inspection/whole-standard.jpg)；[base-subject 整图同尺寸对照](review-evidence-01/inspection/whole-base.jpg)；[实际默认合成 PNG](review-evidence-01/inspection/actual-default.png)。
- [整图蒙版启用 / 全停用](review-evidence-01/inspection/whole-mask-states.jpg)；[双眼原尺寸并排](review-evidence-01/inspection/eyes-native.jpg)；[双眼同倍率放大](review-evidence-01/inspection/eyes-3x.jpg)。
- [全部问题坐标、图层、证据与 59 层覆盖索引](review-evidence-01/evidence-index.json)；[实际图层树](review-evidence-01/inspection/nodes.json)。

以下两张为框选工具在当前 KRA 默认导出图上的编号定位。standard 框选对应 R1、R2、R6–R8、R19–R25、R27–R32、R34、R35；base 框选对应 R3–R5、R14–R18。隐藏部件和补全区的独显框选见各问题条目。





## 确定需要修复的问题

位置均为原画布 `[x, y, width, height]`；“画面左/右”按观看方向，图层中的 left/right 按角色命名。局部对照均为**左参考、右当前**，来自同一原画布坐标。独显参考栏可能仍显示遮挡物，相关条目已明确说明其可用于比较的范围。每个条目还提供原始当前裁片、参考裁片和工具标记图，可在原尺寸查看。

### R1 — 画面左腿：袜缘波齿、缺描边，完整足部毛刺

- 相关图层：`05 | legs/leg_right/leg`。
- 位置：`[365, 875, 205, 325]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左长袜的两侧轮廓呈连续啃口、台阶，深色描边缺失；原图为平顺、连贯的深色轮廓。
- 补全区定位：`R1-H`，`[335, 1190, 151, 155]`。R1 的补全区补充框：隐藏前鞋体后，踝外缘和足底有连续波齿、突点，且袜面的深色外线没有延续到足部。参考同坐标被鞋遮住，此框依据本件完整、干净及连续描边的要求，不要求复刻不可见的足形像素。
- 参考依据：standard 可见袜侧是平顺的深色外线，袜面明暗留在轮廓内。足部在两张参考中均被鞋遮住，R1-H 只判定补全足踝边缘本身不干净、描边没有延续，不以鞋的像素要求隐藏足形。
- 影响：默认合成中袜缘已经呈连续咬边；独显或露出足部时，足底突点及轮廓风格跳变更明显。
- 修复方向及保留内容：在 05 层逐段收顺透明边缘，去掉袜侧和足底突点，沿原图可见袜缘补回深蓝外线，并自然延续至踝、足背和足底。保持袜面已有柔和明暗及完整腿根；不要以整块深色填充代替袜面，也不要把鞋线画进腿层。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R1-current.png)；[参考局部](review-evidence-01/annotations/standard/R1-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R1-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[legs](review-evidence-01/inspection/legs.jpg)；[feet-full-detail](review-evidence-01/inspection/feet-full-detail.png)；[full-detail-00](review-evidence-01/inspection/full-detail-00.png)。



补全足部证据：[R1-H 独显编号框选](review-evidence-01/annotations/R1-H/marked.png)；[当前足部局部](review-evidence-01/annotations/R1-H/R1-H-current.png)；[同坐标参考局部（足部被鞋遮住）](review-evidence-01/annotations/R1-H/R1-H-reference.png)；[足部参考 / 当前对照](review-evidence-01/annotations/R1-H/R1-H-comparison.png)；[补充框坐标记录](review-evidence-01/annotations/R1-H/regions.json)。



### R2 — 画面右腿：袜侧锯齿和深色外线缺失

- 相关图层：`04 | legs/leg_left/leg`。
- 位置：`[600, 925, 108, 275]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右长袜两侧同样出现波浪状碎边、断续轮廓，原有深色外线没有延续完整。
- 补全区定位：`R2-H`，`[578, 1190, 130, 145]`。R2 的补全区补充框：隐藏前鞋体后，完整足底留有多个向外凸出的毛刺和不平整波齿，袜缘深色轮廓未连至完整足部。参考同坐标足部被鞋遮住，此框判定的是补全轮廓本身的干净、连续程度。
- 参考依据：standard 中这条直立长袜两侧都有连续清楚的深色轮廓。R2-H 的足底处被鞋遮挡，依据完整部件干净、描边延续的要求检查，不要求复制不可见的脚形。
- 影响：可见小腿的细碎波齿改变轮廓；补全足底外凸毛刺会在独显和后续露出时显现。
- 修复方向及保留内容：修顺 04 层两侧袜缘和补全足底的 alpha，补齐原有深色外线，使直段到踝部的线宽自然过渡。保留袜口曲线、腿部比例和袜面色阶，完整足部仍留在本层。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R2-current.png)；[参考局部](review-evidence-01/annotations/standard/R2-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R2-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[legs](review-evidence-01/inspection/legs.jpg)；[feet-full-detail](review-evidence-01/inspection/feet-full-detail.png)；[full-detail-00](review-evidence-01/inspection/full-detail-00.png)。



补全足部证据：[R2-H 独显编号框选](review-evidence-01/annotations/R2-H/marked.png)；[当前足部局部](review-evidence-01/annotations/R2-H/R2-H-current.png)；[同坐标参考局部（足部被鞋遮住）](review-evidence-01/annotations/R2-H/R2-H-reference.png)；[足部参考 / 当前对照](review-evidence-01/annotations/R2-H/R2-H-comparison.png)；[补充框坐标记录](review-evidence-01/annotations/R2-H/regions.json)。



### R3 — 画面右臂：上臂至前臂描边粗细不连续

- 相关图层：`22 | arms/arm_left/forearm`；`24 | arms/arm_left/upper_arm`。
- 位置：`[610, 571, 205, 315]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右臂、尤其前臂，两侧原有粗暖棕描边变成极细线；肘接点描边粗细突变。
- 参考依据：standard 的可见前臂、base-subject 的裸露上臂与肘部均使用连续暖棕轮廓；本框以 base-subject 对照，前臂原有外线也可在 standard 整图及右手上下文中核对。
- 影响：前臂变成浅细线围成的皮肤面，上臂的粗线在肘端突然减细，整条手臂的线条风格与原图不一致。
- 修复方向及保留内容：主要在 22 层恢复前臂两侧暖棕外线，校准到原图相应线宽、颜色及转折；在 24/22 的肘部搭接处接顺线宽。按 standard 约束露出前臂，按 base-subject 约束裸露上臂，不整臂缩放；保留皮肤原有明暗。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R3-current.png)；[参考局部](review-evidence-01/annotations/base/R3-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R3-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[elbows-base](review-evidence-01/inspection/elbows-base.png)；[hand-screen-right](review-evidence-01/inspection/hand-screen-right.jpg)；[full-detail-04](review-evidence-01/inspection/full-detail-04.png)。



### R4 — 画面左肘：外缘缺口、台阶及浅色接边

- 相关图层：`25 | arms/arm_right/upper_arm`；`23 | arms/arm_right/forearm`。
- 位置：`[370, 715, 69, 52]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左肘上臂与前臂搭接处的外轮廓有缺口、台阶，皮肤出现横向淡色接边，原参考连接平顺。
- 参考依据：base-subject 中上臂到前臂的皮肤与外线连续；当前折口和横向淡色边沿实际分层搭接处出现。
- 影响：原尺寸下能辨认出关节由两块拼合，外轮廓的突然内缩也改变肘部形体。
- 修复方向及保留内容：局部调整 25 层的肘端覆盖边和 23 层的承接段，使两层合成外线落在同一条平滑曲线上；在各自本件上融接浅色带并接齐暖棕线。保留上臂、前臂各自完整补形，不用第三层贴片遮盖。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R4-current.png)；[参考局部](review-evidence-01/annotations/base/R4-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R4-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[elbows-base](review-evidence-01/inspection/elbows-base.png)；[full-detail-04](review-evidence-01/inspection/full-detail-04.png)。



### R5 — 画面右肘：弧形浅色拼接带和内缘台阶

- 相关图层：`24 | arms/arm_left/upper_arm`；`22 | arms/arm_left/forearm`。
- 位置：`[666, 727, 80, 55]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右肘接合处形成清楚的弧形浅色带和内缘小台阶，原参考没有此拼接带。
- 参考依据：base-subject 的同位置没有这条清楚的弧形分色带；皮肤体积明暗跨肘部连续。
- 影响：浅色带沿层边走，内轮廓又有短促台阶，接缝在默认合成就可见。
- 修复方向及保留内容：将 24 层肘端与 22 层下方承接皮肤的色阶逐步融接，修顺弧形覆盖边，校准内外轮廓的接点和线宽。保留肘部自身柔和阴影，不把分层边缘描成新的关节横线。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R5-current.png)；[参考局部](review-evidence-01/annotations/base/R5-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R5-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[elbows-base](review-evidence-01/inspection/elbows-base.png)；[full-detail-04](review-evidence-01/inspection/full-detail-04.png)。



### R6 — 画面左手：掌指根部浅色硬带、虎口断线

- 相关图层：`21 | arms/arm_right/hand/palm`；`19 | arms/arm_right/hand/index_finger`；`17 | arms/arm_right/hand/thumb`。
- 位置：`[249, 905, 95, 38]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左手掌指搭接出现横向浅色硬带，虎口上端结构线有断点、粗细突变，原图同处连续。
- 参考依据：standard 的掌面到指根明暗连贯，虎口上端结构线完整，没有当前横向浅色条。
- 影响：掌与指根像局部拼贴；虎口线条粗细跳变使手部结构和明暗层次偏离原图。
- 修复方向及保留内容：分别在 21、19、17 的实际搭接区域融接本件皮肤色阶，消除横向浅条，沿原图补齐虎口上端连续结构线并校准粗细。保持原图掌面和指身暖色暗面、浅高光以及真实虎口开口。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R6-current.png)；[参考局部](review-evidence-01/annotations/standard/R6-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R6-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hand-screen-left](review-evidence-01/inspection/hand-screen-left.jpg)；[left-finger-joint](review-evidence-01/inspection/left-finger-joint.png)。



### R7 — 画面右手：掌食指根部斜向硬接与轮廓台阶

- 相关图层：`20 | arms/arm_left/hand/palm`；`18 | arms/arm_left/hand/index_finger`；`16 | arms/arm_left/hand/thumb`。
- 位置：`[811, 893, 50, 43]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右手掌与食指根部有斜向色差硬边，轮廓在搭接末端形成台阶；虎口根部线条叠加发乱。
- 参考依据：standard 同位置的掌面和食指根没有直切分色边；虎口线条形成清楚的单一结构。
- 影响：硬边和外缘台阶暴露掌指拼接，虎口根部叠线使局部结构发乱。
- 修复方向及保留内容：在 20/18 的根部局部对齐覆盖轮廓，顺着掌指体积融色；检查 16 的虎口根边，清除只由搭接造成的重复短线，让本件结构线接成单条。保留食指和拇指各自完整根段、原手部明暗及真实空隙。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R7-current.png)；[参考局部](review-evidence-01/annotations/standard/R7-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R7-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hand-screen-right](review-evidence-01/inspection/hand-screen-right.jpg)。



### R8 — 画面右手：食指与中指新增透明裂缝、指端延长

- 相关图层：`14 | arms/arm_left/hand/middle_finger`；`18 | arms/arm_left/hand/index_finger`。
- 位置：`[808, 934, 53, 53]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右手中指与食指间新增细长透明裂缝；中指末端向下延长。原图两指此段紧接，只保留连续分界线。
- 参考依据：standard 这段两指贴接，仅有连续分界线；灰底透明证据确认当前窄白条是实际透明裂缝，并非皮肤高光。
- 影响：原图连成一片的手部出现透底细缝，中指末端下移改变手指长度关系。
- 修复方向及保留内容：对照 standard 原尺寸修正 14 的指端位置及与 18 的接触侧缘，以各自手指的皮肤和本件边线接合；合成应贴接并只留原有分界。保留真正的虎口开口，不把整只手的所有指缝填实，也不借后方隐藏指覆盖此缝。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R8-current.png)；[参考局部](review-evidence-01/annotations/standard/R8-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R8-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[right-finger-slit](review-evidence-01/inspection/right-finger-slit.png)；[hand-screen-right](review-evidence-01/inspection/hand-screen-right.jpg)。



### R9 — 画面右小指：完整补形缺少自身外轮廓

- 相关图层：`10 | arms/arm_left/hand/little_finger`；`后方手指默认遮挡`。
- 位置：`[821, 898, 44, 69]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：停用蒙版后，画面右小指的侧缘与指端只有浅色细边，没有接续原图同一只手的暖棕外轮廓；默认隐藏掩盖了完整绘画未完成的问题。
- 参考依据：此小指 hiddenInReference，原图不提供完整外形。判定依据是同一只手可见手指的连续暖棕描边风格，以及每个部件必须独显完整；同坐标参考只交代遮挡位置。
- 影响：默认全隐藏蒙版使瑕疵暂时不可见，解除蒙版后小指轮廓风格和其他手指明显不一致。
- 修复方向及保留内容：停用本层「后方手指默认遮挡」修画 10 层，沿已有合理小指形体补齐两侧和圆钝指端的暖棕外线，使线宽、颜色和明暗收束与同手一致。保留指腹明暗、完整根段及默认遮挡控制；不按参考里的其他手指轮廓裁成它们的形状。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R9/marked.png)；[当前局部](review-evidence-01/annotations/R9/R9-current.png)；[参考局部](review-evidence-01/annotations/R9/R9-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R9/R9-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R9/regions.json)。
- 补充观察：[full-detail-01](review-evidence-01/inspection/full-detail-01.png)；[hand-screen-right](review-evidence-01/inspection/hand-screen-right.jpg)。



### R10 — 画面左小指：深描边只剩指端短段

- 相关图层：`11 | arms/arm_right/hand/little_finger`；`后方手指默认遮挡`。
- 位置：`[263, 912, 30, 49]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：画面左小指独显完整层的侧缘描边大幅变细，只有末端保留较深的短边，未形成与原手指一致的完整外轮廓。
- 参考依据：原图本指被遮挡，不能逐像素比较隐藏形状；同手露出指身与指端都有连贯暖棕外线。
- 影响：完整小指侧线衰减到很浅，只留下较深指端，独显时轮廓粗细和色深突变。
- 修复方向及保留内容：在 11 层完整绘画上接续指端已有深线，补顺两侧至根部的自身轮廓，线宽随圆弧自然变化；维持已有指腹色阶和合理补形。修后分别看蒙版关闭的完整小指及开启的原姿态，保留默认隐藏蒙版。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R10/marked.png)；[当前局部](review-evidence-01/annotations/R10/R10-current.png)；[参考局部](review-evidence-01/annotations/R10/R10-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R10/R10-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R10/regions.json)。
- 补充观察：[full-detail-02](review-evidence-01/inspection/full-detail-02.png)；[hand-screen-left](review-evidence-01/inspection/hand-screen-left.jpg)。



### R11 — 画面右无名指：只有浅橙侧缘，深描边未完成

- 相关图层：`12 | arms/arm_left/hand/ring_finger`；`后方手指默认遮挡`。
- 位置：`[807, 898, 46, 78]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：画面右无名指停用蒙版后只有淡橙侧缘与几条关节细线，没有接续原图手部的深暖棕外轮廓，完整绘画风格不一致。
- 参考依据：本指原图隐藏，依据同手可见手指的暖棕外线与完整部件标准；浅橙关节细线不能替代指身外轮廓。
- 影响：解除蒙版后，完整无名指与前方手指线条风格不一致，侧缘和指端没有同样清楚的结构。
- 修复方向及保留内容：在 12 层补齐本件侧缘及圆钝指端的暖棕描边，接顺已有关节浅线、指腹明暗与根部色阶。避免整指均匀粗圈线，避免画入前方食指或掌缘；保留原默认全隐藏蒙版。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R11/marked.png)；[当前局部](review-evidence-01/annotations/R11/R11-current.png)；[参考局部](review-evidence-01/annotations/R11/R11-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R11/R11-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R11/regions.json)。
- 补充观察：[full-detail-02](review-evidence-01/inspection/full-detail-02.png)；[hand-screen-right](review-evidence-01/inspection/hand-screen-right.jpg)。



### R12 — 画面左无名指：完整侧缘和指端描线过弱

- 相关图层：`13 | arms/arm_right/hand/ring_finger`。
- 位置：`[267, 897, 41, 70]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：画面左无名指完整层以柔化明暗作边缘，侧缘及指端没有原手指那样明确、连续的暖棕描线，显露补全时轮廓风格会跳变。
- 参考依据：standard 仅露出本指局部，完整隐藏段依据同手可见指身的暖棕轮廓延续；不要求隐藏区复制原图不存在的像素。
- 影响：本层独显以柔化色阶围成轮廓，补全段显露后会与原有清楚指线产生风格跳变。
- 修复方向及保留内容：在 13 层补全本指侧缘与指端的连续暖棕外线，和现有可见小段的线深、线宽接齐；保持完整根部及柔和指腹明暗，保留当前真实指缝和层级。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R12/marked.png)；[当前局部](review-evidence-01/annotations/R12/R12-current.png)；[参考局部](review-evidence-01/annotations/R12/R12-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R12/R12-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R12/regions.json)。
- 补充观察：[full-detail-02](review-evidence-01/inspection/full-detail-02.png)；[hand-screen-left](review-evidence-01/inspection/hand-screen-left.jpg)。



### R13 — 画面左拇指：隐藏根部硬色块与外线断点

- 相关图层：`17 | arms/arm_right/hand/thumb`。
- 位置：`[301, 895, 48, 31]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：画面左拇指隐藏根部与可见指身之间有斜向硬色边，外侧深描边在补全边界突然停止；根部暗橙圆块没有和指身自然融接。
- 参考依据：原图可见指身有自然明暗和连续外线；隐藏根部没有原图纹理可逐像素比，但本层独显清楚显示斜向硬接和深描边突然结束。
- 影响：完整拇指的根部与指身不像同一个连续部件，展开遮挡后会露出暗橙块和接线断点。
- 修复方向及保留内容：在 17 层将根部暗橙明暗顺着拇指体积渐变融入可见指身，清掉斜向切边，延续本件侧线至隐藏根段并自然收束。保留当前可见拇指轮廓及掌下完整根部；不要烘焙掌边投影或把掌缘线纳入拇指。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R13/marked.png)；[当前局部](review-evidence-01/annotations/R13/R13-current.png)；[参考局部](review-evidence-01/annotations/R13/R13-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R13/R13-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R13/regions.json)。
- 补充观察：[full-detail-03](review-evidence-01/inspection/full-detail-03.png)；[hand-screen-left](review-evidence-01/inspection/hand-screen-left.jpg)。



### R14 — 胸腰画面左外线：上接点叠线、胸下断接

- 相关图层：`27 | body/torso`；`28 | body/breast`；`29 | pelvis`。
- 位置：`[473, 621, 53, 140]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：胸部画面左侧线在上接点分成多条，胸下末端和腰侧出现断线、硬接边及尖角，原图同一条外线连续。
- 参考依据：base-subject 中连体素体的左侧边线沿胸侧至腰部连贯，原图不是当前几条错开的接线。
- 影响：胸部、躯干、骨盆的连接处形成多条短边、缺口和尖接点，整图暴露拆层边界。
- 修复方向及保留内容：在 27/28/29 的对应搭接段对齐本件外线，以 base-subject 的单条长曲线校准上接点、胸下端和腰侧；去掉额外并行短线，补齐断段，接顺线宽及旁侧布面色阶。保持三件的独立完整补形、领口及布面自身明暗。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R14-current.png)；[参考局部](review-evidence-01/annotations/base/R14-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R14-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[body](review-evidence-01/inspection/body.jpg)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



### R15 — 胸腰画面右外线：双边、错位和白色缺口

- 相关图层：`27 | body/torso`；`28 | body/breast`；`29 | pelvis`。
- 位置：`[648, 608, 43, 161]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：胸部画面右侧线在胸下和腰侧断接、错位，局部露出并行双边与白色缺口，原参考外轮廓连续。
- 参考依据：base-subject 的胸侧至腰侧是一条连续清楚的外线，当前胸下和腰侧出现错开的线端及白色中断。
- 影响：右侧边缘呈拼接轮廓，胸腰体积线在关节处分叉，形体和层间衔接均不满足目标。
- 修复方向及保留内容：校准 28 与 27、29 两端的外线落点和切线方向，去掉重复边，接齐白色缺口；在所属层内修顺布面 alpha 和邻接色阶。沿原图连续曲线修局部，不整体平移胸或骨盆掩盖接缝。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R15-current.png)；[参考局部](review-evidence-01/annotations/base/R15-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R15-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[body](review-evidence-01/inspection/body.jpg)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



### R16 — 画面左纵向结构线：胸下断线、骨盆段抖动

- 相关图层：`28 | body/breast`；`29 | pelvis`；`27 | body/torso`。
- 位置：`[506, 664, 44, 145]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左侧纵向结构线在胸下断开，骨盆段线条变成逐级抖动的折线，未平滑接上原图长弧线。
- 参考依据：base-subject 中此纵向布面结构线沿胸下向骨盆平顺延续；当前线端之间断开，下段呈逐级折线。
- 影响：连体素体原有立体结构线未画完整，腰腹到骨盆的曲率显得断裂。
- 修复方向及保留内容：按原图长弧线在 28、27、29 各自负责的区域接齐结构线，收顺骨盆段的阶梯抖动，匹配浅灰蓝线宽与线深；搭接时只显示一条连续线。保留原有布面亮暗，不增加新的缝线或双线。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R16-current.png)；[参考局部](review-evidence-01/annotations/base/R16-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R16-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[body](review-evidence-01/inspection/body.jpg)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



### R17 — 画面右纵向结构线：胸下至骨盆留长空白

- 相关图层：`28 | body/breast`；`29 | pelvis`；`27 | body/torso`。
- 位置：`[646, 663, 28, 151]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右侧纵向结构线在胸下结束后留长段空白，再从骨盆重起，位置和曲率不连续。
- 参考依据：base-subject 对应结构线的走向连续，当前胸下线停止后很长一段未接续，骨盆段从偏离方向的位置重起。
- 影响：原图已有结构线缺段，连续衣面被读成不相接的两段。
- 修复方向及保留内容：在 28/27/29 的本件区域补画缺失线段，按参考校准胸下末端到骨盆起点的位置、曲率、颜色和粗细；三层合成只出现同一条线，完整层里向遮挡区自然延续。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R17-current.png)；[参考局部](review-evidence-01/annotations/base/R17-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R17-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[body](review-evidence-01/inspection/body.jpg)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



### R18 — 颈与胸口：红色颈块硬接和新增边线

- 相关图层：`26 | neck`；`27 | body/torso`。
- 位置：`[507, 557, 122, 44]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：颈部与胸口出现清楚的红色颈块边界和细描线，色阶沿部件边界硬接；原图锁骨区域皮肤连续。
- 参考依据：base-subject 的颈部暖色明暗自然融入锁骨皮肤；并没有当前沿颈层边缘走的清楚红块下界。
- 影响：默认画面出现一块红色颈形的独立边界，连续皮肤被分层接边切开。
- 修复方向及保留内容：在 26 的下缘与 27 的锁骨承接区域逐步融接暖红到胸口肤色，去掉只用来圈部件边界的细线；保留颈部自身立体暗面和原图需要的结构，不把脸或衣领投影画进颈层。两件独显仍有完整形体。
- 框选与裁片：[编号框选](review-evidence-01/annotations/base/marked.png)；[当前局部](review-evidence-01/annotations/base/R18-current.png)；[参考局部](review-evidence-01/annotations/base/R18-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/base/R18-comparison.png)；[工具坐标记录](review-evidence-01/annotations/base/regions.json)。
- 补充观察：[body](review-evidence-01/inspection/body.jpg)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



### R19 — 画面左鞋：外侧白残边、前后口缘双弧

- 相关图层：`07 | legs/leg_right/shoes/shoe_front`；`03 | legs/leg_right/shoes/cuff_back`。
- 位置：`[319, 1147, 157, 240]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左鞋外侧留有细白边，鞋口前后段出现双层错开的暗弧和接点台阶，原图是单一连续鞋口。
- 参考依据：standard 的鞋外缘由深线清楚收束，前后鞋口在两侧连接为同一个口缘，没有当前错开另露的暗弧。
- 影响：白色细边及鞋口台阶在合成外圈可见，后口和前鞋体像两个叠错的环。
- 修复方向及保留内容：清理 07 本件外缘多余白色残边，保留鞋面原有白色亮面；局部校准 03/07 两侧鞋口端点、线宽与颜色，去掉接合处多出来的外露暗弧，使鞋口平顺。保持 cuff_back 在腿后、shoe_front 在腿前的现有正确穿插，完整后壁和前鞋体均保留。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R19-current.png)；[参考局部](review-evidence-01/annotations/standard/R19-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R19-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[shoes](review-evidence-01/inspection/shoes.jpg)；[full-detail-00](review-evidence-01/inspection/full-detail-00.png)；[full-detail-01](review-evidence-01/inspection/full-detail-01.png)。



### R20 — 画面右鞋：左缘白边、后口额外外露一圈

- 相关图层：`06 | legs/leg_left/shoes/shoe_front`；`02 | legs/leg_left/shoes/cuff_back`。
- 位置：`[570, 1167, 151, 216]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右鞋左外缘有白色残边；后口弧线在前鞋口外另露一圈，两端接合不顺。
- 参考依据：standard 同位置鞋外线和鞋口连接单一清楚；当前后口弧在前口外另显一圈，两端接点偏离原弧。
- 影响：外边有亮残线，鞋口显得双层错位，前后段衔接不自然。
- 修复方向及保留内容：修净 06 的左外缘白色残边，校准 02 的可见后口端与 06 前口端，接顺同一口缘的厚度、曲率和色阶；只消除额外错露和端点台阶，保留原鞋自身的高光、鞋舌和内部后壁，保持既有前后深度关系。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R20-current.png)；[参考局部](review-evidence-01/annotations/standard/R20-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R20-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[shoes](review-evidence-01/inspection/shoes.jpg)；[full-detail-00](review-evidence-01/inspection/full-detail-00.png)；[full-detail-01](review-evidence-01/inspection/full-detail-01.png)。



### R21 — 后发回弯束与发尖：外线变薄、碎边

- 相关图层：`01 | hair/back_hair`。
- 位置：`[170, 203, 746, 391]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：后发两侧回弯束及外围发尖的深色外线变薄、局部消失，边缘呈细碎锯齿，和原图连续深色轮廓不符。
- 参考依据：standard 两侧回弯束和外围短尖有连续深蓝外轮廓；当前这些外线局部缺失，只有细碎边缘。
- 影响：后发主体的轮廓风格及尖端形状偏离原图，放大和独显时毛边明显。
- 修复方向及保留内容：在 01 层按两侧回弯束、外围短尖逐段恢复本件深色轮廓，清理突点并接顺已有外线，线宽随发尖自然收束。保留回弯内部原有真空隙和同片发面之间的实体连接；不要整圈统一加粗，也不要以实心块填掉发缕间原有空间。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R21-current.png)；[参考局部](review-evidence-01/annotations/standard/R21-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R21-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hair](review-evidence-01/inspection/hair.jpg)；[full-detail-00](review-evidence-01/inspection/full-detail-00.png)。



### R22 — 三角头饰下方：青蓝发面亮带遗漏

- 相关图层：`01 | hair/back_hair`；`57 | hair/side_hair/side_hair_left`。
- 位置：`[714, 267, 51, 67]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：三角头饰下方原有醒目的青蓝发面亮带遗漏，当前此处全为深蓝。
- 参考依据：standard 头饰正下方有醒目的青蓝亮发面；groups.json 的 head_accessories 只包含三角饰件，该亮带属于既有头发分区。独显证据显示 01/57 对应处也没有该颜色。
- 影响：原图明确存在的大色块细节被遗漏，右上发面配色和辨识细节改变。
- 修复方向及保留内容：按既有后发/侧发边界，将青蓝亮带画回实际归属的 01、57 发面，复原位置、形状、深浅过渡和相邻深色发流线；两层的承接处保持连续。不要另建漂浮头饰亮条，也不要把这片发面并入 59 三角饰件。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R22-current.png)；[参考局部](review-evidence-01/annotations/standard/R22-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R22-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hair-accessory-detail](review-evidence-01/inspection/hair-accessory-detail.png)；[hair](review-evidence-01/inspection/hair.jpg)。



### R23 — 刘海：发尖缩短、弧底变平及深线缺段

- 相关图层：`56 | hair/bangs`。
- 位置：`[331, 229, 212, 155]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：刘海可见发尖缩短、中央弧底变平，外缘深线未完整保留，尖端有碎边。
- 参考依据：standard 可见刘海尖端和中央弧底的位置、弯曲程度及深色外线与当前不同；原图尖端更完整。
- 影响：额前留白及发尖形状变化，且尖端碎边、缺线使前发不像原图的完整同片发面。
- 修复方向及保留内容：在 56 层按原图同坐标局部修正可见尖端和弧底，延续外轮廓及内部发缕线并清理 alpha；与隐藏发根的色阶接顺。保留高光分块、同片发缕之间的连通，不整片缩放刘海，也不把各发缕裁成分离小片。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R23-current.png)；[参考局部](review-evidence-01/annotations/standard/R23-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R23-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hair](review-evidence-01/inspection/hair.jpg)；[full-detail-11](review-evidence-01/inspection/full-detail-11.png)。



### R24 — 画面右侧发：额角边界抬高、贴脸短尖提前收尾

- 相关图层：`57 | hair/side_hair/side_hair_left`。
- 位置：`[529, 197, 205, 367]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右侧斜扫额角的边界抬高，贴脸短尖提前结束；完整层外上缘转接有明显折角，原图发面轮廓及发流更连贯。
- 参考依据：standard 的斜扫额角边界更低、贴脸短尖更长；当前完整层从上方宽面到外侧长发的转接也有短促折角。隐藏区只要求发流合理连续，不要求复刻被遮挡纹理。
- 影响：额角露出面积与贴脸发尖位置改变；完整侧发的转接轮廓不够连续。
- 修复方向及保留内容：在 57 层局部校准斜扫边界和贴脸短尖至原图位置，接顺从宽发面到侧部长发的轮廓与发流线，修去突兀折角。保留整个侧发连续形体及自己的明暗，不整层缩放或移动来对齐某一个发尖。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R24-current.png)；[参考局部](review-evidence-01/annotations/standard/R24-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R24-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hair](review-evidence-01/inspection/hair.jpg)；[full-detail-11](review-evidence-01/inspection/full-detail-11.png)。



### R25 — 画面左侧发：短尖到长末端出现直切深蓝色块

- 相关图层：`58 | hair/side_hair/side_hair_right`。
- 位置：`[320, 433, 70, 160]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左侧短尖向长末端连接处有直切的深蓝色块边界，原图是随发束弯转的色阶与线条。
- 参考依据：standard 同处的深浅发面随发束弯转，带有沿发流的曲线；当前连接区能看到近乎竖直的深蓝块界。
- 影响：同一侧发内部呈色块拼接，发面弯曲和立体明暗不符合原图。
- 修复方向及保留内容：在 58 层将直切色块边改为顺发束弯转的明暗分界，补顺发流线、深浅色阶及短尖到长末端的过渡。保留青蓝内侧亮发面和深色外线，避免用均匀模糊抹掉原图的分色细节。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R25-current.png)；[参考局部](review-evidence-01/annotations/standard/R25-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R25-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[hair](review-evidence-01/inspection/hair.jpg)；[full-detail-11](review-evidence-01/inspection/full-detail-11.png)。



### R26 — 完整脸底：画面右颊保留内凹折口

- 相关图层：`34 | face/face_base`。
- 位置：`[645, 455, 34, 58]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：隐藏侧发后的画面右脸颊边缘存在短促的内凹折口，保留了遮挡边界形状；完整脸底应从颊侧平顺延续到下颌。
- 参考依据：该处在 standard 被侧发遮挡，原图不能提供精确隐藏颊线；可见下颌延续和 groups.json 的完整脸底要求，均支持颊侧平顺接向下颌。独显的短促内凹折口本身是确定补形瑕疵。
- 影响：去掉侧发后，完整脸颊在接向下颌时突然折入，形体不像连续完整脸底。
- 修复方向及保留内容：只在 34 层修顺该短段颊线，依据前后颊弧、下颌切线补成合理圆滑延续，接齐自身肤色与外线。保留可见脸型及下巴，不扩成耳形，不混入侧发、耳或其他五官。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R26/marked.png)；[当前局部](review-evidence-01/annotations/R26/R26-current.png)；[参考局部](review-evidence-01/annotations/R26/R26-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R26/R26-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R26/regions.json)。
- 补充观察：[full-detail-06](review-evidence-01/inspection/full-detail-06.png)。



### R27 — 画面右耳：可见深色外轮廓未完整保留

- 相关图层：`32 | face/ears/ear_left`。
- 位置：`[713, 347, 62, 112]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右耳可见外缘仅剩极细浅棕线，原有深色外轮廓没有完整保留。
- 参考依据：standard 耳外缘有明确深色描线；当前耳独显及合成都只剩很细的浅棕线。此项指耳自身外线，不把头发遮挡投影当作应保留内容。
- 影响：耳朵外缘相对原图变软变浅，与脸、发的清楚外线不协调。
- 修复方向及保留内容：在 32 层恢复本耳可见外缘的原有深暖色描线，顺耳廓自然延续到补全段，保持原耳形、线宽变化和耳腔明暗。与头发搭接处只画耳自身内容，避免烘焙侧发暗影。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R27-current.png)；[参考局部](review-evidence-01/annotations/standard/R27-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R27-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[ear-detail](review-evidence-01/inspection/ear-detail.png)；[full-detail-06](review-evidence-01/inspection/full-detail-06.png)。



### R28 — 画面左颊红晕：红底变成横椭圆粉斑

- 相关图层：`36 | face/blush_right`。
- 位置：`[386, 459, 78, 49]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左颊红晕变成可辨认的横椭圆粉色斑，外沿和肤色过渡与原图散开的红底不同。
- 参考依据：standard 红底沿脸颊自然散开，和小红晕笔线融合；当前粉色外沿呈可辨认的横椭圆斑形。
- 影响：红晕仍有红色，但原图的分布及融色效果没有还原，肤色上能辨认出另贴一块斑。
- 修复方向及保留内容：在 36 层保留红色底及原有小笔线，按原图局部调整红底浓淡和扩散方向，打散过于均匀的椭圆外沿，让红色自然过渡到肤色。不要删去红底仅留细线，也不要只靠整体降低不透明度掩盖形状问题。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R28-current.png)；[参考局部](review-evidence-01/annotations/standard/R28-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R28-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[blush-detail](review-evidence-01/inspection/blush-detail.png)；[full-detail-07](review-evidence-01/inspection/full-detail-07.png)。



### R29 — 画面右眼：睫毛虹膜白缝、高光和虹膜层次偏差

- 相关图层：`37 | face/eyes/eye_left/sclera`；`38 | face/eyes/eye_left/iris`；`39 | face/eyes/eye_left/highlight`；`40 | face/eyes/eye_left/upper_eyelid`；`眼睛开口 left`。
- 位置：`[546, 310, 141, 128]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右眼睫毛下与虹膜顶端多出细白缝；主白高光缩小，瞳孔内浅蓝反光变成亮白点，虹膜青色亮面层次与原图有偏差。
- 参考依据：standard 与当前在原尺寸、同倍率并排检查：原图虹膜上缘接入睫毛内缘，主白高光更大，瞳孔小反光较暗且偏蓝，青色亮面过渡与当前不同。
- 影响：上缘白缝使虹膜与睫毛脱开；反光大小、亮度及虹膜色阶改变原图眼睛神态和质感。
- 修复方向及保留内容：对 37/38/40 和共享「眼睛开口 left」校准睫毛内缘、虹膜上缘与可见开口，使默认位置不露出额外白缝；38 补准原图深蓝、蓝青及下部亮面的形状和过渡，39 修正主高光大小以及瞳孔内小反光的颜色、亮度和柔边。保留 40 自身完整睫毛尖、眼白自身体积淡色和完整虹膜；不在 37 烘焙原图睫毛投影，不用移动整只眼或加新眼线掩盖白缝。修后必须再次原尺寸单眼并排复核。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R29-current.png)；[参考局部](review-evidence-01/annotations/standard/R29-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R29-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[eyes-native](review-evidence-01/inspection/eyes-native.jpg)；[eyes-left](review-evidence-01/inspection/eyes-left.png)；[eyes-left-assembly-mask-comparison](review-evidence-01/inspection/eyes-left-assembly-mask-comparison.png)。



### R30 — 画面左眼：虹膜偏宽、底部亮面偏大及上缘白线

- 相关图层：`42 | face/eyes/eye_right/sclera`；`43 | face/eyes/eye_right/iris`；`44 | face/eyes/eye_right/highlight`；`45 | face/eyes/eye_right/upper_eyelid`；`眼睛开口 right`。
- 位置：`[329, 355, 137, 113]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面左眼虹膜向左扩宽，底部亮面更圆更大；主白高光变小，虹膜上缘与睫毛下缘之间出现细白边。
- 参考依据：standard 原尺寸对照显示当前虹膜向画面左侧扩宽，下部青亮面更圆更大，主白高光较小；原图虹膜与睫毛上缘连接没有当前细白线。
- 影响：虹膜比例及亮面占比改变，两眼还原不准确，眼睫毛与眼内结构的接合有瑕疵。
- 修复方向及保留内容：在 43 校准本眼可见虹膜宽度、倾斜外缘和下部青色亮面分布，在 44 恢复主高光大小、柔边；检查 42/45 及「眼睛开口 right」接合，消掉多出的上缘白线并保持原眼白开口形状。保持本眼独立形体和完整虹膜，不用另一眼镜像覆盖，不在眼白画入睫毛投影；修后逐眼按原尺寸及同倍率检查。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R30-current.png)；[参考局部](review-evidence-01/annotations/standard/R30-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R30-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[eyes-native](review-evidence-01/inspection/eyes-native.jpg)；[eyes-right](review-evidence-01/inspection/eyes-right.png)；[eyes-right-assembly-mask-comparison](review-evidence-01/inspection/eyes-right-assembly-mask-comparison.png)。



### R31 — 上牙露出带：边缘齿状台阶、厚度不匀

- 相关图层：`51 | face/mouth/upper_teeth`；`上牙露出带`；`上下唇开口`。
- 位置：`[492, 462, 62, 19]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：上牙当前露出带上下边缘呈齿状台阶、粗细不匀，原图是连贯平滑的白色弧带。
- 参考依据：standard 露出的上牙是一条平顺白色弧带。当前蒙版停用后的完整牙面较顺，启用后露出边沿出现明显台阶，因此需要重点修正露出控制边。
- 影响：默认嘴形中的白牙条边缘发碎、局部忽粗忽细，和原图上唇衔接不一致。
- 修复方向及保留内容：重点修顺 51 的「上牙露出带」及共享「上下唇开口」相交处，按原图接成平滑、厚度自然变化的白弧；同时校准牙带与 53 上唇的接点。保留蒙版停用时的完整上牙纹理，不把牙面裁死成当前露出细条。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R31-current.png)；[参考局部](review-evidence-01/annotations/standard/R31-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R31-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[mouth](review-evidence-01/inspection/mouth.jpg)；[full-detail-10](review-evidence-01/inspection/full-detail-10.png)；[mouth-assembly-mask-comparison](review-evidence-01/inspection/mouth-assembly-mask-comparison.png)。



### R32 — 嘴唇与口内：右上重复红边、下唇缺线

- 相关图层：`52 | face/mouth/lower_lip`；`53 | face/mouth/upper_lip`；`48 | face/mouth/mouth_interior`；`50 | face/mouth/tongue`；`上下唇开口`。
- 位置：`[483, 463, 83, 64]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：口部右上缘有并行重复红边，下唇左下段描边弱化或中断；嘴边和内部接合粗细跳变、局部呈锯齿。
- 参考依据：standard 的嘴外线与口内边界清楚连续；当前右上有并行红边，下唇左下段自身描线弱化。下唇完整独显也显示强线主要留在右侧，不能靠口腔或舌面边缘替代。
- 影响：默认嘴形有重复边和线宽突变，完整下唇缺少原有连续 U 形轮廓，口部结构不干净。
- 修复方向及保留内容：在 52 补齐属于下唇自身的左侧至底部 U 形线，接顺已有右侧线；在 53/48/50 和开口接合处清掉搭接导致的额外并行红边，校准单一嘴边的曲率和粗细。嘴唇线留在唇层，口腔深红体积留在 48，舌面粉色及其自然边缘留在 50；保留肤色过渡和完整口内补形。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R32-current.png)；[参考局部](review-evidence-01/annotations/standard/R32-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R32-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[mouth](review-evidence-01/inspection/mouth.jpg)；[full-detail-09](review-evidence-01/inspection/full-detail-09.png)；[full-detail-10](review-evidence-01/inspection/full-detail-10.png)；[mouth-assembly-mask-comparison](review-evidence-01/inspection/mouth-assembly-mask-comparison.png)。



### R33 — 完整舌面：直切边、角点与碎 alpha

- 相关图层：`50 | face/mouth/tongue`。
- 位置：`[501, 469, 60, 54]`；当前证据状态：本件独显，蒙版停用。
- 当前表现：舌面独显的左右及下缘有多段直切边、角点和碎边，粉红舌面的外形与原图饱满圆弧不一致；需修顺本件色阶及透明边缘，唇线仍归上下唇。
- 参考依据：standard 可见舌面饱满，粉红边界以圆弧融入口内；当前 50 独显左右及下缘有多个直切段和角点。隐藏根部依据同一舌面合理延续，不要求复刻不可见部分。
- 影响：独显的舌头像带切角的粉色片，启用开口时局部碎边也影响嘴内衔接。
- 修复方向及保留内容：在 50 的本件绘画上收顺左右及下缘 alpha，把直切段、突角接成舌面的合理圆弧，并修顺粉红色阶与已有明暗；再核对开口蒙版启用的合成。保留饱满舌面及根部补形，唇轮廓仍归 52/53，不给舌面添加一圈本应属于嘴唇的深红描边。
- 框选与裁片：[编号框选](review-evidence-01/annotations/R33/marked.png)；[当前局部](review-evidence-01/annotations/R33/R33-current.png)；[参考局部](review-evidence-01/annotations/R33/R33-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/R33/R33-comparison.png)；[工具坐标记录](review-evidence-01/annotations/R33/regions.json)。
- 补充观察：[mouth](review-evidence-01/inspection/mouth.jpg)；[full-detail-09](review-evidence-01/inspection/full-detail-09.png)。



### R34 — 鼻部：小点变成偏左上的斜长红斑

- 相关图层：`47 | face/nose`。
- 位置：`[481, 439, 18, 17]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：鼻部由原图小圆点变成更大、偏左上方的斜长红斑。
- 参考依据：standard 的鼻部标记是小圆点；原尺寸同坐标及放大对照中，当前面积更大，向左上延伸为斜长斑。
- 影响：细小五官的位置、形状和浓淡偏离原图，面部细节没有准确还原。
- 修复方向及保留内容：在 47 层按原图局部校准鼻点的位置、大小、圆润形状及淡红强度，清理上左侧多出的斜长色迹，保留自然柔边。不要通过移动脸层或新增亮点补偿。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R34-current.png)；[参考局部](review-evidence-01/annotations/standard/R34-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R34-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[nose](review-evidence-01/inspection/nose.png)。



### R35 — 画面右腕环：前后接点新增内折线和外缘台阶

- 相关图层：`08 | arms/arm_left/bracelet_back`；`30 | arms/arm_left/bracelet_front`。
- 位置：`[780, 800, 39, 43]`；当前证据状态：默认全层合成，蒙版启用。
- 当前表现：画面右腕环前后段接合处新增折线状内部边界，并有外缘接点台阶；原图为连续的圆弧环面。
- 参考依据：standard 对应环面平顺，原图没有当前前后段接点处的角折内部线；其外缘也沿圆弧连续。
- 影响：腕环读成两块拼接的折面，前后分件接点在原尺寸下可辨认。
- 修复方向及保留内容：在 08/30 相接处对齐本件环缘的切线、宽度和颜色，消除只由搭接造成的角折内线及外缘台阶，接顺深蓝环面明暗。保留腕环自身合理口内暗面和青蓝饰块，保持后环在腕后、前环在腕前；不改层序来遮掉补全内容。
- 框选与裁片：[编号框选](review-evidence-01/annotations/standard/marked.png)；[当前局部](review-evidence-01/annotations/standard/R35-current.png)；[参考局部](review-evidence-01/annotations/standard/R35-reference.png)；[左参考 / 右当前对照](review-evidence-01/annotations/standard/R35-comparison.png)；[工具坐标记录](review-evidence-01/annotations/standard/regions.json)。
- 补充观察：[bracelet-top](review-evidence-01/inspection/bracelet-top.png)；[full-detail-01](review-evidence-01/inspection/full-detail-01.png)；[full-detail-05](review-evidence-01/inspection/full-detail-05.png)。



## 59 个部件逐层检查记录

下表每行均已实际目视检查四种状态。每个链接为本次实际 KRA 导出的原画布透明 PNG，可直接查看；“隐藏上层”包含本件和后方层，以观察被前方部件覆盖的根部与衔接。问题列同时包含该层参与的接缝问题；“未发现确定问题”只表示本层在上述范围内没有另一个确定需修的问题。

| 实际图层 / part | 独显蒙版开 / 关 | 隐藏上层蒙版开 / 关 | 发现 |
|---|---|---|---|
| 01 \| hair/back_hair | [已看·开](review-evidence-01/inspection/isolated-enabled/hair__back_hair.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/hair__back_hair.png) | [已看·开](review-evidence-01/inspection/hide-above/hair__back_hair.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/hair__back_hair.png) | R21、R22 |
| 02 \| legs/leg_left/shoes/cuff_back | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_left__shoes__cuff_back.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_left__shoes__cuff_back.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_left__shoes__cuff_back.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_left__shoes__cuff_back.png) | R20 |
| 03 \| legs/leg_right/shoes/cuff_back | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_right__shoes__cuff_back.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_right__shoes__cuff_back.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_right__shoes__cuff_back.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_right__shoes__cuff_back.png) | R19 |
| 04 \| legs/leg_left/leg | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_left__leg.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_left__leg.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_left__leg.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_left__leg.png) | R2 |
| 05 \| legs/leg_right/leg | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_right__leg.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_right__leg.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_right__leg.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_right__leg.png) | R1 |
| 06 \| legs/leg_left/shoes/shoe_front | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_left__shoes__shoe_front.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_left__shoes__shoe_front.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_left__shoes__shoe_front.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_left__shoes__shoe_front.png) | R20 |
| 07 \| legs/leg_right/shoes/shoe_front | [已看·开](review-evidence-01/inspection/isolated-enabled/legs__leg_right__shoes__shoe_front.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/legs__leg_right__shoes__shoe_front.png) | [已看·开](review-evidence-01/inspection/hide-above/legs__leg_right__shoes__shoe_front.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/legs__leg_right__shoes__shoe_front.png) | R19 |
| 08 \| arms/arm_left/bracelet_back | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__bracelet_back.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__bracelet_back.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__bracelet_back.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__bracelet_back.png) | R35 |
| 09 \| arms/arm_right/bracelet_back | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__bracelet_back.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__bracelet_back.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__bracelet_back.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__bracelet_back.png) | 未发现确定问题 |
| 10 \| arms/arm_left/hand/little_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__little_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__little_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__little_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__little_finger.png) | R9 |
| 11 \| arms/arm_right/hand/little_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__little_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__little_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__little_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__little_finger.png) | R10 |
| 12 \| arms/arm_left/hand/ring_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__ring_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__ring_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__ring_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__ring_finger.png) | R11 |
| 13 \| arms/arm_right/hand/ring_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__ring_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__ring_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__ring_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__ring_finger.png) | R12 |
| 14 \| arms/arm_left/hand/middle_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__middle_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__middle_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__middle_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__middle_finger.png) | R8 |
| 15 \| arms/arm_right/hand/middle_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__middle_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__middle_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__middle_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__middle_finger.png) | 未发现确定问题 |
| 16 \| arms/arm_left/hand/thumb | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__thumb.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__thumb.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__thumb.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__thumb.png) | R7 |
| 17 \| arms/arm_right/hand/thumb | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__thumb.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__thumb.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__thumb.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__thumb.png) | R6、R13 |
| 18 \| arms/arm_left/hand/index_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__index_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__index_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__index_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__index_finger.png) | R7、R8 |
| 19 \| arms/arm_right/hand/index_finger | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__index_finger.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__index_finger.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__index_finger.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__index_finger.png) | R6 |
| 20 \| arms/arm_left/hand/palm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__hand__palm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__hand__palm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__hand__palm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__hand__palm.png) | R7 |
| 21 \| arms/arm_right/hand/palm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__hand__palm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__hand__palm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__hand__palm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__hand__palm.png) | R6 |
| 22 \| arms/arm_left/forearm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__forearm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__forearm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__forearm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__forearm.png) | R3、R5 |
| 23 \| arms/arm_right/forearm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__forearm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__forearm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__forearm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__forearm.png) | R4 |
| 24 \| arms/arm_left/upper_arm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__upper_arm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__upper_arm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__upper_arm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__upper_arm.png) | R3、R5 |
| 25 \| arms/arm_right/upper_arm | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__upper_arm.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__upper_arm.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__upper_arm.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__upper_arm.png) | R4 |
| 26 \| neck | [已看·开](review-evidence-01/inspection/isolated-enabled/neck.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/neck.png) | [已看·开](review-evidence-01/inspection/hide-above/neck.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/neck.png) | R18 |
| 27 \| body/torso | [已看·开](review-evidence-01/inspection/isolated-enabled/body__torso.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/body__torso.png) | [已看·开](review-evidence-01/inspection/hide-above/body__torso.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/body__torso.png) | R14、R15、R16、R17、R18 |
| 28 \| body/breast | [已看·开](review-evidence-01/inspection/isolated-enabled/body__breast.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/body__breast.png) | [已看·开](review-evidence-01/inspection/hide-above/body__breast.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/body__breast.png) | R14、R15、R16、R17 |
| 29 \| pelvis | [已看·开](review-evidence-01/inspection/isolated-enabled/pelvis.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/pelvis.png) | [已看·开](review-evidence-01/inspection/hide-above/pelvis.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/pelvis.png) | R14、R15、R16、R17 |
| 30 \| arms/arm_left/bracelet_front | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_left__bracelet_front.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_left__bracelet_front.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_left__bracelet_front.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_left__bracelet_front.png) | R35 |
| 31 \| arms/arm_right/bracelet_front | [已看·开](review-evidence-01/inspection/isolated-enabled/arms__arm_right__bracelet_front.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/arms__arm_right__bracelet_front.png) | [已看·开](review-evidence-01/inspection/hide-above/arms__arm_right__bracelet_front.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/arms__arm_right__bracelet_front.png) | 未发现确定问题 |
| 32 \| face/ears/ear_left | [已看·开](review-evidence-01/inspection/isolated-enabled/face__ears__ear_left.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__ears__ear_left.png) | [已看·开](review-evidence-01/inspection/hide-above/face__ears__ear_left.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__ears__ear_left.png) | R27 |
| 33 \| face/ears/ear_right | [已看·开](review-evidence-01/inspection/isolated-enabled/face__ears__ear_right.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__ears__ear_right.png) | [已看·开](review-evidence-01/inspection/hide-above/face__ears__ear_right.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__ears__ear_right.png) | 未发现确定问题 |
| 34 \| face/face_base | [已看·开](review-evidence-01/inspection/isolated-enabled/face__face_base.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__face_base.png) | [已看·开](review-evidence-01/inspection/hide-above/face__face_base.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__face_base.png) | R26 |
| 35 \| face/blush_left | [已看·开](review-evidence-01/inspection/isolated-enabled/face__blush_left.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__blush_left.png) | [已看·开](review-evidence-01/inspection/hide-above/face__blush_left.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__blush_left.png) | 未发现确定问题 |
| 36 \| face/blush_right | [已看·开](review-evidence-01/inspection/isolated-enabled/face__blush_right.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__blush_right.png) | [已看·开](review-evidence-01/inspection/hide-above/face__blush_right.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__blush_right.png) | R28 |
| 37 \| face/eyes/eye_left/sclera | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_left__sclera.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_left__sclera.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_left__sclera.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_left__sclera.png) | R29 |
| 38 \| face/eyes/eye_left/iris | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_left__iris.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_left__iris.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_left__iris.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_left__iris.png) | R29 |
| 39 \| face/eyes/eye_left/highlight | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_left__highlight.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_left__highlight.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_left__highlight.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_left__highlight.png) | R29 |
| 40 \| face/eyes/eye_left/upper_eyelid | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_left__upper_eyelid.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_left__upper_eyelid.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_left__upper_eyelid.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_left__upper_eyelid.png) | R29 |
| 41 \| face/eyes/eye_left/eyelid_crease | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_left__eyelid_crease.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_left__eyelid_crease.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_left__eyelid_crease.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_left__eyelid_crease.png) | 未发现确定问题 |
| 42 \| face/eyes/eye_right/sclera | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_right__sclera.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_right__sclera.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_right__sclera.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_right__sclera.png) | R30 |
| 43 \| face/eyes/eye_right/iris | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_right__iris.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_right__iris.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_right__iris.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_right__iris.png) | R30 |
| 44 \| face/eyes/eye_right/highlight | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_right__highlight.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_right__highlight.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_right__highlight.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_right__highlight.png) | R30 |
| 45 \| face/eyes/eye_right/upper_eyelid | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_right__upper_eyelid.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_right__upper_eyelid.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_right__upper_eyelid.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_right__upper_eyelid.png) | R30 |
| 46 \| face/eyes/eye_right/eyelid_crease | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyes__eye_right__eyelid_crease.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyes__eye_right__eyelid_crease.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyes__eye_right__eyelid_crease.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyes__eye_right__eyelid_crease.png) | 未发现确定问题 |
| 47 \| face/nose | [已看·开](review-evidence-01/inspection/isolated-enabled/face__nose.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__nose.png) | [已看·开](review-evidence-01/inspection/hide-above/face__nose.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__nose.png) | R34 |
| 48 \| face/mouth/mouth_interior | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__mouth_interior.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__mouth_interior.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__mouth_interior.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__mouth_interior.png) | R32 |
| 49 \| face/mouth/lower_teeth | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__lower_teeth.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__lower_teeth.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__lower_teeth.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__lower_teeth.png) | 未发现确定问题 |
| 50 \| face/mouth/tongue | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__tongue.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__tongue.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__tongue.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__tongue.png) | R32、R33 |
| 51 \| face/mouth/upper_teeth | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__upper_teeth.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__upper_teeth.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__upper_teeth.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__upper_teeth.png) | R31 |
| 52 \| face/mouth/lower_lip | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__lower_lip.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__lower_lip.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__lower_lip.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__lower_lip.png) | R32 |
| 53 \| face/mouth/upper_lip | [已看·开](review-evidence-01/inspection/isolated-enabled/face__mouth__upper_lip.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__mouth__upper_lip.png) | [已看·开](review-evidence-01/inspection/hide-above/face__mouth__upper_lip.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__mouth__upper_lip.png) | R32 |
| 54 \| face/eyebrows/eyebrow_left | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyebrows__eyebrow_left.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyebrows__eyebrow_left.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyebrows__eyebrow_left.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyebrows__eyebrow_left.png) | 未发现确定问题 |
| 55 \| face/eyebrows/eyebrow_right | [已看·开](review-evidence-01/inspection/isolated-enabled/face__eyebrows__eyebrow_right.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/face__eyebrows__eyebrow_right.png) | [已看·开](review-evidence-01/inspection/hide-above/face__eyebrows__eyebrow_right.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/face__eyebrows__eyebrow_right.png) | 未发现确定问题 |
| 56 \| hair/bangs | [已看·开](review-evidence-01/inspection/isolated-enabled/hair__bangs.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/hair__bangs.png) | [已看·开](review-evidence-01/inspection/hide-above/hair__bangs.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/hair__bangs.png) | R23 |
| 57 \| hair/side_hair/side_hair_left | [已看·开](review-evidence-01/inspection/isolated-enabled/hair__side_hair__side_hair_left.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/hair__side_hair__side_hair_left.png) | [已看·开](review-evidence-01/inspection/hide-above/hair__side_hair__side_hair_left.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/hair__side_hair__side_hair_left.png) | R22、R24 |
| 58 \| hair/side_hair/side_hair_right | [已看·开](review-evidence-01/inspection/isolated-enabled/hair__side_hair__side_hair_right.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/hair__side_hair__side_hair_right.png) | [已看·开](review-evidence-01/inspection/hide-above/hair__side_hair__side_hair_right.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/hair__side_hair__side_hair_right.png) | R25 |
| 59 \| head_accessories | [已看·开](review-evidence-01/inspection/isolated-enabled/head_accessories.png) / [已看·关](review-evidence-01/inspection/isolated-disabled/head_accessories.png) | [已看·开](review-evidence-01/inspection/hide-above/head_accessories.png) / [已看·关](review-evidence-01/inspection/hide-above-disabled/head_accessories.png) | 未发现确定问题 |

逐层观察页中，四栏分别为参考、独显蒙版开、独显蒙版关、隐藏上层；放大完整页用于看本件自身完整绘画，隐藏上层蒙版页左右为开/关。三类页全部看完：

| 实际图层范围 | 四栏观察页 | 完整本件放大页 | 隐藏上层蒙版开 / 关 |
|---|---|---|---|
| 01–05 | [已看](review-evidence-01/inspection/sheet-00.jpg) | [已看](review-evidence-01/inspection/full-detail-00.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-00.jpg) |
| 06–10 | [已看](review-evidence-01/inspection/sheet-01.jpg) | [已看](review-evidence-01/inspection/full-detail-01.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-01.jpg) |
| 11–15 | [已看](review-evidence-01/inspection/sheet-02.jpg) | [已看](review-evidence-01/inspection/full-detail-02.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-02.jpg) |
| 16–20 | [已看](review-evidence-01/inspection/sheet-03.jpg) | [已看](review-evidence-01/inspection/full-detail-03.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-03.jpg) |
| 21–25 | [已看](review-evidence-01/inspection/sheet-04.jpg) | [已看](review-evidence-01/inspection/full-detail-04.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-04.jpg) |
| 26–30 | [已看](review-evidence-01/inspection/sheet-05.jpg) | [已看](review-evidence-01/inspection/full-detail-05.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-05.jpg) |
| 31–35 | [已看](review-evidence-01/inspection/sheet-06.jpg) | [已看](review-evidence-01/inspection/full-detail-06.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-06.jpg) |
| 36–40 | [已看](review-evidence-01/inspection/sheet-07.jpg) | [已看](review-evidence-01/inspection/full-detail-07.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-07.jpg) |
| 41–45 | [已看](review-evidence-01/inspection/sheet-08.jpg) | [已看](review-evidence-01/inspection/full-detail-08.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-08.jpg) |
| 46–50 | [已看](review-evidence-01/inspection/sheet-09.jpg) | [已看](review-evidence-01/inspection/full-detail-09.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-09.jpg) |
| 51–55 | [已看](review-evidence-01/inspection/sheet-10.jpg) | [已看](review-evidence-01/inspection/full-detail-10.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-10.jpg) |
| 56–59 | [已看](review-evidence-01/inspection/sheet-11.jpg) | [已看](review-evidence-01/inspection/full-detail-11.png) | [已看](review-evidence-01/inspection/hide-mask-sheet-11.jpg) |

## 蒙版与逻辑组检查

10 个原生透明度蒙版均在启用和停用状态下看过。默认全隐藏的三根后方手指与下牙，停用后都能看到实际完整绘画；默认 PNG 透明本身不是缺件。手指的具体完整绘画瑕疵见 R9–R11，下牙本件未发现确定问题。

| 蒙版 | 所属层或组 | 检查结果 / 关联问题 |
|---|---|---|
| 后方手指默认遮挡 | 10 \| arms/arm_left/hand/little_finger | 开：本指全隐藏；关：完整绘画可见。需修本件外轮廓（R9），保留默认遮挡控制。 |
| 后方手指默认遮挡 | 11 \| arms/arm_right/hand/little_finger | 开：本指全隐藏；关：完整绘画可见。需修本件外轮廓（R10），保留默认遮挡控制。 |
| 后方手指默认遮挡 | 12 \| arms/arm_left/hand/ring_finger | 开：本指全隐藏；关：完整绘画可见。需修本件外轮廓（R11），保留默认遮挡控制。 |
| 高光虹膜范围 left | 眼内开合 left → 39 \| face/eyes/eye_left/highlight | 开/关均看过；完整眼内及高光内容保留。随本眼几何与细节修复复核（R29），不把蒙版存在本身判为缺件。 |
| 眼睛开口 left | 眼内开合 left | 开/关均看过；完整眼内及高光内容保留。随本眼几何与细节修复复核（R29），不把蒙版存在本身判为缺件。 |
| 高光虹膜范围 right | 眼内开合 right → 44 \| face/eyes/eye_right/highlight | 开/关均看过；完整眼内及高光内容保留。随本眼几何与细节修复复核（R30），不把蒙版存在本身判为缺件。 |
| 眼睛开口 right | 眼内开合 right | 开/关均看过；完整眼内及高光内容保留。随本眼几何与细节修复复核（R30），不把蒙版存在本身判为缺件。 |
| 下牙默认遮挡 | 口内开合 → 49 \| face/mouth/lower_teeth | 开：下牙全隐藏；关：完整牙面可见。未发现确定问题。 |
| 上牙露出带 | 口内开合 → 51 \| face/mouth/upper_teeth | 开：露出带边缘台阶；关：完整牙面可见。重点修蒙版接边（R31）。 |
| 上下唇开口 | 口内开合 | 开：默认嘴形；关：完整口内可见。接合需与上牙、唇线及舌面同步复核（R31–R33）。 |

同组组合也已分别看过：

- [画面右眼组装蒙版开 / 关](review-evidence-01/inspection/eyes-left-assembly-mask-comparison.png)，并结合本眼 [同倍率参考对照](review-evidence-01/inspection/eyes-left.png)。
- [画面左眼组装蒙版开 / 关](review-evidence-01/inspection/eyes-right-assembly-mask-comparison.png)，并结合本眼 [同倍率参考对照](review-evidence-01/inspection/eyes-right.png)。
- [嘴部组装蒙版开 / 关](review-evidence-01/inspection/mouth-assembly-mask-comparison.png)，并结合 [嘴部参考对照](review-evidence-01/inspection/mouth.jpg)。
- 当前没有深度分片，故没有待合并检查的同 part 多片。腕环前后和鞋前体/后口已作为既有不同 part 分别独显，并在组合、隐藏上层和整图中检查连续关系，修复反馈为 R19、R20、R35。

## 返修后复查要求

先处理默认合成已可见的接缝与结构缺线（R3–R8、R14–R20、R35）及眼口细节（R29–R34），再完成腿、发、耳的轮廓与遗漏细节（R1、R2、R21–R28）和完整隐藏手指（R9–R13）。这些是处理次序，35 项均需修复。

每项局部修后应同时导出本层独显、隐藏上层补全区和默认合成，蒙版开/关均复核；需要接合的两层要分开看完整绘画，再合起来按原尺寸看接点。眼睛必须逐只与 standard 原尺寸并排，随后同倍率放大看睫毛/眼白/虹膜、高光和色阶；上牙同时看完整牙面与露出带。补全区应延续本件自己的形体、线条和明暗，不将其他部件的线条或投影取样进去。

本次只审查并形成返修反馈，尚未执行修画。正式 review / repair 报告由调度器发布，本次只写指定的 review-01.md.tmp。
