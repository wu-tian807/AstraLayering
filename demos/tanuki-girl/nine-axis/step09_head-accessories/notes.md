2026-11-16：head_accessories 的 left＋right 已完成。本轮所有编辑与预览固定 Y=0；原有上下、四角及全部脸发数据保留。

正式文件：

- KRA：nine-axis/step09_head-accessories/character-nine-axis.kra
- 累计作者：nine-axis/step09_head-accessories/accessories.json
- 同步预览模型：nine-axis/step09_head-accessories/deformers.json
- KRA 正面合成：nine-axis/step09_head-accessories/character-nine-axis.png

实际部件与 UUID 核对

已先在 Krita 逐层查看当前 KRA，再注册图层。原生饰品实际为七张画层，不包含耳机或其他衣物配件。起稿目录保存在 nine-axis/step09_head-accessories/review/inventory.json；完成目录为 nine-axis/step09_head-accessories/review/inventory-final.json。

| 原生层 | UUID | 起稿范围 [x,y,w,h] 与接入 |
| --- | --- | --- |
| D12 / tanuki_body / back | `e31ef44b-9571-464f-a0d6-9ed501711eb0` | [596,24,312,219]；原本体背层，保留 UUID |
| D85.5 / tanuki_body / front | `368765d3-d740-4b55-9b79-0d2ebae08dfa` | [652,193,113,25]；同一本体前片，保留 UUID，补足爪根覆盖 |
| D86 / paw_left | `42f9e26a-5609-4811-aec4-8d5fb453dc34` | [726,199,78,57]；画面右侧爪子 |
| D87 / paw_right | `f3526b5b-0fa3-4001-b58c-aa2e624ba04d` | [608,199,75,57]；画面左侧爪子 |
| D85 / hair_bell | `71a12d72-72ea-4f56-a1b7-546d1cfa2243` | [524,319,82,77]；固定在 side_hair_right 的安装表面 |
| D88 / hair_tie_front | `0e2def08-a9b2-4324-9c18-5b658cdfe67c` | [584,699,23,14]；直接沿最新 warp/braid_right_x |
| D56 / hair_tie_back | `7efb0a22-5ffa-40d6-9b14-796254b6ee3f` | [583,690,24,19]；同一发圈背片，沿同一辫子 Warp |

发圈背片的默认闭合蒙版 `ce547866-9e77-4d6d-90ea-256eb880f1ce` 原样保留，默认状态下背片不显露。它已单独登记，未因独显为空而省略。原层顺序保持前圈在辫子前、背圈在辫子后。挂点 [596,706] 继续使用上游辫子映射，X=-30/0/30 约为 [572.45,699.12]、[596,706]、[620.06,699.12]；没有另加平移补偿。



狸猫拆面、画稿修改与姿态

D12 原稿将狸猫头面、耳圈、叶片、身体和尾巴画在同层。left 参考明显露出身体侧面、尾根及更多尾长投影。为保持叶脉、耳圈和尾部结构，在 Krita 将其拆成可独立转面的原生层；原背层与前片 UUID 没有更换。新增层均沿用 `character:head_accessories/tanuki_ornament/tanuki_body`，level=accessory。

| 新原生层 | UUID | 用途 |
| --- | --- | --- |
| tail surface | `9c5f58ba-a34b-4301-8a3c-be8b55c23fad` | 沿原头尾遮挡缝分出尾面，保留原可见毛色与尾尖，补足头后覆盖 |
| body side | `a09a27dd-ac9e-4097-9891-d5f6784ba07b` | 补绘原本藏在头后、左转新露出的身体侧面，肩线连续接入头后 |
| ear_right surface | `22e469e1-6d43-4df4-b904-5758be9010ad` | 保留原象牙色耳心与内墨线，完整圆圈及隐藏耳根 |
| ear_left surface | `00ef4240-226f-4373-88e1-0f539aa85fd2` | 同上；独立保留两侧形状 |
| leaf surface | `4c24ec2d-9f08-4774-99ec-59bef1439d47` | 保留原绿叶与叶脉，净化分离边缘 |

本体头面、原前片及其上沿/两侧覆盖共用 `warp/accessory_tanuki_body_x`。曲面主要改变横向投影，远侧眼罩收窄、鼻口移向转向一侧，近侧保留脸颊体积；额顶只补足叶片与耳根后的安装余量。前片在原 UUID 内扩充到下部头面，在模型中用不同范围读取同一层，使刘海不能穿进近侧爪根。没有合并遗漏原前后片。

尾面与身体侧面共用 `warp/accessory_tanuki_tail_x`。left 尾尖约由 [843,24] 到 [913,24]，尾面整体横向投影 102%、纵向投影 118%，对应参考由斜面展开后的长度显露；整面使用同一仿射，不局部扭曲或拉弯毛色带。right 将原生单侧尾面压缩并退至头后，没有镜像出另一条尾巴。

两耳、叶片、两爪及铃铛均采用各自的整体仿射投影。left 画面左侧爪宽约 70%，近侧爪约 110%；爪趾墨线、叶脉、耳圈和铃壳随同一实体转面。8 张专用 Warp 均为空间 smooth、三键 X=-30/0/30、X 轨迹 ellipse，没有新增 Y/XY 键，也没有惯性、甩动或弹性键。

