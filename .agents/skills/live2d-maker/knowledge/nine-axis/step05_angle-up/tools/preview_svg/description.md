复用 part-layering 的 SVG 独显、blend 叠加与 edge 边缘检查。SVG 的 width/height 与 viewBox 为 box.size 的正面特写画布，闭合纯色色块，stroke="none"；edge 提取填色的红色外缘。

省略 reference 时绑定本角色 step04_views-y/up.png。可指定同尺寸、同坐标的原画脸底 PNG 作为 reference；按原贴图 textureBounds 放回原画布，再按 crop.json 的 box 裁出。参考不居中、不重新缩放或对齐，referenceRegion/referenceOffset 不开放。

先用 mode=blend 看整图，再以 crop=[u,v,width,height]、scale=4..8 重叠分区，用 blend/edge 核对填色外缘。source 对无遮挡原脸底，target 对本步 up 帧；重点看两侧颊颌、下巴和可见额顶/太阳穴的位置、切线、转折及笔锋，辨认实体脸缘与遮挡边界。补全段仅指导隐藏结构，不能覆盖视频可见证据。改稿后回查相邻区，再由相同路径段生成 face-trace.json，最后用 view_nine_axis 看真正形变后的贴图。

输入文件不修改，预览返回图片与 savedPath。crop 只控制查看范围，不改变参考位置。
