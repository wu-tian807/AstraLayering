# 衣服分层绘画记录

结论：completed。已完成10个逻辑衣片、15个普通绘画深度分片和5个原生透明度蒙版；逐层独显、隐藏上层检查补全区、合成参考对照及保存后重开检查通过。

工程：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra，画布1086×1448，RGBA/U8。透明背景，只含衣服。图层自下而上按深度递增，不含身体层或背景层。

输入依据：

- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/groups.json
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/parts/
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/references/clothing.png
- D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/part-layering/references/simplified-subject.png

上游 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-part-layering/occlusion.json 已通过 edit_occlusion 更新，10个终止ID不变，15个深度区域与KRA一致。未改变逻辑分组或SVG，故未调用 edit_groups。

## 生成、修整与复用

每个生成基底均使用独立的三色控制图：红色为本件可见内容、黄色为本件补全、绿色为透明外部。输入遮挡物及外部抹为中性灰。控制图、输入图与配准记录保存在 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/controls/ 和 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/workspace/manifest.json。

实际独立生成7个基底：白衣身、裙身、腰头、画面右肩带、画面右结翼、画面右带尾、中央结心。中央结心另外局部重生一次，以平滑SVG控制图修复初版从小图复制出的台阶形侧缘。其余3件在Krita中镜像复用，按各自SVG范围分别配准；没有合并左右控制职责。

- camisole/right_shoulder_strap ← camisole/left_shoulder_strap。
- chest_bow/right_loop ← chest_bow/left_loop。
- chest_bow/right_tail ← chest_bow/left_tail。

配准保留生成画面整体，只提取独立主体并清除透明外部孤立杂点，外圈描边保留约1px配准余量。白衣身中央补成同一白色布面，领口连接线连续，去除蝴蝶结及其投影；下摆补全为白布，不混入黑腰头。裙身仅在y720–850的上根区作平滑局部配准，修正生成根部在腰头两侧外露，未整片填色；操作后分别查看独显与腰部合成。后裙侧接的低透明度远端下摆残影已清除。所有修整均保留本片原生材质、明暗及细线。

## 原part、实际图层和深度

前后转折在二维投影中允许重合，前片保留完整可见轮廓；背片只保存现有形体所需的连接，不另造背视衣服。

|原part ID|深度|实际图层名|图层UUID|区域与原因|
|---|---:|---|---|---|
|pleated_skirt/skirt_body|1|D01__pleated_skirt/skirt_body__rear|{af8e56aa-2234-4292-b10b-373647498880}|裙身两侧外缘向内约12px，y721–1237；必要后向连接，默认蒙版隐藏。|
|pleated_skirt/waistband|2|D02__pleated_skirt/waistband__rear|{2a07e5b5-f8b4-4d33-aa97-d822b502c1a9}|腰头左右端 x352–362 / x720–730 的后转连接；默认蒙版隐藏。|
|camisole/right_shoulder_strap|3|D03__camisole/right_shoulder_strap__rear|{1e0a5dbd-95f8-45dd-95cb-dbb399bdf75f}|画面左肩带 y167–185 肩顶背向顶帽；默认蒙版隐藏。|
|camisole/left_shoulder_strap|4|D04__camisole/left_shoulder_strap__rear|{2b5b4e2a-9199-44f6-b95f-5d69f8712c13}|画面右肩带 y167–185 肩顶背向顶帽；默认蒙版隐藏。|
|camisole/right_shoulder_strap|10|D10__camisole/right_shoulder_strap__front|{300a2f84-bdf7-4d6f-9177-e001fd030b3e}|画面左完整前肩带；根部搭接延至y328，在衣身12后。|
|camisole/left_shoulder_strap|11|D11__camisole/left_shoulder_strap__front|{6b123705-b765-41d6-a721-cb070e43a5d3}|画面右完整前肩带；根部搭接延至y328，在衣身12后。|
|camisole/bodice|12|D12__camisole/bodice__full|{6fa2babc-28ce-47da-913e-e3219416d00a}|完整胸腹衣身、连续荷叶边、下摆至y730；肩带前、蝴蝶结及腰头后。|
|pleated_skirt/skirt_body|13|D13__pleated_skirt/skirt_body__front|{8bcc4f36-818b-4d40-94b6-0ce0345a3ed5}|全部可见裙面、褶根及错落下摆至y1324；腰头14后，保留前面完整投影。|
|pleated_skirt/waistband|14|D14__pleated_skirt/waistband__front|{e98d938c-061c-4535-82b4-ecd090dded1d}|完整可见前腰头；覆盖白衣下摆及裙根，接缝由真实前景覆盖。|
|chest_bow/center_knot|15|D15__chest_bow/center_knot__rear|{4ab5ad9d-4ee5-45dc-8442-c3452a6ae458}|完整束结背向连接投影；在翼尾根部16–19后，默认蒙版隐藏。|
|chest_bow/right_tail|16|D16__chest_bow/right_tail__full|{b62c8330-3872-40a6-9a16-6bf1242e52e7}|画面左完整带尾，含隐藏根部；在同侧结翼18及结心20后。|
|chest_bow/left_tail|17|D17__chest_bow/left_tail__full|{ba8fb229-834b-45df-a64a-f1dce9b081c7}|画面右完整带尾，含隐藏根部；在同侧结翼19及结心20后。|
|chest_bow/right_loop|18|D18__chest_bow/right_loop__full|{400d169d-8f42-4d1e-a079-f430a866737a}|画面左完整结翼及同体折返；带尾16前、结心20后。|
|chest_bow/left_loop|19|D19__chest_bow/left_loop__full|{e6dd8124-61a5-40ea-a423-2ba04bf83da7}|画面右完整结翼及同体折返；带尾17前、结心20后。|
|chest_bow/center_knot|20|D20__chest_bow/center_knot__front|{21218d8d-9965-41de-b7db-cc20150450f8}|完整可见结心正面；覆盖四个翼尾根部，侧缘连续转向背区15。|

