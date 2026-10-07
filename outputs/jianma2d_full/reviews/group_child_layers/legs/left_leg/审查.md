# legs/left_leg 直属色块独立审查

审查身份：`group_child_layers:legs/left_leg:review`；worker：`/root/workflow_runner/review_leg_left`。范围仅当前组的三个直属孩子，未改候选、输入、技能、树或状态。

绑定：`block-layers/groups.svg` SHA-256 `2c3816f90295592ba802725684e1e8ce213e98fc5b43a6d0ae9e1be2aa28ce3d`，与 `tmp/leg-left-node22/candidate.svg` 及冻结记录一致；父输入 `tmp/leg-left-node22/input-guide.svg` SHA-256 `f1b983918610217a9529bb35085b926734d766184ed5e3b7d9a90898bf7c9fa0`，亦与冻结记录一致。`structure/groups.json` SHA-256 `ccbcd46c2f83e73fd4b05a2b70837cd19b51e9642d5531df4ac93fc4161a3c5b` 与冻结记录一致。参考为 `references/base-subject.png`。

已先独立生成并实看 [00-full-mix.png](00-full-mix.png)：整张参考／候选／50% 混合对照，画面左侧腿的位置、长宽与姿态一致。以下图片均由本审查身份调用技能 `svg_preview.py` 从绑定候选直接生成并实际查看；组件板均含参考、独显、50% 混合和可见边缘叠加。

## 逐项记录

- **PASS — `legs/left_leg/thigh` / `part-legs-left_leg-thigh`**。实看 [01-thigh.png](01-thigh.png)，原画布裁切 `(275,625,195,580)`、2×。完整髋根最高约 y658，圆根在连体服遮挡下连续上延，无截顶或缺片；可见大腿外侧从髋部向膝收窄、内侧从裆侧到膝的曲线与参考对应，宽度和转向未见明显偏移。膝端约 y1182 为闭合圆端，未用参考皮肤内部阴影作切分轮廓。连接组合另行记录。

- **PASS — `legs/left_leg/lower_leg` / `part-legs-left_leg-lower_leg`**。实看 [02-lower-leg.png](02-lower-leg.png)，裁切 `(325,1085,130,550)`、2×。圆膝根从约 y1108 连续覆盖膝部，膝下两侧转折、小腿肚外鼓、胫段渐收及两侧踝突均对准参考；画面左侧膝下已校准的外缘没有削成直线或漏掉窄皮肤边。踝端向足背内圆收至约 y1616，未见孤立碎片、孔洞或硬横切。连接组合另行记录。

- **PASS — `legs/left_leg/foot` / `group-legs-left_leg-foot`**。实看 [03-foot.png](03-foot.png)，裁切 `(350,1525,105,200)`、4×。圆踝根、后跟侧收窄、足背两侧到前掌的展开连续；画面右侧拇趾及其余四趾的全部趾尖、底缘凹口均覆盖，未把脚尖裁掉。约 `(414–417,1687–1695)` 的真实趾间孔保持透明，位置和细长转向对应原图；趾甲、皮肤暗线没有误挖成孔。蓝色链饰未并入脚色块，仍属于 `legs/left_anklet`。连接组合另行记录。

范围检查与参考贴合分开判断：复用 `refinement/groups/legs/left_leg/2.直属拆分与色块/2.2.直属轮廓色块/轮廓检查.json`，其候选与父输入已完成上述绑定核对。默认 `scale=4`、`alpha_threshold=128`，foot / thigh / lower_leg 的 `outside_samples` 均为 0，范围 **PASS**；该结果不替代本报告的视觉审查。

## 连接复核与整体结论

实看 [04-connections.png](04-connections.png)：上排仅显示 `part-legs-left_leg-thigh` + `part-legs-left_leg-lower_leg`，下排仅显示 `part-legs-left_leg-lower_leg` + `group-legs-left_leg-foot`，均不显示父组或其他色块。膝部圆搭接与踝部斜向圆搭接连续，组合的边缘叠加仅沿外轮廓闭合，没有白缝、孔口、额外突尖或人为横切线；两端外缘与参考的收放一致。独显图中的圆端属于重叠补全边界，后续正式显影不应将其描为皮肤接缝。

**整体 PASS。** 三个直属组件均完成独显与参考边缘对照，完整髋根、五趾及真实趾间孔均已实看，两处无父级连接连续，绑定一致的默认范围检查通过。未发现需返修的问题；本结论仅覆盖本节点轮廓色块，内部绘制与最终显影留给后续节点。未重跑范围检查，未执行 checkpoint、complete 或发布。

