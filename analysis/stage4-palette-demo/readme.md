# 阶段4辅助色盘样例

模型看图选择取色区域，程序读取实际像素并生成色盘；没有调用生图模型。

通用工具与执行入口已整理到[前置5：基础配色色盘](../../.agents/skills/svg-layering/workflows/前置5.基础配色色盘/readme.md)。本目录保留Miku样例的取样记录。

[查看色盘](../../outputs/case3_miku_v2/references/color-palette.png) · [准确色值与坐标](../../outputs/case3_miku_v2/references/color-palette.json)

色盘保留底色候选、明暗对照、来源局部和位置。阶段4仍由绘制者结合原彩图选择底色；程序不把频率最高或最亮的颜色自动当作固有色。虹膜等局部有多档颜色，此处只提供候选，后续色域范围仍按参考判断。

每个区域先算RGB逐通道中位数，再选距离它最近的一个真实不透明像素，避免输出三个通道拼成的图外颜色。色值是原图观察色，不是去光照后的物理材质色。

复现本例，在仓库根目录执行（需要Pillow、numpy）：

```sh
python3 .agents/skills/svg-layering/workflows/前置5.基础配色色盘/提取色盘.py \
  outputs/case3_miku_v2/references/base-character.png \
  analysis/stage4-palette-demo/case1_miku_samples.json \
  outputs/case3_miku_v2/references/color-palette.png
```

换角色时改输入图和取色区域JSON即可。区域名称与用途由调用者提供，脚本不绑定人物或固定部件清单。输出PNG用于看图，旁边的JSON保留准确色值、坐标与源文件哈希。

样例已核对来源像素，并用于case3的阶段4。用户反馈配色帮助明显；[实际结果与遗留问题](../case3-miku-v2-review/readme.md)已记录。色盘原先在case1的相同彩图上生成，现与本轮产物统一归档到case3，原JSON来源字段保留。
