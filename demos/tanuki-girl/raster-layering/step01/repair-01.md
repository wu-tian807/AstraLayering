结论：已修复

# 第一步 repair 01

review的22项均已修画或修正层序并通过复检，自检新增问题也已修复。本轮完成R18后，KRA、默认PNG及制作报告已更新，全部问题通过本步看图自检。

## 输入及最终工程

画布1376 × 2048；78个逻辑part、81个普通绘画层、34个Krita原生透明度蒙版。75个单深度part各有一个完整绘画层；右辫、骨盆、狸饰主体3个多深度part各有两个普通分片。绘画层按实际深度从下到上排列，蒙版挂在本件父层，没有新增独立运动节点。

工程：`raster-layering/step01/character-depth.kra`。默认透明PNG：`raster-layering/step01/character-depth.png`，为蒙版启用状态；眼睛默认睁开，口内、小指、后发圈、后大腿带保留默认闭合隐藏。

可见内容参考：`part-layering/references/standard.png`。身体、临时连体服及R1–R7、R12参考：`part-layering/references/base-subject.png`。参考与当前图保持相同原画布坐标；1倍对照不移动或缩放参考，放大图仅将同一观察区域等比放大。

当前有效上游：`part-layering/groups.json`、`part-layering/occlusion.json`及`part-layering/parts`。本次修复前段R13/R14已用edit_occlusion同步，工具返回validated=true、81深度区域；本轮延续修画没有再改逻辑ID、SVG、groups或深度。

## 修画及检查方法

本次需要重画的肘端、胸肩、大腿、指根、环弧、红晕及耳毛先按本件三色控制和中性灰输入局部生成。本轮保留这些已有生成主体，继续做本件局部配准、Krita原生画笔、原图本件取样、原生蒙版及局部原生柔化；没有沿形状整块替换生成RGB。取样没有借入邻件、遮挡物或外来投影。

首轮生成与复用记录：`raster-layering/step01/workspace/generation_manifest.json`；70件直接生成、8件在Krita从已生成同型部件复制／镜像／配准，复用来源逐层列于下表。三色输入在`raster-layering/step01/workspace/controls`及`raster-layering/step01/workspace/repair01`；此前修画在`raster-layering/step01/workspace/repair01/continued`，本轮R18的三色输入、成功结果、配准和原生笔修请求在`raster-layering/step01/workspace/repair01/ankle-final`，原生操作日志为`raster-layering/step01/workspace/local_repairs.json`。双眼与红晕分别按各侧参考修画，未镜像替代不对称细节。

每项均查看单层、停用本层蒙版的完整单层、隐藏上层和默认整图。四状态图的四列依次为solo-default、solo-complete、upper-hidden-default、upper-hidden-complete；比较图左参考／中修前／右当前。多深度部件另查联合完整画面。全部81层原尺寸四状态见[索引](repair-01-evidence/final-audit/index.json)。

全部11页逐层图集已看过，最后R18修画另看完整两弧、局部四状态、1倍并排与整图；当前11页图集已从最后更新的原尺寸导出全部刷新，见[刷新记录](repair-01-evidence/final-audit/atlas-refresh.json)。双眼、双肩、红晕另作1倍并排；整图灰度对照见[可见参考整图](repair-01-evidence/final-audit/whole-standard-gray-small.png)、[身体参考整图](repair-01-evidence/final-audit/whole-base-gray-small.png)。不以PSNR等数字代替看图。

## 逐项处理结果

### R1 — 右肘肤色与轮廓：已修复

相关part与实际深度：`arms/arm_right/upper_arm` / D26；`arms/arm_right/forearm` / D32。图层名及UUID见report.md。

处理：前臂肘端按三色控制重新生成、配准；在两层本件接头内修接自身桃色暗带和棕色外缘，调整原生搭接。保留两件完整肘端。

最终看图：斜直亮边已消除，默认肘部肤色、暗带与外缘连续；完整独显中没有借入另一条臂或遮挡物。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R1-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R1-comparison.png)。

### R2 — 左肘斜亮面与折点：已修复

相关part与实际深度：`arms/arm_left/upper_arm` / D25；`arms/arm_left/forearm` / D31。图层名及UUID见report.md。

