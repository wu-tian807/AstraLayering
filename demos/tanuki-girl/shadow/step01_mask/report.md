# 投影蒙版制作报告

已交付原尺寸 **1376 × 2048、RGBA U8** 的可编辑 KRA 和透明 PNG，以及 22 个影层的 `shadows.json` v2。制作以 simplified 的实际暗面为依据，以已组装 PNG 的位置配准。输入与另一阴影分支均未修改。

## 参考与画法

先查看全身，再逐区对照头脸、颈肩、袖口、手腕、裙下和脚环。主要恢复的是裙下斜向珊瑚色腿影、下颌下方颈影、上睑覆盖眼白和虹膜上部的柔和暗带；发缘、狸饰物、铃铛和耳机接触影较浅，未用同一深浅处理所有部位。

全部投影在 Krita 的新绘画层上以 Basic-5 Size 和 Airbrush Soft 原生画笔逐笔绘制。完整轮廓用密排笔触铺出，局部软缘用低不透明度软笔触，眼部渐淡用逐行改变明度的笔触。未使用生图、像素蒙版粘贴、矢量填充或滤镜生成影子。绘制后放大修正了密排横纹、额部过宽影缘、袖口接收面遗漏及裙片搭接重复压暗。

所有新影层采用正片叠底与原生透明度继承，隔离组的唯一实色 alpha 来源是声明的接收 base。眼内 base 保留眼白、虹膜和反光原层；袖口 base 保留上臂、前臂及原蒙版；裙影联合裁切到两腿，裙内、腿间、裁切外均有完整笔触。线稿、材质与高光通过影层透出。



## 逐处投影

下表颜色为影层笔触主色，不是最终皮肤 RGB；“强度”是影层不透明度，正片叠底后深浅还由接收面的原像素决定。眼影渐淡到白色乘数，因此下沿逐渐无变暗作用。每处完整素材与所有相对偏移见对应检查图。左右以真实 part 命名，`screen_left/right` 是画面侧。

