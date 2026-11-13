结论：需要修复

已查完全部 23 个逻辑衣片、32 个实际绘画分片及 7 个显隐透明度蒙版，确认以下 6 项需要修复的问题。本轮 R1–R6 重新编号，与 review-01 的编号不同。问题均来自本轮正式 KRA 的实际导出；repair 报告及工作区暂存图没有替代验收。

坐标使用 1115×1410 原画布，框格式为 `[x,y,width,height]`。“画面左／右”按观看方向，图层名中的 left/right 按角色自身方向。

## 检查范围与只读状态

- 在 Krita 5.3.4.1 实际打开 `clothing-raster-layering/step01/clothing-depth.kra`。全部 32 个绘画分片逐一独显；关闭显隐蒙版并隐藏所有更高深度层，观察各片补全区；全部 23 个逻辑 part 的分片分别查看后再合看连续性。前后深度分片没有因同属一个 part 而被判为重复。
- 全部 7 个蒙版逐一启用、停用，查看其控制衣片的两种状态；另看默认整图和全部蒙版停用整图。默认全隐的后片通过停用蒙版查看了实际布面。
- 对照 `clothing-part-layering/references/clothing.png`、原穿衣角色 `part-layering/references/simplified-subject.png`，读取 `clothing-part-layering/parts/`、`groups.json`、`occlusion.json`。放大查看两肩袖窿、两袖口回转端、领根与领尖、领带与领叶、前片与驳头、两翼与方扣、门襟、裙腰及前后裙摆；裙身 d11、d24 另外查看原尺寸独显。
- 已阅读 step01 的正式 `report.md`、`review-01.md`、`repair-01.md`，并在当前工程中复核前轮修复。只检查衣服分层 KRA，不检查身体装配。
- 本轮只在内存切换显隐并导出，没有保存 KRA、修改绘画像素或上游分层文件。原显隐状态已恢复，见 [Krita 状态核对](review-02-evidence/krita-state-verification.json)。KRA、groups、occlusion 和 parts 共 36 个输入文件审查前后 SHA256 全部一致，见 [只读核对](review-02-evidence/readonly-verification.json)。哈希仅验证输入未改动，不用于画面质量判断。

实际导出：[默认合成](review-02-evidence/exports/default.png)、[全部蒙版停用](review-02-evidence/exports/all-masks-off.png)、[恢复原显隐后的合成](review-02-evidence/exports/default-restored.png)、[完整导出索引及图层 UUID](review-02-evidence/export-manifest.json)。

[上游逻辑色块合成](review-02-evidence/upstream-colorblocks.png)用于核对 part 范围和部件位置；它按各逻辑 part 最前深度排列，不作为前后深度分片合成或隐藏布面的外观证据。实际层级、补全及接缝判断以 KRA 导出为准。

## 框选证据

框选由 reviewer 看图确认后提交给标记工具。工具没有自动判差或决定结论。局部对照为同一画布坐标裁切，左参考、右当前，未移动或缩放参考以匹配当前画面。



- [默认合成框坐标、图层与说明](review-02-evidence/regions/composite/regions.json)。
- [R3：d33 独显定位](review-02-evidence/regions/cuff-solo/marked.png)、[独显框记录](review-02-evidence/regions/cuff-solo/regions.json)。
- 工具原始目录及正式证据副本见 [annotation-index.json](review-02-evidence/annotation-index.json)。工具原始记录未改写；本报告引用的图片副本全部位于 step01。

## 确定需要修复的问题

### R1 — 衬衫下半可见明暗及褶面仍偏离参考

**图层与位置：** `inner_shirt/shirt_body | near | d22`，UUID `{dc5f75b1-3c42-4be7-85cf-d19049187fb1}`；框 `[548,570,174,121]`，扣带以下、裙腰以上，门襟两侧的可见蓝灰布面。

**当前表现：** 三粒纽扣和弯曲门襟已经恢复，但两侧布面仍明显偏暗，多道尖斜三角折面延续到下缘，参考的宽而圆润的亮褶面没有画回。d22 独显、同 part 合看和默认整图都能看见此差别。

**参考依据与影响：** 衣服参考该段两侧有宽的蓝灰亮面，下腹褶皱圆润，门襟旁的明暗转折较平缓。当前改变了可见布面色调与折面形状；这是前轮 R5 中布面部分的遗留问题，不能因三扣已补齐而认为该区域全部修复。

