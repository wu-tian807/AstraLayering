结论：已修复

# repair 01 逐项处理结果

已修复 review-01 的R1–R29及额外前辫问题N1。继续沿用78逻辑part、85普通绘画深度片、5原生透明度蒙版和1共享口内组；完成全部部件独显、隐藏上层补全、多深度union、默认整图、眼睛原尺寸并排及接缝检查。画质以看图判断，不以像素误差或PSNR评分。

## 逐项结果

### R1 — 左眼（画面右侧）：眼白残线、睫毛收笔与衔接

已修复。在眼白所属层修净桃色斜痕和折边；上睑采用本眼原生笔触恢复厚薄、外眼角细钩及连体睫毛，清掉额外并线。虹膜、暗外圈、竖瞳、红紫到金橙层次及独立高光保留。

实际层：`D65 | face/eyes/eye_left/sclera` / `{6b8f98e3-272a-4807-8774-4a219b6812f5}` / 深度65；`D67 | face/eyes/eye_left/iris` / `{eae99bc1-fe42-40d9-8bc1-c077610d6d86}` / 深度67；`D69 | face/eyes/eye_left/highlight` / `{bb67c9fd-f337-4b8d-ad9a-8ab3190c595b}` / 深度69；`D71 | face/eyes/eye_left/upper_eyelid` / `{ae6d9e09-a249-45b6-8e3b-b7db6f39dfe0}` / 深度71。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R1/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R1/reference-compare.png)。

### R2 — 右眼（画面左侧）：眼白残线、内侧双细尾

已修复。清理本眼眼白浅斜线；恢复上睑内端尖收笔、外眼尾及连体睫毛，撤掉额外双细尾。眼睛位置和尺寸保持原坐标，虹膜与高光完整。

实际层：`D66 | face/eyes/eye_right/sclera` / `{eb30337c-5a23-4028-af35-6e96094fabc8}` / 深度66；`D68 | face/eyes/eye_right/iris` / `{338fcc39-a964-4c97-a3b3-16b60b7a3024}` / 深度68；`D70 | face/eyes/eye_right/highlight` / `{4473535e-3342-4b51-abb9-c2d8f0666128}` / 深度70；`D72 | face/eyes/eye_right/upper_eyelid` / `{c9dff7e7-54ed-4e72-9521-c6e675a7ff93}` / 深度72。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R2/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R2/reference-compare.png)。

### R3 — 左颊红晕（画面右侧）：红底成块、斜线渐隐改变

已修复。去掉块状红底，原生柔笔补回弥散红色底；最终在4倍局部画布逐笔续接细斜线，按原尺寸配准，端部渐隐且不变成硬矩形。

实际层：`D76 | face/blush_left` / `{5e74d9a3-a429-4d63-8f05-67f72cf9e047}` / 深度76。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R3/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R3/reference-compare.png)。

### R4 — 右颊红晕（画面左侧）：浅肤色椭圆罩片

已修复。去掉浅肤色椭圆罩片；本层只保留弥散红底和原方向、长短的细斜线，4倍原生绘画缩回后接顺渐隐，不把红晕转入脸底。

实际层：`D77 | face/blush_right` / `{591e43a4-4e29-4e9a-bf37-a56199a73562}` / 深度77。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R4/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R4/reference-compare.png)。

### R5 — 鼻部：鼻底小点过浅

已修复。补回原位置鼻底深棕小点的尖收笔，接顺鼻头红色至底点的层次；没有添加鼻梁线或橙色短条。

实际层：`D75 | face/nose` / `{9715a843-db7d-435a-a8e3-b32f2dc56a6f}` / 深度75。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R5/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R5/reference-compare.png)。

### R6 — 闭嘴：短唇线被浅化、收笔简化

已修复。恢复短棕唇线中央深色、两端短钩与细收笔，闭合合成仅有一份唇线；上下唇独立、共享口内组及四件纹理保留。

实际层：`D78 | face/mouth/lower_lip` / `{3c68fb33-ff72-4f7e-967b-5780418a7453}` / 深度78；`D79 | face/mouth/upper_lip` / `{94eedc57-8397-46d7-b4df-d7f7d56c87fa}` / 深度79。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R6/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R6/reference-compare.png)。

### R7 — 左手（画面右侧）：连续描边和指甲细节丢失

