# Live2D 投影蒙版制作记录

交付 32 个独立投影绘画层。工程与 PNG 均为 1376 × 2048、RGBA U8，透明背景。最终原生检查 passed=true，problems=[]。

## 参考与坐标

投影外观依据 simplified；位置依据原组装 PNG。人物 left/right 为角色左右，衣服 screen_left/screen_right 为画面左右。图层深度仅用于保持遮挡顺序，没有把序号换算成投影距离。

- shadow/step01_mask/workspace/references/inputs.json
- shadow/step01_mask/workspace/references/production.md
- references/hair.png
- references/skirt.png
- character-assembly/step01/character-assembled.kra
- character-assembly/step01/character-assembled.png
- part-layering/references/simplified-subject.png
- part-layering/groups.json
- part-layering/occlusion.json
- clothing-part-layering/groups.json
- clothing-part-layering/occlusion.json

## 工程和运动来源

每层用 Krita 原生笔刷绘制：Basic-5 Size 的连续密集行笔形成完整影体，Airbrush Soft 绘制眼部渐暗、发缘和接触软边。硬边投影也保留笔刷的边缘过渡。影层采用 multiply 与透明度继承，隔离组中的 clip base 只包含声明的接收面及其原子层／蒙版。未重画部件像素或合并原部件。

上眼睑影联合接收眼白和虹膜，follow=caster；独立高光在影层上方。两侧眼睛各一层，视线移动时不带动投影。刘海投脸、刘海投侧发、两侧发投脸与后发分别保存运动关系。头饰投影联合裁到前发，内层刘海到侧发仍有独立裁切。

裙摆由 clothing:kimono_body 的两个衣片共同提供一个运动来源，一层联合裁到两腿，避免衣片影在腿面接缝处重复变深。两个吊坠各用真实父 part 作为运动来源，casterLayerUuids 包含其绳、珠、穗。

下巴投影跨原脖子／躯干叠放接缝，因此保留两个接收隔离层，分别为 chin-neck 和 chin-torso-continuation。它们颜色、轮廓和声明偏移一致，后续应同步跟随同一 face_base 来源；当前检查工具按单个影层移动，不代表这两层已经制作了同步 deformer。

所有 follow 只记录运动来源。本步骤没有制作 deformer、物理、九轴或光向关键形。

## 每处投影的依据

颜色为笔刷叠底色；百分比为最终图层不透明度。实际合成深浅还受软笔触 alpha 与接收面原色影响。脖子与腿已有固有肤色明暗，因此使用浅粉叠底色，使最终色接近参考，而非把参考暗色再次直接压暗。

### 01. bangs-face

投影部件：`character:hair/bangs`。接收面：`character:face/face_base`。

颜色 #d7998b，multiply，图层不透明度 16%。偏移（原画像素）：[0, 0], [-9, 0], [9, 0], [0, 9]。

参考中央刘海尖下浅桃色影缘；沿本工程刘海内缘，隐藏额头补全至y290，细尖允许9px相对摆动。