处理：前臂肘端按本侧三色输入重生成，接顺上臂和前臂各自的肤色、暗部及外轮廓；另外清除离散的线外小点。

最终看图：斜切亮面、接点突宽暗带及外缘折阶已修顺。连续细描边与抗锯齿保留，没有把线外杂点当作结构续线。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R2-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R2-comparison.png)。

### R3 — 画面左肩带接线：已修复

相关part与实际深度：`body/torso` / D34；`body/breast` / D35。图层名及UUID见report.md。

处理：保留上部torso三色生成主体，在本件原始alpha范围内对U领口局部配准；内部alpha保护改为>0.85后配准实际生效。沿真实U内缘以Krita原生1.55像素细线续接，breast完整帽盖与y649–681渐变接合保留，未采用暴露平直帽盖的实验蒙版。

最终看图：左肩带至领口的横短边、淡双线和线宽台阶消除。1倍并排及放大检查中内外线连续，单件完整轮廓、衣料明暗与默认接合均顺滑。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R3-R5-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R3-R5-comparison.png)。

补充：[肩带领口1倍并排](repair-01-evidence/final-audit/shoulders1x-comparison.png)。

### R4 — 画面右肩带接线：已修复

相关part与实际深度：`body/torso` / D34；`body/breast` / D35。图层名及UUID见report.md。

处理：与R3一起按两件实际U边界局部配准、续画本侧细线并接顺衣料。保留生成外缘与完整上接帽盖，只修不符的局部线段和明暗。

最终看图：右肩带凸折、错开的淡边与灰短钩已消除，领口切线和肩带宽度连续；蒙版启停及隐藏上层检查通过。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R3-R5-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R3-R5-comparison.png)。

补充：[肩带领口1倍并排](repair-01-evidence/final-audit/shoulders1x-comparison.png)。

### R5 — 上胸接色：已修复

相关part与实际深度：`neck` / D22；`body/torso` / D34；`body/breast` / D35。图层名及UUID见report.md。

处理：在完整生成上胸上局部配准接色，沿用breast帽盖从y649至y681的原生渐变显露。撤回出现水平帽盖边的实验结果，保留torso自己的锁骨与体积明暗，未恢复下颌或耳罩投影。

最终看图：上胸水平硬边、硬三角接片及叠接明暗的突变消除。双肩带与整段U领口一起复核通过，完整肤色与衣料延续干净。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R3-R5-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R3-R5-comparison.png)。

补充：[肩带领口1倍并排](repair-01-evidence/final-audit/shoulders1x-comparison.png)。

### R6 — 画面左腰腹线：已修复

相关part与实际深度：`pelvis` / D22.5；`pelvis` / D33；`body/torso` / D34。图层名及UUID见report.md。

处理：在torso及pelvis前片各自完整帽盖内用原生画笔续接本侧结构线，接顺颜色、线宽、位置和切线，并调整接合蒙版。

最终看图：左腰腹线在默认接合中连续；停用蒙版可见完整帽盖及其本件续线，骨盆两片和原运动归属保留。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R6-R7-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R6-R7-comparison.png)。

### R7 — 画面右腰腹线：已修复

相关part与实际深度：`pelvis` / D22.5；`pelvis` / D33；`body/torso` / D34。图层名及UUID见report.md。

处理：按右侧参考在两件接合区续画结构线，修正断段和错位，检查原生蒙版不再截断中段。

最终看图：两处空隙和段间错位已消除，默认右腰腹线连续；完整帽盖没有为了避免重叠而删除。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R6-R7-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R6-R7-comparison.png)。

### R8 — 右掌指根与层次：已修复

相关part与实际深度：`arms/arm_right/hand/ring_finger` / D39；`arms/arm_right/hand/middle_finger` / D41；`arms/arm_right/hand/index_finger` / D45；`arms/arm_right/hand/palm` / D47。图层名及UUID见report.md。

处理：在已有食指根部生成配准和掌侧本件取样修复上接顺切线。定位残余暗边来自隐藏帽盖闭合线后，用食指原生接合蒙版只藏掌接触内的上根线，掌蒙版仅藏x338–347/y1022–1027的小帽盖边；完整raw帽盖保留。以本件肤色Airbrush局部融接掌内部。

