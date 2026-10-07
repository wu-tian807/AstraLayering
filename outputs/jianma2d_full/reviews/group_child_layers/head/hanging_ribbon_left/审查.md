# head/hanging_ribbon_left 直属轮廓色块独立审查

审查身份：`group_child_layers:head/hanging_ribbon_left:review`。范围：当前树中的 1 个直属 group 与 1 个直属 part；仅检查轮廓、孔洞与连接，内部绘制留待后续节点。

候选：`block-layers/groups.svg`，SHA-256 `33890c4a3642c0ea793e857f5da66531432b9c655c676f7f040227ee7ce0e2e7`。已核对其与本节点 `candidate.svg` 字节哈希一致；输入 `input-guide.svg` SHA-256 为 `9f3683c1c13778ace8f24dc82425df4eddb526d2d3d5b93e9c5aaba7306a6de9`。父容器未变，移除两个新子容器后，既有 SVG XML 与输入相同。

实际先查看 [整图与参考 50% 混合](evidence/01-whole-mix.png)：左侧挂件与带条从冠翼垂向腰侧，位置、长度和倾向与参考一致；接着按树逐一独显对照。

## head/hanging_ribbon_left/jeweled_hanger — PASS

- 容器 id：`group-head-hanging-ribbon-left-jeweled-hanger`。
- 实际查看：[独显、参考、混合及边缘叠加](evidence/02-jeweled-hanger.png)，原图裁切 `(288,126,37,74)`、8 倍；使用指定预览工具 `--only ... --reference ... --edge-overlay`。
- 沿冠翼下挂点至最下连接环逐段查看：上端两枚环、菱形宝石、圆形坠饰和下环俱全；三个环孔保持透明，上两环在约 y144 接续，菱形四角与圆坠外沿对准参考，未见漏掉的独立小块。顶环伸入冠翼边缘的搭接合理，下环延续至带顶内部，未把冠翼或柔软带面归入本层。
- 结论：主要形状、孔洞与真实穿挂关系通过。参考本身的抗锯齿软边与纯色色块的锐边有正常差别，未见明显轮廓偏移或断裂。

## 范围检查

复用本节点现有 `轮廓检查.json`：报告绑定正确的输入、候选、父 id、group_path 与两个直属路径；生成时间晚于冻结输入/候选，冻结候选与当前标准候选哈希一致。原生默认 4 倍、alpha_threshold 128 下，两子层 `outside_samples = 0`、`outside_area_px2 = 0`，总状态 PASS。此项只判定父范围容纳，不替代上面的参考图独立判断。

## head/hanging_ribbon_left/ribbon_strip — PASS

- 容器 id：`part-head-hanging-ribbon-left-ribbon-strip`。
- 实际查看：[整条独显、参考、混合及边缘叠加](evidence/03-ribbon-strip.png)，原图裁切 `(264,173,65,383)`、4 倍；使用指定预览工具 `--only ... --reference ... --edge-overlay`。
- 从约 `(303.94,179.85)` 的带顶小凹接逐段沿两肩、两条长边、左弯尾部直到 `(273,544)` 尖梢核对。带顶泪滴孔确实透明，未被填死；y194 双肩没有切断柔性带面；长带的宽度与向左下转弯连续，近肩臂遮挡处保持完整延续。最下方窄尾收尖齐全，未误截在遮挡起点或遗漏尾缘。
- 带顶与挂件下环共享真实穿挂区：上端凹口承接下环，参考中的带顶轮廓和小孔仍能分别辨认；整图混合以及上下两份局部证据未显示新增缝隙、断层或错误多余连接。
- 结论：整条柔性带面连续，可见外缘与主要转向对准参考，通过。

## 总体结论：PASS

两个直属组件均已实际独显并完成参考边缘判断；范围检查也通过（越界样本 `[0,0]`）。无需返修。本审查未修改输入、候选、结构、技能或运行状态，未执行 checkpoint、complete 或发布。
