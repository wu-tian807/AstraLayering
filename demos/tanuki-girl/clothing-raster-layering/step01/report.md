# 衣服 raster step01 绘画与深度记录

结论：已修复。review-02 的 R1–R9 已逐项处理并通过本轮看图自检。此前暂存的七项修复继续保留，本次完成 R3/R4 的后返绳形体纠正；不再沿用旧“仍有问题”结论。

当前工程为 18 个逻辑衣片、25 个普通绘画深度层、4 个 Krita 原生透明度蒙版，画布 1376×2048。所有前后衣片保持独立深度，真实开口保留，未加入人体或其他衣片的投影。

- [KRA](clothing-raster-layering/step01/clothing-depth.kra)
- [默认透明 PNG](clothing-raster-layering/step01/clothing-depth.png)
- 暂存修复报告：clothing-raster-layering/step01/repair-02.md.tmp，由调度器发布。
- [原尺寸检查清单](repair-evidence/repair-02/final-inspection-manifest.json)

## 九项修复

| 编号 | 结果 | part／区域 | 实际处理与看图结果 | 最终证据 |
|---|---|---|---|---|
| R1 | 已修复 | d13 / kimono_body/right_underlap_panel；双粉线续接 | 自身邻接深领料局部取样清理旧接点，Krita连续笔触接顺双粉线，宽度与浓淡平缓延续。保留外襟覆盖，无凸台或新白缝。 | [三视图／局部](repair-evidence/repair-02/inspection/R1-three-views.png) |
| R2 | 已修复 | d02 / rear_drape_screen_right；y1180–1365 | 本件参考配准外轮廓与翻面内缘，局部融色和alpha接顺；复查发现的起点小台阶也已修顺。两花、草叶、腰后根及底框保留。 | [三视图／局部](repair-evidence/repair-02/inspection/R2-three-views.png) |
| R3 | 已修复 | d12＋d23 / front_waist_cord_knot；左腰转入 | 将错误外伸后返翼改画为沿腰侧向内回绕的完整后绳。d12整圈深线、粉白料面和隐藏中段完整；d23原画保留，左前转线落在真正投影外缘，同片off不再横截布面。 | [三视图／局部](repair-evidence/repair-02/cord-continuation/R3-turns.png) |
| R4 | 已修复 | d12＋d23 / front_waist_cord_knot；右腰转入 | 按右腰转折检查同一完整后绳的右端，后绳进入前向投影内侧；右前转线成为真实外缘，off/on无内部封口弧线。双环、结芯和真实开口保留。 | [三视图／局部](repair-evidence/repair-02/cord-continuation/R4-turns.png) |
| R5 | 已修复 | d03 / rear_waist_bow/right_bow_wing；画面左下翼 | 本侧三色控制局部生成，等比配准并羽化接回宽缓灰紫折面及褶脊，消除错误尖亮紫分区。完整隐藏根、翼尖、外线和留空保留，不带袖带投影。 | [三视图／局部](repair-evidence/repair-02/inspection/R5-three-views.png) |
| R6 | 已修复 | d04 / rear_waist_bow/left_bow_wing；画面右下翼 | 按右侧独立三色生成，未镜像R5；恢复本侧宽缓折面和褶脊，接顺外缘窄亮条及细锯齿。隐藏根与真实翼尖保留。 | [三视图／局部](repair-evidence/repair-02/inspection/R6-three-views.png) |
| R7 | 已修复 | d08＋d15 / sleeve_screen_left；白折角及原生蒙版 | 沿原画真实白折角与左斜黑折线调整显露区，用Krita原生笔触补强原有淡底边。off保留完整内壁，on不再呈白剪口，没有沿旧蒙版边新增内部截线。 | [三视图／局部](repair-evidence/repair-02/inspection/R7-off-on-joins.png) |
| R8 | 已修复 | d09＋d16 / sleeve_screen_right；白折角及原生蒙版 | 独立沿本侧原有折角显露真实右斜边和自然底角，去掉平剪端及残尖点。off完整内壁保留，没有镜像覆盖或新增截线。 | [三视图／局部](repair-evidence/repair-02/inspection/R8-off-on-joins.png) |
| R9 | 已修复 | d14 / kimono_body/left_overlap_panel；x565–625,y1075–1213 | 本外襟参考窄界面配准取样、融色，清除细亮拼接带和断续灰点，只保留真实深色襟边。粉线、金花、上褶及原生底缘保持。 | [三视图／局部](repair-evidence/repair-02/inspection/R9-three-views.png) |



