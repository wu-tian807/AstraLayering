本轮编辑 hair-x.json 中两片侧发的 X=-30、Y=0。editable 是 hair/side_hair/ 下的节点；刘海及其父 Warp、后发、辫子和脸部保持现有结果，正面与 right 保持原形。

{} 返回索引。operations 支持已有操作：
- create_warp：id、level=hair、targets、cols、rows、bbox=[x0,y0,x1,y1]，创建侧发父 Warp 并保留子级形状。
- reparent：targets、parent；remove_warp：id，改挂时保留形状。
- transform：id、x、translate、scale、可选 origin。
- drag：id、x、row、col、delta、radius，按画布像素软选择相邻点。
- points：id、x、points=[{row,col,to:[x,y]},…]，to 使用预览中的实际画布坐标，有父级时同样如此。
- interpolation：id、spatial=linear 或 smooth；参数轨迹配置使用 x=linear 或 ellipse。

view_nine_axis 使用 level=hair；only 可显示单片或两片侧发，hidden 可隐藏后发和辫子，grid 可显示指定部件及父 Warp。reference={path,bounds:[319,-21,774,774]} 用相同画布位置对照参考。
