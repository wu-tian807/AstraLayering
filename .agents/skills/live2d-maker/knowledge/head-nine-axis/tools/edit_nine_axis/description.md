编辑当前工程的图层绑定、Warp 层级和九轴关键形。作者文件、KRA 来源、可编辑节点和角度由运行环境绑定。调用 {} 返回 revision、作者路径、节点索引；有 KRA 时另返回已保存图层目录、UUID 和已有关系。目录中的关系供检查，不会自动选中或修改关联节点。

画稿用 KRA 图层 UUID 引用，不需要提供或维护 PNG。节点 id 标识独立几何，同一 UUID 可以供多个不同取样范围的部件使用。新部件通过 add_part 注册：part 包含 id、uuid、bbox=[x0,y0,x1,y1]，可选 level、group、cols、rows、parent；工具初始化当前参数范围内的静止网格。bbox 是原画布上的网格范围，textureBounds=[x,y,width,height] 可指定读取区域，默认 bbox 对应区域。已有部件通过 bindings:[{id,uuid}] 重绑；纯构造部件用 material="transparent"。像素修改在 Krita 保存后生效。

operations 接受一批操作，按顺序执行：
- create_warp：id、targets、可选 name、parent、bbox、cols/rows。建立父 Warp 并挂入明确列出的对象，默认网格 2×2，范围包住这些对象已有关键形。
- reparent：targets、parent（null 解除父级）；remove_warp：id。改挂或移除 Warp，保留已有关键形的画布位置。
- transform：id、x、可选 y、translate=[dx,dy]、scale=[sx,sy]、origin=[cx,cy]。在该角度平移、缩放选定节点，父 Warp 带动其后代。缩放须为正数，origin 默认当前网格中心。
- drag：id、x、可选 y、row、col、delta=[dx,dy]、radius。按原画布像素进行软选择拖点。
- points：id、x、可选 y、points=[{row,col,to:[x,y]},…]。to 为 view_nine_axis 返回的画布坐标，工具处理父级反解。
- interpolation：id、spatial=linear/smooth、x=linear/ellipse，分别设置网格内部插值和参数运动轨迹。ellipse 需要负值、0、正值三个 X 关键形；编辑新的中间形时转为 linear。
- mirror_pair：targets=[节点A,节点B]，显式指定同类节点的镜像对应。是否发布镜像关键形由当前工程决定。
- add_part：part，可选 before 或 after 指定绘制顺序参照部件，二者不能同时给出。
- clip：id、by=[部件id]、可选 invert；by=null 解除裁切。裁切取来源当前 alpha 的并集。

独立投影部件可在 part 中声明 shadow:{casters:[部件id],receivers:[部件id]}，并用 clip.by 明确接收部件。混合方式和不透明度读取所绑定的 KRA 图层。关系不会扩展 targets，也不会自动复制其他部件的局部网格修正。

x/y 是参数角度；位移、范围与控制点坐标使用原画布像素。新 Warp 继承当前工程已有参数关键形。传 revision 可防止覆盖新改动；整批通过引用、层级、网格和绑定校验后才保存，失败不写作者数据。返回新 revision 和节点索引。notes 可记录编辑理由，图像检查使用 view_nine_axis。
