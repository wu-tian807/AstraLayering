# AstraLayering

探索利用 AI 将角色图片重绘为 **可编辑、可分层的 SVG**，逐步走向 AI 辅助 Live2D / 可控 2D 角色动画创作。

项目主要关注：**模型组件组织结构 · 美术效果 · 模型动画绑定**。

## 当前思路

```text
理解组件与遮挡关系 → 建立图层结构 → 从底到顶完整绘制 → 局部精修
```

每层应是独立的语义组件，并补全被遮挡的区域，而不是先画完整图片，再拆分可见区域。

目前的实验中，绘制质量与严格分层仍较难兼顾。项目处于早期探索阶段，生成结果需要检查与调整，尚不是成熟的自动 Live2D 制作工具。

## 提示词

使用 **[prompt.txt](./prompt.txt)**，搭配参考图片开始尝试。

[prompts/](./prompts/) 预留用于收集社区优化版本、局部精修提示词及特定风格实验。欢迎直接使用、修改和调优。

## 查看 Demos

1. 用浏览器打开 **[loading/workbench.html](./loading/workbench.html)**（静态页面，无需服务）。
2. 选择或拖入 `demos/` 下的 `.svg`；可选加载同目录的原图（`.png` / `.jpg`）做对照。

当前示例（`demos/wu-tian807/`）：

| 文件 | 说明 |
|---|---|
| [miku公式服.svg](./demos/wu-tian807/miku公式服.svg) | 契约格式分层 SVG（76 层） |
| [miku公式服.jpg](./demos/wu-tian807/miku公式服.jpg) | 原图（对照用） |
| [miku深海少女服装.svg](./demos/wu-tian807/miku深海少女服装.svg) | 契约格式分层 SVG（78 层） |
| [miku深海少女服装.png](./demos/wu-tian807/miku深海少女服装.png) | 原图（对照用） |

图层契约见 **[loading/layer-contract.md](./loading/layer-contract.md)**，最小结构示例见 **[loading/examples.md](./loading/examples.md)**。

更多作品见 **[demos/](./demos/)**，欢迎提交自己的分层 SVG。

## 目录结构

```text
AstraLayering/
├── prompt.txt             # 通用分层提示词
├── prompts/               # 提示词变体与风格实验（预留）
├── demos/                 # 分层 SVG + 原图，按作者组织
│   └── wu-tian807/
│       ├── miku公式服.svg          # 分层结果
│       ├── miku公式服.jpg          # 原图
│       ├── miku深海少女服装.svg
│       └── miku深海少女服装.png    # 原图
├── loading/
│   ├── workbench.html     # 静态图层工作台
│   ├── layer-contract.md  # 图层分层契约
│   ├── examples.md        # 契约最小示例
│   └── convert_to_contract.py
└── readme.md
```

## 欢迎参与

欢迎通过 **[Issues](https://github.com/wu-tian807/AstraLayering/issues)** 分享思路、问题与实验结果，或通过 **[Pull Requests](https://github.com/wu-tian807/AstraLayering/pulls)** 提交改进。贡献不限于提示词：

- **分层 SVG Demos**：将自己的作品放入 `demos/<GitHub 用户名>/`，优先符合 `loading/layer-contract.md`，可用 `workbench.html` 检查。
- **提示词优化**：改进临摹质量、组件组织、Bottom-Up 分层稳定性、遮挡补全或局部精修方法。
- **特定风格测试**：探索不同画风、角色类型与复杂度下的提示词，并分享效果对比和失败案例。
- **分层数据格式与加载**：讨论适合 SVG 的分层约定与校验，相关探索放入 `loading/`。
- **动画绑定探索**：尝试网格形变、连续参数控制、自动或半自动 Rigging，以及与 Live2D 或其他 2D 动画系统的衔接。

提交实验时，建议附上所用模型、提示词、参考图来源及已知问题，方便其他人复现与继续改进。请确保分享的素材具有相应使用权限。

**From Pixels to Layers, From Layers to Motion.**
