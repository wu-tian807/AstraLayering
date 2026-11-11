结论：需要修复

# 第一步独立 review

已完成全部 18 个逻辑衣片、25 个实际绘画深度层的检查，确定需要修复的局部问题共 9 项（R1–R9）。问题涉及领缘接缝、后垂片纹样、腰带描边与明暗、自由绳纹样和描边、流苏描边、外襟下摆明暗。

本次在 Krita 5.3.4.1 中打开当前 `clothing-raster-layering/step01/clothing-depth.kra`，等待投影完成后重新导出；所有下列当前图均来自本次实际工程。工程、参考、SVG、groups.json 和 occlusion.json 均未写入。只在内存切换图层与蒙版显隐，导出后恢复原状态，没有保存工程或修改像素。本步不检查身体装配。

## 输入与检查依据

- 当前工程：`clothing-raster-layering/step01/clothing-depth.kra`，1376×2048。
- 绘画参考：`clothing-part-layering/references/clothing.png`，同画布、同坐标。
- 穿着形态依据：`part-layering/references/simplified-subject.png`，仅用于理解袖口收拢和穿插形态。
- 衣片归属、补全轮廓与深度：`clothing-part-layering/parts/`、`clothing-part-layering/groups.json`、`clothing-part-layering/occlusion.json`。
- 已阅读本步骤现有正式 `report.md`；本目录没有既有正式 review / repair 报告。生产记录中的“通过”没有作为本次看图结论。

每个深度层均看过独显和隐藏全部上层后的累计画面；两类画面都检查了蒙版停用、启用状态。每个逻辑 part 的多深度分片先分别看，再在同画布坐标合起来看。整图对照参考后，另以原尺寸及放大局部检查领袖、腰侧、前结与自由绳、珠与流苏、襟边、金花、下摆和后垂片纹样及底角。没有用 PSNR、像素差或其他相似度数字作美术判定。

## 问题总览



框选坐标为原画布 `[x,y,width,height]`。框选清单：[regions.json](clothing-raster-layering/step01/review-evidence/independent-review-20261106/regions/regions.json)。每项局部对照均为左参考、右当前，参考没有移动或缩放；工具的 padding 只增加观察上下文。

| 编号 | 深度层 | 位置 | 确定要修的问题 |
|---|---|---|---|
| R1 | d13、d14 | `[595,525,130,95]` | 领缘交叠出现白缝，深色包边未接顺。 |
| R2 | d01 | `[155,1490,300,255]` | 左后垂片三条草叶弧线的长短、宽度和布局变动。 |
| R3 | d02 | `[920,1380,320,355]` | 右后垂片两朵花与草叶纹样放大、偏移。 |
| R4 | d11、d18 | `[485,640,410,170]` | 金带缺少深色外线，强反光明暗与参考不符。 |
| R5 | d19 | `[620,750,70,175]` | 左自由绳改成密集螺旋斜纹，外线偏细。 |
| R6 | d20 | `[690,750,70,175]` | 右自由绳纹样走向与参考不符，外线偏细。 |
| R7 | d21 | `[598,945,61,91]` | 左流苏左右及底缘深色描边缺失。 |
| R8 | d22 | `[721,944,61,92]` | 右流苏左右及底缘深色描边缺失。 |
| R9 | d14 | `[560,990,225,218]` | 外襟下摆新增斜褶和灰紫折面，改变参考浅色布面。 |

## R1：领缘交叠白缝

**相关图层：** `d13 | kimono_body/right_underlap_panel | complete front cloth and outline`；`d14 | kimono_body/left_overlap_panel | complete front cloth and outline`。

**位置与当前表现：** 中央胸前交叠斜边，约 x595–725、y525–620。当前深色领缘之间露出一条连续白线，原尺寸下即可辨认。d13 独显可见深色领缘到补全白料的截断端；d14 独显该处外边本身为深色，叠合后白料沿其边缘露出。

**参考依据：** 纯衣服参考同位置为深色内襟与深色外襟直接叠接，没有白条；粉线各自沿领缘保持连续。

**影响：** 接缝可见，破坏深色领缘的连续交叠，并暴露补全边界。

