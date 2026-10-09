# 可解析学习数据

本目录包含从实际源文件提取的结构事实和原创分析，不含 PSD、纹理、moc3 或配置原文件。仓库为 public；米粒包内说明禁止再传播包内文件，莉尔许可未知，因此原资产只在本地忽略目录保存。当前统一入口为 [model-originals](../model-originals/readme.md)，旧 `local-assets/` 副本保留。学习用途不自动赋予再发布许可。

## 米粒 PSD 结构

[milly-psd-structure.json](milly-psd-structure.json) 来自已得到的 `Milly原画.psd`，不是根据文件名生成的模板。

- 3200×4800、8 位、RGB、4 通道，文档分辨率 72 DPI。
- 169 条 PSD 记录 = 107 个普通层 + 31 个组 + 31 个组结束标记。记录数不等于绘画层数。
- `records` 保留原始记录顺序；`rootIds` 与每个节点的 `children` 提供从上到下的树。组结束标记保留用于核验，不放入绘画节点的 children。所有组标记配平，记录及通道长度覆盖层信息区，全部名称从 Unicode 字段读取。
- 节点 ID 关联资产 SHA-256 和记录序号，同一文件可稳定复现；不是跨文件版本不变的实体身份。
- `bounds` 是 PSD 保存的矩形，不是透明像素外接矩形。`visible` 是本层旗标，`effectiveVisible` 只加上祖先显隐，未模拟蒙版、剪贴、透明度和渲染。组自身混合与 `groupBlendKey` 分开保存。
- `notParsed` 明列未解析数据：像素、蒙版内容/几何、效果、矢量路径、文字、调整描述、fill opacity、剪贴链渲染与合成外观。

### 可直接学习的真实层关系

左右手组均有六个直接子层：手掌与指1–指5。原层名的 L/R 和序号不擅自改成拇指、食指等解剖名。嘴组含嘴上、唇彩、嘴下、上牙、下牙、嘴内。脸组保留脸色、脸线、下巴线、红晕、侧面/下巴阴影及发影组；发影下再组织前发与前侧发阴影。上身同时出现外组、内组和同名普通层，节点 ID 可消除仅按名称寻址的歧义。

107 个普通层中，102 个 `norm`、5 个 `mul `，5 层剪贴旗标为真；源文件全部非结束标记记录的显隐旗标为可见。这些是结构事实，未证明每层最终都有可见像素。样本同时保留普通层与 Multiply，不能把单个视频的模式取舍当作通用禁止 Multiply。

结构数据可用于学习部件颗粒度、绘画构成与层序关系；仅凭名字和 bounds 不能证明隐藏补画是否完整，也不能验证绑定效果。未改 generic 或实现动画。

## 莉尔运行结构

[lier-runtime-index.json](lier-runtime-index.json) 索引实际 runtime 的 11 个文件、SHA-256、model3 资源关联、CDI 标签和物理输入/输出关联。

- 197 个显示参数标签，72 组物理关联；所有 model3 资源引用存在。
- 参数 ID、显示名和组关联来自 CDI，不含从 moc3 才能确认的取值范围、默认值或网格结构。
- 物理索引记录输入/输出参数 ID、类型、权重、反射与粒子数，不复制完整物理配置。
- 无 PSD/cmo3；纹理没有解析为绘画图层。`notParsed` 与 `interpretationLimits` 明确限制。

## 本地完整学习包与复现

本机 `model-originals/milly/` 保留米粒的 PSD、原画和运行包，`model-originals/lier/` 保留莉尔运行包；均精确忽略且未推送。原 ZIP 在 `model-originals/archives/`，原 Downloads ZIP 与旧 `local-assets/` 解压副本保留，复制逐文件 SHA-256 已核对。其他机器不会因克隆仓库获得这些源资产，须从原作者按许可自行取得。

使用已有 Python 3 的标准库复现，无需安装包：

```text
python tools/parse_learning_assets.py --psd model-originals/milly/Milly原画.psd --runtime model-originals/lier --out data
```

脚本只读源文件，不执行其中代码、不解码或导出像素。解析依据：[Adobe PSD 文件格式规范](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/)。来源和许可状态见 [总索引](../readme.md)。
