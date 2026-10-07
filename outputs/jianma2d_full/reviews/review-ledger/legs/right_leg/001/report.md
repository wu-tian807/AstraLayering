# 右腿直属轮廓色块独立审查

- 节点：`n19` / `group_child_layers`；身份：`group_child_layers:legs/right_leg:review`。
- Reviewer：`/root/workflow_runner/review_leg_right`；审查配置：`gpt-6-astra-xhigh.model`。
- 组路径：`legs/right_leg`；树：`structure/groups.json`；参考：`references/base-subject.png`。
- 候选：`refinement/groups/legs/right_leg/2.直属拆分与色块/2.2.直属轮廓色块/work/candidate.svg`。
- 候选 SHA-256：`31d6376981a329cfe663f5404077d5ed6bc6509a99a0b97a36b2299a1721149a`，已自行核对。
- 范围报告：同一候选步骤目录下 `轮廓检查.json`，原生默认 scale=4、alpha_threshold=128；全部三项 pass、outside_samples=0。范围检查与下列视觉判断分开记录。
- 图证据基目录：`refinement/groups/legs/right_leg/2.直属拆分与色块/2.2.直属轮廓色块/`。复用该冻结候选已生成的原生预览图，每张均由本 reviewer 亲自打开检查；未采用制作说明的结论代替实看。

## 整图

实际查看 `full-mix.png`（参考／候选／50% 混合，895×1758 原坐标）。右侧大腿、膝、小腿和脚的整体位置、纵向长度与姿态保持参考关系；膝至脚踝连续，未见整腿平移、漏段或断开。髋根圆端位于连体服遮挡下，为完整形体，不能按衣边误切。细部判断见逐项记录。

## 直属组件逐项记录

### `legs/right_leg/foot` — pass

- 类型／色块容器：group / `group-legs-right_leg-foot`；填色路径：`group-legs-right_leg-foot-silhouette`。
- 实际查看：`foot.png`，原生 `--only group-legs-right_leg-foot --reference references/base-subject.png --edge-overlay`，crop `(438,1535,87,184)`、scale=4，四栏参考／独显／50% 混合／边缘叠加。
- 具体对照：由踝内侧收窄沿脚背左缘向拇趾、足底五个趾尖，再沿小趾外侧和足背右缘向踝部逐段查看；外缘贴近原图描线中心，完整保留前足渐宽、五趾大小递变和底缘趾间凹口，没有把整脚画成单一圆头。约 `(465–467,1687–1696)` 的拇趾与次趾间细长真实孔保留透明；其余趾间深色线属于内部结构，本轮不要求切成透空缝。
- 连接：顶部约 y1545 的圆踝根为与小腿搭接的隐藏续形；两侧可见踝部沿原有收腰连续。蓝色脚链属于已有独立 `legs/right_anklet`，未被挪入脚的几何边界。
- 范围：原生报告 pass，outside_samples=0。视觉结论 pass。

### `legs/right_leg/thigh` — pass

- 类型／色块容器：part / `part-legs-right_leg-thigh`；填色路径：`part-legs-right_leg-thigh-silhouette`。
- 实际查看：`thigh.png`，原生 `--only part-legs-right_leg-thigh --reference references/base-subject.png --edge-overlay`，crop `(430,640,160,555)`、scale=4，参考／独显／50% 混合／边缘叠加四栏。
- 具体对照：从连体服腿口下的两处出露点，沿外侧髋部扩张、约 y830 的最宽部向下收束，直至膝外侧；内侧由裆下沿长而近直的大腿内缘走向膝内侧。两边主要转向、宽度与参考吻合，未见一段可见皮肤被漏描或明显鼓出。上方圆髋根进入连体服遮挡范围，属于父级已补全形体；不把这段隐藏外缘与衣服弧形腿口当作必须一致的可见轮廓。
- 连接：膝端圆滑闭合至 y1182，未用横切线断开；与小腿 y1108 起的圆根有连续重叠。此图可见两侧膝轮廓连接位置对准，组合图还将复核交接区域。
- 范围：原生报告 pass，outside_samples=0。视觉结论 pass。

### `legs/right_leg/lower_leg` — pass

- 类型／色块容器：part / `part-legs-right_leg-lower_leg`；填色路径：`part-legs-right_leg-lower_leg-silhouette`。
- 实际查看：`lower-leg.png`，原生 `--only part-legs-right_leg-lower_leg --reference references/base-subject.png --edge-overlay`，crop `(434,1095,106,530)`、scale=4，四栏参考／独显／50% 混合／边缘叠加。
- 具体对照：膝内侧转折、膝下轻微收束、外侧小腿肚鼓起、向胫下的长渐缩和踝骨两侧起伏依次核对；宽度、曲率方向及踝的收窄位置一致。轮廓贴近参考描线范围，无明显漂移、漏片或凭空增加孔洞。邻近发丝与其后方白底未被并入小腿。
- 连接：y1108 起的圆膝根进入大腿隐藏搭接区；下端越过踝部至 y1616 圆滑闭合，在 foot 已覆盖的区域内连续延伸。端部是隐藏承接面，未把皮肤内部阴影划作另一个轮廓边界。
- 范围：原生报告 pass，outside_samples=0。视觉结论 pass。

## 膝、踝连接复核 — pass

实际查看 `connections.png`：上排为膝 `(433,1085,105,143)`，下排为踝 `(433,1530,105,115)`，均为 4× 原生参考／候选组合／混合／外缘叠加。膝部由粉色大腿进入绿色小腿，踝部由绿色小腿进入紫色脚；两处圆端都有连续搭接，候选的联合外缘沿参考延续，未见横向白缝、断裂、边缘阶梯或漏出的父色窄片。内部颜色交界属于当前轮廓色块显示，不是最终皮肤接缝，本轮不据此拒绝。

## 总体结论：pass

树中全部三个直属组件均有完整路径、唯一容器 id、实看图与逐段对照记录；默认范围检查全部 pass，可见主要轮廓贴合，膝与踝连接连续。未发现需要本节点返修的明显偏移、变形或漏描。

本结论只验收 `legs/right_leg` 的直属轮廓色块和当前姿态连接；运动露出补齐、内部线稿、材质明暗与最终显影由后续相应节点处理。本 reviewer 未修改树、候选、正式 SVG 或调度游标。收尾重新核对候选 SHA 未变，树及范围报告 SHA 与冻结记录一致。

紧凑证据索引：[审查证据.json](审查证据.json)，记录输入和五张实际查看图的 SHA-256、各组件路径／id／crop 及结论；复用图片没有另存重复副本。
