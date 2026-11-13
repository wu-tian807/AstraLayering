# 遮挡层级检查与 raster step01 交接

画布为 1115 × 1410，按原参考姿势规划。完整提案已通过 `submit_occlusion`，59 个终止叶全部逐件检查，包含空组叶 `neck`、`pelvis`、`head_accessories`。59 个 ID 与 groups.json 终止叶集合完全一致，深度值唯一，全部使用单深度 `level`；本姿势没有必须使用 `levels` 的实体穿插。原组树和输入 SVG 保持不变，提交工具已核验输入指纹。

独立层级表由提交管线在本轮结束后保存到 `part-layering/occlusion.json`。逐件图像依据和待修说明保留在各层 `check.note`，显隐规划保留在 `layers[].note`。

## 显隐实施

- 每侧眼内内容独立组成集合：`face/eyes/eye_left/sclera`、`face/eyes/eye_left/iris`、`face/eyes/eye_left/highlight`，以及对应 `eye_right` 三层。各集合共享开口透明度蒙版，控制部件分别为 `face/eyes/eye_left/upper_eyelid` 和 `face/eyes/eye_left/sclera`、`face/eyes/eye_right/upper_eyelid` 和 `face/eyes/eye_right/sclera`：上眼睑内缘、眼白下沿与眼角围成开口。默认睁眼只显开口内部，闭眼归零。虹膜剪贴到同侧眼白，高光剪贴到同侧虹膜；眼睑、眼褶、眉毛留在眼内蒙版集合外。两侧内容层连续排序，组外眼睑和前发可正确覆盖。
- `face/mouth/mouth_interior`、`face/mouth/lower_teeth`、`face/mouth/tongue`、`face/mouth/upper_teeth` 连续排列为嘴内内容集合，共享由 `face/mouth/upper_lip`、`face/mouth/lower_lip` 内缘及嘴角围成的开口蒙版。上下唇在集合外且位于内容前。默认参考为张开笑嘴，口腔、上牙窄带和舌面可见，下牙完全隐藏；闭嘴全部嘴内内容隐藏。
- `face/mouth/lower_teeth` 保留完整形体和深度，由 `face/mouth/tongue`、`face/mouth/lower_lip` 遮挡，必要时附当前姿势透明度蒙版补足零可见面积。上下唇肤色片及口腔、牙根的 `allowOutsideParent` 延伸保留，不按父开口永久截断。
- `arms/arm_left/hand/little_finger`、`arms/arm_left/hand/ring_finger`、`arms/arm_right/hand/little_finger` 保留完整绘画层与深度，默认整指不可见；各层以本侧前方掌指实体遮挡，必要时附姿势透明度蒙版隐藏露出的补形余量。具体控制部件完整 ID 已写入各层规划。保持可见手指与拇食指真实开口。
- 腕环与靴口分别按后环/后口、人体、前环/前鞋体夹层实施，不能将完整手臂组或鞋组整体移动到人体前后而破坏该穿插。蒙版附所属绘画层或内容集合，不增加绘画 part 或深度。

## 待修说明

- `pelvis` 的完成补形上弧延伸至 y 约 702，而 reduce 轮廓上缘约为 765；候选腹部青绿色弧属于骨盆补全。保留骨盆在躯干下端、腿根前的职责，在 raster step01 校准上弧与直边的局部接合和材质连续性。`body/breast` 实际位于胸部约 x478–683、y626–718，不将骨盆上弧误归为乳房位移。
- 上下唇外扩遮挡片应与脸底肤色一致，仅唇线保留红棕色。当前青绿补全及宽红褐色带需要材质校正，并检查两嘴角相接与闭合连续性。口腔、舌根和牙根补全色随所属材质校正。
- `face/eyes/eye_right/highlight` 当前草稿偏黄，按参考校正为白色反光。`head_accessories` 按原图校正黄、青绿、蓝及深色中央材质；现有依据不要求另拆中央区或认定其镂空。
- 前发分缝根部青绿色连接余量和侧发紫色草稿材质需要校正，保留各完整发面归属。肩、肘、腕、靴口搭接及露缝随所属实体局部校准。

候选使用完整 SVG，尚未应用上述显隐蒙版；隐藏补形透出不代表最终默认显隐。实际开口、剪贴、自然遮挡和接缝须在 raster step01 的 KRA 中验证。
