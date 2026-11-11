# 刘海发根结构辅助参考

使用内置 image_gen；同姿态，仅移开狸形饰物与两爪，露出自然组合中的刘海发根和头顶。

原图裁剪：[465, 0, 485, 625]，scale=2；裁图坐标换回原画布为 x=465+x裁图/2、y=y裁图/2。生成图会重新排版，补绘定位仍采用原图锚点。

生成图自查选区：[316, 350, 466, 582]；整体 edge 对照。生成图中央尖梢、细尖和发流存在小幅变化，源稿可靠可见路径全部保留；仅读取被遮挡根部的连续性和尺度。新增上端圆弧属于刘海伸入后发头顶的局部重叠区。



## 生图提示词

Use case: precise-object-edit. Asset type: structural reference for frontal layered character bangs. Edit the provided cropped full head and neck illustration. Remove only the tanuki ornament on top of her head, including its animal body, tail, leaf and two dark brown paws. Reveal the naturally continuous pink crown and frontal bang roots beneath it. Keep the EXACT same frontal head angle, pose, proportions, eye positions, ears, cheek side hair, left braid, red back hair lining, bell and headphones. Preserve all existing visible bang silhouettes: broad forehead fringe with two lateral pointed locks ending near outer eye corners, central sweeping pointed lock ending between the eyes, thin same-surface tips and existing natural vertical hair-flow boundaries against wider side hair. The newly exposed upper frontal hair should smoothly rise in a shallow rounded crown/root region, naturally joining the upper head hair; no notch from removed paws, no empty holes, no new accessory. Show this within the whole head so its root width and connection to the neighboring crown and side hair can be read. Do not grow an oversized tall dome, alter the eye gap, redraw the lower tips, turn the head, part the bangs away from the forehead or add additional locks. Same anime illustration style and pink palette. Plain white background, no text, no diagrams.
