# n27 左侧鬓边扫发直属轮廓独立审查

实际 reviewer：`/root`；maker：`/root/workflow_runner`。模型 gpt-6-astra xhigh。已读取本节点 YAML/review 分支、提示词/model、当前树、拆分清单、输入/候选和默认范围报告；候选只读。

冻结候选 SHA-256：`0c483165b8996e744f331d937f220b3a272b6ced35c9124b15770f1f1bd65275`。5个孩子的默认4x/128范围检查均为0；这只证明父范围包含，不代替实际参考贴合。

先实际查看原生 evidence/full.png 的整图混合：本组落在左侧头冠至耳前，整图没有新增位置/比例偏移。父底稿与当前临时色层的显示关系不作为最终头部叠层结论。下面逐件实际查看并即时记录。

## crown_sweeps — PASS

完整路径：`head/front_hair/temple_sweeps_left/crown_sweeps`；色块 id：`group-head-front-hair-temple-sweeps-left-crown-sweeps`。实际查看原生 `evidence/crown_sweeps.png`（4x独显/参考/混合/轮廓）。上根弧从冠翼后延续到中分侧，左外弧沿头部可见边，下方短扫片扇的联合范围连续；内侧跨到宽刘海后的根区属于合理遮挡补全，没有误吞眉眼可见区。外侧下弧与下一长片的相接位置合理，无孔洞遗漏；该group内部短片仍由n50细化，当前只验联合父范围。

## upper_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_left/upper_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-left-upper-temple-lock`。实际查看原生 `evidence/upper_temple_lock.png` 和局部 `evidence/upper-edge-8x.png`。当前前缘沿本片向内的银发边，不再沿父组整条外包络；下端在约(352,222)卷回，保留与下片之间的叠片关系。上方尖根在宽刘海后补全，没有压到眉眼皮肤；外缘与父包络相接处无多出的突刺。8x对照中曲面外缘和卷回端连续，没有靠收窄删除完整发片。

## middle_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_left/middle_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-left-middle-temple-lock`。实际查看原生 `evidence/middle_temple_lock.png`。中片保持向右上收束的根、左下向内卷的片尾及外缘窄段，右侧弧沿参考中层银发的可见前缘延续，没有越过到宽刘海前面。左上直段属被上片覆盖的根部补全；下端与下一片之间保留层叠宽度，未把明暗边误当空洞切掉。当前形体连续，未漏独立窄条。

## lower_temple_lock — PASS

完整路径：`head/front_hair/temple_sweeps_left/lower_temple_lock`；色块 id：`part-head-front-hair-temple-sweeps-left-lower-temple-lock`。实际查看原生 `evidence/lower_temple_lock.png`。下片比中片向下延伸，圆钝转折保留参考靠眼旁的宽扫片；右缘随长刘海背后的发片走向收束，最低端没有填过下方露肤缝。隐藏根允许与前两片交叠，外侧可见弧没有削薄或接出额外凸角。耳前的开口将结合耳片连接图再核对。

## ear_lock — PASS

完整路径：`head/front_hair/temple_sweeps_left/ear_lock`；色块 id：`part-head-front-hair-temple-sweeps-left-ear-lock`。实际查看原生 `evidence/ear_lock.png`。耳侧小片从下扫片后延续至长刘海后的尖尾，左弧对齐参考外侧发缘，右侧隐藏尾有合理续长。上缘两个凹口对应耳前露肤区；凹口周围窄片仍连接，并非整片依赖父级裁剪。保留原父完整贝塞尔的隐藏根位于遮挡区，对可见外缘没有引入新的切角。下一项以全部直属子层、无父底稿的组合检查实际开口。

## 相邻连接与整体结论 — PASS

实际查看 `evidence/connections.png`（5个孩子组合、无父底稿）和 `evidence/holes-8x.png`（crop 347 235 33 40，8x）。冠侧联合范围至上、中、下片均连续交叠，外侧未露白接缝。耳前约(370,247)与(363,258)两处露肤开口在无父组合中仍透明，窄上孔和较宽下孔的位置、倾角与参考相符；孔两侧发片保持连接，未误填皮肤、未把参考暗面切空。各片内根尖端由后续宽刘海遮挡，当前不把这些隐藏边作为最终显影边。

5个直属组件均有逐件实际图像审查记录，默认范围报告5项均0。本轮2.2独立轮廓审查整体 PASS；候选只读，审查者未改几何、未执行checkpoint。材质、最终头部排序及两个开口在成品中的显影仍由后续Rendering与第5阶段核对，不冒充最终合成已通过。
