预览当前草稿后提交正面遮挡补全。说明每处被谁遮住、延续依据，或为何不需补全；程序验证原 SVG 保留和父范围。

修改后先用 preview_svg 查看 outputDraft 的独显、blend 和局部，随后在 note 中说明补全依据；无需新增也应观察并说明。

生图后，用 edge + reference + referenceRegion 对照生成图：同姿态图对照部件边缘，转面图只框选对应段读取结构，referenceOffset 可选；再省略全部 reference 参数，用 blend 直接叠加到人物/衣服参考图检查实际位置，并查看 SVG 独显。hiddenInReference=true 的部件须完成上述三项自查，交付非空的可编辑 SVG。allowOutsideParent=true 时保留画布、坐标、归属和原形校验，允许越出父轮廓。
