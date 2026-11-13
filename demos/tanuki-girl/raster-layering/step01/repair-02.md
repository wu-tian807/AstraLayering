结论：已修复

# repair-02 逐项处理与验收

已完成review-02全部24项及最终自查N01，当前78逻辑part、86绘画片、5原生透明度蒙版、1共享口内组。工程和PNG已正式保存、真实关闭重开并核对；最后保存/重开均桥接ok:true。

## R01 — 狸饰叶片：外形和叶脉改动

已修复。按 standard 恢复原叶片的两尖、上侧凹弧、右凹口、较平的下缘及原叶脉交点/分支。最后扩大到同属 tanuki_body 的两耳、上额及尾部上面，修掉旧矩形取样边；下部主体及尾部下段保留生成笔触，尾部下段局部配准接回完整外线。叶片凹口中的原背景为透明，耳心的浅色材料和眼中亮点保持不透明。

实际原/当前part与普通绘画片：

- `head_accessories/tanuki_ornament/tanuki_body` → `D12 | head_accessories/tanuki_ornament/tanuki_body | back`，UUID `{e31ef44b-9571-464f-a0d6-9ed501711eb0}`，最终深度 12；完整后主体、叶片、小耳、尾形与隐藏下颌搭接，位于角色头发及兽耳后；中央下颌前片的上接边界提前到 y193，避免后发根描边穿过分片交界。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R01-leaf/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R01-leaf/exposed.png) / [默认整图](repair-evidence/repair-02/current/R01-leaf/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R01-leaf/final-check.png)。原画布框 `[ 590, 18, 340, 250 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R02 — 右侧后发：缺口被耳机带填占

已修复。D14 的缺发处用本件红发取样和原生明暗/发流笔触补成连续发面；去掉矩形环带鬼影。后 U 带从15改到13.5，位于辫根13前、后发14后；白接头22.25仍位于颈22前。检查后发、headband 联合和默认合成均没有缺口或穿入发面的带片。

实际原/当前part与普通绘画片：

- `hair/back_hair` → `D14 | hair/back_hair`，UUID `{6ef8f6a4-c537-4b73-88c4-5860409f0c7e}`，最终深度 14；短后发在脸、颈、兽耳、躯干和前发后，覆盖辫根13与耳机后U带13.5；红色内面和原发梢保留。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R02-depth-final/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R02-depth-final/exposed.png) / [默认整图](repair-evidence/repair-02/current/R02-depth-final/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R02-depth-final/final-check.png)。原画布框 `[ 729, 488, 85, 77 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R03 — 侧发翼下：不透明白背景残片

已修复。清掉发翼与细发缕间的不透明白楔及件外白边；开口恢复真实透明。保留原下方细粉发缕的尖梢、棕粉细描边及回接主束的连续形体。

实际原/当前part与普通绘画片：

- `hair/side_hair/side_hair_right` → `D83 | hair/side_hair/side_hair_right`，UUID `{ccf27b6d-49e0-40a9-9a4d-17c7bc104c41}`，最终深度 83；完整右侧发在脸与五官前、刘海后，发翼与下方细缕共同归属。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R03-wing/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R03-wing/exposed.png) / [默认整图](repair-evidence/repair-02/current/R03-wing/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R03-wing/final-check.png)。原画布框 `[ 490, 384, 91, 52 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R04 — 刘海右下尖端：破碎回环与碎点

已修复。只清理刘海本件末端的 C 回环、离散粉灰点及深碎点，并接回原图细尖走向；原外眼角钩仍保留在 D71 上睑，刘海尖端没有整体削薄或加粗。

实际原/当前part与普通绘画片：

- `hair/bangs` → `D84 | hair/bangs`，UUID `{e2e38ffb-ec15-4ab7-aebb-fe1b504dbb42}`，最终深度 84；完整刘海在侧发、脸和五官前，眉发面分片84.1/84.2后。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R04-tip/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R04-tip/exposed.png) / [默认整图](repair-evidence/repair-02/current/R04-tip/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R04-tip/final-check.png)。原画布框 `[ 769, 407, 53, 58 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R05 — 辫子发圈处：横箍形残边

已修复。以三色控制图重新生成发圈遮挡处的收束发面，连续接回原有纵向发缕和散尾；清除横箍形直边及两侧残耳。D13/D57 联合为同一束发，环带只属于发圈层，原长尖及内钩保留。

实际原/当前part与普通绘画片：

- `hair/braid_right` → `D57 | hair/braid_right | front`，UUID `{bf1ac4b1-cfe3-4884-8ec9-f9e0811bc6b5}`，最终深度 57；y580–586 曲面接合区以下的前辫与散尾，位于胸肩前、右耳罩后；与后根共同归属和运动。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R05-braid/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R05-braid/exposed.png) / [默认整图](repair-evidence/repair-02/current/R05-braid/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R05-braid/final-check.png)。原画布框 `[ 566, 665, 60, 83 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R06 — 左上眼睑：含虹膜外缘残线

已修复。从 D71 只去掉伸入眼白的虹膜残边，最后核清 x779–780、y418–423 的两列固定残边。D67 的完整虹膜暗外缘、层次及 D69 高光保持独立。停用左 iris/highlight 后没有固定黑垂边；原尺寸双眼并排确认上睫毛直接压眼白，真实睫毛尖、上睑主弧和外眼尾钩保留。

实际原/当前part与普通绘画片：

- `face/eyes/eye_left/upper_eyelid` → `D71 | face/eyes/eye_left/upper_eyelid`，UUID `{ae6d9e09-a249-45b6-8e3b-b7db6f39dfe0}`，最终深度 71；左连体上睫毛、上睑和真实外眼尾在眼白、虹膜及高光前，前发后；不领取虹膜暗外缘。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R06-lid/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R06-lid/exposed.png) / [默认整图](repair-evidence/repair-02/current/R06-lid/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R06-lid/final-check.png)。原画布框 `[ 758, 402, 32, 44 ]`，参考 [standard.png](part-layering/references/standard.png)。

[整只双眼原尺寸对照](repair-evidence/repair-02/current/final/eyes-native.png) / [左iris/highlight停止后检查](repair-evidence/repair-02/current/final/eyes-toggle/checked.png)。

## R07 — 左眉：发面段线重明显不足

已修复。按左眉自身参考恢复裸肤段和发面段的棕红线色、线宽、外弧与渐细收笔。D80/D84.1 为互补普通片，联合连续；没有用右眉镜像或透明度蒙版制造透见。

实际原/当前part与普通绘画片：

- `face/eyebrows/eyebrow_left` → `D80 | face/eyebrows/eyebrow_left | back`，UUID `{06085fa6-f39d-49c6-bc1b-505f7840b94f}`，最终深度 80；左整眉中裸肤区域的普通绘画分片，在脸前、前发后。。
- `face/eyebrows/eyebrow_left` → `D84.1 | face/eyebrows/eyebrow_left | front`，UUID `{a2acf7ca-a935-4c2d-9e1a-a0bd319d3e41}`，最终深度 84.1；同眉与刘海和左侧发相交的棕红眉线普通分片，在发面前；依本侧原图恢复厚薄和收笔，像素仍归左眉。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R07-brow/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R07-brow/exposed.png) / [默认整图](repair-evidence/repair-02/current/R07-brow/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R07-brow/final-check.png)。原画布框 `[ 717, 343, 104, 37 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R08 — 右眉：细化浅化、斜段力度丢失

已修复。按右眉实际斜弧、转平段和尾端渐隐恢复线重与棕红深浅。D81/D84.2 连续且保留本侧弧度差异；未均匀加粗或复制左眉。

实际原/当前part与普通绘画片：

- `face/eyebrows/eyebrow_right` → `D81 | face/eyebrows/eyebrow_right | back`，UUID `{739e209d-5633-4105-a477-bb4811a84f3a}`，最终深度 81；右整眉中裸肤区域的普通绘画分片，在脸前、前发后。。
- `face/eyebrows/eyebrow_right` → `D84.2 | face/eyebrows/eyebrow_right | front`，UUID `{882c642c-c4d7-4ecc-b2ec-57e6fae5ed13}`，最终深度 84.2；同眉与刘海和右侧发相交的棕红眉线普通分片，位于发面前，保留本侧原图长度、弧度和渐隐。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R08-brow/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R08-brow/exposed.png) / [默认整图](repair-evidence/repair-02/current/R08-brow/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R08-brow/final-check.png)。原画布框 `[ 589, 342, 103, 41 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R09 — 左红晕：红底扩浓、细线缩短

已修复。收回左颊红底向眼下的扩散与过浓区；保留真正红色底，用柔笔按本侧长度、斜向和位置重画长短细线及两端收笔。脸底未领取红晕像素。

实际原/当前part与普通绘画片：

- `face/blush_left` → `D76 | face/blush_left`，UUID `{5e74d9a3-a429-4d63-8f05-67f72cf9e047}`，最终深度 76；左颊红底与斜线归同一件，在脸前、侧发后。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R09-blush/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R09-blush/exposed.png) / [默认整图](repair-evidence/repair-02/current/R09-blush/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R09-blush/final-check.png)。原画布框 `[ 738, 450, 67, 55 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R10 — 右红晕：红云过大、下端线形改变

已修复。收回右颊红云下缘和外扩范围，重新校准细线间距、长短和软收笔。外侧两线比中部线更淡，保留本侧层次；没有仅靠整层降透明度保留错误线形。

实际原/当前part与普通绘画片：

- `face/blush_right` → `D77 | face/blush_right`，UUID `{591e43a4-4e29-4e9a-bf37-a56199a73562}`，最终深度 77；右颊红底与斜线归同一件，在脸前、侧发后。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R10-blush/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R10-blush/exposed.png) / [默认整图](repair-evidence/repair-02/current/R10-blush/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R10-blush/final-check.png)。原画布框 `[ 613, 452, 67, 56 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R11 — 颈胸交界：浅白横边与短锁骨线

已修复。去掉颈胸搭接处浅白横边及孤立的双短锁骨，按 base-subject 的实际锁骨走向用本件肤色/原生弧接顺；D22 下安装端和 D34 上胸衔接无新增水平结构线，耳罩和白接头仍独立。

实际原/当前part与普通绘画片：

- `neck` → `D22 | neck`，UUID `{fbb36e58-b147-450f-ac71-d51de7bd2518}`，最终深度 22；完整颈部在后发、后U带13.5前，在颈侧接头22.25、脸、躯干和双耳罩后；顶部圆帽伸入下颌后，底部伸入锁骨承接区。。
- `body/torso` → `D34 | body/torso`，UUID `{237ddc01-663c-4aeb-b897-3e80874b186e}`，最终深度 34；同件可见肩带、锁骨、胸廓和y905以上腹腰上片，覆盖颈下端与骨盆上接，在胸部、前辫57、耳罩后；右侧完整肩帽已归24.75，在此修接原肩带与领口。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R11-neck/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R11-neck/exposed.png) / [默认整图](repair-evidence/repair-02/current/R11-neck/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R11-neck/final-check.png)。原画布框 `[ 632, 582, 160, 66 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R12 — 画面左肩带—领口：斜截与台阶

已修复。接顺画面左肩带—领口，去掉白台阶及斜截。D35 顶部回到本件圆弧，D34 承担上肩带延续；原生描边粗细按可见段续接，肩根与领口相接无断口。

实际原/当前part与普通绘画片：

- `body/torso` → `D34 | body/torso`，UUID `{237ddc01-663c-4aeb-b897-3e80874b186e}`，最终深度 34；同件可见肩带、锁骨、胸廓和y905以上腹腰上片，覆盖颈下端与骨盆上接，在胸部、前辫57、耳罩后；右侧完整肩帽已归24.75，在此修接原肩带与领口。。
- `body/breast` → `D35 | body/breast`，UUID `{1b76e69a-e317-4da3-a0fb-ff17ac74b107}`，最终深度 35；完整胸部在躯干前、前辫57和双耳罩后，领口内皮肤及贴合白服体积属于本件；原生修画接合。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R12-strap/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R12-strap/exposed.png) / [默认整图](repair-evidence/repair-02/current/R12-strap/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R12-strap/final-join-local.png)。原画布框 `[ 600, 612, 48, 95 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R13 — 画面右肩带—领口：断口和肩帽鬼线

已修复。按 base-subject 的真实外缘 x约803–818 接顺画面右肩带，而非旧估计的 x799。D35 只领取白布；D34 的肩安装帽切出为 D24.75，置于上臂25后，默认不露肩帽鬼线。新增片仍同属 body/torso，没有用蒙版消隐可见布片或领取臂肤。

实际原/当前part与普通绘画片：

- `body/torso` → `D24.75 | body/torso | shoulder_mount`，UUID `{c18862a8-5a3c-4d52-8367-98b75f37c67a}`，最终深度 24.75；review-02 R13新发现的画面右侧完整肩安装圆帽普通后分片：原34中约x790..827、y606..685的肩帽皮肤及帽边，移至上臂25后，原肩带可见内容另在34连续修接；只取躯干自身画面。。
- `body/torso` → `D34 | body/torso`，UUID `{237ddc01-663c-4aeb-b897-3e80874b186e}`，最终深度 34；同件可见肩带、锁骨、胸廓和y905以上腹腰上片，覆盖颈下端与骨盆上接，在胸部、前辫57、耳罩后；右侧完整肩帽已归24.75，在此修接原肩带与领口。。
- `body/breast` → `D35 | body/breast`，UUID `{1b76e69a-e317-4da3-a0fb-ff17ac74b107}`，最终深度 35；完整胸部在躯干前、前辫57和双耳罩后，领口内皮肤及贴合白服体积属于本件；原生修画接合。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R13-strap/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R13-strap/exposed.png) / [默认整图](repair-evidence/repair-02/current/R13-strap/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R13-strap/final-outer-local.png)。原画布框 `[ 772, 591, 82, 124 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

[肩安装端局部灰度三视图](repair-evidence/repair-02/current/R13-strap/final-shoulder-local-gray.png)；D24.75在上臂25后，以真实深度解决肩帽穿插。

## R14 — 躯干下补全：外描边未接入圆帽

已修复。把躯干下安装端的原生棕灰轮廓接入完整圆帽，保持细线与本件布面连续。D32.5/D34 联合完整；默认骨盆遮住安装端，不新增腰封口线。

实际原/当前part与普通绘画片：

- `body/torso` → `D32.5 | body/torso | lower_mount`，UUID `{46358100-0b1c-433a-a3da-f652464fcffd}`，最终深度 32.5；同件 y905 以下的完整下腹白布圆帽及外轮廓，位于骨盆白服前片33后。分界处沿原画布保持连续材料，普通绘画分片共同运动，不挂蒙版。。
- `body/torso` → `D34 | body/torso`，UUID `{237ddc01-663c-4aeb-b897-3e80874b186e}`，最终深度 34；同件可见肩带、锁骨、胸廓和y905以上腹腰上片，覆盖颈下端与骨盆上接，在胸部、前辫57、耳罩后；右侧完整肩帽已归24.75，在此修接原肩带与领口。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R14-cap/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R14-cap/exposed.png) / [默认整图](repair-evidence/repair-02/current/R14-cap/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R14-cap/final-check.png)。原画布框 `[ 567, 885, 281, 118 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R15 — 骨盆上补全：帽沿缺原外线延续

已修复。恢复 D33 上安装帽本件生成纹理和原棕灰外线的完整弧。帽沿色面/描边连续，默认上方躯干遮住此端，未新增可见腰线。

实际原/当前part与普通绘画片：

- `pelvis` → `D33 | pelvis | front`，UUID `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}`，最终深度 33；完整白服前片、腿口描线及上接帽盖，在双腿前、躯干下腹圆帽32.5前、躯干可见上片34后；原生修画接色，不挂接合蒙版。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R15-cap/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R15-cap/exposed.png) / [默认整图](repair-evidence/repair-02/current/R15-cap/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R15-cap/final-check.png)。原画布框 `[ 550, 845, 310, 111 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R16 — 画面左腿口：白补片截断棕边

已修复。沿完整左裤口而非旧小框检查，清掉截断棕边的白补片、下段白突片和灰短桩；只在本件白布窄走廊内取样接色，再续接原细棕灰外线。保留原内线和纵缝，没有借腿肤或裤口投影补洞。

实际原/当前part与普通绘画片：

- `pelvis` → `D33 | pelvis | front`，UUID `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}`，最终深度 33；完整白服前片、腿口描线及上接帽盖，在双腿前、躯干下腹圆帽32.5前、躯干可见上片34后；原生修画接色，不挂接合蒙版。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R16-hem/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R16-hem/exposed.png) / [默认整图](repair-evidence/repair-02/current/R16-hem/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R16-hem/final-check.png)。原画布框 `[ 586, 950, 107, 145 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R17 — 画面右腿口：断边与布面残线

已修复。沿完整右裤口清掉布面残线、白突片和灰短桩，恢复连续原细棕灰边。原有内线/纵缝保留，本件白布接色自然；未采腿肤，未加粗、压平原外缘。

实际原/当前part与普通绘画片：

- `pelvis` → `D33 | pelvis | front`，UUID `{2816e084-1186-4a3d-aaa2-8f4be6ad61ae}`，最终深度 33；完整白服前片、腿口描线及上接帽盖，在双腿前、躯干下腹圆帽32.5前、躯干可见上片34后；原生修画接色，不挂接合蒙版。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R17-hem/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R17-hem/exposed.png) / [默认整图](repair-evidence/repair-02/current/R17-hem/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R17-hem/final-check.png)。原画布框 `[ 717, 939, 132, 159 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R18 — 左上臂隐藏肘帽：外线止于补全端

已修复。在左上臂隐藏肘帽续完本件原细棕轮廓，清掉浅白硬沿/新月边；肤色延续本件体积明暗。默认前臂遮住帽端，既无缺口也不露新增肘封口线。

实际原/当前part与普通绘画片：

- `arms/arm_left/upper_arm` → `D25 | arms/arm_left/upper_arm`，UUID `{760efccd-6eb8-49fc-a996-1e95ce640f55}`，最终深度 25；完整左肩根覆盖躯干肩帽后片24.75，在躯干可见肩带34和耳罩后，肘端伸入左前臂后。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R18-elbow/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R18-elbow/exposed.png) / [默认整图](repair-evidence/repair-02/current/R18-elbow/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R18-elbow/final-check.png)。原画布框 `[ 869, 815, 100, 62 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R19 — 右上臂隐藏肘帽：浅白硬边无描边

已修复。在右上臂隐藏肘帽续完对应原细棕轮廓，去掉白硬边和孤立浅边；保持本侧形体与肤色连续。默认前臂覆盖帽端，不出现额外封口。

实际原/当前part与普通绘画片：

- `arms/arm_right/upper_arm` → `D26 | arms/arm_right/upper_arm`，UUID `{b60f5bf9-dc78-43fc-9449-d586fffbb137}`，最终深度 26；完整右上臂在躯干、胸部、前辫57和右耳罩后；肘端由右前臂覆盖。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R19-elbow/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R19-elbow/exposed.png) / [默认整图](repair-evidence/repair-02/current/R19-elbow/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R19-elbow/final-check.png)。原画布框 `[ 475, 794, 91, 64 ]`，参考 [base-subject.png](part-layering/references/base-subject.png)。

## R20 — 左无名指：亮暗段硬拼

已修复。在左无名指本件上接顺亮暗段和原外线，去掉亮色段与暗粉短端间的硬台阶；原短端和渐细轮廓保留，不混入相邻手指的线条。

实际原/当前part与普通绘画片：

- `arms/arm_left/hand/ring_finger` → `D38 | arms/arm_left/hand/ring_finger`，UUID `{d85bd8b0-a005-4c44-8336-c74b30be64a4}`，最终深度 38；完整左无名指在小指前、中指、食指和掌后；默认短指端和下缘自然露出。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R20-ring/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R20-ring/exposed.png) / [默认整图](repair-evidence/repair-02/current/R20-ring/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R20-ring/final-check.png)。原画布框 `[ 1055, 1028, 62, 57 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R21 — 右无名指：勺形根段与硬切色界

已修复。用三色控制重新生成右无名指窄根，原可见短端仅从本件 start-D39 取样保留。撤回旧勺形根与灰 AA 残边，逐笔接顺根段、亮暗与外线，保留独立原姿态和短端。

实际原/当前part与普通绘画片：

- `arms/arm_right/hand/ring_finger` → `D39 | arms/arm_right/hand/ring_finger`，UUID `{6ea2cb37-c639-4b2a-a4c2-08504d985757}`，最终深度 39；完整右无名指在小指前、中指、食指和掌后；默认短圆端自然露出。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R21-ring/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R21-ring/exposed.png) / [默认整图](repair-evidence/repair-02/current/R21-ring/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R21-ring/final-check.png)。原画布框 `[ 293, 1022, 77, 61 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R22 — 左小指：软色棒缺轮廓和指部细节

已修复。用 hiddenInReference 完整形体的黄色控制生成左小指，再在 Krita 逐笔补全本件细深棕整圈轮廓及指节结构线。完整实体独显有明暗/指体结构，默认原生蒙版启用后隐藏；未画相邻指投影。

实际原/当前part与普通绘画片：

- `arms/arm_left/hand/little_finger` → `D36 | arms/arm_left/hand/little_finger`，UUID `{ca815547-31cc-4382-9aa8-dd188b37b377}`，最终深度 36；完整左小指在同手无名指、中指、食指和掌后；hiddenInReference原生叠指蒙版默认全闭，完整纹理保留。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R22-little/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R22-little/exposed.png) / [默认整图](repair-evidence/repair-02/current/R22-little/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R22-little/final-check.png)。原画布框 `[ 1054, 1024, 59, 57 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R23 — 右小指：缺深色轮廓与指体结构

已修复。用本侧完整黄色控制独立生成右小指，再续完其细深棕轮廓、收尖和两处指节结构。与左侧材料协调而姿态独立，没有镜像覆盖本侧实际方向；默认蒙版启用。

实际原/当前part与普通绘画片：

- `arms/arm_right/hand/little_finger` → `D37 | arms/arm_right/hand/little_finger`，UUID `{f6a6d2a1-0435-4c58-ab1a-662a1559249c}`，最终深度 37；完整右小指在同手无名指、中指、食指和掌后；原生叠指蒙版默认全闭。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R23-little/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R23-little/exposed.png) / [默认整图](repair-evidence/repair-02/current/R23-little/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R23-little/final-check.png)。原画布框 `[ 303, 1016, 69, 55 ]`，参考 [standard.png](part-layering/references/standard.png)。

