结论：需要修复

# 第一步衣服分层第二轮独立检查

本轮从当前 `clothing-depth.kra` 重新导出图像，确认 19 处需修。默认合成中，胸衣腰口的圆收褶被拉直，肩荷叶与末层外翼有褶边折点或重线，部分领端与裙边的线口需要收齐。揭开遮挡后，两肩荷叶的根部和四层裙片上口仍有接画痕迹。

画布为 1254 × 1254，坐标采用 `(x, y, 宽, 高)`，左右按画面方向。编号为本轮编号。框选图与原尺寸局部由同画布图像生成，每个对照左为纯衣服参考，右为当前 KRA 的相应显隐状态。放大图的列顺序标在图中。参考内的遮挡保留原样，藏量的依据为该衣片的色块轮廓及露出褶形的延续。

[参考、默认合成与穿衣图](review-02-evidence/details/overview.png) · [默认合成编号总图](review-02-evidence/composite/marked.png)

## 肩部与领口

### R1　左肩荷叶上半缝根 `(449, 141, 25, 99)`

`image_left_shoulder_assembly/right_shoulder_ruffle` 独显时，沿左肩带方向有一条浅粉窄条和贴着它的暗线。它们横截上半数道扇褶，揭开后像还留着一段带边。纯衣服参考的纵向缝线位于肩带外边，分件色块把其下的窄搭量归入荷叶。沿左侧各斜褶的方向把荷叶本身的明暗逐褶接过窄条，去掉暗线。保留荷叶外波浪边和肩带本身的包边，复显肩带后核对原缝线位置。

[独显框选](review-02-evidence/left-ruffle/marked.png) · [局部对照](review-02-evidence/left-ruffle/R1-comparison.png) · [放大及肩组件](review-02-evidence/details/detail-ruffle-left.png)

### R2　右肩荷叶上半缝根 `(768, 143, 31, 78)`

`image_right_shoulder_assembly/left_shoulder_ruffle` 独显时，右肩顶下方有一条夹在浅粉亮边和暗线之间的直窄带，多道往右铺开的扇褶止在它上面。参考中各褶收向肩带外缘，色块在缘下给的是荷叶布面的短搭量。留着这条带会在揭开后形成平行缝影。分别延续该侧上部窄楔、宽暗褶和相邻亮面，收去这条直带及其暗边。保留肩顶上斜轮廓和原左右不对称。

[独显框选](review-02-evidence/right-ruffle/marked.png) · [局部对照](review-02-evidence/right-ruffle/R2-comparison.png) · [放大及肩组件](review-02-evidence/details/detail-ruffle-right.png)

### R3　左肩荷叶中段大斜褶 `(410, 222, 58, 43)`

`image_left_shoulder_assembly/right_shoulder_ruffle` 由自由边凹口斜向肩根的一条宽暗褶，下缘中段转成小折角，折角下带一段浅色硬阶。它在默认合成可见。参考的同一条明暗界线由凹口平顺上行。用本褶两侧的颜色接顺折点前后，按参考恢复一条平顺的斜弧。保留凹口深度及宽暗褶原有宽窄变化。

[局部对照](review-02-evidence/composite/R3-comparison.png) · [独显与合成放大](review-02-evidence/details/extra-fold.png)

### R4　右肩荷叶大斜褶下方 `(773, 229, 64, 37)`

`image_right_shoulder_assembly/left_shoulder_ruffle` 的中央宽斜褶下沿有一段平行细暗痕，中段可读出两条线。独显与合成里都能看到。参考在此由宽暗褶经一条柔和斜边进入亮面。顺褶走向把副线融回亮面，从肩根向自由边接回原有的渐变宽度，保留主褶边和外圈凹口。

[局部对照](review-02-evidence/composite/R4-comparison.png) · [独显与合成放大](review-02-evidence/details/extra-fold.png)

### R5　左领端凸瓣与下回折 `(467, 254, 38, 57)`

