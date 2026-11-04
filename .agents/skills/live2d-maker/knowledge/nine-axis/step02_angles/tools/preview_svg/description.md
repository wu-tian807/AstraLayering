复用 part-layering 的 SVG 独显、blend 叠加与 edge 边缘检查。SVG 的 width/height 与 viewBox 为 box.size 的正面特写画布，例如 394×394、viewBox="0 0 394 394"。闭合纯色色块，stroke="none"；edge 提取填色的红色外缘，不使用有粗细的描线代替轮廓。

省略 reference 时绑定本角色 step01_video/left.png。可指定同尺寸、同坐标的原画脸底 PNG 作为 reference；按原贴图 textureBounds 放回原画布，再按 step01_video/crop.json 的 box 裁出，不能根据形变后的脸重新居中、缩放或对齐。reference 尺寸不同会拒绝，referenceRegion/referenceOffset 在本步不开放。

先用 mode=blend 看整图，再用 crop=[u,v,width,height]、scale=4..8 重叠分区，分别用 blend 与 edge 检查可靠可见脸缘。crop 使用特写像素坐标，只放大查看；不会调整参考位置。source 的闭合色块对原脸底，target 的闭合色块对 left 帧。尤其核对远侧眼尾外侧到颊部的边缘位置、切线、陡边与转折；头发遮挡线与脸的真实外缘分别辨认。补全段只作结构推断，不能拿它偏离视频的范围当通过。

输入 SVG 与参考图均不修改，预览返回图片与 savedPath。改稿后重看当前版本，再由相同 path 段生成 face-trace.json；最后用 view_nine_axis 检查实际形变后的贴图。