| 关系 | 投影部件 → 接收面 | 主色 / 强度 | 范围、深浅依据与运动余量 |
|---|---|---|---|
| `bangs-to-face` | `character:hair/bangs` → character:face/face_base | `#d3aaa0` / 18% | 参考额部与中央细发尖下的浅暖灰投影；完整根部覆盖额头，细发尖保留8px平移余量。 偏移：(0,0) / (-8,0) / (8,0) / (0,8)。 |
| `side-right-to-face` | `character:hair/side_hair/side_hair_right` → character:face/face_base | `#d3aaa0` / 28% | 画面左侧发束在眼外侧和脸颊上形成浅暖色弧影；与中央刘海只在遮挡区相接，避免可见处重复压暗。 偏移：(0,0) / (-8,0) / (8,0) / (0,6)。 |
| `side-left-to-face` | `character:hair/side_hair/side_hair_left` → character:face/face_base | `#d3aaa0` / 28% | 画面右侧侧发下缘投到脸颊的弯月形浅影；轮廓延伸至完整侧脸外。 偏移：(0,0) / (-8,0) / (8,0) / (0,6)。 |
| `upper-lid-right-to-eye` | `character:face/eyes/eye_right/upper_eyelid` → character:face/eyes/eye_right/sclera、character:face/eyes/eye_right/iris、character:face/eyes/eye_right/highlight | `#8b817f` / 40% | 上睑投影覆盖眼白、虹膜与反光的上部整片区域；向下27px内渐淡，避免重复压暗原虹膜自身的深色上半部，跟随上睑而非视线。 偏移：(0,0) / (-5,0) / (5,0) / (0,7)。 |
| `upper-lid-left-to-eye` | `character:face/eyes/eye_left/upper_eyelid` → character:face/eyes/eye_left/sclera、character:face/eyes/eye_left/iris、character:face/eyes/eye_left/highlight | `#8b817f` / 40% | 上睑投影覆盖眼白、虹膜与反光的上部整片区域；向下27px内渐淡，避免重复压暗原虹膜自身的深色上半部，跟随上睑而非视线。 偏移：(0,0) / (-5,0) / (5,0) / (0,7)。 |
| `paw-left-to-bangs` | `character:head_accessories/tanuki_ornament/paw/paw_left` → character:hair/bangs | `#bc7e87` / 42% | 参考狸爪下粉发根部的接触暗带；上方补至爪后，低缘保留约6px运动余量。 偏移：(0,0) / (-5,0) / (5,0) / (0,6)。 |
| `paw-right-to-bangs` | `character:head_accessories/tanuki_ornament/paw/paw_right` → character:hair/bangs | `#bc7e87` / 42% | 参考狸爪下粉发根部的接触暗带；上方补至爪后，低缘保留约6px运动余量。 偏移：(0,0) / (-5,0) / (5,0) / (0,6)。 |
| `bell-to-side-right` | `character:head_accessories/hair_bell` → character:hair/side_hair/side_hair_right | `#b47483` / 32% | 金铃下方侧发的短暖紫接触影；保持发丝底层线稿和亮带。 偏移：(0,0) / (-6,0) / (6,0) / (0,6)。 |
| `tanuki-body-to-bangs` | `character:head_accessories/tanuki_ornament/tanuki_body` → character:hair/bangs | `#bc7e87` / 30% | 狸形饰物身体下沿投到中央粉发根部的短暗带，和两爪投影分别随动；参考根部中央保留浅色收尖。 偏移：(0,0) / (-5,0) / (5,0) / (0,5)。 |
| `chin-to-chest` | `character:face/face_base` → character:body/torso、character:body/breast | `#e5adb0` / 40% | 下颌投影在颈下锁骨处向斜下方收尖；与颈影采用同色同强度，保留胸皮肤原 D34–35 遮挡段。上方完整补到头后，支持左右 10px、向下 9px。 偏移：(0,0) / (-10,0) / (10,0) / (0,9)。 |
| `bangs-to-side-right` | `character:hair/bangs` → character:hair/side_hair/side_hair_right | `#b47789` / 34% | 参考前刘海压住侧发的窄紫粉暗缘；完整影形补至根部，侧发自身高光和发丝线从叠底下透出。 偏移：(0,0) / (-6,0) / (6,0) / (0,5)。 |
| `bangs-to-side-left` | `character:hair/bangs` → character:hair/side_hair/side_hair_left | `#b47789` / 34% | 参考前刘海压住侧发的窄紫粉暗缘；完整影形补至根部，侧发自身高光和发丝线从叠底下透出。 偏移：(0,0) / (-6,0) / (6,0) / (0,5)。 |
| `sleeve-left-to-forearm` | `clothing:sleeve_screen_left` → character:arms/arm_right/upper_arm、character:arms/arm_right/forearm | `#f2a99e` / 62% | 参考袖口下裸臂上端的珊瑚色短弧影；底缘较清晰、轻微笔刷过渡，隐藏袖内及两侧补足8px位移。 偏移：(0,0) / (-7,0) / (7,0) / (0,8)。 |
| `sleeve-right-to-forearm` | `clothing:sleeve_screen_right` → character:arms/arm_left/upper_arm、character:arms/arm_left/forearm | `#f2a99e` / 62% | 参考袖口下裸臂上端的珊瑚色短弧影；底缘较清晰、轻微笔刷过渡，隐藏袖内及两侧补足8px位移。 偏移：(0,0) / (-7,0) / (7,0) / (0,8)。 |
| `pink-bracelet-right-to-palm` | `character:arms/arm_right/bracelet_pink_front` → character:arms/arm_right/hand/palm | `#d88f7b` / 32% | 参考腕环下缘到手腕的短暖色接触影；保留手掌线稿和原有指根明暗，向环后与腕外延伸。 偏移：(0,0) / (-5,0) / (5,0) / (0,5)。 |
| `pink-bracelet-left-to-palm` | `character:arms/arm_left/bracelet_pink_front` → character:arms/arm_left/hand/palm | `#d88f7b` / 32% | 参考腕环下缘到手腕的短暖色接触影；保留手掌线稿和原有指根明暗，向环后与腕外延伸。 偏移：(0,0) / (-5,0) / (5,0) / (0,5)。 |
| `thigh-band-to-leg-left` | `character:legs/leg_left/thigh_band_front` → character:legs/leg_right/leg、character:legs/leg_left/leg | `#bcb0bf` / 30% | 参考腿环下方白袜上沿的很浅紫灰接触影；不重画袜子固有纵向明暗。 偏移：(0,0) / (-4,0) / (4,0) / (0,4)。 |
| `anklet-to-leg-right` | `character:legs/leg_right/anklet_front` → character:legs/leg_right/leg、character:legs/leg_left/leg | `#dc9680` / 48% | 参考脚环下的短暖影，脚环后完整覆盖并向足踝两侧延伸；只恢复接触带，脚侧与脚趾的固有明暗保留。 偏移：(0,0) / (-4,0) / (4,0) / (0,5)。 |
| `earcup-right-to-skin` | `character:headphones/earcups/earcup_right` → character:body/torso、character:body/breast | `#d5a294` / 29% | 耳罩下沿到胸肩的浅暖灰接触暗带，保留皮肤亮点和锁骨线；完整补进耳罩后，支持左右及向下 5px。 偏移：(0,0) / (-5,0) / (5,0) / (0,5)。 |
| `earcup-left-to-skin` | `character:headphones/earcups/earcup_left` → character:body/torso、character:body/breast | `#d5a294` / 29% | 耳罩下沿到胸肩的浅暖灰接触暗带，保留皮肤亮点和锁骨线；完整补进耳罩后，支持左右及向下 5px。 偏移：(0,0) / (-5,0) / (5,0) / (0,5)。 |
| `kimono-skirt-to-legs` | `clothing:kimono_body` → character:legs/leg_right/leg、character:legs/leg_left/leg | `#f2aeaa` / 60% | 两片前裙属于真实kimono_body组，合并为一个运动来源的连续裙影，避免搭接重复压暗。参考左腿影下沿向内侧斜落至1120px，右腿内侧1125px向外侧1085px收起；裙内、两腿之间及外侧均补全，支持左右14px和向下14px相对偏移。 偏移：(0,0) / (-14,0) / (14,0) / (0,14)。 |
| `chin-to-neck` | `character:face/face_base` → character:neck | `#e5adb0` / 40% | 下颌投到颈面的暖灰珊瑚影，参考颈中部239/178/162；在原D22隔离组保留耳机终端与肩皮肤的原遮挡。与chin-to-chest同源、同偏移，因接收面处于不同原生叠放段保留两层；此层跟下颌而非耳机。 偏移：(0,0) / (-10,0) / (10,0) / (0,9)。 |

