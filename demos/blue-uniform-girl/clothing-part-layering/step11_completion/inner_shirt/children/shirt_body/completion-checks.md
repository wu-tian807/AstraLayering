本轮仅为 inner_shirt/shirt_body 新增一条折领后方的衣身领根承接路径。源稿的两条路径保持只读，原有肩侧、腰侧及裙腰带后的下端延续继续保留。新增两端圆滑回接肩部，在折领后方与原衣身叠合；真正颈口保持开放。绿色与紫色只区分新增范围与原形，属于同一衣身。

衣身包含胸腹、固定门襟及纽扣、肩背与两侧回转衣料，下端属于衬衫的隐藏延续。领部和两袖分别归各自节点，不把外套、领带、连接带、裙腰带或人体并入衣身。前胸腹位于躯干前、折领/领带/连接带/外套前衣片/裙腰带后；肩背与背侧位于躯干及外套后，沿两侧回转与前衣料连续，共同随上身变形。后续以本 part 的不同深度区域表达前后关系，不另画横跨颈口或袖窿的封口面。

本轮辅助图使用内置 image_gen，保留完整衣装上下文，移去外套、胸前连接带和短领带以显露内搭。同姿态生成图支持衣身整体比例、袖窿与领根连续结构；生成图的领尖、侧缝和腰部细节有偏移，最终坐标、真实颈口与实体分界以纯衣服图及只读父稿为准。原稿已经连续覆盖连接带后方、外套下肩腰侧和腰带后下端，这些位置不再新增。未发现需借新增路径合理化的源稿归属错误。

新增范围经四倍采样检查，父组越界像素为 0。修改后完成同姿态生成图整体 edge 对照（选区 [371,285,421,439]，为领根锚点微调 [0,-10]）、默认纯衣服参考 blend 定位、整片 SVG 独显与四倍领根局部独显。独显宽度及袖窿分界保持父稿，衣料连续，无皮肤、袖口封面或新薄纱。

[结构辅助图](structure-reference.png)









本轮生图的完整提示词：

```text
Use case: precise-object-edit. Asset type: clothing construction reference for an existing dark navy short-sleeved collared shirt. Input image is the COMPLETE outfit and is the authoritative style/proportion reference. Produce one whole-outfit same-front-pose structural reveal image, white background, same scale, framing and slight asymmetry, no body or mannequin. Naturally remove the white/cyan outer jacket and its chest linking strap entirely and remove the short silver necktie to expose the inner navy shirt, keeping the pleated skirt and its waistband unchanged in their same positions. Retain the inner shirt's two pointed fold collar pieces and real neck opening and navy material/rendering. Reveal the complete fitted torso cloth under the former jacket, with shoulder seams at the former jacket shoulder positions, short sleeves attached at true armholes but clearly distinguishable from the TORSO, a gently fitted waist, continuous central button placket, fixed dark buttons and modest wrinkles. The torso front has a normal sewn neckline beneath the fold collar, NOT a scalloped silhouette shaped around collar points; the underlying shirt torso continues under the collar points. Do not fill the genuine neck hole with cloth or skin. Show only required hidden under-waistband tuck continuity, not a hanging tunic. Match original chest/waist proportions and existing visible central shirt and placket exactly, avoid widening torso beyond original jacket shoulders. Do not add belt, harness, pockets, new decorations or changed style. Keep overall full outfit visible for context; this is one frontal same-pose image, not back/side/multi-view. No labels, no text.
```