[原生完整影层／覆盖／偏移拼图](inspection/relation-000-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 02. side-left-face

投影部件：`character:hair/side_hair/side_hair_left`。接收面：`character:face/face_base`。

颜色 #d99a91，multiply，图层不透明度 22%。偏移（原画像素）：[0, 0], [-8, 0], [8, 0], [0, 7]。

侧发内轮廓下窄暖粉影；用软笔刷接顺脸颊，隐藏边缘和8px横摆余量。

[原生完整影层／覆盖／偏移拼图](inspection/relation-001-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 03. side-right-face

投影部件：`character:hair/side_hair/side_hair_right`。接收面：`character:face/face_base`。

颜色 #d99a91，multiply，图层不透明度 22%。偏移（原画像素）：[0, 0], [-8, 0], [8, 0], [0, 7]。

侧发内轮廓下窄暖粉影；用软笔刷接顺脸颊，隐藏边缘和8px横摆余量。

[原生完整影层／覆盖／偏移拼图](inspection/relation-002-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 04. upper-lid-left

投影部件：`character:face/eyes/eye_left/upper_eyelid`。接收面：`character:face/eyes/eye_left/sclera`, `character:face/eyes/eye_left/iris`。

颜色 #734b4c，multiply，图层不透明度 42%。偏移（原画像素）：[0, 0], [-7, 0], [7, 0], [0, 7]。

上睑下眼白与虹膜上部一整片红褐渐暗，向下渐淡；同一影层跟上睑，独立高光保留。横向超出眼角20px，上部延续至y388。

[原生完整影层／覆盖／偏移拼图](inspection/relation-003-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 05. upper-lid-right

投影部件：`character:face/eyes/eye_right/upper_eyelid`。接收面：`character:face/eyes/eye_right/sclera`, `character:face/eyes/eye_right/iris`。

颜色 #734b4c，multiply，图层不透明度 42%。偏移（原画像素）：[0, 0], [-7, 0], [7, 0], [0, 7]。

上睑下眼白与虹膜上部一整片红褐渐暗，向下渐淡；同一影层跟上睑，独立高光保留。横向超出眼角20px，上部延续至y388。

[原生完整影层／覆盖／偏移拼图](inspection/relation-004-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 06. chin-neck

投影部件：`character:face/face_base`。接收面：`character:neck`。

颜色 #fbd0cc，multiply，图层不透明度 95%。偏移（原画像素）：[0, 0], [-10, 0], [10, 0], [0, 12]。

参考下巴下大块暖红投影，底边向画面右上斜收；不是颈部固有结构明暗。上方被脸遮住部分补至y475，左右越过颈缘。 对照接收面既有颈部明暗后，用浅粉叠底色而不是把参考最终暗色直接叠底。

[原生完整影层／覆盖／偏移拼图](inspection/relation-005-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 07. cuff-left

投影部件：`clothing:sleeve_screen_left`。接收面：`character:arms/arm_left/upper_arm`, `character:arms/arm_right/upper_arm`。

颜色 #f8c4b4，multiply，图层不透明度 85%。偏移（原画像素）：[0, 0], [-8, 0], [8, 0], [0, 10]。

袖口下约16px暖肤色暗带，按本工程袖口斜弧调整；被袖子遮挡处向上延伸40px，下缘微软。

[原生完整影层／覆盖／偏移拼图](inspection/relation-006-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 08. cuff-right

投影部件：`clothing:sleeve_screen_right`。接收面：`character:arms/arm_left/upper_arm`, `character:arms/arm_right/upper_arm`。

颜色 #f8c4b4，multiply，图层不透明度 85%。偏移（原画像素）：[0, 0], [-8, 0], [8, 0], [0, 10]。

袖口下约16px暖肤色暗带，按本工程袖口斜弧调整；被袖子遮挡处向上延伸40px，下缘微软。

[原生完整影层／覆盖／偏移拼图](inspection/relation-007-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 09. skirt-main-legs

投影部件：`clothing:kimono_body`。接收面：`character:legs/leg_left/leg`, `character:legs/leg_right/leg`。

颜色 #fac7bf，multiply，图层不透明度 90%。偏移（原画像素）：[0, 0], [-13, 0], [13, 0], [0, 15]。

参考裙下斜影，按本工程裙摆配准：画面左腿影底x535 y1071至x704 y1130，右腿至x866 y1082。两衣片共享kimono_body裙摆运动来源，一个联合完整影层，避免两片影在拼接处重复压暗；顶部补全至y982，横向越过腿缘，检查±13px横移和15px下移。浅桃粉叠底让原腿的肤色和袜面明暗透出。

[原生完整影层／覆盖／偏移拼图](inspection/relation-008-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 10. waist-skirt

投影部件：`clothing:inner_waist_wrap`。接收面：`clothing:kimono_body/right_underlap_panel`, `clothing:kimono_body/left_overlap_panel`。

颜色 #b7a6b6，multiply，图层不透明度 30%。偏移（原画像素）：[0, 0], [-8, 0], [8, 0], [0, 9]。

腰封下衣料很浅的冷紫搭接暗边，柔和落到已有褶皱上；保留原衣料纹理与高光。

[原生完整影层／覆盖／偏移拼图](inspection/relation-009-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 11. cord-obi

投影部件：`clothing:front_waist_cord_knot`。接收面：`clothing:outer_waist_band`。

颜色 #a76d6b，multiply，图层不透明度 49%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 7]。

参考蝴蝶结和横绳下的偏棕红暗边；同一结绳来源一层，完整画结的内部环及遮挡部分，允许6px横移。

[原生完整影层／覆盖／偏移拼图](inspection/relation-010-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 12. chin-torso-continuation

投影部件：`character:face/face_base`。接收面：`character:body/torso`。

颜色 #fbd0cc，multiply，图层不透明度 95%。偏移（原画像素）：[0, 0], [-10, 0], [10, 0], [0, 12]。

与chin-neck同一来源及同一笔触边界；因原脖子/躯干叠放接缝另建接收隔离层，延续参考斜影底边，不能改变原层深度。 对照接收面既有颈部明暗后，用浅粉叠底色而不是把参考最终暗色直接叠底。

[原生完整影层／覆盖／偏移拼图](inspection/relation-011-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 13. earcup-left-skin

投影部件：`character:headphones/earcups/earcup_left`。接收面：`character:body/torso`。

颜色 #df9a91，multiply，图层不透明度 38%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 6]。

参考耳机底缘下的粉红接触投影，沿本工程耳罩下弧外扩6-10px；影层延续到遮住的内部，不改耳罩高光。

[原生完整影层／覆盖／偏移拼图](inspection/relation-012-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 14. earcup-right-skin

投影部件：`character:headphones/earcups/earcup_right`。接收面：`character:body/torso`。

颜色 #df9a91，multiply，图层不透明度 38%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 6]。

参考耳机底缘下的粉红接触投影，沿本工程耳罩下弧外扩6-10px；影层延续到遮住的内部，不改耳罩高光。

[原生完整影层／覆盖／偏移拼图](inspection/relation-013-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 15. paw-left-hair

投影部件：`character:head_accessories/tanuki_ornament/paw/paw_left`。接收面：`character:hair/side_hair/side_hair_left`, `character:hair/side_hair/side_hair_right`, `character:hair/bangs`。

颜色 #bb7186，multiply，图层不透明度 34%。偏移（原画像素）：[0, 0], [-7, 0], [7, 0], [0, 7]。

狸饰爪子下沿的窄玫瑰色投影；一层联合裁到完整刘海和侧发。软边画到爪内部，左右各7px余量。

[原生完整影层／覆盖／偏移拼图](inspection/relation-014-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 16. paw-right-hair

投影部件：`character:head_accessories/tanuki_ornament/paw/paw_right`。接收面：`character:hair/side_hair/side_hair_left`, `character:hair/side_hair/side_hair_right`, `character:hair/bangs`。

颜色 #bb7186，multiply，图层不透明度 34%。偏移（原画像素）：[0, 0], [-7, 0], [7, 0], [0, 7]。

狸饰爪子下沿的窄玫瑰色投影；一层联合裁到完整刘海和侧发。软边画到爪内部，左右各7px余量。

[原生完整影层／覆盖／偏移拼图](inspection/relation-015-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 17. tanuki-jaw-hair

投影部件：`character:head_accessories/tanuki_ornament/tanuki_body`。接收面：`character:hair/side_hair/side_hair_left`, `character:hair/side_hair/side_hair_right`, `character:hair/bangs`。

颜色 #bb7186，multiply，图层不透明度 22%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 6]。

参考狸饰下颌与发根接触的浅粉暗边；只复原接触投影，不改狸饰自身深浅。两爪之间分开收边以免重叠压暗。

[原生完整影层／覆盖／偏移拼图](inspection/relation-016-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 18. hair-bell-hair

投影部件：`character:head_accessories/hair_bell`。接收面：`character:hair/side_hair/side_hair_left`, `character:hair/side_hair/side_hair_right`, `character:hair/bangs`。

颜色 #b76980，multiply，图层不透明度 43%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 7]。

参考铃铛下缘压在粉发上的窄暗带；内侧画至铃下，顺发丝向下渐淡，不能烘焙铃的金属明暗。

[原生完整影层／覆盖／偏移拼图](inspection/relation-017-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 19. side-left-backhair

投影部件：`character:hair/side_hair/side_hair_left`。接收面：`character:hair/back_hair`。

颜色 #a95b74，multiply，图层不透明度 34%。偏移（原画像素）：[0, 0], [-9, 0], [9, 0], [0, 8]。

前侧发尖后方的粉红发面投影，按轮廓软笔刷窄带；红色后发固有暗面原样保留。藏在前发后的部分和9px侧摆延伸均保留。

[原生完整影层／覆盖／偏移拼图](inspection/relation-018-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 20. side-right-backhair

投影部件：`character:hair/side_hair/side_hair_right`。接收面：`character:hair/back_hair`。

颜色 #a95b74，multiply，图层不透明度 34%。偏移（原画像素）：[0, 0], [-9, 0], [9, 0], [0, 8]。

前侧发尖后方的粉红发面投影，按轮廓软笔刷窄带；红色后发固有暗面原样保留。藏在前发后的部分和9px侧摆延伸均保留。

[原生完整影层／覆盖／偏移拼图](inspection/relation-019-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 21. tie-braid

投影部件：`character:head_accessories/hair_tie_front`。接收面：`character:hair/braid_right`。

颜色 #a65c73，multiply，图层不透明度 38%。偏移（原画像素）：[0, 0], [-4, 0], [4, 0], [0, 5]。

发圈下方辫梢收束处的窄玫红投影；不改变辫子自身交叠明暗，完整笔触越过辫缘。

[原生完整影层／覆盖／偏移拼图](inspection/relation-020-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 22. braid-collar

投影部件：`character:hair/braid_right`。接收面：`clothing:kimono_body/right_underlap_panel`, `clothing:kimono_body/left_overlap_panel`。

颜色 #aa8295，multiply，图层不透明度 25%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 7]。

辫梢压在衣领和白色衣料处的淡紫粉影，和衣料褶皱区分；隐藏部分补全到y715。

[原生完整影层／覆盖／偏移拼图](inspection/relation-021-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 23. obi-inner-wrap

投影部件：`clothing:outer_waist_band`。接收面：`clothing:inner_waist_wrap`。

颜色 #7b5c76，multiply，图层不透明度 23%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 6]。

金色腰带下缘在深色腰封上的窄搭接暗带；较低不透明度让原腰封织物明暗透出。

[原生完整影层／覆盖／偏移拼图](inspection/relation-022-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 24. pendant-left-cloth

投影部件：`clothing:front_pendant_screen_left`。接收面：`clothing:kimono_body/right_underlap_panel`, `clothing:kimono_body/left_overlap_panel`。

颜色 #ab8192，multiply，图层不透明度 25%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 8]。

参考细绳和流苏右下的淡灰粉投影；同一吊坠父part来源一层，包含绳、珠、穗。画到被吊坠遮住处，6px横摆8px下移检查。

[原生完整影层／覆盖／偏移拼图](inspection/relation-023-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 25. pendant-right-cloth

投影部件：`clothing:front_pendant_screen_right`。接收面：`clothing:kimono_body/right_underlap_panel`, `clothing:kimono_body/left_overlap_panel`。

颜色 #ab8192，multiply，图层不透明度 25%。偏移（原画像素）：[0, 0], [-6, 0], [6, 0], [0, 8]。

参考细绳和流苏右下的淡灰粉投影；同一吊坠父part来源一层，包含绳、珠、穗。画到被吊坠遮住处，6px横摆8px下移检查。

[原生完整影层／覆盖／偏移拼图](inspection/relation-024-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 26. bracelet-left-hand

投影部件：`character:arms/arm_left/bracelet_pink_front`。接收面：`character:arms/arm_left/hand/palm`。

颜色 #efbbae，multiply，图层不透明度 55%。偏移（原画像素）：[0, 0], [-4, 0], [4, 0], [0, 5]。

参考手环下缘在腕掌处的窄暖色接触影；软笔刷画全遮挡内侧，不改原手掌/手指接触蒙版。 最终按腕环实际斜边重绘，去掉离环的浮影。

[原生完整影层／覆盖／偏移拼图](inspection/relation-025-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 27. bracelet-right-hand

投影部件：`character:arms/arm_right/bracelet_pink_front`。接收面：`character:arms/arm_right/hand/palm`。

颜色 #efbbae，multiply，图层不透明度 55%。偏移（原画像素）：[0, 0], [-4, 0], [4, 0], [0, 5]。

参考手环下缘在腕掌处的窄暖色接触影；软笔刷画全遮挡内侧，不改原手掌/手指接触蒙版。 最终按腕环实际斜边重绘，去掉离环的浮影。

[原生完整影层／覆盖／偏移拼图](inspection/relation-026-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 28. thigh-band-leg

投影部件：`character:legs/leg_left/thigh_band_front`。接收面：`character:legs/leg_left/leg`, `character:legs/leg_right/leg`。

颜色 #b4899a，multiply，图层不透明度 32%。偏移（原画像素）：[0, 0], [-5, 0], [5, 0], [0, 5]。

参考腿环下的浅紫接触暗边，投到袜面/腿面；不改变袜子本身的布料明暗。

[原生完整影层／覆盖／偏移拼图](inspection/relation-027-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 29. anklet-leg

投影部件：`character:legs/leg_right/anklet_front`。接收面：`character:legs/leg_left/leg`, `character:legs/leg_right/leg`。

颜色 #d2998e，multiply，图层不透明度 43%。偏移（原画像素）：[0, 0], [-4, 0], [4, 0], [0, 5]。

脚环下缘的窄肤色投影，保持脚背与腿自身明暗；隐藏到环内部，5px下移余量。

[原生完整影层／覆盖／偏移拼图](inspection/relation-028-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 30. bangs-sidehair

投影部件：`character:hair/bangs`。接收面：`character:hair/side_hair/side_hair_left`, `character:hair/side_hair/side_hair_right`。

颜色 #b36b81，multiply，图层不透明度 24%。偏移（原画像素）：[0, 0], [-7, 0], [7, 0], [0, 7]。

中央刘海压在两侧发面上的细粉影，左右细轮廓归同一bangs运动来源；隐藏在刘海后，软笔刷沿发丝窄带，原生接收隔离组嵌套于头饰联合接收base。

[原生完整影层／覆盖／偏移拼图](inspection/relation-029-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 31. leg-right-tail

投影部件：`character:legs/leg_right/leg`。接收面：`character:tail`。

颜色 #c28292，multiply，图层不透明度 25%。偏移（原画像素）：[0, 0], [-10, 0], [10, 0], [0, 12]。

参考腿间尾巴紧邻腿缘的偏紫粉暗带；只加接触投影，尾毛纹理及尾巴固有深粉明暗保留。软笔刷沿腿后延续，上方和侧向隐藏部分均画全，±10px横移检查。

[原生完整影层／覆盖／偏移拼图](inspection/relation-030-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

### 32. leg-left-tail

投影部件：`character:legs/leg_left/leg`。接收面：`character:tail`。

颜色 #c28292，multiply，图层不透明度 25%。偏移（原画像素）：[0, 0], [-10, 0], [10, 0], [0, 12]。

参考腿间尾巴紧邻腿缘的偏紫粉暗带；只加接触投影，尾毛纹理及尾巴固有深粉明暗保留。软笔刷沿腿后延续，上方和侧向隐藏部分均画全，±10px横移检查。

[原生完整影层／覆盖／偏移拼图](inspection/relation-031-review.png)。真实 UUID 与 clip base 在 shadows.json 中逐层登记。

## 未另建影层的暗面

未发现必须保留遗漏的、能够明确辨认的跨部件投影。鼻部与锁骨的柔肤色、耳内浅黄和粉色渐变、虹膜内部红褐／黄色层次、金属铃和狸饰自身体积明暗、衣服褶皱、辫子内部编织明暗、红色后发及尾毛固有色阶仍属于原部件。它们与 simplified 有画风和局部形状差异，未作为新的跨部件投影覆盖或改画。

## 原生检查与问题修复

最终检查：shadow/step01_mask/inspection.json

- passed=true，problems=[]。全部影层非空，真实 part、UUID、隔离 base 和原生透明度继承检查通过；相对移动没有新增角色裁切外 alpha。
- 原工程 143 个节点 UUID 全部保留，37 个原蒙版的 UUID、所属部件、启用状态及 x/y 均核对一致。详细记录：shadow/step01_mask/review/preservation.json
- 关闭所有新投影后，alpha 与原组装完全一致；843 个抗锯齿/半透明像素的 RGB 变化最大为 1/255，来自隔离组原生合成舍入。没有部件内容被涂改。
- 最终 PNG 与检查工具重新打开保存 KRA 的 native-final.png 逐像素相同。

处理中发现原生 removeChildNode 重归属时会脱离接收层的蒙版。已从只读原工程的内存副本恢复原蒙版对象；后来移动节点时先保留子节点引用，再附回同一 owner。早期检查也发现眼睛高光落在裁切 base 下方，已移回眼影之上。两类问题在最终检查中均已消失。

首批脖子与裙影偏深、裙影范围偏大、硬边主体有行笔间距条纹，已重绘。最终去掉影底的浅色边带，修正腕环浮影，并补平眼睑后隐藏影体。

三条 warnings 已看完整素材和全部声明偏移：

- side-left-backhair：影体是完整的连续软笔刷带，整个带位于更宽的补全后发内。±9px、下移8px没有截断或暴露缺口；不需要为消除数值提示而增加无关发外色块。
- pendant-left-cloth 与 pendant-right-cloth：细绳、珠、穗投影均已完整画出，所在衣面比投影宽得多。±6px、下移8px仍留在衣面内部，偏移结果线稿连续；无需把吊坠影拉到衣摆外。

上述 warnings 是裁切外像素计数提示，已完成视觉复核；没有剩余 problems。

## 原尺寸复核图

face-review.png 每格是 x=480,y=200 到 x=925,y=650 的 445 × 450 原尺寸裁切，没有缩小。首行依次为原组装、全部新影关闭、最终原生合成、simplified；后四行是中央刘海、两侧发及刘海到侧发的各声明偏移。



其余逐区复核图每行展示完整影体与全部声明偏移，裁切保持原画像素。完整影层本身的 PNG 是检查工具按记录 bounds 导出的原尺寸局部，偏移图则为完整 1376 × 2048。全尺寸原生文件位置逐项记在 inspection.json。

















## 保存文件

- shadow/step01_mask/character-shadowed.kra
- shadow/step01_mask/character-shadowed.png
- shadow/step01_mask/shadows.json
- shadow/step01_mask/face-review.png
- shadow/step01_mask/report.md
- shadow/step01_mask/inspection.json

原组装 KRA SHA-256：c0d9866e97261c77e8efe37c2a63b5ee5630941521679f4973428d175657a90d

所有上游文件均未写入；另一阴影分支未操作。
