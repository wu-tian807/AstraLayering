# 第二步：整图检查与衣片精修

交付：`clothing-soft-edges.kra`，1115 × 1410，透明背景。已完成本轮看图验收；未发现未解决的验收问题。

只读输入为 `clothing-raster-layering/step01/clothing-depth.kra`。首次打开后另存到本步 `workspace/clothing-working.kra`，各批修画均保存，最终另存正式工程。第一步工程、报告、上游 SVG、groups.json、occlusion.json 均未改写。

## 整图检查与问题清单

先查看纯衣服参考、穿衣角色及当前默认合成，再并排放大领口、两袖、胸腹、腰裙连接和裙摆。原始检查图：[领口](evidence/check-neck.png)、[画面左袖](evidence/check-left-sleeve.png)、[画面右袖](evidence/check-right-sleeve.png)、[胸腹与腰](evidence/check-torso.png)、[裙摆](evidence/check-skirt.png)。左右画面方向与角色方向相反，下表以实际层名定位。

| 编号 | 发现的问题、区域（原画布坐标） | 所属绘画层 | 实际处理与复查结果 |
| --- | --- | --- | --- |
| R1a | 画面左袖青带上缘约 (214,520)–(365,632)，原细线有阶梯、浓淡不均，接边显得粗糙 | `outer_jacket/right_sleeve \| near \| d33` | Krita Basic-2 Opacity，4.8 px 青蓝笔，顺白布与青带的弧形接边逐笔重接。保留白布褶面与青带主体。独显和合成均只保留一条连续接边。 |
| R1b | 同袖口尖端约 (318,638)–(346,653)，青料内有小暗点，透明边末端带小折齿 | d33 | 3.2–5 px 本袖青色笔局部融色、整理末端曲率。远内壁 d7 不动；合看仍保留狭长透明开口，内壁和近袖带在两端相接。 |
| R2a | 画面右袖窿约 (788,465)–(808,610)，深色接缝中有断续白亮点，形成参考没有的虚线 | `outer_jacket/left_sleeve \| near \| d32` | 5.2 px 深蓝笔沿本袖缝线接顺，临时锁定 alpha，末端收在原缝内。独显无亮点串，合成袖窿连续，没有平行新线。 |
| R2b | 画面右肩外缘约 (813,386)–(817,390) 有短突刺 | d32 | 3.2 px 局部橡皮笔削去外侧短刺。未动袖身布面或肩根隐藏搭接。独显及合成外轮廓顺接。 |
| R3 | 画面右前衣片开襟约 (698,551)–(706,597)，布面侧深边局部有小块状台阶 | `outer_jacket/jacket_body/left_front/front_panel \| complete \| d34` | 2.6 px 浅白笔沿本片布面侧接边整理。保持原外轮廓、深边渐变、扣翼遮挡与贯通开襟；独显没有混入扣翼或衬衫。 |
| R4 | 画面右白翻领斜边至领尖约 (697,324)–(755,403)，包边内缘过渡粗硬，青色与邻接蓝边的浓淡不够协调 | `outer_jacket/jacket_collar/left_collar_flap \| near \| d38` | 3.2 px 青蓝窄笔及 1.5 px 浅青低透明度笔，局部修主边和布面侧过渡。保留原底纹、根部渐变与下缘亮边；独显、与 d4 合看及合成无缺段，领尖与独立驳头仍接顺。 |
| R5 | 复查中发现画面左肩约 (348,343)–(352,338) 外缘短刺 | d33 | 2.3 px 局部橡皮笔整理短刺，原肩顶与本片青料保留。独显和合成均复查，袖根仍由 d35 自然遮挡。 |

修线试笔曾出现 R1 双线、R2 末端延伸过长、R4 包边过于均匀及 R5 外侧细痕，均已在独显／合成检查后恢复本片原像素并重做，试版不进入最终工程。恢复只用于撤回本轮试笔；最终修改使用 Krita 原生绘画笔与橡皮笔，未采用参考逐像素改色、全层模糊、全局羽化或公式批量修复。

## 修复前后局部对照

每张四格对照上排是默认合成、下排是所属片独显，左为修前、右为该项确认后的画面；放大 3 倍。独显原尺寸 PNG 保留全部画布，可用于 100% 查看。局部证据是在各项确认时导出的，最终整图见后文。

