结论：需要修复

已完成全部衣片检查，确认 9 项需要修复的问题。R1–R5、R7、R8 在默认衣服合成中可见；R6、R9 是合成遮住但分片独显仍存在的瑕疵。以下坐标均为 1115×1410 原画布坐标，框格式为 `[x,y,width,height]`；“画面左/右”按观看方向，图层名中的 left/right 按角色自身方向。

## 检查范围与证据来源

- 在 Krita 5.3.4.1 实际打开 `clothing-raster-layering/step01/clothing-depth.kra`，检查 23 个逻辑 part、32 个绘画分片。逐分片独显、逐分片隐藏所有更高深度层观察补全区，再将同一逻辑 part 的多个深度分片合看。没有把同一 part 的前后分片误判为重复层。
- 检查了全部 7 个显隐透明度蒙版的启用、停用状态及其控制的衣片，并分别查看默认整图和全部蒙版停用的整图。蒙版位于 5 个显隐组或对应绘画层，停用后检查到的完整衣料不是按默认遮挡效果推断出来的。
- 对照衣服参考 `clothing-part-layering/references/clothing.png`、原穿衣角色 `part-layering/references/simplified-subject.png`，并读取 `clothing-part-layering/parts/`、`groups.json`、`occlusion.json`。放大查看双侧肩袖、袖口前后回转端、领座、白领前后接头、领尖与领带、扣带与方扣、门襟、裙腰及裙摆前后边界。
- 已阅读 step01 的制作报告 `report.md`。本轮开始时没有正式 review / repair 报告；工作区暂存修画图和脚本不作为完成证据。本报告的当前图全部来自本轮打开正式 KRA 后的实际导出。
- 本次只审查衣服 KRA，不检查身体装配。未保存工程，未改上游分层文件；Krita 原显隐状态已恢复。KRA、groups、occlusion 和 parts 的 36 个输入文件审查前后 SHA256 全部一致，详见 [只读核对](review-01-evidence/readonly-verification.json) 与 [Krita 状态核对](review-01-evidence/krita-review-state.json)。哈希只核对输入未改动，不用于评价画面质量。

原尺寸证据：[默认合成](review-01-evidence/review_exports/default_restored.png)、[全部蒙版停用](review-01-evidence/review_exports/all_masks_off.png)、[上游色块合成](review-01-evidence/review_details/upstream-colorblocks.png)。完整导出索引见 [review_export_manifest.json](review-01-evidence/review_export_manifest.json)，节点清单见 [review_inventory.json](review-01-evidence/review_inventory.json)。

## 框选总览

框选工具只标注已经看图确认的问题。以下三个定位图使用不同显隐场景，均保持原画布坐标；各问题的参考/当前局部均为同坐标裁切，左参考、右当前。补充放大图只增加观察倍率，未移位或重配准参考。

- [默认合成：R1、R2、R3、R4、R5、R7、R8](review-01-evidence/regions/composite/marked.png)，[框坐标与图层记录](review-01-evidence/regions/composite/regions.json)。
- [前领座 d23 独显：R6](review-01-evidence/regions/collar-seat-solo/marked.png)，[框坐标与图层记录](review-01-evidence/regions/collar-seat-solo/regions.json)。
- [裙身 d24 独显：R9](review-01-evidence/regions/skirt-front-solo/marked.png)，[框坐标与图层记录](review-01-evidence/regions/skirt-front-solo/regions.json)。

工具原始证据目录及正式证据副本位置记录在 [annotation-index.json](review-01-evidence/annotation-index.json)；原始工具记录没有改写。

## 确定需要修复的问题

### R1 — 画面左袖口新增斑块与密集尖角褶皱

**图层与位置：** `outer_jacket/right_sleeve | near | d33`；框 `[194,503,206,159]`，重点为青色袖带与其上方白布。

**当前表现：** 袖带外面出现多个不规则深浅青色斑块；白布沿袖带上缘出现一排锐利三角折痕。独显及合成都能看到，不是显隐蒙版产生的色块。

