左袖正面遮挡补全：保留源稿全部只读路径，在原形下方新增两条可编辑闭合衣料路径。画布保持 1115×1410，归属 outer_jacket/left_sleeve；本节点未设置 allowOutsideParent，因此按父完成范围约束。最终四倍采样父范围检查为 pass，越界面积 0。

先以整片独显确认：这是角色自身左侧、画面右侧从肩端至袖口的短袖，完成范围约 x779–938、y350–657，宽度和不对称姿态由纯衣服参考及源路径确定。袖身与缝连袖口属于一个随左上臂旋转、弯曲、变形的终止 part。三角胸标、缝线左侧肩胸衣身、领部和其他袖子均不属于本片。未发现源稿实体归属错误。

新增路径 1 沿 (783,350)→(787,464)→(805,532)→(799,607)→(817,657) 的袖窿侧边延续约 4–6 像素隐藏缝接余量；向衣身覆盖侧伸入的端部圆滑收口。该条是袖山、袖根自己的衣料，位于 jacket_body 的肩胸及腋侧接缝衣料之后，与左肩衣身共同承接上臂运动。覆盖侧衣身的形状以父稿为准，袖根搭接不改变实体分界，也不延伸到胸标或衣摆。

新增路径 2 是约 x814–937、y571–657 的远侧袖口及袖内短回转薄弧，两端锚在原稿末端转折 (817,657) 与 (937,574)，弧线向袖内延续。它被原有近侧袖口宽带和近侧袖身遮住，整体落在原有投影内部；因此合成独显仍保持当前窄袖轮廓。单独检查新增薄弧时，其内侧为空，路径是衣料带而非跨袖口的封口面。当前正面姿态的袖口朝向令通道被近侧衣料遮挡，不能将辅助图中转向镜头后出现的大椭圆留白移植到本姿态。

深度与连续分界：袖身近侧衣料、袖口外侧宽带及近侧末缘在左上臂之前；远侧袖内壁、回转后缘及新增薄弧在左上臂之后，也在近侧袖口之后。前后区域在两个袖口末端转折连续相接，末端内缘及侧向转折为相对深度分界；袖身与袖口的约 (803,608)→(916,541) 缝合线只划分同动衣物内部区域。整袖及袖口共同随左上臂，与左肩衣身保留缝接搭接。下游深度规划应表达这些前后区域，clothing-raster step01 再拆实际绘画层，使上臂穿过真实袖口通道。人体不归输出；本 SVG 的投影覆盖不表示皮肤或封口面。

本轮结构辅助图由内置 imagegen 使用完整纯衣服图生成，已先查看整体衣装，再读取目标袖口环带、内壁和两端回转。结果保持正面衣装上下文，但目标袖口明显转向镜头，肩部和尺度也有局部漂移，故按“局部转面参考”使用：只取空心袖管和薄后缘的结构，不据其改写原稿可靠轮廓、端点、宽度或朝向。生成图内大块浅色袖内区域不作为新增封口衣料的依据。原坐标及相邻分界始终由纯衣服参考负责。

最终修改后已重新完成：整片 SVG 独显；整片与袖根／袖口局部原图 blend；目标袖段生成图 edge，referenceRegion=[778,320,180,305]；新增远侧薄弧的局部转面 edge，referenceRegion=[834,472,101,127]；薄弧四倍独显。生成图检查使用默认偏移，转面局部不要求边缘重合。整片无断裂，袖根搭接有限，新增远侧弧连续且两端收口；原有外侧及末端边缘保持源稿。两条新增路径均在只读父完成范围内，原稿已有路径完整保留。













内置 imagegen 完整提示词：

```text
Use case: precise-object-edit. Asset type: garment structural reference for a layered 2D clothing asset. Input image is the complete outfit, preserve the complete outfit as context: white short-sleeved cropped jacket with cyan cuff bands over dark navy blouse, tie and skirt. Target is character's LEFT sleeve, on VIEWER RIGHT, currently the narrow sleeve from the right shoulder to cyan cuff. Produce a single full outfit front-view structural reference in the SAME orientation and stance, same garment scale and same anime illustration style. Reveal the target sleeve's construction by gently drawing only the adjacent viewer-right jacket torso panel slightly inward at its sleeve seam, and lifting/rolling aside only the target cuff's NEAR lip enough to expose its thin FAR inner sleeve wall and rounded return at both cuff ends. Keep the sleeve shoulder apex, exterior side silhouette, cuff endpoints, length, width and direction anchored to the original; do NOT enlarge it to match the other wider sleeve. Make visible the short sleeve as a hollow fabric tube with sewn-on cyan ring cuff, white sleeve body and a very narrow dark cyan inside/back rim. The real arm opening is empty transparent space, NOT a solid cap or skin; no mannequin, no anatomy. Keep the viewer-left sleeve, collar, skirt, blouse, chest clasp, all reliable colors and designs unchanged. The triangular chest emblem remains on the jacket BODY, not on the target sleeve. Keep whole outfit in the image, no inset, no text, no arrows, no exploded floating pieces. Transparent background. This is a structural reveal of an occluded sleeve and not a redesign or back view.
```