**修复方向：** 在 d22 上按参考局部重画门襟两侧的亮面、暗褶及过渡，恢复宽而圆润的折面，接入上方隐藏布料。保留已恢复的三扣、间距与弯曲门襟。参考取样只包含本衬衫布面，避免取入扣带、外套边线或它们投下的阴影；补全区与可见区应连成同一布面。

**复验：** d22 独显、隐藏更高层、d2/d22 合看及默认合成均查看；原尺寸可见区明暗与褶面符合参考，局部替换边界无硬边或色差，三扣和门襟保持完整。



证据：[当前局部](review-02-evidence/regions/composite/R1-current.png)、[参考局部](review-02-evidence/regions/composite/R1-reference.png)、[放大对照](review-02-evidence/boards/shirt-comparison.png)、[d22 独显](review-02-evidence/exports/solo-d22.png)、[隐藏更高层](review-02-evidence/exports/uncover-d22.png)、[衬衫前后合看](review-02-evidence/exports/part-inner_shirt__shirt_body.png)。

### R2 — 画面左袖带上缘有断续黑线和锯齿

**图层与位置：** `outer_jacket/right_sleeve | near | d33`，UUID `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}`；框 `[205,515,184,111]`，白袖布与青色袖带之间的弧形接边，约从 `(212,522)` 至 `(366,611)`。

**当前表现：** 袖带大面积杂斑已改善，但上缘仍为断续的黑色像素串，带有锯齿、小凸点和线宽跳变。d33 独显及默认合成都能看到，局部放大可明确定位这些边线缺陷。

**参考依据与影响：** 参考该接边为平顺连续的蓝色边及自然阴影。当前黑线断续、硬且不均匀，破坏白布至青带的连续接边和原尺寸轮廓洁净度。

**修复方向：** 在 d33 上沿本片接边重画连续、抗锯齿的弧线，按参考恢复蓝色边与白布、青带之间的自然接色；清除黑凸点，控制线宽，避免把整条接边扩成粗黑轮廓。保留现有收拢袖口、窄透明开口、far 内壁及青带连续明暗。

**复验：** d33 独显、d7/d33 合看及默认合成在原尺寸和放大下检查；接边无断续黑点、锯齿和线宽突变，白布与青带接色自然。



证据：[当前局部](review-02-evidence/regions/composite/R2-current.png)、[参考局部](review-02-evidence/regions/composite/R2-reference.png)、[袖口放大对照](review-02-evidence/boards/left_cuff-comparison.png)、[d33 独显](review-02-evidence/exports/solo-d33.png)、[隐藏更高层](review-02-evidence/exports/uncover-d33.png)、[本袖前后合看](review-02-evidence/exports/part-outer_jacket__right_sleeve.png)。

### R3 — 画面左袖口内缘回转端有台阶和短暗尾

**图层与位置：** 主要为 `outer_jacket/right_sleeve | near | d33`，UUID `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}`；接合检查涉及 `outer_jacket/right_sleeve | far | d7`，UUID `{16be55fe-78c2-4e58-a605-4bf1eaa070e1}`。框 `[306,627,51,34]`，窄袖口透明内缘靠画面右下的回转端。

**当前表现：** d33 独显的透明内缘末端有突兀的台阶，边线末端向青色布面伸出短暗尾；d7/d33 同片合看后仍有局部下伸的暗凸点。它连接着本片边线，并非游离点，也不是重复衣片。

**参考依据与影响：** 衣服参考的袖口边线以光滑曲线回转，没有这样的短尾和突兀末端。原穿衣角色提供袖口收拢的形态依据；本项只要求回转端干净、连续，不要求把窄开口改回衣服提取图中的宽开口。当前分片自身边缘有小瑕疵，前后合看也未完全接顺。

**修复方向：** 局部修顺 d33 的 alpha 内缘和边线末端，去掉伸入青带的短暗尾，使回转曲线及线宽连续；与 d7 合看确认内壁自然接入。优先整理 near 末端，不因相关 far 分片存在而整片改动。保留窄开口、完整内壁和足够搭接，不以启用蒙版遮住、不填实开口。

**复验：** d33 独显、d7 独显、两片合看及默认合成均检查此端点；原尺寸无暗凸点，放大无突兀台阶、短尾或新缺口。



