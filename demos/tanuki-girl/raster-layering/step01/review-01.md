结论：需要修复

# 第一步独立 review 01

已完成全部78个逻辑部件、80个实际绘画层及33个原生透明度蒙版的看图检查，确认22项需要修复的问题。主要影响是接合处断线与色差、局部补全轮廓瑕疵、头发遮挡关系，以及双眼和红晕等细节与原图不一致。

## 输入、参考与检查范围

- 实际打开并检查的工程：`raster-layering/step01/character-depth.kra`，画布1376 × 2048。
- 依据本步`report.md`确认，可见内容参考为`part-layering/references/standard.png`。
- 身体补全辅助参考为`part-layering/references/base-subject.png`。R1–R7、R12以此检查身体及临时连体服接合；其他可见细节以standard.png为依据。临时连体服与上游身体目标相符，不将原和服缺失列为人物工程问题。
- 分层依据：`part-layering/parts`、`part-layering/groups.json`、`part-layering/occlusion.json`。本次开始时没有已有正式review / repair报告；制作报告及暂存记录仅用于了解制作情况。
- 在Krita中逐层切换独显、隐藏上层和本层蒙版启停并新导出PNG，实际看过全部10页逐层图集；大部件另看原尺寸完整独显。整图与两份参考同坐标并排，并放大查看衔接和每只眼睛。
- 右辫D013/D057、骨盆D022.5/D033均分别检查各分片，再合并检查默认、完整独显及隐藏上层。两组是同一逻辑part的合法多深度分片，未按重复层判错。双眼、双手及口内也另做组合检查。全部蒙版停用的整图另看过一次。
- 工程及分层输入保持只读，只在Krita内存中切显隐、导出，本次未保存工程。结束时80层默认显隐和33个蒙版启用状态已恢复；工程、groups、occlusion及全部SVG共106个输入文件与检查前哈希一致。

逐层图层名、蒙版名、四种状态和对应问题见[完整看图索引](raster-layering/step01/review-01-evidence/audit-index.md)；机器可读的[索引](raster-layering/step01/review-01-evidence/audit-index.json)及[只读核对记录](raster-layering/step01/review-01-evidence/readonly-verification.json)一并保留。哈希仅用于只读完整性核对，质量结论来自实际看图。

## 框选与证据说明

坐标统一为原画布`[x, y, width, height]`，左右按角色部件命名（角色右侧位于画面左）。框选工具生成整图编号、当前局部、同坐标参考局部及左参考／右当前对照；padding为16像素，只增加观察上下文，没有移动或缩放参考来配准。以下局部对照都是本次KRA新导出的状态。

- [默认组装：可见参考问题全图框选](review-01-evidence/marked-standard/marked.png)，[框坐标与说明](raster-layering/step01/review-01-evidence/marked-standard/regions.json)。
- [默认组装：身体问题全图框选](review-01-evidence/marked-body/marked.png)，[框坐标与说明](raster-layering/step01/review-01-evidence/marked-body/regions.json)。
- [完整独显：单件瑕疵全图框选](review-01-evidence/marked-isolated/marked.png)，[框坐标与说明](raster-layering/step01/review-01-evidence/marked-isolated/regions.json)。R11使用完整独显作为主证据；R12、R17、R22另有独显佐证。

头顶两张局部彩色查看曾被内容策略拦截，已改为同坐标灰度局部并成功读取，R13检查已完成；不重复使用被拦截的读取方式。透明PNG预览曾出现的彩色散点，在正确alpha合成的白底和黑底图中不存在，未列为瑕疵。也没有仅凭接片外观断言其由程序整块RGB填色制作。

## 需要修复的问题

### R1 — 右肘的肤色和轮廓拼接

- 相关图层：`D026.00 | arms/arm_right/upper_arm`；`D032.00 | arms/arm_right/forearm`。
- 位置：`[477, 785, 78, 61]`。
- 当前表现：上臂与前臂交接处出现斜直切边；浅肤色突然变亮，内侧桃色暗带到接点突然变宽，外轮廓有小折点。默认组装原尺寸仍能看到接片。
- 参考依据：base-subject.png同坐标的肘部肤色、暗部和外轮廓连续，没有这条斜切边。
- 影响：破坏同一条手臂的连续体积，未达到原尺寸看不出拼接的要求。
- 修复方向及保留内容：在两层各自完整肘端内，用本件生成画面或本件取样重画接色；将暗带宽度和渐变接顺，按参考接点的切线续画外缘。保留上臂、前臂各自完整补全，最后在默认组装及隐藏上层两种状态核对。



