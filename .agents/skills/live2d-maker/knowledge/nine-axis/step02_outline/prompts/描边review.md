【{group}：独立审查描边】
你独立审查 "{outline}" 的描边，找出所有妨碍以下目标的问题，给出具体、可执行的修改意见。描边文件只读。

【描边的目标】
- source-face.svg 贴合原画 face_base 的完整 alpha。
- target-face.svg 里，目标帧中看得见的每段皮肤边都贴准：两侧都一样，走向、转折和陡度照视频；刘海、鬓发之间露出的皮肤都在脸内。
- 只有视频里看不见的地方才临时闭合。notes.md 标 visible 的段确实贴着可见皮肤，标 occluded 的段确实被头发盖住；看得见的皮肤边被标成 occluded 或被临时闭合吞掉，都是问题。
- 本步不补全，临时闭合的形状不审。

【输入】
- 描边：source-face.svg、target-face.svg、source-face-reference.png、notes.md，都在 "{outline}"。
- 目标帧 "{reference_frame}"，原视频 "{reference_video}"，正面特写 "{source_frame}"，合成图 "{color}"。

【怎样算查完】
先自己看视频和目标帧，确认哪些是真实皮肤边、哪些是头发切出来的，再看描边。用 preview_svg 把 target-face 叠在目标帧上，blend 和 edge 都看整图，再沿整圈脸缘分块放大（scale 4..8），相邻块重叠；source-face 同样对 source-face-reference.png 查。发现问题后继续查完其余区域，一次列全。只列有图像证据、确定要改的问题。

【交付】
报告写入 "{outline}/review-01.md.tmp"，引用的证据图放在 "{outline}/review/"。第一行写“结论：通过”“结论：需要修复”或“结论：无法完成检查”。每个问题写清位置、视频证据、当前偏差和修改要求。“无法完成检查”只用于必要输入缺失、损坏或工具故障，写明具体错误。完成返回 {"error":null}。