## 固定绳后返的形体与深度修正

参考及 groups.json 定义的是沿腰侧向后的连续绕带绳，没有独立外伸绳尾。旧补全把 d12 画成向腰外伸出的短翼，使 d23 本来用于腰侧转入的外轮廓落在合看料面内部；仅擦这条线会破坏默认外边。

本次以三色控制重新生成 d12 的完整侧后回绕料面：全部隐藏区域用黄色、外部绿色、输入抹为中性灰，本绳粉白材料作为辅助参考。生成结果含连续斜纹、自身体积及深色整圈线，等比 0.185 缩小配准到约 x522–865、y704–741。它的前向投影收于腰侧转折内侧；前后转换区为左腰约 x499–535、右腰约 x850–886、y698–731。完整后带在 d12，前向转入、横绳、环和结芯在 d23。

停用 d12 蒙版并隐藏 d23，后绳自身仍是一条完整的浅弧带；合看 d12＋d23 时，前绳按穿着投影自然覆盖背侧料面，两侧描边落在真实外缘，不横截粉白带。没有删除后绳底纹、合层或改变蒙版来抹掉问题。d23 可见画面与本次续修前一致，其短转入外边、双环、结芯及真实环孔保持。





已先保存 front_waist_cord_knot.svg，将错误的两条外伸补全改为向内后返轮廓，再通过 edit_occlusion 更新 d12/d23 的区域、分界、前后对象和依据。groups.json 已有正确的回绕职责，逻辑 ID、归属、顺序及说明保持；没有新增控制节点或深度。

[生成控制、源图、缩放及蒙版处理记录](repair-evidence/repair-02/generation-provenance.json)；[原生蒙版与前绳保留核验](repair-evidence/repair-02/cord-continuation/application-verification.json)。

## 实际图层、UUID与最终区域

