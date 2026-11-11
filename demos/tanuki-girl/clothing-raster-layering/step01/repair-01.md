结论：已修复

# repair-01 衣服分层返修

依据 clothing-raster-layering/step01/review-01.md 修复 clothing-raster-layering/step01/clothing-depth.kra。R1–R9 全部修复并自检通过；修复过程中发现的接回台阶、重复边线、点状残线、透明外部淡孤岛也已处理。最终交付 18 逻辑衣片、25 普通绘画层、4 原生透明度蒙版；无新增人体或临时补片层。

每项证据图从左到右为参考、所属层独显、隐藏本深度以上全部层、最终整图。R1 对 d13/d14 分别核对，R4 对 d11/d18 分别核对。全画面原尺寸来源位于 clothing-raster-layering/step01/repair-evidence/repair-01/raw、clothing-raster-layering/step01/repair-evidence/repair-01/cumulative、clothing-raster-layering/step01/repair-evidence/repair-01/full；所有证据刷新为最终保存状态。

## R1：领缘白缝 — 已修复

- 原 part：`kimono_body/right_underlap_panel`；实际层：`d13 | kimono_body/right_underlap_panel | complete front cloth and outline`；UUID：`{4fd109d2-d07b-4499-a67f-622d91dc1f4a}`；最终深度：13。
- 原 part：`kimono_body/left_overlap_panel`；实际层：`d14 | kimono_body/left_overlap_panel | complete front cloth and outline`；UUID：`{794546ce-ec7e-418d-bf0e-005e4d8cb8f8}`；最终深度：14。

处理：原生续画 d13 自身深紫领缘、两条粉线和外线，局部修顺 d14 交叠下缘；最终发现的修笔起点凸点用原生局部选区收边与细线接顺。

自检：白缝消除，双粉线与补全领缘连续；d14 起点无小凸点或台阶，未带入外襟或人体像素。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。







## R2：左后垂片草叶 — 已修复

- 原 part：`rear_drape_screen_left`；实际层：`d01 | rear_drape_screen_left | complete`；UUID：`{a9feb87a-9ee2-4b4d-b3d7-a03b3024d30a}`；最终深度：1。

处理：按左侧三色控制局部生成，仅替换草叶及其原位置料面。

自检：三条草叶的端点、长度及弧度已修回；原花朵、根、浅翻面、底框和外缘保留，无旧草叶鬼影。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。



## R3：右后垂片花草 — 已修复

- 原 part：`rear_drape_screen_right`；实际层：`d02 | rear_drape_screen_right | complete`；UUID：`{9c9872c9-d447-4bd9-9941-ab54b40a9f26}`；最终深度：2。

处理：两次三色生成仍有纹样偏移/翻面误读，恢复原层后按本侧衣料参考局部取样；y1200–1320 配准自身翻边、褶面并原生蒙版接回。

自检：两朵花的大小、位置和瓣形及草叶弧度恢复；下轮廓漂移修回，旧花影和外部淡孤岛清除；接回处无深色台阶、双边或横向色块。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。





## R4：金带外线与明暗 — 已修复

- 原 part：`outer_waist_band`；实际层：`d11 | outer_waist_band | both side/back returns y670-781`；UUID：`{65216b2a-3cd0-4d40-af02-b38d60c8e6e5}`；最终深度：11。
- 原 part：`outer_waist_band`；实际层：`d18 | outer_waist_band | complete front cloth and outline`；UUID：`{ae256aa9-e4ce-4bb4-9a3e-93a59812d17e}`；最终深度：18。

处理：局部三色重生恢复深色外线、平缓金/金褐面；保留原正确隐藏料，d11 同坐标 RGB 同步 d18，原 alpha 和区域不变。

自检：亮黄环形反光已去掉，侧边/下边线连续；前幅和后返条接色一致，隐藏结芯和前绳后仍为完整金料，无结绳投影。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。





## R5：左自由绳色带与轮廓 — 已修复

- 原 part：`front_pendant_screen_left/right_free_cord`；实际层：`d19 | front_pendant_screen_left/right_free_cord | complete`；UUID：`{354894aa-d98d-4480-bc14-1c9f2d3f2f4e}`；最终深度：19。

处理：独立按左侧三色生成，完整绳形等比缩小配准，原生续深色外线；根/尾旧纹样和残影清除。

自检：稀疏长粉白带沿同一绳身连续，结下根与珠内插入端完整，绳珠接点清净。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。



## R6：右自由绳色带与轮廓 — 已修复

- 原 part：`front_pendant_screen_right/left_free_cord`；实际层：`d20 | front_pendant_screen_right/left_free_cord | complete`；UUID：`{effe9c2e-9005-4a3f-848d-d1f07a973fff}`；最终深度：20。

处理：独立按右侧三色生成，等比缩小配准并原生续深色轮廓；不采用 R5 镜像替代。

自检：本侧长粉白色带连续，根与珠内插入段保留；两绳间距及独立层不变。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。



## R7：左流苏外线 — 已修复

