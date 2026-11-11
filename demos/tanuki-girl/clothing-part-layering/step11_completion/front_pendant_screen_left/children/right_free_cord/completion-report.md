# right_free_cord 正面遮挡补全

已提交 [可编辑 SVG 草稿](workspace/completion.draft.svg)。保留全部原路径，仅在绳下端新增一条闭合路径：约 x623–642、y913–925，与原形重叠约 4 像素，在原 y917 终边下方补约 8 像素的圆滑插入余量。新增部分完全位于父完成范围及本支圆珠覆盖区内，父范围检查 outsidePixels=0。

本片只包含角色自身右侧、画面左侧的连续自由绳端。上端沿用源稿已有的短圆滑搭接，藏于中央结芯和相邻绳环根部之后；露出绳身在金色腰带、深色环腰层、短下摆及其后躯干之前；下端短插入段在本支圆珠之后。绳不包含结芯、绳环、固定横绳、圆珠、流苏、另一支绳或人体，也没有需要填补的真实开口或薄纱。

根部随中央前结和腰部固定点；绳身可独立柔性弯曲、摆动和显隐，下端带动本支圆珠和流苏。两端覆盖关系应继续传入最终深度区域规划，圆珠和流苏保持各自实体及控制职责。

辅助图由内置 imagegen 基于完整纯衣服参考生成，保存为 [construction-reference.png](construction-reference.png)。首张改变绳摆角且未揭示端点，弃用。选用第二张读取连续绳宽、走向与圆滑端部；图中去珠后绳过长且靠近流苏，未采纳这一长度和连接。实际补绘仍由原参考圆珠上缘、源稿端点与 group note 锚定。

修改后的检查：

- [生成图整体 edge 对照](report-images/generated-edge.png)：选区 `[459,524,63,184]`，核对正面绳形宽度、方向及主要边缘，记录生成图根部和长度差异。
- [原纯衣服 blend 定位](report-images/reference-blend.png)：新增端完全藏于圆珠覆盖区，邻接与归属正确。
- [完整绳形独显](report-images/cord-alone.png)及[下端六倍独显](report-images/tip-alone.png)：连续无缝，圆滑收尾，不接流苏。

内置生图的最终提示词：

```text
Precise construction-study edit of the supplied complete outfit. Same FRONT pose, entire outfit visible on transparent background, original clothing shapes and locations fixed. Target ONLY: the screen-LEFT hanging pink/white striped cloth strip between the CENTRAL bow knot and the LEFT red circular pendant bead. Keep this strip at exactly its original slight diagonal inclination and position: it slopes down-left slightly, NOT far to the left; keep the opposite strip and all other garments unchanged. For this construction reference temporarily REMOVE ONLY the tiny central oval bow knot cover and the screen-left red circular bead cover. Keep both bow loops, the horizontal tie, the right dangling pendant, and the left tassel in their exact original locations. Do not move the target cord or its tassel, no pose alteration. Beneath the removed central oval cover reveal the target strip's short rounded upper root (continuous with the visible strip, same width); beneath the removed red bead reveal its short rounded lower insertion tongue at the bead's original top area. The lower tongue ends just inside the bead's previous top quarter, well ABOVE the tassel, with a clear gap separating tongue from tassel; it must not connect to or include the tassel. No invented long extensions or accessories. Keep target exposed strip's width, curve, trajectory, pink-white diagonal stripes and original shared edges exactly as input. This is the same garment in the same front pose with two tiny covers removed to inspect hidden fabric, not a redesign. Preserve gold obi, deep indigo waist layer, pale apron, floral embroidery, both white sleeves and long side cloth panels. No people, skin, text, arrows or extra inset views. IMPORTANT: do not pull the left cord and pendant sideways. Only remove the stated covers and show short continuous rounded fabric beneath them.
```