## R24 — 左腕粉环后段：模糊色棒、缺带边

已修复。用三色控制重画左腕粉环后段为完整 C 弧、粉色条带及内外细暗边。前/后腕环联合连续，后段不再是模糊色棒；本件不带手腕肤色或其他环带投影。联合验收采用三个独立局部灰度视图。

实际原/当前part与普通绘画片：

- `arms/arm_left/bracelet_pink_back` → `D28 | arms/arm_left/bracelet_pink_back`，UUID `{9300b096-f06d-4ca4-b43e-81081a584bce}`，最终深度 28；完整粉后环在左前臂、掌、粉前环和铃后；hiddenInReference为false，以普通层序遮挡。。

验收：本片/同件联合独显、隐藏全部上层、默认整图已看图核对。[独显](repair-evidence/repair-02/current/R24-pink/solo.png) / [隐藏上层](repair-evidence/repair-02/current/R24-pink/exposed.png) / [默认整图](repair-evidence/repair-02/current/R24-pink/assembled.png) / [同坐标对照](repair-evidence/repair-02/current/R24-pink/final-check.png)。原画布框 `[ 956, 936, 77, 118 ]`，参考 [standard.png](part-layering/references/standard.png)。

前后粉环的被拦三联未重复读取，以下三个单独灰度局部均成功看过：[联合独显](repair-evidence/repair-02/current/union-pink-wrist/final-solo-gray-local.png) / [隐藏上层](repair-evidence/repair-02/current/union-pink-wrist/final-exposed-gray-local.png) / [默认组装](repair-evidence/repair-02/current/union-pink-wrist/final-assembled-gray-local.png)。