颈面、胸面处于不同原生遮挡段，下颌投影在两处隔离组各保留一层，运动来源、颜色与偏移相同；这使耳机终端、肩部与后方衣料的原遮挡保持原样。刘海投到脸与侧发时也按接收材质分别裁切，细发尖直接包含在刘海完整影形中，没有虚构细条 part。两片前裙属于真实 `clothing:kimono_body`，裙影作为一个连续来源只画一遍，两腿之间没有叠底接缝。

`follow: caster` 仅声明后续运动来源。当前没有制作 deformer、物理或光向关键形；声明偏移是当前素材的原画像素相对位移检查，不是动画绑定成果。

## 颜色和边缘复核

参考颈中部约 RGB 239/178/162，裙下腿影约 242/180/163；这些采样用于校正初稿偏深、偏橙的问题。最终肤色影用较浅暖粉乘数，保持原皮肤渐变。眼影仅覆盖上部并在 27px 内渐淡，保留原虹膜深色上半部与黄色下部，避免重复压暗内部色彩。发影是小范围浅暖灰接触影，侧发和头饰压发处偏紫粉；袖口与裙影的下缘较清晰，接触细边有笔刷过渡。

已查看全部 22 处复位及非零偏移的区域图，确认仍由接收面裁切，没有影子浮出透明背景。声明范围内细发尖、头饰、袖口和裙影仍有连续素材可用。完整素材的裁切外像素数只是覆盖证据，未以固定面积倍率代替视觉判断。

## 保留的暗面与未另做的项目

- 后发的红色内面、辫子交织处明暗、耳毛及耳内凹面色差：参考中确实可见，现有原层已保留这些固定材质明暗，没有另加整体变暗层。
- 狸饰物叶片下的内部暗线、铃铛暗面与反光：位于饰物自身，叶片未登记为独立运动 part，保持所属部件原像素，没有虚构投影来源。
- 衣襟、腰带、系绳、袖褶与后垂片中的窄暗线：原组装已有相应描线或布料固有暗面。仅凭此参考无法稳定区分为额外可随动投影，未重复描一层压暗。
- 辫子与衣襟相接处、前侧发与后发相接处的极细暗线：参考主要表现为既有线稿和发面深色，未见可明确量出的独立宽投影，因此保留原层。已制作刘海对侧发的可见接触影。
- 未扩展参考中没有出现的离面长投影；隐藏区按已有投影形状延续，余量按本角色轮廓与声明位移选择。

## 原尺寸脸部与偏移

`face-review.png` 首行分别为原组装、关闭全部新影、最终原生合成与 simplified；每栏裁切为原图 `(490,195)–(905,650)`，**415 × 455px，无缩小**。其下分别展示刘海细发尖及左右侧发在声明偏移下的 245 × 170px 原尺寸脸部裁切。偏移只移动所选影层，接收面保持位置。



全部区域的原尺寸局部偏移拼图：[1](review/offsets-01.png)、[2](review/offsets-02.png)、[3](review/offsets-03.png)、[4](review/offsets-04.png)。连续裙影的宽裁切见下图。



## 检查结果

最终保存工程已经 `inspect_shadow_mask` 独立重开检查，**passed: true，problems: []，warnings: []**。结果见 [inspection.json](inspection.json) 和 [检查总图](inspection/overview.png)，每处有完整影形、接收覆盖、复位与全部声明偏移的原生 PNG。

- 124 个原节点全部保留；111 个原绘画层逐层原始像素完全一致。
- 9 个原蒙版的 UUID、原所属节点 UUID、启用状态、不透明度、位置与混合方式全部保持原样。移动上臂时使用原蒙版节点，没有创建替代蒙版。
- 正式 PNG 与独立重开 KRA 的原生最终合成逐像素一致，差异为 0。
- 关闭所有新影后与原组装有 174 个像素出现最大 1/255 通道差异，来自原生隔离组合成舍入；原层原始像素未改。没有在原图透明范围外增加非零 alpha。
- 保存期间桥接曾自动取消进度对话框，均以实际落盘文件及独立重开原生合成确认恢复成功，最终工程可正常打开。

逐层核对记录：[original-layer-check.json](review/original-layer-check.json)。像素合成核对记录：[pixel-check.json](review/pixel-check.json)。

正式交付：[character-shadowed.kra](character-shadowed.kra)、[character-shadowed.png](character-shadowed.png)、[shadows.json](shadows.json)、[face-review.png](face-review.png)。所有脚本与草稿仅位于本步骤 workspace，未修改上游或运行标记。
