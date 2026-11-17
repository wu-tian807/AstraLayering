独立核对候选是否沿参考图中本部件清晰轮廓线的外缘描绘，包含线条本身的可见宽度；无线稿处以明确的形体色块外缘为准。读取组说明，先看参考辨认本件与遮挡关系，再对照候选逐段检查。候选和父稿保持只读，本轮只审当前组。

先看整图定位，再放大参考、blend 和 edge，覆盖全部可见外缘与接缝。逐段确认边界对应参考中的哪条线、轮廓内外分别是什么，核对位置、弧度、转向、尖端与开口。以局部清晰边界验收，整体相似和部件存在性只用于理解结构。

清晰轮廓线和可靠遮挡分界优先于相近颜色与形状推测。候选范围应落实到已确认的可见依据；模糊邻接区域以已确认边界为界，隐藏延续交给补全。将误包相邻结构、漏掉本件线条外缘、沿错边或过度接顺列为返修。微小而清晰的偏差同样修正，反馈写明位置、参考边界和调整方向。

实际连续的边缘保持连续，遮挡形成的分离区域按实际露出范围验收，保留清晰折角、真实间隙与开口。group 内已覆盖的成员、纹理和普通明暗沿用联合范围；脸底、眼白、躯干等底形在内部叠放内容下保持连续，外围遮挡边界仍按参考检查。左右复制或镜像的组件逐件核对本侧形状。

有父组时核对本件归属与父范围。可靠外缘确在父外时，在同一局部叠加父稿，分别指出父内可修处和上游范围限制；当前允许范围已准确、仅余确认的上游限制时可 pass，并如实说明缺漏。已登记实体的空轮廓按其遮挡或证据依据验收。

全部可见范围与明确边界相符时提交 pass；有可修的误包、漏画或边缘偏离时提交 revise，一次列出已核对的问题。输入缺失、损坏或工具故障使检查无法进行时提交 blocked，说明错误和恢复尝试。通过 submit_review 保存结论，feedback 简述依据或实际修改要求。

【本次输入】
reference：{uri:part-layering/references/base-subject.png}
groups：{uri:part-layering/groups.json}
group：groups 中 id 为 {group_id} 的节点；kind 省略时为 group
parentGroup：{group_id} 去掉最后一段 /<名称> 后的 ID；不含 / 时为 null
round：第 {review_round} 轮 review
parentSvg：{uri:part-layering/parts/}<parentGroup>.svg；parentGroup 为 null 时没有父组 SVG
canvas：{width}×{height}
candidate：{uri:part-layering/step09_outline/{group_dir}/outline.svg}

审查报告：{uri:part-layering/step09_outline/{group_dir}/review.json}
候选只读；完成全部检查后一次提交反馈。

用于独立核对本组可见外轮廓的素体参考图。
参考图绝对路径：{uri:part-layering/references/base-subject.png}