最终看图：桃色孤立点、楔口、小暗边、双线和默认台阶消除。掌面及叠指自身暗部连续，完整根部圆顺；腕饰投影没有画回。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R8-R11-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R8-R11-comparison.png)。

### R9 — 左掌指根与叠指：已修复

相关part与实际深度：`arms/arm_left/hand/ring_finger` / D38；`arms/arm_left/hand/middle_finger` / D40；`arms/arm_left/hand/index_finger` / D44；`arms/arm_left/hand/palm` / D46。图层名及UUID见report.md。

处理：保留已修的各指本件指腹、下缘和掌指接色。本轮逐层自检进一步发现左掌跟腕饰边缘走的三角投影残留，以本件肤色Airbrush在alpha锁定的内缩选区内去掉投影，并局部融接清理后出现的横色阶。

最终看图：掌指硬接色边、腕饰投影残留及横色阶已消除。沿掌自身外边走的窄桃色体积暗部保留；完整独显、隐藏上层和默认整图均连续。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R9-R10-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R9-R10-comparison.png)。

### R10 — 左拇指接掌：已修复

相关part与实际深度：`arms/arm_left/hand/thumb` / D42；`arms/arm_left/hand/palm` / D46。图层名及UUID见report.md。

处理：撤回位置错误的续线，沿拇指实际alpha轮廓（约x1020一带）重画棕色本件外缘，并修接掌面肤色。保留指尖、甲面与完整根帽。

最终看图：浅白断段、色阶和错误双线已消除，拇指到掌侧外轮廓连续。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R9-R10-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R9-R10-comparison.png)。

### R11 — 右食指完整根部：已修复

相关part与实际深度：`arms/arm_right/hand/index_finger` / D45。图层名及UUID见report.md。

处理：沿用三色局部生成的完整圆顺根部与原可见指腹、指尖，清掉邻指残线并接顺本件下缘。本轮随R8修正接掌内的原生显露，完整根帽未删除。

最终看图：完整食指根部不再有原长直台阶和突粗暗线，稍宽的根帽圆顺；默认掌接根也已复核通过，不靠遮挡掩盖完整部件瑕疵。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R8-R11-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R8-R11-comparison.png)。

### R12 — 左腿大腿补色：已修复

相关part与实际深度：`legs/leg_left/leg` / D23。图层名及UUID见report.md。

处理：大腿过渡按三色控制重生成并局部配准、融接；在本件原生画面上修两侧轮廓，整体腿位、腿根、膝、袜口和足部保留。

最终看图：原矩形淡边、内侧横阶和外轮廓台阶消失，完整腿面连续；没有取回裙子或裙投影。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R12-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R12-comparison.png)。

### R13 — 狸饰下颌与发根层序：已修复

相关part与实际深度：`head_accessories/tanuki_ornament/tanuki_body` / D12；`hair/back_hair` / D14；`hair/bangs` / D84；`head_accessories/tanuki_ornament/tanuki_body` / D85.5。图层名及UUID见report.md。

处理：同一tanuki_body保留D12完整后主体，新增D85.5普通下颌前分片和其原生接合蒙版，只显露原图下颌。分片在发铃D85之后、双爪D86/D87之前；已用edit_occlusion同步。

最终看图：下颌前不再露出错误补全发冠，完整发根及下颌底形均保留，逻辑part和共同运动未改变。头顶采用同坐标灰度图核查。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R13-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R13-comparison.png)。

### R14 — 右辫深度分界：已修复

相关part与实际深度：`hair/braid_right` / D13；`hair/back_hair` / D14；`hair/braid_right` / D57。图层名及UUID见report.md。

处理：上游预先标注的D13/D57分片沿原图前景发束曲面重新分界；后根延至y586，前片在y580–586搭接。清除D57中性白外边，未删隐藏辫根；已用edit_occlusion同步区域。

最终看图：暴露的y502水平截边已消除，整辫联合独显连续；前辫仍在胸肩前、右耳罩后，前后发圈职责保留。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R14-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R14-comparison.png)。

补充：[联合完整右辫与组装](repair-01-evidence/final-audit/R14-logical-complete-and-assembly.png)。