本轮确实修改了狸猫画稿：分离尾面、两耳与叶片，补绘侧面、冠顶与耳根隐藏覆盖，并扩充前片下缘搭接。正面头饰像素因此不与起稿逐像素相同。狸猫大部脸面、眼罩、尾部可见毛色及爪子、铃铛、发圈原画沿用；所有非饰品画稿保持。

铃铛挂接与本体结构

铃铛最终使用 `warp/accessory_bell_x`，本体与原独立投影共享承载。位置按最新侧发的安装表面及视频确定，left 中心约 [535,357]，right 约 [586,356]；各角度均检查球壳压住侧发的接触范围。

曾尝试将铃铛挂到 side_right 曲面，但它位于父网格外缘，局部反解在中间态挤宽了黑色开槽，视觉检查未通过。因此最终使用按挂点制作的独立整体投影，不叠加侧发曲面。该选择保留了球壳、开槽及原生环带的结构；原环带本来沿球壳呈弧形，未额外弯折其各段。没有让铃铛跟随发梢弯曲。





独立投影

四张原生投影均已显式注册 shadow、真实 caster/receiver 和动态 clip；混合、不透明度及原生顺序保持。它们未烘入脸发，也没有扩大接收面的 alpha。

| 模型关系 | 原生 UUID | 混合与承载 |
| --- | --- | --- |
| tanuki_body → hair/bangs | `88340945-0e67-4954-8902-ba7673ad1236` | multiply，76/255；随本体 Warp，clip 到 bangs |
| paw_right → hair/bangs | `40f7def8-64cd-44e7-98ac-efa974b6b496` | multiply，107/255；随画面左爪 Warp，clip 到 bangs |
| paw_left → hair/bangs | `d609bd9d-22af-4f2d-b71f-0e5d8e927863` | multiply，107/255；随画面右爪 Warp，clip 到 bangs |
| hair_bell → side_hair_right | `cd9a1cb5-5714-49a8-ba20-890ed9daa2d5` | multiply，82/255；随铃铛 Warp，clip 到 side_hair_right |

两张爪影的原生名称与实际画面侧相反：名称 paw-left 的 `40f7…` 位于画面左侧，实际对应 paw_right；名称 paw-right 的 `d609…` 位于画面右侧，实际对应 paw_left。原名与 UUID 保留，模型按像素内容声明真实 caster。完整绑定、取样范围、clip 与 shadow 索引见 nine-axis/step09_head-accessories/review/bindings-and-shadows.json。

Krita 没有原生独立的发圈投辫子层；束口保持原画体积与覆盖。未凭空登记耳机、衣物或身体为接收者。本轮不新增依赖未完成身体/衣物的投影。后续耳机与衣领制作仍需核对辫子上段及下段遮挡、接触与投接；相关 KRA 原层原关系保留。



描线、固定坐标比较与过渡检查

描线在 nine-axis/step09_head-accessories/outline/。source.svg/png 记录原生真实 alpha 与安装位置；target-left.svg/png 记录关键帧可见弧线、爪子压发、铃铛与束口，黄色虚线为被遮挡的连接推断。target-right-inferred.svg/png 明确标注无独立右转参考，保持单侧尾巴、铃铛、辫子与原生非对称。correspondence.json 保存原画布地标。







所有参考比较固定 referenceBounds=[319,-21,774,774]，没有重对齐、重居中或 blend。完整 crop=[480,10,535,795] 保留头饰全高及完整辫尾，参考窗口外的部分不截短。视频以原有 960→774 尺寸转换，按上游相近朝向比较 2.000s 的 X≈-19、2.375s 的 X≈-24.5，视频时间不按线性角度解释。

分别检查饰品独显、原色纹理和最终脸＋全部头发＋饰品组合；查看 X=-30、±22.5、±15、±7.5、0、30，以及 5° 间隔的13姿态。最后恢复全部投影复查九个标准值和两个视频中间值。修复了分离首稿的耳圈剪切、尾根切口、爪根粉色裂缝以及近侧耳根一个小三角透空；末次耳根5倍放大确认覆盖连续。未因持续遮挡处裸露独显而重做头发顶弧。

















保护核对与限制

nine-axis/step09_head-accessories/review/protection-check.json：本轮开始时的66个模型节点逐项一致，包括脸、五官、耳朵、下颌、脖子、全部头发及其投影；axisSources、原部件相对顺序与非零Y/XY数据一致。按 UUID 和瓦片坐标规范化核对420份原生层数据/附件，原层中仅狸猫前后两层像素改变；其他原层像素以及可见、混合、不透明度、位置和UUID保持。活动层 selected 与无语义 channellockflags 规范化不作为画稿变化。五张新增层均为狸猫部件，本轮没有未登记的 head_accessories 画层。当前22个饰品网格节点对应12张本体画层及4张独立投影；额外网格只是同UUID的不同覆盖取样。

nine-axis/step09_head-accessories/review/geometry-check.json：8张专用 Warp 以0.5°步长检查121个方向，空间4倍细分，最小有向子单元面积约17.35，无翻折或零面积。数值检查仅验证合法性，原色、轮廓、安装与遮挡已另行目视核对。

right 没有独立关键帧或视频，属于保留原生非对称结构后的相反透视推断。尾根、冠顶与耳根的原隐藏面只能按相邻表面延续；参考窗口外的辫尾依原画保留。当前饰品范围内未留明显露底、悬浮、穿插、裂缝或阻塞项。未制作物理摆动，未修改工作流、工具、校验器、状态标记或 agent 配置。