## 原生显隐控制

groups.json没有hiddenInReference=true的终止节点；上游指定的五个默认不可见背向区域仍分别保留原生透明度蒙版。蒙版均名为 default-hidden__rear-connection，直接附着对应绘画层，不依赖额外身体图层或剪贴组。底层纹理完整保留，默认全黑蒙版启用，绘画层自身仍可见。

|所属绘画层|蒙版UUID|控制范围|检查结果|
|---|---|---|---|
|D01__pleated_skirt/skirt_body__rear|{ff91a1f8-1f36-4a0a-90b4-6651a8818f9b}|裙身两侧外缘向内约12px，y721–1237；必要后向连接，默认蒙版隐藏。|独显时启用蒙版完全透明；禁用蒙版恢复本片纹理；重开后再次通过。|
|D02__pleated_skirt/waistband__rear|{026dfc5e-1068-4464-a7cd-47dedd5c161e}|腰头左右端 x352–362 / x720–730 的后转连接；默认蒙版隐藏。|独显时启用蒙版完全透明；禁用蒙版恢复本片纹理；重开后再次通过。|
|D03__camisole/right_shoulder_strap__rear|{a9e70fed-b354-476a-bdce-1c6667ced5cf}|画面左肩带 y167–185 肩顶背向顶帽；默认蒙版隐藏。|独显时启用蒙版完全透明；禁用蒙版恢复本片纹理；重开后再次通过。|
|D04__camisole/left_shoulder_strap__rear|{82b5278c-9092-4602-982b-466b395499e8}|画面右肩带 y167–185 肩顶背向顶帽；默认蒙版隐藏。|独显时启用蒙版完全透明；禁用蒙版恢复本片纹理；重开后再次通过。|
|D15__chest_bow/center_knot__rear|{ea4e8840-443e-48fe-bc54-d746e657ac4d}|完整束结背向连接投影；在翼尾根部16–19后，默认蒙版隐藏。|独显时启用蒙版完全透明；禁用蒙版恢复本片纹理；重开后再次通过。|

肩带前根部、白衣下摆、裙根和蝴蝶结四根部，均通过实际前景衣片覆盖隐藏搭接，没有删除其底层像素。没有把他件投影烘焙进布面。纱料不存在；领口和带尾之间的真实开口保持透明。