已修复。分别恢复左手拇指、食指、中指、掌的连续深棕外线、指尖转角和指甲亮暗边；明暗只取各件自身皮肤，完整隐藏根保留。

实际层：`D38 | arms/arm_left/hand/ring_finger` / `{d85bd8b0-a005-4c44-8336-c74b30be64a4}` / 深度38；`D40 | arms/arm_left/hand/middle_finger` / `{3fd8810e-8dde-4b15-b781-25d1dc9f5978}` / 深度40；`D42 | arms/arm_left/hand/thumb` / `{aba770e8-b3fe-461b-adae-4ee044d10e1d}` / 深度42；`D44 | arms/arm_left/hand/index_finger` / `{e49a2920-0265-4fec-bcfc-f03c59d3ec1d}` / 深度44；`D46 | arms/arm_left/hand/palm` / `{b3f5969e-8be8-4337-909f-e5918a92ff29}` / 深度46。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R7-R9/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R7-R9/reference-compare.png)。

### R8 — 右手（画面左侧）：点线轮廓、断粗线与指甲浅化

已修复。分别恢复右手外线和甲面细节，清掉点线及根部断粗；保持手指厚度、原曲率和收笔，不整件裁薄alpha。

实际层：`D39 | arms/arm_right/hand/ring_finger` / `{6ea2cb37-c639-4b2a-a4c2-08504d985757}` / 深度39；`D41 | arms/arm_right/hand/middle_finger` / `{0da3ede1-9370-48e6-80a5-69abb2cf3b15}` / 深度41；`D43 | arms/arm_right/hand/thumb` / `{00111c35-ef30-4cf9-b1a9-dbf57cc5138f}` / 深度43；`D45 | arms/arm_right/hand/index_finger` / `{3a056be8-c259-483b-ae9a-f71e159baa9b}` / 深度45；`D47 | arms/arm_right/hand/palm` / `{2d70aa71-52e9-4b36-975b-e1b7d74d1d14}` / 深度47。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/reference-compare.png)。

### R9 — 左手（画面右侧）：掌指接口台阶与杂线

已修复。掌背至食指和下虎口的搭接轮廓、皮肤明暗接顺，去掉非本件短线与突尖，真实指缝保留，各指与掌仍独立。

实际层：`D42 | arms/arm_left/hand/thumb` / `{aba770e8-b3fe-461b-adae-4ee044d10e1d}` / 深度42；`D44 | arms/arm_left/hand/index_finger` / `{e49a2920-0265-4fec-bcfc-f03c59d3ec1d}` / 深度44；`D46 | arms/arm_left/hand/palm` / `{b3f5969e-8be8-4337-909f-e5918a92ff29}` / 深度46。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R7-R9/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R7-R9/reference-compare.png)。

### R10 — 右手（画面左侧）：食指掌根断线、凹口与色阶

已修复。重接食指掌根、掌背和虎口曲线，消除凹口、重复短线、断线与色块接边；各件完整根部和真实指缝保留。

实际层：`D43 | arms/arm_right/hand/thumb` / `{00111c35-ef30-4cf9-b1a9-dbf57cc5138f}` / 深度43；`D45 | arms/arm_right/hand/index_finger` / `{3a056be8-c259-483b-ae9a-f71e159baa9b}` / 深度45；`D47 | arms/arm_right/hand/palm` / `{2d70aa71-52e9-4b36-975b-e1b7d74d1d14}` / 深度47。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/reference-compare.png)。

### R11 — 右中指（画面左侧）：白色点状杂质

已修复。在本中指暗面修掉可见白色杂点，续回粉橙过渡和连续下缘深线；没有采入邻指条带。

实际层：`D41 | arms/arm_right/hand/middle_finger` / `{0da3ede1-9370-48e6-80a5-69abb2cf3b15}` / 深度41。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R8-R10-R11/reference-compare.png)。

### R12 — 右腕粉环前段（画面左侧）：端头转折被圆化

已修复。恢复粉环前段下端的斜切转折、厚度边、深浅条带及原外描边，前后粉环仍独立夹腕。

实际层：`D49 | arms/arm_right/bracelet_pink_front` / `{9afff65b-5f91-4fd3-b9b7-84b246b41711}` / 深度49。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R12/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R12/reference-compare.png)。

### R13 — 左上臂—前臂（画面右侧）：肤色硬接边和肘缘台阶

