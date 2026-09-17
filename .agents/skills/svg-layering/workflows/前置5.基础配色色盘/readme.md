# 前置5：基础配色色盘

agent选区域，程序读取实际色值，生成可供阶段4使用的辅助色盘。一次执行，不设step子目录。

| 输入 | 输出 |
| --- | --- |
| 前置2基础角色彩图 | `color-palette.png`：原图位置、局部截图、候选色与明暗对照 |
| 可选输出目录 | `color-palette.json`：HEX、RGB、取样坐标及原图哈希 |

提供实际彩图和[生成提示词](./生成提示词.txt)即可执行。默认输出到工作根目录下的`reference-palette`；用户可指定其他位置。已有Miku结果见[样例](../../../../../outputs/case3_miku_v2/references/color-palette.png)。

## 程序调用

需要Python、Pillow和numpy。在本轮工作根目录运行，将脚本路径替换为本提示词同目录的实际绝对路径：

```sh
python3 "/资料路径/前置5.基础配色色盘/提取色盘.py" \
  "输入彩图.png" "临时取样区域.json" "reference-palette/color-palette.png"
```

取样区域JSON是一个数组，例如：

```json
[
  {"name": "主体浅色", "x": 120, "y": 80, "radius": 3, "role": "candidate"},
  {"name": "主体暗色", "x": 160, "y": 100, "radius": 2, "role": "comparison"}
]
```

坐标按图片实际显示方向，以左上角为原点；半径3表示7×7像素区域，小色区可缩小半径。程序先计算局部RGB中位数，再选最接近它的真实不透明像素。默认使用macOS中文字体，其他环境可用`--font`指定字体文件。

## 接入阶段4

将彩图、阶段3 SVG和色盘PNG一起提供给阶段4，需要准确复制色值时附上JSON。色盘辅助选择颜色，部件归属和色区范围仍由阶段4判断。彩图中的光影尚未被程序消除，因此保留“候选”和“明暗对照”的区分。

程序已用Miku样例验证；不同角色的区域由agent重新选择。case3已完成阶段4，用户反馈色盘对配色帮助明显；造型、明暗和材质问题仍需在所属阶段处理，见[实测记录](../../../../../analysis/case3-miku-v2-review/readme.md)。
