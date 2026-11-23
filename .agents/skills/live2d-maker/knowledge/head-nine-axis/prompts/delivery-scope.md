【脸部制作与验收】
使用原 KRA 贴图，保留上游关键形。只做本方向的脸底、五官和已有独立耳层。头发、头饰用于判断遮挡，脖子固定，下颌接触在 step07 收尾。独立投影沿用实际归属、随动和裁切关系。

1. 保留可见脸缘的走向和转折。沿原有脸型补足头发遮住的额顶、额角、太阳穴和脸侧，给发片移开留出皮肤覆盖。归属不清的露肤先辨认部件。用 preview_svg 的 edge 逐段核对，确认补画的部分在参考帧中被头发盖住，补全边缘与可见脸缘连续。
2. 写描线 JSON，version=1、space=view。completion={part,source,target} 中 source 用 source-face.svg 的完整闭合路径，target 用补全后的闭合轮廓。curves 为对应小段，可见脸缘标 visible，补全段标 occluded。建脸底 Warp，用 fit_nine_axis 先 inspect 再 fit。
3. 用 view_nine_axis 的 only=["face/face_base"] 对照补全轮廓和本方向参考帧。用 fit 的 features 或 edit_nine_axis 局部修正偏差和碎边。
4. 用 edit_nine_axis 调整五官与已有耳层，保留五官结构、相对位置和耳根接点。用 level="face" 检查形体与接合，再看包含头发的合成，核对端点和过渡的显露。没有独立耳层时检查合成轮廓。

notes.md 简记补全位置、耳朵处理和剩余偏差。完成返回 {"error":null}，做不了时 error 写原因。