已修复。上臂与前臂肘端的帽盖、肤色体积和外线连续，斜硬边和肘缘台阶去除；腕端完整，不贴回外衣或腕饰投影。

实际层：`D25 | arms/arm_left/upper_arm` / `{760efccd-6eb8-49fc-a996-1e95ce640f55}` / 深度25；`D31 | arms/arm_left/forearm` / `{c57a133b-41ed-4918-80de-a962b23c6b3c}` / 深度31。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R13/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R13/reference-compare.png)。

### R14 — 右上臂—前臂（画面左侧）：接色与描边突变

已修复。修顺上臂/前臂接头明暗和外缘，恢复前臂自身描边；最终自查又续接腕端帽盖粉橙明暗和缺失外线，按本件曲线保留原线宽与收笔。

实际层：`D26 | arms/arm_right/upper_arm` / `{b60f5bf9-dc78-43fc-9449-d586fffbb137}` / 深度26；`D32 | arms/arm_right/forearm` / `{1538e529-1abc-46ee-a1d4-8cb195bd6b1f}` / 深度32。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R14/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R14/reference-compare.png)。

### R15 — 胸片—躯干左侧（画面左侧）：外缘台阶、结构双线

已修复。胸片与躯干左侧的白边台阶、结构双线及接色清理；旧行配准外突局部修正，整条侧线连续，胸与躯干没有合并。

实际层：`D32.5 | body/torso | lower_mount` / `{46358100-0b1c-433a-a3da-f652464fcffd}` / 深度32.5；`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34；`D35 | body/breast` / `{1b76e69a-e317-4da3-a0fb-ff17ac74b107}` / 深度35。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R15/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R15/reference-compare.png)。

### R16 — 胸片—躯干右侧（画面右侧）：外缘台阶、结构断线

已修复。胸片至躯干右外缘、斜结构线恢复连续；非参考浅虚线清掉，中央白布接色也局部修顺，完整躯干仍在胸片后。

实际层：`D32.5 | body/torso | lower_mount` / `{46358100-0b1c-433a-a3da-f652464fcffd}` / 深度32.5；`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34；`D35 | body/breast` / `{1b76e69a-e317-4da3-a0fb-ff17ac74b107}` / 深度35。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R16/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R16/reference-compare.png)。

### R17 — 躯干—骨盆左腰线（画面左侧）：断线、错接

已修复。左腰线跨躯干/骨盆的错位端点接回原连续曲线，线周布面自然接色；未新增腰线或接缝蒙版。

实际层：`D32.5 | body/torso | lower_mount` / `{46358100-0b1c-433a-a3da-f652464fcffd}` / 深度32.5；`D33 | pelvis | front` / `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}` / 深度33；`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R17-R18/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R17-R18/reference-compare.png)。

### R18 — 躯干—骨盆右腰线（画面右侧）：折点、线宽突变

已修复。右腰线的折点、线宽突变和色阶修顺，按原曲率连接两件；骨盆前后片和完整腿口保留。

实际层：`D32.5 | body/torso | lower_mount` / `{46358100-0b1c-433a-a3da-f652464fcffd}` / 深度32.5；`D33 | pelvis | front` / `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}` / 深度33；`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R17-R18/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R17-R18/reference-compare.png)。

### R19 — 躯干上补全：矩形截口、肩带断边与短杂线

已修复。上接肩根、锁骨及肩带用局部生成与本件原生笔触完整续接，去掉矩形截口和横短线；最终完整独显又发现胸片后旧横纹，已用三色图局部重生成白布上段，连续配准、接线和接色后去掉横纹及轮廓毛边。原皮肤、锁骨和上缘保留，不增加颈部横安装线。

