# 制作 Live2D 投影蒙版

## 输入

均只读：
- 制作参考：工作区 references/ 中的 inputs.json、production.md、skirt.png、hair.png。
- 已组装、分层的角色 KRA：{uri:character-assembly/step01/character-assembled.kra}。
- 对应原尺寸合成 PNG（几何配准基准）：{uri:character-assembly/step01/character-assembled.png}。
- simplified 参考（分析画法与投影范围）：{uri:part-layering/references/simplified-subject.png}。
- part 分组与遮挡顺序：{uri:part-layering/groups.json}、{uri:part-layering/occlusion.json}；穿衣时另有 {uri:clothing-part-layering/groups.json}、{uri:clothing-part-layering/occlusion.json}。人物 ID 记为 character:<原 part ID>，衣服 ID 记为 clothing:<原 part ID>。

在原组装 KRA 的新工程里用 Krita 直接绘制，不调用生图。先读制作参考 inputs.json、production.md，查看裙影与发影参考图。

## 目标

分层时每个部件只保留了自身的明暗，由其他部件投下的阴影都去掉了。本步把这些投影找回来，做成独立、可随动的影层，让合成后的角色和 simplified 参考一样有投影。

- 对照 simplified 参考看全身：参考里由一个部件投到另一个部件上的阴影，都找出来做成影层。常见的有刘海和侧发投到额头与脸颊、上眼睑和睫毛投到眼白与虹膜上缘、头饰、兽耳或前面的发束投到头顶头发上、手投到身上、下巴投到脖子、衣领袖口投到皮肤、裙摆投到腿；以参考里实际看到的为准，不限于这些。
- 每处投影的形状、范围、颜色、深浅和边缘软硬与参考一致。形状以参考里实际看到的暗面为准，不是把投影部件的轮廓平移复制一份：例如上眼睑在眼内投下的，是眼白和虹膜上部一整片柔和变暗、向下渐淡的区域，范围由眼睛开口决定，不是一条睫毛形状的窄带；裙摆的影子跟着裙摆下缘落在腿上。
- 投影是压在接收面上的一层暗色：接收面自身的线稿、明暗和材质在影子下面都透得出来，合成后线条连续、不被盖住。合成后和参考并排看，阴影的浓淡对得上；多处投影叠在一起的地方，叠合后的深浅也和参考一致。
- 完整影层：保留被遮挡的部分、裁切外的形状和合理的运动余量，不只描露出的影带。每个独立运动来源单独成层（例如眼部投影以对应上眼睑为来源，不随虹膜视线位移），多个接收面可以联合裁切；用隔离组加原生透明度继承，base 下方不混入其他实色层。

## 要保护的

- 部件自身的明暗、材质、线稿与高光保持原样，加上投影后依然可见。已有投影需要独立控制时，可以先局部去掉，补回接收面底色，再重做独立影层。
- 投影的形状来自投影部件和接收面的实际关系；图层深度序号只表示叠放顺序，不代表投影距离。
- 保持原分辨率、透明背景和原部件可编辑性，输入只读。移动接收层后检查原蒙版子节点，保留 UUID、归属和启用状态。

## 记录与检查

- 从保存的工程记录真实 part／UUID、裁切 base、颜色依据与相对偏移，交付 shadows.json v2。follow 只表示运动来源，本步骤不制作 deformer／光向关键形。
- 保存 KRA、导出一致 PNG，调用 inspect_shadow_mask 工具检查：它在 Krita 中打开已保存工程的独立副本，返回 problems（越界新增 alpha、空影层、图层归属矛盾等）、warnings 与检查图路径，结果另存在 {uri:shadow/step01_mask/inspection.json} 与 {uri:shadow/step01_mask/inspection}/。查看完整影层、接收面、去影对照和全部偏移图，工具返回的 problems 全部修好，修正后再检查。
- 整图和参考并排看，再放大看每处投影，确认深浅和范围与参考一致。
- 输出 face-review.png，并排展示原组装、去影和最终结果的头脸原尺寸裁切及细发偏移，不缩小裁切。
- 简短 report.md：每处投影的投影部件、接收面、颜色与深浅依据和余量；参考里有而没有做的投影写明原因。

## 交付

全部保存在 {uri:shadow/step01_mask}/，不修改上游，也不操作另一阴影分支：character-shadowed.kra、character-shadowed.png、shadows.json、face-review.png、report.md。交付齐全并完成以上检查后返回 completed；只有必要输入缺失、损坏或工具故障导致无法继续时返回 blocked，写明具体路径或错误、恢复尝试和已保存进度。