### R15 — 右眼形体、睫毛与虹膜：已修复

相关part与实际深度：`face/eyes/eye_right/sclera` / D66；`face/eyes/eye_right/iris` / D68；`face/eyes/eye_right/highlight` / D70；`face/eyes/eye_right/upper_eyelid` / D72；`face/eyes/eye_right/eyelid_crease` / D74。图层名及UUID见report.md。

处理：在生成眼部上按本侧原图修睑缘、睫尖、眼褶、眼白开口与虹膜纹路；清除高光层的眼白矩形和虹膜残像。复检主亮斑偏小后，只取本侧原图孤立亮斑在原坐标修正。

最终看图：原尺寸并排的眼形、睫尖、虹膜和反光接近原图；睫毛直接压眼白，没有人为间隔。完整虹膜隐藏上部及暗边保留，三眼内层共用开口检查通过。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R15-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R15-comparison.png)。

补充：[双眼1倍并排](repair-01-evidence/final-audit/eyes1x-comparison.png)。

### R16 — 左眼形体、睫毛与虹膜：已修复

相关part与实际深度：`face/eyes/eye_left/sclera` / D65；`face/eyes/eye_left/iris` / D67；`face/eyes/eye_left/highlight` / D69；`face/eyes/eye_left/upper_eyelid` / D71；`face/eyes/eye_left/eyelid_crease` / D73。图层名及UUID见report.md。

处理：按左侧原图修上睑睫尖、外眼角、眼褶、虹膜纹路和反光，并续接上睑本件小圆帽。复检发现主高光偏左上，已清除旧亮斑，仅在本侧真实位置取样亮斑；剔除取样选区里的孤立暗红纹路。

最终看图：逐眼1倍对照及五层四状态检查通过，左侧独有眼形和反光位置保留；高光层只含亮斑，不借入眼白或虹膜边，完整纹理和暗边保留。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R16-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R16-comparison.png)。

补充：[双眼1倍并排](repair-01-evidence/final-audit/eyes1x-comparison.png)。

### R17 — 右米色后腕环：已修复

相关part与实际深度：`arms/arm_right/bracelet_cream_back` / D29；`arms/arm_right/bracelet_cream_front` / D52。图层名及UUID见report.md。

处理：后弧按本件三色控制重生成，随后沿实际完整圆弧一笔一笔续画闭合棕灰描边和圆端，接顺自身管状体积；前环归属未动。

最终看图：完整后环描线连续、端部无叉；默认显露回转与前环材质和轮廓接顺。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R17-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R17-comparison.png)。

### R18 — 粉色踝环回转：已修复

相关part与实际深度：`legs/leg_right/anklet_back` / D11；`legs/leg_right/anklet_front` / D90。图层名及UUID见report.md。

处理：用本件三色控制及中性灰输入重新生成左回转，绿色区域输出透明，米色弧完全排除在生图输入外。结果按原尺寸缩小配准，并将下回转平滑配准到当前腿缘；保留上部／右侧原生成画面。第二次生成未返回图片，改在首张成功画面上用原图本件取色和Krita原生开放笔触续画短斜弧、体积与细描线。去掉与新斜弧重复的旧圆帽，沿完整内缘续线形成唯一端部，再增加约1像素本件搭接接入前环。原生蒙版只控制实际腿／前环接合，底层完整纹理保留。

最终看图：完整后粉弧现为连续的同一管状部件，端部闭合，扁钝帽、叉口、重复端头和多余硬亮斑均已消除；外缘、内缘及自身明暗接顺。默认回转为低而顺滑的斜弧，接入前环没有空口、台阶或突然断线。独显、隐藏上层、整图及1倍并排自检通过。米色弧原生像素保护核对通过，腿、铃及前环像素没有借入本层。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R18-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R18-comparison.png)。

补充：[完整两弧本件材质](repair-01-evidence/final-audit/R18-own-material-only.png)；[原尺寸并排](repair-01-evidence/final-audit/R18-one-to-one-gray.png)；[米色原生像素保护核对](repair-01-evidence/final-audit/cream-preservation-check.json)。当前局部对照采用灰度替代被拦截的彩色方式。

### R19 — 右红晕：已修复

相关part与实际深度：`face/blush_right` / D77。图层名及UUID见report.md。

