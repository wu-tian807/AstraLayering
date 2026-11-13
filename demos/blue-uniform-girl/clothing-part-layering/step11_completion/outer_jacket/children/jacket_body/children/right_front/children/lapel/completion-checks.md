本片为角色右侧、画面左侧的胸前驳头，主体为原有三角翻出面，完成范围约 x473–594、y376–511。新增一条闭合路径，只延续上端被独立 right_collar_flap 遮住的短衣料，形成圆滑搭接；可见主体、自由边、下端与原源稿一致。

新增范围约 x505–536、y376–409，与源稿上端斜边交叠。向上最多延续约 6 像素，位于上方翻领下面；并不承担上领或颈后衣料。折根约 (534,382)–(592,508) 已连续，保留原宽度和下端，不额外扩大到中央开襟。与 front_panel 共同随右肩及上身定位，翻出面可独立翻折；本片在承载前片、右上胸和内搭之前，上端搭接在独立上领之后。承载前片负责驳头后方的连续衣料及连接带端部，不并入本片。

以完整衣装作为输入，用内置 image_gen 生成同姿态辅助图，仅要求轻抬画面左侧独立上领。第一张辅助图移动了自由尖角，弃作轮廓基准；第二张保留了较接近原图的三角驳头，采用为最终辅助参考。生成图上领附近的重复水平滚边属于生成偏差，没有据此补画任何新实体。可靠可见边缘和坐标均以纯衣服参考及只读源稿为准。

[完整结构辅助图](structure-reference.png)

先独显确认三角主体、宽度和胸前归属，再检查上端搭接与下端邻接。edge 对照使用第二张生成图整体目标选区 [474,377,126,142]，等比倍率 0.950704，偏移 [0,0]；自由边、折根和下端与生成图大体一致，新增上端余量藏在上领覆盖区。默认参考 blend 确认实际位置、上领覆盖和中央开襟。独显衣料连续，没有孤立小块或封口面。四倍采样父范围检查通过，越界为 0。源稿路径保留原样，新增路径在其下方；没有发现源稿实体归属错误。











最终辅助图使用内置 image_gen，提示词如下：

```text
Precise garment structure edit of the supplied whole outfit. Retain the EXACT same full frontal pose, framing, jacket proportions, anime style, navy blouse, clasp, skirt and all sleeves and details. The viewer-left white triangular chest LAPEL BELOW the upper collar must keep precisely its current visible edges: top at (534,382), outside corner at (476,438), bottom at (592,511), original 1115x1410 coordinates. Do not move this triangular lapel outward or upward, do not widen it or alter its free cyan outline. Lift ONLY the separate upper white collar flap on viewer-left a very small amount upward (about 12 pixels at its lower edge), showing a small smooth continuation of the chest lapel underneath the upper collar near the lapel top and the collar/lapel notch. The reveal is a modest attachment allowance, not a long strap, separate lining, or enlargement of the lapel. Preserve upper collar as its own identifiable piece and the notch between collar and lapel. All other garment geometry unchanged. Keep the whole outfit visible, no separate diagrams or panels, no human body, no skin, no text, genuine transparent background. Priority: maintain the original triangular chest lapel visible-edge locations exactly.
```
