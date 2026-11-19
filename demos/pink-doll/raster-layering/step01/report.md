# 人物分层与补全

已保存 1254 × 1254 的人物 KRA，包含 58 个逻辑部件、60 个绘画层和 5 张原生透明度蒙版。默认姿态为双眼睁开、张口微笑、下齿由舌面、下唇和共同开口遮蔽。保持发束、四肢和面部特征的独立绑定层。

- 工程 `raster-layering\step01\character-depth.kra`
- 默认状态的透明 PNG `raster-layering\step01\character-depth.png`
- 原画坐标与笔触依据 `part-layering\references\base-subject.png`
- 重开一致性记录 `raster-layering\step01\workspace\repair-01-roundtrip.json`

## 绘制与修整

每件先制作三色控制图与中性灰可见参考。小部件放大后按格生成，各格独立配准。每件从自身生成画面起稿。局部取样沿其可见笔触与自己的形体接续，用 Krita 画笔补肩口、颈侧的软过渡。原图的投影按来源剔除，保留头发褶面的纵向明暗、手指内侧暖面、膝部体积和鞋袜细线。

中央后发从顶弧连续铺到背面发梢，补全区保留宽发束交叠、内侧暗褶、两侧细尖与回卷。眼白补成整片，虹膜独显保留完整深色环、瞳孔和层次，高光单独分层。头发按实体深度盖住眉尾，眉线保留完整底纹。运行中检查了眼白与上睫毛的直接衔接、手掌与指根间的亮肤连续性和连体服腰部原有的纵向缝线。

## 层级与色块差异

- 上游预先标注的多深度部件为 0。本次组装确认现有深度 `0` 至 `57` 可表达参考的前后关系，新增多深度分片为 0。眼内和口内的组嵌套遵循组内原有深度，未调用分组或深度修改工具。
- 骨盆部件 `pelvis` 在腰线内侧补入最多 3 px 的布料搭接，沿已存在的布料走向接住 `body`。两侧 `y=544–640` 以原画布料侧缘重新收形，在发束后保留薄搭接，修正上游补全形状在腰侧露出的小角。
- `face/blush_left` 和 `face/blush_right` 在原有排线外缘补柔和红晕底色。`face/nose` 在原鼻点邻近补柔边。排线和鼻点的位置与上游一致。
- 手部掌指交界在原绘画范围内调整了不足整像素的边缘覆盖。左右手和双眼各自生成、配准与修画，未镜像复用。下表的 PNG 列是该部件的生成来源，均保存在 `raster-layering\step01\workspace\generated`。

## 首次制作绘画层

