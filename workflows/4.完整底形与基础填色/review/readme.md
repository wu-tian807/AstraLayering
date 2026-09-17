# 阶段4：基础填色审查

入口：[提示词.txt](./提示词.txt)。本目录包含本次审查所需脚本及其依赖文件，可以整体交给reviewer；无需到其他阶段或公共工具目录查找。

比较彩图与平涂配色，对照阶段3定位几何、层序和色区变更，再独显检查填色归属。

| 工具 | 用途 |
| --- | --- |
| [render.py](./render.py) | 实际SVG渲染、原生放大、同坐标裁切、按部件独显或隐藏效果 |
| [compare.py](./compare.py) | 原图／输入／候选的并排、整图透明叠加和图像差分 |
| [inspect_svg.py](./inspect_svg.py) | 查看实际ID、data-part与效果标记，检查引用和前后结构变化 |

`svg_common.py`和`render_backend.cjs`是同目录依赖，不需单独调用。

## 使用

进入本review目录运行。以下输入路径需替换为本轮实际文件，输出写入审查目录：

```sh
python3 inspect_svg.py "/路径/04_完整分层平涂.svg" --output /tmp/review/structure.json
python3 render.py "/路径/04_完整分层平涂.svg" /tmp/review/full.png --background white
python3 compare.py "/路径/base-character.png" "/路径/04_完整分层平涂.svg" /tmp/review/reference
```

定位相对本轮输入的变化：

```sh
python3 inspect_svg.py "/路径/04_完整分层平涂.svg" --baseline "/路径/03_完整分层线稿.svg" --output /tmp/review/changes.json
```

- 局部对照：render和compare均可加`--crop X Y W H --scale 2`，坐标为原画布像素；SVG先原生放大再裁切。compare使用同一裁切框，不分别适配人物包围框。
- 独显：render加`--part 实际data-part`或`--id 实际ID`，可重复参数合看邻接。标识从inspect结果读取，不猜名称；data-part会选取全部同归属分段。
- 隐藏：render支持`--hide-id`、`--hide-part`、`--hide-role`、`--hide-stage`；role／stage忽略根svg的文档标记。不存在的选择器报错。可用`--background '#e6e8eb'`显示透明区；原SVG实体背景如仍在需另行隐藏。
- compare生成`-side.png`（左参考、右候选）、`-overlay.png`（默认候选50%）、`-diff.png`及来源参数JSON。先正常合成再叠加，不降低单个部件透明度。尺寸／坐标不匹配会报错，不自动拉伸；尺寸一致仍需核对是否同版参考。
- inspect可用`--baseline`定位有ID元素的属性、归属和顺序变化。退出码0表示未发现重复ID或失效引用，1表示发现这两类问题，2表示运行错误；不代表视觉通过。未具名节点、CSS计算样式、曲线自交和隐藏完整性需另看实际渲染。

工具不修改输入，输出不能覆盖输入。显隐保留原有祖先变换、资源与裁切，不自动联动投影来源。差分不是还原度评分，必须实际看图。完整参数可查看各脚本`--help`。

## 环境与验证

Python 3.9+、Pillow（[requirements.txt](./requirements.txt)）、Node.js和sharp。Node从PATH或Codex本机运行时查找，也可设`REVIEW_NODE`；sharp可通过`REVIEW_SHARP`指定模块路径，否则使用标准模块解析或Codex本机依赖。使用局部滤镜等效果时，按需核对实际交付查看环境。

本目录可独立运行工具测试：

```sh
python3 -m unittest discover -s tests -v
```
