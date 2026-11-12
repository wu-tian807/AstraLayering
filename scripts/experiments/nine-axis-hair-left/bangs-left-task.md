基于本任务已有的 hair-x.json，优化刘海（front hair / hair/bangs）的 X=-30、Y=0，使其与整头自然协调；left 关键帧只作辅助参考。

只编辑 hair/bangs 及 hair/bangs/ 下的专用父 Warp。两片侧发及其父 Warp、脸、五官、耳朵、下颌、固定脖子、后发和辫子保持现有结果；正面 X=0 和 right X=30 保持原形。现有刘海方案是起点，本轮以原发型和转头后的自然感为优先目标。

辅助参考帧：nine-axis/step08_hair/references/left.png，覆盖原画布 [319,-21,774,774]。原正面：nine-axis/step02_video/upper-body.png。

保留原角色的发顶、分缝和主要发束，让覆盖额角的面积、发面宽度、长弧和末端方向随转头自然变化，并与侧发顺接。参考帮助理解大体转向，不逐线追其轮廓或发尖；整头的头型、体积和发流优先。按后附目标查看原色与实际组合，需要时用 edge 或 blend 辅助。完成后记录 notes，返回 {"error":null}；若无法完成，error 写明原因。
