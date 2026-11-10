# AstraLayering

AstraLayering 是一个由 AI agent 驱动的角色分层工具。从一张角色图开始，拆分人物和衣服、补全遮挡、组装角色并制作阴影，产出可继续编辑的 Krita KRA、透明 PNG 和制作报告。

## 人物分层

人物与衣服分别绘制，保留独立图层和被遮挡部分，再按层次组装成完整角色。

| Jianma | Pink Doll · 58 层人物、8 层衣服 |
| --- | --- |
| ![Jianma 分层展示](showcase/jianma-reference-composite-exploded.png) | ![Pink Doll 分层展示](showcase/pink-doll-reference-composite-exploded.png) |

| Pink Elf · 70 层人物、32 层衣服 | Black White Doll · 81 层人物、19 层衣服 |
| --- | --- |
| ![Pink Elf 分层展示](showcase/pink-elf-reference-composite-exploded.png) | ![Black White Doll 分层展示](showcase/black-white-doll-reference-composite-exploded.png) |

## 可视化工作台

制作工作台展示任务进度、部件结构、绘制过程和每一步的成果，支持暂停、继续和导出。

![制作流程预览](web/demo-screenshots/10-flow-current.png)

角色工作台支持图层编辑、光照调整、九轴变形和布料摆动预览。

![角色工作台](web/demo-screenshots/07-studio-overview.png)

## 最新进展：头部九轴

![头部九轴动图](showcase/tanuki-head-nine-axis.gif)

角色可以左右转头、抬头、低头和斜向运动，五官、耳朵与下颌随头部一起变化。

九轴流程生成参考视频、选择关键帧、制作变形模型，再处理下颌与脖子的连接。

## 布料与光照

裙摆、袖片和飘带可以随风摆动，和角色光照、投影一起预览。

![裙摆与飘带动图](showcase/jianma-wind-skirt.gif)

## 开源协议

[LGPL-3.0-only](LICENSE)，配套条款见 [COPYING](COPYING)。第三方素材和依赖遵循各自的许可。
