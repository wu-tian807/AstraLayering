# 头部九轴

状态：**资料收集中**（2026-10-29 建立）。已整理 [01 脸部与五官九轴](01-脸部与五官九轴.md)；其余范围尚未形成正式教程，下面是用户梳理的范围与当前判断，供后续拆分、实验和撰写使用。摆动物理（[10](../10-component-physics-authoring.md)、[11](../11-secondary-physics-workflow.md)）的后续改造依赖这里先确定转头时的形变参数。

## 为什么先做九轴

物理摆动与九轴运动互相联动：转头本身会带动头发和挂饰摆动，而摆锤的支点、方向和幅度又取决于转头后的透视形状。先做物理会缺少转头提供的参数。因此物理不作为一个独立大类，而是拆进九轴中各部件的制作里。

## 范围（用户梳理）

1. 脸部的透视变形
2. 五官的透视变形
3. 转头时边缘阴影的补绘：有些情况会画，有些不会，需逐角色评估
4. 头发的透视变形
5. 头发的摆锤物理变形
6. 挂饰的物理摆动与透视变形

## 目标与已知问题

- 目标转角：视角约 **45°**（step01 的 left 视角），即 ParamAngleX ±45° 边界关键形的形状；上下为抬头 +25°、低头 −20°。刻度见 `knowledge/nine-axis/step01_views/references/angles.json`，`deformers.json` 以度数记录。
- AI 自由形变通常只能做到约 15° 而不严重变形。
- 转角更大时，AI 倾向于扭曲脖子来代替头部本身的透视形变。

## 当前思路：用生成模型提供形状先验

脸部透视教程以视觉和审美判断为主，难以写成可执行规则。因此不让 agent 自由发挥形变，而是：

1. 用生视频模型（或生图模型）从正面原图生成高度一致的转头结果；
2. 以生成结果作为目标形状，把各部件的网格形变“捏”到与之一致。

生视频模型帧间一致性通常更好；生图模型可能给左右两侧添加不同细节，但这也可能只是提示词问题，两条路线都需要实验比较。

## 资料

| 文件 | 内容 | 备注 |
| --- | --- | --- |
| [sources/hair-nine-axis-swing.mp4](sources/hair-nine-axis-swing.mp4) | 头发物理的九轴摆动形变视频教程，约 322 秒 | 用户 2026-10-29 提供；尚未解析。SHA-256 `89090e66288f19c4460a5f584444b9fd66548b1150700f7675c5f3c4b2909374` |
| [sources/face-nine-axis.mp4](sources/face-nine-axis.mp4) | 铁锭 Ferrum《五官九轴》脸部与五官透视变形视频教程，24:55 | 用户 2026-10-30 提供；已整理为 [01](01-脸部与五官九轴.md)，听写稿与关键帧同在 `sources/` |

目前没有头发透视形变的教程。

## 工具

[`tools/generate_turn_video.py`](../../tools/generate_turn_video.py)：以正面原图为首帧调用 Seedance（默认 `seedance-2.5`）生成转头参考视频。它复用 live2d-maker `.env` 中的 OpenAI 生图代理（`layering_openai_image_base_url/api_key`），也可用 `LAYERING_VIDEO_BASE_URL/API_KEY` 覆盖，并输出 `.mp4` 和记录参数、提示词、输入／输出 SHA-256 的 `.json`。

```bash
python3 tutorial/live2d-guidance/tools/generate_turn_video.py \
  --image upper-body.png --prompt-file prompt.txt --out runs/turn-01 --seconds 5
```

已知：代理会静默丢弃 multipart 上传的图片并退回文生视频（生成出另一个人物），因此工具以 JSON + data URL 传首帧。2026-10-29 Jianma 上半身试跑一次约 2.5 分钟，人物、发冠和流苏保持一致，转角目测约 20–30°，脖子未被扭曲；但嘴从微张变为闭合，远侧发丝排布会变。这只是一次试跑，不是验收结论。