**参考依据与影响：** 衣服参考该袖带为连续、平顺的青色渐变，白布只有较舒缓的阴影转折。原穿衣角色对应袖口也没有这些斑纹和密集尖折。当前改变了袖带色面与白布的褶皱结构，原尺寸可见。

**修复方向：** 在 d33 上局部重画袖带连续色面，接顺明暗渐变；按参考恢复白布上缘的舒缓阴影和必要褶皱。保留袖口收拢、窄透明开口、远侧内壁及两端回转，不把开口填成实心色块，也不画入手臂。

**复验：** d33 独显、d7/d33 合看、默认合成各检查一次；袖带无新增斑块，白布褶皱与参考相符，前后袖口连接仍平顺。



证据：[当前局部](review-01-evidence/regions/composite/R1-current.png)、[参考局部](review-01-evidence/regions/composite/R1-reference.png)、[2×对照](review-01-evidence/review_details/left_cuff.png)、[原穿衣角色对应袖口](review-01-evidence/review_details/worn_cuff_native.png)。最后一图裁自穿衣角色原坐标 `(357,559)–(492,751)`，仅作袖带和褶皱依据，不与衣服参考共用坐标。

### R2 — 画面左袖窿两片黑边叠成多余双线

**图层与位置：** `outer_jacket/right_sleeve | near | d33`、`outer_jacket/jacket_body/right_front/front_panel | complete | d35`；框 `[354,330,89,284]`，从肩端至腋下。

**当前表现：** 两片独显时，接合边各自画有深黑轮廓；合看上段形成相邻的黑边和明显粗黑缝，下段还有额外平行边线。肩端接入时线宽骤变。

**参考依据与影响：** 参考上段袖窿是单条浅蓝细缝线，向腋下自然转为深色线。当前把内部缝线画成外轮廓般的粗双边，破坏袖山与衣身连成衣服的观感。

**修复方向：** 协同修整 d33/d35 的根部搭接，按参考重画一条接缝及其由浅到深的过渡。将被另一片覆盖的边线收在搭接区，避免两条完整黑外边同时露出；补接各自布面，不能只机械擦掉接边而造成独显缺口。

**复验：** 两片分别独显、隐藏上层、合看；原尺寸肩端无台阶，袖窿无平行黑线，至腋下线条粗细与参考连续。



证据：[当前局部](review-01-evidence/regions/composite/R2-current.png)、[参考局部](review-01-evidence/regions/composite/R2-reference.png)、[d33／d35 独显及合成放大](review-01-evidence/review_details/shoulder_layers_left.png)。

### R3 — 画面右袖窿接缝过黑、过粗

**图层与位置：** `outer_jacket/left_sleeve | near | d32`、`outer_jacket/jacket_body/left_front/front_panel | complete | d34`；框 `[767,344,55,276]`。

**当前表现：** 袖片与前片接边均带深线，合看肩根及袖窿上段变成粗黑边，中下段两边相叠使黑线局部增厚，线宽过渡突兀。

**参考依据与影响：** 参考肩根及上段为较细蓝色接缝，向下的深色边界有自然过渡。当前接缝过重，与另一侧一样把相连布面分成明显的黑色边界。

**修复方向：** 在 d32/d34 上修整搭接及重叠边线，按参考重画接缝的颜色、线宽和下段转折。保持两片自身完整，接缝调整不要牵动袖口前后内壁。

**复验：** 两片独显与合看均检查；肩端至腋下只露出参考需要的边线，原尺寸不见重叠黑边或线宽突变。



证据：[当前局部](review-01-evidence/regions/composite/R3-current.png)、[参考局部](review-01-evidence/regions/composite/R3-reference.png)、[d32／d34 独显及合成放大](review-01-evidence/review_details/shoulder_layers_right.png)。

### R4 — 画面右胸标上移、缩小并被驳头遮住

**图层与位置：** 绘画层 `outer_jacket/jacket_body/left_front/front_panel | complete | d34`；相关遮挡层 `outer_jacket/jacket_body/left_front/lapel | complete | d36`；框 `[721,431,61,88]`。