补充证据：[右肘放大对照](review-01-evidence/elbow-right-3x.png)；[D026.00完整独显](review-01-evidence/layers/18/solo-complete.png)；[D032.00完整独显](review-01-evidence/layers/24/solo-complete.png)。

### R2 — 左肘的斜切亮面和轮廓折点

- 相关图层：`D025.00 | arms/arm_left/upper_arm`；`D031.00 | arms/arm_left/forearm`。
- 位置：`[864, 784, 90, 64]`。
- 当前表现：前臂上端形成明亮斜切面，接缝另一侧有突出的深桃色条带；臂外缘在交界处折转，肤色过渡不自然。
- 参考依据：base-subject.png此处为连贯的臂面和顺滑外轮廓，暗部没有在同一截面突然跳变。
- 影响：显露两块臂面拼接，手臂体积与参考不符。
- 修复方向及保留内容：分别修画D025、D031的肘端本件肤色和自身暗部，消除斜直硬边并接顺外缘方向、线宽及颜色；保持合理搭接。用完整独显确认两件本身也平滑，再检查默认覆盖，不能仅靠遮挡掩盖接色瑕疵。



补充证据：[左肘放大对照](review-01-evidence/elbow-left-3x.png)；[D025.00完整独显](review-01-evidence/layers/17/solo-complete.png)；[D031.00完整独显](review-01-evidence/layers/23/solo-complete.png)。

### R3 — 画面左肩带与领口的断续接线

- 相关图层：`D034.00 | body/torso`；`D035.00 | body/breast`；`Native contact | torso shoulder straps`。
- 位置：`[605, 619, 47, 83]`。
- 当前表现：肩带向胸部领口延伸处有横短线、角折和宽度突变；内外描线在接点不顺，局部浅色边像补片。
- 参考依据：base-subject.png的同侧肩带从耳罩下方顺滑延续到领口，衣料与双线没有横截接头。
- 影响：临时连体服的肩带看起来分段拼成，线条连续性不合格。
- 修复方向及保留内容：沿参考肩带走向，在torso、breast各自完整肩带中续画衣料明暗和内外线；去掉横短边并统一接点线宽、切线和颜色。配合breast接合蒙版只控制搭接显露，启停蒙版时肩带自身均应完整，保留前方辫子及耳罩的遮挡关系。



补充证据：[双肩带放大对照](review-01-evidence/shoulders-3x.png)；[D034.00完整独显](review-01-evidence/layers/26/solo-complete.png)；[D035.00完整独显](review-01-evidence/layers/27/solo-complete.png)。

### R4 — 画面右肩带的凸折和描线错开

- 相关图层：`D034.00 | body/torso`；`D035.00 | body/breast`；`Native contact | torso shoulder straps`。
- 位置：`[770, 619, 48, 83]`。
- 当前表现：肩带与胸部接处出现侧向凸折、浅色片边，内外轮廓在交界处错开，线宽也有变化。
- 参考依据：base-subject.png同处为细而顺滑的连续肩带和领口，边线相接。
- 影响：衣料轮廓与参考不符，接合处可见台阶。
- 修复方向及保留内容：在D034、D035对应的完整接头中按本侧参考重画肩带宽度、内外描线和衣料过渡；接顺切线并去掉凸折。核对breast接合蒙版是否露出或截断错误的接片边，完成后同时看启用与停用状态。



补充证据：[双肩带放大对照](review-01-evidence/shoulders-3x.png)；[D034.00完整独显](review-01-evidence/layers/26/solo-complete.png)；[D035.00完整独显](review-01-evidence/layers/27/solo-complete.png)。

### R5 — 上胸肤色的水平边与三角接片

- 相关图层：`D022.00 | neck`；`D034.00 | body/torso`；`D035.00 | body/breast`；`Native contact | torso shoulder straps`。
- 位置：`[640, 622, 136, 58]`。
- 当前表现：上胸有一条浅色水平边，中央可辨向下凹的三角接片边界；接片内部和周围的肤色、明暗方向不连续。
- 参考依据：base-subject.png同坐标上胸面自然连续，没有当前水平截边和三角补片轮廓。
- 影响：颈下与胸部的体积像分块粘接，原尺寸可辨色块边。
- 修复方向及保留内容：结合独显定位neck下端、torso上胸与breast肤色的实际覆盖边，在各层自身区域重画连续过渡，消除水平和三角硬边；保留锁骨及胸部自身形体明暗。锁骨仍归torso，继续保持已去除的下颌、耳罩外来投影，不能用这些投影遮住接色问题。



