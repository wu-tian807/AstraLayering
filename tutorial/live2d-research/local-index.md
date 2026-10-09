# 原创研究总索引 · Windows 本机

当前仓库已存在的原创研究按主题导航如下，保留既有路径及原文字节。[本机研究文件清单](local-existing-research.json) 记录实际路径、体积与 SHA-256，后续来包按哈希合并。模型原件统一入口是 [model-originals](../live2d-guidance/model-originals/readme.md)。

| 主题 | 已有本机研究 | 对应原件状态 |
| --- | --- | --- |
| 肤色与厚涂眼睛（2026-10-01） | [肤色](../drawing-tutorial/studies/face-eye-20261001/skin_learning_zh.txt)、[眼睛](../drawing-tutorial/studies/face-eye-20261001/eye_learning_zh.txt)、[绘画先验](../drawing-tutorial/studies/face-eye-20261001/drawing_priors.json)、[来源清单](../drawing-tutorial/studies/face-eye-20261001/source_manifest.json) | 四份旧研究均已存在，本次保留；原视频、抽帧未同步 Windows |
| Ferrum 阴影、kuroko 身体拆分及官方样例 PSD（2026-10-01） | [云端原创学习记录](../live2d-guidance/cloud-study-notes-20261001.md) | 本机已有报告；对应云端原件未落地 |
| Haru 眼部建模 | [官方模型证据](../live2d-guidance/haru-eye-model-study.json) | 本机已有报告；官方 ZIP 等待恢复 Library 下载访问 |
| Milly PSD 与 Lier 运行结构 | [PSD 结构](../live2d-guidance/data/milly-psd-structure.json)、[运行结构](../live2d-guidance/data/lier-runtime-index.json)、[字段及限制](../live2d-guidance/data/learning-data.md) | 原 ZIP、PSD、运行模型与作者说明已在统一目录，逐文件哈希核对 |
| 樱桃蛋糕天使 | [原创研究](../live2d-guidance/data/cherry-cake-angel-study.md)、[运行数据](../live2d-guidance/data/cherry-cake-angel-runtime-study.json) | 原 ZIP 与 11 文件已归集；无 PSD/cmo3，不推定免费版允许再分发 |

## Oct1–8 来包覆盖与缺项

云端已经提供研究包 `libfile_7bf60220b26081919e7f751d83b16682`，称含 93 文件、顶层为本目录；并提供四份官方原件包。当前 Library 支持下载流程重试返回 HTTP 403，没有可读的本机包。因此不能把该 93 文件或 Natori、Miara、Hiyori、Momose、Mao 等研究的新增版本标作已导入，也不能从已有概括推定全量研究齐备。详见 [模型原件清单及传输记录](../live2d-guidance/model-originals/readme.md)。

已有四份 face-eye 研究和两处旧导航的未暂存修改保留；本次仅在 `tutorial/readme.md` 追加统一入口，没有覆盖原有新增内容。旧研究中的云端或历史源路径保留作回溯，Windows 当前原件入口以统一目录为准。不修改 generic，不把研究结论自动写成强制绘画规则。