**当前表现：** 三角标整体上移并缩小，上端黄色角贴入青色驳头自由边，被该边盖住；上方小圆点也偏小、位置偏移。

**参考依据与影响：** 参考三角标约在 `x731–777、y460–511`，完整露出，与驳头之间有白布间隔。当前约在 `x728–769、y445–492`，图样位置和比例都改变，并失去完整外轮廓。

**修复方向：** 在 d34 上按参考重新定位、绘制三角标和小圆点，恢复外轮廓、内孔图形、黄绿青色过渡及留白。保留 d36 的正常驳头结构和层级，不以调换层序把错误位置的标识强行露出来。

**复验：** d34 独显时标识完整干净；默认合成中标识与驳头保持参考留白，大小、位置和配色一致。



证据：[当前局部](review-01-evidence/regions/composite/R4-current.png)、[参考局部](review-01-evidence/regions/composite/R4-reference.png)、[4×对照](review-01-evidence/review_details/badge.png)。

### R5 — 可见衬衫门襟漏一粒纽扣，布面与褶皱形状偏离

**图层与位置：** `inner_shirt/shirt_body | near | d22`；框 `[545,563,182,132]`，中央扣带下方至裙腰上方的可见门襟。

**当前表现：** 参考该段的三粒纽扣只画出两粒；当前上粒约在 `y603`，下粒约在 `y663`，中间纽扣缺失。门襟下端近乎直线，两侧布面出现多道锐利斜三角色面。

**参考依据与影响：** 参考三粒纽扣依次约在 `y588、y626、y666`；门襟下端顺着布面弯曲，两侧是较圆润的布料折面和融色。漏扣与布面改变均位于默认可见区，不能以外套遮挡或补全需要解释。

**修复方向：** 局部重画门襟，恢复三粒纽扣的位置、间距与描边；按参考接回下端弯曲及两侧圆润明暗。与上方隐藏衬衫布面接成一片；取样时只取本衬衫，避免把扣带、外套边线或它们的投影画进 d22。

**复验：** d22 独显、蒙版停用的隐藏上层场景及默认合成检查；三扣齐全，门襟不断线，可见布面与参考一致，补全区无色块拼贴。



证据：[当前局部](review-01-evidence/regions/composite/R5-current.png)、[参考局部](review-01-evidence/regions/composite/R5-reference.png)、[放大对照](review-01-evidence/review_details/shirt.png)。

### R6 — 前领座独显仍有游离深色残点

**图层与位置：** `inner_shirt/shirt_collar/collar_base | near | d23`；框 `[640,287,24,33]`，约 `(649,294)` 的小点及下面的尖端接边。

**当前表现：** d23 独显时，有一个与领料分离的深色小点，下面尖端局部也不平顺。d10/d23 合看后被后领座覆盖，因此默认合成无法代替此项检查。

**参考依据与影响：** 此处属于参考没有直接显露的补全/搭接位置，不据参考臆造隐藏纹样。确定问题的依据是独显中实际存在的游离像素，不符合每片连续、干净的要求。

**修复方向：** 删除游离残点，以本领座笔触修顺尖端及接边；保留与 `inner_shirt/shirt_collar/collar_base | far | d10` 的连续搭接，不把整个尖端切平，也不依赖上层或蒙版遮住残点。

**复验：** d23 原尺寸及放大独显无游离残点；d10/d23 合看领座内缘和布面连续，颈口正常透明开口保留。



证据：[工具同坐标左参考／右独显](review-01-evidence/regions/collar-seat-solo/R6-comparison.png)、[当前局部](review-01-evidence/regions/collar-seat-solo/R6-current.png)、[参考定位局部](review-01-evidence/regions/collar-seat-solo/R6-reference.png)、[d10/d23 合看局部](review-01-evidence/review_details/seat_join.png)。参考定位局部不是该隐藏领料的直接外观依据。

### R7 — 画面左白翻领前后接头有台阶和线宽突变