补充证据：[上胸及肩带对照](review-01-evidence/shoulders-3x.png)；[D022.00完整独显](review-01-evidence/layers/13/solo-complete.png)；[D034.00完整独显](review-01-evidence/layers/26/solo-complete.png)；[D035.00完整独显](review-01-evidence/layers/27/solo-complete.png)。

### R6 — 画面左腰腹结构线断成多段

- 相关图层：`D034.00 | body/torso`；`D033.00 | pelvis | front lower garment`；`Torso-pelvis overlap | upper cap retained | default assembled`。
- 位置：`[625, 876, 43, 86]`。
- 当前表现：torso与骨盆前片接合范围的腰腹线被切成多段，中间有空隙，接线粗细、方向和颜色突变。
- 参考依据：base-subject.png对应结构线是一条连贯弧线，跨过当前接合范围时没有断口。
- 影响：破坏服装立体结构和躯干到骨盆的连续性。
- 修复方向及保留内容：按同侧参考弧线，在D034及D033各自完整接合帽盖上续画结构线，统一线宽、颜色和切线；调整torso-pelvis蒙版使默认显露构成一条连续线。保留两骨盆分片职责及完整帽盖，不以删除补全线解决重叠。



补充证据：[腰腹线放大对照](review-01-evidence/waist-3x.png)；[D033.00完整独显](review-01-evidence/layers/25/solo-complete.png)；[D034.00完整独显](review-01-evidence/layers/26/solo-complete.png)。

### R7 — 画面右腰腹结构线空隙和错位

- 相关图层：`D034.00 | body/torso`；`D033.00 | pelvis | front lower garment`；`Torso-pelvis overlap | upper cap retained | default assembled`。
- 位置：`[753, 876, 39, 86]`。
- 当前表现：右侧腰腹线在接合区有两处明显空隙，断段位置错开；相邻线段粗细和走向不一致。
- 参考依据：base-subject.png同线连续，曲率和线宽沿腰腹自然延伸。
- 影响：原尺寸能辨认拼接，结构线没有画完整。
- 修复方向及保留内容：在D034与D033各自接合区补齐线条，按本侧参考接顺位置、切线、线宽和颜色；检查接合蒙版是否将续线中段遮断。完成后同时核对默认、停用蒙版及隐藏上层状态。



补充证据：[腰腹线放大对照](review-01-evidence/waist-3x.png)；[D033.00完整独显](review-01-evidence/layers/25/solo-complete.png)；[D034.00完整独显](review-01-evidence/layers/26/solo-complete.png)。

### R8 — 右掌指根的台阶、接色边和层次丢失

- 相关图层：`D045.00 | arms/arm_right/hand/index_finger`；`D047.00 | arms/arm_right/hand/palm`；`D039.00 | arms/arm_right/hand/ring_finger`；`D041.00 | arms/arm_right/hand/middle_finger`。
- 位置：`[326, 998, 89, 80]`。
- 当前表现：掌到食指根外缘出现台阶，掌面有斜向浅色接片边；虎口、指根及叠指下缘的自身轮廓和明暗比参考弱，局部断续。
- 参考依据：standard.png同侧掌指外缘和虎口曲线连续，叠指下缘有清楚的本件描线与体积层次。腕饰投在手上的影属于外来投影，不作为应恢复内容。
- 影响：默认手形可见拼接，手指和掌面的立体层次不足。
- 修复方向及保留内容：按右手参考分别恢复掌、食指、中指和无名指自身的可见笔触与明暗；在各自搭接区融接肤色并接顺外缘，消除台阶和斜向硬边。保持各指完整根部，核对index/palm及middle接合蒙版，继续清除腕饰投影。



补充证据：[右手放大对照](review-01-evidence/hand-right-3x.png)；[双手组合及完整状态](review-01-evidence/combinations-page-3.png)；[D039.00完整独显](review-01-evidence/layers/31/solo-complete.png)；[D041.00完整独显](review-01-evidence/layers/33/solo-complete.png)；[D045.00完整独显](review-01-evidence/layers/37/solo-complete.png)；[D047.00完整独显](review-01-evidence/layers/39/solo-complete.png)。

