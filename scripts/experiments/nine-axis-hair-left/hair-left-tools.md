{} 返回当前可编辑范围的节点索引。operations 支持：
- create_warp：id、level=hair、targets、cols、rows、bbox=[x0,y0,x1,y1]，创建本轮发片的专用父 Warp 并保留子级形状。
- reparent：targets、parent；remove_warp：id，改挂时保留形状。
- transform：id、x、translate、scale、可选 origin。
- drag：id、x、row、col、delta、radius，按画布像素软选择相邻点。
- points：id、x、points=[{row,col,to:[x,y]},…]，to 是实际画布坐标，有父级时同样如此。
- interpolation：id、spatial=linear 或 smooth；参数轨迹配置使用 x=linear 或 ellipse。

view_nine_axis 使用 level=hair；only、hidden 可指定发片或 Warp，grid 返回实际画布控制点。reference={path:"nine-axis/step08_hair/references/left.png",bounds:[319,-21,774,774]} 默认 mode="edge"，看当前可见发片的青色透明轮廓叠参考；必要时显式 mode="blend" 看 50% 叠图。crop 使用原画布 [x,y,width,height]，scale=2..4 可放大局部。两种模式保持同一坐标与显示部件，不自动对齐。

组合只看三片前发可用 only=["hair/bangs","hair/side_hair/side_hair_left","hair/side_hair/side_hair_right"]；隐藏后发、辫子的带脸画面可用 hidden=["hair/back_hair","hair/braid_right"]。检查单片时 only 只填该片 id。edge 不含网格、棋盘或内部分束线；看当前原色模型检查发纹和高光，必要时用 blend 辅助；用不带 reference 的真实预览检查透明搭接缝。
