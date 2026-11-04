# 制作 Live2D 投影蒙版

## 输入

均只读：
- 制作参考：工作区 references/ 中的 inputs.json、production.md、skirt.png、hair.png。
- 已组装、分层的角色 KRA：{uri:character-assembly/step01/character-assembled.kra}。
- 对应原尺寸合成 PNG（几何配准基准）：{uri:character-assembly/step01/character-assembled.png}。
- simplified 参考（分析画法与投影范围）：{uri:part-layering/references/simplified-subject.png}。
- part 分组与遮挡顺序：{uri:part-layering/groups.json}、{uri:part-layering/occlusion.json}；穿衣时另有 {uri:clothing-part-layering/groups.json}、{uri:clothing-part-layering/occlusion.json}。人物 ID 记为 character:<原 part ID>，衣服 ID 记为 clothing:<原 part ID>。

在原组装 KRA 的新工程里用 Krita 直接绘制，不调用生图。先读制作参考 inputs.json、production.md，查看裙影与发影参考图；依据 simplified 的实际投影和部件叠放选择关系。已有投影需要独立控制时，可先局部去掉投影、补回接收底色，再重做独立蒙版阴影；保留物体自身的明暗、材质、线稿与高光。

先检查脸：对照 simplified 的光向与实际阴影、分层轮廓和前后关系，逐束判断刘海、侧发、外伸细发与卷尾是否遮光并投到脸上。图层深度序号不能推出投影距离，不能把外侧发丝轮廓向脸内搬成影线。同一 part 不要求每个轮廓都产生可见影；没有落脸依据的候选不画并说明，不能为显影而加深或补出对称线条。

同时检查上眼睑和睫毛对眼白、虹膜上缘的投影。依据参考、光向与眼部画风，补足缺失的独立阴影片，保留隐藏区域和运动余量，按眼球开口裁切；以对应上眼睑为运动来源，不随虹膜视线位移。保留虹膜固有着色、眼线和高光，已有正确阴影不重复加深；原尺寸复核双眼，避免漏画或过度压暗。

完整影层保留遮挡区、裁切外形状和合理运动余量，不只描露出的影带。每个独立运动来源单独成层，多接收面可联合裁切；用隔离组＋原生透明度继承，base 下方不混入其他实色层。重叠发影参考正常不透明颜色以避免叠黑，其他投影按参考选色与混合模式，保持五官可读。

从保存工程记录真实 part／UUID、裁切 base、颜色依据与相对偏移，交付 shadows.json v2。follow 只表示运动来源，本步骤不制作 deformer／光向关键形。移动接收层后检查原蒙版子节点，保留 UUID、归属和启用状态。保持原分辨率、透明背景和原部件可编辑性，输入只读。

保存 KRA、导出一致 PNG，调用 inspect_shadow_mask 工具检查：它在 Krita 中打开已保存工程的独立副本，返回 problems（越界新增 alpha、空影层、图层归属矛盾等）、warnings 与检查图路径，结果另存在 {uri:shadow/step01_mask/inspection.json} 与 {uri:shadow/step01_mask/inspection}/。先查看头脸原尺寸裁切，再查看完整影层、接收面、去影对照和全部偏移图；修正后再检查。输出 face-review.png，并排展示原组装、去影、最终脸部及细发偏移，不缩小裁切。简短 report.md 记录脸周候选的处理／不适用理由，以及补画、颜色、余量与观察；工具返回的 problems 全部修好、逐图确认。

## 交付

全部保存在 {uri:shadow/step01_mask}/，不修改上游，也不操作另一阴影分支：character-shadowed.kra、character-shadowed.png、shadows.json、face-review.png、report.md。交付齐全并完成以上检查后返回 completed；只有必要输入缺失、损坏或工具故障导致无法继续时返回 blocked，写明具体路径或错误、恢复尝试和已保存进度。
