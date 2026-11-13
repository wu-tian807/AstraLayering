结论：需要修复

# 第一步独立 review 01

已在实际 KRA 中查完 **78 个逻辑 part、83 个普通绘画深度片**：逐片独显、逐片隐藏全部上层查看补全、5 个多深度 part 合并独显、整图与原图对照、眼睛原尺寸并排及接缝放大；5 个原生透明度蒙版均停用和启用查看。确认 **29 项返修问题**，详见 R1–R29。工程与分层输入未修改。

## 依据与检查范围

- 工程：`raster-layering/step01/character-depth.kra`，从指定文件重新打开独立 review 文档；本次所有独显、露出补全及 union 图均由该文档重新导出，未以已有报告中的图片替代。
- 主参考：`part-layering/references/standard.png`；依据正式 `raster-layering/step01/report.md`，胸肩、腰髋、白色临时连体服及素体使用 `part-layering/references/base-subject.png` 辅助。外衣由衣服管线承担，不将本步素体与原外衣的差异列作遗漏。
- 结构：已读取 `part-layering/groups.json`、`part-layering/occlusion.json` 及全部终止部件 SVG。75 个显式 part 加 3 个未再拆分的根组 neck/pelvis/tail，共 78 件；实际均存在。未把同 part 多深度片判为重复部件。
- 现有正式说明仅发现 `raster-layering/step01/report.md`；本目录没有已发布的正式 review / repair Markdown。workspace 中脚本、日志、旧图及暂存文件只用于了解历史，未作为完成依据。
- 显隐、深度、图层归属依据实际树；可见部件未挂透明度蒙版。5 个蒙版仅控制后腿带、后发圈、两小指及共享口内四件，启用时默认隐藏，停用后本件底图完整。
- 图像工具有时将透明 PNG 的全透明 RGB 显示成外围彩点；已另做黑底、灰底 alpha 合成核实，**不将这些全透明 RGB 彩点判为画面污点**。R11、R21、R27 均在正确 alpha 合成中确认。狸饰局部一次图片读取被拦截后，已改小局部灰度读取成功，无未恢复工具故障。
- 没有以 PSNR、相似度或像素误差数字决定通过；输入 SHA-256 只用于证明工程文件未改动。

## 框选与证据

所有框选由 `annotate_review_regions` 按已看图确认的原画布坐标生成，工具参考直接使用原 PNG，未移动、缩放或改写参考。工具返回的证据原在 workspace；本报告引用的副本已归档到 `review-evidence/independent-01/marks/`。局部显示对照仅统一倍率、加灰底便于正确显示 alpha；R21 显示为灰度，原坐标参考/当前与工具框选仍保留。

- [主参考区域框选](review-evidence/independent-01/marks/standard/marked.png)
- [素体接缝区域框选](review-evidence/independent-01/marks/base/marked.png)
- [躯干独显补全框选](review-evidence/independent-01/marks/torso/marked.png)
- [骨盆前片独显框选](review-evidence/independent-01/marks/pelvis/marked.png)
- [狸饰 union 独显框选](review-evidence/independent-01/marks/tanuki/marked.png)
- [全部问题坐标、图层与证据索引](review-evidence/independent-01/regions.json)
- [实际树及独立检查记录](review-evidence/independent-01/check.json)



放大对照：[双眼](review-evidence/independent-01/details/eyes-compare.png)；[左眼各层](review-evidence/independent-01/details/eye-left-layers.png)；[右眼各层](review-evidence/independent-01/details/eye-right-layers.png)；[双足](review-evidence/independent-01/details/feet-compare.png)；[膝腿](review-evidence/independent-01/details/legs-knees.png)。

## 确定要修的问题

坐标统一为原画布 `[x, y, width, height]`。先修部件自身污点、补全和描边，再修组装接缝与可见深度。每项修后需查看相应独显、隐藏上层补全及默认合成；所有部件保持独立身份。

### R1 — 左眼（画面右侧）：眼白残线、睫毛收笔与衔接

相关图层：`D65 | face/eyes/eye_left/sclera`；`D71 | face/eyes/eye_left/upper_eyelid`。

位置：`[726, 398, 83, 68]`。当前表现：画面右眼：眼白内残留斜向桃色线和硬折边，上睑内弧及眼尾收笔与参考不同，尾部有并行细线；需恢复原眼形及连体睫毛与眼白的干净衔接。

参考依据与确认方式：standard.png 同坐标的眼白是连续浅白面；上睑为有厚薄变化的一条连体线，眼尾细钩接进外眼角。独显 D65 能看到斜向桃色痕迹，D71 能看到尾部并线。

影响：改变眼开口轮廓，原尺寸能辨认多余细线和眼白接边，不能作为一致的眼睛交付。

修复方向：在 D65 内用本眼眼白材料修平斜线、桃色折边及硬接色；在 D71 按原图重接上睑内弧、睫尖和外眼尾，把多出的并行尾线收回同一笔形。逐层独显后再原尺寸并排检查。 保留：当前虹膜竖瞳、红紫到金橙层次、黄色下亮区、独立白高光和完整隐藏上虹膜。不要改眼睛位置或用缩放抵消偏差。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R1-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R1-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R1-comparison.png)。



### R2 — 右眼（画面左侧）：眼白残线、内侧双细尾

相关图层：`D66 | face/eyes/eye_right/sclera`；`D72 | face/eyes/eye_right/upper_eyelid`。

位置：`[607, 398, 81, 68]`。当前表现：画面左眼：眼白出现斜向浅色残线，上睑内侧多出双细尾、外眼尾轮廓及粗细变化与参考不符；需原尺寸恢复眼轮廓与连续收笔。

参考依据与确认方式：standard.png 的该眼开口、内端收尖及外眼尾是连贯笔形；D66 独显的斜向浅线和 D72 内侧分开的两条细尾不对应原图。

影响：内外眼角形状、眼白与睫毛连接及线的粗细变化发生偏差。

修复方向：先清理 D66 中并非眼白自身明暗的细斜痕，补成完整干净的眼白；再在 D72 还原原内端尖收笔和外眼角弧线，连接处以细笔接顺，避免尾线分叉。 保留：虹膜主体与高光位置、眼褶独立层和当前眼睛尺寸。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R2-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R2-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R2-comparison.png)。



### R3 — 左颊红晕（画面右侧）：红底成块、斜线渐隐改变

相关图层：`D76 | face/blush_left`。

位置：`[750, 458, 45, 36]`。当前表现：画面右颊红晕变成边界可辨的密集红底块，斜线长度和渐隐与原图弥散红晕不同；恢复红底的扩散、渐隐和原斜线。

参考依据与确认方式：standard.png 为弥散红底与细长浅红斜线，外缘没有当前这团可辨的圆角块边；D76 独显能确认红底和线同在本层。

影响：红晕面积、浓淡层次与表情特征改变，脸颊显出贴片感。

修复方向：仅在 D76 内按原图恢复红底的散开范围、逐渐融入肤色的边缘及斜线长短、间距和渐隐；用本件绘画颜色和 alpha 修画，不增加透见蒙版。 保留：红底和斜线仍作为一个 blush part，不把它们转入脸底。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R3-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R3-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R3-comparison.png)。



### R4 — 右颊红晕（画面左侧）：浅肤色椭圆罩片

相关图层：`D77 | face/blush_right`。

位置：`[620, 458, 48, 46]`。当前表现：画面左颊红晕带大片浅肤色椭圆底，红色底变弱且外缘成圆斑；去掉肤色罩片，补回原图弥散红底及斜线。

参考依据与确认方式：standard.png 此处是偏红的弥散底与斜线；D77 独显及灰底合成都能看到当前大片淡肤色圆斑。

影响：本应为红色的表情底被肤色罩片稀释，椭圆边界在原尺寸可辨。

修复方向：清掉本件内罩住脸底的浅肤色椭圆材料，按原图补回红色底和细斜线并自然融边；保持其单独 alpha，不能依靠降低整层浓度掩盖色块。 保留：完整红晕范围和独立表情控制；脸底保持不含红晕。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R4-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R4-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R4-comparison.png)。



### R5 — 鼻部：鼻底小点过浅