证据：[当前合成局部](review-02-evidence/regions/composite/R3-current.png)、[参考定位局部](review-02-evidence/regions/composite/R3-reference.png)、[工具左参考／右 d33 独显](review-02-evidence/regions/cuff-solo/R3-comparison.png)、[独显当前局部](review-02-evidence/regions/cuff-solo/R3-current.png)、[参考／d33 独显／本袖合看放大](review-02-evidence/details/cuff-tip.png)、[d7 独显](review-02-evidence/exports/solo-d7.png)。同坐标参考用于轮廓处理依据，不用于要求当前开口宽度一致。

### R4 — 画面左袖窿接缝仍有黑残线与断续小点

**图层与位置：** `outer_jacket/right_sleeve | near | d33`，UUID `{9a4f33d7-a9b4-48ed-8364-962fc589aae9}`；`outer_jacket/jacket_body/right_front/front_panel | complete | d35`，UUID `{877dbbf4-dc9b-42be-93ff-607fd26659bc}`。框 `[357,329,81,227]`，肩根上段约 `x366–391、y338–366`，下段约 `x418–431、y490–551`。

**当前表现：** 前轮粗双边已明显改善，但默认合成上段蓝缝沿边仍露出细黑残线，下段仍有小白点与黑色断续边。d33 独显可见其根部深边；与前片搭接后边缘没有全部整理干净。

**参考依据与影响：** 参考上段是单条连续蓝色细缝，向腋下自然转深，缝内没有断续白点或另露一条黑像素边。当前残边和小点使两片接合处仍可辨认，未达到原尺寸衔接干净的要求。

**修复方向：** 协同整理 d33/d35 的搭接宽度及各自边缘，使本应被覆盖的 d33 深色外边收在搭接区；按参考重画实际露出的单条蓝缝及向深色过渡，清除白点和断续残边。两片各自仍需有完整连续布面，不能只擦接边造成独显缺口；不以改动整件层序代替局部接缝修整。

**复验：** 两片分别独显、隐藏更高层及合看；原尺寸肩根至下段接缝无黑残线、白点、台阶或线宽跳变，放大后颜色与抗锯齿连续。



证据：[当前局部](review-02-evidence/regions/composite/R4-current.png)、[参考局部](review-02-evidence/regions/composite/R4-reference.png)、[参考／d33 独显／默认合成放大](review-02-evidence/details/shoulder.png)、[肩袖对照](review-02-evidence/boards/left_shoulder-comparison.png)、[d33 独显](review-02-evidence/exports/solo-d33.png)、[d35 独显](review-02-evidence/exports/solo-d35.png)、[d35 隐藏更高层](review-02-evidence/exports/uncover-d35.png)。

### R5 — 画面右白翻领斜边青色包边缺段

**图层与位置：** `outer_jacket/jacket_collar/left_collar_flap | near | d38`，UUID `{4359e5cc-efc4-42b6-b83c-a7dbaf7a6cfd}`；框 `[667,302,99,111]`，白翻领斜自由边至下方领尖。

**当前表现：** 斜边上半几乎只有白边或极细浅线，参考应有的青色包边缺了一大段；到下端才突然出现较宽青边。d38 独显与默认合成一致，不能由上层遮挡解释。

**参考依据与影响：** 衣服参考该斜自由边为连续、较宽的青色包边，并顺着领尖接入下缘。当前缺段改变了明确可见的参考色块和轮廓，也使剩余包边宽度转折突兀。

**修复方向：** 在 d38 上沿参考斜边恢复青色包边的宽度、颜色及连续曲线，与领尖、下缘自然接通；按本片明暗融入白布，不以沿形状整块填色代替绘画。保留领根搭接、正常开口、独立驳头以及同 part 的 far d4，不为补边合并前后绘画层。

**复验：** d38 独显、d4/d38 合看和默认合成检查；青包边从斜边上端到领尖连续，宽度过渡自然，无缺段、断线或硬接边。



证据：[当前局部](review-02-evidence/regions/composite/R5-current.png)、[参考局部](review-02-evidence/regions/composite/R5-reference.png)、[参考／d38 独显／合成放大](review-02-evidence/details/collar-edge.png)、[d38 独显](review-02-evidence/exports/solo-d38.png)、[隐藏更高层](review-02-evidence/exports/uncover-d38.png)、[本翻领前后合看](review-02-evidence/exports/part-outer_jacket__jacket_collar__left_collar_flap.png)。