| 最终深度 | 原 part ID | KRA 图层名 | 原生 UUID | 区域与层序依据 | 生成来源 |
| ---: | --- | --- | --- | --- | --- |
| 0 | `hair/back_hair/lock_left` | `00 hair/back_hair/lock_left` | `3d19fa76-524d-44ab-9dab-dc57fce660c7` | 画面右侧外垂发束，耳后根端伸到 hair/bun/bun_left 与 hair/back_hair/base 接合下方，垂段在同侧手臂和胸前束之后。 | `rear-locks.png` |
| 1 | `hair/back_hair/lock_right` | `01 hair/back_hair/lock_right` | `e246fc9e-c505-47f0-8766-d24ecdf31be1` | 画面左侧外垂发束，耳后根端在 hair/bun/bun_right 与 hair/back_hair/base 之后，臂外露段与腕旁发尖在手臂后方连续。 | `rear-locks.png` |
| 2 | `hair/bun/bun_left` | `02 hair/bun/bun_left` | `4d7bc4df-2b72-4162-9061-c62e9a8e0410` | 画面右侧编股盖 hair/back_hair/lock_left 根段，向内伸入 hair/back_hair/base 与 hair/side_hair/side_hair_left 的包边后。 | `buns-accessory.png` |
| 3 | `hair/bun/bun_right` | `03 hair/bun/bun_right` | `cf4989b3-cff4-40e8-a727-1c200fd339ea` | 画面左侧编股盖 hair/back_hair/lock_right 根段，靠头的接缘入 hair/back_hair/base 和 hair/side_hair/side_hair_right 下，上前部被 head_accessories 覆盖。 | `buns-accessory.png` |
| 4 | `hair/back_hair/base` | `04 hair/back_hair/base` | `5627df70-765a-4db5-b68e-a4df570d050e` | 承担分缝后方头顶外弧及中央背发，侧根承接髻根和外垂束，正面层位在颈、脸、胸和前侧发束之后。 | `back-base.png` |
| 5 | `legs/leg_left` | `05 legs/leg_left` | `66897033-654d-48fb-b674-651fcce376eb` | 画面右侧髋端伸入 pelvis 的连体服腿口下，髋前由 hair/front_long_hair/front_long_hair_left 的弯尖遮挡。袜鞋随腿。 | `legs.png` |
| 6 | `legs/leg_right` | `06 legs/leg_right` | `cad62bde-fd4f-4a80-b8a2-4ac6e55e2ac0` | 画面左侧髋端由 pelvis 的腿口包边覆盖，hair/front_long_hair/front_long_hair_right 的尖梢在大腿根前。袜鞋随腿。 | `legs.png` |
| 7 | `pelvis` | `07 pelvis` | `c9eda606-5a95-47fc-a5d1-c907198ba8eb` | 连体服下段承担两侧腿口和裆底包边，罩住双腿近端。腰口与 body 同材接合，上缘伸到 body 下，髋侧被双前长发遮挡。 | `torso.png` |
| 8 | `arms/arm_left/hand/little_finger` | `08 arms/arm_left/hand/little_finger` | `2865c6c1-9aa4-4a25-a3c2-54f42d88beda` | 画面右手组内最靠后，掌体、无名指和拇指分别覆盖根部及内叠指段，拇指指尖下露出最高暖色指尖。 | `hand-left.png` |
| 9 | `arms/arm_left/hand/ring_finger` | `09 arms/arm_left/hand/ring_finger` | `6e16d924-22a8-449b-8b57-5072cc04ecbc` | 画面右侧三暖色指尖中间一枚，盖小指，由中指和掌缘覆盖。 | `hand-left.png` |
| 10 | `arms/arm_left/hand/middle_finger` | `10 arms/arm_left/hand/middle_finger` | `3b0d77ea-19c2-4367-97f3-f118487079db` | 画面右侧暖色最低圆指尖，盖无名指，食指内缘和掌体遮住其部分指身与根段。 | `hand-left.png` |
| 11 | `arms/arm_left/hand/index_finger` | `11 arms/arm_left/hand/index_finger` | `abcd98bf-4dd2-44bd-b571-c8ae9c8d667f` | 画面右侧手外缘的浅色长指，盖中指，近端搭入掌体；手外轮廓与掌侧连续。 | `hand-left.png` |
| 12 | `arms/arm_left/hand/thumb` | `12 arms/arm_left/hand/thumb` | `8b2f7748-1bdf-4b2e-96fd-847f2d1a95ed` | 画面右手靠躯干的一侧，圆指尖和指身在小指内叠段之前，根端伸入掌体的掌侧连接之后。 | `hand-left.png` |
| 13 | `arms/arm_left/hand/palm` | `13 arms/arm_left/hand/palm` | `37da5a78-27b2-46e0-a03d-23513fa2a3f4` | 掌体持有虎口、掌侧及远掌连接转折，覆盖各指的近端余量；近腕圆端由 arms/arm_left/forearm 覆盖。 | `hand-left.png` |
| 14 | `arms/arm_left/forearm` | `14 arms/arm_left/forearm` | `85541358-95df-4d69-b657-1009ffb22f7a` | 在外侧后发前，肘端伸入 arms/arm_left/upper_arm 后，腕端持有收窄转折并覆盖 arms/arm_left/hand/palm 的近腕余量。 | `arms.png` |
| 15 | `arms/arm_left/upper_arm` | `15 arms/arm_left/upper_arm` | `7160fadb-559e-4013-83d0-7eb59270b2f0` | 肩端伸入 body 的圆肩覆盖侧，内缘在左胸前束后，肘端罩住 arms/arm_left/forearm 的根端。 | `arms.png` |
| 16 | `arms/arm_right/hand/ring_finger` | `16 arms/arm_right/hand/ring_finger` | `0e755446-5a90-465a-b22c-6f41f3500b39` | 画面左手三枚内叠暖色指尖中最低一枚，近端在中指、小指和掌体之后。 | `hand-right.png` |
| 17 | `arms/arm_right/hand/middle_finger` | `17 arms/arm_right/hand/middle_finger` | `7afdecfa-bf6d-4a4a-a7b3-348a8b268f63` | 指尖处于食指与无名指之间，搭在无名指前方，近端藏入掌体和食指下。 | `hand-right.png` |
| 18 | `arms/arm_right/hand/index_finger` | `18 arms/arm_right/hand/index_finger` | `16e23aca-0832-4498-9b58-22261d207ed2` | 内叠三指中最高一枚，从拇指尖下露出，在中指之前、掌体和拇指之后。 | `hand-right.png` |
| 19 | `arms/arm_right/hand/little_finger` | `19 arms/arm_right/hand/little_finger` | `a8b933cc-2b65-4246-bf45-6d1239cd5650` | 画面左侧浅色外缘指覆盖无名指偏外根段，近端与掌体的外侧连续。与其余指仅按实际接触判断。 | `hand-right.png` |
| 20 | `arms/arm_right/hand/thumb` | `20 arms/arm_right/hand/thumb` | `8c1c4e43-1f46-4659-a8c5-69024f647218` | 画面左手靠躯干的浅色拇指，末端盖食指，近端伸入掌体持有的掌侧连接下。 | `hand-right.png` |
| 21 | `arms/arm_right/hand/palm` | `21 arms/arm_right/hand/palm` | `e0267803-d8a6-45d9-b6c9-2c00047ceab1` | 掌体持有掌侧、外掌缘与虎口转折，覆盖进入掌体的指根余量，腕端由 arms/arm_right/forearm 覆盖。 | `hand-right.png` |
| 22 | `arms/arm_right/forearm` | `22 arms/arm_right/forearm` | `4a3cd6c9-e952-4c3a-bb02-4776e9100853` | 越过外侧后发前面，肘端伸入 arms/arm_right/upper_arm 之下，腕端覆盖 arms/arm_right/hand/palm。 | `arms.png` |
| 23 | `arms/arm_right/upper_arm` | `23 arms/arm_right/upper_arm` | `9726363c-b14c-481a-8b21-d53757919b49` | 肩端搭在 body 圆肩面之后，内缘由右胸前长束遮挡，肘端覆盖 arms/arm_right/forearm。 | `arms.png` |
| 24 | `neck` | `24 neck` | `ab20c25e-4f8a-47a7-9ff4-2b5ce80059c7` | 颈面在 hair/back_hair/base 前面，上端由 face/face_base 的下颌线盖住，下端在 body 承接的颈根和锁骨接面后。 | `face-features.png` |
| 25 | `body` | `25 body` | `8346528c-69b1-48ec-968b-a687d41ac861` | 锁骨、领口、双侧圆肩和上腹归此叶。圆肩覆盖双上臂的近端，颈根承接 neck，腹部覆盖 pelvis 上缘；胸肩两侧被前长发遮挡。 | `torso.png` |
| 26 | `face/ears/ear_left` | `26 face/ears/ear_left` | `af7fbba5-8f9f-4d7c-af0f-fa841b046d1d` | 画面右侧，耳根伸入 face/face_base 脸缘下方，耳上部由 hair/side_hair/side_hair_left 遮挡，保留短耳底。 | `face-features.png` |
| 27 | `face/ears/ear_right` | `27 face/ears/ear_right` | `36afd0de-0ba6-4e30-ab1e-8a8e13b89032` | 画面左侧，耳根与 face/face_base 接合，宽侧发遮去大部耳廓，保留短尖下方的圆弧耳底。 | `face-features.png` |
| 28 | `face/face_base` | `28 face/face_base` | `33ed522e-65e8-4ff3-a48d-92ca9a407d70` | 整块额颊和下颌，压住 neck 的上端及双耳根，承载眼口底与表情细件，额缘及脸侧由刘海和宽侧发遮挡。 | `face-features.png` |
| 29 | `face/eyes/eye_left/sclera` | `29 face/eyes/eye_left/sclera` | `cd4a1308-54eb-421c-8eb1-83923cf36999` | 在脸底前、左虹膜及上睑后。画面右眼以 face/eyes/eye_left/upper_eyelid 的朝眼白内缘为上界，以 face/eyes/eye_left/sclera 下沿为下界，两眼角闭合边界。默认睁眼，范围仅限本眼的 face/eyes/eye_left/sclera、face/eyes/eye_left/iris、face/eyes/eye_left/highlight，开口外隐藏。 | `sclera.png` |
| 30 | `face/eyes/eye_left/iris` | `30 face/eyes/eye_left/iris` | `a0388200-56bf-4b7c-a367-c1c78ebe6f6f` | 在左眼白前、高光和上睑后。与 face/eyes/eye_left/highlight 同受 face/eyes/eye_left/upper_eyelid 内缘至 face/eyes/eye_left/sclera 下沿所围开口控制，默认睁眼显示开口内，睑后隐藏。 | `eye-left.png` |
| 31 | `face/eyes/eye_left/highlight` | `31 face/eyes/eye_left/highlight` | `1d39cd92-8a6b-4eeb-82ff-daf95be0a081` | 左虹膜前的两个亮点，与 face/eyes/eye_left/iris 一同受 face/eyes/eye_left/upper_eyelid 内缘至 face/eyes/eye_left/sclera 下沿所围开口控制。默认睁眼，开口内可见。 | `eye-left.png` |
| 32 | `face/eyes/eye_left/lower_eyelashes` | `32 face/eyes/eye_left/lower_eyelashes` | `bac971c6-612e-4eae-b93c-71fec7db71a7` | 画面右眼下缘疏点，在 face/face_base 前方，沿 face/eyes/eye_left/sclera 下沿附近保持间隔，随下缘运动。 | `eye-left.png` |
| 33 | `face/eyes/eye_left/eyelid_crease` | `33 face/eyes/eye_left/eyelid_crease` | `eaa7f204-727b-444b-bed3-b3c8e5e57c15` | 画面右眼内侧上方暖色独立睑褶，贴在 face/face_base 前，位于刘海后方；随 face/eyes/eye_left/upper_eyelid 变形。 | `eye-left.png` |
| 34 | `face/eyes/eye_right/sclera` | `34 face/eyes/eye_right/sclera` | `b3401516-70b8-4088-befd-8fb5a4b6afb5` | 在脸底前、右虹膜及上睑后。画面左眼由 face/eyes/eye_right/upper_eyelid 内缘和 face/eyes/eye_right/sclera 下沿构成开口，两眼角闭合边界。默认睁眼，仅控制本眼的 face/eyes/eye_right/sclera、face/eyes/eye_right/iris、face/eyes/eye_right/highlight，开口外隐藏。 | `sclera.png` |
| 35 | `face/eyes/eye_right/iris` | `35 face/eyes/eye_right/iris` | `7b511ccd-dd7c-442a-9ad5-8bcf9eafe39a` | 在右眼白前、右高光和上睑后。与 face/eyes/eye_right/highlight 共用由 face/eyes/eye_right/upper_eyelid 内缘和 face/eyes/eye_right/sclera 下沿限定的开口。默认睁眼露出开口内，睑后隐藏。 | `eye-right.png` |
| 36 | `face/eyes/eye_right/highlight` | `36 face/eyes/eye_right/highlight` | `c7b4813c-3cd9-423d-a369-9073d04ac264` | 在右虹膜前、上睑之下，亮点随 face/eyes/eye_right/iris 共用由 face/eyes/eye_right/upper_eyelid 内缘和 face/eyes/eye_right/sclera 下沿限定的开口。默认睁眼可见开口内。 | `eye-right.png` |
| 37 | `face/eyes/eye_right/lower_eyelashes` | `37 face/eyes/eye_right/lower_eyelashes` | `91dce22a-7cd5-4194-bf5d-2f680c3f0209` | 画面左眼下缘短睫毛点，沿 face/eyes/eye_right/sclera 下沿，在 face/face_base 前，随眼下缘运动。 | `eye-right.png` |
| 38 | `face/eyes/eye_right/eyelid_crease` | `38 face/eyes/eye_right/eyelid_crease` | `42b557c5-371c-49e1-88dc-963318681f9b` | 画面左眼靠鼻端上方的浅暖肤面褶线，随 face/eyes/eye_right/upper_eyelid 运动，在刘海之后。 | `eye-right.png` |
| 39 | `face/eyebrows/eyebrow_left` | `39 face/eyebrows/eyebrow_left` | `17c3e10f-b0c5-4465-83d7-738cf6f54ebb` | 画面右眉位于脸底前，眉身经发缝连续，hair/bangs 覆盖交叠部分。 | `face-features.png` |
| 40 | `face/eyebrows/eyebrow_right` | `40 face/eyebrows/eyebrow_right` | `b90a1a07-f740-46ef-aacd-e08cdf8914a7` | 画面左眉位于脸底前，眉身及眉头间被 hair/bangs 截断，露出按实际发缝。 | `face-features.png` |
| 41 | `face/nose` | `41 face/nose` | `f70d3d33-2010-40f1-81d2-ef0e8aa9166b` | 鼻点和淡亮部贴于 face/face_base 中央，在双眼以下、嘴以上。 | `face-features.png` |
| 42 | `face/mouth/mouth_interior` | `42 face/mouth/mouth_interior` | `5b63fae1-0571-47ce-9316-1d08a8a9e726` | 在 face/face_base 前、口内齿舌后。由 face/mouth/upper_lip 与 face/mouth/lower_lip 的朝口腔内缘及两嘴角连接围成开口，默认张口微笑。该开口裁切 face/mouth/mouth_interior、face/mouth/upper_teeth、face/mouth/lower_teeth、face/mouth/tongue，闭合时口内整体遮隐。 | `mouth.png` |
| 43 | `face/mouth/lower_teeth` | `43 face/mouth/lower_teeth` | `525e1431-2e27-4098-9474-6c5965751718` | 完整下齿位于口腔底前、舌和下唇后，贴下唇内侧运动。face/mouth/upper_lip 与 face/mouth/lower_lip 的内缘闭合到两嘴角，控制整组口内内容的显露；参考默认下齿全隐，原开口下方由下唇覆盖。 | `mouth.png` |
| 44 | `face/mouth/tongue` | `44 face/mouth/tongue` | `d134a61a-30c0-4280-890c-465711cb483e` | 口腔下部粉色舌面在 face/mouth/mouth_interior 和 face/mouth/lower_teeth 之前，由 face/mouth/upper_lip 与 face/mouth/lower_lip 内缘沿两嘴角构成的开口控制，默认露出下半部，闭口时隐藏。 | `mouth.png` |
| 45 | `face/mouth/upper_teeth` | `45 face/mouth/upper_teeth` | `f6bf6c6f-b247-4336-b82d-642ec610036c` | 浅色上齿带贴在上唇朝口腔的边缘下方，在口腔底前。face/mouth/upper_lip 与 face/mouth/lower_lip 内缘沿两嘴角共同裁切，默认只显示开口顶端齿带。 | `mouth.png` |
| 46 | `face/mouth/lower_lip` | `46 face/mouth/lower_lip` | `23429232-a275-4108-b2bf-c44765e842c6` | U 形唇线持有开口下界，前盖舌及下齿。与 face/mouth/upper_lip 内缘在嘴角接合，裁切 face/mouth/mouth_interior、face/mouth/upper_teeth、face/mouth/lower_teeth、face/mouth/tongue，参考默认张口且下齿全隐。 | `mouth.png` |
| 47 | `face/mouth/upper_lip` | `47 face/mouth/upper_lip` | `2c8d105f-1256-416c-9f8d-9b9f2cc27476` | 上唇线持有开口上界并覆盖上齿根。与 face/mouth/lower_lip 内缘在两嘴角接合，裁切 face/mouth/mouth_interior、face/mouth/upper_teeth、face/mouth/lower_teeth、face/mouth/tongue，默认张口露上齿带、舌面及口腔底。 | `mouth.png` |
| 48 | `face/blush_left` | `48 face/blush_left` | `4af2b4f1-0466-464d-83ca-85ebb7e10bcb` | 画面右眼下的细斜粉线，在 face/face_base 的普通颊红前方，靠耳侧止于脸面。 | `face-features.png` |
| 49 | `face/blush_right` | `49 face/blush_right` | `51ba9a37-c69a-4c99-b7de-ec700c5ebdee` | 画面左眼下的细斜粉线，在 face/face_base 的普通颊红前方，靠耳侧止于脸面。 | `face-features.png` |
| 50 | `hair/front_long_hair/front_long_hair_left` | `50 hair/front_long_hair/front_long_hair_left` | `f4198c1a-a6ff-4028-8fbd-f7e400b81a42` | 画面右侧胸前束，根端在 hair/side_hair/side_hair_left 后，垂段在体侧、臂内缘、衣身和髋前。 | `long-front.png` |
| 51 | `hair/front_long_hair/front_long_hair_right` | `51 hair/front_long_hair/front_long_hair_right` | `3744e261-2aae-4e87-828f-b26b6412e3a0` | 画面左侧胸前束，根端在 hair/side_hair/side_hair_right 后，垂段在体侧、臂内缘、衣身和髋前。 | `long-front.png` |
| 52 | `hair/side_hair/side_hair_left` | `52 hair/side_hair/side_hair_left` | `8c891a9a-a54e-4b2a-9603-71b9fff80ce9` | 画面右侧宽侧发在耳、脸缘和长束根前。头顶根端在刘海根区下，外眼角与上睑尖相邻。 | `hair-face-frame.png` |
| 53 | `hair/side_hair/side_hair_right` | `53 hair/side_hair/side_hair_right` | `fcab6dd0-feac-4ddd-9261-2ea67425779e` | 画面左侧宽侧发在耳、脸缘和长束根前。头顶根端在刘海根区下，外眼角与上睑尖相邻。 | `hair-face-frame.png` |
| 54 | `hair/bangs` | `54 hair/bangs` | `8f52de64-6df2-498b-885b-4bfe234ad388` | 前额发面承接分缝下方，位于脸底和双眉前，额前间隙保留露出的眉段，根区覆盖宽侧发内端。 | `hair-face-frame.png` |
| 55 | `face/eyes/eye_left/upper_eyelid` | `55 face/eyes/eye_left/upper_eyelid` | `37c242f7-5c5d-4a1c-80f7-84b3bab48175` | 深色上睑在本眼内容前，维持外眼角原图的完整睫毛尖。与 face/eyes/eye_left/sclera 下沿围成画面右眼开口，由上睑的朝眼白内缘定上界，从内眼角闭合至外眼角。控制 face/eyes/eye_left/sclera、face/eyes/eye_left/iris、face/eyes/eye_left/highlight。参考默认睁开，开口外不可见。 | `eye-left.png` |
| 56 | `face/eyes/eye_right/upper_eyelid` | `56 face/eyes/eye_right/upper_eyelid` | `0a88eacb-37dd-4fee-a591-94af26ddcee2` | 深色上睑在本眼内容前，在外眼角保留原图可见的睫毛尖。与 face/eyes/eye_right/sclera 下沿围成画面左眼开口，由上睑内缘定上界，从内眼角闭合至外眼角。控制 face/eyes/eye_right/sclera、face/eyes/eye_right/iris、face/eyes/eye_right/highlight。参考默认睁开，开口外不可见。 | `eye-right.png` |
| 57 | `head_accessories` | `57 head_accessories` | `4d89065d-283b-4ce8-bf27-240f10d567ba` | 黑结与圆珠在画面左髻前面，压住 hair/bun/bun_right 上前部，内侧贴头顶外缘。 | `buns-accessory.png` |

