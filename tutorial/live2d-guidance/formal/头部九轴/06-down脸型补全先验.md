# down 完整脸型补全先验

用于 `step05_angle-down`：从已完成 up 的工程单独制作下俯 −25，保护已完成的 up 和 X。**本角色 down 视频帧决定可见脸缘、五官、笔锋与位置；本页只帮助补全视频遮挡的额头、太阳穴、脸颊和下颌。** down 独立描线、补全与拟合，不能把 up 结果倒过来或镜像当目标。原模型参数与教程示例都不决定本角色的实际角度。

先分清皮肤真实外缘、刘海/发束遮挡边界和阴影。低头后额部、太阳穴被发束挡住，不代表脸底在那里消失；不能沿发缘闭合一小块皮肤窗口。源体量取原 KRA 完整脸底与原画脸型，下俯可见目标取自己的视频。先验与视频可见证据冲突时，以本角色视频为准。

## 下俯时怎样使用隐藏结构先验

| 区域 | 补全时观察什么 | 怎样限制补全 |
| --- | --- | --- |
| 额头与额顶 | 额部在下俯投影中的完整体量，额顶到两侧太阳穴的连续性 | 不把刘海下沿当额顶；不因视频露肤少就把额头压成薄片；也不任意扩大隐藏额部 |
| 太阳穴与上颊 | 额头、眼外侧与两侧脸颊的连接 | 保留原脸型；发束凹口、发影、耳饰和耳轮不能直接描进脸肉 |
| 脸颊、下颌与下巴 | 颊部体量如何接到下颌渐收段、下巴弧度与线条转折 | 教程示例的“低头变扁、下巴更尖”只是一种画法；自己的圆颏或小尖颏由视频决定，不能统一挤成尖三角 |
| 下巴与固定脖子 | 下俯投影下脸底覆盖脖子的范围与接触位置 | 从开始加入固定脖子同坐标预览；脖子不跟头部 Warp、不倾斜、不拉长；顶部补足与下颌消线留 `step07_jaw-line` |

完整预测应把可见线接进整张连续脸型：隐藏区域有原画体量约束，可见段准确贴合本角色视频。先显示无遮挡完整预测，再显示自动形变后真正渲染的完整脸底，核对两者差异。随后加五官与固定脖子看同坐标接触，不能用颈部形变补脸底的错误；同时回查已完成 up/X 的脸型与五官。

## 六模型：下俯与正面，明确脸型

![六模型下俯脸型参考](sources/model-face-priors-down/model-face-priors.jpg)

每行从左到右：X=0/Y=0 的完整脸底、X=0/Y=−25 的完整脸底、基准脸＋五官、下俯脸＋五官。脸底栏按原生渲染 alpha 平涂，保留真实轮廓，五官栏保留原纹理。原 moc3 关键形与蒙版直接渲染，没有图像液化；关闭 motion/physics/pose/expression、自动眨眼与呼吸，视线、嘴开、身体及其他整体变换固定。每次渲染新建模型，检查实际参数值，原模型文件只读。

每个模型 Y=0/+25/−25 的脸底和五官六张图使用同一个 alpha 联合裁框，上下板共用裁框与比例；不为低头另居中或放大。这里 ±25 是原模型参数值，**不是实测物理角度，也不是本角色拟合目标**。基准关键形仍可能自带绘画倾斜。

| 模型与放大图 | 脸型 | 下俯补全适用观察 |
| --- | --- | --- |
| [Haru](sources/model-face-priors-down/haru/reference.jpg) | 稍长鹅蛋脸 | 较直颊部到下颌渐收段、圆钝尖颏的连接 |
| [Hiyori](sources/model-face-priors-down/hiyori/reference.jpg) | 圆润鹅蛋脸 | 饱满颊、小尖颏；低头仍保留圆收体量，不能照教程把全部圆脸挤尖 |
| [Miara](sources/model-face-priors-down/miara/reference.jpg) | 圆颊小尖颏 | 原画倾斜且脸组含装饰，只看局部颊颌连续性，不取整脸方向与装饰边界 |
| [Natori](sources/model-face-priors-down/natori/reference.jpg) | 长窄脸 | 颧颊偏直、下颌收束到小尖颏；耳轮不是脸颊外缘 |
| [Koharu](sources/model-face-priors-down/koharu/reference.jpg) | 短圆脸 | 额部、宽颊与短下脸的比例；保持圆弧下颌，不按发影改脸底形状 |
| [Haruto](sources/model-face-priors-down/haruto/reference.jpg) | 宽圆脸 | 宽颊、短下巴、扁圆底缘在下俯时的连续性 |