## N01 — 最终自查的狸饰原生接缝

已修复。彩色原尺寸检查发现旧叶片取样矩形边及两耳局部错位；扩为同属tanuki_body的连续叶片、两耳、上额与尾部上面取样，保留原细线/色面、耳心亮色和眼亮点，件外白底及凹口背景清透。尾部下段从本件生成画面局部配准接回上段外线，保持原笔触与描边宽度；不采爪子、角色耳壳或头发，不添加投影。

[完整狸饰参考/独显/隐藏上层/组装四视图](repair-evidence/repair-02/current/union-tanuki/N01-union-checked.png) / [正式重开彩色原尺寸头部](repair-evidence/repair-02/current/final/reopened-head-color-native.png) / [来源及配准记录](repair-evidence/repair-02/current/native-process/N01-source-and-registration.json) / [只改D12、其余85片及5蒙版不变](repair-evidence/repair-02/current/final/N01-localization-check.json)。

另在R16/R17原小框之外发现的裤口白突片、灰短桩已随完整裤口修复；不是留到下一次的额外项目。

## 层级、归属与色块差异

| 逻辑 part | 普通绘画深度 | 发现阶段与职责 |
| --- | --- | --- |
| `hair/braid_right` | 13 / 57 | 上游预标注；后根与前辫/散尾共同运动。 |
| `head_accessories/tanuki_ornament/tanuki_body` | 12 / 85.5 | 上游预标注；后主体与压发根下颌前缘，共同连续。 |
| `pelvis` | 22.5 / 33 | 上游预标注；髋肤在腿后，白服腿口在腿前。 |
| `face/eyebrows/eyebrow_left` | 80 / 84.1 | 初次组装发现；本侧裸肤与发面段为互补普通片。 |
| `face/eyebrows/eyebrow_right` | 81 / 84.2 | 初次组装发现；同上，保留左右各自眉形。 |
| `body/torso` | 24.75 / 32.5 / 34 | 32.5/34 为历史组装拆片；repair02 的 R13 新发现肩安装帽须在上臂25后，新增24.75。 |
| `headphones/headband` | 13.5 / 22.25 | 后 U 带/白接头为历史组装拆片；R02 将原15降至13.5，后发14不再被环带占据。 |