**修复方向与保留内容：** 先在 d13 的搭接区接着补完本片深色包边及粉线，使领缘不在白料处骤然终止；再微调交界局部轮廓，保证 d14 覆盖后无白缝、台阶或双边。不要整片移动衣襟来掩盖问题。保留参考敞领空间、外襟原有斜边与双粉线，复查 d13 独显和 d13+d14 合成。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R1-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R1-reference.png`。这两项图片路径相对本报告目录。



## R2：左后垂片草叶纹样变化

**相关图层：** `d01 | rear_drape_screen_left | complete`。

**位置与当前表现：** 画面左长后垂片下部三条浅色草叶，约 x155–455、y1490–1745。上方短弧和中部长弧抬高，中部长弧向右延伸更远，左下草叶也画得更宽长。

**参考依据：** 同坐标对照中，参考中部长弧的右尖端更靠左、弧线更低；三条草叶的长短与相互留白不同。此项不要求移动或重画花朵。

**影响：** 改变参考纹样布局，草叶与花朵、底框的相对间距不符。

**修复方向与保留内容：** 以本侧参考逐条恢复草叶端点、长度、宽度和弧度，用绘画或本片参考取样接顺周围紫色料面。保留花朵、浅色翻面、真实外缘、底角和底框线；不得整体缩放衣片。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R2-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R2-reference.png`。这两项图片路径相对本报告目录。

## R3：右后垂片花草纹样变化

**相关图层：** `d02 | rear_drape_screen_right | complete`。

**位置与当前表现：** 画面右长后垂片下部两朵花及草叶，约 x920–1240、y1380–1735。外侧上花放大并上移、向左偏；内侧下花也向左上偏移。草叶弧线随之抬高并延长。

**参考依据：** 纯衣服参考两朵花的位置、大小及与侧缘的距离都不同；局部对照可见当前上花占据更大面积，下花更靠近画面左侧。

**影响：** 两花和草叶组成的本侧不对称纹样没有按参考还原。

**修复方向与保留内容：** 按右侧参考分别调整两花的大小、位置与瓣形，再恢复草叶弧线端点和曲率。不要镜像左侧纹样替代。保留右垂片根部、浅色翻面、完整布面和底角；移动纹样后把原位置接顺，不留色块补丁或双重花影。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R3-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R3-reference.png`。这两项图片路径相对本报告目录。

## R4：金色腰带描边与明暗不符

**相关图层：** `d11 | outer_waist_band | both side/back returns y670-781`；`d18 | outer_waist_band | complete front cloth and outline`。

**位置与当前表现：** 金带两侧、下缘及带面，约 x485–895、y640–810。d18 独显侧缘与下缘仅有浅褐细线，缺少参考的深色轮廓；带面新增一圈亮黄色连续反光及强烈侧面高光。

**参考依据：** 参考金带以较平缓的黄、金褐块面表达体积，左右侧缘和下缘有与整套服装一致的深色描线。

**影响：** 衣片外线与相邻深色腰层、系绳的线宽不协调，金带呈现不同的材质与明暗处理。

**修复方向与保留内容：** 在 d18 真实外缘补回与参考颜色、粗细一致的深色外线；降低新增的亮黄环形反光，恢复参考自身带面的金色色阶与较平缓转折。d11/d18 同料搭接处同步接顺，不能出现明暗色差。保留完整隐藏带面，不把参考中系绳或结芯投下的阴影画回金带。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R4-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R4-reference.png`。这两项图片路径相对本报告目录。

## R5：左自由绳纹样与轮廓不符

**相关图层：** `d19 | front_pendant_screen_left/right_free_cord | complete`。

**位置与当前表现：** 画面左自由绳的可见长身，约 x620–690、y750–925。当前是多段均匀的粉白螺旋斜纹，左右外线很细。

**参考依据：** 参考本侧为更长、较疏的粉白色带，走向和转折不是当前均匀重复的斜条；轮廓是明确的深色线。

**影响：** 改变系绳纹样与视觉节奏，结芯、绳身、珠体之间线宽突变。

**修复方向与保留内容：** 按左侧参考重画每段粉白色带的长度、走向和衔接，补齐连续深色外线，补全端顺着同一绳身续画。保留结下短根、连续绳形和珠内插入端，不移动珠体或流苏。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R5-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R5-reference.png`。这两项图片路径相对本报告目录。

## R6：右自由绳纹样与轮廓不符

**相关图层：** `d20 | front_pendant_screen_right/left_free_cord | complete`。

**位置与当前表现：** 画面右自由绳长身，约 x690–760、y750–925。当前沿用左绳镜像后的均匀螺旋斜纹，外线同样明显偏细。

**参考依据：** 参考右侧粉白色带有本侧独立的长条走向；局部对照可见原有长色带被切成多段斜条。

**影响：** 未还原本侧纹样，且绳身线宽与前结及珠体不一致。

**修复方向与保留内容：** 独立按右侧参考恢复色带，不仅镜像 R5 的修复结果；补回参考粗细的连续外线。保留绳根、珠内插入端、两支绳的间距和各自独立图层。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R6-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R6-reference.png`。这两项图片路径相对本报告目录。