### R9 — 左掌指根接色与叠指描线弱化

- 相关图层：`D046.00 | arms/arm_left/hand/palm`；`D044.00 | arms/arm_left/hand/index_finger`；`D040.00 | arms/arm_left/hand/middle_finger`；`D038.00 | arms/arm_left/hand/ring_finger`。
- 位置：`[1045, 1020, 62, 67]`。
- 当前表现：掌与食指接根有斜向接色硬边；叠指根、无名指下侧的深色描线及自身暗部明显弱化，当前组合仍能看出接片。
- 参考依据：standard.png左手同处掌面颜色连贯，叠指下侧轮廓和各指的明暗层次可辨。
- 影响：手部形体层次与参考不同，衔接不干净。
- 修复方向及保留内容：依据左手本侧参考，在D046、D044、D040、D038分别重画本件接色及指腹、下缘描线；接顺掌指曲线和暗部，避免把其他指的像素画进本件。保留合理隐藏根部及清除腕饰投影后的肤色，默认与完整组合均须连续。



补充证据：[左手放大对照](review-01-evidence/hand-left-3x.png)；[双手组合及完整状态](review-01-evidence/combinations-page-3.png)；[D038.00完整独显](review-01-evidence/layers/30/solo-complete.png)；[D040.00完整独显](review-01-evidence/layers/32/solo-complete.png)；[D044.00完整独显](review-01-evidence/layers/36/solo-complete.png)；[D046.00完整独显](review-01-evidence/layers/38/solo-complete.png)。

### R10 — 左拇指接掌外轮廓淡失

- 相关图层：`D042.00 | arms/arm_left/hand/thumb`；`D046.00 | arms/arm_left/hand/palm`；`Native contact | thumb root cap`；`Native contact | palm finger roots`。
- 位置：`[1008, 1061, 42, 58]`。
- 当前表现：拇指与掌接点附近外轮廓出现浅白断段，棕线局部被淡化，肤色有小色阶。
- 参考依据：standard.png同段从掌侧到拇指的棕色外轮廓连续，没有浅白断段。
- 影响：拇指接点看起来断开，轮廓不完整。
- 修复方向及保留内容：在thumb和palm各自完整接点内续画外轮廓并融接本件肤色，统一线宽和颜色；检查两个接合蒙版是否削弱轮廓像素，调整显露使默认外缘连续。保留拇指指尖、指甲和完整根部。



补充证据：[左手接点放大对照](review-01-evidence/hand-left-3x.png)；[D042.00完整独显](review-01-evidence/layers/34/solo-complete.png)；[D046.00完整独显](review-01-evidence/layers/38/solo-complete.png)。

### R11 — 右食指完整独显根部下缘不顺

- 相关图层：`D045.00 | arms/arm_right/hand/index_finger`。
- 位置：`[299, 1028, 72, 40]`。
- 当前表现：停用蒙版独显时，食指根部下缘呈长直段和台阶，局部暗线突然增粗；这是食指层自身的轮廓瑕疵。
- 参考依据：standard.png提供本件可见下缘及指腹走向，其曲线连续；遮住的根部不能直接从原图读取，但应顺着本件可见形体合理延长，而不是保留当前折阶。
- 影响：完整食指不是干净、平滑的同一部件；默认接点的遮挡不能替代单件修复。
- 修复方向及保留内容：在D045中用本件生成结果、取样或画笔重画根部下缘与指腹渐变，消除长直突段、台阶和突然变粗暗线；保持原有指尖和可见指腹层次，不把掌面轮廓画入食指。先看停用蒙版独显，再接回掌部复核R8。



补充证据：[完整食指根部4倍图](review-01-evidence/index-right-isolated-4x.png)；[D045.00完整独显](review-01-evidence/layers/37/solo-complete.png)。

### R12 — 左腿大腿补色区仍有矩形边和轮廓台阶

