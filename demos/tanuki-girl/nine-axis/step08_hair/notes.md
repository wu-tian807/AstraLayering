当前已完成前发＋侧发的 left/right（Y=0）。侧发本轮结果、检查图和后续交接在文末；以下保留前发首轮记录，已接入的投影状态已更新。

前发首轮已完成 left / right，固定 Y=0。正式工程已在 Krita 保存：

- KRA：nine-axis/step08_hair/character-nine-axis.kra
- 累计作者模型：nine-axis/step08_hair/hair.json
- 累计预览模型：nine-axis/step08_hair/deformers.json
- KRA 正面合成导出：nine-axis/step08_hair/character-nine-axis.png

本轮绑定与形变

Krita 确认的刘海为 `D84 | hair/bangs`，UUID `e2e38ffb-ec15-4ab7-aebb-fe1b504dbb42`，原生范围 [613,199,189,249]。独立投脸层为 `Cast bangs-to-face`，UUID `60087679-298f-421c-8b1a-4b710dc21fca`，范围 [616,188,200,261]，保留 multiply 与 46/255 不透明度。两层均显式确认绑定，置于 `warp/bangs_x`；投影继续以 `face/face_base` 当前 alpha 动态裁切。

承载 Warp 范围 [600,185,820,460]，16×16，空间 smooth。X 关键形为 -30、-22.5、-15、-7.5、0、7.5、15、22.5、30。中间形以正弦位移和余弦透视弧面构造，再由模型插值；刘海和投脸同一承载，仅应用一次运动。新增 Y/XY 关键形均为零项。

left 按 2.75 秒选定帧逐束对应：中央长束尖端由原画约 [738,446] 到 [674,445]，细弯束尖端约 [749,393] 到 [679,393]；远侧额角束收窄并稍抬，近侧束保留厚度。描线、浅色高光、内侧暗边随同一连续曲面转向。right 在原生不对称画稿上施加反向透视，保留中央长束长度和原有发流。

原画已包含完整发顶与隐藏连接段，本轮沿原生发片保持延伸。头顶持续被头饰遮挡的部分按可见弧线续接。无需补绘像素；正面形状、纹理、颜色和原生投影均完整保留。

描线与核对

source / target 位于 nine-axis/step08_hair/outline/ 。`source.svg` 为真实 alpha 轮廓及主要发流；`target-left.svg` 为参考可见弧线与发束对应，隐藏冠顶为推导；`target-right-inferred.svg` 记录右转推导轮廓。`correspondence.json` 留存同束地标。放大核对后将 target 的折线草稿修成连续弧线，最终形变排除了初稿的局部紧曲率。

所有叠边使用原画布固定 referenceBounds=[319,-21,774,774]，未重居中或缩放迁就模型。视频只按原有 960→774 的参考尺寸转换。









完整查看 X=-30、0、30 与 ±7.5、±15、±22.5，形状保持同一发型；细弯束与中央长束没有交换，投影随动并限制在脸底内。另按鼻口与眼部朝向选择视频 2.00 秒约 X=-19、2.375 秒约 X=-24.5，独显轮廓与原色发流均连续对应。视频时间不等同于线性参数角度。









保护核对结果保存在 nine-axis/step08_hair/review/protection-check.json 和 nine-axis/step08_hair/review/geometry-check.json 。与上游比较，所有受保护节点的几何、关键形、绑定、裁切和顺序保持原样；仅刘海与投脸增加父 Warp。按原生瓦片坐标核对 428 份图层数据和附件，像素数据完全一致，KRA 合成 PNG 一致。Krita 保存把三层的空默认 channellockflags 规范化为 1111，已在保护记录列明；图层可见、混合、不透明度、位置与 UUID 保持一致。正面 Warp 最大偏差 0。以 0.5° 间隔检查 121 个方向，最小网格有向面积约 134.15，未出现反向网格。

后续挂接与未解决项

本轮仅接入双方均就绪的“刘海投脸”。以下图层已在 Krita 确认，保持原生 KRA 内容，待接收部件/投影来源完成后注册：

