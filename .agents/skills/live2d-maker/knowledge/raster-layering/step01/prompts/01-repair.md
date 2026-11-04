根据 raster-layering/step01/review-0{review_round}.md 修复当前的 raster-layering/step01/character-depth.kra。

## 目标

- review 列出的每个问题都修好。修的过程中自己发现的其他问题也一并修好。
- 修完后要达到第一步的目标：
  - 每个部件独显都连续、完整、干净，轮廓、描边和结构线完整。
  - 原图中可见的内容没有缺失或断开，原生接缝处看不出拼接。
  - 摆放与层级与原图相符。
  - 整只眼睛和原图相比没有严重失真，没有多出原图没有的线条。
- 需要重画的部件，先用 imagegen 按三色控制图生成，再用画笔补画。

## 要保护的

- 部件归属：每层只含本部件自己的内容。
- 不画由其他部件投下的投影；部件自身的明暗与材质可以保留。

## 结构变更

需要调整分层时，同步修改上游分层数据和当前工程，并在 raster-layering/step01/report.md 记录依据和结果。

## 交付

1. 每处修改都检查三个视图：单层、隐藏上层、整图。
2. 保存 KRA，重新打开，核对图层和像素没有变化。
3. 更新 raster-layering/step01/character-depth.png 和 report.md。
4. 把逐项处理结果、证据和重开检查写入 raster-layering/step01/repair-0{review_round}.md.tmp。第一行写“结论：已修复”或“结论：仍有问题”。全部问题都修好并自检通过，才写“已修复”。