- 相关图层：`D023.00 | legs/leg_left/leg`。
- 位置：`[711, 1052, 161, 82]`。
- 当前表现：大腿补色区可辨矩形淡色边界，内侧桃色暗部形成横阶；两侧外轮廓在相近高度有台阶。完整独显确认这些边界属于腿层自身。
- 参考依据：base-subject.png同处腿面和轮廓连续。standard.png此区域包含衣裙及其投影，只用于定位和核对已有腿面，不能把裙或裙投影恢复到腿层。
- 影响：大腿看起来有色块拼贴，补全区形体和融色不自然。
- 修复方向及保留内容：在D023内以本腿画面取样、画笔或本件重新生成结果重画这一整段过渡，消除矩形边和内侧横阶，接顺两侧轮廓及自身明暗。保留已补齐腿根、整体位置比例、膝足和袜口；完成后检查整腿独显、隐藏上层和默认组合。



补充证据：[大腿完整独显4倍图](review-01-evidence/thigh-left-isolated-4x.png)；[工具标记的独显当前局部](review-01-evidence/marked-isolated/R12-current.png)；[D023.00完整独显](review-01-evidence/layers/15/solo-complete.png)。

### R13 — 狸饰下颌前露出补全发根

- 相关图层：`D012.00 | head_accessories/tanuki_ornament/tanuki_body`；`D014.00 | hair/back_hair`；`D084.00 | hair/bangs`。
- 位置：`[646, 183, 126, 58]`。
- 当前表现：补全发根在狸饰下颌前露成拱形发冠，发根线和发面盖到了原应连续可见的狸饰下颌范围。
- 参考依据：standard.png此处狸饰下颌线连续，发根位于其后；同坐标灰度对照仍清楚显示该覆盖差异。
- 影响：头顶前后层级与参考不符，改变狸饰和头发的相接结构。
- 修复方向及保留内容：保留D014、D084的完整补全发根，局部协调其与D012下颌的前后覆盖；必要时按真实穿插调整局部遮挡或合理深度分片，使狸饰下颌恢复原图可见边界。不能直接削掉完整发根来制造默认外观，修后重看相关单件、组合和隐藏上层。



补充证据：[已成功读取的头顶同坐标灰度局部](review-01-evidence/head-center-detail-gray.png)；[D012.00完整独显](review-01-evidence/layers/03/solo-complete.png)；[D014.00完整独显](review-01-evidence/layers/05/solo-complete.png)；[D084.00完整独显](review-01-evidence/layers/73/solo-complete.png)。

### R14 — 右辫接根在组合中露出水平截边

- 相关图层：`D013.00 | hair/braid_right | root`；`D057.00 | hair/braid_right | front`；`D014.00 | hair/back_hair`；`D083.00 | hair/side_hair/side_hair_right`。
- 位置：`[555, 486, 86, 57]`。
- 当前表现：D013/D057合并独显可连续，但加入短后发等下层及默认组装后，约y502处露出前辫水平顶边，发面突然变浅，发流被横切。
- 参考依据：standard.png该处发流斜向连续，不存在当前水平切口和整片突然变浅的面。
- 影响：合法深度分片的边界仍在组装中显露，破坏同一辫体的连续性。
- 修复方向及保留内容：保留后根D013、前辫D057两个深度职责和隐藏搭接；结合D014、D083的覆盖协调分界显露，并重画必要的本件局部发流、线条和明暗，使截边藏入合理遮挡且露出发面自然连接。分别独显两片、合并独显、隐藏上层和默认组装都要复检。



补充证据：[辫根放大对照](review-01-evidence/braid-root-3x.png)；[右辫与骨盆分片组合检查](review-01-evidence/combinations-page-1.png)；[D013.00完整独显](review-01-evidence/layers/04/solo-complete.png)；[D014.00完整独显](review-01-evidence/layers/05/solo-complete.png)；[D057.00完整独显](review-01-evidence/layers/46/solo-complete.png)；[D083.00完整独显](review-01-evidence/layers/72/solo-complete.png)。

### R15 — 右眼的眼睑、虹膜与高光不符