| 原生投影与 UUID | 来源 → 接收 | 后续挂接 |
| --- | --- | --- |
| Cast bangs-to-side-right / `3ba6cbb6-32b8-4387-bce9-c92aecc2dc25` | hair/bangs → hair/side_hair/side_hair_right | 已在侧发轮注册 `hair/cast/bangs_to_side_right`；沿用 `warp/bangs_x`，按侧发动态裁切 |
| Cast bangs-to-side-left / `4799553b-d8a0-4438-9438-f93f4af264a9` | hair/bangs → hair/side_hair/side_hair_left | 已在侧发轮注册 `hair/cast/bangs_to_side_left`；沿用 `warp/bangs_x`，保留 multiply、87/255 |
| Cast tanuki-body-to-bangs / `88340945-0e67-4954-8902-ba7673ad1236` | head_accessories/tanuki_ornament/tanuki_body → hair/bangs | 头饰轮随狸猫本体承载；按刘海当前 alpha 裁切；multiply、76/255 |
| Cast paw-right-to-bangs / `d609bd9d-22af-4f2d-b71f-0e5d8e927863` | head_accessories/tanuki_ornament/paw/paw_right → hair/bangs | 头饰轮随对应爪子；按刘海裁切；multiply、107/255 |
| Cast paw-left-to-bangs / `40f7def8-64cd-44e7-98ac-efa974b6b496` | head_accessories/tanuki_ornament/paw/paw_left → hair/bangs | 同上 |

侧发轮需沿刘海外侧完整弧线保留搭接，并在额角与上段发根核对遮挡，尤其 left 的画面左侧细束与近侧宽束接触。头饰轮需核对爪子压发、冠顶覆盖以及三层投刘海阴影。当前预览只包含已完成脸部与本轮刘海，侧发、后发、头饰组合的最终遮挡属于后续轮次。本轮刘海外缘与连接余量已保留。

right 缺少独立转头视频，采用原画两侧差异及 left 曲面运动推导，后续完整发型协调时仍需复核。当前可编辑前发范围内未留阻塞问题。正面与上游所有已完成部件保持保护；本轮未更改任务完成标记或轮次状态文件。


侧发第二轮结果

2026-11-15：侧发 left/right 已完成。沿用并保存 nine-axis/step08_hair/character-nine-axis.kra 与 nine-axis/step08_hair/hair.json 。当前累计模型与 nine-axis/step08_hair/deformers.json 同步。

Krita 确认并绑定的侧发与投影：

| 部件或投影 | UUID | 承载与裁切 |
| --- | --- | --- |
| D82 / hair/side_hair/side_hair_left，原生 [724,212,205,298] | `bde7e205-6062-4346-a420-e78844b50ac5` | `warp/side_left_x` |
| D83 / hair/side_hair/side_hair_right，原生 [489,212,199,291] | `ccf27b6d-49e0-40a9-9a4d-17c7bc104c41` | `warp/side_right_x` |
| side-left-to-face / hair/cast/side_left_cast | `f30f28b6-7871-4e5a-b6f4-b495378e574b` | 随 `warp/side_left_x`；clip 到 face/face_base；multiply，71/255 |
| side-right-to-face / hair/cast/side_right_cast | `08060cff-3e90-407b-972e-283f8c6ce0fc` | 随 `warp/side_right_x`；同上 |
| bangs-to-side-left / hair/cast/bangs_to_side_left | `4799553b-d8a0-4438-9438-f93f4af264a9` | 随既有 `warp/bangs_x`，clip 到 side_hair_left；multiply，87/255 |
| bangs-to-side-right / hair/cast/bangs_to_side_right | `3ba6cbb6-32b8-4387-bce9-c92aecc2dc25` | 随既有 `warp/bangs_x`，clip 到 side_hair_right；multiply，87/255 |

新增侧发承载均为 16×16 smooth 网格：左 [716,205,938,515]，右 [480,205,696,515]。关键形为 X=-30、-22.5、-15、-7.5、0、7.5、15、22.5、30，Y=0。中间形使用正弦位移、余弦透视以及侧发内缘的局部搭接修正。前发及其投脸、Warp、脸部全套既有几何保持原样。前发投侧发的两层只新增静止子网格，直接继承前发的累计运动。

