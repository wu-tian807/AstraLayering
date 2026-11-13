# jacket_front_clasp 结构辅助与检查

使用内置 image_gen 编辑完整纯衣服参考，保留当前正面姿态，显露连接带左右短端；未使用 CLI。



原图决定蝶形主体 x580–701、y476–584 及位置；辅助图提供左右短端的弧形走向。生成图有位置和局部比例偏移，等比对齐后中央收束与上下斜边整体接近但并非精确重合，按原图固定既有轮廓，不把生成偏移带入正式坐标。两条新增闭合路径仅在原形下延伸端部，左约 x568–594、y493–549，右约 x677–714、y494–551；外露余量约 14–22 px，内侧与原形重叠约 3–5 px。中央方扣完整可见，原形已含其覆盖范围，不另加扣件轮廓。

前后关系：主体在内搭胸前门襟之前；左右新增短端分别在对应外套前衣身中央内边之后。两翼与方扣是共同开合、张紧及显隐单元，端部随对应外套前衣片运动。上方 V 形和下方倒 V 形保留为本片外部空间，内搭衬衫及身体均不属于本片。不新建跨身体的外套衣身连接、不添加人体、不填薄纱或开口。无父组。

最终草稿三项检查：

- 生成图整体 edge：选区 [548,477,155,115]，倍率 0.9391304348，offset [0,0]；端部与辅助图显露的短插入段走向一致。保留原可见斜边，未用生成图校正源稿。
- 默认参考 blend：两端均进入外套覆盖区，中央主体保留原位置与边界。
- SVG 独显及局部五倍检查：完整蝶形连接附件连续，两侧端部圆滑搭接；开口及邻接归属成立。







## 生图提示词

```text
Use case: precise-object-edit. Asset type: garment construction reference for hidden attachment completion, same front pose.
Input image is the full outfit reference and edit target. Keep the entire outfit, its current front-facing pose, proportions, anime linework, fabrics, navy inner shirt and skirt, cyan sleeve cuffs, jacket lapels and badges, square central pale buckle, and the white butterfly-shaped wide connector at mid chest. No person or body. Preserve transparency.
Primary edit: naturally expose ONLY the two short hidden outer attachment ends of the white butterfly-shaped connector located at original coordinates approximately x580–701, y476–584 on a 1115×1410 canvas. At both sides the white broad wings currently tuck under the inner edges of the open jacket fronts. Peel back / shift outward by a small amount ONLY the jacket inner edge at the connector attachment, to reveal a short smooth fabric tongue continuing under each front, about 10–15 original pixels hidden insertion per end. Keep white connector's central waist, top and bottom diagonals, wing heights, and central square buckle in the original positions and sizes. Each outer attachment end is a shallow curved broad tongue following its existing curved side boundary, NOT an extra ribbon, bow loop, tail, hardware, long horizontal strap, or new garment. The left and right white wings remain joined under the square buckle. Maintain dark shirt behind the connector and jacket fronts in front of the outermost anchoring ends. Full outfit visible with nearby clothing context; do not crop to the accessory, zoom, rotate, redesign or display a rear view. Do not change reliable visible connector borders except extending the covered side ends. No labels, no arrows, no text, no skin.
```
