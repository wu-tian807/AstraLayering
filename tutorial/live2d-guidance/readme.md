# Live2D 真实资料索引

本页索引原创分析与真实可解析数据；源资产只保留在本地忽略目录，不包含在公开 git 内容中。教程供流程设计者按专题学习，再落实到具体节点；执行者无需通读。此次不修改 generic，不引入动画实现；补全部分作为独立 part 的决定保持不变。

当前入口：[原创研究总索引](../live2d-research/local-index.md)、[模型原件统一目录](model-originals/readme.md)及[逐文件清单](model-originals/manifest.json)。2026-10-08 已将 Milly/Lier/樱桃的 35 文件及两份原 ZIP 复制到 `model-originals/`，与旧副本和 ZIP 成员逐项核对哈希；旧 `local-assets/` 保留。以下旧整理记录中的 `local-assets` 路径是历史位置。五份云端包已收到 Library 引用，但下载有界重试报 HTTP 403，官方原件及全量 Oct1–8 报告尚未本机导入。

[云端已验证学习记录（2026-10-01）](cloud-study-notes-20261001.md)：铁锭 Ferrum 头发阴影 P2、黑酱 kuroko 身体拆分合集 P1，以及 Live2D 官方 Haru/Koharu/Haruto PSD 样本研究。两段视频均已下载并全长解码通过；Ferrum 记录为抽帧与画面字幕，kuroko 为 10 帧抽样观察，均不等于连续完整听写或完整观看。kuroko 合集剩余部分未获取。相关原始资料仅在云端，Windows 尚未同步。

[官方 Haru 眼部建模证据](haru-eye-model-study.json)：云端实际 PSD、运行配置与动作端点的原创研究；源资产未在 Windows。保留交接 JSON 原文，`limits.windows_repository_modified=false` 指原云端研究阶段，并非当前索引维护状态。cmo3 未解码，1.1 为动作请求值，未证实渲染是否钳制；检查矩阵仅作学习建议，不写入 generic。

[樱桃蛋糕天使实际研究](data/cherry-cake-angel-study.md)与[机器可读索引](data/cherry-cake-angel-runtime-study.json)：新运行包的资源、参数与真实纹理拆分观察；无 PSD/cmo3，未解析变形器。

## 来源与状态

| 资料 | 原链接 / 作者 | 许可 | 已得到 | 待验证 |
| --- | --- | --- | --- | --- |
| 米粒模型配布 4.1 | 包内说明指向 B 站 BV16o4y187yV；作者卡米雷特；https://www.bilibili.com/video/BV16o4y187yV | 包内说明为条件授权，明确禁止二次传播包内任何文件，禁止挪用 PSD 内容到其他模型；不视作开源 | PNG 原画、PSD、moc3、1 张运行纹理、model3/cdi3/physics3、4 个 exp3 | 编辑器打开 PSD、图层语义/隐藏补全检查、源页面与授权条件复核；视频/字幕本机未获得 |
| 修女莉尔免费版 | 原链接未知；作者未知 | 未发现授权说明，未知；“免费版”不代表可再发布 | moc3、3 张纹理、icon、model3/cdi3/physics3、VTube/xyplugin/固定物件 JSON | 原链接、作者、许可与源 PSD；本包无 PSD、无 cmo3、无视频/字幕 |
| 樱桃蛋糕天使免费版 | 用户提供 ZIP；原链接、作者未知 | 包内无独立许可文件；纹理标示未经许可不得上传、仅限购买者，免费版名称不足以证明许可 | 11 个 runtime 文件已本地保存，无 PSD/cmo3 | 来源、许可适用范围、动作参数映射、变形质量待核对 |
| 现有 Live2D 文字教程 | 夏卜卜；https://www.bilibili.com/video/BV1VY41167jz | 未记录，未知 | 本机检出已有 14 讲文字与教程来源.txt，共 15 文件 | 视频/字幕获取状态由云端下载任务确认；勿重复下载 |
| drawing-tutorial | 见 ../drawing-tutorial/readme.md | 未知 | 原有 3 个视频、1 个 SRT 已保留 | 来源、作者、许可和视频/字幕对应关系待核对 |

