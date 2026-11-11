# left_tassel 正面遮挡补全

本片为角色自身左侧、画面右侧圆珠下的完整白粉流苏束，约 x724–775、y941–1033。束身、左右外缘及弧形底缘以原路径和纯衣服图为准；不含圆珠、绳端、另一支垂饰、邻近短下摆或衣面投影。无人体占位、环绕开口或薄纱结构。源稿实体归属正确。

只新增一条闭合路径，位于原形下方，补圆珠下缘后方约 y941–949 的圆滑短收束根，并伸入原束体至 y953；新增整体约 x735–760、y941–953。圆珠保持覆盖侧原形；没有沿生成图中去珠后出现的长细颈延长本片，也没有新增珠头、环、孔道等未经确认结构。左右和底缘不扩张。

束体位于角色左前髋的前侧短下摆及其后身体之前；根部搭接区域位于本支 left_terminal_bead 之后，连续深度分界沿珠体下缘约 y944–951。束根共同随圆珠与 left_free_cord 末端移动；束身和末端可独立弯曲、延迟摆动、展开及显隐。流苏线纹属于本体，下游栅格处理。完整柔性 part 终止，不增拆组。

## 结构辅助图与检查

使用内置 image_gen 工具、imagegen 技能，输入完整纯衣服参考。第一张把红珠替换成鼓起的白束头，缺少原图或 note 支持，弃用其鼓包结构。第二张显露收窄束根与渐展束身，仅用于短根走向和束体比例；可靠可见边缘仍以源稿和纯衣服图为锚。



同姿态 edge 对照整个登记流苏束及其短根，referenceRegion=[538,655,46,88]，无 referenceOffset。原 SVG 实际范围 [724,941,50,91]，对照倍率 1.034090909。束身渐展和底弧一致；生图线宽与原稿略有差异，保留源稿可靠边缘。



省略 reference 参数进行原纯衣服图 blend 检查，确认新增短根由圆珠盖住，不占短下摆和投影。独显与束根八倍局部检查显示连续完整、无孔隙、无相邻衣片混入。父组 allowOutsideParent 未设置，全部检查父范围通过（outsideSamples=0）。







## 最终生成提示词（内置工具）

Edit the provided COMPLETE CLOTHING image as a structural reveal reference, front pose unchanged. Keep the entire outfit, all original garment proportions and reliable visible shapes, anime style and original framing. Focus on SCREEN RIGHT hanging tassel below the red bead on the waist bow. DELETE that red bead COMPLETELY, including its white circular rim and black circle outline. Do not replace the bead with any white ball or rounded accessory. Reveal the top of the existing tapered pink-white tassel behind where bead was: only a VERY SHORT narrow textile root, a low smooth rounded top edge 5 pixels above the original tassel top in original 1376x2048 coordinates. The root is narrower than the upper body of the tassel and leads directly into the tapered hanging thread bundle. There must be NO circular bulb, no knot, no collar, no band, no ring, no cap. A small clear gap can remain between the cord ending above and this short exposed tassel root after bead removal. The target's sides and curved bottom MUST remain unchanged, same size and original location. All other garments and the SCREEN LEFT bead and tassel remain in place. Full complete outfit only, not cropped, transparent background, no human, no annotations. This is exposure of existing hidden cloth, not redesign or new attachment.