上述R02/R13深度已通过edit_occlusion同步；KRA普通层顺序及86区域全部对应。逻辑ID不变，未改独立运动关系；可见件未挂透明度消隐蒙版。实际UUID和全部片映射见 [完整映射](layer-map.json) 与 [更新后的绘画报告](report.md)。

- 辫尾保留原细尖与向内钩至约y787，超出简化SVG约y777的帽端；原ID与13/57运动关系保持不变。
- 耳壳保留原真实开口；耳内和耳毛保持独立，不把SVG实心控制范围做成封闭壳。
- 旧眼部 inner-highlight 色块 x769–775、y446–451 对应金色虹膜材料，归iris；白反光仍归highlight。D67完整外暗边未裁掉。
- 肩带外缘按辅助参考的真实细线（右侧约x803–818）保留。D35领口附件局部白料略越粗SVG，但均属本件白布，没有领取臂肤。D24.75为从原torso主体切出的安装帽，完整逻辑part身份不变。
- 狸饰叶片、两耳和上额按standard的实际形体与细线恢复；粗SVG未逐像素描述这些凹口、尖端与原生AA。尾部下段局部配准接回上轮廓，没有给同件新增控制身份。
- 完整颈肩、指根、辫根、腰帽和肘帽是各件自身的合理延续；细描边/AA在粗SVG旁可有少量范围偏差。没有用整件硬裁切、加粗或压平原形来统一外观。