- 相关图层：`D066.00 | face/eyes/eye_right/sclera`；`D068.00 | face/eyes/eye_right/iris`；`D070.00 | face/eyes/eye_right/highlight`；`D072.00 | face/eyes/eye_right/upper_eyelid`；`D074.00 | face/eyes/eye_right/eyelid_crease`。
- 位置：`[604, 395, 91, 78]`。
- 当前表现：同尺寸并排看，右眼上睑厚度、内缘弧线和外眼角收尖与参考不同；上方亮点的位置、形状改变，并有额外小亮斑，虹膜内部暗部层次也有变化。
- 参考依据：standard.png右眼（画面左）可直接核对上睑睫毛轮廓、眼白开口、虹膜暗边及亮点。原尺寸并排和3倍对照均显示这些差异。
- 影响：未达到逐眼同尺寸形状、睫毛、虹膜层次及高光一致的要求。
- 修复方向及保留内容：按本侧原图逐件恢复D072上睑/睫毛与D074独立眼褶，再修D066眼白、D068虹膜和D070高光；匹配外尾收尖、内缘曲率、虹膜内部纹路及反光位置形状。三眼内层使用一致的开口显隐几何，保留隐藏上部完整纹理；睫毛与眼白自然相接，保持去除上睑投在眼白上的外来投影，不直接镜像另一眼替代。



补充证据：[双眼原尺寸并排对照](review-01-evidence/eyes-1x.png)；[双眼3倍对照](review-01-evidence/eyes-3x.png)；[眼部与口内完整组合检查](review-01-evidence/combinations-page-2.png)；[D066.00完整独显](review-01-evidence/layers/55/solo-complete.png)；[D068.00完整独显](review-01-evidence/layers/57/solo-complete.png)；[D070.00完整独显](review-01-evidence/layers/59/solo-complete.png)；[D072.00完整独显](review-01-evidence/layers/61/solo-complete.png)；[D074.00完整独显](review-01-evidence/layers/63/solo-complete.png)。

### R16 — 左眼的睫尖、眼尾和虹膜细节不符

- 相关图层：`D065.00 | face/eyes/eye_left/sclera`；`D067.00 | face/eyes/eye_left/iris`；`D069.00 | face/eyes/eye_left/highlight`；`D071.00 | face/eyes/eye_left/upper_eyelid`；`D073.00 | face/eyes/eye_left/eyelid_crease`。
- 位置：`[717, 394, 94, 79]`。
- 当前表现：左眼上睑及睫尖被简化，外尾轮廓与眼白衔接改变；虹膜暗部纹路、上部白色反光的形状和位置与参考不同。
- 参考依据：standard.png左眼（画面右）的睫毛和外眼角、虹膜纹路与反光有本侧明确特征，同尺寸对照可辨。
- 影响：改变左眼原有眼形和层次，未满足逐眼一致要求。
- 修复方向及保留内容：以左眼本侧原图修D071、D073的上睑睫尖和眼褶，重画D065开口边、D067虹膜层次、D069高光；接顺外眼角到眼白的边界。同步检查三个眼内蒙版的共同开口，保留完整隐藏纹理及虹膜自身暗边，继续排除上睑外来投影；修后与右眼分别作原尺寸并排复核。



补充证据：[双眼原尺寸并排对照](review-01-evidence/eyes-1x.png)；[双眼3倍对照](review-01-evidence/eyes-3x.png)；[眼部与口内完整组合检查](review-01-evidence/combinations-page-2.png)；[D065.00完整独显](review-01-evidence/layers/54/solo-complete.png)；[D067.00完整独显](review-01-evidence/layers/56/solo-complete.png)；[D069.00完整独显](review-01-evidence/layers/58/solo-complete.png)；[D071.00完整独显](review-01-evidence/layers/60/solo-complete.png)；[D073.00完整独显](review-01-evidence/layers/62/solo-complete.png)。

### R17 — 右米色后腕环缺描边，回转形体不顺

- 相关图层：`D029.00 | arms/arm_right/bracelet_cream_back`；`D052.00 | arms/arm_right/bracelet_cream_front`；`Native occlusion | partial rear turnover`。
- 位置：`[365, 949, 86, 66]`。
- 当前表现：完整后环独显为边界模糊的浅色弯条，没有接续的清楚描边；两端有尖叉和折角。默认显露回转处也与前环轮廓、材质不接顺。
- 参考依据：standard.png同侧可见腕环有明确轮廓和圆滑回转；隐藏后弧应依此前后环关系补成连续同材质部件，不能把当前尖叉当作原图细节。
- 影响：后环本身形体和线条不完整，组合回转结构与参考不一致。
- 修复方向及保留内容：在D029重画合理圆弧、两端回转和完整棕灰描边，按环体自身体积接顺明暗，并与D052可见前环的线宽和材质一致；保持前后环各自归属。蒙版只控制显露，停用后不得有尖叉、折角或缺线，不能靠蒙版隐藏单件瑕疵。