left 的画面右侧为近侧，保留宽的脸侧发面、长弧和外翻束；中央前发与侧发内缘的贴合留出隐藏覆盖。外翻上束尖端约由原生 [926,374] 到 [900,374]，短束尖端约由 [876,467] 到 [842,467]，内侧长束尖端约由 [757,489] 到 [698,489]。画面左侧发面按参考收窄，主发流、下缘分叉和原有描线仍分别可辨；铃铛覆盖段保留连续延伸。right 在原生两片不同造型上交换近远曲面运动，保留原画不同的分叉、尖端与发流。

本轮采用几何形变，KRA 原生像素与正面造型完整保留，无须补绘。侧发新增投影都使用实际 caster/receiver；裁切取接收面的当前 alpha，未烘入发面或脸底。

描线、轮廓与原色复核

正式描线位于 nine-axis/step08_hair/outline/side/ 。`source-left/right.svg` 是两片原生 alpha 与主要发流；`target-left/right.svg` 都对应 X=-30，文件名的 left/right 指原生发片。`right-turn-left/right-inferred.svg` 为 X=30 推导轮廓。`correspondence.json` 留存原画布地标；前发下的内缘在最终形变中另留几像素隐藏搭接。根部及铃铛遮挡区域按原生延伸推导。

先逐片核对整段可见弧线和下缘分叉，修正近侧短束伸出量，再制作曲面。其后检查独显叠边与包含全部已完成脸、前侧发和投影的原色组合，排除了远侧短束过度挤压和新产生的接缝透空。所有 referenceBounds 固定为 [319,-21,774,774]，未平移、重居中或另缩放参考。















连续查看 X=-30、0、30 及 ±7.5、±15、±22.5，前侧发保持同一发型、脸侧间距和稳定发流。视频 2.00 秒约 X=-19、2.375 秒约 X=-24.5 的相近朝向，另外做了固定坐标独显叠边；主要长弧、外翻束和下缘尖束对应连续。前发投侧发及侧发投脸在关键形和中间形中均随动。









保护记录在 nine-axis/step08_hair/review/side/protection-check.json 。与本轮开始时逐节点比较，前发和其他受保护节点修改数为 0；四个既有侧发节点仅改变父级，所有旧部件的相对绘制顺序一致。两张新承载的正面网格最大偏差为 0。KRA 按原生坐标瓦片与 XML 语义核对 428 份图层数据/附件一致，图层可见、混合、不透明度、位置和 UUID 一致，正面合成 PNG 一致。

几何记录在 nine-axis/step08_hair/review/side/geometry-check.json 。两张侧发曲面均以 0.5° 间隔检查 121 个方向，并对空间插值进行 4 倍细分；未出现折叠或零面积。新增 Y/XY 关键形为零项。

后续交接与未解决项

1. 后发轮接入原画已有的后发底面、脸侧外壳与发根承接，再核对前侧后发完整体积。当前部分预览不包含尚未制作的后发；正面源稿根部原有的小范围分离由原生后发底面和头饰覆盖。本轮保留正面，并为转向后的前侧发内缘增加了隐藏搭接；后发轮继续检查全部连接段的覆盖。
2. 头饰轮接入铃铛投侧发：UUID `cd9a1cb5-5714-49a8-ba20-890ed9daa2d5`，Krita 名称 `Cast bell-to-side-right`，范围 [514,315,90,90]，multiply、82/255；caster 为 head_accessories/hair_bell，receiver 为 hair/side_hair/side_hair_right。投影随铃铛承载，并按侧发当前 alpha 裁切。铃铛本体需按挂接点、原画结构及视频透视单独制作。
3. 前发首轮记录中的狸猫本体和两只爪子投刘海仍交给头饰轮；对应 UUID、混合与接收关系保留在上表。
4. right 仍为依据 left 和原画两侧差异的推导，完整后发及头饰组合时需再次复核遮挡。当前可编辑侧发范围内无阻塞问题；未改变任务完成标记、轮次状态或 agent 配置。