处理：保留本件三色生成的弥散红底，按右侧原图独立修六条细线；本轮用Airbrush补底色、Basic-2 Opacity续细线心和paintLine压感尾端，右侧各线依原参考延至约y496–498等范围，最后局部原生Gaussian blur 0.5像素柔化。

最终看图：紧圆团、粗深线和明显短尾消除，红底、细线排列长短及软边在1倍逐侧并排中接近原图。仍有细微浓淡差异，按本步不追求逐像素的标准通过；红晕层无脸皮或头发像素。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R19-R20-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R19-R20-comparison.png)。

补充：[红晕逐侧1倍并排](repair-01-evidence/final-audit/blush1x-comparison.png)。

### R20 — 左红晕：已修复

相关part与实际深度：`face/blush_left` / D76。图层名及UUID见report.md。

处理：保留左侧独立生成红底，按左侧参考修六条细线的线心、压力尾端和底色，尾端分别延至约y484–488，局部原生0.5像素Gaussian blur柔化。没有镜像右侧线群或复制脸皮。

最终看图：粗线、硬圆团及短尾消除，左侧独有的细线长短、排列和弥散底色保留，1倍并排与四状态复核通过；细微浓淡差异不再构成原review所列问题。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R19-R20-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R19-R20-comparison.png)。

补充：[红晕逐侧1倍并排](repair-01-evidence/final-audit/blush1x-comparison.png)。

### R21 — 左耳毛位置与尖簇：已修复

相关part与实际深度：`face/ears/ear_left/ear_interior` / D16；`face/ears/ear_left/ear_fur` / D18。图层名及UUID见report.md。

处理：局部生成并按本侧原图取样修毛簇位置、上缘和底端，清理多余碎尖浅边；沿右上斜边原生续画细线。保留完整毛根和原生耳开口。

最终看图：上缘位置、外侧尖簇与底部收尖已恢复，默认耳内不再有多余碎尖浅边；完整隐藏毛根保留。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R21-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R21-comparison.png)。

### R22 — 颈侧本件外轮廓：已修复

相关part与实际深度：`neck` / D22。图层名及UUID见report.md。

处理：撤回猜坐标造成的悬空线，从本件修前完整原画恢复颈部；沿实际alpha>128的两侧边界平滑续画棕色轮廓至隐藏区，未恢复下颌投影。

最终看图：完整颈侧棕色线与自身肤色边贴合连续，不再只有裸透明度边或悬空线；默认下颌和耳罩覆盖关系正常。生成轮廓与参考仍有约3像素的小幅形体差异，已记录。

证据：[四状态单件／隐藏上层](repair-01-evidence/final-audit/R22-states.png)；[同坐标整图局部对照](repair-01-evidence/final-audit/R22-comparison.png)。

## 自检新增并修复的问题

### self-check-right-palm-pinholes：已修复

`arms/arm_right/hand/palm`。右掌(394,1010)、(395,1011)两透明针孔，用本件(390,1010)肤色取样及原生Basic-5 Size 8px、opacity 1修复，外轮廓不受影响。

看图结果：完整独显无针孔，隐藏上层及默认组装的接色连续。

证据：[单件与隐藏上层](repair-01-evidence/final-audit/palm-pinholes-states.png)；[整图局部对照](repair-01-evidence/final-audit/palm-pinholes-comparison.png)。

### self-check-left-palm-wrist-projection：已修复

`arms/arm_left/hand/palm`。去掉由腕饰轮廓决定的三角投影残留，再以本件肤色原生Airbrush融接横色阶。alpha锁定、选区按本件轮廓内缩约3像素，保护外线。

看图结果：投影与色阶消除；掌自身边缘的窄桃色体积暗部及连续描线保留。

证据：[单件与隐藏上层](repair-01-evidence/continued-hand-left-02/left-palm-own-projection-states.png)；[整图局部对照](repair-01-evidence/continued-hand-left-02/left-palm-own-projection-comparison.png)。

此前自检还发现主高光位置偏差、粉弧清理误伤米色补全、猜坐标续线、线外离散点及耳毛碎尖，已撤回或按本件精确修复。本轮米色踝弧在粉弧配准前后保持逐字节不变。高光只取本侧孤立亮斑，没有借入眼白或虹膜残线。

