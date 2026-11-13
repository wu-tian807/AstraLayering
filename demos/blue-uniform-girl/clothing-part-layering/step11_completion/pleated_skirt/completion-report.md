已补全外套前衣摆遮住的两侧裙腰及上裙身，新增 2 条闭合路径，位于原形下方。原稿路径、1115×1410 画布和 pleated_skirt 归属保持原样；本组无父组。恢复时草稿与源稿相同，没有需要继承的历史新增路径。

画面左侧新增范围约 x376–555、y668–772，从原可见侧端点 (380,723) 平滑延续至隐藏腰角 (438,668)，再接原中央腰带端点 (549,686)。画面右侧新增范围约 x709–810、y666–772，从中央端点 (715,686) 延续至隐藏腰角 (756,666)，再接侧端点 (808,748)。两块均是裙体自身的腰带与上裙身，位于外套前衣摆之后，伸入原裙身约 6–10 像素并以圆滑曲线搭接。中央腰带上沿是可靠的衬衫／裙腰分界，未提高或改写。

完整实体包括腰带、向两侧展开的百褶裙身、正面裙摆、近侧裙缘及下缘露出的内侧／后侧回转衣料。下摆青色条带和画面右侧固定三角标识随所属裙片运动，颜色、褶线及图案不构成独立实体。腰带承接裙身并覆盖衬衫下端；两侧藏于外套前衣摆之后。裙体以腰胯为共同运动锚，与衬衫下端和外套共享穿戴位置，裙摆可以整体及分区域摆动，外套前衣摆仍保持独立运动控制。

下摆环绕腿部：正面裙身及近侧裙缘在腿前，下缘露出的内侧与后侧裙缘在腿后，左右侧向回转区域连续。后缘中部延续于前裙摆之后；后缘的左右区域可被腿遮挡，腿间区域可显露。其被前裙身覆盖的投影已在原裙体范围中，本轮无需增加下缘外轮廓。后续具体节点必须继承上述多深度区域与共同随动职责，最终用多个深度区域表达，由 raster step01 拆实际绘画层。保留腰口和腿部通过的裙底开口，不绘制封底面、人体、另一条衬裙或衣服背视图。纯色独显是衣料投影范围，不能解释为裙底被封闭。

辅助图由内置 imagegen 生成，使用完整纯衣服参考，只抬开外套下摆，保持原正面姿态、整套衣装上下文和主要裙身。完整图显示浅弧腰带及两侧上裙身的走向；生成的中央上沿与下摆存在轻微漂移，补绘以原图可见腰带端点和原裙身边缘为锚，没有改写可靠可见轮廓。

已先检查完整独显的 A 字形、宽度和实体归属，再检查腰部搭接与下缘。生成图 edge 整体对照使用选区 [165,658,819,462]、默认偏移；工具等比缩放 0.980519，裙身与下缘轮廓基本一致。另完成原图整图 blend、腰部 3 倍 blend、整图独显、腰部 3 倍独显及下缘 2 倍独显：无裂缝、无新增相邻衣片、无开口被填入人体。未发现源稿实体归属错误。预览中的青绿色仅用于标示新增控制色块，不代表另一衣层或栅格成品颜色。

[本轮结构辅助图](structural-reference.png)













生图使用内置工具，唯一参考图为 `clothing-part-layering/references/clothing.png`，透明背景。最终提示词如下：

```text
Use case: precise-object-edit. Asset type: structural reference for completing a layered pleated skirt, not a new outfit design. Input image is the complete original clothing reference and edit target. Produce a single full-outfit image with exactly the SAME frontal orientation, garment proportions, perspective, alignment and anime illustration style. Keep the navy collared shirt, chest clasp, white short-sleeved cyan-trimmed jacket and the navy A-line pleated skirt with its cyan hem stripe and large rainbow triangular fixed motif. Change ONLY the occlusion necessary to reveal the complete skirt waistband and upper side panels: gently lift/fold the two LOWER white front jacket tails outward and just above the skirt waist, retaining the upper jacket and sleeves in their original positions. Reveal the full waistband left-to-right and the hidden upper pleated fabric under those tails. The waistband must naturally extend the existing visible central waistband, same shallow curvature and thickness; preserve the shirt-to-waist boundary, do not make the skirt higher-waisted or wider. Continue the sloping skirt side silhouettes smoothly up from their existing visible endpoints into the waist. Preserve EXACTLY the known visible skirt silhouette, its asymmetric stepped pleated lower hem, the narrow exposed blue inner/back return fabric at the lower hem, pleat proportions, colors and triangle motif position. The skirt is one open fabric tube, not a sealed bottom disk; do not add a separate underskirt or legs. Preserve the complete outfit context rather than a skirt-only cutout. No people, body, skin, mannequins, extra garments, labels, diagrams, arrows or text. Transparent background. This is a same-pose revealed-occlusion reference; do not turn the outfit, flatten the skirt into a pattern, or produce a back view.
```
