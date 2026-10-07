# n28 右侧鬓边扫发直属轮廓独立审查

实际 reviewer：`/root`；maker：`/root/workflow_runner`；模型 `gpt-6-astra`，推理 `xhigh`。已读取本节点 YAML/review 提示词及模型标记、直属树与拆分清单、冻结候选、默认范围报告和首稿修正说明。候选只读，审查者不修改几何、不执行 checkpoint。

冻结候选 SHA-256：`6b2593a0770f9ada194fad48648d2914d9b33f96f9792c1fbfacd75e5f5125bf`。默认范围检查 scale=4、alpha_threshold=128，5项 outside_samples 均0；范围通过不代替参考贴合。

根审查者通过原生 preview_tool 重建与此候选哈希绑定的证据（`evidence/render-manifest.json`）。实际先看 `evidence/full.png` 整图/参考/混合：本组整体位置、尺度和冠侧轮廓一致，无新增全图偏移；底稿中脸颈等既有绘制次序不作为最终合成结论。

## crown_sweeps — PASS

完整路径：`head/front_hair/temple_sweeps_right/crown_sweeps`；色块 id：`group-head-front-hair-temple-sweeps-right-crown-sweeps`。实际查看原生 `evidence/crown_sweeps.png`（4x独显/参考/混合/轮廓）。右冠翼后的圆根与紧凑外侧弧贴合参考，外弧顺接下方第一长片，未带入冠翼实体。内侧完整根沿原父弧延到宽刘海后，凹转处处于遮挡区而非可见发面开洞；可见冠侧发扇连续，没有照搬左侧弧宽。该group内部短片由n51继续拆分，当前验其联合父范围。

## upper_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_right/upper_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-right-upper-temple-lock`。实际查看 `evidence/upper_temple_lock.png`。该片从内上根向右外侧回卷，前缘贴合第一长片的银发分界，下端圆转约落于参考y219附近；外侧末段保持本侧较直、较紧的形状。上根在冠侧与长刘海后有完整续面，未错误沿父组整条包络拉长，也未把片内灰色体积带挖空。最低端与下一片重叠位置合理。

## middle_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_right/middle_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-right-middle-temple-lock`。实际查看 `evidence/middle_temple_lock.png`。中片从更低内根扫向外侧，再在约y239–240处圆转；前缘沿参考中层长片边界，宽度和向下收束没有吞进右主刘海。外弧的轻微转向与参考上、下两层连接相容，隐藏根与上片重叠，片内暗灰带保持为完整表面。未发现缺条、意外开口或外侧裂缝。

## lower_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_right/lower_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-right-lower-temple-lock`。实际查看 `evidence/lower_temple_lock.png`。耳上宽片的外侧圆弧、下端内收和参考的紧凑下扫形相符；内部续面沿长刘海后延伸，没有把刘海的前景外缘据为己有。与左侧不同，本侧下片连续，不添加两处负形。可见最低转折与耳侧片接续合理，完整宽面未被压窄为一条色带。

## ear_lock — PASS

完整路径：`head/front_hair/temple_sweeps_right/ear_lock`；色块 id：`part-head-front-hair-temple-sweeps-right-ear-lock`。实际查看 `evidence/ear_lock.png`。耳片是沿右外弧回包的窄弯片，最低内收尖端落在本侧约(499,279)，与参考中受主刘海遮挡的延续方向一致。外侧完整父弧延长至(522,212)的部分是中/下扫片后的根段，内侧根尖也位于前刘海遮挡区，没有额外外露尖刺。可见耳侧外弧未削掉，连续面未复制左侧两个孔；与耳廓、耳坠仍保留不同归属。

## 相邻连接与整体结论 — PASS

实际查看 `evidence/connections.png` 的5组件无父底稿组合，以及 `evidence/outer-joins-8x.png`（crop 508 207 27 63，8x）。冠侧→上→中→下→耳片沿右外弧连续交叠，侧面没有白缝或露出的隐藏根刺。各回卷片端保持本侧节奏；耳片延长根被中/下片遮住，外轮廓依然沿参考耳上弧延续。内侧的完整根在主刘海后，最终排序须将其隐藏；本侧未生成不属于参考的两处孔。

5个直属组件均已逐个实际查看并即时记录；默认父范围5项均0，轮廓及连接满足本步要求。n28 2.2 独立审查整体 PASS。当前仅验直属轮廓；n51内部短片、Rendering及最终头部显影仍待后续流程，不以范围工具通过代替成品视觉验收。