## 结构变更与数据一致性

- 右辫D13/D57：上游预先标注的拆层。本次R14将旧y502水平界改为沿原图前景发束曲线的分界；后根延至y586，y580–586搭接。两片共同归属hair/braid_right，前辫仍在胸肩前、右耳罩后。旧y502–510搭接说明已失效。
- 骨盆D22.5/D33：首轮实际组装发现的拆层，本次沿用。髋肤后片在双腿后，白服前片、腿口线与完整上接帽盖在双腿前、torso后；共同归属pelvis，材料分界位于本件腿口线内。原生蒙版只控制帽盖默认接合。
- 狸饰D12/D85.5：本次修复R13新发现的拆层。D12保留完整后主体与下颌底形，D85.5保留完整下颌前缘及隐藏搭接，位于发铃D85之后、双爪D86/D87之前。共同归属head_accessories/tanuki_ornament/tanuki_body，原生蒙版仅控制下颌前缘显露，完整补全发根保留。

当前上游78终止ID与81深度区域覆盖当前工程。逻辑身份、共同运动与SVG未新增变动，已在[制作报告](report.md)列出81层名／UUID／区域／深度／拆层来源，以及34蒙版父层／UUID／控制区域／复用来源／启停证据。

## 原生控制及默认恢复

双眼每侧的眼白、虹膜、高光三层共用同一开合选区。实际将六个眼内开口关闭，眼内完整隐藏，再恢复默认睁眼；睫毛默认直接压在眼白上。四个口内蒙版默认共用空选区，停用后完整口内可见，再恢复闭嘴。34蒙版最终全部恢复原默认启用状态并保存。

证据：[控制检查](repair-01-evidence/final-audit/native-control-check.json)；[眼内关闭测试](repair-01-evidence/final-audit/eyes-native-closed-closeup.png)；[完整口内本件](repair-01-evidence/final-audit/mouth-complete-own-material.png)。以下表格列出父层、蒙版UUID、控制区域与启停证据，完整纹理保持在普通绘画层中。

## 保存与重开检查

保存后已实际关闭并重新打开正式KRA，81绘画层与34蒙版的顺序、名称、UUID、类型、默认显隐、透明度、混合模式及alpha lock一致。全画布raw绘画字节、蒙版选区字节与默认PNG像素均一致，重开未改写KRA。本轮报告及图集刷新没有修改工程像素。

- KRA SHA256：`499882b60ffc355e81be2e48816794de7e0a780fcb7ee85853190faf7141360f`
- PNG像素SHA256（QImage ARGB32／本机BGRA字节序）：`4c1e2010807309d0de01a71bed4a0e9a54e22417061eb9993e291ee983475613`

证据：[重开核对](repair-01-evidence/final-audit/reopen-check.json)；[保存前快照](repair-01-evidence/final-audit/before-reopen-snapshot.json)；[重开后快照](repair-01-evidence/final-audit/after-reopen-snapshot.json)；[重开默认图](repair-01-evidence/final-audit/after-reopen.png)。哈希只验证保存完整性，绘画结论来自看图。

## 本轮撤回尝试及恢复

第二次局部生图在输出阶段被拦截，没有返回图片，错误内容摘录记录在`raster-layering/step01/workspace/repair01/ankle-final/generation-v2-error.txt`，未将该次尝试写成成功生成。继续使用首张成功生成和本件原生笔修完成。造成平面感的两笔试修已撤回；清端帽时的保护区断言失败尝试未保存，并从保存点重开恢复。旧未完成视图另存工作区后关闭，最终只保留正式工程视图；随后按同一部件原始坐标恢复受保护像素并通过核对。

被拦截的`raster-layering/step01/repair-01-evidence/continued-ankle-final-03/default-and-full-pink-only.png`没有重复原彩色方式，改用缩小灰度局部成功检查，最终完整两弧彩色独显也成功读取。

全部22项及新增问题已通过。本轮仅D11后踝环画面和其原生接合蒙版改变，[其他80绘画层及33蒙版保留核对](repair-01-evidence/final-audit/continued-part-preservation.json)通过。当前没有持续工具故障或待修项。
