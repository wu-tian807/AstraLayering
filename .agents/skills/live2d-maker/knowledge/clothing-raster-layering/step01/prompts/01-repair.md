根据 clothing-raster-layering/step01/review-0{review_round}.md 修复当前的 clothing-raster-layering/step01/clothing-depth.kra。

## 目标

- review 列出的每个问题都修好。修的过程中自己发现的其他问题也一并修好。
- 修完后要达到第一步的目标：
  - 每个衣片独显都连续、完整、干净，画面来自生成结果、画笔笔触或参考取样，形状、轮廓与线条、颜色和明暗与参考一致。
  - 参考中可见的内容没有缺失或断开，原生接缝处看不出拼接。
  - 摆放与层级与参考相符；袖子、领口按穿着时的样子画。
- 需要重画的地方，按第一步的流程优先用三色控制图重新生成；生成解决不了的，用 Krita 画笔一笔一笔地画。

## 要保护的

- 衣片归属：每层只含本衣片自己的内容，不画入人体，已拆开的前后衣片不合层。
- 纱料透明度和正常开口。
- 不画由其他部件投下的投影；衣料自身的明暗与褶皱可以保留。

## 结构变更

需要调整分层时，同步修改上游分层数据和当前工程，并在 clothing-raster-layering/step01/report.md 记录依据和结果。

## 交付

1. 每处修改都检查三个视图：单层、隐藏上层、整图。
2. 保存 KRA，重新打开，核对图层和像素没有变化。
3. 更新用于验收的 PNG 和 clothing-raster-layering/step01/report.md。
4. 把逐项处理结果、证据和重开检查写入 clothing-raster-layering/step01/repair-0{review_round}.md.tmp。第一行写“结论：已修复”或“结论：仍有问题”。全部问题都修好并自检通过，才写“已修复”。
