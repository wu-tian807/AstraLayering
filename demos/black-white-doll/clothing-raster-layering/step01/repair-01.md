结论：已修复

已逐项处理 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/review-01.md 的 R1、R2、R3，保存 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra，完成每个修改分片的单层、隐藏上层、整图检查，以及前后分片合看、蒙版开关和保存后重开核对。检查中未发现新的未解决问题。

## R1 — 蝴蝶结自身深色外缘描边

处理结果：已修复。范围为原画布 [454,365,179,180]。在原生成画面上用 Krita 原生 b) Basic-1 画笔沿各片既有外缘逐笔补线：

- D16、D17：恢复两条带尾的两侧长边和斜切末端，边线一直延到本片隐藏根部，转角接通。
- D18、D19：恢复结翼上缘、外端及外轮廓，与原有折返边缘接顺；完整暗面和内壁保留。
- D20：恢复结心平滑侧缘和周圈细边；D15 背向结心在同样坐标使用同一笔触同步处理，原生蒙版保留。

使用近黑色 #17141c，画笔配置2.2px（翼尾）、2.0px（结心），锁定原有透明度沿边绘画。该数值是画笔配置，最终线宽和深浅通过原尺寸参考及放大对照判断。原有缎带渐变、褶皱、隐藏根部和五件独立层序保留；两带尾间开口透明，白衣上没有加入蝴蝶结投影。汇合合成未见双重外缘。



逐片三视图（左单层、中隐藏上层、右整图）：

- [D16 画面左带尾](repair-evidence/repair01/R1-D16-three-views.png)
- [D17 画面右带尾](repair-evidence/repair01/R1-D17-three-views.png)
- [D18 画面左结翼](repair-evidence/repair01/R1-D18-three-views.png)
- [D19 画面右结翼](repair-evidence/repair01/R1-D19-three-views.png)
- [D20 结心正面](repair-evidence/repair01/R1-D20-three-views.png)
- [D15 背向结心](repair-evidence/repair01/R1-D15-three-views.png)
- [结心前后分片合看，蒙版启用/停用](repair-evidence/repair01/R1-combined-check.png)

## R2 — 画面左肩带肩顶及外侧轮廓

处理结果：已修复。针对 [373,167,39,143]，在 D10 的圆弧肩顶及画面左侧长边，以原生 b) Basic-1 画笔补回连续深色细线；外侧边线继续进入至y328的本件隐藏根部。D03 顶帽使用相同坐标、颜色和笔触同步修复，前后独立层及蒙版不变。

以 #403748、2.4px画笔配置沿现有边缘局部描画，锁定原有透明度。保留白布渐变及带内折转线。三视图检查确认窄带形体和位置保持、领缘衔接没有外露根部；前后合看及蒙版开关时肩顶没有重复线或横向分界线，默认背向蒙版启用。



- [D10 前段三视图](repair-evidence/repair01/R2-D10-three-views.png)
- [D03 背向顶帽三视图](repair-evidence/repair01/R2-D03-three-views.png)
- [前后分片合看，蒙版启用/停用](repair-evidence/repair01/R2-combined-check.png)

## R3 — 画面右肩带肩顶及外侧轮廓

处理结果：已修复。针对 [677,167,39,143]，在 D11 的圆弧肩顶和画面右侧长边恢复连续深色细线，接至本件完整隐藏根部；D04 顶帽同步处理。使用与R2协调的原生画笔、线色和画笔配置，并按本侧现有曲线独立落笔。

单层、隐藏上层、整图及蒙版两种状态均已查看。白布渐变、带内折线、窄带比例、位置、领缘搭接及领口开口保留；顶帽与前段合看没有双线、断线或深度分界横线。



- [D11 前段三视图](repair-evidence/repair01/R3-D11-three-views.png)
- [D04 背向顶帽三视图](repair-evidence/repair01/R3-D04-three-views.png)
- [前后分片合看，蒙版启用/停用](repair-evidence/repair01/R3-combined-check.png)

## 修改范围、归属和结构

本次是既有生成绘画外缘的局部原生画笔返修，未重画布面。共修改下表10个绘画分片；10个逻辑part、15个深度分片、图层名称/UUID/排序及5个原生透明度蒙版均保持。无需调整SVG、groups.json或occlusion.json，现有上游记录与工程一致。

|原part ID|实际图层名|UUID|深度|
|---|---|---|---:|
|camisole/right_shoulder_strap|D03__camisole/right_shoulder_strap__rear|{1e0a5dbd-95f8-45dd-95cb-dbb399bdf75f}|3|
|camisole/left_shoulder_strap|D04__camisole/left_shoulder_strap__rear|{2b5b4e2a-9199-44f6-b95f-5d69f8712c13}|4|
|camisole/right_shoulder_strap|D10__camisole/right_shoulder_strap__front|{300a2f84-bdf7-4d6f-9177-e001fd030b3e}|10|
|camisole/left_shoulder_strap|D11__camisole/left_shoulder_strap__front|{6b123705-b765-41d6-a721-cb070e43a5d3}|11|
|chest_bow/center_knot|D15__chest_bow/center_knot__rear|{4ab5ad9d-4ee5-45dc-8442-c3452a6ae458}|15|
|chest_bow/right_tail|D16__chest_bow/right_tail__full|{b62c8330-3872-40a6-9a16-6bf1242e52e7}|16|
|chest_bow/left_tail|D17__chest_bow/left_tail__full|{ba8fb229-834b-45df-a64a-f1dce9b081c7}|17|
|chest_bow/right_loop|D18__chest_bow/right_loop__full|{400d169d-8f42-4d1e-a079-f430a866737a}|18|
|chest_bow/left_loop|D19__chest_bow/left_loop__full|{e6dd8124-61a5-40ea-a423-2ba04bf83da7}|19|
|chest_bow/center_knot|D20__chest_bow/center_knot__front|{21218d8d-9965-41de-b7db-cc20150450f8}|20|

所有绘画层的透明度与修前一致，开口及衣片范围保持。未修改的 D01、D02、D12、D13、D14 像素与修前完全一致。检查未发现新的归属、层级或补全问题。散列比较仅用于核对保存和保护项，不代替看图验收。

## PNG、记录及重开

已更新当前 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/report.md，保留原始图层映射并追加本轮修复结果。用于验收的透明合成PNG及原报告引用的逐层、对照、接缝PNG均已由当前KRA重新导出：

- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/composite.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/comparison.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/junctions.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/solo-large.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/solo-small.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/rear-mask-disabled.png



已实际关闭并重新打开 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra，等待加载完成后核对15层的名称、UUID、排序、可见性、像素及5个蒙版的内容/状态；保存前后全部一致，合成像素也一致。重开后再次逐个切换5个蒙版，默认背向投影为空，停用后恢复本片纹理，最终均恢复启用并保存。

重开核对：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-evidence/repair01/reopen-verification.json。
完整三视图清单：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-evidence/repair01/inspection-manifest.json。
原生画笔路径和配置：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/repair01/R1-actions.json、D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/repair01/R2-actions.json、D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/repair01/R3-actions.json。
修前工程保留在 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/repair01/before.kra，仅作为回退副本。

本轮无未解决工具故障，无遗漏的review问题。
