# n24 嘴部直属轮廓色块独立审查

- 逻辑审查身份：`group_child_layers:head/face/mouth:review`。
- 实际 actor：`/root/workflow_runner/arm_right`，沿用有限 actor 池，`new_independent_context: false`。本 actor 未参与 n24 制作；maker 为 `/root`，splitter 为 `/root/workflow_runner/split_anklet_left`，独立关系真实。
- 已重读本节点 2.2 YAML、review 提示词和 `gpt-6-astra-xhigh.model` 标记。
- 候选：`refinement/groups/head/face/mouth/2.直属拆分与色块/2.2.直属轮廓色块/candidate.svg`。
- 冻结 SHA256：`fe6bcc3329de414e2afcfb169b5b035bd020505fe3d2f09c10d71eb8c588e7f5`，实文件已核对。
- 输入、候选、标准输出和游标只读；本轮仅写本报告及紧凑证据。范围报告沿用既有默认检查（scale=4，alpha>=128），三 part outside_samples 均为 0，作为范围证据，不能替代参考核对。

先打开既有六行局部蒙太奇确认图像可复用，随后查看整图混合，再按树顺序逐 part 正式核对并即时写入下列记录。局部图由原生 `svg_preview.py` 生成，裁切 `(419,283,39,25)`、scale=8，包含独显、参考混合及参考边缘；图像生成命令见候选目录 `evidence/render-commands.json`。

## 整图实际查看

实际打开 `refinement/groups/head/face/mouth/2.直属拆分与色块/2.2.直属轮廓色块/evidence/whole-blend.png`。头脸相对参考位置未见本轮整体错位；完整 guide 仍含父级色块与其他组件的临时覆盖，不能用整图中的最终显隐替代本组局部检查。随后以下结论逐项依据局部参考、完整 part 和可见子曲线核对。

## 1. head/face/mouth/upper_lip — PASS

- 完整路径：`head/face/mouth/upper_lip`。
- 色块 id：`part-head-face-mouth-upper-lip`；其中 `part-head-face-mouth-upper-lip-visible-surface` 保留可见边界，`part-head-face-mouth-upper-lip-hidden-overlap` 为独立可编辑隐藏搭接面。
- 实际查看：候选目录 `evidence/inspection-montage.png` 第 1 行完整上唇、第 5 行可见上唇，及第 4 行相邻连接；每行已看独显、50% 参考混合和参考边缘。
- 参考对照：左嘴角约 `(429.2,295.4–296.3)`，略偏左唇峰约 `(435.3,292.1)`，中央浅转折及右侧趋平的下降唇缘到约 `(448.7,294.7)`，均与参考薄而微不对称的上唇主要位置、宽度和走向相合。没有将唇峰镜像成机械对称的双峰。
- 接界：下缘由左角经 `(435.1,295.35)`、`(439.1,295.8)` 接右角 `(448.55,295.55)`，与下唇上缘反向共用同一组控制点；局部组合未见断缝、黑洞或多余零片，右端收细连续。
- 隐藏与可见分别判断：完整上唇独显的较高圆弧属于 y290.7 附近的隐藏搭接，不能作为厚上唇验收；第 5 行可见曲线仍保留薄唇外形，隐藏面连续且与可见面充分相接。
- 范围单独记录：既有默认 bounds `outside_samples=0`，与上述参考核对结论分开。
- 本 part 结论：**PASS**。无当前轮廓返修项；后续着色需将隐藏搭接留在面皮遮挡下，保持可见薄唇。

## 2. head/face/mouth/lower_lip — PASS

- 完整路径：`head/face/mouth/lower_lip`。
- 色块 id：`part-head-face-mouth-lower-lip`；可见面为 `part-head-face-mouth-lower-lip-visible-surface`，隐藏搭接为 `part-head-face-mouth-lower-lip-hidden-overlap`。
- 实际查看：候选目录 `evidence/inspection-montage.png` 第 2 行完整下唇、第 6 行可见下唇和第 4 行上下唇连接，均核对独显、混合与参考边缘。
- 参考对照：参考下唇比上唇浅、外缘柔和；第 6 行可见面保持从左嘴角 `(429.2,296.3)` 向下弧 `(437.3,298.6)` 再收向右侧 `(447.5,296.5)` 的薄浅范围，没有将 y300.4 的隐藏外弧作为可见厚下唇。原较平的中央浅弧与左右高差可辨，未切碎为左右零片。
- 接界：上界的三段曲线与上唇下界方向相反但控制点相同，左、右嘴角与中央转折连续；第 4 行组合只出现相接的上下唇色面，没有中央裂隙或口腔底面露成黑缝。
- 隐藏面：下方约 1–2px 的连续余量从父级下弧延续，两侧收回到嘴角附近；可见面与隐藏面重叠，不存在间隙。完整独显看似更厚的下弧是藏在面皮后的搭接，不作为可见唇形判断。
- 范围单独记录：既有默认 bounds `outside_samples=0`。
- 本 part 结论：**PASS**。参考下唇边缘非常柔和，后续 rendering 应通过浅色/柔边体现，不能将隐藏外弧加深为第二圈唇线。

## 3. head/face/mouth/mouth_interior — PASS

- 完整路径：`head/face/mouth/mouth_interior`。
- 色块 id：`part-head-face-mouth-mouth-interior`；闭合底面 id 为 `part-head-face-mouth-mouth-interior-hidden-surface`。
- 实际查看：候选目录 `evidence/inspection-montage.png` 第 3 行内侧独显、参考混合和边缘，以及第 4 行三 part 组合。
- 参考对照与适用边界：参考是闭口，没有可直接辨认的牙齿、舌头或深口腔结构。此 part 只提供上下唇后的一张连续保守底面；约 x429.7–448.3、y290.7–300.4，左右在原可见嘴角以内。形体简单闭合，边缘平滑，没有孔洞、额外狭条或猜测的内部部件。
- 覆盖与连接：第 4 行组合里内侧底面被上下唇的完整面覆盖，未从中央接界或嘴角漏出，保持参考闭口状态；没有把整个内侧底形当成当前可见张口。上下余量与父级 oral-bed 一致，并非对闭口图中不可见解剖的推断。
- 范围单独记录：既有默认 bounds `outside_samples=0`。
- 本 part 结论：**PASS**，限于本节点所需的完整隐藏内侧底面。更大开口、牙舌和口腔纵深均未获参考支持，也不在本次通过范围；轻微开合露出需求仍由 2.3 处理。

## 整体结论 — PASS

三项直属 part 均已按完整路径记录实际图像与逐段参考核对，原生默认范围检查三项均为 0 越界。可见唇峰、下缘、嘴角和闭口共用接界对准主要参考形状；隐藏搭接完整连续，内侧底面在闭口组合中被覆盖。未发现本节点需返修的偏移、漏描、断裂或越界。

通过范围是 **n24 的 2.2 直属轮廓色块**；隐藏圆弧不能染成当前可见厚唇，内侧不代表已验证的大张口解剖。后续颜色、柔边、运动露出和最终显影仍按相应节点处理。

实际独立性：maker 为 `/root`，splitter 为 `/root/workflow_runner/split_anklet_left`；本审查 actor `/root/workflow_runner/arm_right` 未参与 n24 绘制。输入、候选、树、标准输出、正式成稿、渲染表和游标前后 SHA 全部一致，详见 `evidence/input-sha256.json` 与 `evidence/review-result.json`。没有重跑已有效的 bounds，也没有调用 checkpoint／complete／next／reopen。