## R7：左流苏深色外线缺失

**相关图层：** `d21 | front_pendant_screen_left/right_tassel | complete`。

**位置与当前表现：** 画面左珠体下的流苏，两侧外缘至弧形底缘，约 x598–659、y945–1036。当前只有极细浅灰线，底缘尤其淡。

**参考依据：** 参考流苏左右及底边均有连续深色描边，线色与珠体外圈协调；内部细束纹与外轮廓有明确区分。

**影响：** 衣片真实外轮廓没有按参考画完整，珠下连接处出现明显线宽突变。

**修复方向与保留内容：** 沿本片真实两侧和弧底重画深色外线，颜色、粗细按参考与珠体协调，束根处平顺收束。保留白粉束纹、珠后的短搭接和实际底缘；不要把流苏在衣面上的投影复制进本层。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R7-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R7-reference.png`。这两项图片路径相对本报告目录。

## R8：右流苏深色外线缺失

**相关图层：** `d22 | front_pendant_screen_right/left_tassel | complete`。

**位置与当前表现：** 画面右珠体下的流苏，约 x721–782、y944–1036。左右和底缘同样仅剩浅灰细线，与珠体粗黑外圈差异明显。

**参考依据：** 参考右流苏有连续深色外线，弧形底缘清楚，内部束纹保持细线。

**影响：** 轮廓线缺失且接点线宽不协调，与参考画风不符。

**修复方向与保留内容：** 按右侧真实轮廓补齐深色外线，珠后束根和两侧外线衔接自然，弧底不加粗成色块。保留束体的白粉纹理、短隐藏搭接和独立图层。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R8-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R8-reference.png`。这两项图片路径相对本报告目录。

## R9：外襟下摆新增褶皱改变浅色布面

**相关图层：** `d14 | kimono_body/left_overlap_panel | complete front cloth and outline`。

**位置与当前表现：** 外襟下摆中央下部白料，约 x560–785、y990–1208。当前新增数道斜向折线、灰紫三角折面，向下摆形成明显连续折角。

**参考依据：** 参考对应下部为大面积平缓的浅色料面，主要褶皱集中在腰下及右上区域；这几道中央下部斜褶不存在。

**影响：** 可见布面褶皱结构、明暗色块与参考不符，产生额外折叠形体。

**修复方向与保留内容：** 局部减掉新增斜线及深色三角折面，用画笔融色或本片参考取样恢复平缓浅色过渡，边缘接顺。保留参考自身的上方褶皱、金花、双粉线襟边和真实底缘。取样不得带回垂饰投影，也不能沿轮廓整块填色。



证据：当前局部 `review-evidence/independent-review-20261106/regions/R9-current.png`；参考局部 `review-evidence/independent-review-20261106/regions/R9-reference.png`。这两项图片路径相对本报告目录。

## 全衣片检查记录

下表“已看”包括：每个列出的深度分片独显、全部上层隐藏、蒙版停用与启用、同 part 分片合成、最终整图参考对照；接点另看原尺寸及放大。多深度是共同归属的分片，未因层数判为重复。

| 逻辑衣片 | 实际深度 | 独显 / 隐藏上层 / 分片合看 / 蒙版开关 | 本次确定问题 |
|---|---|---|---|
| `rear_drape_screen_left` | d01 | 已看 | R2 |
| `rear_drape_screen_right` | d02 | 已看 | R3 |
| `rear_waist_bow/right_bow_wing` | d03 | 已看 | 无新增确定问题 |
| `rear_waist_bow/left_bow_wing` | d04 | 已看 | 无新增确定问题 |
| `rear_waist_bow/central_knot_root` | d05 | 已看 | 无新增确定问题 |
| `kimono_body/right_underlap_panel` | d06、d13 | 已看 | R1 |
| `kimono_body/left_overlap_panel` | d07、d14 | 已看 | R1、R9 |
| `sleeve_screen_left` | d08、d15 | 已看 | 无新增确定问题 |
| `sleeve_screen_right` | d09、d16 | 已看 | 无新增确定问题 |
| `inner_waist_wrap` | d10、d17 | 已看 | 无新增确定问题 |
| `outer_waist_band` | d11、d18 | 已看 | R4 |
| `front_waist_cord_knot` | d12、d23 | 已看 | 无新增确定问题 |
| `front_pendant_screen_left/right_free_cord` | d19 | 已看 | R5 |
| `front_pendant_screen_right/left_free_cord` | d20 | 已看 | R6 |
| `front_pendant_screen_left/right_tassel` | d21 | 已看 | R7 |
| `front_pendant_screen_right/left_tassel` | d22 | 已看 | R8 |
| `front_pendant_screen_left/right_terminal_bead` | d24 | 已看 | 无新增确定问题 |
| `front_pendant_screen_right/left_terminal_bead` | d25 | 已看 | 无新增确定问题 |