相关图层：`D75 | face/nose`。

位置：`[698, 458, 19, 22]`。当前表现：鼻底深棕小点被浅化至近肤色，原图清晰的小点笔触及红色鼻头的层次未保留。

参考依据与确认方式：standard.png 鼻底约 x707、y475 有明确的深棕小点，鼻头红色与底点的层次可辨；当前该点近肤色。

影响：原图的小鼻点特征在原尺寸近乎消失。

修复方向：在 D75 内按原位置、原尺寸补回深棕小点的尖收笔，并恢复鼻头红色到点色的自然过渡。 保留：当前鼻部位置和小件范围，不添额外橙色短条或新的鼻梁线。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R5-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R5-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R5-comparison.png)。



### R6 — 闭嘴：短唇线被浅化、收笔简化

相关图层：`D78 | face/mouth/lower_lip`；`D79 | face/mouth/upper_lip`。

位置：`[692, 489, 33, 34]`。当前表现：原图短棕唇线的深色中央和两端收笔被简化为浅色等粗小弧；按原尺寸恢复嘴形、深浅和短收笔。

参考依据与确认方式：standard.png 的小嘴中央更深，两端是短而有转折的收笔；当前合成是浅色、近等粗的小弧。

影响：嘴形特征和原图的细小线条层次减弱。

修复方向：在 D79/D78 的本件材料中恢复原唇线的短钩、中央深色和端部细收笔，融顺唇片与脸底；闭口合成仅保留一份唇线。 保留：上下唇独立归属和口内四件的共享显隐蒙版，不把口内件并入唇层。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R6-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R6-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R6-comparison.png)。



### R7 — 左手（画面右侧）：连续描边和指甲细节丢失

相关图层：`D42 | arms/arm_left/hand/thumb`；`D44 | arms/arm_left/hand/index_finger`；`D46 | arms/arm_left/hand/palm`；`D40 | arms/arm_left/hand/middle_finger`。

位置：`[999, 1018, 155, 100]`。当前表现：画面右手外描边尤其拇指由连续深棕线变成断续浅点线，指尖及指甲轮廓被圆化、浅化；应逐件补回原图连续轮廓和细节。

参考依据与确认方式：standard.png 拇指两侧、掌缘与指腹下边为连续深棕线，指甲有明确转角与浅深边；当前拇指边缘为浅色点线，指甲边被圆化。

影响：手的外轮廓不干净，末端形状及手部立体细节不符合原图。

修复方向：分别在 D42、D44、D46、D40 上续画本件外描边及指甲线，按原图保留粗细、曲率和指尖收笔，清除点状边缘。用本件自身肤色补画线内明暗。 保留：各指完整隐藏根部、现有位置和独立层；不能把邻指轮廓或腕饰投影取样进来。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R7-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R7-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R7-comparison.png)。



### R8 — 右手（画面左侧）：点线轮廓、断粗线与指甲浅化

相关图层：`D43 | arms/arm_right/hand/thumb`；`D45 | arms/arm_right/hand/index_finger`；`D47 | arms/arm_right/hand/palm`；`D41 | arms/arm_right/hand/middle_finger`。

位置：`[252, 1012, 153, 106]`。当前表现：画面左手拇指外侧为断续点线，食指外线断粗且指甲、指尖收笔被浅化；恢复原图完整外描边及手部结构笔触。

参考依据与确认方式：standard.png 拇指外侧与食指下边是连续深色笔形；D43 独显能见点线外侧，D45 的线在根部附近断粗，合成的指甲层次明显减弱。

影响：外线断续、手指厚度感和指甲转角变化在原尺寸可辨。

修复方向：在各所属绘画层逐段恢复原深棕外线、指甲边线和尖收笔；在修画线后检查原 alpha 外缘，不要以整件 alpha 裁切削薄手指。 保留：完整指体、隐藏根部和原比例；掌与各指继续独立。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R8-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R8-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R8-comparison.png)。



### R9 — 左手（画面右侧）：掌指接口台阶与杂线

相关图层：`D42 | arms/arm_left/hand/thumb`；`D44 | arms/arm_left/hand/index_finger`；`D46 | arms/arm_left/hand/palm`。

位置：`[1032, 1004, 53, 75]`。当前表现：画面右手掌指连接：上侧掌片突尖后突然收断，下侧虎口与指根出现台阶、肤色硬边和多余短线；需各件同部件材料接顺，保持独立归属。

参考依据与确认方式：standard.png 掌背至食指上侧平顺，下虎口直接接指根；当前 D46 掌片上尖突在 D44 接边处收断，下侧有短线和小台阶。

影响：连接处看得出分件，且多余小线把连续皮肤画成拼片。

修复方向：在掌、食指、拇指各自层内把搭接边补成同肤色的连续曲面，重接掌背外线和虎口内线；清掉不属于本件结构的短线。必要时微调现有普通深度搭接边界，再用画笔接色。 保留：原图真实指缝与虎口，不扩大掌片去覆盖各整根手指。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R9-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R9-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R9-comparison.png)。



### R10 — 右手（画面左侧）：食指掌根断线、凹口与色阶

相关图层：`D43 | arms/arm_right/hand/thumb`；`D45 | arms/arm_right/hand/index_finger`；`D47 | arms/arm_right/hand/palm`。

位置：`[337, 998, 45, 71]`。当前表现：画面左手掌指连接：食指底线在掌根截断，掌片短线和指根轮廓叠出凹口、双线与色块接边；按原图顺滑虎口、掌背线重接。

参考依据与确认方式：standard.png 此处掌背、指根和虎口是连续轮廓；当前食指底线在掌片边界突然停止，邻近短线叠成小凹口和双线。

影响：原图同一皮肤面的衔接出现硬边、断口与多线。

修复方向：在 D45/D47/D43 内分别修自己的根部材料，将原掌背曲线与虎口弧线续接；消除掌指色差和重复小线。独显确认本件不含邻指线，再看合成。 保留：真实指缝、完整隐藏根和各指身份。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R10-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R10-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R10-comparison.png)。



### R11 — 右中指（画面左侧）：白色点状杂质

相关图层：`D41 | arms/arm_right/hand/middle_finger`。

位置：`[262, 1040, 83, 37]`。当前表现：画面左侧中指粉橙暗面出现一串原图没有的白色点状杂质；清除杂点并恢复原图平顺暗面和连续下缘线。

参考依据与确认方式：standard.png 的指腹暗面是干净粉橙色，当前 D41 独显与合成均有一串浅白小点。已在灰底 alpha 合成中确认这些是可见像素。

影响：部件自身不干净，白点破坏原图平顺的暗面。

修复方向：在 D41 内局部取本中指自身暗面颜色或同件生成笔触修去白点，恢复平顺粉橙过渡及原下缘深色线。 保留：完整中指外形和隐藏根，不恢复邻指采样条带。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R11-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R11-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R11-comparison.png)。



### R12 — 右腕粉环前段（画面左侧）：端头转折被圆化

相关图层：`D49 | arms/arm_right/bracelet_pink_front`。

位置：`[369, 968, 61, 72]`。当前表现：画面左腕粉环前段下端由原图有斜切转折的带端简化为圆头，深色外描边减弱；恢复原图端头转折、轮廓粗细和亮暗条带。

参考依据与确认方式：standard.png 粉环下端有带厚度的斜切、转折和深色外边，D49 当前端部变成圆头，外边和条带层次偏弱。

影响：原图端头形状特征与环带厚度感被简化。

修复方向：在 D49 上按原图恢复下端斜切转角、厚度边和亮暗条带，沿整段接回原轮廓粗细，不改成均匀圆弧胶条。 保留：前后粉环独立层与夹腕关系；不把环带投影画入掌腕。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R12-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R12-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R12-comparison.png)。



### R13 — 左上臂—前臂（画面右侧）：肤色硬接边和肘缘台阶

相关图层：`D25 | arms/arm_left/upper_arm`；`D31 | arms/arm_left/forearm`。

位置：`[872, 786, 163, 245]`。当前表现：画面右臂：前臂帽盖与上臂之间存在斜向硬肤色接边，肘外侧有小台阶和线宽变化，前臂外描边被浅化；重画自身过渡并按原图续接外线。

