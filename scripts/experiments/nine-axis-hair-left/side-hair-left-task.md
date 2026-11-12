基于本任务已有的 hair-x.json，在同一制作回合内优化两片侧发的 X=-30、Y=0，并完成自检。

只编辑 hair/side_hair/side_hair_left、hair/side_hair/side_hair_right 及各自的 hair/side_hair/ 专用 Warp。刘海及其父 Warp、脸、五官、耳朵、下颌、固定脖子、后发、辫子保持现有结果；正面 X=0 和 right X=30 保持原形。

辅助参考：nine-axis/step08_hair/references/left.png，原画布范围 [319,-21,774,774]。原正面：nine-axis/step02_video/upper-body.png。
hair/side_hair/side_hair_left 是画面右侧的近侧鬓发，hair/side_hair/side_hair_right 是画面左侧的远侧鬓发；两片分别制作。

目标是保留原发型，保持完整头壳与发根挂接，让上中段至耳旁保有圆润的长弧和饱满发面，与相对稳定的后发自然衔接。两侧按转向形成合理透视，避免发根下塌、发面拉成平斜面或薄片。遮挡上段仍须按头型补足。参考只辅助理解转向和空间关系，不要求内外轮廓、发尾与参考一致，整头自然感优先。

按后附的通用优化目标制作，在同一回合中查看实际渲染并修好。完成后记录 notes，返回 {"error":null}；无法完成则 error 写明原因。
