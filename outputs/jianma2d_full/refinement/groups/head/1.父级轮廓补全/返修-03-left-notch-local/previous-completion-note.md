# head 父级轮廓补全：冠梁与左右内桥范围返修

本次仅完成节点 1。标准 guide 已更新，等待总控 checkpoint；未推进 2.2、2.3、运动、正式绘制或游标。实际制作者为 `/root/group_head_ear_gap_recovery`，逻辑身份仍为 `group:head`。

输入 guide：`a3d9513e5fae1bf11d1aee0705211ae4dacea555da9d72d78e7accc2fa821d94`。输出 guide：`f4a95e38339af8b7b374d414a2a33b6b007937f6c4bf43028e248b2ee00e8b1d`；白底 preview：`713ff80cedb59a4071c914148cb7ede351fdd021fcd9b2690abbc5c0492766af`。

正确 crown 来自 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s5/refinement/groups/head/crown/1.父级轮廓补全/返修-01-parent-recovery/candidate.svg`，SHA `07bd7b008a8afc0c79453316638dca5e810082ada6ef465a73d5b93d89489f9d`。其独立审查 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s5/reviews/group_child_layers/head/crown/审查.md` 已指出双内横梁 0.875 px 竖缝和冠梁肩部范围偏差。本次实际打开该审查的肩部、双缝原色及线稿证据、正确 crown 校准图和旧 head 不包含的诊断图，未使用旧审查结论覆盖新发现。

本次只在 `group-head` 自己新增 3 条路径，旧自身路径（含耳尾薄补形）全部保留。冠梁补形 `head-crown-arch-reference-continuation` 采用正确 crown 的窄弧带轮廓：外、内两条弧共同限定范围，并在两肩接入原形。它不是包围盒填块，拱下的大背景孔保持透明。左右内桥分别增加 `head-crown-left-inner-beam-continuation`、`head-crown-right-inner-beam-continuation`，在 y=120–124 延续 4 px 厚横梁；小圆曲端埋入原有竖翼和横梁，闭合竖缝而保留下方孔洞。

原色是冠梁位置的校准依据；线稿在这里整体较高，仅用于结构和连接核对，没有据此移动整冠。五个区域的原色、线稿和父形前后对照均采用相同明确坐标、8 倍放大，见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/render-manifest.json` 和 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/实际看图记录.json`。已实际查看新 head 独显、冠饰整体、正确 crown 去父、正确 crown 加父组合、整图混合和发布后的白底预览。旧父弧的下沿保留为父范围，不把它冒充为正确 crown 孩子已发布。

默认检查使用候选冻结 head 与临时 fixture，全 12 个直属部件在 4 倍、alpha=128 下 PASS，outside=0。fixture 仅把 `head/crown` 自己对应的 3 个 path d 换成正确来源原文；其他属性和对象保持，source 的下级孩子及额外路径没有引入 D。标准 guide 中 crown 孩子仍逐字保持输入，后续必须由总控明确派发 2.2 才同步。

关键 8 倍局部包含检查：冠梁原越界 34160 samples、左桥 247、右桥 247，均降为 0。左右缝各 7 个明确坐标样本从 alpha 0 变为 255。整 head 4 倍增量为 8671 samples（541.9375 px²），bbox=[372,16.75,130.75,107.25]，减少覆盖为 0。冠梁下大孔 [410,32,48,10] 与左右桥下孔 [379,128,3,2]、[490,128,3,2] 的 8 倍 alpha 原文相同且最大值 0。证据见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/局部8倍与负形检查.json`。

保护验证通过：从候选删除这 3 条新增完整行后，与输入 guide 逐字相同。全 12 直属孩子、已校准 right 耳尾 d、所有旧 head 自己路径、其他对象、root 和 resources 因此原文保留；tree、rendering registry、formal、options 及 base/line refs SHA 均与冻结输入相同。旧 2.2 证据没有改写，也未声称重新审查其余孩子或完成冠饰下级返修。保护详情见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/保护证明.json`。

输入快照见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/input`。本次会替换的 7 个标准文件已逐个备份到 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/tmp/history/head-crown-parent-recovery-20261006-01`，manifest 记录 SHA；没有自递归复制旧 history。原耳尾节点 1 的候选与证据仍保留，本次候选和所有新证据单独放在 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range`。本次仅交付父范围，不代表整 head 独立审查通过。

包含报告：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/fixture-包含检查.json`。当前候选：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/返修-02-crown-range/candidate-parent.svg`。输出 manifest：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/1.父级轮廓补全/output-sha256.json`。