链接来自已有文件和包内说明，本次未联网确认页面状态。

## 实际解析发现与学习边界

- 米粒 PSD 已核验 `8BPS` 签名、版本 1、3200×4800、4 通道、8 位，层与蒙版区 8,937,496 字节、层信息区 7,888,164 字节、169 个图层记录。具备分层数据，不等于已验证在编辑器可正常编辑；已逐层解析原层名、边界、显隐、混合、剪贴与组层级；169 条记录包含 107 个普通层、31 个组、31 个组结束标记。蒙版内容与像素未解析。
- 两套都有 moc3，均没有 cmo3。运行纹理和导出模型不能当作可编辑 Cubism 工程，也不能从莉尔运行包声称已学到原始 PSD 分层结构。
- 两份 model3.json 引用的资源均存在。米粒运行包包含三种情绪和一个姿态 exp3，说明文件仅称三个表情控制器；记录这个区别，不把文件数当作教程结论。
- 已学到：资料获取状态应区分原画、分层 PSD、建模工程和运行包；米粒作者说明其服装与分层策略为教程而简化。绘画先验的下一步应检查完整实体部件、遮挡底形、材质/光影归属与细节画法，不能只增加拆分约束。
- 待验证：米粒各普通层与组的绘画语义、遮挡补画范围、是否存在合并层；莉尔纹理可用于有限的外观/图集观察，不能推出原始图层结构。尚未做视觉学习，不编造完成度。

## 可解析数据与本地完整学习包

- [真实学习数据说明](data/learning-data.md)：结构事实、字段解释、限制与复现方法。
- [米粒逐层 PSD 数据](data/milly-psd-structure.json)：完整 169 记录与可遍历树，107 普通层/31 组/31 结束标记，不含像素。
- [莉尔运行关系索引](data/lier-runtime-index.json)：参数标签、组/部件与资源/物理关联，不伪造 PSD 图层。
- [标准库解析脚本](tools/parse_learning_assets.py)：只读源文件，无新增软件安装。
- 本地完整资产在本目录 `local-assets/milly/`、`local-assets/lier/`，共复制 24 个文件并逐文件核对 SHA-256；原 ZIP 与先前解压副本均保留。复制清单仅本地 `local-assets/local-copy-manifest.json`。另新增天使运行包 11 文件，复制后逐文件 hash 一致，原包与工作目录副本保留；本地目录 `local-assets/cherry-cake-angel/`。
- ZIP 原始文件名 `归档.zip`，68,562,527 字节，共 66 条目；有效文件 24 个，跳过目录与 macOS 元数据。ZIP SHA-256：`DBDBA19C2E25EAA163CB6812F6BFE1C5365B986C9D889A1867AB9EFC37521A21`。
- 仓库经 GitHub 页面核实为 public；米粒禁止再传播包内文件，莉尔许可未知。本地 PSD/图片/moc3/配置不暂存或推送；学习目的不等于可公开源资产。`.gitattributes` 未配置 LFS，LFS 也不能替代许可。

## 整理记录

本机检出从干净的 `main@0049060` 经常规 fetch、分叉检查与 `merge --ff-only origin/main` 安全同步到 `0308e94`（无本地独有提交，远端领先 49 提交）。仓库及已查父目录未找到 AGENTS.md；已读最新两个正式 SKILL.md 和 workflow-next SKILL.md，未启动制作流程。

两个既有目录统一移至 tutorial 下。四份有效技能说明/规划文档只修复实际教程路径，并补齐原有下半身链接遗漏的 `.txt`；分析历史中的快照、旧报告与复现脚本保留原文，不全局替换。旧记录中的根目录路径属于当时状态，当前资料以 tutorial 下路径为准。

完整源资产现复制到 guidance 的本地忽略目录，原副本保留；新增局部忽略保护 guidance/local-assets 和 drawing-tutorial 的新增 MP4。此前已跟踪的三个视频仅移动，不删除、不重新下载；精确例外允许保留它们的迁移，新增 MP4 默认忽略。移动清单、SHA-256 与验证记录保存在本次工作目录。