## 看图验收

- 15个绘画层逐一独显；背向层检查时禁用其原生蒙版，检查后恢复默认隐藏。白衣中央及下摆、肩带底根、蝴蝶结汇合根部和裙根的隐藏延续均已查看。
- 纯衣服参考并排检查形体、颜色、褶线、弧形下摆；对照原穿衣角色确认肩带和裙腰的前后转折职责。当前衣服没有袖子，肩带为收拢的实布窄带。
- 放大检查左右肩带/领缘、中央结心/翼尾、衣身/腰头、腰头/裙根。接缝没有可见空隙、外露补全根部、异色拼贴或外件鬼影。
- 与色块范围的差异限于生成绘画细边及约1px的配准余量；上裙根已经按本片范围局部校正。未发现未解决的归属或层级冲突。参考中蝴蝶结在白衣上的投影按要求移除，属于有意差异。











## 保存与重开

已实际关闭 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/clothing-depth.kra 并重新打开，等待加载完成后核对15个绘画层名称、UUID、排序、像素和5个蒙版的UUID、显隐及选区内容，均与保存前一致；合成像素也一致。该一致性核对只验证保存无损，画面质量通过上述看图检查判断。重开后再次逐个切换5个蒙版，默认投影均为空、禁用后均恢复纹理，最终保存蒙版启用状态并导出透明合成PNG。

重开核对证据：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/reopen-verification.json。
透明合成PNG：D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/evidence/composite.png。

过程故障已恢复：首次用通用节点方式创建蒙版后保存时，Krita返回 “Windows fatal exception: access violation”，退出码3221225477。生成基底与配准记录均已保留；通过krita restart重启，改用原生createTransparencyMask和Selection创建蒙版，随后保存、重开及蒙版检查全部成功。当前无工具阻塞。

## review-01 修复完成

R1、R2、R3 已全部修复。修复基于既有生成绘画，在原绘画层用Krita原生画笔逐笔恢复细描边：

- R1：D16/D17带尾长边和斜切端、D18/D19结翼外缘、D20结心侧缘及同源D15背向束结；保持缎带布面、内壁、隐藏根部和白衣无投影。
- R2：D10画面左肩带肩顶与外侧长边，及D03对应背向顶帽。
- R3：D11画面右肩带肩顶与外侧长边，及D04对应背向顶帽。

每个修改分片均已查看单层、隐藏上层、整图三个视图；肩带和结心的前后分片另经蒙版两态合看，未出现双线或分界横线。当前15层、UUID、深度和5个原生蒙版不变，所有层透明度与修前一致；D01/D02/D12/D13/D14未修改。本次无结构变更，SVG与上游分层表继续有效。

验收PNG已从修后工程更新，本文上方图像链接均指向当前结果。KRA已保存后关闭、重开，逐层像素、结构、蒙版及合成均无变化，5个背向蒙版恢复启用状态。

逐项记录暂存于 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-01.md.tmp，由调度器发布；重开证据为 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-evidence/repair01/reopen-verification.json。







## review-02 修复完成

本轮R1已修复：D12的左腰隐藏补全侧缘沿D14既有遮挡边界平滑向内收进约3px，浅色并行细边及末端突起已完全藏入腰头后。仅局部配准同片现有绘画，边线与明暗一同接顺，没有裁掉隐藏搭接或用黑色覆盖白布；约y730的完整下摆保留。

已检查D12单层、隐藏上层、单独隐藏腰头及全衣合成，并复查蒙版启用/停用两态。左腰只剩参考要求的腰头侧缘，独显布面连续无缺口。D14及其余14层像素未变；上一轮描边修复完整保留。

图层/UUID/深度与5个原生蒙版均不变，本次无需修改上游结构。当前KRA保存后已关闭并重新打开，图层、像素、蒙版和合成均无变化；默认背向蒙版已恢复启用。验收PNG和本文原有当前图像链接已更新。

本轮逐项记录暂存于 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-02.md.tmp，由调度器发布；核对证据为 D:/Resources/workspace/AstraLayering/.run/black-white-doll-sol-20261116/clothing-raster-layering/step01/repair-evidence/repair02/reopen-verification.json。