| 深度 | 完整 part ID | 实际图层名 | UUID | 区域、分界及前后对象 |
|---:|---|---|---|---|
| 1 | `rear_drape_screen_left` | `d01 \| rear_drape_screen_left \| complete` | `{a9feb87a-9ee2-4b4d-b3d7-a03b3024d30a}` | 画面左完整长后垂片，实际画面约x132–550、y779–1748；腰后根、浅紫翻面、白色花草纹和折角底边同层。在后结翼3及全部衣身、腰饰后，两长垂片间保持透明。 |
| 2 | `rear_drape_screen_right` | `d02 \| rear_drape_screen_right \| complete` | `{03b3eeeb-d709-413c-8a75-6e4c35ad166a}` | 画面右完整长后垂片，实际绘画缓冲约x845–1248、y761–1752，主要可见轮廓约至x1244、y1748。原生成完整根、两花、草叶及下轮廓保留；repair-02 R2在y1180–1365局部配准本侧参考的外缘与翻面内缘，边线邻域按连续轨迹平移、料面融色，不是新的深度分界。在后结翼4及衣身、腰饰后。 |
| 3 | `rear_waist_bow/right_bow_wing` | `d03 \| rear_waist_bow/right_bow_wing \| complete` | `{8d09ad13-0794-4196-a74f-40cfa284ac90}` | 角色右、画面左完整后结翼，约x311–666、y573–927。外展折面和隐藏内根为连续深紫布面；repair-02 R5按本侧三色控制局部重生下部宽缓灰紫折面，等比配准、原生羽化接回，保留隐藏根、真实翼尖与外线。在长垂片1前、结根5、袖8/15、衣身及腰带后。 |
| 4 | `rear_waist_bow/left_bow_wing` | `d04 \| rear_waist_bow/left_bow_wing \| complete` | `{d7904da0-c4bb-42f0-aa90-316ccd2361cf}` | 角色左、画面右完整后结翼，约x714–1069、y573–927。上部及隐藏根保留原生镜像来源；repair-02 R6的下半部按右侧独立三色控制生成，不镜像R5，等比配准并独立接顺外缘细线。独立绘画层，在长垂片2前、结根5、袖9/16及衣身腰带后。 |
| 5 | `rear_waist_bow/central_knot_root` | `d05 \| rear_waist_bow/central_knot_root \| complete hidden root` | `{9b5dfbd5-24ce-408b-aa43-3ca726a49fe0}` | hiddenInReference=true。完整深紫后结根约x643–739、y677–771，在两翼3/4前、衣身和腰带后。绘画层启用，所属原生透明度蒙版默认全黑；停用蒙版恢复完整收束布面。 |
| 6 | `kimono_body/right_underlap_panel` | `d06 \| kimono_body/right_underlap_panel \| left side/back returns y618-845` | `{b9264b56-1103-4e9d-a819-f2261d582a3f}` | 画面左侧腰返回条，y618–845，实际总范围x485–544。按本片每行实际alpha内缘向内3px起取18px同料条，两端约3px渐隐；与13内侧短搭接，不另加分界线。在后结前、内带后返10和金带后返11后。 |
| 7 | `kimono_body/left_overlap_panel` | `d07 \| kimono_body/left_overlap_panel \| right side/back returns y612-839` | `{df56147f-b986-44b7-8615-6701bac4f2a7}` | 画面右侧腰返回条，y612–839，实际总范围x823–889；按本片右alpha内缘向内3px起取18px同料条，两端约3px渐隐，与14短搭接。在后结前、内带后返10及金带后返11后。 |
| 8 | `sleeve_screen_left` | `d08 \| sleeve_screen_left \| complete far sleeve wall; native worn-range mask` | `{28eda41a-af13-4b31-98bc-43e43e04e833}` | 完整画面左远侧袖壁，约x252–554、y469–727；完整背根、白淡紫褶面、深色内壁及补全料保留。位于后结3前、胸片13及近袖15后；原生透明度蒙版控制默认穿着范围。 |
| 9 | `sleeve_screen_right` | `d09 \| sleeve_screen_right \| complete far sleeve wall; native worn-range mask` | `{e6a205f4-b174-443a-b99f-bf37639b08ef}` | 完整画面右远侧袖壁，约x879–1128、y486–725；完整背根、淡紫白褶面、深色内壁及补全衣料同片。在后结4前、胸片14及近袖16后；所属原生蒙版默认开启。 |
| 10 | `inner_waist_wrap` | `d10 \| inner_waist_wrap \| both side/back returns y620-847` | `{c512849c-10cc-40a4-9517-8842bc1da9e8}` | 左右侧后返回条，y620–847，实际总范围x478–902；各沿本片实际alpha侧缘向内3px起取17px同料条，两端约3px渐隐，与17内侧短搭接。在衣身侧返6/7前、金带后返11后。 |
| 11 | `outer_waist_band` | `d11 \| outer_waist_band \| both side/back returns y670-781` | `{65216b2a-3cd0-4d40-af02-b38d60c8e6e5}` | 左右金带侧后返回条，y670–781，实际总范围x498–882；按两侧实际alpha内缘向内3px起取13px同料条，两端约3px渐隐，与18侧缘内部短搭接。在10前、固定绳返回12后。 |
| 12 | `front_waist_cord_knot` | `d12 \| front_waist_cord_knot \| complete posterior waist return` | `{1e2981d5-978b-42d0-8f72-a8e64d0908b8}` | 完整侧后环腰返回绳，约x522–865、y704–741；左右绕入端及中间隐藏后绳连续成片，投影收于前绳23横带轮廓内部，不再向腰侧外伸成翼。前后转换为左腰约x499–535、右腰约x850–886、y698–731的向内转折遮挡区；端部在23后，不横截前向绳面。在金带后返11前、衣身前幅13/14及腰带前幅17/18后。 |
| 13 | `kimono_body/right_underlap_panel` | `d13 \| kimono_body/right_underlap_panel \| complete front cloth and outline` | `{5769b9f7-a47f-42a4-a475-ccf927a52db8}` | 完整内襟前幅，约x338–819、y413–1175；含左上双粉线领缘、白胸片、连续隐腰段和窄短下摆，整圈真实外线均保留。位于远袖8、后结及本侧返6前，外襟14和腰带17/18后。 |
| 14 | `kimono_body/left_overlap_panel` | `d14 \| kimono_body/left_overlap_panel \| complete front cloth and outline` | `{70c4647b-e66c-452e-a0f0-69ab1c6edec7}` | 完整外襟前幅，约x497–1040、y407–1212。右上至左下的双粉线领边、白胸片、隐腰段、大白短下摆和固定金花同层；在内襟13、远袖9及后结前，腰带17/18和前饰后。 |
| 15 | `sleeve_screen_left` | `d15 \| sleeve_screen_left \| near white folds and gathered cuff x253-486` | `{6c2f726e-95fa-4d85-a438-4eb37967f2b5}` | 画面左近侧白褶面与收拢粉线袖边，约x252–487、y470–663。下缘沿本袖布边曲线，控制点约(253,660)、(310,661.7)、(380,653)、(440,632)、(486,603)，原生细线接顺；与13相重叠的袖料从本分片收回，完整料留在8。 |
| 16 | `sleeve_screen_right` | `d16 \| sleeve_screen_right \| near white folds and gathered cuff x896-1126` | `{1d1e93f1-2ee2-490e-a2ad-3dab2ae3d18c}` | 画面右近侧白褶面及收拢粉线布边，约x895–1127、y486–659。下缘约经(896,605)、(950,634)、(1010,650)、(1080,658)、(1126,655)，原生细线接顺。与14重叠的袖料仅从本分片收回，完整料留在9。 |
| 17 | `inner_waist_wrap` | `d17 \| inner_waist_wrap \| complete front cloth and outline` | `{2f7649d6-faf5-4fab-9962-4facae789df6}` | 完整深紫前腹料面、前向侧弧、上缘斜褶带和宽下缘，约x474–909、y604–870。隐金带区域仍连续本料，在衣身13/14及袖内端前，金带18和前饰后。 |
| 18 | `outer_waist_band` | `d18 \| outer_waist_band \| complete front cloth and outline` | `{ae256aa9-e4ce-4bb4-9a3e-93a59812d17e}` | 完整金色前腹带面、前向侧弧及上下真实外缘；主要轮廓约x486–894、y641–807，含抗锯齿缓冲约x483–896、y639–808。在衣身13/14及内带17前，固定前绳23和垂饰后；隐绳区域仍为连续金料。 |
| 19 | `front_pendant_screen_left/right_free_cord` | `d19 \| front_pendant_screen_left/right_free_cord \| complete` | `{354894aa-d98d-4480-bc14-1c9f2d3f2f4e}` | 画面左完整粉白自由绳，约x622–693、y711–925；repair-01中R5独立按左参考三色重生，等比缩小配准后原生续深色外线，保留结下短根、长色带及珠内插入端。在衣身和腰带前、固定结23及本珠24后。 |
| 20 | `front_pendant_screen_right/left_free_cord` | `d20 \| front_pendant_screen_right/left_free_cord \| complete` | `{effe9c2e-9005-4a3f-848d-d1f07a973fff}` | 画面右完整粉白自由绳，含抗锯齿约x685–757、y710–925。在衣身和腰带前、固定结23和本珠25后。repair-01中R6独立按右侧参考三色重生，等比配准并原生续深色外线；当前最终纹样不再使用d19镜像画面，仍为独立绘画层。 |
| 21 | `front_pendant_screen_left/right_tassel` | `d21 \| front_pendant_screen_left/right_tassel \| complete` | `{7791f227-c497-4af3-9f76-a64da8534aff}` | 画面左完整白粉流苏，约x602–653、y946–1032。含珠后束根、连续束纹与真实弧底，在衣身14前、珠24后。repair-01中R7沿自身两侧与弧底原生续画深色外线，内部束纹保留。 |
| 22 | `front_pendant_screen_right/left_tassel` | `d22 \| front_pendant_screen_right/left_tassel \| complete` | `{5bd96b03-31e5-40fd-9bad-c7f8d85e3f14}` | 画面右完整白粉流苏，约x727–778、y946–1032。初始束纹由21原生复制、水平镜像并x+4配准，独立层；repair-01中R8沿本侧轮廓独立原生续画深色两侧与弧底。在衣身14前、珠25后。 |
| 23 | `front_waist_cord_knot` | `d23 \| front_waist_cord_knot \| front cord turns, horizontal cord, loops and knot` | `{b43276ac-19ee-4a09-8d7c-d67e806324f5}` | 完整前腹横绳、参考可见腰侧短转入外缘、双闭合绳环及中央结芯，约x493–887、y672–790。侧转轮廓落在整条系绳投影的真实外缘；后返12在内侧投影重叠并被本前绳自然覆盖。在金带18及自由绳19/20根前；真正环孔透明，双环、结芯和默认短转入段保持原画。 |
| 24 | `front_pendant_screen_left/right_terminal_bead` | `d24 \| front_pendant_screen_left/right_terminal_bead \| complete` | `{41d13dc4-1e3d-48f7-b114-50372ccdde98}` | 画面左完整红珠、固定外缘及本体高光，约x609–653、y910–951。在衣身、自由绳19及流苏21前；真实珠轮廓覆盖绳末端和束根。 |
| 25 | `front_pendant_screen_right/left_terminal_bead` | `d25 \| front_pendant_screen_right/left_terminal_bead \| complete` | `{6128f6c6-91e0-43bf-84f0-3ab6d170581f}` | 画面右完整红珠和高光，约x723–767、y909–950。在衣身、自由绳20及流苏22前。由24原生未镜像复制后平移(+114,−1)，保留右上高光方向和独立UUID。 |