`neckline_ruffle` 在 `image_left_shoulder_assembly/right_shoulder_strap` 和 `dress_bodice` 的接点处，白瓣外沿发浅发灰，凹转下方的小回折轮廓也随之发虚。参考保有细深的凸边、短凹转和落到粉包边的清楚回折。当前的边线软化让两个白色转面和粉底挤在一起。以白领褶自身的深棕灰沿参考轮廓接画，细收凹转并接到下端，保留白瓣面积、方领开口和粉包边弧度。

[局部对照](review-02-evidence/composite/R5-comparison.png) · [领端放大](review-02-evidence/details/extra-neck.png)

### R6　右领端凸瓣与下回折 `(741, 252, 36, 56)`

`neckline_ruffle` 与 `image_right_shoulder_assembly/left_shoulder_strap`、`dress_bodice` 相接处，右凸瓣绕至小回折的外边变成软灰边，最明显的是凸瓣下方折入粉底的短段。参考的短凹转和下回折是窄而连续的深线，能把白瓣与粉色荷叶分开。按原线宽逐段恢复该侧白褶轮廓，在下回折落入粉包边处收细。保持右侧原有的小回折形状，并复核肩带边线在白褶处收住。

[局部对照](review-02-evidence/composite/R6-comparison.png) · [领端放大](review-02-evidence/details/extra-neck.png)

### R7　白领褶搭口下沿 `(495, 272, 264, 32)`

隐藏 `dress_bodice` 后，`neckline_ruffle` 若干褶脚在下缘并入一条灰紫底边，局部还有斜向短岔线。合成中，约 x=527 及 x=646 一带的短深褶脚比参考弱，几块白亮面在粉包边前像被齐截。参考可逐个辨认白亮面、灰紫侧面与落进包边的短褶脚。恢复露出的短暗收脚，再把各白面和灰紫侧面分开沿各自斜度续进藏量，去掉相互串连的灰紫底色。保留粉包边在胸衣层上的接缝轮廓。

[独显框选](review-02-evidence/neckline/marked.png) · [局部对照](review-02-evidence/neckline/R7-comparison.png) · [下沿放大](review-02-evidence/details/extra-neckbase.png)

## 腰线与四层裙片上口

### R8　胸衣收进腰带的整段褶脚 `(487, 398, 269, 49)`

`dress_bodice` 在 `waistband` 上方的多个亮褶被改成平头条块，尤其是中央及两侧中段。揭开腰带后，深浅条一直拉到衣片底边。参考的亮面在腰点处逐个圆收，邻近暗面则以短尖楔把它们拢进腰缝，当前少了这排抽褶体积。先依同坐标参考恢复露出的圆收、暗楔和两翼向内的斜褶，再沿各褶方向把少量布面接进腰带后。保留胸衣上口和腰带的原走线，复显时核对圆收在腰带上方完整可读。

[局部对照](review-02-evidence/composite/R8-comparison.png) · [腰带遮挡前后放大](review-02-evidence/details/detail-waist-chest.png)

### R9　第一道裙片腰口 `(486, 442, 271, 48)`

`skirt_tier_one` 在 `waistband` 后的一排近直条与下方斜褶相接时折腰、突缩，腰口两侧尤为清楚。默认合成中，参考腰带下若干有弧度的亮拱和短暗楔变成较平直的条口。沿参考恢复各个露出的褶根，左右按其斜势续入腰带背后，中间较直的褶也分别保留各自宽度和明暗。保留原侧缘、长褶和腰带的覆盖关系。

[独显框选](review-02-evidence/tier-one/marked.png) · [局部对照](review-02-evidence/tier-one/R9-comparison.png) · [腰口放大](review-02-evidence/details/detail-waist-skirt.png)

### R10　第二道裙片上口 `(391, 635, 461, 60)`

隐藏 `skirt_tier_one` 后，`skirt_tier_two` 上口的褶条在近似同一高度突然转向或变宽，左右斜褶的接头和中段数个暗褶形成折肩。当前揭开后像把一条另画的窄带接到了裙面。第一道摆缘下的参考有宽窄不一的圆拱、长斜褶和暗楔，色块上方是一条短搭量。按同坐标还原露出的拱顶和暗楔，沿各褶现有走向重画至搭量上边，消去成排折点和斜褶旁的细重痕。保留第一道摆缘波浪及第二道裙片主体长褶。

