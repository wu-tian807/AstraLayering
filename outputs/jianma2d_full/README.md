# 剑妈完整分层素材

本目录按 `workflow-next/live2d-layering` 制作可编辑的静态人物 SVG。制作进度由 `structure/groups.dispatch.json` 记录；最终组合与交付检查完成后，`delivery.json` 会标记完成并列出交付文件。

当前完成 **29 / 52 组**。第 30 组左侧外层后发的 6 个孩子均通过默认轮廓检查；独立审查完成 5 个单件、16 张实际查看记录后，最后一个长发束的图像处理受到策略拦截。剩余长发束与组合连接的[人工查看页](review-n30.md)已经准备好，尚未收到确认；原生流程停留在 `group_split`，未通过 2.2。

[草稿 PR #20](https://github.com/wu-tian807/AstraLayering/pull/20) 的首次快照为 **28 / 51 组完成**，第 29 组通过至 4.6；最新进度以原生状态文件和作品页为准。用户随后确认通过第 29 组 4.7 的[发根修色对照](review-n29.html)，流程已恢复继续。自动图像检查的原始拦截记录仍保留，修色通过结论明确来自用户确认。后续分组、第 5 步最终组合与最终浏览器验收仍待完成。

首次快照的文件哈希、审查证据核对和原生指针见[进度快照](validation/progress-pr-snapshot.json)。其中 PNG 由当时已通过的 4.6 SVG 重新渲染；该次 PR 整理没有重新进行视觉验收。后续检查点更新不改写这份历史快照。

## 查看素材

- [作品页](index.html)：当前稿、角色参考、制作进度和下载入口。
- [分层检查器](layers.html)：自动载入本次 SVG、参考图、部件树和渲染关系，可逐层检查。
- [可编辑 SVG](refinement/character.svg) 与 [PNG 预览](refinement/preview.png)。
- [部件树](structure/groups.json) 与 [独立效果关系](structure/rendering.json)。

网页通过 HTTP 打开。从仓库根目录运行：

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8766/outputs/jianma2d_full/>。此地址对应运行服务的电脑。分层检查器复用仓库的 `loading/svg-preview.html`，需要一并保留该目录。

## 制作与检查记录

本次续跑使用上游 `47fb50d` 的串行动态分组流程。各组依次完成父级轮廓、独立结构拆分、直属轮廓独立审查、运动露出补齐、Geometry 和 Rendering；所有组完成后执行第 5 步渲染层组合。

用户已确认将不可用的 `gpt-6-sol` 节点改为 `gpt-6-astra`、`xhigh`。实际作者、审查者和节点记录见 [workers.json](workers.json)、[运行记录](运行记录.md) 和 [独立审查账本](structure/review-ledger.json)。

部分工具记录已导出为相对路径版本；原始与导出文件的哈希见 [证据可移植性记录](validation/evidence-portability.json)。冻结 SVG 候选和独立审查报告保持原字节。

本次从已有参考图阶段续跑，保留 [参考生成来源](references/image-generation.json)。本地 `forgeax-imagegen` 已核验可用；本次后续节点绘制 SVG，预览 PNG 来自同一 SVG 的渲染。

在仓库根目录运行结构交付检查：

```sh
python3 outputs/jianma2d_full/verify-delivery.py
```

检查涵盖分组完成状态、历次冻结审查报告与候选的哈希、部件绑定、SVG ID、局部引用和画布尺寸；艺术效果另由实际放大图和组合图审查。独立效果的 `owner`、`follow`、`clip_to` 保留在渲染关系文件中；运动跟随由后续动画绑定流程落实。