## 复用与绘画来源

各片保留初始生成画面与此前局部修画。画面右后结翼上部及隐藏根延续原生镜像来源，下半部 R6 为本侧独立生成；自由绳两侧为 repair-01 各自独立生成。右流苏保留初始左流苏镜像配准的束纹，并有本侧独立外线修画；右珠为左珠原生未镜像复制后平移，保留协调高光。衣身、内腰带及金带后返条复用各自前幅本料，前后深度独立。d12 后绳本次独立生成，以 d23 本绳材料为参考，没有复用旧外伸翼。

R1 用本片领料取样和连续原生笔触；R2、R9 用本片参考局部配准取样与融色；R5/R6 两侧各用三色控制独立生成并羽化接回；R7/R8 保留已有完整白折面，调整原生显隐边界，R7 另补强原有底边。没有沿衣片形状整块填色或加入邻件像素。

## 原生蒙版归属与控制

25 个绘画层与 4 个原生蒙版均默认启用，无临时补片层或新增剪贴关系。完整底纹保留，蒙版没有烘焙为绘画透明度。

| 所属层／part | 蒙版名 | UUID | 控制区域与切换证据 |
|---|---|---|---|
| d05 / `rear_waist_bow/central_knot_root` | `default hidden \| rear_waist_bow/central_knot_root` | `{01098352-4f7a-4279-8e9e-86a0bb7ba111}` | 全黑默认闭合；off完整后结根、on为空。 [切换证据](evidence/mask-check-d05.png) |
| d08 / `sleeve_screen_left` | `worn range \| sleeve_screen_left` | `{a37cc6be-6e01-4d2f-8adc-cd6b3e24660a}` | 沿真实左白折角及已有斜折线显露，保留原袖根控制；off完整远壁、on穿着收拢。 [切换证据](evidence/mask-check-d08.png) |
| d09 / `sleeve_screen_right` | `worn range \| sleeve_screen_right` | `{b3fe5f8b-f9c5-444a-99b8-94f0d43f1e90}` | 沿本侧真实右白折角和自然底角显露；off完整远壁、on收拢。 [切换证据](evidence/mask-check-d09.png) |
| d12 / `front_waist_cord_knot` | `default hidden \| front_waist_cord_knot` | `{c06943d1-bd1a-4dc6-aa54-662586599244}` | 全黑默认隐藏；off独显完整向内回绕后绳。选区缓冲、UUID和默认状态保留，完整底纹未删。 [切换证据](evidence/mask-check-d12.png) |

