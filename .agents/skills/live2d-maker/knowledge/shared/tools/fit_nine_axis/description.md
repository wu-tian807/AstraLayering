按你描出的原画轮廓与本步目标轮廓，自动求当前步骤的 Warp 参数。原画贴图保持，输出仍是 edit_nine_axis 使用的真实作者文件（X 为 face-left.json，up/down 为 face-up.json/face-down.json，斜向为 face-xy.json）；现有 drag、points、transform 可继续微调。不会自动分组或建立预设层级。

先预测完整脸型并写 trace JSON，用 `inspect` 看描线与无遮挡素脸，再用 `fit` 求形变。参数：action=inspect/fit、trace=文件路径；fit 另给 id=你选择的 Warp 或图形部件。features 可指定本轮使用的描线/参考点 id，默认全部；revision 可防止覆盖其他编辑；smoothness 默认 0.02，只约束网格的额外弯曲，减小可让局部转折更贴合，增大可减少无约束区域的波动。

trace 的格式：
```json
{
  "version": 1,
  "space": "view",
  "completion": {
    "part": "face/face_base",
    "source": "M 110 210 Q 120 260 197 283 Q 274 260 284 210 L 270 120 Q 197 90 124 120 Z",
    "target": "M 96 210 Q 110 257 170 282 Q 265 258 285 206 L 267 120 Q 185 88 112 120 Z"
  },
  "curves": [
    {"id": "left-cheek", "part": "face/face_base", "source": "M 110 210 Q 120 260 197 283", "target": "M 96 210 Q 110 257 170 282", "visibility": "visible"}
  ],
  "landmarks": [
    {"id": "chin", "part": "face/face_base", "source": [197,283], "target": [170,282], "visibility": "visible"}
  ]
}
```
例子只说明语法，坐标必须按当前角色描。space=view 表示与 step01 upper-body / 本步目标帧 同样的方形视框像素，工具按 crop.json 加回画布坐标；space=canvas 表示原画布像素。part 是描线对应的原 KRA 贴图部件，必须属于本轮 id。source 和 target 是 SVG path d，方向相同、起终点对应同一语义位置；闭合轮廓的起点和方向也须一致。工具沿曲线自动采样并按弧长对应，无须写大量网格点。眼窝、颊部、颌角、下巴等转折应拆成对应的小段，不能用一个跨越多个转折的长路径让弧长匹配猜位置。可以补少量 landmarks 稳住确实有对应的部位。

visible 是参考中看得见的轮廓，默认权重 1；occluded 是被头发等遮挡、由你补出的结构，默认权重 0.03。可按证据给 weight，但补全不能压过可见部分。程序会与仅可见描线的拟合比较；补全若使可见点移动超过 0.1 个原画布像素，自动减弱补全并返回 occludedWeightScale。completion 必填：part 对应脸底部件，source/target 是整张脸的闭合外轮廓，末尾 Z；用同一组分段拼接，覆盖遮挡区域。curves 必须落在各自完整轮廓上，不能描皮肤/头发内部交界。inspect 返回 completionMismatch；偏差超过 2 个当前坐标像素时 fit 拒绝保存。此检查只验证两套描线的一致性，仍由 agent 结合原画与先验判断完整脸型是否合理。

inspect 显示三联图：原画描线、目标描线、无遮挡完整 target 脸底；另返回 completionCheck 为完整 source/target 素脸双图。纯肤色填充是预测轮廓的检查图，不是生成贴图或实际形变结果。分别保存 trace-check.png、face-completion-check.png，拟合后用 view_nine_axis 单独看实际脸底。描线颜色：红色实线为可见，青色虚线为补全，黄色点为对应位置。检查 source 贴合导出的原画部件，target 贴合本步实际视频帧；发丝边界不是脸缘。五官可以继续一轮批量液化，不要求全部描线。

fit 只编辑选中节点的本步目标关键形，保留其父级、子级、其他节点和静止形。工具使用工作台同一个平滑 Warp 计算，处理父级坐标反解，验证已制作轴的端点与中间角度的组合网格再保存。失败不会写入作者文件。返回新 revision、逐段拟合前后平均/最大误差（原画布像素）、描线检查图，另保存 fit-report.json。误差小只说明网格贴住了描线；仍须用 view_nine_axis reference 核对描线是否贴住视频和整体效果。某段残差大时，检查对应点、拆段、增加合适的控制点或局部 Warp，再重拟合。

方向由管线步骤绑定：X 的 left 为 X=-left,Y=0；up 为 X=0,Y=+up；down 为 X=0,Y=-down。无需在工具参数重复填写方向。up/down 从本步完整作者文件拟合，保留来源和绘制顺序；down 额外保护上游的 up 姿态。

斜向 step06 的 inspect/fit 必须给 corner="left-up" 或 "left-down"，绑定本步同名 PNG 的 agent 已选视频帧和对应 X/Y 关键形；两角各自描边、补全与拟合。先用 preview_svg 显式指定该角参考图，保存独立 trace JSON。例：`{action:"fit",corner:"left-up",trace:"绝对路径/left-up-face-trace.json",id:"自选脸底Warp",revision:"最新inspect返回值"}`。不需要手填角度。fit 只调整这一个组合关键形，保留另一个左角和上游 X/Y；右侧由程序镜像组合结果。所选帧或描线变化后重新 inspect，不能沿用旧 revision。两角分别保存 left-up-fit-report.json、left-down-fit-report.json，避免覆盖。