**图层与位置：** `outer_jacket/jacket_collar/right_collar_flap | far | d5`、`outer_jacket/jacket_collar/right_collar_flap | near | d39`；框 `[491,266,26,66]`，重点在约 `(500,274)` 的颈根上端。

**当前表现：** near 分片粗黑线的方形端头高出 far 分片细线，形成数像素台阶；领内缘接入处也突然加粗。逻辑 part 合看以及默认合成都能看到这个凸起。

**参考依据与影响：** 参考上缘为平顺回转的曲线，进入领内缘时没有方头或高度突变。当前同一白翻领的深度分片接头可被辨认，未达到原尺寸看不出拼接的要求。

**修复方向：** 协同重画 d5/d39 的搭接端轮廓、内缘与线宽，顺着参考曲线接回，消除高出的方头。保留后侧窄领料和足够搭接，不能因 far 片较窄就删除它，也不能把颈口封上。

**复验：** 两分片独显、逻辑 part 合看及默认合成检查；上缘与内缘顺接，无台阶、方头、突然变粗或新缺口。



证据：[工具同坐标对照](review-01-evidence/regions/composite/R7-comparison.png)、[当前局部](review-01-evidence/regions/composite/R7-current.png)、[参考局部](review-01-evidence/regions/composite/R7-reference.png)、[同一白翻领合看接头放大](review-01-evidence/review_details/white_collar_join.png)。

### R8 — 中央方扣放大，圆角和边框比例改变

**图层与位置：** `jacket_front_clasp/center_buckle | complete | d40`；框 `[613,498,54,45]`。

**当前表现：** 方扣实际绘画边界为 `x618、y503、44×35`，较参考明显放大；边框更宽，四角更硬，扣件覆盖两翼中央区域也随之增加。

**参考依据与影响：** 参考及上游 part 说明的扣件外轮廓约为 `x622–659、y507–536`，是较小、圆润的圆角方扣。当前改变了胸前两翼中央收束点的比例，原尺寸可辨。

**修复方向：** 按参考重画方扣的外形、位置、圆角、边框及扣面明暗，恢复中央固定图形。不要整体缩放带翼或调动外套来迁就放大的方扣；两翼内端保持独立、在扣下自然搭接。

**复验：** d40 独显时外形、配色及图形与参考一致；与 d30/d31 合看无缺口、多余线或硬接边，默认合成收束比例恢复。



证据：[当前局部](review-01-evidence/regions/composite/R8-current.png)、[参考局部](review-01-evidence/regions/composite/R8-reference.png)、[方扣与带翼4×对照](review-01-evidence/review_details/clasp_zoom.png)。上述边界数字只用于定位和修画，结论来自图像对照。

### R9 — 裙身前分片中央下缘残留青蓝窄边和毛刺

**图层与位置：** `pleated_skirt/skirt_body | near | d24`；框 `[548,1093,104,23]`，局部下凸约在 `x615–620`。

**当前表现：** 前分片独显时，深色包边外缘附有青蓝色窄边，其中一小段向下凸出，形成约 1–2 像素的局部毛刺。前后分片合看时，远侧蓝色裙边遮蔽了它；没有据此判定整裙出现断口。

**参考依据与影响：** 参考前裙的深色包边是一条连贯曲线，外面的蓝色裙边由远侧 d11 承担。当前独显前片附带局部蓝色残边与突起，分片自身不够干净。工具参考同坐标包含远侧蓝裙边，不能把参考蓝区直接当作前片需画的内容。

**修复方向：** 用前片自身的深色包边笔触局部清理青蓝残边及下凸毛刺，接顺原曲线与抗锯齿；不要硬选区切出直线，也不要改动 d11 的完整蓝裙边。保留前后裙片独立层、裙口及必要搭接。

**复验：** d24 独显原尺寸和放大检查，中央下缘无青蓝残边或下凸刺；d11/d24 合看及默认合成保持参考的深色前缘、蓝色后缘，无新缝隙。



证据：[工具同坐标左参考／右前片独显](review-01-evidence/regions/skirt-front-solo/R9-comparison.png)、[当前局部](review-01-evidence/regions/skirt-front-solo/R9-current.png)、[参考局部](review-01-evidence/regions/skirt-front-solo/R9-reference.png)。

