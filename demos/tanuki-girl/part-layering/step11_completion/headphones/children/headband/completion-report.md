# headphones/headband 正面补全

原稿已有完整的颈后连续带体，保留原来的开口与四条路径，仅增加两条闭合路径，位于原形下方。

- 左侧连接端：原接合锚点约 (670, 569)，向左下方的耳罩覆盖区续出圆弧，圆端下缘约 y=580，隐藏端横向宽约 14 px。伸入侧为 headband，覆盖侧为左耳罩。
- 右侧连接端：原接合锚点约 (744, 564)，向右下方的耳罩覆盖区续出圆弧，圆端下缘约 y=581，横向宽约 20 px。伸入侧为 headband，覆盖侧为右耳罩。
- 中段由颈部、下颌和头发遮挡，父组已经补全且已进入本轮 sourceSvg，无需重复新增。颈部不作为胶水连接，也未填中央开口。没有发现需用补形修正的源稿实体归属错误。

使用内置 image_gen 获取斜侧结构图，原图截取 [480,200,440,550]，输入缩放 2 倍。生成图仅用于读取颈后弧形带体、带宽和短端伸入耳罩的组合关系，不依据斜侧姿态移动或拉伸原坐标。edge 对照选区 [330,750,143,170] 仅包含露出的后带和侧端，不要求与正面整体边缘重合。

最终草稿完成生成图局部 edge、原图 blend、SVG 独显及左右接头 8 倍放大核对；新增与原稿重叠，无细缝，圆端朝耳罩内部，不外露于颈部空隙。父范围四倍采样检查 outsidePixels=0；原稿组和四条路径校验保持一致。

## 结构参考



## 自检











## 生图方式与提示词

内置 image_gen；单张斜侧辅助参考。提示词原文：

> Use case: identity-preserve. Asset type: structural reference for reconstructing the neck headphone headband in editable layers. Input image is the cropped character reference, containing head, neck, headphones, and upper torso. Create one natural three-quarter side view of this SAME pink-haired anime girl and her headphones hanging around her neck, turn the head and upper torso about 55 degrees so we can clearly see the curved rear headband looping behind the neck and how its two ends connect into the earcups. Sweep just the hair at the nape aside to expose the rear headband. Keep the identity, youthful face proportions, pink hair, amber eyes, bear ears, braid, white tank top, and same illustration style. Preserve the existing headphone design: two large dark navy and white earcups, cyan and pink circular trim. The connecting band is one continuous curved dark slate band behind the neck, ending in short inward attachment tabs behind each earcup; earcups remain in a natural assembled position around the neck. Frame the whole head, neck and upper shoulders at sufficient scale, with white background. The purpose is to reveal the concealed back band and local junction, not a rear portrait or exploded product diagram. No extra straps, cables, extra headphones, labels or new accessories. Render the exposed band clearly with the natural open space inside its curve.