参考依据与确认方式：base-subject.png 同处为连续手臂；D31 独显能看到帽盖截边，隐藏上层后的合成在肘处有斜肤色硬边、外缘小折点。前臂外线也比 standard.png 的可见外线浅细。

影响：原尺寸能看出上下臂拼接，轮廓和明暗连续性不达标。

修复方向：在 D25/D31 的自身皮肤内修齐搭接轮廓，接续外描边；将帽盖处色阶以本件画笔过渡到上臂自身明暗。若改搭接范围，同步保持完整帽盖，不用透明度蒙版融合。 保留：原手臂位置、体积和被腕饰遮住的完整腕端；原外衣的投影不应贴回素体。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R13-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R13-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R13-comparison.png)。



### R14 — 右上臂—前臂（画面左侧）：接色与描边突变

相关图层：`D26 | arms/arm_right/upper_arm`；`D32 | arms/arm_right/forearm`。

位置：`[365, 791, 182, 243]`。当前表现：画面左臂：上臂前臂接边有肤色层次突变和细微外缘折点，前臂外轮廓比参考浅细；恢复同肤色连续体积与连续描边。

参考依据与确认方式：base-subject.png 此段自身肤色连续；当前上下臂交界的明暗突然换层，外缘有细折点。standard.png 可见前臂的深色外线没有当前这种浅细变化。

影响：上下臂接边和线宽变化可辨，前臂轮廓特征减弱。

修复方向：在 D26/D32 内以各自肤色续画帽盖搭接和明暗，将接头两端的外线接成原曲率、原粗细。 保留：两段完整隐藏连接余量及各自独立层，不用整块肤色贴片或蒙版遮接缝。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R14-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R14-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R14-comparison.png)。



### R15 — 胸片—躯干左侧（画面左侧）：外缘台阶、结构双线

相关图层：`D34 | body/torso`；`D35 | body/breast`。

位置：`[587, 744, 60, 76]`。当前表现：画面左胸下：胸片外边突向左后突然回收接躯干，形成原图没有的白色台阶；服装结构线局部双线、错接。重接轮廓和同一条侧线。

参考依据与确认方式：base-subject.png 的胸腰外边和服装斜线连续；当前胸片在辫尾后突出一块白边后突然回收，邻近侧线双出。

影响：形成明确的外轮廓台阶和拼接线，改变胸廓至腰的结构。

修复方向：在 D35 与 D34 各自区域内重画相接外边及白布明暗，接成原曲线；侧结构线只保留对应的一条，并在双方层上续笔接顺。 保留：胸部仍单独成件，躯干在胸片后完整，不合并胸与躯干。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R15-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R15-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R15-comparison.png)。



### R16 — 胸片—躯干右侧（画面右侧）：外缘台阶、结构断线

相关图层：`D34 | body/torso`；`D35 | body/breast`。

位置：`[774, 744, 58, 91]`。当前表现：画面右胸下：胸片至躯干外边有明显台阶，斜结构线跨分件后断开并改变走向、粗细；恢复原图连续边线与体积过渡。

参考依据与确认方式：base-subject.png 同处外边连续，斜线顺着胸腰走；当前胸片末端为突出的白边，斜线到躯干后出现可见空档并换走向。

影响：外轮廓、线条与胸腰明暗都能看出分件。

修复方向：修齐 D35/D34 交界处的外轮廓并恢复同一条斜结构线，接回原粗细与走势；用自身布面笔触消除接边色差。 保留：各件完整底图和合理胸部体积，不能削掉胸片来藏台阶。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R16-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R16-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R16-comparison.png)。



### R17 — 躯干—骨盆左腰线（画面左侧）：断线、错接

相关图层：`D34 | body/torso`；`D33 | pelvis | front`。

位置：`[633, 876, 29, 39]`。当前表现：画面左腰髋接线：原图连续白服侧线在分件交界变成两段断线，接头错位；需同材质笔触接线并消除硬边。

参考依据与确认方式：base-subject.png 的左侧白服结构线连贯；当前约 y891 附近分成两段，端点错位。

影响：同一条原图结构线在原尺寸断开。

修复方向：在 D34/D33 的搭接范围内按原图接回曲线，让两端走向、粗细和颜色一致，并修掉其周围的硬边。 保留：骨盆前后深度分片与完整白服材料，不另添腰线或接缝蒙版。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R17-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R17-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R17-comparison.png)。



### R18 — 躯干—骨盆右腰线（画面右侧）：折点、线宽突变

相关图层：`D34 | body/torso`；`D33 | pelvis | front`。

位置：`[761, 877, 35, 43]`。当前表现：画面右腰髋接线：原图平顺曲线在交界折成台阶，线宽及走向突变；重接原曲线和明暗过渡。

参考依据与确认方式：base-subject.png 的右侧线为连续平顺曲线；当前约 y888 处出现接片折点和宽度变化。

影响：平顺腰线被台阶化，组装拼接可辨。

修复方向：在 D34/D33 各自布面上重接原曲线，融顺线周白布明暗，必要时移动现有材料分片的接边到连续笔触内。 保留：原腰髋轮廓、白服腿口和逻辑 pelvis 的完整 union。

证据：[工具框选](review-evidence/independent-01/marks/base/marked.png)；[同坐标参考](review-evidence/independent-01/marks/base/R18-reference.png)；[同坐标当前](review-evidence/independent-01/marks/base/R18-current.png)；[工具局部对照](review-evidence/independent-01/marks/base/R18-comparison.png)。



### R19 — 躯干上补全：矩形截口、肩带断边与短杂线

相关图层：`D34 | body/torso`。

位置：`[612, 589, 197, 68]`。当前表现：躯干上接补全独显：顶部多级矩形截边、肩根两侧垂直切口，肩带描边中断，锁骨下残留零碎水平短线。补成连续合理的上胸肩根与自身明暗，续画完整外边和服装线，清除杂线。

参考依据与确认方式：D34 从实际 KRA 独显可见多级矩形上边、肩根垂直切口、未接完肩带和横短线；groups.json 要求完整肩根、锁骨、胸廓承接底体。辅助参考给出自身胸肩材料和肩带走向，隐藏上缘不按照片臆造新颈部。

影响：本件独显呈拼片截口而不是干净完整胸肩，补全会在展开和运动时暴露。

修复方向：沿现有本件范围补画连续肩根、上胸自身肤色及完整肩带侧缘；修平矩形接色、清除零碎横线，接完已有的外轮廓和服装线。连接颈部处按原来的无缝皮肤关系处理，不增加横向安装线。 保留：躯干在胸部后完整，颈部保持独立，原参考中的锁骨笔触保留。

证据：[工具框选](review-evidence/independent-01/marks/torso/marked.png)；[同坐标参考](review-evidence/independent-01/marks/torso/R19-reference.png)；[同坐标当前](review-evidence/independent-01/marks/torso/R19-current.png)；[工具局部对照](review-evidence/independent-01/marks/torso/R19-comparison.png)。



### R20 — 躯干下补全：水平截边、白方片与软帽拼接

相关图层：`D34 | body/torso`。

位置：`[581, 905, 250, 71]`。当前表现：躯干下接补全独显：两侧以水平矩形断边终止，中间另接无轮廓的软圆帽，局部有白色方片和断线；需重画完整下腹帽盖与连续轮廓、同材质接色，不保留矩形拼接。

参考依据与确认方式：D34 独显的两侧在 y919 附近以水平截边结束，中部软圆帽没有把侧缘笔触续完，接处有白方片；SVG 的帽盖范围本身不是问题，问题是同件绘画未接顺。

影响：本件底部能直接看出矩形片与帽盖的拼接，轮廓与结构线不完整。

修复方向：保留上游完整帽盖范围，用本件布面笔触续接两侧到帽盖的形体、色彩和原外线，去掉白色方片与硬水平材料接边；结构线按同件走向补完，不再整块填色或继续裁短。 保留：完整下腹延续、肚脐和现有白服纹理；不能以骨盆遮住它作为修复完成的依据。