## 逐衣片检查覆盖

下表每行均已完成对应全部深度分片的实际独显、隐藏更高层观察补全区，以及该逻辑 part 合看；单层 part 的合看就是本层自身。每行还结合整图对照参考。列出的“未确认其他问题”只表示本轮没有确定要修的其他证据，不替代上述修复项的复验。

`dN` 对应 KRA 中完整名称末尾的 `| dN`；所有实际完整层名与导出路径均在导出索引中。表中独显与补全场景均关闭显隐蒙版；受蒙版控制的层另外完成下一节的两状态检查。

| 逻辑 part | 实际深度分片 | 独显 / 补全区 / 合看 | 确定问题 | 合看原图 |
| --- | --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` | d1 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_body__back_panel.png) |
| `inner_shirt/shirt_body` | d2、d22 | 已查 / 已查 / 已查 | R5 | [原图](review-01-evidence/review_exports/part_inner_shirt__shirt_body.png) |
| `outer_jacket/jacket_collar/collar_root` | d3 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_collar__collar_root.png) |
| `outer_jacket/jacket_collar/left_collar_flap` | d4、d38 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_collar__left_collar_flap.png) |
| `outer_jacket/jacket_collar/right_collar_flap` | d5、d39 | 已查 / 已查 / 已查 | R7 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_collar__right_collar_flap.png) |
| `outer_jacket/left_sleeve` | d6、d32 | 已查 / 已查 / 已查 | R3 | [原图](review-01-evidence/review_exports/part_outer_jacket__left_sleeve.png) |
| `outer_jacket/right_sleeve` | d7、d33 | 已查 / 已查 / 已查 | R1、R2 | [原图](review-01-evidence/review_exports/part_outer_jacket__right_sleeve.png) |
| `inner_shirt/left_sleeve` | d8、d20 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_inner_shirt__left_sleeve.png) |
| `inner_shirt/right_sleeve` | d9、d21 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_inner_shirt__right_sleeve.png) |
| `inner_shirt/shirt_collar/collar_base` | d10、d23 | 已查 / 已查 / 已查 | R6 | [原图](review-01-evidence/review_exports/part_inner_shirt__shirt_collar__collar_base.png) |
| `pleated_skirt/skirt_body` | d11、d24 | 已查 / 已查 / 已查 | R9 | [原图](review-01-evidence/review_exports/part_pleated_skirt__skirt_body.png) |
| `pleated_skirt/waistband` | d25 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_pleated_skirt__waistband.png) |
| `short_necktie/hanging_blade` | d26 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_short_necktie__hanging_blade.png) |
| `short_necktie/knot_and_attachment` | d27 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_short_necktie__knot_and_attachment.png) |
| `inner_shirt/shirt_collar/left_collar_leaf` | d28 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_inner_shirt__shirt_collar__left_collar_leaf.png) |
| `inner_shirt/shirt_collar/right_collar_leaf` | d29 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_inner_shirt__shirt_collar__right_collar_leaf.png) |
| `jacket_front_clasp/left_clasp_wing` | d30 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_jacket_front_clasp__left_clasp_wing.png) |
| `jacket_front_clasp/right_clasp_wing` | d31 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_jacket_front_clasp__right_clasp_wing.png) |
| `outer_jacket/jacket_body/left_front/front_panel` | d34 | 已查 / 已查 / 已查 | R3、R4 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_body__left_front__front_panel.png) |
| `outer_jacket/jacket_body/right_front/front_panel` | d35 | 已查 / 已查 / 已查 | R2 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_body__right_front__front_panel.png) |
| `outer_jacket/jacket_body/left_front/lapel` | d36 | 已查 / 已查 / 已查 | R4（相关遮挡层） | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_body__left_front__lapel.png) |
| `outer_jacket/jacket_body/right_front/lapel` | d37 | 已查 / 已查 / 已查 | 未确认其他问题 | [原图](review-01-evidence/review_exports/part_outer_jacket__jacket_body__right_front__lapel.png) |
| `jacket_front_clasp/center_buckle` | d40 | 已查 / 已查 / 已查 | R8 | [原图](review-01-evidence/review_exports/part_jacket_front_clasp__center_buckle.png) |


独显观察板：[1](review-01-evidence/review_sheets/solo_01.png)、[2](review-01-evidence/review_sheets/solo_02.png)、[3](review-01-evidence/review_sheets/solo_03.png)、[4](review-01-evidence/review_sheets/solo_04.png)、[5](review-01-evidence/review_sheets/solo_05.png)、[6](review-01-evidence/review_sheets/solo_06.png)、[7](review-01-evidence/review_sheets/solo_07.png)、[8](review-01-evidence/review_sheets/solo_08.png)。

隐藏上层观察板：[1](review-01-evidence/review_sheets/uncover_01.png)、[2](review-01-evidence/review_sheets/uncover_02.png)、[3](review-01-evidence/review_sheets/uncover_03.png)、[4](review-01-evidence/review_sheets/uncover_04.png)、[5](review-01-evidence/review_sheets/uncover_05.png)、[6](review-01-evidence/review_sheets/uncover_06.png)、[7](review-01-evidence/review_sheets/uncover_07.png)、[8](review-01-evidence/review_sheets/uncover_08.png)。

同 part 合看观察板：[1](review-01-evidence/review_sheets/parts_01.png)、[2](review-01-evidence/review_sheets/parts_02.png)、[3](review-01-evidence/review_sheets/parts_03.png)、[4](review-01-evidence/review_sheets/parts_04.png)、[5](review-01-evidence/review_sheets/parts_05.png)、[6](review-01-evidence/review_sheets/parts_06.png)。观察板用于记录覆盖范围；其原尺寸导出保存在 `review-01-evidence/review_exports/`，没有以缩略图或记录代替关键局部检查。

## 显隐蒙版两状态检查

下列 7 个蒙版均已启用、停用各看一次，包含各受控层独显和两种整图状态。启用时隐藏某层的完整绘画属于显隐控制，不作为衣片缺失的问题；停用状态下已检查真实补全内容。

| 受控绘画层 | 蒙版完整名称 | 两状态检查 | 对照证据 |
| --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel | complete | d1` | `outer_jacket/jacket_body/back_panel | default hidden` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_01.png) |
| `inner_shirt/shirt_body | far | d2` | `inner_shirt/shirt_body | default concealed | d2` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_02.png) |
| `outer_jacket/jacket_collar/collar_root | complete | d3` | `outer_jacket/jacket_collar/collar_root | default hidden` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_03.png) |
| `inner_shirt/left_sleeve | far | d8` | `inner_shirt/left_sleeve | default concealed | d8` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_04.png) |
| `inner_shirt/right_sleeve | far | d9` | `inner_shirt/right_sleeve | default concealed | d9` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_05.png) |
| `inner_shirt/left_sleeve | near | d20` | `inner_shirt/left_sleeve | default concealed | d20` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_06.png) |
| `inner_shirt/right_sleeve | near | d21` | `inner_shirt/right_sleeve | default concealed | d21` | 已查 | [停用／启用](review-01-evidence/review_sheets/mask_07.png) |


## 修复时需要保留的内容

本轮没有确认需修的人体像素、前后衣片合并或整形填色问题，不据制作方式的文字记录推断画面有这些缺陷。当前袖口收拢、正常透明开口、完整远侧衣料内壁、颈口与裙口，以及同一逻辑 part 的前后深度分片均应保留。现有 7 个显隐蒙版两状态已检查，不以永久开关蒙版掩盖 R6、R9 的独显瑕疵。

修复 R1–R9 后，应在实际保存的 KRA 中重新检查相关分片独显、隐藏上层补全、同 part 合看、蒙版两状态和原尺寸合成，特别复核肩袖、白领及裙摆接边。此报告只写入 `review-01.md.tmp`，未自行发布正式 review / repair，也未修改交付工程。