R1a／R1b：袖带接边及尖端。原袖青料与修画颜色连续，正常孔洞和实际内壁保留。



[近片原尺寸](evidence/R1/d33-solo.png) · [远内壁原尺寸](evidence/R1/d7-solo.png) · [最终同片合看](evidence/logical-parts/part-07.png)

R2a：袖窿亮点串。



R2b：肩外缘短刺。



[近袖原尺寸](evidence/R2/d32-solo.png) · [远内壁原尺寸](evidence/R2/d6-solo.png) · [相邻前片](evidence/R2/d34-solo.png) · [最终同片合看](evidence/logical-parts/part-06.png)

R3：前襟布面侧的小台阶。



[前衣片原尺寸](evidence/R3/d34-solo.png) · [独立驳头](evidence/R3/d36-solo.png)

R4：翻领包边的窄笔修整。



[前领原尺寸](evidence/R4/d38-solo.png) · [远根原尺寸](evidence/R4/d4-solo.png) · [最终同片合看](evidence/logical-parts/part-04.png)

R5：复查发现的左肩短刺。



[近袖原尺寸](evidence/R5/d33-solo.png) · [相邻前片](evidence/R5/d35-solo.png)

## 整图、独显和结构验收

最终并排查看衣服与参考，放大复看上述位置及相邻片连接。白布亮面、浅蓝褶皱、青带体积、深蓝门襟和裙褶总体接近参考；口袋边、固定标识、扣带及方扣连贯。领带保留既有完整折面和细边；本轮检查未把其正常折角判为瑕疵。裙腰与衣身、裙前后摆、横向青纹及纵向褶线连接没有新断线或额外拼接线，保留原样。

参考中的纯衣服袖口与本工程穿着时的收拢口宽度有差异；结合穿衣角色和 groups.json／occlusion.json，保留第一步确定的窄口、远侧内壁与前后穿插。颈前也保留真实透明开口，未用衣料封口。该套参考没有薄纱衣片；没有增加纱料、改变透明度或添加由身体、其他衣片投下的投影。



[最终原尺寸合成](evidence/final.png) · [保存重开合成](evidence/reopened.png)

32 个底层绘画分片均导出独显查看，隐藏衣料检查时不带蒙版；23 个逻辑衣片也分别将自身所有深度分片合看。单个深度分片沿第一步确定的回转分界保留形体，不将远侧内壁误当成完整袖身或残片。未发现串入人体、邻片或孤立异色残片；补全底纹、开口、回转内侧衣料仍保留。

分片独显总览：[1](evidence/final-layers-sheet-0.png)、[2](evidence/final-layers-sheet-1.png)、[3](evidence/final-layers-sheet-2.png)、[4](evidence/final-layers-sheet-3.png)。逻辑衣片合看总览：[1](evidence/logical-parts-sheet-0.png)、[2](evidence/logical-parts-sheet-1.png)、[3](evidence/logical-parts-sheet-2.png)。[23 片名称、深度与原尺寸文件索引](evidence/inspection-manifest.json)。

实际改动仅 d32、d33、d34、d38 四个普通绘画层。其余 28 个绘画分片及全部蒙版底层像素与第一步一致。保持 23 个原逻辑 part、32 个绘画分片、5 个组和 7 个原生透明度蒙版；名称、UUID、父组、层序、默认显隐、锁定、透明度、混合模式、alpha 锁定及继承 alpha 状态完全一致。7 个蒙版默认均启用。[结构及未改分片核对](evidence/structure-check.json)。

## 保存重开核对

保存正式 `clothing-raster-layering/step02/clothing-soft-edges.kra`，关闭并丢弃旧文档与节点引用，重新打开、等待完成，再获取节点核对。原画布 1115 × 1410 保持；44 个节点的结构、属性及所有底层像素保存前后完全一致。重开导出的默认合成像素也与保存前完全一致，并已实际看图确认。哈希用于保存完整性核对，美术结论依据上述图像检查。

[重开验证记录](evidence/reopen-verification.json)。工具中一次 QColor 参数类型错误在绘画开始前发生，修正为当前 view 的 canvas 后继续成功，未影响工程；无持续工具故障。

## 未解决的问题

无本轮检查发现但尚未解决的验收问题。已交付正式 KRA、报告、局部前后对照及原尺寸检查图。
