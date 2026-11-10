# 生成当前人物的法线与深度数据贴图

## 输入

均只读：
- 已组装、分层的角色 KRA：{uri:character-assembly/step01/character-assembled.kra}。
- 对应原尺寸合成 PNG（几何配准基准）：{uri:character-assembly/step01/character-assembled.png}。
- simplified 参考（分析画法与投影范围）：{uri:part-layering/references/simplified-subject.png}。
- part 分组与遮挡顺序：{uri:part-layering/groups.json}、{uri:part-layering/occlusion.json}；穿衣时另有 {uri:clothing-part-layering/groups.json}、{uri:clothing-part-layering/occlusion.json}。人物 ID 记为 character:<原 part ID>，衣服 ID 记为 clothing:<原 part ID>。

使用已配置的生图模型，从**组装原尺寸合成 PNG** 生成两张全图贴图：normal.png 和 depth.png。simplified 只辅助理解角色表面与材质，不以其不同轮廓替换组装图。一次生成一张，保留成功结果，失败或中断只继续缺失／不合格的贴图。无需逐个 part 调用生图。

保持输入画布原尺寸、姿态、裁切、像素位置、人物轮廓与眼口边界。不改变原画、不压缩皮套、不生成示意缩略图，不用调整尺寸掩盖模型生成的错位。若模型输出尺寸或位置不符，修正生成请求或编辑配准，检查合格后才交付。可看放大局部和透明叠图对照，不以“看着像”替代配准。

- normal.png：RGB 编码相机／图像平面坐标下的单位方向，`N=normalize(2*RGB-1)`；X 向画面右，Y 向画面上，Z 朝镜头。正对镜头约为 `(128,128,255)`。保留二维画法需要的克制曲面，避免脸部鼻唇过强浮雕；不是着色图、不是灰度凹凸图。
- depth.png：RGB 通道相同的灰度深度，白近黑远；是相对深度，保持合理部件层次，不把原画像素亮度当深度，不以肤色或头发颜色决定远近。轮廓及接触处稳定，检查刘海／脸、头／颈、裙／腿等实际遮挡层次。
- 两张贴图作为数据纹理，使用原尺寸无损 PNG，不烘焙 sRGB 光照，不添加图例、文字、装饰、阴影或边框。RGB 通道必须保留数据；透明覆盖由调度器按组装原图恢复，不能误删深色衣服或发丝。

原分层已自然移除的投影无需再去影。本分支不强制把角色全部重画成平涂，不写入阴影蒙版，也不更改 KRA。数据仅表达当前可见表面；隐藏表面的分配与平滑补全由工作台利用 part、原生蒙版与前后叠加关系处理，不在本阶段臆造新的手势或转面。

报告记录模型输出、原尺寸检查、逐处轮廓配准、法线方向、深度层次、估计区域与仍存在的问题；只有两图都生成并检查后才完成。后续部件形变仍沿用同 UV 映射、法线方向修正与按层补全方案，不把生成两张图宣称为完成了完整动画绑定。

## 交付

全部保存在 {uri:shadow/step01_normal-depth}/，不修改上游，也不操作另一阴影分支：normal.png、depth.png、report.md。交付齐全并完成以上检查后返回 completed；只有必要输入缺失、损坏或工具故障导致无法继续时返回 blocked，写明具体路径或错误、恢复尝试和已保存进度。