补充证据：[后腕环完整独显4倍图](review-01-evidence/bracelet-right-rear-isolated-4x.png)；[工具独显局部对照](review-01-evidence/marked-isolated/R17-comparison.png)；[D029.00完整独显](review-01-evidence/layers/21/solo-complete.png)；[D052.00完整独显](review-01-evidence/layers/44/solo-complete.png)。

### R18 — 粉色踝环左后回转多出尖凸

- 相关图层：`D011.00 | legs/leg_right/anklet_back`；`D090.00 | legs/leg_right/anklet_front`；`Native occlusion | partial rear turnover`。
- 位置：`[559, 1765, 29, 40]`。
- 当前表现：粉色踝环左后回转在默认状态露出较高的尖三角凸起，与前环边缘接合不圆滑。
- 参考依据：standard.png此处环边低而顺滑，没有当前高度和尖形的凸起。
- 影响：踝环回转形体和显露边界与原图不同。
- 修复方向及保留内容：在D011完整后环中修正此处圆弧与端部形体，续接自身描线和粉色明暗；再调整后环显隐蒙版，使可见回转与D090前环、铃体自然相接。保留完整后弧，停用蒙版检查时也应平滑。



补充证据：[踝环放大对照](review-01-evidence/ankle-3x.png)；[D011.00完整独显](review-01-evidence/layers/02/solo-complete.png)；[D090.00完整独显](review-01-evidence/layers/79/solo-complete.png)。

### R19 — 右红晕变为紧圆团和粗深线

- 相关图层：`D077.00 | face/blush_right`。
- 位置：`[619, 457, 54, 48]`。
- 当前表现：红色底已经存在，但范围变成较紧的圆团；斜线更粗、更深，线群下延及分布与参考不同。
- 参考依据：standard.png右红晕是较细、较浅且向下延伸的线群，红色底更弥散。
- 影响：改变原图脸部细节和红晕画法，不能视为细节已完整还原。
- 修复方向及保留内容：在D077按右侧原图重画红底范围、浓淡和柔边，再恢复细线的长度、方向、间距及透明度；红底与斜线继续归同一红晕部件，保留脸底自身肤色，不把红晕烘焙进脸层。



补充证据：[鼻部与红晕放大对照](review-01-evidence/nose-blush-3x.png)；[D077.00完整独显](review-01-evidence/layers/66/solo-complete.png)。

### R20 — 左红晕的线宽及分布改变

- 相关图层：`D076.00 | face/blush_left`。
- 位置：`[745, 455, 55, 47]`。
- 当前表现：斜线明显比参考粗，线群长度、排列及红色底的形状和浓淡分布改变。
- 参考依据：standard.png左侧红晕有本侧较细、较软的线群及弥散底色，不能以另一侧线群代替。
- 影响：左颊细节与原图不一致，影响整体表情观感。
- 修复方向及保留内容：在D076依据左侧参考修红底分布和柔边，并逐条画回本侧细线的长度、方向、间距及浓淡；保持红底和线同件，修后与右红晕分别原尺寸对照。



补充证据：[鼻部与红晕放大对照](review-01-evidence/nose-blush-3x.png)；[D076.00完整独显](review-01-evidence/layers/65/solo-complete.png)。

### R21 — 左耳毛簇的位置和尖簇轮廓不符

- 相关图层：`D018.00 | face/ears/ear_left/ear_fur`；`D016.00 | face/ears/ear_left/ear_interior`；`Ear aperture | left shell inner rim`。
- 位置：`[789, 228, 72, 91]`。
- 当前表现：左耳毛簇上缘升高，尖簇轮廓及底部收尖改变；底端有多余碎尖和浅边。
- 参考依据：standard.png左耳毛簇上缘位置、外侧尖簇折线及底端收尖明确，与当前同坐标对照不同。
- 影响：耳内毛簇形状和位置与原图不符，边缘不干净。
- 修复方向及保留内容：在D018按本侧原图恢复毛簇位置、尖簇轮廓及细描线，接顺底端并去掉多余碎尖浅边；保留完整隐藏毛根和本件毛色纹理。核对D016内面及左耳开口蒙版的接合，避免蒙版切出新碎边。



补充证据：[左耳3倍对照](review-01-evidence/ear-left-3x.png)；[D016.00完整独显](review-01-evidence/layers/07/solo-complete.png)；[D018.00完整独显](review-01-evidence/layers/09/solo-complete.png)。