## 原生开合蒙版

| 所属图层或组 | 蒙版名 | 原生 UUID | 控制区域 |
| --- | --- | --- | --- |
| face/eyes/eye_left ｜虹膜与高光 | 眼白范围 ｜虹膜与高光 | `34531a22-26d7-45f2-9ce1-c54469a52b24` | 限制虹膜和高光在眼白范围内移动，保留上缘与睫毛的搭接。 |
| face/eyes/eye_left ｜眼内 | 上睑内缘与眼白下沿 ｜眼开合 | `196c2ed5-4326-4683-9dd2-b162e3d105e9` | 控制整组眼白、虹膜和高光。上缘与上睑搭接，开口下缘取眼白下沿。 |
| face/eyes/eye_right ｜虹膜与高光 | 眼白范围 ｜虹膜与高光 | `eb9bd8c6-95b9-4116-b87e-cc3c5fb487a6` | 限制虹膜和高光在眼白范围内移动，保留上缘与睫毛的搭接。 |
| face/eyes/eye_right ｜眼内 | 上睑内缘与眼白下沿 ｜眼开合 | `1056e26c-666a-423c-b613-cbaaafaa60f0` | 控制整组眼白、虹膜和高光。上缘与上睑搭接，开口下缘取眼白下沿。 |
| face/mouth ｜口内 | 上下唇开口 ｜默认微笑 | `2cc8673c-3a8d-4b2b-ad31-ecb9a126d885` | 约束口腔底、齿带和舌面在上下唇所围的微笑开口内。 |