先按本角色原画轮廓选择相近脸型，说明只用于哪些隐藏区域；不要平均长脸与圆脸。Miara 脸组里的耳饰、Natori 耳轮和所有模型的发影/纹理装饰都不作为骨肉边界。模型参考也不决定本角色五官尺度、脖子运动或角度。

每个单模型目录有 `face_front.png`、`face_down.png`、`features_front.png`、`features_down.png` 原 RGBA 渲染；[来源与参数记录](sources/model-face-priors-down/sources.json) 保存原模型/贴图 SHA、六姿态参数检查、联合裁框和图像指纹。来源为仓库已有官方样例包；复用 [render_faces.py](sources/model-face-priors/render_faces.py) 的 `--axis y` 和 [build_reference_board.py](sources/model-face-priors/build_reference_board.py) 的 `--direction down`，默认 X 行为保留。

## 圆脸视频：Y 变化中的体量，含 X 与表情

![圆脸 Y 片段关键帧](sources/round-face-y/round-face-y-keyframes.jpg)

原视频为 [圆脸九轴.mp4](sources/round-face-x/圆脸九轴.mp4)。09.5–11.7 秒字幕写 `+Y-X Corner → -Y-X Corner`，这是带 X 的四角变化，嘴部表情也在动；板上 09.60/10.30/11.00/11.60 秒仅是出处，不指定哪个是 X=0 的 down，也不测定角度。

观察完整额部、宽颊与下颌圆弧的连续变化，可帮助理解下俯隐藏脸型；不抄表情、嘴开、视线与左右转向。原片 0–6 秒还可看完整短圆脸体量，也不把截图硬当下俯端点。画面保留 Art Midori_fufu、Live2D Maoxy、PSD provided by SodaArts 署名；[片段来源记录](sources/round-face-y/sources.json) 含原视频 SHA、帧时间和图像 SHA。

## 正式教程：低头完整脸底与上下对照

来自 [脸部与五官九轴教程](01-脸部与五官九轴.md) 和 [原视频](sources/face-nine-axis.mp4)。此例按轮廓归为圆润鹅蛋脸，关键帧展示制作过程，不是本角色比例或位移模板。

![04:08 低头脸底关键形](sources/face-nine-axis-y-frames/01-face-down-keyform.jpg)

04:08 面板可见 X=0/Y=−30/Z=0，这个 −30 是教程自身的参数。完整脸底与脖子都显示，便于观察额顶、太阳穴、下颌的连续结构；它与本角色 down 的 −25 标签及视频角度没有换算关系。

![04:12 低头脸底网格](sources/face-nine-axis-y-frames/02-face-down-grid.jpg)

04:12 可看颊线怎样渐收至下巴。教程随后讨论“低头下巴更尖”，只用于理解该例的隐藏结构；若自己的视频下巴更圆、更宽或位置不同，应照自己的可见线，不能硬套压扁、尖化。

![07:27 教程抬头/正面/低头并列](sources/face-nine-axis-y-frames/04-brow-eye-y-comparison.jpg)

07:27 插图从左到右是上抬、正面、低头，帮助看脸体量与五官位置的关系。本角色眉眼间距、眼睑、鼻嘴位置和嘴的高度仍按视频，教程“低头眉眼近、嘴扁、鼻近嘴”等不作为强制规则，更不能由此改变原视频表情。

![07:35 低头眉眼与脸底关系](sources/face-nine-axis-y-frames/05-eyes-down-grid.jpg)

通过 07:35 的完整脸底看眉眼所在位置，再回本角色视频核对。[教程帧来源记录](sources/face-nine-axis-y-frames/sources.json) 含时间与 SHA。教程脖子即使随网格变化，也不复制：本阶段脖子固定参与参考，最终接触补足留 step07。
