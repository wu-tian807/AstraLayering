# 右后结翼结构参考检查

采用内置 image_gen，输入为本次完整纯衣服参考。第一张同姿态移袖图仍遮住翼根，只用于观察袖下翼面；第二张按背面构造请求生成的图显露完整后结。第二图仍保留部分前衣装特征，不能作为整套衣装背视设计，仅用于当前后结翼的实心折叠扇形、宽高比例及中央收束结构。





转面检查框选第二图角色自身右侧（画面右侧）结翼 [550,396,259,261]；edge 等比对照只读取局部结构及宽高比，不要求投影相反的边缘重合。SVG 实际范围为 [313,574,351,353]，原图坐标与父稿决定当前端点。原图 blend 与 SVG 独显均确认源稿已覆盖整翼、隐藏根和圆滑内端，无新增路径。

最终生成提示词（原文）：

> Use case: precise-object-edit. Asset type: rear clothing construction reference. The supplied image is the authoritative COMPLETE outfit design. Show the same outfit in a straight rear view as a clothing-only illustration on a white background; no person, body or skin. Keep the complete outfit with collar, short white sleeves with navy and pink border, yellow waist obi, navy-purple fabric and the two separate long flower-patterned hanging panels all within the frame. Main purpose: clearly reveal the entire pair of dark navy REAR WAIST BOW WINGS and their small central gathered knot placed OVER the rear obi, just below the sleeves at rear waist level. These are broad SOLID FOLDED FAN SHAPED fabric wings, NOT annular ribbon loops, with no hole. Each wing has a wide angular outer edge and a low sharp corner at hip height, and narrows inward into the small gathered rear central knot. Their silhouette should faithfully reflect the dark angular wing tips protruding on either side of the waist in the original front image. Each wing width roughly one-quarter of the overall sleeve span, height similar to the obi plus hip-height tip. The wing top edge is a gently sloping edge leading down toward the rear central knot; lower edge curves inward from the low pointed tip, producing a broad folded fan narrowing at the knot. Show solid fabric, subtle navy/purple planar fold shading, no lace, no transparent fabric and no ribbon-loop openings. The rear central knot is a separate compact gathered element covering the wing roots. Long flower-patterned panels hang BEHIND the wing bottoms and remain separate. Keep the same proportions, same anime clean lineart and soft cel shading, same material/design as input. No text, labels, arrows, new ornaments or extra bow ribbons.
