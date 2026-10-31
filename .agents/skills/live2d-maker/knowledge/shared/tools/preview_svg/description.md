渲染指定本地路径的独立 SVG 并返回图片。mode=svg 为白底独显，blend 为与绑定参考图半透明混合，edge 为红色边缘叠加；crop=[x,y,width,height] 使用原图像素坐标，scale=1..8。子组同时返回与绑定父 SVG 的范围检查结果，检查固定使用四倍采样，越界坐标和面积折算到原图。输入不修改。

先以 blend 查看整图，再用 crop 与 scale 分区放大，以 blend 和 edge 对照参考。crop 的四个数依次为 x、y、width、height；scale 是缩放倍数。mode=svg 可检查独显。子组可先查看已提供的父组完成稿。补全检查需要 sourceSvg 和 outputDraft；修改后重新查看当前草稿。

以下生成图对照参数仅在补全阶段开放。生图后使用 mode=edge、reference=生成图路径、referenceRegion=[x,y,width,height]，将 SVG 红色边缘叠加到生成图的对应部件上检查外形和比例。同姿态生成图整体对照边缘；转面生成图的姿态与原图不同，referenceRegion 只框选对应的局部，读取结构与比例，不要求边缘重合。referenceRegion 使用生成图自身像素坐标，尽量贴合部件边缘，默认整张生成图。工具自动取 SVG 全画布内实际可见内容的包围框，将生成图裁片保持宽高比等比缩放、居中对齐；SVG 文件与原坐标保持原样。referenceOffset=[dx,dy] 为对齐后的可选微调，默认 [0,0]，单位为原图像素，正值向右/向下，各轴范围为 SVG 部件宽/高的 10%。返回对齐范围、实际倍率和偏移，供核对形状差异。

referenceRegion 决定生成图中哪个部件参与对齐；crop 决定最终预览显示原图坐标中的哪一块区域，保持对齐结果。生成图对照默认聚焦 SVG 部件，可直接省略 crop；需要细看时再用 crop 与 scale 放大观察。

随后省略 reference、referenceRegion 和 referenceOffset，用 mode=blend 直接叠加到绑定的人物/衣服参考图上，检查真实大小、位置和邻接。生图后的自查分别完成生成图 edge 对照（同姿态整体、转面只框局部）、默认参考图 blend 定位及 SVG 独显；修改 SVG 后重新检查当前草稿。
