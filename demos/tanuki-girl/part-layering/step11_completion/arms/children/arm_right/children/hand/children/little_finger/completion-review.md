# 右手完整小指补全自检

当前节点 hiddenInReference=true；原去重 SVG 与旧草稿均为空。图例仅用于理解完整指身、近端厚度及搭接，不映射指名或坐标。

依据当前掌心朝向、向左并拢的指束及实际 palm，在前方食指、中指、无名指下方补出一条完整、短而轻屈的小指闭合轮廓。指尖约 (315,1051)，近端圆弧约 (351,1035)，连续指身无细腰、无拆分结构。根部跨过实际掌片左缘约 x=342.5–343.8，伸入到 x≈358.75；8 倍曲线采样的实际掌片重叠面积约 227 平方像素、范围约 [342.5,1026.625]–[358.75,1044.25]。掌片覆盖近端圆弧，形成平顺、近似圆形的局部搭接；不是相切或孤立圆帽。没有跨越虎口、真实指缝或归入其他手指。

辅助图通过内置 imagegen 生成，属于同朝向、同目标姿态的拨开遮挡参考，不是转面图。前方手指为显露目标而略分开，交付没有采用该分开的手势。生成图仍在近端上侧保留部分邻指遮叠，因此完整指体的隐藏上缘与圆弧余量按实际掌片和当前父范围补足；生成图只辅助读取短指的连续走向和宽度关系。

完成了生成图整指 edge 对照（referenceRegion=[307,678,356,203]，无偏移）、默认角色图 blend 定位、整指 SVG 独显和实际掌片原坐标半透明叠加。草稿父范围四倍采样越界为 0，保留原画布及空 source 组。











输入截取来自 base-subject.png，crop=[244,948,194,180]，scale=4；原图坐标换算使用截取原点 (244,948)，最终落位以掌片 SVG 原坐标为准。

生图原始提示词：

```text
Use case: precise-object-edit. Asset type: anatomical structure aid for reconstructing one fully hidden anime little finger, not a final character pose. Input image is the cropped character's own RIGHT hand (on viewer's left), including whole palm, downward-pointing thumb, overlapping leftward finger bundle, wrist and two bracelets. Re-render this same hand cleanly on white; ignore the transparent image's black/multicolor edge artifacts. Preserve anime drawing style, slim proportions, skin tones, wrist position, both bracelets, the palm facing orientation, the thumb pointing downward with an open web gap, and the finger bundle directed left. Naturally reveal the previously fully occluded little finger by slightly lifting the foreground index, middle and ring fingers away in depth and gently separating those three only enough to see the little finger. The little finger itself remains pointing left in the original compact relaxed pose, its root on the ulnar palm side beside the ring finger's root, a shorter slender softly flexed complete finger with rounded fingertip, continuous distal and proximal body and a naturally thick enough proximal connection into the palm. Show exactly one coherent normal five-digit hand: a thumb downward and four fingers leftward. Do not rotate the little finger down, do not invent another hand, do not crop the fingertip or finger root, do not change to a back view. The target little finger must be fully readable from tip through body into palm, with adjacent fingers and whole palm still visible as natural context. No labels or text.
```