下图左为当前默认微笑，中为扩大共同开口后单独查看下齿，右为下齿完整纹理。默认微笑只用共同开口蒙版和舌唇叠压约束下齿。检查后已复位，正式 PNG 取复位状态。



## 视觉验收与重开

整图自左向右为原画、首次制作合成、返修后的合成。各图使用相同原画布坐标和像素比例。



双眼原尺寸与等倍率放大对照自左向右对应原画、首次制作与返修后。逐眼核对形状、睑缘收笔、外眼角钩、眼白与睫毛的搭接、虹膜暗边与亮点。下齿层禁用蒙版后的完整形状见独显页。





以下为首次制作的全层独显存档。返修后各问题的独显、隐藏较前层和合成对照以返修证据为准。 [00–11](evidence/layers-1.png) · [12–23](evidence/layers-2.png) · [24–35](evidence/layers-3.png) · [36–47](evidence/layers-4.png) · [48–57](evidence/layers-5.png)

保存后关闭工程并从正式路径重新打开。逐层验证图层树、名称、UUID、可见性、蒙版像素与绘画像素完全一致。重开合成与透明 PNG 像素一致。

## 已恢复的工具异常

- 手臂初次生图遇到 `http 400 Bad Request`、`moderation_blocked`，工具原文为 “Your request was rejected by the safety system.”，请求 ID 为 `d75ce237-31ed-45f7-9b01-e85309157c7e`。重试后成功取得肤色手臂部件并配准。
- Krita 剪贴板选择区粘贴在该运行环境返回零像素。局部取样改用同一份 Krita 原图节点在相同坐标读取，并以原有选区权重写回所属绘画层。取样节点已从工程移除。