[独显框选](review-02-evidence/tier-two/marked.png) · [局部对照](review-02-evidence/tier-two/R10-comparison.png) · [上口分段放大](review-02-evidence/details/detail-seam-skirt-two.png)

### R11　第三道裙片上口 `(310, 818, 623, 76)`

隐藏 `skirt_tier_two` 后，`skirt_tier_three` 多处暗褶顶在搭口附近突然变窄并起肩。宽暗褶内可见第二道细暗线，右段约 x=899 的暗面还留一个孤立暗点。参考第二道摆缘下可分别跟踪中部圆拱、暗楔及右侧宽斜褶，当前这些面被肩角和重痕切碎。恢复各主要褶根各自的宽度和深浅，将宽暗面里的细线与暗点按本面色调融去，再从每条褶连续接入上搭量。保留第三道裙片的中央长褶与外展方向。

[独显框选](review-02-evidence/tier-three/marked.png) · [局部对照](review-02-evidence/tier-three/R11-comparison.png) · [上口分段放大](review-02-evidence/details/detail-seam-skirt-three.png)

### R12　第四道裙片上口 `(250, 960, 741, 101)`

隐藏 `skirt_tier_three` 后，`skirt_tier_four` 上口两翼的暗褶先近乎竖直，再折向外斜。中部宽暗褶顶有窄亮条和暗色重影，裸露的搭量像另一排竖褶。参考第三道摆缘下，两翼的长斜褶和中段较直的褶可各自跟踪；分件色块提供沿弧线的连续搭量。从已露出的各褶反推走向，接画到搭量上缘，收掉中部窄亮条与两翼折点。保留褶的宽度差和裙片外展，复显时核对摆缘下侧的明暗边自然接出。

[独显框选](review-02-evidence/tier-four/marked.png) · [局部对照](review-02-evidence/tier-four/R12-comparison.png) · [左半放大](review-02-evidence/details/detail-seam-skirt-four-a.png) · [右半放大](review-02-evidence/details/detail-seam-skirt-four-b.png)

## 裙片可见褶边与轮廓接点

### R13　末层左翼可见宽斜褶 `(265, 983, 45, 60)`

`skirt_tier_four` 从 `skirt_tier_three` 下方露出的第一条宽斜褶边先向左偏、再突然变陡，约 x=280 的明暗界形成弯折。参考这条暗褶的边是方向连续的长斜弧。修顺末层自身的深浅两面，按参考从上接点向下顺同一斜势画过折处。保留同侧短尖褶、第三道摆缘和左翼外轮廓。

[局部对照](review-02-evidence/composite/R13-comparison.png) · [合成与独显放大](review-02-evidence/details/extra-tier-four.png)

### R14　末层右翼可见长斜褶 `(945, 982, 53, 65)`

`skirt_tier_four` 在 `skirt_tier_three` 右端下接的宽暗褶弯成明显的 S 形，弯心附近窄粉亮面被挤细。参考由第三道摆缘直接接出连续、均匀展开的斜弧。沿这道褶的参考明暗边从摆缘到下段重画，把折向处融进两侧布面。保留右翼的短暗楔和原裙边。

[局部对照](review-02-evidence/composite/R14-comparison.png) · [合成与独显放大](review-02-evidence/details/extra-tier-four.png)

### R15　末层左侧裙摆凹口 `(334, 1108, 17, 25)`

`skirt_tier_four` 约 `(340, 1114)` 的短横摆缘与转下的竖弧之间夹一个浅色小阶，深线略断。参考在同一凹口用一条深线绕过转角，布面连续。取上下两段邻近线色补在本层，接顺转角内侧的粉色与深边。保留凹口的深浅和两段裙弧。

[局部对照](review-02-evidence/composite/R15-comparison.png) · [裙摆凹口放大](review-02-evidence/details/extra-hem.png)

