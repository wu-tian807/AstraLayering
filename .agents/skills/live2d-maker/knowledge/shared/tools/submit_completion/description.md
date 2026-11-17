预览当前草稿后提交正面遮挡补全。note 说明遮挡与延续依据，或为何不需补全。默认结果须在父轮廓内；确有实体延续依据时，可填写 outsideParentReason 主动申请独立评审，说明越界位置、被谁遮挡和两侧边缘如何接续。评审通过才接受当前稿的越界部分；拒绝会返回依据，继续在父范围内修正。评审结论由本次工具调用直接返回。

修改后先用 preview_svg 查看 outputDraft 的独显、blend 和局部，随后在 note 中说明补全依据；无需新增也应观察并说明。

生图后，用 edge + reference + referenceRegion 对照生成图：同姿态图对照部件边缘，转面图只框选对应段读取结构，referenceOffset 可选；再省略全部 reference 参数，用 blend 直接叠加到人物/衣服参考图检查实际位置，并查看 SVG 独显。hiddenInReference=true 的部件须完成上述三项自查，交付非空的可编辑 SVG。越界评审仅决定当前候选能否超出父轮廓，画布、坐标、归属和原形校验始终保留。