## 完整验收覆盖与显隐

已逐片检查86个普通绘画片的原生独显和隐藏全部上层视图，检查7个同 part 多深度联合、粉腕环前/后联合、双眼联合、5个蒙版 OFF/ON、整图与原尺寸双眼。所有局部修画都在独显、隐藏上层、默认整图下核对；最后 N01 只改 D12，其余85个绘画片与5个蒙版像素保持此前验收结果。最新完整视图已刷新。未移动参考来掩盖偏差，未用 PSNR 或其他图像分数判定画质。

[双眼原尺寸并排](repair-evidence/repair-02/current/final/eyes-native.png) / [双眼放大](repair-evidence/repair-02/current/final/eyes-enlarged.png) / [停用左虹膜/高光后的归属检查](repair-evidence/repair-02/current/final/eyes-toggle/checked.png) / [整图同尺度对照](repair-evidence/repair-02/current/final/whole-gray-quarter.png) / [从真实重开工程导出的彩色头部原尺寸对照](repair-evidence/repair-02/current/final/reopened-head-color-native.png)。

| 所属层/组与 UUID | 蒙版与 UUID | 控制区域、默认状态与证据 |
| --- | --- | --- |
| `D10 \| legs/leg_left/thigh_band_back`<br>`{37c84885-94de-4375-b6bc-81bcefb8dec0}` | `Default closed \| legs/leg_left/thigh_band_back`<br>`{08259a8e-cd26-487a-9f12-ab9fd99ca69e}` | legs/leg_left/thigh_band_back；legs/leg_left/thigh_band_back；ON、opacity255；[独显/整图 OFF–ON](repair-evidence/repair-02/current/final/masks/00/checked.png) |
| `D36 \| arms/arm_left/hand/little_finger`<br>`{ca815547-31cc-4382-9aa8-dd188b37b377}` | `Default closed \| arms/arm_left/hand/little_finger`<br>`{5483a5d1-d926-4388-8566-50775fc6d816}` | arms/arm_left/hand/little_finger；arms/arm_left/hand/little_finger；ON、opacity255；[独显/整图 OFF–ON](repair-evidence/repair-02/current/final/masks/01/checked.png) |
| `D37 \| arms/arm_right/hand/little_finger`<br>`{f6a6d2a1-0435-4c58-ab1a-662a1559249c}` | `Default closed \| arms/arm_right/hand/little_finger`<br>`{5e4ea0ea-ca7c-4cf9-9529-24de800dd784}` | arms/arm_right/hand/little_finger；arms/arm_right/hand/little_finger；ON、opacity255；[独显/整图 OFF–ON](repair-evidence/repair-02/current/final/masks/02/checked.png) |
| `D56 \| head_accessories/hair_tie_back`<br>`{7efb0a22-5ffa-40d6-9b14-796254b6ee3f}` | `Default closed \| head_accessories/hair_tie_back`<br>`{ce547866-9e77-4d6d-90ea-256eb880f1ce}` | head_accessories/hair_tie_back；head_accessories/hair_tie_back；ON、opacity255；[独显/整图 OFF–ON](repair-evidence/repair-02/current/final/masks/03/checked.png) |
| `D61-64 \| Shared mouth opening`<br>`{f6622e34-6a3b-4715-971f-0e828dfbd99a}` | `Default closed \| shared upper/lower lip inner opening`<br>`{5e4ab66e-50eb-48c1-ac8e-d840df23395d}` | upper/lower lip inner opening；face/mouth/mouth_interior、face/mouth/tongue、face/mouth/lower_teeth、face/mouth/upper_teeth；ON、opacity255；[独显/整图 OFF–ON](repair-evidence/repair-02/current/final/masks/04/checked.png) |