后发第三轮与完整脸发协调

2026-11-16：完成后发 left/right 及前、侧、后发整体承接。所有新增形变和预览均为 Y=0；沿用并保存 nine-axis/step08_hair/character-nine-axis.kra 与 nine-axis/step08_hair/hair.json 。工具同步保存 nine-axis/step08_hair/deformers.json 。

Krita 核对结果与实际修改

后发为 D14 / hair/back_hair，UUID `6ef8f6a4-c537-4b73-88c4-5860409f0c7e`，原生范围 [517,195,379,360]，normal、255/255，无子蒙版。它包含完整后脑发面、两侧外壳、画面左侧卷环和下缘尖束、画面右侧粉色长卷束及红色内暗面；中央大量发面本来就被脸与前侧发遮住。核对整束对应后，现有隐藏覆盖足够，未补宽、拉长或重新拆分底图。后发及所有既有画层的像素均保留。

显式注册 `hair/back_hair`，partId 为 `character:hair/back_hair`，8×8 静止子网格；专用 `warp/back_hair_x` 为 [500,185,925,570]、6×6 smooth，关键形 X=-30、0、30，线性参数插值。后脑主体采用约24px横向位移和轻微转面，冠顶位移渐收；近侧长卷束下半段沿发流弯回，远侧原有卷环随遮挡显露。完整后发独显仍保持厚实的后脑体积，未把源稿亮带摊宽来替代新区域显露。left 近侧亮带四处横截面宽度约为原生的95.5%—97.1%，样本记录于 nine-axis/step08_hair/review/back/bright-band-samples.json 。该数值仅辅助判断，最终以原色形态为准。

在完整组合中发现并修正两项上一轮隐藏根部问题：

1. 远侧侧发顶部平切根部随转向露出。只调整 `warp/side_right_x` 的负X顶端邻域及 `warp/side_left_x` 的正X顶端邻域，把其根部软移入刘海下；在原有 ±7.5、±15、±22.5、±30 键逐渐增加搭接。下段主要外弧、分叉、脸侧间距和正面关键形保持原样。
2. 后发原稿耳旁平肩的柔化边仍有小段露出。把远侧隐藏连接段顺头壳收进前侧发下，未用外扩整个头型填满耳旁空间。放大去投影检查后，平切边不再进入组合的可见头型。

刘海本身、所有脸部、五官、耳朵、下颌、脖子几何均未改动。侧发投脸沿原承载随顶端协调；前发投侧发继续沿 `warp/bangs_x`，不随接收面的 Warp。

本轮确实修改了 KRA：新增三层独立接触投影，并把后发与这些投影放入其原 D14 位置的正常隔离组 `Cast isolation | back hair at original D14`，组 UUID `ac92286d-64ab-4274-aca9-c8824d38b149`。后发 UUID 未变，原画层相对堆叠关系未变；未重绘后发底色、纹理或轮廓。三层使用各自 caster 的原生 alpha，下移4px、轻柔边，保留独立图层；KRA 以 inherit-alpha 限定接收底面，累计模型另显式声明 shadow 和动态 clip。

| 新投影 | UUID | 承载、接收与混合 |
| --- | --- | --- |
| `hair/cast/side_left_to_back` / Cast side-left-to-back | `8096db82-ef10-42d8-927a-c937b73e026c` | `warp/side_left_x`；caster side_hair_left → receiver hair/back_hair；multiply，44/255 |
| `hair/cast/side_right_to_back` / Cast side-right-to-back | `05a410dd-f55a-4f8d-aed2-6191ed65b693` | `warp/side_right_x`；caster side_hair_right → receiver hair/back_hair；multiply，44/255 |
| `hair/cast/bangs_to_back` / Cast bangs-to-back | `e393a6f5-cdfc-430e-9b2f-737d23823bdb` | `warp/bangs_x`；caster hair/bangs → receiver hair/back_hair；multiply，34/255 |