## 第一轮复核返修存档

复核的 R01–R37 已完成处理。原 58 个绘画层的部件归属、深度与 UUID 保持一致。移除原下齿专用全关蒙版，口内仍由共同开口与舌唇实际轮廓控制。默认微笑没有下齿露出，扩大开口检查可见完整下齿纹理。

重做的部分包括中央后发、两侧外垂后发、两侧胸前发根及躯干与髋片。原表记录首次生成来源，新生图和局部修画来源详见返修记录。亚像素外缘及隐藏薄搭接已按原形复核。

[最新整图对照](repair-01-evidence/overall.png) · [首项三视图](repair-01-evidence/R01.png) · [下齿开口控制](repair-01-evidence/teeth-opening.png)

## 第二轮复核返修

R01–R37 已逐项返修并保存三视图。使用原画同坐标检查双眼，以及关蒙版后完整眼内纹理。原有 58 个逻辑部件保留，新增加 2 个同部件前景分片，实际为 60 个绘画层。原有绘画层的 UUID 保留，五张原生开口蒙版继续使用相同的选择区。

在 `part-layering\occlusion.json` 同步记录两个眉部件的真实前后穿插。组树和部件身份维持原绑定职责。画面右眉的前片新增在 54.1，画面左眉的前片新增在 54.2，均在 54 刘海之后绘制并位于上睑以下的绘画深度。表中同 part 的前后片共同绑定。

