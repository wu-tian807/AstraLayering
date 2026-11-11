# 左小指正面遮挡补全

当前节点 `hiddenInReference=true`，源 SVG 与初始草稿均为空。补出整根小指的一条闭合路径，保留源 SVG 和 1376×2048 原坐标；不拆指节、指甲、指腹。

小指被实际掌片及前方无名指、中指等叠指遮挡。原姿态决定指体向右下收拢、指尖藏在较短露出指端之内；尺侧近端跨过实际掌片的远端弧边。近端圆弧与指身连续，圆弧端位于掌片内部，不是相切或孤立圆帽。实际掌片交叠范围约 x=1061.4–1079.4、y=1035.9–1054.6，四倍曲线采样交叠面积约 232.2 平方画布像素。该测量使用本次提供的去重 palm 路径。





辅助图使用内置 image_gen 生成。原图截取 [945,915,245,225]，四倍放大；原图坐标换算为 x=945+辅助输入像素x/4、y=915+辅助输入像素y/4。生成图为尺侧斜转视角，不能按该坐标换算定位；仅使用对应小指局部读取连续指身、近端厚度和轻弯结构。前两张未充分显露小指，没有用作绘制依据；采用第三张图，姿态位置仍以原图与实际 palm 为准。未复制图例的方向、指名、长度或宽度。



自检已完成辅助图对应小指局部 edge 对照、原角色 blend 定位、整根 SVG 独显和实际 palm 叠加放大检查。草稿四倍父范围检测通过，未跨越虎口、真实指缝或扩展父范围。源底稿保留，其他组没有修改。

## 采用图的生成提示词

Use case: precise-object-edit. Structural reference for the concealed PINKY of this exact anime girl's LEFT hand. Single close-up entire hand with wrist and these pink/mint bracelets and gold bell, clean white background. Change the camera to a 35-degree oblique view from the ulnar side, rather than repeating the original edge-on silhouette. The angle must visibly resolve FOUR separate fingers directed horizontally to the right, PLUS the thumb downwards (five fingers total). Keep fingers gathered in the same relaxed gently curved pose, no fan or fist. From upper/farthest to lower/nearest: long index, longest middle, shorter ring, and shortest LITTLE FINGER. The little finger is the fourth and nearest right-facing finger and its whole shaft is unobscured from rounded fingertip to thick curved proximal segment merging into the palm next to the ring root. It lies close under the ring finger, is short and gently flexed, NOT a second thumb. The ring must still remain visibly present behind it, so do not simply rename the existing ring as little finger. Make the camera change sufficient to show the pinky proximal edges and palm connection. Preserve delicate hand proportions, creamy pale skin, fine brown outline, original anime rendering and wrist accessories. Discard all black/neon background noise. No text, no labels, no arrows, no diagram panels, no detached or amputated fingers. Natural anatomically complete single hand.