## 全片复查与保存

已检查 25 深度独显、隐藏上层累计、18 同 part 合看及默认整图。R3/R4、R7/R8 均看 off/on；两翼完整根、领袖原生接点、花草、下摆、自由绳及珠束接点另行放大。参考对照中未另发现确定的缺口、归属、层序或接缝问题；后返绳与旧色块补全的差异已经按实际回绕结构修正并同步 SVG，不留未记录冲突。正常袖口内壁、绳环孔、领口及衣片外侧透明留空保持，袖口默认按原穿着角色收拢。













验收 PNG 已更新：clothing-raster-layering/step01/evidence/raw、clothing-raster-layering/step01/evidence/masked、clothing-raster-layering/step01/evidence/cumulative、clothing-raster-layering/step01/evidence/logical 及本报告图片。原尺寸 off/on 累计与同 part 合看保存在 clothing-raster-layering/step01/repair-evidence/repair-02。

最终指定 KRA 已实际保存、关闭和重新打开。25 绘画层名称、UUID、类型、顺序、显隐、透明度与绘画缓冲一致；4 原生蒙版名称、UUID、选区缓冲和启用状态一致；画布、色彩属性与整图投影一致。默认 PNG 与重开 PNG 的 RGBA 一致。缓冲核验用于验证保存完整性，画质结论依据本轮看图。

[重开核验](repair-evidence/repair-02/reopen-integrity.json)；[交付核验](repair-evidence/repair-02/delivery-verification.json)。
