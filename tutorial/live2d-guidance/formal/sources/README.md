# 来源、解析与验证索引

本目录保留用户视频的内容解析、明确的时间段和研究范围，并用原文件 SHA-256 标识来源。正式教程提炼自这些观察与 Jianma 实战，不把字幕、教程建议和当前程序能力混为一谈。

本次 MR 归档解析与来源指纹；原视频／SRT 未随 Git 复制，原件在用户上传资料中保留。没有根据数值文件名编造 B 站链接或作者，也不把原件的可用性与正文可读性绑定。解析正文自包含，不依赖本机绝对路径。

## 视频

| ID | 资料与解析 | 获取和阅读范围 |
| --- | --- | --- |
| L01 | [AI 法线／深度与 AE 二分打光](lighting-video.md)，[已知原链接](https://www.bilibili.com/video/BV1oaYU6nE4f) | 本轮输入是 SRT，按时间码复核关键内容；不称为完整视频逐帧分析 |
| E01 | [果冻眼](eye-video.md)，`1318604148-1-192.mp4` | 全片章节抽样及两段共 750 连续帧；1278×720 / 25 fps / 908.02s |
| C01 | [胸部形变与回弹](chest-video.md)，`1581502286-1-192.mp4` | 全片章节抽样及两段共 180 连续帧；1280×720 / 30 fps / 236.98s |
| M01 | [嘴部建模](mouth-video.md)，`1126744718-1-208.mp4` | 全片章节与关键制作画面，七段共 630 连续帧；1920×1080 / 约 29.97 fps / 562.24s |
| A01 | [手臂拆分](arm-video.md)，`1268506471-1-192.mp4` | 全片每 5 秒抽帧与语音识别字幕，裸肩段 12 张原分辨率帧；1280×720 / 30 fps / 580.17s |

[manifest.json](manifest.json) 保存字节数、SHA-256、元数据和明确研究区间。抽帧数量不冒充全片逐帧观看；动态画面中的编辑器缩放与手动输入不作为物理测量。

## Cubism 与 psd2live

| 来源 | 采用的知识 | 限制 |
| --- | --- | --- |
| [Cubism 物理设置](https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/) / [物理参数](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/) | 输入、虚拟摆链、输出参数、作者关键形的分工 | 不同软件的速度／阻尼单位不能照搬 |
| [CubismWebFramework 求解器](https://github.com/Live2D/CubismWebFramework/blob/198a3769c26ca3d7b600e932590433badd392edd/src/physics/cubismphysics.ts) | 粒子与参数响应的公开实现参考 | 本轮未复制或嵌入 SDK，不是兼容实现 |
| psd2live [PHYSICS](https://github.com/tsunehimatoi/psd2live/blob/ef527ddf9a7e738de642a0f19bdda17da1ef6191/docs/zh/guide/PHYSICS.md) | 摆链输出对应关键形，多节输出分配 | 本轮只借鉴结构和制作原则 |
| psd2live [SWING](https://github.com/tsunehimatoi/psd2live/blob/ef527ddf9a7e738de642a0f19bdda17da1ef6191/docs/zh/guide/SWING.md) | 固定边、轴、末端集中、横截面平行 | 不是逐行复制其生成器 |
| psd2live [SIMULATION](https://github.com/tsunehimatoi/psd2live/blob/ef527ddf9a7e738de642a0f19bdda17da1ef6191/docs/zh/guide/SIMULATION.md) | 顶点固定／刚度／保形、头发连通区与衣料自由段 | XPBD、烘焙与参数拟合未接入本轮 |
| psd2live [PhysicsGenerator.kt](https://github.com/tsunehimatoi/psd2live/blob/ef527ddf9a7e738de642a0f19bdda17da1ef6191/src/main/kotlin/io/github/psd2live/core/PhysicsGenerator.kt) / [RigBuilder.kt](https://github.com/tsunehimatoi/psd2live/blob/ef527ddf9a7e738de642a0f19bdda17da1ef6191/src/main/kotlin/io/github/psd2live/core/RigBuilder.kt) | PhysicsEyeJelly 的分级延迟、虹膜纵横形变参考 | 0.18/0.32 延迟、11%/4.5% 形变是源项目设置，不是本轮推荐值；未发现专用胸部预设 |

psd2live 阅读版本固定为 `ef527ddf9a7e738de642a0f19bdda17da1ef6191`；CubismWebFramework 为上表固定版本。本次教程复核既有阅读与实现记录，没有声称验证了这些项目当前所有功能。

## 组件物理研究 · 2026-10-22

[研究记录](component-physics-research.md)新增 psd2live、Cubism、Inochi2D v0.8.7、Rive、DragonBones、Synfig 的实际阅读范围，并以 Spine 的公开源码作架构对照；区分骨骼蒙皮、作者网格和时间动力学。[来源清单](component-physics-sources.json)保留固定版本及文件指纹，[测量记录](physics-component-measurements.json)保留三份已有 physics3 的组／节点信息和当前 XPBD 的四组规范输入响应。新方法与尚待实现的配置管线见 [10 组件物理](../10-component-physics-authoring.md)；没有复制角色素材或集成第三方运行时。

## 蒙版投影模型研究 · 2026-10-22

[模型证据与复现](shadow-mask-models.md)记录 Milly、Haru、Mao 的原始 PSD，以及 Milly、Haru、Hiyori pro 的 moc3 裁切读取；[数值清单](shadow-mask-models.json)保留 SHA-256、layer ID、覆盖统计与独立参数端点测量。用于 [09 蒙版投影](../09-clipped-cast-shadows.md)，不把图层名、PSD 剪贴、运行 mask 与 deformer 层级混为一谈。官方 Cubism 裁切源码与 Krita 手册也在该记录中逐一注明版本与阅读范围。

本次只添加文字、数值证据和只读复现脚本；没有另行复制模型图片、纹理、Core 或工程。

## 实战代码与原记录

Jianma 工作台快照固定为游戏仓库 `b24aeeecb60cd63cb036b81ab26595ed6222abd6`，作者教程不依赖其后续 `main` 变化。

- [物理与贴图归属记录](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/engineering/JIANMA-PART-PHYSICS.md)
- [嘴部制作原记录](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/engineering/CHARACTER-MOUTH-AUTHORING.md)
- [光照设置](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/model.ts) / [共享渲染](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/physics-renderer.ts) / [贴图归属](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/part-maps.ts)
- [摆链与共用推进](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/physics.ts) / [共享弹簧](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/elastic-physics.ts) / [网格分配](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/physics-mesh.ts)
- [胸部形变](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/chest-physics.ts) / [眼部联动](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/eye-physics.ts) / [嘴型网格](https://github.com/ForgeaXGame/ai-weapon-spirit/blob/b24aeeecb60cd63cb036b81ab26595ed6222abd6/docs/workbench/src/character-studio/mouth-mesh.ts)

原记录含当时状态，不能替代本目录后续纠正：尤其是“上唇白块可能为高光”的旧判断、已选嘴型不等于美术通过、九轴与真实碰撞未完成。用户最新取舍与已知反例见[案例](../cases/jianma.md)。