### R6 — 画面右前衣片开襟边和下摆新增亮青细带

**图层与位置：** `outer_jacket/jacket_body/left_front/front_panel | complete | d34`，UUID `{fffcff2e-2fe2-4773-81c6-f4f5eedf83de}`；框 `[674,498,181,275]`，开襟内边约从 `(680,502)` 至 `(738,761)`，再沿下摆至约 `(847,713)`。

**当前表现：** 内边及下摆出现贯通的高饱和亮青细带，紧邻深色外轮廓，d34 独显及默认合成都可见。

**参考依据与影响：** 参考该开襟和下摆是深蓝黑轮廓与白布自然接边，没有这条亮青滚边；真实青色包边位于口袋和驳头等指定位置。当前给本前片增加了参考没有的色带，改变服装可见配色结构。

**修复方向：** 在 d34 上以本衣片笔触或本片参考取样，局部恢复深色外缘与白布自然接边，消除新增亮青条。保留已经恢复的胸标及圆点、真正的口袋青包边和驳头青边。开襟上端接入驳头下端时检查线宽、色调和轮廓，避免清边后留下台阶或色差；保持该前片独立绘画层及正常开襟。

**复验：** d34 独显、隐藏更高层及默认合成检查；整条开襟边与下摆无额外亮青带，深色轮廓连续，原尺寸无局部替换接缝，胸标及口袋纹样完整。



证据：[当前局部](review-02-evidence/regions/composite/R6-current.png)、[参考局部](review-02-evidence/regions/composite/R6-reference.png)、[参考／d34 独显／默认合成放大](review-02-evidence/details/front-trim.png)、[前衣片对照](review-02-evidence/boards/right_panel-comparison.png)、[d34 独显](review-02-evidence/exports/solo-d34.png)、[隐藏更高层](review-02-evidence/exports/uncover-d34.png)。

## 前轮修复复核

以下结果来自当前工程查看，不据 repair-01 的“完成”描述直接接受：

| review-01 项目 | 当前复核 |
| --- | --- |
| 原 R1 左袖带斑块、密集尖褶 | 大面积杂斑和密集尖褶已改善；边线与回转端仍有本轮 R2、R3。 |
| 原 R2 左袖窿粗双边 | 粗双边已改善；残线和小点仍有本轮 R4。 |
| 原 R3 右袖窿粗黑缝 | 当前已改善，未确认需要新增的修复项。 |
| 原 R4 胸标位置、尺寸、遮挡 | 已恢复可见胸标及圆点，当前未再确认此问题；保留这一修复。 |
| 原 R5 衬衫三扣、门襟、布面 | 三扣与弯曲门襟已恢复；可见布面仍有本轮 R1。 |
| 原 R6 前领座游离点 | d23 独显已清除该点，同 part 合看正常。 |
| 原 R7 左白翻领前后方头 | d5/d39 接头已改善，当前未再确认方头问题。 |
| 原 R8 中央方扣放大 | 当前大小与圆角已恢复，未再确认此问题。 |
| 原 R9 前裙片中央青蓝残边 | d24 中央下缘原尺寸及放大已查看，原定位处残边问题已改善；前后裙片仍独立。 |

复核图：[领根](review-02-evidence/details/white-collar-root.png)、[扣件](review-02-evidence/boards/buckle-comparison.png)、[右袖窿](review-02-evidence/boards/right_shoulder-comparison.png)、[前裙片下缘](review-02-evidence/details/skirt-front-edge.png)、[d11 原尺寸独显](review-02-evidence/details/skirt-d11-native.png)、[d24 原尺寸独显](review-02-evidence/details/skirt-d24-native.png)。其他衣片未确认需要另外列出的修复问题；这不替代 R1–R6 修复后的复验。


## 逐衣片检查覆盖

下表覆盖全部实际绘画分片。每个深度分片均已在 Krita 中独显，停用显隐蒙版并隐藏所有更高深度层看补全区，再同 part 合看及整图对照参考。单层 part 的合看就是该层本身。“未确认其他问题”仅表示本轮没有另外确定要修的图像证据。