证据：[工具框选](review-evidence/independent-01/marks/torso/marked.png)；[同坐标参考](review-evidence/independent-01/marks/torso/R20-reference.png)；[同坐标当前](review-evidence/independent-01/marks/torso/R20-current.png)；[工具局部对照](review-evidence/independent-01/marks/torso/R20-comparison.png)。



### R21 — 狸饰下颌前片：孤立深色点、短竖线

相关图层：`D85.5 | head_accessories/tanuki_ornament/tanuki_body | front`。

位置：`[675, 206, 72, 29]`。当前表现：狸饰前后片合并独显：下颌描边下方约x729、y222存在离散深色点，局部另有短竖线；该处在参考属头发，不属狸饰。只清除本件孤点与杂线，保留完整下颌和后发独立内容。

参考依据与确认方式：D85.5 独显及 D12+D85.5 union 下颌线外约 x729、y222 存在离散深点，局部还有短竖残笔；参考同坐标是角色头发，groups.json 明确狸主体不领取头发。局部已改用灰度较小视图确认。

影响：同件独显不干净，并在狸饰层留下本件下颌以外的残笔。

修复方向：仅在 D85.5 清理已经离开下颌描边的孤点与短残线，保留并接顺完整下颌；检查清理后的前片、后片和 union。无需把后发写入狸饰或删后发。 保留：下颌主描边、当前前后深度身份、D14 后发完整内容和双爪层。

证据：[工具框选](review-evidence/independent-01/marks/tanuki/marked.png)；[同坐标参考](review-evidence/independent-01/marks/tanuki/R21-reference.png)；[同坐标当前](review-evidence/independent-01/marks/tanuki/R21-current.png)；[工具局部对照](review-evidence/independent-01/marks/tanuki/R21-comparison.png)。



### R22 — 骨盆前片上补全：矩形灰短条与色阶

相关图层：`D33 | pelvis | front`。

位置：`[600, 859, 75, 47]`。当前表现：骨盆前片上补全独显：左上圆帽布面留有水平灰色短条和矩形色阶，圆弧边局部折断。修掉采样接边痕迹，沿本件现有圆帽恢复平顺同材质布面，不添加原图没有的腰线。

参考依据与确认方式：D33 独显在左上圆帽布面可见水平灰短条及矩形色阶，圆弧边局部折断；同件辅助参考可见布面平顺，补全应延续这一材料。此项不把顶帽存在或未加新腰线判为问题。

影响：本件上补全呈局部采样拼接痕迹，展开后会出现脏线与硬边。

修复方向：在 D33 内局部修去灰横条、矩形色阶和圆弧折口，以自己的白布明暗接顺原有顶帽；不改变上游范围，不新增参考没有的腰线。 保留：骨盆前后两个深度片、完整髋肤及白服腿口线。

证据：[工具框选](review-evidence/independent-01/marks/pelvis/marked.png)；[同坐标参考](review-evidence/independent-01/marks/pelvis/R22-reference.png)；[同坐标当前](review-evidence/independent-01/marks/pelvis/R22-current.png)；[工具局部对照](review-evidence/independent-01/marks/pelvis/R22-comparison.png)。



### R23 — 右腿与裸足（画面左侧）：描边浅化、趾甲方折丢失

相关图层：`D24 | legs/leg_right/leg`。

位置：`[538, 1090, 158, 917]`。当前表现：画面左裸腿、裸足：原图连续深棕外线被整体浅化、变细，足趾末端和方形趾甲被圆化成浅亮小框；恢复原外轮廓粗细、趾形及指甲转角和明暗。

参考依据与确认方式：standard.png 从可见大腿到裸足保留深棕外线及厚薄，趾甲有明显方折、趾尖也各有原转角；当前外线整体浅细，趾甲变为一组圆滑浅亮小框。膝和足部已额外放大并排查看。

影响：原图轮廓特征与趾部立体细节被平滑简化。

修复方向：在 D24 内逐段恢复可见外线的原深浅、粗细和收笔，按原图重画每个趾尖、趾缝及趾甲转角、亮暗边；隐藏腿根仍以本件皮肤完整延续。 保留：整腿单一 part、完整腿根与裸足，不把踝环投影写进腿层。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R23-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R23-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R23-comparison.png)。



### R24 — 左袜腿与足部（画面右侧）：外线、袜口和趾部简化

相关图层：`D23 | legs/leg_left/leg`。

位置：`[704, 1210, 164, 797]`。当前表现：画面右袜腿及足部：外描边与袜口收笔变弱，露趾结构和原图趾甲方折改为圆滑亮边；保留袜腿原曲线，恢复脚趾、趾缝、趾甲形状及深色线。

参考依据与确认方式：standard.png 袜腿外线、袜口曲线、趾缝和趾甲有清晰的深浅与方折；当前袜口和外线变弱，足趾被圆化、浅化。

影响：袜腿收笔及露趾结构与原图不一致。

修复方向：在 D23 内恢复原袜口弧线与外线粗细，重画趾缝、各趾尖和趾甲原转角与明暗，局部接色保持袜肤边清晰自然。 保留：袜子归腿本体、完整足部和同件腿根，前后大腿带另层保留。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R24-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R24-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R24-comparison.png)。



### R25 — 右踝后环（画面左侧）：过度外露的大后弧

相关图层：`D11 | legs/leg_right/anklet_back`；`D90 | legs/leg_right/anklet_front`。

位置：`[565, 1753, 91, 64]`。当前表现：画面左踝新增远伸出的粉色后环大弧及奶绿碎段，原图只露少量紧贴踝侧的回转边；重画后环范围并调整普通深度搭接，恢复原图夹踝关系。

参考依据与确认方式：standard.png 后环只在踝侧露少量紧贴回转边；当前 D11 在踝左上伸出明显粉色大弧及奶绿碎段。D11 独显和最终合成确认其来源，D90 前段在正确前侧。

影响：形状、位置及夹踝层级的可见结果与原图不符，看起来像新增环圈。

修复方向：重画 D11 的后弧位置、跨度与回转厚度，使其完整范围留在正确的踝后并只露原图踝侧量；调整 D11/D90 与腿的普通深度搭接。外露问题不能新增透明度蒙版消隐。 保留：两条后环完整底图、两条前环及铃的单一逻辑前片，腿与环之间保持独立。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R25-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R25-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R25-comparison.png)。



### R26 — 尾巴下部：圆弧、尖梢和明暗块位置变化

相关图层：`D0 | tail`。

位置：`[423, 1434, 291, 241]`。当前表现：尾巴下部原图连续大圆弧被加上凹口短尖，底缘尖梢走向变化；腿旁原粉色明暗被扩大的奶白尖条取代。恢复可见轮廓、尖端和原粉色明暗块位置。

参考依据与确认方式：standard.png 下端左侧是一段连贯大圆弧，底部尖梢数量和方向明确，腿边可见粉色亮暗层；当前加出凹口短尖，底缘尖梢改变，腿旁奶白尖条占据原粉色层。

影响：可见尾端形状特征及原图色块被改写，不只是整体画风差异。

修复方向：在 D0 内按同坐标原图恢复可见大圆弧、底缘尖梢方向和粉色明暗块位置，清掉新增凹口和扩大的奶白条；隐藏尾段接续自身发流和明暗。 保留：完整尾根、连续全尾及毛流细尖，不因恢复可见原形裁掉隐藏部分。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R26-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R26-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R26-comparison.png)。



### R27 — 后发左回环：外轮廓外的奶白残边

相关图层：`D14 | hair/back_hair`。

位置：`[516, 467, 54, 69]`。当前表现：画面左后发回环外轮廓外留有不透明奶白宽边，灰底和黑底可见；清理外缘背景残边，保留深棕轮廓和发束内部原浅色笔触。

参考依据与确认方式：D14 独显、灰底和黑底合成均可见深棕外轮廓之外的奶白宽边；standard.png 的外边是发色与深线，该浅边位于线外，不是发束内部高光。全透明 RGB 的预览彩点已另行排除。

影响：部件外缘不干净，换底色后显出抠图白边。

修复方向：仅修 D14 这一回环轮廓外的背景残边，保持真实外线和发色不变；用原生画笔/本件材料接好 alpha 边，不整圈缩小或磨掉尖梢。黑、灰两底复看。 保留：回环真实空隙、内部浅色发丝高光及连续发束。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R27-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R27-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R27-comparison.png)。