4 个原生透明度蒙版均单独核对：d05 后结根蒙版、d08/d09 远袖壁穿着范围蒙版、d12 后返系绳蒙版。停用可见底纹，启用显示默认范围。袖口同时对照原穿着角色的收拢形态与纯衣服参考的料面；没有把正常开口当作缺口，未仅因存在蒙版而判为问题。后垂片浅色翻面在参考中也收尖，不列为返修项。

实际图层名、边界、状态和全部原尺寸导出的索引：[inspection-manifest.json](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection-manifest.json)；18 个逻辑衣片映射：[logical-index.json](clothing-raster-layering/step01/review-evidence/independent-review-20261106/logical-index.json)。

原尺寸当前证据目录（正文中的以下路径以任务根目录为基准）：

- `clothing-raster-layering/step01/review-evidence/independent-review-20261106/raw/`：d01–d25，蒙版停用独显。
- `clothing-raster-layering/step01/review-evidence/independent-review-20261106/masked/`：d01–d25，蒙版启用独显。
- `clothing-raster-layering/step01/review-evidence/independent-review-20261106/cumulative-off/` 与 `cumulative-on/`：d01–d25，隐藏编号深度以上全部图层的累计画面，分别停用、启用蒙版。
- `clothing-raster-layering/step01/review-evidence/independent-review-20261106/logical-off/` 与 `logical-on/`：p01–p18，同逻辑衣片全部分片合成。

看图索引页（局部问题判断以原尺寸图与上面的框选对照为依据）：

- [raw-sheet-01-05.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/raw-sheet-01-05.png)
- [raw-sheet-06-09.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/raw-sheet-06-09.png)
- [raw-sheet-10-14.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/raw-sheet-10-14.png)
- [raw-sheet-15-18.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/raw-sheet-15-18.png)
- [raw-sheet-19-25.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/raw-sheet-19-25.png)
- [logical-body.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/logical-body.png)
- [logical-sleeves.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/logical-sleeves.png)
- [logical-waist.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/logical-waist.png)
- [logical-root.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/logical-root.png)
- [sleeve-fragments.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/sleeve-fragments.png)
- [collar-source.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/collar-source.png)
- [comparison-upper.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/comparison-upper.png)
- [comparison-hem.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/comparison-hem.png)
- [comparison-drape-left.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/comparison-drape-left.png)
- [comparison-drape-right.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/comparison-drape-right.png)
- [cumulative-off-01.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-off-01.png)
- [cumulative-off-06.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-off-06.png)
- [cumulative-off-11.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-off-11.png)
- [cumulative-off-16.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-off-16.png)
- [cumulative-off-21.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-off-21.png)
- [cumulative-on-01.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-on-01.png)
- [cumulative-on-06.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-on-06.png)
- [cumulative-on-11.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-on-11.png)
- [cumulative-on-16.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-on-16.png)
- [cumulative-on-21.png](clothing-raster-layering/step01/review-evidence/independent-review-20261106/inspection/cumulative-on-21.png)







## 修复后复查要求

逐项在所属绘画层修画后，重新检查独显、蒙版停用/启用、同 part 多深度合成及隐藏上层画面；R1 特别在 100% 尺寸核对领缘交叠，R4–R8 核对外线粗细与各连接端。R2/R3/R5/R6 的纹样补画需延续本件笔触，原位置修净；R9 融色不可留下硬边补丁。最后对照整图确认无新增缺口、鬼影、色差、台阶或其他衣片内容。

本次 review 已查完，结论为需要修复；本报告未执行返修。没有缺失必要输入或阻断检查的工具故障。