- 原 part：`front_pendant_screen_left/right_tassel`；实际层：`d21 | front_pendant_screen_left/right_tassel | complete`；UUID：`{7791f227-c497-4af3-9f76-a64da8534aff}`；最终深度：21。

处理：Krita 原生 2.25px 深色笔触沿本片两侧及弧底续画。

自检：两侧/弧底深线连续，束根与珠体接顺；白粉束纹保留，未复制流苏在衣面上的投影。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。



## R8：右流苏外线 — 已修复

- 原 part：`front_pendant_screen_right/left_tassel`；实际层：`d22 | front_pendant_screen_right/left_tassel | complete`；UUID：`{5bd96b03-31e5-40fd-9bad-c7f8d85e3f14}`；最终深度：22。

处理：按右片自身轮廓原生续画深色两侧及弧底，保留内部束纹。

自检：本侧外线完整，珠后束根自然衔接，无新增粗黑色块或衣面投影。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。



## R9：下摆新增斜褶 — 已修复

- 原 part：`kimono_body/left_overlap_panel`；实际层：`d14 | kimono_body/left_overlap_panel | complete front cloth and outline`；UUID：`{794546ce-ec7e-418d-bf0e-005e4d8cb8f8}`；最终深度：14。

处理：三色局部生成平缓白/淡紫料面；保留原上褶、金花、双粉线及真实底缘。保护本层外线后接回，原生细笔清除襟边点状残线。

自检：新增斜向折线和深灰紫三角面去掉，浅料过渡连续；接回时出现的重复边线与原有点状残线均清理，下摆没有硬边补丁。独显、隐藏上层及整图均已看，所属层整圈轮廓和补全区连续、干净。





## 追加问题、归属和上游同步

- R1 的 d14 修笔起点在独显中形成小凸点，最终局部收边并原生续顺细线；单层、隐藏上层及整图复查无凸点或新增白缝。
- R3 的 y1200–1220 初次接回形成深色台阶，已重新按翻边内缘、褶面和外缘配准，并延长同料过渡至 y1320；最终三视图无硬台阶或双线。原隐藏根及上段生成画面保留，下段取样只含本侧后垂片。
- R9 初次补片带入重复下摆/襟内边线，已恢复本片原边再局部接回；原点状细线用原生笔触清掉，真实外线与金花未移位。
- d02/d18 透明外部淡孤岛及 d14 一个淡点用原生选区清除，主轮廓抗锯齿保留。最终独显及合成复查无新增外缘杂点。
- 18 个终止 ID、父子归属、各深度对象均保持；前后衣片未合层。edit_occlusion 已同步有效画面范围、R3 同片接回区、R6 独立生成来源和最终检查依据；深度仍为 1–25，groups.json 与 SVG 无需变更。
- 没有待处理的色块图归属或层序冲突。袖口保持原穿着参考的收拢布边，4 原生蒙版完整底纹保留；真正领口/绳环开口透明，不填人体或其他衣片，不画外物投影。

完整 part、实际图层名/UUID、区域、最终深度及原因已更新于 clothing-raster-layering/step01/report.md。选定生图、三色输入及 R3 本片取样来源：[generation-provenance.json](clothing-raster-layering/step01/repair-evidence/repair-01/generation-provenance.json)。

## 全衣片与蒙版自检

25 深度层独显、18 同 part 合成（蒙版 off/on）、隐藏上层累计及整图参考对照均已检查；领口、袖口、腰带回折、绳珠、流苏、金花、下摆和后垂片底角另看原尺寸与放大。未发现未处理缺口、拼贴色块、鬼影、额外投影、断线或接缝台阶。

4 个蒙版逐个停用/启用检查，最终全部启用；所属层/UUID及区域详见更新的绘画报告。d05/d12 关闭蒙版可恢复完整后结根/后返绳，启用默认隐藏；d08/d09 关闭可见完整远壁与内壁，启用显示收拢穿着范围。底纹未删，默认状态与重开状态一致。











## 保存重开及交付

最终 KRA 保存后关闭，由同一 section 的 Krita 重新打开，等待文档与投影完成后比较：

- 25 绘画层、4 原生蒙版的名称、UUID、顺序、类型、显隐、透明度全部一致。
- 25 层全部绘画缓冲和 4 蒙版选区缓冲一致，画布尺寸、色彩属性及整图投影一致。
- 重开默认合成已看；无图层或像素丢失。缓冲比较只验证保存完整性，绘画质量由上述三视图看图确认。

重开证据：[reopen-integrity.json](clothing-raster-layering/step01/repair-evidence/repair-01/reopen-integrity.json)；最终层/原尺寸索引：[final-inspection-manifest.json](clothing-raster-layering/step01/repair-evidence/repair-01/final-inspection-manifest.json)。



已更新：clothing-raster-layering/step01/clothing-depth.kra、clothing-raster-layering/step01/clothing-depth.png、clothing-raster-layering/step01/report.md 以及最终验收证据。本返修报告仅写入 clothing-raster-layering/step01/repair-01.md.tmp，没有自行写正式 repair/review 或运行标记。没有阻断继续工作的必要输入缺失、损坏或工具故障。