三层均绘制在后发之后、脸耳之前，随 caster 运动，裁切到当前变形后的后发 alpha。检查了新露出粉色后发、侧束下缘和原有红色内暗面，接触投影贴着发缘，无悬空边或重复的大块压暗；已有内暗面未当成投影再次变形。

描线与原色复核

正式描线位于 nine-axis/step08_hair/outline/back/ 。source.svg/png 为原生完整后发 alpha 与主发流；target-left.svg/png 沿耳后外弧、近侧亮带所在长卷束、远侧卷环及红色内暗面下缘追踪同一束；target-middle.svg/png 对照视频2.00秒。先修正了把远侧侧发外缘误认成后发卷环的描线，再制作形变。青色表示可见对应，黄色虚线表示头饰、脸或耳机遮挡下的推断；不把中央隐藏下缘尖束当成视频中可见卷环的尖端配对。right-inferred.svg/png 在原生非对称后发上记录相反转向的轮廓与发流，未镜像红色内暗面。







分别核对了后发独显的完整体积与纹理，再检查脸＋前发＋侧发＋后发＋投影的原色组合。referenceBounds 一律固定 [319,-21,774,774]；主要组合 crop 为 [470,180,490,410]，单次比较的 crop 与 scale 完全相同，未重对齐、平移参考或自行制作 blend。独显 edge 的中央顶盖与下缘包含被遮挡的完整发面，因此只把参考实际可见的外弧、卷环与尾端作为轮廓约束，其余结合原画延续。









检查 X=-30、0、30 及 ±7.5、±15、±22.5，并以15个加密姿态查看整体变化。视频2.00秒约X=-19、2.375秒约X=-24.5另做固定坐标叠边和原色对照，近侧后脑显露量、长卷束弯势、亮带宽度、红色暗面与远侧卷环过渡连续。恢复三层新投影后再次检查全部九个标准姿态和两个视频中间朝向。













保护与限制

nine-axis/step08_hair/review/back/protection-check.json 记录：受保护模型节点修改为0；既有节点中仅两张侧发 Warp 的 X 关键形被协调；所有原有正面关键形、Y/XY 数据、axisSources 与原部件相对顺序一致。按 UUID 对应并按瓦片坐标规范化比较了426份原生图层数据和附件，原图层像素及可见、混合、不透明度、位置等元数据一致。新增阴影使 KRA 合成明暗发生了预期的轻微变化，未宣称合成 PNG 完全相同。

nine-axis/step08_hair/review/back/geometry-check.json 另检查两张侧发及后发 Warp，以0.5°步长取121个方向、空间细分检查 smooth 插值，无翻折或零面积；本轮未新增非零Y或XY键。几何检查仅作为合法性核对，原色、参考外弧与组合体积已单独目视核对。

right 缺少独立视频，仍为依据正面两侧差异及相反透视的推导；被头饰、脸和耳机挡住的根部与下缘延续不能当作可见参考的逐像素验证。当前发片范围内未留明显穿插、裂缝、平切露底或阻塞问题。铃铛、狸猫、爪子和辫子未混入发型检查，也未修改；其制作轮仍需沿上一轮表格接入对应已有投影，核对冠顶覆盖、铃铛挂点、爪子压发和耳机/辫子附近的遮挡。既有头饰投影 UUID 与交接关系继续有效。本轮未改变工作流、校验器、状态标记或 agent 配置。


其余头发第四轮：单侧完整辫子

2026-11-16：已在 Krita 逐层核对当前 KRA 的全部 hair/ 发片，并与本轮开始的累计模型按 UUID 对照。原生实际共有六张头发画层：刘海一张、侧发两张、后发一张、单侧辫子前后段两张。前三轮的四张画层及投影已注册；本轮剩余只有同一 `hair/braid_right` 的两张画层，不存在另一侧辫子或其他未制作头发。核对目录为 nine-axis/step08_hair/review/remaining/inventory.json 。本轮完成后，原生头发画层未注册数为0；发圈、铃铛、狸猫及耳机属于非头发，保持未注册和原样。

沿用并保存 nine-axis/step08_hair/character-nine-axis.kra 、nine-axis/step08_hair/hair.json ，派生 nine-axis/step08_hair/deformers.json 同步。所有形变编辑、参考比较与加密预览参数均固定 Y=0。