全部5蒙版已启用并保存默认闭合状态。关闭时完整实体/口内结构可见，开启时无缺口透出。7个多深度联合及额外腕环/双眼联合均已检查；完整单层索引见 [86片验收索引](repair-evidence/repair-02/current/final/layer-map.json)。

## 保存、重开、工具恢复与交付

最终正式 saveAs 与真实关闭/重新打开均返回桥接 ok:true。重开后核对92个非根节点（86绘画、5蒙版、1共享组）的类型、名称、UUID、父子和兄弟顺序、显隐、opacity、blend、inheritAlpha、alphaLocked、locked、组 passThrough、bounds，以及86绘画和5蒙版的全画布像素：均未变化，默认投影也一致。5蒙版全部ON。哈希仅用于证明保存稳定，画质结论来自看图。

正式 PNG 从该重新打开的 KRA 导出；1376×2048 RGBA，件外透明。PNG 与最新已验收合成、KRA mergedimage 的解码像素一致，KRA ZIP 可完整读取。[真实重开核对](repair-evidence/repair-02/current/final/reopen-verification.json) / [KRA/PNG核对](repair-evidence/repair-02/current/final/artifact-verification.json)。

导出曾出现 AssertionError，改为 batchmode、InfoObject alpha=True 并重试后恢复；历史/中间 save 的 QProgressDialog 自动取消没有被当成保存成功证据。局部返修中一次选区加载 NameError 后会话重启，从已核验正式工程恢复，不丢失已保存修画；最终保存重開再次通过。被拦截的 R13 和粉腕环检查采用局部/独立灰度视图成功读取，没有重复原拦截方式。当前没有未恢复工具故障或缺失输入。[错误原文与恢复记录](repair-evidence/repair-02/current/tool-recovery.json)。

正式交付：[character-depth.kra](raster-layering/step01/character-depth.kra) / [character-depth.png](raster-layering/step01/character-depth.png) / [report.md](raster-layering/step01/report.md)。本修复报告仅写指定 `repair-02.md.tmp`，第一行结论已修复；未自行发布正式repair/review，也未重启上游或更改运行标记。
