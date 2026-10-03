# basic-face-v1：完整基础面部参数

标准expressions工作流必须交付这个profile，不能由scope删减基本能力后仍宣称完成。底层0.3 recipe/rig可省略 `capability_profile` 继续加载历史局部试验；它们不满足本标准。标准作者配方、编译controls和交付controls均须声明 `capability_profile: "basic-face-v1"`。

| 参数 | min / default / max | 要求 |
| --- | --- | --- |
| `eye.left.open`、`eye.right.open` | 0 / 1 / 1 | 左右独立开合；最小值真实闭合 |
| `eye.left.curve`、`eye.right.curve` | -1 / 0 / 1 | 改变眼睑弧形；完全闭眼时仍有可辨变化 |
| `brow.left.height`、`brow.right.height` | -1 / 0 / 1 | 左右独立抬降 |
| `brow.left.angle`、`brow.right.angle` | -1 / 0 / 1 | 改变两端高低关系，不能冒充整条平移 |
| `brow.left.curve`、`brow.right.curve` | -1 / 0 / 1 | 改变眉弧，保持原眉粗细与末端 |
| `mouth.open` | 0 / 0 / 1 | 从原闭口到足够大的张口 |
| `mouth.form` | -1 / 0 / 1 | 与开合联合控制宽度、嘴角和上下唇曲率 |

这是12个基础轴，不是12个情绪预设。艺术幅度、眉/眼曲率正负的具体边界由作者结合原稿定义，并在scope中说明。公开参数归一化范围固定，不能缩窄范围、漏掉眉毛或只保留眼开合来通过。额外参数不能替代任何基础轴。

## 联合区域与网格

每侧眼睛各有一个且仅一个 `open × curve` 联合region；两侧独立。每侧眉毛各有一个且仅一个 `height × angle × curve` 联合region。嘴有一个 `open × form` 联合region。眼睛不能把curve做成open的乘数而在闭合时失效；眉三轴不能用互不知晓的独立变形层相加。

每轴keys必须包含min、default和max。默认每眼2×3个作者关键形、每眉3×3×3个作者关键形、嘴2×3个作者关键形。增加纠形key时补齐该region整个笛卡尔积；程序负责连续中间值，不让模型逐帧重画。region的实际keys决定审核清单，不固定图片数量。

眉毛使用 `source.kind: "curve"` 和原有眉path/x；关键形为 `{at,curve}`，curve是四个二维控制点。`curve_mode:"absolute"`（默认）给出目标中心曲线；原眉中心线不能由单条cubic精确拟合时可用 `curve_mode:"offset"`，curve的Y表达作者位移场，保留原有细节。纯height不能因此附带重塑原眉。

所有形变仍由原SVG现有路径、阴影、高光和裁剪组成，源文件字节保持。scope必须完整记录五个联合region的 `parameter_ids`，及其真实主轮廓、邻域随动和固定外边界。缺素材或内核能力应报告具体阻塞，不能更改本profile的定义。

## 完成证据

1. 结构：scope、作者recipe、compiled和交付controls均通过profile门禁，12轴、范围/default、同组关系和完整网格正确。
2. 实效：编译器/运行时检查每轴min与max造成实际几何坐标变化，排除仅修改渐变或无效滑杆；双眼curve另在open=0检验。报告 `capabilities` 保存profile、parameters与effects，不能用作者声明代替计算结果。
3. 图像：扫描包含真实各region关键网格、每轴中间态与眼眉联合极值。独立review按动态visual_cases逐图检查，确认眉height/angle/curve不同、眼curve闭眼有效、接触和邻域连续、嘴二维范围仍可用。
4. 连续：实际拖动全部基础轴，观察中间形变与复位。记录图像及真实浏览器证据；工具数值通过不能冒充视觉通过。

`maximum_coordinate_delta > 1e-6`只是排除无效几何的技术下限，不代表变化大小足够或美术合格。不能把只有浮点噪声的效果交给用户。曾经通过的局部试验不自动获得这个profile；原有有效嘴部可复用，但新增眼/眉及其组合必须按实际变化验收。

此阶段不生成情绪预设、替换五官或附件。作者数据和工作台试调不随游戏存档导出或同步。