### R28 — 耳机带画面左接头：白端下移、红带外露

相关图层：`D15 | headphones/headband`。

位置：`[652, 536, 35, 48]`。当前表现：画面左颈侧连接端：原图可见白色接头被下移、缩小，当前位置露出大红色带块；恢复白色端头形状、位置及耳罩后的正确搭接。

参考依据与确认方式：standard.png 颈侧与耳罩之间露出一块有轮廓的白色接头；当前 D15 白端被下移缩小，原可见白端位置露出红色带块。

影响：接头形状、颜色和相对位置改变，耳罩与带体的连接不符合原图。

修复方向：在 D15 内按原图同坐标恢复白端范围、厚度边及位置，以普通深度让它在耳罩后正确露出；重画相关带体自身材料，避免用红块填掉接头。 保留：整条带体连通、另一接头及两个耳罩独立层，不改颈部形体来遮错误。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R28-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R28-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R28-comparison.png)。



### R29 — 耳机带画面右接头：白端缺量、接边透空

相关图层：`D15 | headphones/headband`。

位置：`[737, 542, 33, 44]`。当前表现：画面右颈侧连接端：原图白色接头区域变为透空/过窄白条和红粉带面，接头位置及遮挡关系偏离；按原图接头轮廓重新画并以深度接合。

参考依据与确认方式：standard.png 右颈侧接头是明确白色连接面；当前对应位置成透空/过窄白条及红粉带面。D15 独显能确认端部位置偏下。

影响：破坏原图耳罩—颈侧连接结构和正确可见量。

修复方向：在 D15 重新补画这一白色接头的原轮廓与自身明暗，接回连续带体并调整端头与耳罩后的深度覆盖，使原位置不透空。 保留：耳罩与颈部原位置、完整后带，不以可见部件蒙版补救。

证据：[工具框选](review-evidence/independent-01/marks/standard/marked.png)；[同坐标参考](review-evidence/independent-01/marks/standard/R29-reference.png)；[同坐标当前](review-evidence/independent-01/marks/standard/R29-current.png)；[工具局部对照](review-evidence/independent-01/marks/standard/R29-comparison.png)。



## 蒙版切换与多深度逻辑 part

5 个透明度蒙版全部查看停用、启用；8 个受控隐藏 part 的独显前后见下表。启用后完整本件被默认显隐控制隐藏；停用后未发现底图损坏。没有可见 part 蒙版，因此本次没有此类返修项。



| 蒙版所属部件 | 停用独显 | 启用独显 |
| --- | --- | --- |
| `legs/leg_left/thigh_band_back` | [完整](review-evidence/independent-01/solo/01-legs__leg_left__thigh_band_back.png) | [默认隐藏](review-evidence/independent-01/solo/01-legs__leg_left__thigh_band_back--mask-on.png) |
| `arms/arm_left/hand/little_finger` | [完整](review-evidence/independent-01/solo/28-arms__arm_left__hand__little_finger.png) | [默认隐藏](review-evidence/independent-01/solo/28-arms__arm_left__hand__little_finger--mask-on.png) |
| `arms/arm_right/hand/little_finger` | [完整](review-evidence/independent-01/solo/29-arms__arm_right__hand__little_finger.png) | [默认隐藏](review-evidence/independent-01/solo/29-arms__arm_right__hand__little_finger--mask-on.png) |
| `head_accessories/hair_tie_back` | [完整](review-evidence/independent-01/solo/45-head_accessories__hair_tie_back.png) | [默认隐藏](review-evidence/independent-01/solo/45-head_accessories__hair_tie_back--mask-on.png) |
| `face/mouth/mouth_interior` | [完整](review-evidence/independent-01/solo/50-face__mouth__mouth_interior.png) | [默认隐藏](review-evidence/independent-01/solo/50-face__mouth__mouth_interior--mask-on.png) |
| `face/mouth/tongue` | [完整](review-evidence/independent-01/solo/51-face__mouth__tongue.png) | [默认隐藏](review-evidence/independent-01/solo/51-face__mouth__tongue--mask-on.png) |
| `face/mouth/lower_teeth` | [完整](review-evidence/independent-01/solo/52-face__mouth__lower_teeth.png) | [默认隐藏](review-evidence/independent-01/solo/52-face__mouth__lower_teeth--mask-on.png) |
| `face/mouth/upper_teeth` | [完整](review-evidence/independent-01/solo/53-face__mouth__upper_teeth.png) | [默认隐藏](review-evidence/independent-01/solo/53-face__mouth__upper_teeth--mask-on.png) |

[默认整图灰底](review-evidence/independent-01/details/composite-default-gray.png)；[全部蒙版停用整图灰底](review-evidence/independent-01/details/composite-masks-off-gray.png)。

| 逻辑 part | 分片各自检查与 union 结论 | union 证据 |
| --- | --- | --- |
| `head_accessories/tanuki_ornament/tanuki_body` | D12 后体与 D85.5 下颌前缘分别查看；union 连通，R21 是本件前缘杂点，不是多片本身。 R21 | [同件合并独显](review-evidence/independent-01/union/head_accessories__tanuki_ornament__tanuki_body.png) |
| `hair/braid_right` | D13 后根与 D57 前辫分别查看，再合并检查 y580–586 接合及收束至散尾，未把两层当重复。 未列确定问题 | [同件合并独显](review-evidence/independent-01/union/hair__braid_right.png) |
| `pelvis` | D22.5 髋肤与 D33 白服分别查看，再合并检查两种材料及腿口；问题为 R17/R18 接线和 R22 局部接边痕迹。 R17、R18、R22 | [同件合并独显](review-evidence/independent-01/union/pelvis.png) |
| `face/eyebrows/eyebrow_left` | D80 与 D84.1 分别查看，再合并为完整左眉；线形连续，不将发前分片判为重复。 未列确定问题 | [同件合并独显](review-evidence/independent-01/union/face__eyebrows__eyebrow_left.png) |
| `face/eyebrows/eyebrow_right` | D81 与 D84.2 分别查看，再合并为完整右眉；线形连续，不将发前分片判为重复。 未列确定问题 | [同件合并独显](review-evidence/independent-01/union/face__eyebrows__eyebrow_right.png) |

## 全部部件检查覆盖

下表共 78 行，每行对应一个逻辑 part；多层行逐层提供独显和露出补全证据。**独显、隐藏全部上层查看补全、与默认整图对照均已看过**。未列问题表示本次没有足够明确的返修证据，不替代整体验收结论。浏览页只是检查图整理；眼、手、身体接缝、头发边缘、腿足和尾端另做了原尺寸或放大核查。

浏览页：[1](review-evidence/independent-01/details/sheet-01.png)；[2](review-evidence/independent-01/details/sheet-02.png)；[3](review-evidence/independent-01/details/sheet-03.png)；[4](review-evidence/independent-01/details/sheet-04.png)；[5](review-evidence/independent-01/details/sheet-05.png)；[6](review-evidence/independent-01/details/sheet-06.png)；[7](review-evidence/independent-01/details/sheet-07.png)；[8](review-evidence/independent-01/details/sheet-08.png)；[9](review-evidence/independent-01/details/sheet-09.png)；[10](review-evidence/independent-01/details/sheet-10.png)；[11](review-evidence/independent-01/details/sheet-11.png)。