表中 `dN` 对应完整图层名称末尾的 `| dN`；完整层名、UUID 与实际导出路径见导出索引。链接均为原画布导出，不以观察板缩图代替原图。

| 逻辑 part | 深度分片 | 独显（均已查） | 隐藏更高层／补全区（均已查） | 同 part 合看（已查） | 确定问题 |
| --- | --- | --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel` | d1 | [d1](review-02-evidence/exports/solo-d1.png) | [d1](review-02-evidence/exports/uncover-d1.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_body__back_panel.png) | 未确认其他问题 |
| `inner_shirt/shirt_body` | d2、d22 | [d2](review-02-evidence/exports/solo-d2.png)、[d22](review-02-evidence/exports/solo-d22.png) | [d2](review-02-evidence/exports/uncover-d2.png)、[d22](review-02-evidence/exports/uncover-d22.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__shirt_body.png) | R1 |
| `outer_jacket/jacket_collar/collar_root` | d3 | [d3](review-02-evidence/exports/solo-d3.png) | [d3](review-02-evidence/exports/uncover-d3.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_collar__collar_root.png) | 未确认其他问题 |
| `outer_jacket/jacket_collar/left_collar_flap` | d4、d38 | [d4](review-02-evidence/exports/solo-d4.png)、[d38](review-02-evidence/exports/solo-d38.png) | [d4](review-02-evidence/exports/uncover-d4.png)、[d38](review-02-evidence/exports/uncover-d38.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_collar__left_collar_flap.png) | R5 |
| `outer_jacket/jacket_collar/right_collar_flap` | d5、d39 | [d5](review-02-evidence/exports/solo-d5.png)、[d39](review-02-evidence/exports/solo-d39.png) | [d5](review-02-evidence/exports/uncover-d5.png)、[d39](review-02-evidence/exports/uncover-d39.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_collar__right_collar_flap.png) | 未确认其他问题 |
| `outer_jacket/left_sleeve` | d6、d32 | [d6](review-02-evidence/exports/solo-d6.png)、[d32](review-02-evidence/exports/solo-d32.png) | [d6](review-02-evidence/exports/uncover-d6.png)、[d32](review-02-evidence/exports/uncover-d32.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__left_sleeve.png) | 未确认其他问题 |
| `outer_jacket/right_sleeve` | d7、d33 | [d7](review-02-evidence/exports/solo-d7.png)、[d33](review-02-evidence/exports/solo-d33.png) | [d7](review-02-evidence/exports/uncover-d7.png)、[d33](review-02-evidence/exports/uncover-d33.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__right_sleeve.png) | R2、R3、R4 |
| `inner_shirt/left_sleeve` | d8、d20 | [d8](review-02-evidence/exports/solo-d8.png)、[d20](review-02-evidence/exports/solo-d20.png) | [d8](review-02-evidence/exports/uncover-d8.png)、[d20](review-02-evidence/exports/uncover-d20.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__left_sleeve.png) | 未确认其他问题 |
| `inner_shirt/right_sleeve` | d9、d21 | [d9](review-02-evidence/exports/solo-d9.png)、[d21](review-02-evidence/exports/solo-d21.png) | [d9](review-02-evidence/exports/uncover-d9.png)、[d21](review-02-evidence/exports/uncover-d21.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__right_sleeve.png) | 未确认其他问题 |
| `inner_shirt/shirt_collar/collar_base` | d10、d23 | [d10](review-02-evidence/exports/solo-d10.png)、[d23](review-02-evidence/exports/solo-d23.png) | [d10](review-02-evidence/exports/uncover-d10.png)、[d23](review-02-evidence/exports/uncover-d23.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__shirt_collar__collar_base.png) | 未确认其他问题 |
| `pleated_skirt/skirt_body` | d11、d24 | [d11](review-02-evidence/exports/solo-d11.png)、[d24](review-02-evidence/exports/solo-d24.png) | [d11](review-02-evidence/exports/uncover-d11.png)、[d24](review-02-evidence/exports/uncover-d24.png) | [合看原图](review-02-evidence/exports/part-pleated_skirt__skirt_body.png) | 未确认其他问题 |
| `pleated_skirt/waistband` | d25 | [d25](review-02-evidence/exports/solo-d25.png) | [d25](review-02-evidence/exports/uncover-d25.png) | [合看原图](review-02-evidence/exports/part-pleated_skirt__waistband.png) | 未确认其他问题 |
| `short_necktie/hanging_blade` | d26 | [d26](review-02-evidence/exports/solo-d26.png) | [d26](review-02-evidence/exports/uncover-d26.png) | [合看原图](review-02-evidence/exports/part-short_necktie__hanging_blade.png) | 未确认其他问题 |
| `short_necktie/knot_and_attachment` | d27 | [d27](review-02-evidence/exports/solo-d27.png) | [d27](review-02-evidence/exports/uncover-d27.png) | [合看原图](review-02-evidence/exports/part-short_necktie__knot_and_attachment.png) | 未确认其他问题 |
| `inner_shirt/shirt_collar/left_collar_leaf` | d28 | [d28](review-02-evidence/exports/solo-d28.png) | [d28](review-02-evidence/exports/uncover-d28.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__shirt_collar__left_collar_leaf.png) | 未确认其他问题 |
| `inner_shirt/shirt_collar/right_collar_leaf` | d29 | [d29](review-02-evidence/exports/solo-d29.png) | [d29](review-02-evidence/exports/uncover-d29.png) | [合看原图](review-02-evidence/exports/part-inner_shirt__shirt_collar__right_collar_leaf.png) | 未确认其他问题 |
| `jacket_front_clasp/left_clasp_wing` | d30 | [d30](review-02-evidence/exports/solo-d30.png) | [d30](review-02-evidence/exports/uncover-d30.png) | [合看原图](review-02-evidence/exports/part-jacket_front_clasp__left_clasp_wing.png) | 未确认其他问题 |
| `jacket_front_clasp/right_clasp_wing` | d31 | [d31](review-02-evidence/exports/solo-d31.png) | [d31](review-02-evidence/exports/uncover-d31.png) | [合看原图](review-02-evidence/exports/part-jacket_front_clasp__right_clasp_wing.png) | 未确认其他问题 |
| `outer_jacket/jacket_body/left_front/front_panel` | d34 | [d34](review-02-evidence/exports/solo-d34.png) | [d34](review-02-evidence/exports/uncover-d34.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_body__left_front__front_panel.png) | R6 |
| `outer_jacket/jacket_body/right_front/front_panel` | d35 | [d35](review-02-evidence/exports/solo-d35.png) | [d35](review-02-evidence/exports/uncover-d35.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_body__right_front__front_panel.png) | R4 |
| `outer_jacket/jacket_body/left_front/lapel` | d36 | [d36](review-02-evidence/exports/solo-d36.png) | [d36](review-02-evidence/exports/uncover-d36.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_body__left_front__lapel.png) | 未确认其他问题 |
| `outer_jacket/jacket_body/right_front/lapel` | d37 | [d37](review-02-evidence/exports/solo-d37.png) | [d37](review-02-evidence/exports/uncover-d37.png) | [合看原图](review-02-evidence/exports/part-outer_jacket__jacket_body__right_front__lapel.png) | 未确认其他问题 |
| `jacket_front_clasp/center_buckle` | d40 | [d40](review-02-evidence/exports/solo-d40.png) | [d40](review-02-evidence/exports/uncover-d40.png) | [合看原图](review-02-evidence/exports/part-jacket_front_clasp__center_buckle.png) | 未确认其他问题 |

## 显隐蒙版两状态覆盖

7 个蒙版全部实际切换并查看。下表的停用状态显示被控制绘画层的完整布面，启用状态显示该层的默认显隐结果。默认全隐是结构规定的显隐方式，不能据启用后空白判定衣片缺失。5 个显隐组只承载控制，内部绘画层仍分别检查。

| 显隐蒙版名称 | 所属实际节点 | 控制分片 | 停用（已查） | 启用（已查） | 复核结果 |
| --- | --- | --- | --- | --- | --- |
| `outer_jacket/jacket_body/back_panel \| default hidden` | `outer_jacket/jacket_body/back_panel \| complete \| d1` | d1 | [停用原图](review-02-evidence/exports/mask-1-off.png) | [启用原图](review-02-evidence/exports/mask-1-on.png) | 两状态已查，未确认额外蒙版问题 |
| `inner_shirt/shirt_body \| default concealed \| d2` | `inner_shirt/shirt_body \| visibility control \| d2` | d2 | [停用原图](review-02-evidence/exports/mask-2-off.png) | [启用原图](review-02-evidence/exports/mask-2-on.png) | 两状态已查，未确认额外蒙版问题 |
| `outer_jacket/jacket_collar/collar_root \| default hidden` | `outer_jacket/jacket_collar/collar_root \| complete \| d3` | d3 | [停用原图](review-02-evidence/exports/mask-3-off.png) | [启用原图](review-02-evidence/exports/mask-3-on.png) | 两状态已查，未确认额外蒙版问题 |
| `inner_shirt/left_sleeve \| default concealed \| d8` | `inner_shirt/left_sleeve \| visibility control \| d8` | d8 | [停用原图](review-02-evidence/exports/mask-4-off.png) | [启用原图](review-02-evidence/exports/mask-4-on.png) | 两状态已查，未确认额外蒙版问题 |
| `inner_shirt/right_sleeve \| default concealed \| d9` | `inner_shirt/right_sleeve \| visibility control \| d9` | d9 | [停用原图](review-02-evidence/exports/mask-5-off.png) | [启用原图](review-02-evidence/exports/mask-5-on.png) | 两状态已查，未确认额外蒙版问题 |
| `inner_shirt/left_sleeve \| default concealed \| d20` | `inner_shirt/left_sleeve \| visibility control \| d20` | d20 | [停用原图](review-02-evidence/exports/mask-6-off.png) | [启用原图](review-02-evidence/exports/mask-6-on.png) | 两状态已查，未确认额外蒙版问题 |
| `inner_shirt/right_sleeve \| default concealed \| d21` | `inner_shirt/right_sleeve \| visibility control \| d21` | d21 | [停用原图](review-02-evidence/exports/mask-7-off.png) | [启用原图](review-02-evidence/exports/mask-7-on.png) | 两状态已查，未确认额外蒙版问题 |

两状态整体证据：[全部蒙版停用](review-02-evidence/exports/all-masks-off.png)、[默认蒙版启用](review-02-evidence/exports/default.png)。

## 观察板索引

以下观察板均已看过，便于复查；所有原画布导出保留在上述表及导出索引中。小部件放大与裙片观察板缩放仅用于观看，问题框坐标始终使用原画布。

- 逐分片独显：[1](review-02-evidence/boards/solo-1.png)、[2](review-02-evidence/boards/solo-2.png)、[3](review-02-evidence/boards/solo-3.png)、[4](review-02-evidence/boards/solo-4.png)、[5](review-02-evidence/boards/solo-5.png)、[6](review-02-evidence/boards/solo-6.png)、[7](review-02-evidence/boards/solo-7.png)、[8](review-02-evidence/boards/solo-8.png)。
- 隐藏更高层：[1](review-02-evidence/boards/uncover-1.png)、[2](review-02-evidence/boards/uncover-2.png)、[3](review-02-evidence/boards/uncover-3.png)、[4](review-02-evidence/boards/uncover-4.png)、[5](review-02-evidence/boards/uncover-5.png)、[6](review-02-evidence/boards/uncover-6.png)、[7](review-02-evidence/boards/uncover-7.png)、[8](review-02-evidence/boards/uncover-8.png)。
- 同 part 合看：[1](review-02-evidence/boards/parts-1.png)、[2](review-02-evidence/boards/parts-2.png)、[3](review-02-evidence/boards/parts-3.png)、[4](review-02-evidence/boards/parts-4.png)、[5](review-02-evidence/boards/parts-5.png)、[6](review-02-evidence/boards/parts-6.png)。
- 蒙版两状态：[1](review-02-evidence/boards/masks-1.png)、[2](review-02-evidence/boards/masks-2.png)、[3](review-02-evidence/boards/masks-3.png)、[4](review-02-evidence/boards/masks-4.png)。

## 修复后验收要求

R1–R6 应在正式 KRA 的相关独立绘画层上完成，保持 23 个逻辑 part 和需要分开的前后绘画层。逐项修复后重看独显、停用蒙版的补全区、同 part 合看与默认合成；接缝同时在原尺寸和放大下验收。保留穿着时收拢的袖口、完整内壁、透明正常开口及已经恢复的纽扣、胸标和方扣。全部确定问题消除后，再对全片及全部蒙版两状态做完整复验。
