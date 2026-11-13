从当前工程引用的已保存 KRA 按 UUID 读取像素，应用当前累计九轴 JSON，用工作台同一渲染器返回图片。无需自行导出或刷新素材；读取结果按 KRA 内容版本缓存，缺失图层时报错。未保存的 Krita 修改不进入预览。返回 document、revision 和 savedPath。

x/y 为参数角度，默认 0；level 为当前工程的预览层级。crop=[x,y,width,height] 使用原画布坐标，默认工程视框；scale 为每画布像素对应的屏幕像素，范围 0.25..8。可预览范围由运行环境提供，不改变作者数据。

only、hidden 指定部件或 Warp；Warp 展开到后代，部件选择不自动包含关联节点。masks 可用青色显示指定蒙版。grid 指定要显示网格的部件或 Warp，另返回 cols、rows、points；points 是变形后的画布坐标，按行排列，索引为 row×(cols+1)+col。有父级时另返回 parent 和 localPoints；edit_nine_axis 接受画布坐标。

reference:{path,bounds?:[x,y,width,height]} 返回参考、当前及叠加比较图。bounds 表示参考图片覆盖的原画布范围，默认工程视框。工具不自动对齐、重居中或缩放参考去迁就模型。

提供 reference 时只使用 edge，将当前渲染的可见 alpha 边界以青色叠到参考上；不包含棋盘、网格或裁剪窗口产生的假边。无 reference 时省略 mode，返回原色预览；显式 mode="edge" 必须提供 reference。返回 mode 为 edge 或 color，比较信息保存在 comparison。

独立投影沿用 KRA 混合方式和不透明度，按当前接收部件裁切。投影不扩大接收部件的 alpha 外轮廓。edge 用于轮廓比较，原色预览用于检查内部线条、纹理和明暗。

frames:[{x:0,y:0},{x:-15,y:0},{x:-30,y:0}] 一次返回多帧及拼图，最多 16 帧。共用同一份 KRA、JSON 和 crop/scale/only 等参数，每帧可单独提供 reference；不能同时传顶层 x/y。
