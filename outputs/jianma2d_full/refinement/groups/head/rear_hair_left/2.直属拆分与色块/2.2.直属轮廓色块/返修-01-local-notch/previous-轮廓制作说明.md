# head/rear_hair_left 直属轮廓色块制作说明

当前结论：四个直属孩子已制作并完成本轮实际图检，**等待独立审查**。默认4×检查为内幕、固定发根、中央尾束PASS0；外幕RAW FAIL4（0.25px²）。失败报告未改写，详见 `原曲线与AA核对.md` 及可复算JSON；不能将本次交付称为四孩子全部通过。

- 作者/实际worker：`/root/group_rear_left`，身份 `group:head/rear_hair_left`；当前节点 `2.2.group_child_layers`，配置 `gpt-6-astra-xhigh.model`。
- 已重读路由、本节点YAML、提示词及独立SOL 2.1拆分依据；配置副本见 `config/`，输入及配置哈希见 `input-and-protected-hashes.json`。
- 冻结父guide SHA256：`f3b5fa892293fa2a6ed5796d50e04e1151883354a185639474ccdb689ce2afee`，快照 `input-groups.svg`。
- 当前树为总控已expand的四孩子版本，SHA256 `088d6ff77ea068d911a331342a861a36c6d6a77e30c5a51b48ad157b5f828095`。制作中没有修改树、cursor或状态。
- 当前完整候选 SHA256：`4b7179f7b86559b499efcb8213760934949e75f1a5194fb5e647ef6ac4e02ddf`；白底预览 SHA256：`d9bf75ab7d72eff0e1017ec17bde053dbb24f182158b66f7dfa475a325546ab2`；当前原始范围报告 SHA256：`eaceb1e6d4cb890ec7def18ecec7b8e5f6b537d78e016ecc2a0a7666e882ff5b`。

## 四个直属孩子及真实归属

| 完整路径 / 容器 | 形体与连接 | 当前范围结果 |
| --- | --- | --- |
| `head/rear_hair_left/inner_back_curtain` / `group-head-rear-hair-left-inner-back-curtain` | 绿色 `#78AA9E`，原hidden全部、neck连续下接面、main的身体内侧条带及约(360,1423)回勾发梢。按左侧走势画内部界面，与外幕约5px重叠；下端回勾原外缘不变。 | PASS0 |
| `head/rear_hair_left/outer_back_curtain` / `group-head-rear-hair-left-outer-back-curtain` | 紫粉色 `#C18BAE`，原main左侧完整外缘、耳侧孔、两段长回环及多枚下部分叉。只新画内部拆分边界，不照搬右侧斜飞束；两个长孔及开放分叉原命令完整保留。 | RAW FAIL4，原曲线阈值点待独立复核 |
| `head/rear_hair_left/occipital_root` / `part-head-rear-hair-left-occipital-root` | 金色 `#E3B666`，完整原root及neck，保留后脑贴头面与耳后固定接头；neck与内幕允许真实重叠，不沿父路径边硬切。耳侧透明孔仍为空。 | PASS0 |
| `head/rear_hair_left/central_back_tail` / `part-head-rear-hair-left-central-back-tail` | 蓝紫色 `#7B8BC7`，完整原central-tail，约x425–457、y812–1310，隐藏连接端至单尖是连续柔束。保留上端与hidden搭接，未合入宽发幕。 | PASS0 |

所有孩子各有唯一外层g，以完整data-group-path或data-part-path绑定，闭合纯色填充、stroke=none。三处耳孔资源按各孩子完整路径前缀命名，几何与父原耳孔相同，defs/clip局限在各自孩子；中央尾束不增加无关clip。选用稿没有内部拆分clip或父范围mask。当前父五条自身路径及原耳孔资源原文冻结。

## 本轮实际看图

27张编号图全部实际查看，精确参数见 `render-commands.json`，每张PNG的SHA见 `actual-views.json`。

| 组件或目的 | 实际查看图证及判断 |
| --- | --- |
| 四孩子组合去父 | `01-four-children-no-parent.png`、`10-children-root-4x.png`、`16-children-seam-and-hooks-4x.png`、`17-children-waist-seam-4x.png`。组合中根部与两幕连续；外环、分叉和末梢间背景保留。没有使用父底稿盖住孩子接界。 |
| 内幕 | `02-inner-reference.png`、`08-inner-root-line-4x.png`、`15-inner-hook-4x.png`；贴身隐藏面完整，颈后向下转接连续，下端原回勾细尖保留。 |
| 外幕 | `03-outer-reference.png`、`09-outer-root-line-4x.png`、`12-outer-long-loop-4x.png`、`13-outer-lower-loop-4x.png`、`14-outer-branches-4x.png`、`19-outer-ear-8x.png`；左侧两回环、全部外飞/内收尖端及透明孔完整。 |
| 固定发根 | `04-occipital-base-4x.png`、`05-occipital-line-4x.png`、`18-occipital-ear-8x.png`；后脑/耳后连续形体及耳孔细边保留。 |
| 中央尾束 | `06-central-tail-reference.png`、`07-central-tail-line-4x.png`、`20-tail-root-8x.png`、`21-tail-tip-8x.png`；完整窄束与单尖保留，上端位于身体遮挡下并与内幕重叠。 |
| 整图 | `11-whole-blend.png`，当前完整候选与原色参考50%混合，头部与身体其他carry完整。 |
| 原曲线4点 | `22`–`25`四张AA位置线参考/冻结父/孩子8×对照；逐点证据详见AA说明，不据小面积直接通过。 |
| 合成覆盖2点 | `26-coverage-edge-1-8x.png`、`27-coverage-edge-2-8x.png`，覆盖差异已如实记录。后者为父原本存在的分叉负形尖端。 |

彩色参考895×1758；线参考895×1757，每张线参考局部图都显式同坐标reference-crop，未全图高度缩放。未深入两个group的下一层，也未进入运动补齐或正式geometry/rendering。

## 原始范围、覆盖与保护

默认工具使用冻结父、当前树与实际完整候选，scale4/alpha128。`轮廓检查.json` 真实status=fail，返回码1，三个孩子outside_samples=0，外幕outside_samples=4。四点均父alpha127/孩子128，对应完全相同的原父三次曲线；保存高精度t、相同填充方向及半径8px内无第二边界的证据，等待审查自行核验。

去父组合阈值覆盖比父少2点、多106点，原始坐标及alpha保存在两个coverage JSON中。该合成统计与逐孩子范围统计分开记录，未将它们写作“全部0”。实际图检没有看到新增内部白缝；极细背景开口与输入父一致。

`protection-and-result.json` 证明新增四孩子容器后，删除本次新增XML片段可逐字节还原输入完整SVG；全部原有32个绑定容器原文未改，含左父、head母层和右后发完整已完成孩子。SVG根属性、当前树、正式7个part、正式根defs23资源、registry4层及两张参考字节不变。

- 正式稿：`c2908354bb04f5380c5c22173d0df5b24ceb861d25c0634a52d13d51bba8e60f`。
- 注册表：`e0ef1a24f3a5bae878deafdb6b9fd3fae420d0e548184578b199a6c813ad8538`。
- 替换前guide/preview仅文件备份至 `tmp/history/rear-hair-left-child-layers-20261006/`，没有目录自递归。

## 交接

标准候选、白底预览、当前RAW范围报告以及本说明交新独立reviewer。未完成项是RAW4点及合成边缘差异的独立裁决；父母层真实几何没有被缩小或篡改。到此停止，未进入2.3、13个正式节点、下一层拆分，也未创建其他会话。
