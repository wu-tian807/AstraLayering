# 制作 Live2D 投影蒙版

## 输入

均只读：
- 制作参考：工作区 references/ 中的 inputs.json、production.md、skirt.png、hair.png。
- 已组装、分层的角色 KRA：{uri:character-assembly/step01/character-assembled.kra}。
- 对应原尺寸合成 PNG（几何配准基准）：{uri:character-assembly/step01/character-assembled.png}。
- simplified 参考（投影的样子以它为准）：{uri:part-layering/references/simplified-subject.png}。
- part 分组与遮挡顺序：{uri:part-layering/groups.json}、{uri:part-layering/occlusion.json}；穿衣时另有 {uri:clothing-part-layering/groups.json}、{uri:clothing-part-layering/occlusion.json}。人物 ID 记为 character:<原 part ID>，衣服 ID 记为 clothing:<原 part ID>。

## 目标

分层时每个部件只保留了自身的明暗，由其他部件投下的阴影都去掉了。本步把这些投影画回来，做成独立、可随动的影层，让合成后的角色和 simplified 参考一样有投影。

- 参考里由一个部件投到另一个部件上的阴影都画回来。常见的有刘海和侧发投到额头与脸颊、上眼睑投到眼白与虹膜上部、头饰或前面的发束投到头发上、下巴投到脖子、袖口投到手臂、裙摆投到腿；以参考里实际看到的为准，不限于这些。
- 每处投影的形状、范围、颜色、深浅和边缘软硬，都和参考里看到的暗面一致。例如上眼睑的投影是眼白和虹膜上部一整片柔和变暗、向下渐淡的区域。
- 投影压在接收面上：接收面自身的线稿、明暗和材质从影子下面透出来，合成后线条连续。多处投影叠在一起时，叠合后的深浅也和参考一致。
- 影层完整：被遮挡的部分、裁切外的形状和合理的运动余量都画上。投影部件决定影层跟谁动，每个运动来源一层（例如眼部投影跟上眼睑，不跟虹膜视线）。

## 要保护的

- 影子是画出来的：用 Krita 画笔一笔一笔画，边缘的软硬和过渡靠笔触画出。
- 部件自身的明暗、材质、线稿与高光保持原样。图层深度序号只表示叠放顺序，不代表投影距离。
- 保持原分辨率、透明背景和原部件可编辑性，输入只读。移动接收层后检查原蒙版子节点，保留 UUID、归属和启用状态。

## 流程

1. 看参考：整图和 simplified 参考并排，再放大逐区看，列出每处投影的投影部件、接收面、形状、深浅和边缘。
2. 建影层：在原组装 KRA 的新工程里，为每处投影在接收面的隔离组中新建影层，用原生透明度继承裁到接收面，混合方式让底层透出（例如正片叠底）；base 下方不混入其他实色层。
3. 画：在影层上用 Krita 画笔画出投影，柔和的地方用软笔刷画出过渡。
4. 对照：合成后和参考并排看，再放大看每处投影的形状、深浅、边缘，以及线稿是否透出；不对就回到第 3 步改。
5. 检查：保存 KRA、导出一致 PNG，按真实 part／UUID、裁切 base、颜色与相对偏移写 shadows.json v2（follow 只表示运动来源，本步骤不制作 deformer／光向关键形），调用 inspect_shadow_mask。它返回的 problems 全部修好后再调用，直到没有 problems；结果在 {uri:shadow/step01_mask/inspection.json} 与 {uri:shadow/step01_mask/inspection}/。

## 交付

全部保存在 {uri:shadow/step01_mask}/，不修改上游，也不操作另一阴影分支：
- character-shadowed.kra、character-shadowed.png、shadows.json。
- face-review.png：并排展示原组装、去影和最终结果的头脸原尺寸裁切及细发偏移，不缩小裁切。
- report.md：每处投影的投影部件、接收面、颜色与深浅依据和余量；参考里有而没有做的投影写明原因。

交付齐全并完成以上检查后返回 completed；只有必要输入缺失、损坏或工具故障导致无法继续时返回 blocked，写明具体路径或错误、恢复尝试和已保存进度。
