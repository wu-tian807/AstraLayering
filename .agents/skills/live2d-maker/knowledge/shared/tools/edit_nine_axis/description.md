编辑本步左右九轴的真实作者源 face-left.json。首次用 importParts 导入 KRA 从上到下的贴图部件列表：每项有 id、group、texture（本步 layers/ 的 PNG）、textureBounds=[x,y,width,height]、bbox=[x0,y0,x1,y1]，可选 cols、rows（默认 4×4）；工具创建静止与左右端点的规则网格，不创建任何预设分组。axis 是原画布像素中的镜像中轴。已有源时调用 {} 读取 revision 和变形器/部件索引。

operations 可以一次提交多项。每项 action：
- create_warp：id、可选 name、targets（你选择的部件或变形器 id）、可选 parent、bbox、cols/rows（默认 2×2）。建立无贴图的父变形器并把 targets 放进去；分组与层级由你决定。支持平级变形器，也支持再加子变形器做细节。范围默认包住选中对象已有 X 关键形；有父级时可明确提供 bbox。
- reparent：targets、parent（null 表示解除父级）；remove_warp：id。改挂/拆分保留已有关键形的画布位置，不清空局部修正。
- transform：id、x（角度）、可选 y、translate=[dx,dy]、scale=[sx,sy]、origin=[cx,cy]。对整个选中变形器或独立部件进行平移/缩放；父变形器会带动子级。scale 须为正数。origin 默认是当前网格中心。
- drag：id、x、row、col、delta=[dx,dy]、radius（原画布像素）。软选择拖点；半径范围内的点一起平滑移动。
- points：id、x、points=[{row,col,to:[x,y]},…]。只写需要改的控制点；to 是 view_nine_axis 返回的画布坐标，工具处理父级反解，不必手算局部坐标。
- interpolation：id、spatial=linear/smooth（控制网格内部的直线/平滑曲线），x=linear/ellipse（参数运动轨迹）。ellipse 用负值/0/正值三个关键形形成椭圆轨迹；若需额外中间形，直接在该角度编辑，工具先采样当前形，再切到 linear，保留新控制的形状。此实现借鉴 Cubism 的曲线轨迹，不是 Cubism 文件导入器。
- add_part：part，字段同 importParts，可带 role="mask"、parent；clip：id、by=[蒙版部件 id]、invert。用来增加必要的下颌线/蒙版与覆盖部件，普通裁切取来源 alpha 的并集，invert 为反向裁切，by=null 解除裁切。

父级改大形，子级或独立部件修局部。不要把所有贴图分别复制一份相同变形，也不要为层级套用固定解剖树。左右成对的 id 用完整 left/right 词（如 eye_left），程序以配对的左形镜像右形。编辑左侧和中间负角度后，用 view_nine_axis 同时检查左右，尤其是脸缘、瞳孔、嘴层和脖子连接。

成功返回新 revision 与节点索引；后续传 revision 可防止覆盖新改动。整个批次验证引用、父子循环、网格折叠与贴图后才保存，失败不写入。notes 可记录你的分组理由和造型调整。图片检查请继续使用 view_nine_axis。
