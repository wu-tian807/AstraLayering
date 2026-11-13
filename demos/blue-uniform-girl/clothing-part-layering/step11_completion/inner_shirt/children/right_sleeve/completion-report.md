右袖补全已通过 `submit_completion` 提交，指定产物为 [completion.draft.svg](workspace/completion.draft.svg)。源稿为空，新增一个带真实袖口孔洞的闭合复合路径，完整复用父稿登记的右短袖轮廓。原形、父稿、画布及归属保持不变，父范围四倍采样检查越界面积为 0。

实体范围为角色自身右侧、画面左侧内搭衬衫短袖，约 x269–454、y343–596；不包含外套袖、青色袖口、椭圆标识、衣身或人体。袖根在 (380,343) 至 (447,522) 的衣身袖窿接缝下保留父稿已有的圆滑搭接；下端斜向椭圆开口始终留空。

近侧袖身及袖口衣缘位于右上臂前，远侧内壁及后侧回转衣缘位于右上臂后，全部位于外套右袖后。前后衣料沿袖口两端 (282,518)、(389,582) 连续回转，袖口内缘与两端转折作为深度区域分界。整袖随右上臂旋转弯曲，与衣身右肩袖窿共同定位；作为一个逻辑 part 保留，后续以多个深度区域表达并由 raster step01 拆实际绘画层。

本轮使用内置 imagegen，以完整衣装图及父组独显结构图为输入生成同姿态露袖参考。先观察整体结构，再对照 SVG。生成图袖山较圆、袖口略宽；最终具体外形按已登记父稿保留，生成图仅辅助确认短袖走向、袖根和开口结构。



已检查完整衣片独显、生成图 edge、原图 blend 及袖口四倍局部。衣料连续，透明开口完整；未加入相邻衣层、皮肤或跨躯干连接。









生成方式：内置 `image_gen.imagegen`，白底，同姿态，参考路径为本次提供的完整纯衣服图及父组独显预览。提示词如下：

```text
Use case: precise-object-edit. Create a same-front-pose structural reference of this exact complete outfit. Image 1 is the full clothing design and edit target. Image 2 is a cropped flat silhouette guide to the hidden dark inner shirt; guide colors are arbitrary, NOT final clothing colors. Keep the full outfit, framing, scale, frontal viewpoint, sleeve angles, dark pointed shirt collar, gray short necktie, white cyan-trim jacket lapels and screen-right jacket sleeve, chest connector and pleated skirt of Image 1. White background, no person, no skin, no labels or text. Change only the occlusion needed to expose the character's RIGHT dark inner-shirt short sleeve on the LEFT side of the image: remove the screen-left white/cyan OUTER jacket sleeve with its cyan cuff and oval badge, and move aside only a little of the adjacent outer jacket shoulder/armhole to reveal the inner sleeve attachment. The revealed sleeve is plain dark navy shirt fabric matching the existing dark shirt, without cyan cuffs, badges, separate cuff band or long extension. Show the complete sleeve cap, flared short sleeve body, shoulder-to-armpit attachment seam and a real thin slanted elliptical open cuff with visible rear fabric rim and near fabric rim, background through the opening, NOT a solid end cap. Use the screen-left sleeve in Image 2 as hidden shape guide: rounded narrow shoulder cap, tapering/curving seam at the body, flaring downward-left, oblique hem opening from upper-left to lower-right. In Image 1 original coordinates (1115x1410), this sleeve should be roughly x269-454,y343-596, with sleeve attachment from (380,343) to (447,522), open cuff ends about (282,518) and (389,582). It is shorter and narrower than the removed white outer sleeve. Preserve anime cel shaded linework and the existing fabric appearance. The inner sleeve must be visually readable as part of the existing dark collared shirt, not a recolored outer-jacket sleeve. Show this in the complete outfit context, not a detached sleeve closeup, not a back view or new pose.
```
