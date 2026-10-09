# 模型原件统一入口

Windows 实际目录：`D:\Resources\workspace\AstraLayering\tutorial\live2d-guidance\model-originals\`。

这里集中保存研究所用原件。原 ZIP 保持原字节；解压模型从既有 `../local-assets/` 复制，保留用户源文件。`local-assets` 是旧副本，本目录是当前统一入口。原件、作者许可原文、来包和审计文件全部由仓库根 `.gitignore` 排除；本目录仅本说明与原创元数据 [manifest.json](manifest.json) 允许跟踪。不要强制暂存或公开上传素材。

## 本机已完成 · 2026-10-08

| 模型 | 当前位置 | 实际内容 | 来源与许可 |
| --- | --- | --- | --- |
| Milly／米粒 | `milly/` | 13 文件；1 PSD、原画、moc3、运行配置、纹理与表情 | 卡米雷特；包内 `米粒模型说明.txt` 已原样复制，明确禁止二次传播包内任何文件，并限制 PSD 挪用等用途 |
| Lier／修女莉尔 | `lier/` | 11 文件；moc3 与完整运行资源；无 PSD/cmo3/can3 | 作者及原链接未知；包内未找到独立许可，不因免费版名称推定可再分发 |
| 樱桃蛋糕天使 | `cherry-cake-angel/` | 11 文件；moc3、两张纹理、运行配置和附带 motion；无 PSD/cmo3/can3 | 来源及作者未知；既有实际纹理研究记录未经许可不得上传、禁止转卖、仅限购买者等限制，免费版文件名不是许可 |

运行包不等于可编辑 Cubism 工程。Milly 的 PSD 是分层原画，不代表已取得 cmo3。作者完整说明保存在忽略目录内，不复制进公开说明。

| 原 ZIP | 本机源路径 | 体积（字节） | SHA-256 |
| --- | --- | --- | --- |
| `archives/归档.zip` | `C:\Users\22129\Downloads\归档.zip` | 68,562,527 | `dbdba19c2e25eaa163cb6812f6bfe1c5365b986c9d889a1867ab9efc37521a21` |
| `archives/A樱桃蛋糕天使免费版.zip` | `C:\Users\22129\Downloads\Compressed\A樱桃蛋糕天使免费版.zip` | 68,357,883 | `411f1a554c66c35b4aa43a2e860b2e7e492be876be0522cdd02d64b6d1eb7da1` |

两个 ZIP 共 79 条目，全部文件 CRC 通过；有效模型文件 35 个，逐一与旧副本和 ZIP 成员核对 SHA-256。归档包的目录和 macOS 元数据保留在原 ZIP 中，未重复复制到模型子目录。旧 Milly/Lier 清单的 24 项也全部核对一致。

35 个模型文件共 173,246,691 字节、34 个唯一 SHA-256。唯一重复是 Lier 与樱桃天使共用字节的 91 字节 xyplugin 配置；为保留各模型完整文件布局，在各自目录保留其要求的文件名，并在清单标出重复。Milly 与 Lier 共用一份原始 `归档.zip`，不按模型重复保存 ZIP。两份原 ZIP 共 136,920,410 字节。

复核工具：[inventory_model_originals.py](../tools/inventory_model_originals.py)，标准库，只检查两份明确指定的 ZIP 与三套旧本地副本。默认只检查；`--copy` 复制并核对，已有不同字节的目标会报错，不覆盖。

## 云端包：已收到引用，尚未本机导入

| 包 | Library ID | 提供的体积（字节） | 本机状态 |
| --- | --- | --- | --- |
| Oct1–8 原创研究，顶层 `tutorial/live2d-research/` | `libfile_7bf60220b26081919e7f751d83b16682` | 318,778 | 未落地；云端交接称 93 文件，尚未在本机验证 |
| 官方模型原件 part1 | `libfile_265151de70c48191855e783e0b85247e` | 64,787,396 | 未落地 |
| 官方模型原件 part2 | `libfile_19f4930f671881918cf0bb4704605c89` | 66,310,846 | 未落地 |
| 官方模型原件 part3 | `libfile_9920198926288191aa0398e6c55bfb80` | 52,023,926 | 未落地 |
| 官方模型原件 part4 | `libfile_2a1b41dc11448191ac261ca2fe3b8023` | 72,136,343 | 未落地 |

云端交接称四份模型包统一顶层 `model-originals/`，包括 Haru、Koharu/Haruto、Natori、Miara、Hiyori、Momose 教程 PSD、Mao 共七份官方原始 ZIP，以及许可和清单。四包合计 255,258,511 字节；这是交接元数据，不是本机完成证明。

2026-10-08 按当前 Library 技能对五个明确 ID 执行物化准备，得到授权引用与文件元数据。研究包首次下载报 `download failed`；对指定本机目录经相同助手做一次有界重试，明确报 `download failed with HTTP status 403`。没有生成可读的本机包，尚未执行身份扩展属性写入，因此当前阻点不是已证实的 `os.setxattr` 错误。已停止传输；其余四包没有另开绕过路线，也未从云端 `workspace_path` 假定本机存在。

后续需恢复这些 Library 文件的受支持下载访问，再由消费端按当前技能物化并确认可读，校验包内 SHA-256、CRC、许可与安全路径。研究按哈希与已有文件合并；不同字节同名文件保留两版供核对，不覆盖。官方 ZIP 保留原字节并归入本目录；所有素材继续忽略。此任务只整理 Windows 本地路径，不上传素材、不提交或推送。

指定 `C:\Users\22129\Downloads\natori_arm_research_2026-10-02_publication.zip` 未找到；没有搜索无关 Downloads 子目录。现有研究入口见 [本机研究总索引](../../live2d-research/local-index.md)。