实际层：`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R19/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R19/reference-compare.png)。

### R20 — 躯干下补全：水平截边、白方片与软帽拼接

已修复。完整下腹帽盖、两侧轮廓和白布明暗接成同件连续延续，白方片及水平材料截边去除；32.5下安装端与34主体合并独显完整，普通深度分片不改变归属。

实际层：`D32.5 | body/torso | lower_mount` / `{46358100-0b1c-433a-a3da-f652464fcffd}` / 深度32.5；`D34 | body/torso` / `{237ddc01-663c-4aeb-b897-3e80874b186e}` / 深度34。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R20/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R20/reference-compare.png)。

### R21 — 狸饰下颌前片：孤立深色点、短竖线

已修复。只清掉下颌描边外的孤点和短残线；完整下颌、前后片连续搭接及合理隐藏后主体保留，头发与双爪未写入狸饰。

实际层：`D12 | head_accessories/tanuki_ornament/tanuki_body | back` / `{e31ef44b-9571-464f-a0d6-9ed501711eb0}` / 深度12；`D85.5 | head_accessories/tanuki_ornament/tanuki_body | front` / `{368765d3-d740-4b55-9b79-0d2ebae08dfa}` / 深度85.5。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R21/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R21/reference-compare.png)。

### R22 — 骨盆前片上补全：矩形灰短条与色阶

已修复。圆帽灰短条、矩形色阶与圆弧折口修掉，以本件白布明暗续接；最终再修净y905的淡矩形边，保留肚脐、髋肤和腿口。

实际层：`D22.5 | pelvis | back` / `{5a270326-00bf-4e30-b698-9c48a83f49ca}` / 深度22.5；`D33 | pelvis | front` / `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}` / 深度33。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R22/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R22/reference-compare.png)。

### R23 — 右腿与裸足（画面左侧）：描边浅化、趾甲方折丢失

已修复。恢复裸腿深棕轮廓、趾尖、趾缝和方折甲面；保留完整腿根。局部修掉裸踝白块、重复边和隐藏根毛刺，膝侧用本腿原生窄轮廓修净配准碎边，上段横接色用本腿辅助参考皮肤接顺；裙子、踝环及铃的投影/像素不在腿层。

实际层：`D24 | legs/leg_right/leg` / `{d503c5f0-2c3f-46d4-9c1d-3fa14d1565c5}` / 深度24。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R23/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R23/reference-compare.png)。

### R24 — 左袜腿与足部（画面右侧）：外线、袜口和趾部简化

已修复。恢复袜腿曲线、袜口收笔与外线，露趾、趾缝及各甲面原转角和亮暗边补全；长袜仍归腿本体，完整腿根和足部保留。

实际层：`D23 | legs/leg_left/leg` / `{b65106a1-85b2-4444-8eb8-11f558cdc1d1}` / 深度23。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R24/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R24/reference-compare.png)。

### R25 — 右踝后环（画面左侧）：过度外露的大后弧

已修复。后踝环重画为紧贴踝侧的完整回转，消除多余大后弧和奶绿碎段；深度11后环、24腿、90前踝饰保持正常夹踝关系，不新增蒙版。

实际层：`D11 | legs/leg_right/anklet_back` / `{34898742-3f8e-4a5f-bb07-b06df707a68b}` / 深度11；`D90 | legs/leg_right/anklet_front` / `{bc1a3c77-a9f4-439a-bad8-e69a8709182e}` / 深度90。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R25/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R25/reference-compare.png)。

### R26 — 尾巴下部：圆弧、尖梢和明暗块位置变化

已修复。按原图恢复尾巴下部连贯大弧、底缘尖梢方向和粉色明暗块，去掉额外凹口与扩大奶白条；隐藏尾根和细毛流完整保留。

实际层：`D0 | tail` / `{47033051-7e94-4a4f-8c50-9eccbe2c5513}` / 深度0。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R26/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R26/reference-compare.png)。

### R27 — 后发左回环：外轮廓外的奶白残边

已修复。仅清掉左回环外轮廓外的奶白背景残边；内部浅色发丝、深棕真实轮廓及回环空隙保留，灰底检查干净，没有整圈缩小头发。

实际层：`D14 | hair/back_hair` / `{6ef8f6a4-c537-4b73-88c4-5860409f0c7e}` / 深度14。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R27/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R27/reference-compare.png)。

### R28 — 耳机带画面左接头：白端下移、红带外露

已修复。左白接头回到原画布位置、范围与厚度，带体材料接回；接头普通前片22.25在neck22前、耳罩58/59后，后U带15在neck22后。

实际层：`D15 | headphones/headband` / `{700e32b8-c154-4208-b397-8dedd15ac65b}` / 深度15；`D22.25 | headphones/headband | terminals` / `{736c1a45-8063-4dc1-9e05-fa2cb41eb3b9}` / 深度22.25。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R28-R29/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R28-R29/reference-compare.png)。

### R29 — 耳机带画面右接头：白端缺量、接边透空

已修复。右白接头补回原可见面和连续带体，去掉原位置透空和过窄白条；完整headband union两端连通，层序同R28，颈部/耳罩未改形体。

实际层：`D15 | headphones/headband` / `{700e32b8-c154-4208-b397-8dedd15ac65b}` / 深度15；`D22.25 | headphones/headband | terminals` / `{736c1a45-8063-4dc1-9e05-fa2cb41eb3b9}` / 深度22.25。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-R28-R29/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-R28-R29/reference-compare.png)。

### N1 — 新增自查：前辫散尾

已修复。前辫散尾采用同件三色局部生成，再以自身笔触和原图取样恢复细尖、向内钩、收笔与连续发流；后根13和前段57共同归属，发圈/衣物像素不进入辫层。细尖约至y787，保留原细部。

实际层：`D13 | hair/braid_right | back` / `{a0b578fa-3f3d-485b-8068-20008d6a8aa7}` / 深度13；`D57 | hair/braid_right | front` / `{bf1ac4b1-cfe3-4884-8ec9-f9e0811bc6b5}` / 深度57。

[单层/隐藏上层/整图](raster-layering/step01/repair-evidence/repair-01/current/final-N1/three-views.png)；[同坐标原图对照](raster-layering/step01/repair-evidence/repair-01/current/final-N1/reference-compare.png)。

## 新增自查与修复

- **鬓发尖余白（D83）**：奶白条在本件自身alpha内修成粉色发面并续细棕轮廓，尖收笔保留。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-sidehair-tip/three-views.png)。
- **裸腿根、裸踝及膝侧配准残边（D24）**：本件窄生成轮廓与原生轮廓局部配准，杂白块、外碎边和尾巴交接处混入像素清理；完整根与足保留。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-knee-owned-contour/three-views.png)。
- **裸腿上段横接色（D24）**：仅取辅助参考中本腿皮肤，在原坐标局部羽化原生取样，去掉横材料边，不恢复裙子投影。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-thigh-material-finish/three-views.png)。
- **耳机带隐藏连通（D15/D22.25）**：以本带材料、原生明暗和细线补桥，使后U带和两白端完整连通。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-headband-union/three-views.png)。
- **骨盆顶帽淡矩形边（D33）**：在y905本件布面局部柔笔接色，灰条、矩形边和杂线去除。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-pelvis-cap/three-views.png)。
- **胸片/躯干中央接色（D34/D35）**：各自已有画面内仅取自身白布修色，皮肤、粉发和非布面排除，侧线保留。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-center-cloth-finish/three-views.png)。
- **躯干胸片后旧横纹（D34）**：三色局部重生成白布上段；原肩根、锁骨、上缘与下腹保留，内部曲线接回本件可见段。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-hidden-torso-cloth/three-views.png)。
- **前臂腕端帽盖（D32）**：自身粉橙体积明暗用原生柔笔续入帽盖，缺失描边按本件曲线逐笔续接。 [三视图](raster-layering/step01/repair-evidence/repair-01/current/last-forearm-wrist-material/three-views.png)。

## 分层、归属和原生蒙版

终止part ID未变。当前有效上游深度表含7个多深度逻辑part：3个上游预标注（辫、狸饰、骨盆）、初次组装发现的2眉，以及本次repair01历史组装发现的torso/headband。后两项已在此前阶段通过edit_occlusion同步；本段续修没有新深度、分片、逻辑节点或蒙版。当前上游78件/85深度与实际KRA逐一对应。旧顶层layer-map.json的83行缓存现已补齐为实际85行，图层名/UUID/区域/深度一致。

[完整85片映射与区域依据](raster-layering/step01/repair-evidence/repair-01/current/final-layer-map.json)；[更新后的工程映射](raster-layering/step01/layer-map.json)。

5蒙版只负责8个hiddenInReference part：后大腿带、两小指、后发圈、共享口内四件。逐个OFF查看完整底图，ON查看默认闭合；口内共用上下唇内缘围成的闭合开口，眼睛可见，不加眼内蒙版。默认蒙版visible=True、opacity=255。可见部件没有透明度融合/消隐蒙版，也没有把投影或邻件像素写入所属层。



[蒙版所属层/组、UUID和控制part](raster-layering/step01/repair-evidence/repair-01/current/final-masks/index.json)。

## 同尺寸对照与完整部件验收





[双足同坐标对照](raster-layering/step01/repair-evidence/repair-01/current/feet-final.png)；[左手同坐标对照](raster-layering/step01/repair-evidence/repair-01/current/hands-left-final.png)；[右手同坐标对照](raster-layering/step01/repair-evidence/repair-01/current/hands-right-final.png)；[耳机接头对照](raster-layering/step01/repair-evidence/repair-01/current/headband-final.png)。

85片逐层单独显出和隐藏其全部上层查看；7个同part多深度union完整检查。后续局部修改均再看该处单层/隐藏上层/整图，新的完整躯干和腕端问题在本步继续修掉。原有尖、钩、转角、曲线走向和线宽变化保留；原生相连处接色接线，无新增安装横线。

## 绘画来源和与色块图的差别

初次生成来源、历史同件局部重生成和原生笔触沿用；本段另外用内置image_gen三色图重生成D34隐藏白布，原图遮挡物及件外区域中性灰化。结果仅局部接入，生成主体、原肩根/锁骨/下腹和D35独立胸片保留。[本段生图规格与来源](raster-layering/step01/repair-evidence/repair-01/current/torso-hidden-cloth-process/prompt-and-source.json)；[配准](raster-layering/step01/repair-evidence/repair-01/current/torso-hidden-cloth-process/registration-details.json)；[原生局部来源记录](raster-layering/step01/repair-evidence/repair-01/current/native-final-process)。

N1细尖约到y787，越过简化SVG的y777截帽，这是按原图保留细部；part身份及13/57共同运动不变。耳壳保留真实开口，内耳/耳毛仍各自归属。眼部旧inner-highlight色块x769..775、y446..451实际为金色虹膜材料，仍在iris，白反光保持独立highlight。生成与原生描边的少量抗锯齿边界可落在简化SVG边缘之外，未用整件裁切削薄形体；部件归属没有转移。

## 最终保存与重开核验

最后腕端修复后再次保存指定KRA，关闭并丢弃旧文档/节点引用，从磁盘重新打开。91个非根节点（85绘画、5蒙版、1口内组）的名称、UUID、父组、顺序、visible、opacity、blend、inheritAlpha、alphaLocked及全部全画布像素签名完全相同。画布1376×2048、RGBA U8、sRGB-elle-V2-srgbtrc.icc。默认PNG、重开导出PNG和KRA内mergedimage.png的解码RGBA一致；ZIP可完整读取。这些像素/哈希检查只验证保存完整性。

[最终重开全树/全像素检查](raster-layering/step01/repair-evidence/repair-01/current/reopen-check.json)；[保存前签名](raster-layering/step01/repair-evidence/repair-01/current/before-reopen-signature.json)；[重开后签名](raster-layering/step01/repair-evidence/repair-01/current/after-reopen-signature.json)；[KRA/PNG一致性](raster-layering/step01/repair-evidence/repair-01/current/artifact-check.json)。

最终KRA SHA-256：`ec8ccc9e6eaeb17fcffffcee67c7c8ee3f8279abf70ced768f558c725fa04ab9`。PNG SHA-256：`921bf06846cbb298b54bdcc4fe6f98837675aef59b35afa5eb14429109c708a7`。

## 工具错误与恢复

Krita保存曾返回：`Krita 弹出了对话框“QProgressDialog”，无人操作的界面会因此卡住，桥接已自动取消它，对应操作没有完成。不要在脚本里打开需要人操作的对话框；导出和保存的参数通过 InfoObject 传入。`。保留活文档、批处理模式并把保存/导出分开，单独重试成功；最终关闭重开证明保存完成。QImage诊断导入遗漏和python命令缺失分别通过补导入、改python3恢复，未留下未保存试稿。[错误原文、重试和最终成功任务记录](raster-layering/step01/repair-evidence/repair-01/current/tool-recovery.json)。

audit-sheet-10.png原方式曾被图像读取策略拦截；按用户指示改为缩小灰度版读取成功，本段未重复原方式。验收使用成功读取的灰度/局部图和各件三视图，不把被拦截图作为证据。没有必要输入缺失、损坏或未恢复工具故障。

## 交付

[character-depth.kra](raster-layering/step01/character-depth.kra)；[character-depth.png](raster-layering/step01/character-depth.png)；[已更新的绘画/分层报告](raster-layering/step01/report.md)。本文件只写入repair-01.md.tmp，由调度器发布；未自行写正式repair/review，也未重新提交首次绘制报告。
