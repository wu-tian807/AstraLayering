# legs/right_anklet 直属轮廓独立审查

逻辑身份：`group_child_layers:legs/right_anklet:review`；实际 actor：`/root`。平台线程受限下复用 root 执行独立审查，未参与本组候选绘制或拆分；候选、树、输入、技能和派发状态只读。

候选 SHA-256：`100f8eb91bfc18bb73c4ee6e1d78306a730e5a18eb7863f781c23cf2a5711739`。已读取当前树与三个默认 4× / alpha 128 范围结果 `[0,0,0]`；可见参考贴合另行检查。

先由原生 preview 工具生成并实际查看 `evidence/full.png`：整图右脚链的位置、中央垂坠方向与参考同位，整体未发现明显漂移。上方后回链是隐藏形体补全，按已有约定留待正式脚后叠放。

逐件原生 8× 输出在 `evidence/ankle-chain.png`、`gem-pendant.png`、`small-charm.png`；无父色块的相邻组合为 `connections.png`。它们以原尺寸无重采样排版到 `component-review-board.png` 供实际逐行查看。

整体结论：PASS。

## legs/right_anklet/ankle_chain — PASS

色块 ID：`group-legs-right-anklet-ankle-chain`。实际查看原尺寸合板第一行（原图 `evidence/ankle-chain.png`）：右高左低的挂环位置、两侧链节数量和走向符合本侧参考；中央扣及向右翘的短扣尾均保留，没有套用左链的对称轮廓。各挂环/链节孔洞仍透明，短连接与中央扣连续。后回链为已有隐藏补全面，须在后续脚后叠放。默认父范围 PASS，越界 0。

## legs/right_anklet/gem_pendant — PASS

色块 ID：`group-legs-right-anklet-gem-pendant`。实际查看合板第二行左侧（原图 `evidence/gem-pendant.png`）：短接头、窄椭圆吊环、宝石上尖至下尖完整，吊环内孔保留。宝石本侧的左右肩高差和轻微偏斜对准参考，最宽处及尖端没有明显位移；候选底色不承担内部亮面细节。默认父范围 PASS，越界 0。

## legs/right_anklet/small_charm — PASS

色块 ID：`part-legs-right-anklet-small-charm`。实际查看合板第二行右侧（原图 `evidence/small-charm.png`）：中央扣右下方的小悬饰位置、细长水滴宽度、上下收尖和完整四周轮廓符合参考。与主链及大宝石之间仍为透明间隔，没有虚构连线或把内部反光切成孔洞。默认父范围 PASS，越界 0。

## 相邻连接与整体结论 — PASS

最后查看合板底行 `evidence/connections.png`：三个直属组件一起独显，未用父形体遮缝。中央扣、短连接、吊环与宝石上接头连续；右扣尾没有与小坠误连接，小坠透明间隔保持。结合整图混合、逐件边缘和原生父范围 `[0,0,0]`，全部三个孩子通过本节点审查。

结束时复核冻结候选、标准 guide 以及范围报告所指候选的 SHA 一致，复用既有默认范围检查。输入、标准产物、树、游标及技能未改。PASS 仅覆盖当前直属轮廓与连接，后回链在脚后的正式叠放仍按既有阶段 5 约定处理。