| 最终深度 | 原逻辑 part ID | 实际绘画层名 | 原生 UUID | 区域与说明 |
| ---: | --- | --- | --- | --- |
| 39 | `face/eyebrows/eyebrow_left` | `39 face/eyebrows/eyebrow_left` | `17c3e10f-b0c5-4465-83d7-738cf6f54ebb` | 画面右眉贴肤和宽发后段 |
| 40 | `face/eyebrows/eyebrow_right` | `40 face/eyebrows/eyebrow_right` | `b90a1a07-f740-46ef-aacd-e08cdf8914a7` | 画面左眉贴肤和宽发后段 |
| 54.1 | `face/eyebrows/eyebrow_left` | `54.1 face/eyebrows/eyebrow_left` | `313363af-35a7-4356-9ab7-e4b1a0a27166` | 画面右眉跨过细发绺的可见淡线 |
| 54.2 | `face/eyebrows/eyebrow_right` | `54.2 face/eyebrows/eyebrow_right` | `332b8ff9-82ce-4dbf-b400-505d625396d9` | 画面左眉跨过细发绺的可见淡线 |

[画面左眉分片与刘海](repair-02-evidence/brow-left.png) · [画面右眉分片与刘海](repair-02-evidence/brow-right.png)

本次局部外形调整包括额前窄尖与鬓发耳前尖、隐藏底发下摆、原侧缘布面、肩肘与指根薄搭接、髋外细边及裆底包边。下唇新增延至下齿外侧的同层薄肤面，停用共同口内蒙版时，当前姿态仍由舌和下唇实体遮住完整下齿。扩大开口与下齿独显验证后恢复默认姿态。



正式工程保存并重开，60 张绘画层、5 张原生蒙版及默认合成的像素一致。更新后的 PNG 与重开合成一致。记录 `raster-layering\step01\workspace\repair-02-roundtrip.json`。

[整图同尺寸](repair-02-evidence/overall.png) · [画面左眼 1∶1](repair-02-evidence/eye-screen-left-native.png) · [画面右眼 1∶1](repair-02-evidence/eye-screen-right-native.png) · [画面左眼 4×](repair-02-evidence/eye-screen-left-zoom.png) · [画面右眼 4×](repair-02-evidence/eye-screen-right-zoom.png) · [腕掌](repair-02-evidence/hands.png) · [肩颈与躯干](repair-02-evidence/body.png)