### R22 — 颈部两侧自身外轮廓缺失

- 相关图层：`D022.00 | neck`。
- 位置：`[651, 500, 116, 95]`。
- 当前表现：完整颈部独显两侧主要只剩肤色透明度边，没有原图的自身棕色外轮廓线；默认下颌至耳罩之间的颈侧边界也被淡化。
- 参考依据：standard.png同处颈侧有连续棕色轮廓。这条本件外轮廓与下颌投在颈部的阴影是不同内容，应保留轮廓并继续排除外来投影。
- 影响：部件自身外轮廓没有画完整，默认颈侧结构也淡失。
- 修复方向及保留内容：在D022按本件颈侧形体续画两侧棕色轮廓至隐藏区，接顺原可见段的线宽和颜色，再与下颌及耳罩的覆盖边核对。保留已去除下颌、耳罩外来投影后的自身肤色，锁骨线仍归torso；完整独显及默认组合都须确认。



补充证据：[颈部放大对照](review-01-evidence/neck-detail-3x.png)；[工具完整独显局部对照](review-01-evidence/marked-isolated/R22-comparison.png)；[D022.00完整独显](review-01-evidence/layers/13/solo-complete.png)。

完整独显另标记范围为`[629, 483, 160, 157]`，用于查看两侧轮廓延续；主框仍为默认可见颈侧范围。

## 修复顺序与复检要求

1. 先处理R13、R14的局部层级及分片遮挡，保持完整根部和原深度职责。
2. 修R1–R10的肘、肩胸、腰腹及掌指接缝；在本件完整区域接顺线条、颜色和明暗，再核对蒙版显露。
3. 修R11、R12、R17、R18、R22的完整单件轮廓及补色过渡。默认遮挡不能作为独显瑕疵已修好的依据。
4. 按各侧原图恢复R15、R16的双眼，及R19–R21的红晕、耳毛细节。

每批修后都应导出并看相关层的默认独显、停用蒙版完整独显、隐藏上层和整图同坐标对照；多深度part另看各片与合并。最后逐眼原尺寸并排核对，确保接点没有台阶、断线、粗细突变、色差或毛刺。修画应使用生成画面、画笔或本件原图取样，保留各部件自身的明暗与细节，继续排除由裙、下颌、耳罩及腕饰等其他部件投下的投影。

## 完整检查证据

[可见参考与当前整图，原尺寸同坐标](review-01-evidence/whole-standard.png)；[身体辅助参考与当前整图](review-01-evidence/whole-base.png)；[默认白底](review-01-evidence/current-on-white.png)；[默认黑底](review-01-evidence/current-on-black.png)；[全蒙版停用白底](review-01-evidence/all-masks-disabled-white.png)。

逐层图集（每页8个实际层，四列依次为默认独显、完整独显、隐藏上层默认、隐藏上层完整）：

[第1页](review-01-evidence/atlas-01.png)；[第2页](review-01-evidence/atlas-02.png)；[第3页](review-01-evidence/atlas-03.png)；[第4页](review-01-evidence/atlas-04.png)；[第5页](review-01-evidence/atlas-05.png)；[第6页](review-01-evidence/atlas-06.png)；[第7页](review-01-evidence/atlas-07.png)；[第8页](review-01-evidence/atlas-08.png)；[第9页](review-01-evidence/atlas-09.png)；[第10页](review-01-evidence/atlas-10.png)。

原尺寸大部件补充图集：[1](review-01-evidence/native-large-page-1.png)、[2](review-01-evidence/native-large-page-2.png)、[3](review-01-evidence/native-large-page-3.png)。

组合检查：[辫与骨盆](review-01-evidence/combinations-page-1.png)、[双眼与口内](review-01-evidence/combinations-page-2.png)、[双手](review-01-evidence/combinations-page-3.png)。

全隐藏的小指、口内四层、后发圈和后大腿环带均已看过完整纹理及蒙版启停状态；骨盆两片合并连续。上述部件未发现足够明确的新增修复问题。其余检查覆盖及实际图层映射均列在逐层索引中。

本次仅列以上22项有明确图像证据、确定需要修复的问题。检查范围已完成，没有必要输入缺失或持续工具故障；本报告写入review-01.md.tmp，待调度器检查发布。
