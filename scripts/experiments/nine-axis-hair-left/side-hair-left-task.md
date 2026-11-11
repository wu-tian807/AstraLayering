从已认可的刘海和脸部、原形侧发开始，按 left 参考制作两片侧发的 X=-30、Y=0。

只编辑 hair/side_hair/side_hair_left、hair/side_hair/side_hair_right 及各自的 hair/side_hair/ 专用 Warp。两片分别制作。已有刘海及其父 Warp、脸、五官、耳朵、下颌、固定脖子、后发、辫子保持；正面 X=0 和 right X=30 保持原形。

参考：nine-axis/step08_hair/references/left.png，对应原画布 [319,-21,774,774]。
原正面：nine-axis/step02_video/upper-body.png。
同一 references 下有 tutorial-front-parent-1430.jpg、tutorial-front-local-2020.jpg。

先看正面、left 参考和当前合图，放大查看各自从发根到发尾的轮廓。hair/side_hair/side_hair_right 是画面左侧的远侧鬓发；hair/side_hair/side_hair_left 是画面右侧的近侧鬓发。

还原参考中的发面宽度、外轮廓、离脸距离、高光走向和发尾长度与外翻。远侧按透视适度收窄，同时保留太阳穴到脸颊旁的发面与弧度，形成有蓬松感的整片头发；近侧保留宽发面、长弧和各层翘束。两片分别用低分段父 Warp 处理整体位置与转头透视，本体用较宽软选择作连续局部修形，半径按画布像素和发束尺度选择，保持长线条、高光与末端曲线顺畅。

侧发与刘海需要沿连接边真实搭接：从发根向下沿整条相接边检查，头发之间不能漏背景，也不能漏出细条脸部。根部搭接与发面、离脸距离一起处理，不能为接上刘海把整个发束压到脸上。发束内弧与脸之间本来存在的留空按参考保留；参考里被头饰挡住的连接边，仍根据正面和相邻轮廓作合理搭接。

由你查看真实渲染并修形。自检同时看完整合图、隐藏后发和辫子的合图，以及只显示 hair/bangs、hair/side_hair/side_hair_left、hair/side_hair/side_hair_right 的头发组合。只显示这三片时去掉脸部底图，沿刘海与两片侧发的整条连接边放大看清有没有空隙；回到合图再检查发面宽度、蓬松感、离脸距离和长弧。逐个查看 X=0、-7.5、-15、-22.5、-30，连接边与发束形状都要自然连续。每次最终修形后，用最后的模型重新看这些角度。完成后 notes 简要记录调整和实际检查，返回 {"error":null}。
