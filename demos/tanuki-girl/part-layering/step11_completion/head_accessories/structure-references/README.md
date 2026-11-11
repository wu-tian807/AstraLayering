# 头饰补全结构参考

使用内置 image_gen.imagegen；图片仅供结构读取，交付保持原画布正面坐标。

## 狸形饰物：同姿态去遮挡

原图裁片：[455, 0, 500, 570]，scale=2。先在完整头部中显露短底座，随后去掉仍遮住侧缘的角色粉色兽耳，并稍降顶发，取得完整正面轮廓。



最终生成提示词：

Precise structural reference edit, FRONT VIEW, same pose. Keep the tanuki head ornament EXACTLY as drawn with leaf, face, two dark front paws, compact tan torso beneath the face and huge upright tail on the right; same position and scale. The two large pink animal ears belonging to the GIRL are still blocking the tanuki body sides and tail base. Temporarily REMOVE ONLY those two pink girl ears, and lower the top of the girl's pink hair by a very small distance beneath the ornament to leave a thin white gap below the ornament, while keeping her face and remaining hair. Reveal the ENTIRE tanuki ornament including its complete compact rounded body bottom and smoothly connected thick tail root. It stays hovering immediately above her head in its exact original front orientation and coordinates. Do not add legs or attachments. Its two existing paws are the only paws, its body is very compact with the base ending slightly ABOVE the lowest tips of the front paws. Preserve original visible edges and proportions. No headband. White background, same anime style. Need unobstructed silhouette of the whole ornament, no pink ear shapes next to its lower edge.

## 发圈：俯视斜侧结构

最终原图裁片：[530, 640, 130, 150]，scale=4。先前含耳机与肩部的斜侧参考未充分露出后弧，最终采用带上方辫子、下方散发及肩部的局部俯视斜侧图；只读取环带后段与两侧转弯结构，不把转面姿态搬回正面。



最终生成提示词：

Structural reference edit of a pink braid tied with one narrow BLACK annular hair tie. Render the braid/tassel junction from an ELEVATED THREE-QUARTER SIDE VIEW, looking down at the black tie by 40 degrees. The lower braid is gently angled sideways, so its far side is visible. The key request is to clearly SHOW THE REAR CURVED BLACK STRIP BEHIND THE HAIR, as the far arc of the very same single ring, connecting on left and right around the hair bundle to the front strip. The top opening is an ellipse partly occupied by pink hair, and the far black rim is visibly outlined. Spread a few pink hairs just above the ring to reveal the far rim, while the band remains worn naturally around the narrow hair bundle. Do not leave the ring front-facing and fully concealed behind upright hair like the reference. Keep a complete natural assembly, enough pink braid above and loose pink tassel below, adjacent skin and white top at side for scale. Preserve narrow band width, original pink and black colors, anime style. No bow, no knot, no extra loops, no extra bands. White background, no diagram labels.

## 自检与归属

狸形饰物整体用同姿态 edge 对照，生成图选区 [324,53,723,533]；发圈后段用转面局部 edge 对照，选区 [475,457,221,96]。临时核对 SVG 仅从当前草稿按部件抽取，保留原坐标，使不相邻的铃铛和发圈不影响头饰局部的对齐比例。

当前草稿已做原图 blend 定位、完整独显与局部放大。新增短底座在两爪之间及左耳后延续；尾根在右耳后延续，与底座合为连续新增路径。发圈后弧保持穿发开口，左右圆头伸入原前段下方搭接。铃铛完整，不新增；头饰与头发/兽耳为独立物体的遮挡、承托关系，不增设连接胶水；发圈是辫子连接的覆盖侧，辫子伸入端由其所属组处理。
