# down：独立低头

从共同 neutral 独立制作 X=0、ParamAngleY=-25，未继承其他方向。作者源为 `face-down.json`，实际发布模型为 `deformers.json`；29 张引用贴图逐一核对与 step01 原导出 PNG 的 SHA-256 相同。完成后 0 度渲染与制作前逐像素一致，脖子无父 Warp、网格保持 identity。

描边判定：V5–V7 是真实的下颌和下巴轮廓，原曲线保留；V1–V4、V8–V21 是鬓发、刘海与发梢切出的露肤边，O1–O3 是临时封口，均不当作脸底凹口。没有用零散露肤扩大脸底。

补全的 `left/right-forehead`、`left/right-temple`、`left/right-cheek-upper/lower` 沿原画额顶和圆润脸侧延续，脸宽、体量维持原画，约下移 21 px；两侧与保留的下颌曲线按切线接顺。新增外缘在 down 帧中整段位于头发下，没有进入背景或发丝空隙。已做全图 blend、全缘 4 倍 edge 和两侧 6 倍局部 review；`face-trace.json` 的完整 source 直接沿用原描边，target 是补全闭合轮廓，inspect 的 completionMismatch 为空。

脸底使用独立 6×6 平滑 Warp，两轮拟合后复核实际原画贴图。可见三段平均误差 0.060–0.070 px、最大 0.266 px；补全段最大误差 0.644 px。脸缘连续，没有碎裂或网格折叠。

五官：每只眼的眼白、虹膜、高光、眼线和眼睑线共用整体 Warp，下移 29 px、纵向透视比例 0.90；眉下移 37 px，鼻下移 32 px，闭嘴下移 27 px，腮红下移 26 px，各作轻微纵向透视调整，横向宽度和内部结构保留。已分别与原画和 down 帧核对，再作 1 px 位置回调。

耳朵：原 KRA 有独立耳壳、内耳和耳毛。左右各三层共用一个 Warp，随头下移约 30–32 px，轻微纵向透视，保留原来的耳倾角、内耳与耳毛结构。画面右耳复核后上调 2 px、再轻收纵向 2%。耳根仍放在前发之后，沿用原叠放关系；下巴、头发不额外裁掉可见耳缘。

已检查完整脸、五官、双耳和固定脖子，以及 Y=0、-6.25、-12.5、-18.75、-25 的实际渲染，过渡平顺。剩余差异：视频局部颜色、柔化程度和少量虹膜／耳毛细节与原画不同，保留原贴图绘画；下巴与固定脖子的接触线、阴影收尾由 step07 处理。头发和头饰仍作为继承素材与遮挡参照。

检查图：[补全边缘](checks/completion-edge.png)、[实际脸底与补全](checks/face-base-vs-completion.png)、[五官](checks/features-vs-video.png)、[耳朵](checks/ears-vs-video.png)、[完整 down 对照](checks/down-vs-video.png)、[0 度对照](checks/neutral-vs-source.png)、[连续过渡](checks/transition.png)。所有参考保持共同裁框坐标，没有重新对齐。