### R16　末层中偏右裙摆凹口 `(715, 1123, 18, 21)`

`skirt_tier_four` 约 `(720, 1127)` 的凹口顶部，向右的横弧端点高出竖边的末端，处于同一转角的深线中间露出浅色台阶。参考圆角由竖边平滑转向右方。将两侧深线以同一宽度衔接，补顺挨转角的布面和外缘过渡，保留开口轮廓。

[局部对照](review-02-evidence/composite/R16-comparison.png) · [裙摆凹口放大](review-02-evidence/details/extra-hem.png)

### R17　末层右侧裙摆凹口 `(897, 1099, 18, 24)`

`skirt_tier_four` 约 `(906, 1106)` 在斜折角右边有一小段浅隙，切断向右的裙摆深线。参考这段深轮廓经过折角后连续延伸。用两侧原描边的颜色和线宽接回短断口，同时收顺相邻暗粉面。保留凹口形状和内侧褶线在裙边的落点。

[局部对照](review-02-evidence/composite/R17-comparison.png) · [裙摆凹口放大](review-02-evidence/details/extra-hem.png)

### R18　第一、二道裙片左侧接点 `(390, 645, 14, 18)`

`skirt_tier_one` 左摆角与 `skirt_tier_two` 左侧缘约 `(396, 652)` 的布色已相接，深轮廓在两段之间仍有浅灰断点，原尺寸外缘线在此突然变淡。参考的上层圆角与下层斜边由相同深色连续交会。于第二道裙片自己的上角接画短描边，沿下方原斜率衔接上方圆角。保留第一道裙片独立的圆角与第二道上搭量。

[局部对照](review-02-evidence/composite/R18-comparison.png) · [侧缘接点放大](review-02-evidence/details/extra-side.png)

### R19　第二、三道裙片右侧接点 `(914, 826, 17, 22)`

`skirt_tier_two` 右摆角下方，`skirt_tier_three` 右侧缘在约 `(919, 836)` 向下的一短段出现深灰内影，外线在接点下骤然加粗。参考在圆角下接出单一、宽度连贯的斜边。先独显第三道裙片，沿其自身轮廓清掉内灰影，在这一小段恢复相邻线宽与布面的过渡。复显第二道裙片核对圆角平顺落到下层斜边。

[局部对照](review-02-evidence/composite/R19-comparison.png) · [侧缘接点放大](review-02-evidence/details/extra-side.png)

## 检查覆盖

- 在 Krita 打开当前交付，导出默认合成、11 张独显、11 张隐藏该层以上衣片后的合成，以及左右肩组件各一张。用同坐标纯衣服参考与分件 SVG 色块逐片对照，并放大检查肩顶、肩根、领冠、两领端、腰线、三道裙层接缝和末层裙摆。末层位于最下，其独显与隐藏上层状态相同；腰带位于最上，其揭开状态为默认合成。
- 实查图层从后到前为 `skirt_tier_four`、`skirt_tier_three`、`skirt_tier_two`、`skirt_tier_one`、`image_left_shoulder_assembly/right_shoulder_ruffle`、`image_left_shoulder_assembly/right_shoulder_strap`、`image_right_shoulder_assembly/left_shoulder_ruffle`、`image_right_shoulder_assembly/left_shoulder_strap`、`neckline_ruffle`、`dress_bodice`、`waistband`。图层树为 11 个独立绘画层，均无子节点，与 `groups.json` 的终止 part 及 `occlusion.json` 所列单深度顺序相符。左右肩的带和荷叶分别检查并按各自的 KRA 层序同显检查。图层树没有显隐蒙版，同一终止 part 也没有多深度分片，因此不存在可切换的蒙版或待合看分片。
- 穿衣图中两侧是搭在上臂前方的开放式肩荷叶，适用的是自由边和缝根的完整性。方领上方为正常敞口，KRA 合成保留了开口透明；本件参考无独立纱料。检查范围为衣服绘画层。显隐调整仅在 Krita 内存中执行，工程、分层结构及既有正式报告保持原样。