| 逻辑 part | 实际层/深度 | 独显（蒙版停用） | 隐藏上层后补全 | 返修项 |
| --- | --- | --- | --- | --- |
| `tail` | D0 \| tail | [片1](review-evidence/independent-01/solo/00-tail.png) | [片1](review-evidence/independent-01/exposed/00-tail.png) | R26 |
| `legs/leg_left/thigh_band_back` | D10 \| legs/leg_left/thigh_band_back | [片1](review-evidence/independent-01/solo/01-legs__leg_left__thigh_band_back.png) | [片1](review-evidence/independent-01/exposed/01-legs__leg_left__thigh_band_back.png) | 未列确定问题 |
| `legs/leg_right/anklet_back` | D11 \| legs/leg_right/anklet_back | [片1](review-evidence/independent-01/solo/02-legs__leg_right__anklet_back.png) | [片1](review-evidence/independent-01/exposed/02-legs__leg_right__anklet_back.png) | R25 |
| `head_accessories/tanuki_ornament/tanuki_body` | D12 \| head_accessories/tanuki_ornament/tanuki_body \| back<br>D85.5 \| head_accessories/tanuki_ornament/tanuki_body \| front | [片1](review-evidence/independent-01/solo/03-head_accessories__tanuki_ornament__tanuki_body.png)<br>[片2](review-evidence/independent-01/solo/77-head_accessories__tanuki_ornament__tanuki_body.png) | [片1](review-evidence/independent-01/exposed/03-head_accessories__tanuki_ornament__tanuki_body.png)<br>[片2](review-evidence/independent-01/exposed/77-head_accessories__tanuki_ornament__tanuki_body.png) | R21 |
| `hair/braid_right` | D13 \| hair/braid_right \| back<br>D57 \| hair/braid_right \| front | [片1](review-evidence/independent-01/solo/04-hair__braid_right.png)<br>[片2](review-evidence/independent-01/solo/46-hair__braid_right.png) | [片1](review-evidence/independent-01/exposed/04-hair__braid_right.png)<br>[片2](review-evidence/independent-01/exposed/46-hair__braid_right.png) | 未列确定问题 |
| `hair/back_hair` | D14 \| hair/back_hair | [片1](review-evidence/independent-01/solo/05-hair__back_hair.png) | [片1](review-evidence/independent-01/exposed/05-hair__back_hair.png) | R27 |
| `headphones/headband` | D15 \| headphones/headband | [片1](review-evidence/independent-01/solo/06-headphones__headband.png) | [片1](review-evidence/independent-01/exposed/06-headphones__headband.png) | R28、R29 |
| `face/ears/ear_left/ear_interior` | D16 \| face/ears/ear_left/ear_interior | [片1](review-evidence/independent-01/solo/07-face__ears__ear_left__ear_interior.png) | [片1](review-evidence/independent-01/exposed/07-face__ears__ear_left__ear_interior.png) | 未列确定问题 |
| `face/ears/ear_right/ear_interior` | D17 \| face/ears/ear_right/ear_interior | [片1](review-evidence/independent-01/solo/08-face__ears__ear_right__ear_interior.png) | [片1](review-evidence/independent-01/exposed/08-face__ears__ear_right__ear_interior.png) | 未列确定问题 |
| `face/ears/ear_left/ear_fur` | D18 \| face/ears/ear_left/ear_fur | [片1](review-evidence/independent-01/solo/09-face__ears__ear_left__ear_fur.png) | [片1](review-evidence/independent-01/exposed/09-face__ears__ear_left__ear_fur.png) | 未列确定问题 |
| `face/ears/ear_right/ear_fur` | D19 \| face/ears/ear_right/ear_fur | [片1](review-evidence/independent-01/solo/10-face__ears__ear_right__ear_fur.png) | [片1](review-evidence/independent-01/exposed/10-face__ears__ear_right__ear_fur.png) | 未列确定问题 |
| `face/ears/ear_left/ear_shell` | D20 \| face/ears/ear_left/ear_shell | [片1](review-evidence/independent-01/solo/11-face__ears__ear_left__ear_shell.png) | [片1](review-evidence/independent-01/exposed/11-face__ears__ear_left__ear_shell.png) | 未列确定问题 |
| `face/ears/ear_right/ear_shell` | D21 \| face/ears/ear_right/ear_shell | [片1](review-evidence/independent-01/solo/12-face__ears__ear_right__ear_shell.png) | [片1](review-evidence/independent-01/exposed/12-face__ears__ear_right__ear_shell.png) | 未列确定问题 |
| `neck` | D22 \| neck | [片1](review-evidence/independent-01/solo/13-neck.png) | [片1](review-evidence/independent-01/exposed/13-neck.png) | 未列确定问题 |
| `pelvis` | D22.5 \| pelvis \| back<br>D33 \| pelvis \| front | [片1](review-evidence/independent-01/solo/14-pelvis.png)<br>[片2](review-evidence/independent-01/solo/25-pelvis.png) | [片1](review-evidence/independent-01/exposed/14-pelvis.png)<br>[片2](review-evidence/independent-01/exposed/25-pelvis.png) | R17、R18、R22 |
| `legs/leg_left/leg` | D23 \| legs/leg_left/leg | [片1](review-evidence/independent-01/solo/15-legs__leg_left__leg.png) | [片1](review-evidence/independent-01/exposed/15-legs__leg_left__leg.png) | R24 |
| `legs/leg_right/leg` | D24 \| legs/leg_right/leg | [片1](review-evidence/independent-01/solo/16-legs__leg_right__leg.png) | [片1](review-evidence/independent-01/exposed/16-legs__leg_right__leg.png) | R23 |
| `arms/arm_left/upper_arm` | D25 \| arms/arm_left/upper_arm | [片1](review-evidence/independent-01/solo/17-arms__arm_left__upper_arm.png) | [片1](review-evidence/independent-01/exposed/17-arms__arm_left__upper_arm.png) | R13 |
| `arms/arm_right/upper_arm` | D26 \| arms/arm_right/upper_arm | [片1](review-evidence/independent-01/solo/18-arms__arm_right__upper_arm.png) | [片1](review-evidence/independent-01/exposed/18-arms__arm_right__upper_arm.png) | R14 |
| `arms/arm_left/bracelet_green_back` | D27 \| arms/arm_left/bracelet_green_back | [片1](review-evidence/independent-01/solo/19-arms__arm_left__bracelet_green_back.png) | [片1](review-evidence/independent-01/exposed/19-arms__arm_left__bracelet_green_back.png) | 未列确定问题 |
| `arms/arm_left/bracelet_pink_back` | D28 \| arms/arm_left/bracelet_pink_back | [片1](review-evidence/independent-01/solo/20-arms__arm_left__bracelet_pink_back.png) | [片1](review-evidence/independent-01/exposed/20-arms__arm_left__bracelet_pink_back.png) | 未列确定问题 |
| `arms/arm_right/bracelet_cream_back` | D29 \| arms/arm_right/bracelet_cream_back | [片1](review-evidence/independent-01/solo/21-arms__arm_right__bracelet_cream_back.png) | [片1](review-evidence/independent-01/exposed/21-arms__arm_right__bracelet_cream_back.png) | 未列确定问题 |
| `arms/arm_right/bracelet_pink_back` | D30 \| arms/arm_right/bracelet_pink_back | [片1](review-evidence/independent-01/solo/22-arms__arm_right__bracelet_pink_back.png) | [片1](review-evidence/independent-01/exposed/22-arms__arm_right__bracelet_pink_back.png) | 未列确定问题 |
| `arms/arm_left/forearm` | D31 \| arms/arm_left/forearm | [片1](review-evidence/independent-01/solo/23-arms__arm_left__forearm.png) | [片1](review-evidence/independent-01/exposed/23-arms__arm_left__forearm.png) | R13 |
| `arms/arm_right/forearm` | D32 \| arms/arm_right/forearm | [片1](review-evidence/independent-01/solo/24-arms__arm_right__forearm.png) | [片1](review-evidence/independent-01/exposed/24-arms__arm_right__forearm.png) | R14 |
| `body/torso` | D34 \| body/torso | [片1](review-evidence/independent-01/solo/26-body__torso.png) | [片1](review-evidence/independent-01/exposed/26-body__torso.png) | R15、R16、R17、R18、R19、R20 |
| `body/breast` | D35 \| body/breast | [片1](review-evidence/independent-01/solo/27-body__breast.png) | [片1](review-evidence/independent-01/exposed/27-body__breast.png) | R15、R16 |
| `arms/arm_left/hand/little_finger` | D36 \| arms/arm_left/hand/little_finger | [片1](review-evidence/independent-01/solo/28-arms__arm_left__hand__little_finger.png) | [片1](review-evidence/independent-01/exposed/28-arms__arm_left__hand__little_finger.png) | 未列确定问题 |
| `arms/arm_right/hand/little_finger` | D37 \| arms/arm_right/hand/little_finger | [片1](review-evidence/independent-01/solo/29-arms__arm_right__hand__little_finger.png) | [片1](review-evidence/independent-01/exposed/29-arms__arm_right__hand__little_finger.png) | 未列确定问题 |
| `arms/arm_left/hand/ring_finger` | D38 \| arms/arm_left/hand/ring_finger | [片1](review-evidence/independent-01/solo/30-arms__arm_left__hand__ring_finger.png) | [片1](review-evidence/independent-01/exposed/30-arms__arm_left__hand__ring_finger.png) | 未列确定问题 |
| `arms/arm_right/hand/ring_finger` | D39 \| arms/arm_right/hand/ring_finger | [片1](review-evidence/independent-01/solo/31-arms__arm_right__hand__ring_finger.png) | [片1](review-evidence/independent-01/exposed/31-arms__arm_right__hand__ring_finger.png) | 未列确定问题 |
| `arms/arm_left/hand/middle_finger` | D40 \| arms/arm_left/hand/middle_finger | [片1](review-evidence/independent-01/solo/32-arms__arm_left__hand__middle_finger.png) | [片1](review-evidence/independent-01/exposed/32-arms__arm_left__hand__middle_finger.png) | R7 |
| `arms/arm_right/hand/middle_finger` | D41 \| arms/arm_right/hand/middle_finger | [片1](review-evidence/independent-01/solo/33-arms__arm_right__hand__middle_finger.png) | [片1](review-evidence/independent-01/exposed/33-arms__arm_right__hand__middle_finger.png) | R8、R11 |
| `arms/arm_left/hand/thumb` | D42 \| arms/arm_left/hand/thumb | [片1](review-evidence/independent-01/solo/34-arms__arm_left__hand__thumb.png) | [片1](review-evidence/independent-01/exposed/34-arms__arm_left__hand__thumb.png) | R7、R9 |
| `arms/arm_right/hand/thumb` | D43 \| arms/arm_right/hand/thumb | [片1](review-evidence/independent-01/solo/35-arms__arm_right__hand__thumb.png) | [片1](review-evidence/independent-01/exposed/35-arms__arm_right__hand__thumb.png) | R8、R10 |
| `arms/arm_left/hand/index_finger` | D44 \| arms/arm_left/hand/index_finger | [片1](review-evidence/independent-01/solo/36-arms__arm_left__hand__index_finger.png) | [片1](review-evidence/independent-01/exposed/36-arms__arm_left__hand__index_finger.png) | R7、R9 |
| `arms/arm_right/hand/index_finger` | D45 \| arms/arm_right/hand/index_finger | [片1](review-evidence/independent-01/solo/37-arms__arm_right__hand__index_finger.png) | [片1](review-evidence/independent-01/exposed/37-arms__arm_right__hand__index_finger.png) | R8、R10 |
| `arms/arm_left/hand/palm` | D46 \| arms/arm_left/hand/palm | [片1](review-evidence/independent-01/solo/38-arms__arm_left__hand__palm.png) | [片1](review-evidence/independent-01/exposed/38-arms__arm_left__hand__palm.png) | R7、R9 |
| `arms/arm_right/hand/palm` | D47 \| arms/arm_right/hand/palm | [片1](review-evidence/independent-01/solo/39-arms__arm_right__hand__palm.png) | [片1](review-evidence/independent-01/exposed/39-arms__arm_right__hand__palm.png) | R8、R10 |
| `arms/arm_left/bracelet_pink_front` | D48 \| arms/arm_left/bracelet_pink_front | [片1](review-evidence/independent-01/solo/40-arms__arm_left__bracelet_pink_front.png) | [片1](review-evidence/independent-01/exposed/40-arms__arm_left__bracelet_pink_front.png) | 未列确定问题 |
| `arms/arm_right/bracelet_pink_front` | D49 \| arms/arm_right/bracelet_pink_front | [片1](review-evidence/independent-01/solo/41-arms__arm_right__bracelet_pink_front.png) | [片1](review-evidence/independent-01/exposed/41-arms__arm_right__bracelet_pink_front.png) | R12 |
| `arms/arm_left/bell` | D50 \| arms/arm_left/bell | [片1](review-evidence/independent-01/solo/42-arms__arm_left__bell.png) | [片1](review-evidence/independent-01/exposed/42-arms__arm_left__bell.png) | 未列确定问题 |
| `arms/arm_left/bracelet_green_front` | D51 \| arms/arm_left/bracelet_green_front | [片1](review-evidence/independent-01/solo/43-arms__arm_left__bracelet_green_front.png) | [片1](review-evidence/independent-01/exposed/43-arms__arm_left__bracelet_green_front.png) | 未列确定问题 |
| `arms/arm_right/bracelet_cream_front` | D52 \| arms/arm_right/bracelet_cream_front | [片1](review-evidence/independent-01/solo/44-arms__arm_right__bracelet_cream_front.png) | [片1](review-evidence/independent-01/exposed/44-arms__arm_right__bracelet_cream_front.png) | 未列确定问题 |
| `head_accessories/hair_tie_back` | D56 \| head_accessories/hair_tie_back | [片1](review-evidence/independent-01/solo/45-head_accessories__hair_tie_back.png) | [片1](review-evidence/independent-01/exposed/45-head_accessories__hair_tie_back.png) | 未列确定问题 |
| `headphones/earcups/earcup_left` | D58 \| headphones/earcups/earcup_left | [片1](review-evidence/independent-01/solo/47-headphones__earcups__earcup_left.png) | [片1](review-evidence/independent-01/exposed/47-headphones__earcups__earcup_left.png) | 未列确定问题 |
| `headphones/earcups/earcup_right` | D59 \| headphones/earcups/earcup_right | [片1](review-evidence/independent-01/solo/48-headphones__earcups__earcup_right.png) | [片1](review-evidence/independent-01/exposed/48-headphones__earcups__earcup_right.png) | 未列确定问题 |
| `face/face_base` | D60 \| face/face_base | [片1](review-evidence/independent-01/solo/49-face__face_base.png) | [片1](review-evidence/independent-01/exposed/49-face__face_base.png) | 未列确定问题 |
| `face/mouth/mouth_interior` | D61 \| face/mouth/mouth_interior | [片1](review-evidence/independent-01/solo/50-face__mouth__mouth_interior.png) | [片1](review-evidence/independent-01/exposed/50-face__mouth__mouth_interior.png) | 未列确定问题 |
| `face/mouth/tongue` | D62 \| face/mouth/tongue | [片1](review-evidence/independent-01/solo/51-face__mouth__tongue.png) | [片1](review-evidence/independent-01/exposed/51-face__mouth__tongue.png) | 未列确定问题 |
| `face/mouth/lower_teeth` | D63 \| face/mouth/lower_teeth | [片1](review-evidence/independent-01/solo/52-face__mouth__lower_teeth.png) | [片1](review-evidence/independent-01/exposed/52-face__mouth__lower_teeth.png) | 未列确定问题 |
| `face/mouth/upper_teeth` | D64 \| face/mouth/upper_teeth | [片1](review-evidence/independent-01/solo/53-face__mouth__upper_teeth.png) | [片1](review-evidence/independent-01/exposed/53-face__mouth__upper_teeth.png) | 未列确定问题 |
| `face/eyes/eye_left/sclera` | D65 \| face/eyes/eye_left/sclera | [片1](review-evidence/independent-01/solo/54-face__eyes__eye_left__sclera.png) | [片1](review-evidence/independent-01/exposed/54-face__eyes__eye_left__sclera.png) | R1 |
| `face/eyes/eye_right/sclera` | D66 \| face/eyes/eye_right/sclera | [片1](review-evidence/independent-01/solo/55-face__eyes__eye_right__sclera.png) | [片1](review-evidence/independent-01/exposed/55-face__eyes__eye_right__sclera.png) | R2 |
| `face/eyes/eye_left/iris` | D67 \| face/eyes/eye_left/iris | [片1](review-evidence/independent-01/solo/56-face__eyes__eye_left__iris.png) | [片1](review-evidence/independent-01/exposed/56-face__eyes__eye_left__iris.png) | 未列确定问题 |
| `face/eyes/eye_right/iris` | D68 \| face/eyes/eye_right/iris | [片1](review-evidence/independent-01/solo/57-face__eyes__eye_right__iris.png) | [片1](review-evidence/independent-01/exposed/57-face__eyes__eye_right__iris.png) | 未列确定问题 |
| `face/eyes/eye_left/highlight` | D69 \| face/eyes/eye_left/highlight | [片1](review-evidence/independent-01/solo/58-face__eyes__eye_left__highlight.png) | [片1](review-evidence/independent-01/exposed/58-face__eyes__eye_left__highlight.png) | 未列确定问题 |
| `face/eyes/eye_right/highlight` | D70 \| face/eyes/eye_right/highlight | [片1](review-evidence/independent-01/solo/59-face__eyes__eye_right__highlight.png) | [片1](review-evidence/independent-01/exposed/59-face__eyes__eye_right__highlight.png) | 未列确定问题 |
| `face/eyes/eye_left/upper_eyelid` | D71 \| face/eyes/eye_left/upper_eyelid | [片1](review-evidence/independent-01/solo/60-face__eyes__eye_left__upper_eyelid.png) | [片1](review-evidence/independent-01/exposed/60-face__eyes__eye_left__upper_eyelid.png) | R1 |
| `face/eyes/eye_right/upper_eyelid` | D72 \| face/eyes/eye_right/upper_eyelid | [片1](review-evidence/independent-01/solo/61-face__eyes__eye_right__upper_eyelid.png) | [片1](review-evidence/independent-01/exposed/61-face__eyes__eye_right__upper_eyelid.png) | R2 |
| `face/eyes/eye_left/eyelid_crease` | D73 \| face/eyes/eye_left/eyelid_crease | [片1](review-evidence/independent-01/solo/62-face__eyes__eye_left__eyelid_crease.png) | [片1](review-evidence/independent-01/exposed/62-face__eyes__eye_left__eyelid_crease.png) | 未列确定问题 |
| `face/eyes/eye_right/eyelid_crease` | D74 \| face/eyes/eye_right/eyelid_crease | [片1](review-evidence/independent-01/solo/63-face__eyes__eye_right__eyelid_crease.png) | [片1](review-evidence/independent-01/exposed/63-face__eyes__eye_right__eyelid_crease.png) | 未列确定问题 |
| `face/nose` | D75 \| face/nose | [片1](review-evidence/independent-01/solo/64-face__nose.png) | [片1](review-evidence/independent-01/exposed/64-face__nose.png) | R5 |
| `face/blush_left` | D76 \| face/blush_left | [片1](review-evidence/independent-01/solo/65-face__blush_left.png) | [片1](review-evidence/independent-01/exposed/65-face__blush_left.png) | R3 |
| `face/blush_right` | D77 \| face/blush_right | [片1](review-evidence/independent-01/solo/66-face__blush_right.png) | [片1](review-evidence/independent-01/exposed/66-face__blush_right.png) | R4 |
| `face/mouth/lower_lip` | D78 \| face/mouth/lower_lip | [片1](review-evidence/independent-01/solo/67-face__mouth__lower_lip.png) | [片1](review-evidence/independent-01/exposed/67-face__mouth__lower_lip.png) | R6 |
| `face/mouth/upper_lip` | D79 \| face/mouth/upper_lip | [片1](review-evidence/independent-01/solo/68-face__mouth__upper_lip.png) | [片1](review-evidence/independent-01/exposed/68-face__mouth__upper_lip.png) | R6 |
| `face/eyebrows/eyebrow_left` | D80 \| face/eyebrows/eyebrow_left \| back<br>D84.1 \| face/eyebrows/eyebrow_left \| front | [片1](review-evidence/independent-01/solo/69-face__eyebrows__eyebrow_left.png)<br>[片2](review-evidence/independent-01/solo/74-face__eyebrows__eyebrow_left.png) | [片1](review-evidence/independent-01/exposed/69-face__eyebrows__eyebrow_left.png)<br>[片2](review-evidence/independent-01/exposed/74-face__eyebrows__eyebrow_left.png) | 未列确定问题 |
| `face/eyebrows/eyebrow_right` | D81 \| face/eyebrows/eyebrow_right \| back<br>D84.2 \| face/eyebrows/eyebrow_right \| front | [片1](review-evidence/independent-01/solo/70-face__eyebrows__eyebrow_right.png)<br>[片2](review-evidence/independent-01/solo/75-face__eyebrows__eyebrow_right.png) | [片1](review-evidence/independent-01/exposed/70-face__eyebrows__eyebrow_right.png)<br>[片2](review-evidence/independent-01/exposed/75-face__eyebrows__eyebrow_right.png) | 未列确定问题 |
| `hair/side_hair/side_hair_left` | D82 \| hair/side_hair/side_hair_left | [片1](review-evidence/independent-01/solo/71-hair__side_hair__side_hair_left.png) | [片1](review-evidence/independent-01/exposed/71-hair__side_hair__side_hair_left.png) | 未列确定问题 |
| `hair/side_hair/side_hair_right` | D83 \| hair/side_hair/side_hair_right | [片1](review-evidence/independent-01/solo/72-hair__side_hair__side_hair_right.png) | [片1](review-evidence/independent-01/exposed/72-hair__side_hair__side_hair_right.png) | 未列确定问题 |
| `hair/bangs` | D84 \| hair/bangs | [片1](review-evidence/independent-01/solo/73-hair__bangs.png) | [片1](review-evidence/independent-01/exposed/73-hair__bangs.png) | 未列确定问题 |
| `head_accessories/hair_bell` | D85 \| head_accessories/hair_bell | [片1](review-evidence/independent-01/solo/76-head_accessories__hair_bell.png) | [片1](review-evidence/independent-01/exposed/76-head_accessories__hair_bell.png) | 未列确定问题 |
| `head_accessories/tanuki_ornament/paw/paw_left` | D86 \| head_accessories/tanuki_ornament/paw/paw_left | [片1](review-evidence/independent-01/solo/78-head_accessories__tanuki_ornament__paw__paw_left.png) | [片1](review-evidence/independent-01/exposed/78-head_accessories__tanuki_ornament__paw__paw_left.png) | 未列确定问题 |
| `head_accessories/tanuki_ornament/paw/paw_right` | D87 \| head_accessories/tanuki_ornament/paw/paw_right | [片1](review-evidence/independent-01/solo/79-head_accessories__tanuki_ornament__paw__paw_right.png) | [片1](review-evidence/independent-01/exposed/79-head_accessories__tanuki_ornament__paw__paw_right.png) | 未列确定问题 |
| `head_accessories/hair_tie_front` | D88 \| head_accessories/hair_tie_front | [片1](review-evidence/independent-01/solo/80-head_accessories__hair_tie_front.png) | [片1](review-evidence/independent-01/exposed/80-head_accessories__hair_tie_front.png) | 未列确定问题 |
| `legs/leg_left/thigh_band_front` | D89 \| legs/leg_left/thigh_band_front | [片1](review-evidence/independent-01/solo/81-legs__leg_left__thigh_band_front.png) | [片1](review-evidence/independent-01/exposed/81-legs__leg_left__thigh_band_front.png) | 未列确定问题 |
| `legs/leg_right/anklet_front` | D90 \| legs/leg_right/anklet_front | [片1](review-evidence/independent-01/solo/82-legs__leg_right__anklet_front.png) | [片1](review-evidence/independent-01/exposed/82-legs__leg_right__anklet_front.png) | R25 |

## 只读与交付记录

本次未修改或保存 KRA，未改 groups.json、occlusion.json 或任何部件 SVG。review 文档的临时显隐均恢复原状态。KRA 检查前后 SHA-256 相同：`c6ce19cd0522c47470eb1a0577b14cbb4393eb5ec7db679ac1e3370c142d760c`。此字节核查只验证只读处理，不替代看图结论。

报告仅写入 `raster-layering/step01/review-01.md.tmp`，不发布正式 review / repair 报告。引用图片与 JSON 均在 `raster-layering/step01/review-evidence/independent-01/`；脚本与未采纳的草稿留在 workspace。必要输入完整，Krita 导出成功，本次没有无法继续检查的阻塞。
