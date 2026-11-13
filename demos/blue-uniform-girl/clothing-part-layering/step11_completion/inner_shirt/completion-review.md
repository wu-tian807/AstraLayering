# inner_shirt 正面遮挡补全

已通过 `submit_completion` 提交工作草稿；正式可编辑副本为 [inner_shirt.svg](inner_shirt.svg)。画布为 1115×1410，无父组。原有路径与属性完全保留，5 条新增闭合路径位于原组下方。检查标色只表达衣料覆盖范围，不是衬衫配色。

## 实体及补全职责

本片为深色有领内搭衬衫，包含后领、两片前折领、胸腹衣身、门襟及固定纽扣。辅助图显露出外套内侧的贴身短袖；本轮据其肩线、袖幅、侧缝与收腰比例延续，整体约 x269–866、y277–725。原图可靠可见领部和中央衣身保持源稿位置；生图的少量坐标变化不替代原图锚点。

新增左肩侧衣身、右肩侧衣身分别在对应外套前片及驳头后方，在胸腹身体前方；两侧与中央原形保持约 6 px 隐藏余量。这是同一衬衫的正面衣身，不是外套两片前襟的连接。两侧短袖藏于外套短袖内部，袖根向衣身内部伸入约 6–8 px，覆盖侧形状保持稳定。两袖分别随相应上臂及肩部，中央衣身、门襟与固定纽扣共同随上身。

两内搭袖口分别保留一个 evenodd 通空区域。近侧环口衣料在上臂前，远侧窄内壁和后缘在上臂后；仅在环口两端回转连续，不跨越手臂封口。每侧仍为一个完整袖运动单元，后续深度规划表达前后区域，raster step01 按需拆实际绘画层。

下端延续到约 y725，在裙腰带与外套前衣摆后方保留约 20–30 px 搭接。它仍为衬衫衣料，不包含裙腰，不强造与裙子、外套或扣带的衣料连接。

原 note 中的领口上方深色内弧属于颈后的后领衣料；前折领尖及下部领座在颈前，沿领口两侧回转连续，共同随领部和上身。在本次空衣物投影中可见后壁衣料，不能将其当作皮肤或颈口封面。本轮没有向颈部通道新增衣料。后续必须保留后领／前折领的连续分界和相对颈部深度。

短领带根部夹在两领尖之间、垂端在衬衫之前；胸前蝶形连接带及扣件覆盖门襟中段，衬衫在其后连续。外套领、宽袖、青色袖口、口袋、标识，及领带、扣带、裙腰均保持各自实体归属。未增加人体或无依据的薄纱、装饰。以上分界、深度、随动与搭接职责须传给后续子节点直至终止 part。

## 检查记录

先独显检查主要形体、宽度和归属，再检查袖根搭接和局部开口。袖根初稿的两处细缝通过调整伸入袖根的余量消除。

修改后以同姿态辅助图做整体 edge 对照，`referenceRegion=[268,267,599,440]`，无偏移；检查肩线、袖幅、侧缝、领部锚点及整体比例。下端差异属于伸入裙腰的隐藏余量。省略 reference 参数后，用原图 blend 检查全图定位，并放大领口。SVG 独显放大检查两袖口、腋部连续性和下摆。

最终独显像素复核为 1 个衣料连通区域、2 个袖口空区；连通验证之外，归属和开口另外按参考与组说明核对。XML 比较确认原组及路径、画布属性完全保留，新增组在原形下方。源文件 SHA256：`e936c5af74af79205b287df1bdd5312ea592bd3a1fec921f222b035579e076a0`。未发现需用新增路径合理化的源稿归属错误。











## 辅助图与生图记录

使用内置 `image_gen.imagegen`，未使用 CLI。输入为完整纯衣服参考，先观察整体及目标局部，再绘制。生成图保留整裙作为上下文，临时移除外套及短领带；裙腰变化仅用于理解隐藏搭接，未并入衬衫。辅助图只承担不可见结构依据，可靠可见形状仍由原图确定。

参考图：`clothing-part-layering/references/clothing.png`

生成原件：`clothing-part-layering/step11_completion/inner_shirt/workspace/generated/generated_images/01a1c4f9-fa14-7f83-9e18-decef68a7878/call_lTj55vGA6N1Aei4WO0Mf5ggt.png`

正式副本：`clothing-part-layering/step11_completion/inner_shirt/inner_shirt-structure-front.png`



生图原始提示词（`transparent_background=false`）：

```text
Use case: precise-object-edit. Asset type: structural reference for completing only the navy collared inner shirt in this layered anime outfit. Input image is the complete outfit and exact pose/shape context. Produce ONE full outfit illustration in the SAME frontal pose, position, scale and proportions as the reference, on white background, with no person or mannequin. Reveal the navy inner shirt by removing the white/cyan outer jacket (including its sleeves, lapels and front connecting strap) and temporarily removing the small short necktie; keep the skirt completely unchanged. Slightly lower ONLY the skirt's top waistband enough to show the inner shirt's tucked lower hem and waistband overlap; retain the rest of the complete skirt as scale context. The shirt belongs under the jacket: reconstruct its normally hidden shoulder fabric, torso sides and underarm boundaries naturally following the existing shoulder/torso proportions, NOT tracing the jacket's wide puff sleeves. Keep all original visible navy shirt material, the asymmetric two pointed folded collar leaves, top rear collar, original neck opening/empty neck cavity, center front button placket and buttons exactly as reliable visible anchors. Reveal the complete shirt body and conservative tucked hem, show clearly any real neck and arm openings. This is a narrow fitted collared inner blouse/vest under a separate short-sleeve jacket, so do not invent broad jacket-like sleeves, white/cyan trim, decorative panels, or a new garment. Match the reference dark navy fabric, anime line art, shading, perspective and garment tilt. Keep original collar and visible shirt edges at the same coordinates as closely as possible. No skin, no body placeholders, no text, no arrows, no separated extra views. Entire outfit context remains in the frame, target shirt naturally revealed in place.
```