实际画层、连续性与运动

| 累计模型 id | KRA 画层及 UUID | 原生取样范围与承载 |
| --- | --- | --- |
| `hair/braid_right::back` | D13 / hair/braid_right / back；`a0b578fa-3f3d-485b-8068-20008d6a8aa7` | [564,459,69,128]，4×8 静止子网格；根部位于后发、颈部之后 |
| `hair/braid_right::front` | D57 / hair/braid_right / front；`bf1ac4b1-cfe3-4884-8ec9-f9e0811bc6b5` | [529,580,101,207]，4×12 静止子网格；保留完整下段和尾扇 |

两层均绑定原部件 `character:hair/braid_right`，共享 `warp/braid_right_x`：[510,445,650,805]、2×8 smooth，X=-30、-15、0、15、30。未重复注册前、侧、后发，也未新增非头发节点。两层不是两条辫子；它们在原生 y580—587 重叠并接续同一编织结构。完整独显确认织纹接顺，未靠耳机盖住未接好的断口。

left 根据视频制作上根随后脑略向右、下段与束口向左的缓弯；不是整条刚性平移。编结主体大部分横向转面约92%—98%，下段一个编结按参考修到约84%，避免原先向左多凸约6px；尾扇约82%的横向透视同时带动描线与亮带。源稿完整长度和外翻尖束保留，没有截短到参考窗口边缘。±15 辅助形使用正弦位移及余弦透视/高度变化。right 缺少独立视频，在同一单侧辫子上推导相反根部运动和较近的发面，编结宽度约102%—104%；保留原尾扇向画面左侧外翻的特征，未复制镜像成另一条辫子。

绘制顺序沿原生后根在后发后、前段在脸后的位置接入。组合放大检查发现 left 中后根在颈后、前段在颈前的原拆分深度交界，会使前段内缘在颈侧露出一小段尖边。原画织束本身完整，因此在前段显式加入 `clip.by=[neck,neck/upper], invert=true`，让碰到当前颈侧的部分保持同一辫子在颈后；没有修改脖子、移动受保护层或抹掉原生像素。正面该处不相交，正面原形保留。参考中此处由耳机覆盖，动态预览仍单独检查了颈侧接续，不混入静态耳机伪装完成。

KRA 修改与独立投影

两张辫子画稿的原生像素未改，也未补绘或延长：完整根部已有覆盖，两层共享承载后保持连续，画稿足够支持目标。KRA 本轮新增一层独立后发投辫子根部的轻接触投影，并在原 D13 位置建立正常隔离组，原后根 UUID 不变。该组 UUID `ea01a81d-a653-4ca2-90f6-9c2de1ef1ab8`；其余原画层及非头发内容的相对顺序保持原样。

投影 `hair/cast/back_to_braid`，Krita 名称 Cast back-hair-to-braid / root contact，UUID `1ccc706e-cfe5-4600-99eb-4d211fedf3db`，原生范围 [513,191,387,372]。它来自后发 alpha 下移4px的柔边接触影，multiply、35/255；caster=`hair/back_hair`，receiver=`hair/braid_right::back`，沿既有 `warp/back_hair_x` 运动，动态 clip 到当前辫子后根 alpha。KRA 以 inherit-alpha 限定接收面，投影保留独立画层，未烘入辫子。根部直接接触后发；侧发投根的区域仍在后发覆盖内，未额外叠加重复压暗。原有全部投影混合方式与强度未改。

Krita 中没有原生独立的 braid/tie 投影层。编织自身的亮暗和交叠描线是原画局部体积，保留为纹理。涉及尚未制作非头发接收者/投射者的关系仅交接：耳机遮住上段并可能投辫子；发圈压束口并投下段；辫子下段与衣领/皮肤的投接关系需随对应部件制作核对。本轮未注册耳机、发圈、衣物或身体，也未凭空声称这些投影已接入。

描线、参考与过渡检查

