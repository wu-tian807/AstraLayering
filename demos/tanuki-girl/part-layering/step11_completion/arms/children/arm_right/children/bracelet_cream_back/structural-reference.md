# 奶油色手环后段补全依据

本组为角色自身右腕、靠前臂侧的奶油色手环后段。保留源稿两条路径，仅新增一条闭合后弧。后弧被腕部遮住，两端在同一手环的前段下方搭接；后段承担伸入端，前段承担覆盖端。两侧圆弧余量位于覆盖区，环心开口及与粉色手环之间的间隔保留。没有把皮肤、前段或粉色手环纳入本组。

原参考裁片为 `[235,855,285,270]`，放大三倍后提供给内置 imagegen，保留完整手掌、手指、腕部、相邻粉色手环及足够的前臂。第一张辅助图仍接近正面，未用其替代隐藏面的结构依据；第二张为斜侧转面参考，手掌投影及回转边均发生转向。其可见后侧段说明圆带截面、绕腕回转和开放环心；中间仍被腕遮挡的连续弧由两端的同环连续性、原图锚点及只读父稿已有隐藏弧曲线共同确定。

最终 SVG 始终使用原正面坐标。左接口位于约 `(384,963)` 至 `(387,969)`，右接口位于约 `(423,987)` 至 `(426,988)`；右端圆弧收在前段覆盖区内，避免外缘露头。父范围四倍采样检查为零越界。

修改后完成局部 SVG 独显、原图 blend 和生成图两侧后段 edge 检查。转面图的局部区域分别为 `[671,254,116,115]`、`[910,424,66,89]`；读取弯曲、截面和包裹关系，不要求转面轮廓与原正面重合。生成图未用于移动、缩放或修改源路径。











## 采用的辅助图生成提示词

工具：内置 `image_gen.imagegen`，白底。输入为上述原参考裁片，不提供其他组产物给生图。

> Use case: identity-preserve. Draw an anatomical accessory study of this anime right hand/wrist/forearm from a distinctly changed THREE-QUARTER SIDE CAMERA VIEW. The supplied crop is the reference for character identity, ring design and colors, NOT a pose to copy. Camera moves 65 degrees around the forearm so we now see the hand EDGE ON, with fingers overlapping in narrow profile and part of the palm showing. Also camera looks slightly down the length of the forearm towards the hand, so the wrist bangles' oval holes and their far/back semicircular rims become clearly visible above and behind the wrist. The essential target is a clearly visible long curved FAR/BACK ARC of the cream bangle, not just its two small side tips. Maintain natural worn jewelry anatomy, thin round smooth tubing, continuous ivory rounded bangle near forearm, separate pink bangle near hand; all jewelry remains on the wrist, no exploded objects. Show the full hand, forearm from mid length, and both rings in one natural composition, with wrist crossing through their oval openings and visible rear ivory arc above the wrist. Same delicate anime thin outline, soft cel shading, pale skin, greenish ivory cream and pink, hand gesture recognizable but viewed SIDE ON, diagonal forearm. Plain white background, no text, no bell, no extra accessories. Do NOT repeat the original broad front view of the hand. Do NOT represent the rear arc as a filled disk; it is one simple thin band with an open center.
