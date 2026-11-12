按源曲线、目标曲线和对应点，自动求当前工程中选定节点的关键形。作者文件、目标角度和参考由运行环境绑定；是否提供本工具由当前步骤决定。不会自动分组、挑选部件或建立预设层级。

action=inspect/fit，trace 为 JSON 路径；fit 另给 id，指定已有 Warp 或部件。features 可指定本轮使用的曲线/对应点 id，默认全部。revision 防止覆盖新改动。smoothness 默认为 0.02，控制网格额外弯曲的惩罚强度。

trace 包含 version:1、space:"view"/"canvas"、completion:{part,source,target}、curves:[{id,part,source,target,visibility?,weight?}]，可选 landmarks:[{id,part,source:[x,y],target:[x,y],visibility?,weight?}]。completion 的 source/target 为完整闭合 SVG path d，曲线必须与各自完整轮廓一致。曲线的源和目标方向、起终点应对应同一位置；工具沿弧长采样，转折应拆成对应小段。part 必须属于本轮选定节点。

space=view 使用当前工程参考视框的像素，工具加回画布偏移；space=canvas 为原画布像素。visibility=visible 默认权重 1，occluded 默认 0.03。工具限制遮挡约束对可见拟合的扰动，返回 occludedWeightScale。completionMismatch 超过 2 个当前坐标像素时拒绝保存；这个检查只验证描线彼此一致，不能判断描线的语义与造型是否正确。

inspect 返回描线叠图、完整轮廓检查图和 revision，不保存形变。fit 使用渲染器同一 Warp 计算、处理父级坐标，保存选定节点的目标关键形，保留其他节点与已有关键形，并检查网格翻折。返回逐段拟合前后的平均/最大误差（原画布像素）、新 revision 和报告路径。误差只反映网格与描线的贴合程度，实际画面使用 view_nine_axis 检查。

支持组合角度的实例另要求 corner="left-up" 或 "left-down"，与当前选定参考绑定；修改参考、描线或作者后需要重新 inspect。失败不写作者文件。