描线保存于 nine-axis/step08_hair/outline/remaining/ 。source.svg/png 包含两层实际 alpha、完整织束与束心走向；target-left.svg/png 与 target-middle.svg/png 对照关键帧及视频2.00秒。描线区分可见边、耳机/后发遮挡下的根部、发圈内汇束和窗口外尾端；先核对整条编织流向和接续，再做形变，随后修正了下段外凸。right-inferred.svg/png 记录同一非对称辫子的相反转向完整发面。原色检查另逐个核对编结、描线、亮带与阴影，未以束心曲线替代实际纹理检查。







独显先检查完整发面及两层连续性，再检查动态颈侧遮挡和完整脸发组合。动态独显上段内缘会显示颈侧遮挡形成的凹口；未裁颈侧的完整发面检查图另外保存在 nine-axis/step08_hair/review/remaining/full-braid-surface-before-neck-occlusion.png ，证明该处不是原生断口或遗漏覆盖。

比较均使用原画布 referenceBounds=[319,-21,774,774]。辫子独显 crop=[495,440,200,370]、scale=2.2；完整组合 crop=[480,185,480,625]、scale=1.1。各次 reference/edge 比较保持同坐标、crop 和 scale，不重对齐、不制作 blend。参考视频只到原生 y753，完整尾端保留到约y780，超出参考处按原画和相邻发流推断，不当作逐像素参考通过。









查看 X=-30、0、30 及 ±7.5、±15、±22.5，另以5°间隔查看13个局部姿态，跟踪同一编结内外缘、束口和完整尾扇。视频2.00秒约X=-19、2.375秒约X=-24.5均作相近朝向的固定坐标叠边和原色核对。恢复根部投影后，根部持续在合理覆盖下，编结与尾扇连续；未见穿插尖边、平切根部、接缝裂开或跳变。左右仍是原生同一单侧辫子，前三轮发型体积及参考关系保持。







保护核对与后续挂接

nine-axis/step08_hair/review/remaining/protection-check.json ：本轮开始时所有既有模型节点逐项一致，包括前三轮头发和投影、脸部上下/四角、axisSources。旧部件相对顺序及原生画层的展开顺序一致；按 UUID 和规范化瓦片坐标比较435份原生图层数据/附件，无原画层像素变化，原层可见、位置、不透明度、混合方式等一致。新增组和独立根部投影属于本轮实际 KRA 修改。

nine-axis/step08_hair/review/remaining/geometry-check.json ：121个方向、0.5°步长及空间细分检查无翻折；两画层共同坐标的父级映射差为0，最小映射纵向重叠约6.85px。新增 Y/XY 键均为零。数值检查只验证合法性与接续余量，参考和原色形态另已检查。

发圈需要随本辫子同步。前发圈 UUID `0e2def08-a9b2-4324-9c18-5b658cdfe67c`，原生范围 [584,699,23,14]，挂在辫子束口，建议沿 `warp/braid_right_x` 的局部位置、切线及横宽随动。后发圈 UUID `7efb0a22-5ffa-40d6-9b14-796254b6ee3f`，原生 [583,690,24,19]，带原生默认闭合蒙版 `ce547866-9e77-4d6d-90ea-256eb880f1ce`；本轮保持画稿和蒙版原样。原画布挂点 [596,706] 在 X=-30、0、30 的映射约为 [572.45,699.12]、[596,706]、[620.06,699.12]。每个标准姿态的挂点、两端和局部切线记录于 nine-axis/step08_hair/review/remaining/tie-attachment.json ，交头饰轮直接复用；发圈不单独固定在旧坐标。耳机应按其自己的头颈运动制作，位于辫子上段之前，不能让整只耳机跟随辫子下段弯曲。

限制：right 没有独立视频；上根被后发、脸及参考耳机遮挡，参考窗口之外的尾端依原画延续。非头发内容尚未制作，当前动态预览未混入其静态画层，后续仍需接入真实耳机、发圈和衣领检验接触投影及遮挡。当前本轮头发范围内无未解决的明显可见偏差或阻塞项；既有铃铛与狸猫投影的上一轮交接关系继续有效。本轮未改工作流、工具、校验器、完成标记或 agent 配置。
