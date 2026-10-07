# legs/left_anklet 直属轮廓独立审查

审查逻辑身份：`group_child_layers:legs/left_anklet:review`；实际 actor：`/root`。因平台线程限制，root 承担独立审查，未参与本组父形体、拆分或候选绘制。输入、候选、技能、树与派发状态只读。

候选 `refinement/groups/legs/left_anklet/2.直属拆分与色块/2.2.直属轮廓色块/candidate.svg` SHA-256：`606e9a96427ea3c358d39102360a4fe4c55f0102a6fb833ef87df17a187d65f9`；与标准 `block-layers/groups.svg` 相同。已读取当前树、彩色参考及默认 4× / alpha 128 包容报告，三个孩子均为 0 越界。包容与可见参考贴合分别判定。

已由原生 preview 工具生成并实际查看 `evidence/full.png` 的整幅参考、候选和 50% 混合：左脚链保持在左踝与足背，整体链路与中央悬坠位置对齐；后侧补全链在色块稿中可见，正式叠放仍须置于脚后，属于后续组合边界。

整体结论：PASS，逐件审查如下。

## legs/left_anklet/ankle_chain — PASS

色块 ID：`group-legs-left-anklet-ankle-chain`。实际查看原生 8× `evidence/ankle-chain.png` 的独显、同坐标参考、50% 混合及边缘叠加。两侧挂环至中央圆扣的弧形前链位置、链节宽度和斜向转折对准参考；链节内孔和两侧挂环孔均保留，短连接连续，中央圆扣未遗漏。上方细弧是已补全的隐藏后回链，不作为参考可见前缘判错；后续须按既有约定置于脚后。父范围报告为 PASS，越界 0。

## legs/left_anklet/gem_pendant — PASS

色块 ID：`group-legs-left-anklet-gem-pendant`。实际查看原生 8× `evidence/gem-pendant.png`。扣下短连接、窄吊环与长菱形宝石连成完整悬坠；吊环内孔透明，宝石两侧转折、最宽处和下尖端与参考同位，未见截断或漏掉上接头。反光留给表面绘制，不在本节点拆作轮廓。父范围报告为 PASS，越界 0。

## legs/left_anklet/small_charm — PASS

色块 ID：`part-legs-left-anklet-small-charm`。实际查看原生 8× `evidence/small-charm.png`。小坠保留位于中央扣左下方的独立小形体，顶部尖转、下端圆收及斜向宽度与参考吻合；周围透明间隙完整，没有补出参考未显示的悬挂线，也没有将内部高光误切为空洞。父范围报告为 PASS，越界 0。

## 相邻连接与整体结论 — PASS

最后实际查看 `evidence/connections.png`：三孩子同时独显，未显示父色块来遮盖接缝。中央扣下短连接与吊环、吊环与宝石上尖端均连续，链两侧与中央扣衔接完整；小坠与主链之间保留参考中的透明间隙。结合逐件记录和整图混合，全部三个直属组件通过本节点审查。

已复核冻结候选、标准 guide 及范围报告所指 work 候选三份 SHA 一致，复用其默认包含检查 `[0,0,0]`，未重复运行同输入检查。未修改候选、树、rendering、artwork、游标或技能。正式后回链与脚的前后叠放仍按原有阶段 5 约定处理；本次 PASS 范围为直属轮廓，不宣称已完成最终材质或合成。
