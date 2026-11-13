外套正面遮挡补全：仅新增一条后领连接衣料，原有两条路径只读保留，画布为 1115×1410；本组无父组。

新增后领约 x492–660、y274–319，主体宽约 140、厚约 34 像素，延续纯衣服图两侧领根的可见端点。此窄带被深色内搭后领遮住，位于颈部及内搭领口之后，两端圆滑伸入已有外套领根。它连接的是同一外套的后领回转衣料；中央领口至衣摆的前开襟仍开放，不绘制横跨胸腹的衣身或背视衣片。

实体与随动职责：左右前衣身、肩部连接衣料、翻领驳头、短袖及袖口均属外套；口袋口、滚边及固定标识随所在衣料。前衣身覆盖内搭及裙腰两侧，前衣身中央内边与独立连接带分界，带翼伸入外套覆盖边之下。后领随肩领单元，后领至侧领沿两端连续回转；向前翻出的领面与驳头处于颈前及内搭之前。两袖各随对应上臂，袖根与肩衣料已有连续覆盖，后续细分保留袖根隐藏搭接。袖口前侧宽带及近侧下缘在手臂前，口内远侧内壁及回转后缘在手臂后，两侧转折连续，画面右袖后缘较窄；后续以同动多深度区域表达，raster step01 拆实际绘画层。左袖椭圆内可见的蓝色是衣料内壁覆盖范围，不是皮肤或新增封口面。本次没有向袖口、袖身与腋下空隙新增衣料，也没有强造袖口与衣摆连接。

结构参考由内置 imagegen 根据本次完整纯衣服图生成，同姿态仅降低内搭领口、去掉独立胸前连接附件。辅助图整体略有等比尺寸变化，右前衣身内边有局部漂移，因此可见轮廓全部以原图和源路径为锚，不采用生成图改写可见边缘。后领新增采用生成图窄带结构，并在原坐标以保守厚度延续。

最终草稿已完成：同姿态生成图整体 edge 对照，referenceRegion=[155,267,830,553]，默认偏移，等比倍率约 0.8915；后领局部 edge 放大；省略 reference 的原图全图及领部 blend；整体独显、后领四倍独显；袖口和中央连接带处原图局部 blend。后领下缘光滑、两端有覆盖余量，左右前衣身主宽度及衣摆保持源稿，中央开襟和腋下间隙保留。未发现需要用新增形状处理的源稿归属错误。











内置 imagegen 完整提示词：

```text
Use case: precise-object-edit. Asset type: same-front-pose garment construction reference for hidden outer-jacket collar completion. Input image 1 is the full outfit edit target and authoritative design reference. Keep the entire outfit in the image, the original straight-on front view, exact sleeve pose, jacket width and length, asymmetry, lapels, white fabric, cyan cuffs/trim, badges, pockets, skirt, and cel-shaded anime rendering. Make only the minimum occlusion changes to expose the outer jacket's back-neck collar connection: lower/roll down the dark inner shirt collar away from the neck and slightly lower its top so that the narrow white/cyan rear collar band naturally connecting the two existing jacket collar sides is clearly visible at the back of the empty neck aperture. The dark shirt chest and skirt stay in their original places. Remove the separate white butterfly clasp and square buckle from the jacket's front gap to show the two separate front edges. Show the rear collar band as a narrow curved strip, not a solid neck filler, and keep the neck passage and central jacket front opening clearly open. Do not add a person, mannequin, skin, neck, arms, or a diagram. Do not fill the jacket front gap with a new white panel; the front jacket halves remain open and separated across the chest and abdomen. Keep cuff opening geometry and visible inner cuff fabric, preserve all reliable exterior edges. Full original garment context and scale in a single transparent-background portrait image, no labels or text.
```
