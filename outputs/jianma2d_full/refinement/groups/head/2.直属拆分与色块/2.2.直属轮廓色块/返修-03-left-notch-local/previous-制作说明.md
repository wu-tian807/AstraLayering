# head 2.2：同步正确冠梁与左右内桥

本轮指定 2.2 制作已完成，实际制作者 `/root/group_head_ear_gap_recovery`，逻辑身份 `group:head`。提交当前候选供总控安排独立审查；这里不是独立审查结论，也未 checkpoint 或推进后续节点。

输入冻结 head guide SHA `f4a95e38339af8b7b374d414a2a33b6b007937f6c4bf43028e248b2ee00e8b1d`，输出候选与标准 guide SHA `dc53125f3eab4c6f0e3fe016146df7bffeca8903368ea0508cc28f05691e749b`。候选在 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/candidate.svg`；标准白底 preview SHA `684a181c9e446f27e4dc7daf9790a42e0a5d1ab3e8c9e6d1c55e7deec209b22e`。旧 a3d 右耳制作说明完整保存于 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/tmp/history/head-crown-child-sync-20261006-01/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/制作说明.md`；原节点 `candidate.svg`、input、图证及继承记录保持原有历史身份，本次不覆盖它们。

唯一几何变化是 `head/crown` / `group-head-crown` 下 `head-child-crown-arch`、`head-child-crown-left-scroll`、`head-child-crown-right-scroll` 的三个 d。完整 d 按 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s5/refinement/groups/head/crown/1.父级轮廓补全/返修-01-parent-recovery/candidate.svg` 的原文字节复制，源 SHA `07bd7b008a8afc0c79453316638dca5e810082ada6ef465a73d5b93d89489f9d`。当前候选与上一节点1的临时正确 crown fixture 字节一致。没有引入 crown 子序列的 hidden anchors 或其五个下级孩子；当前 crown 自身仍为原 8 条路径，另外 5 条路径、颜色、其他属性和排列均保持。

新冠梁沿原色参考校准顶部窄弧及两肩，修掉旧弧肩向内下方的偏移。双内桥仅将小横梁延至左右竖翼，闭合原约 0.875 px 的透明竖缝。原色、线稿、前后差分均在顶部、左肩、右肩、左桥、右桥分别同坐标 8 倍实际查看；图内独显没有 head 父底稿。线稿冠梁整体较高，形体位置继续依原色，不据此整体上移。

已实际查看 crown 整体独显/原色/线稿、正确右耳弧的原色与线稿 8 倍、全 12 孩子去父整体、去父冠部 4 倍和耳侧 8 倍、冻结 head 独显、完整混合及最终标准 preview，共 26 张。冠梁和双桥在去父组合中连续；冠梁下的大背景孔、双桥下孔和耳弧两侧负形仍可见。右耳仍向左下回收并渐尖，冻结的 `head-framing-right-loop` 原文和整个 right group 都与本轮输入及上轮耳候选一致。生成坐标和图 SHA 见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/render-manifest.json`，实际判断见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/实际看图记录.json`。

范围检查使用本轮 `input/groups.svg` 的冻结 head，默认 scale=4、alpha=128，全 12 个直属孩子 PASS、outside_samples=0。冠梁、左右桥和右耳关键 crop 的 8 倍包含也均为 0。左右桥各 7 个明确坐标缝样本由 alpha 0 变为 255；大背景孔 [410,32,48,10] 和双桥下孔 [379,128,3,2]、[490,128,3,2] 的 8 倍 alpha 与输入相同，最大值 0。右耳 crop [490,255,50,103] 的 8 倍 alpha 前后完全相同。见 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/局部8倍与负形检查.json`。

保护证据：把这三个 d 逆向替回输入 d，整份 SVG 与冻结输入逐字节相同。所有 head 母路径（含薄耳和新增三个冠饰范围）、11 个其他直属孩子、旧 crown 其余 5 条路径、全局 id 与次序、root/resources 和其他对象不变；D 的 tree、rendering registry、formal、options 与参考 SHA 保持。当前新候选没有新 child、资源或 hidden anchors。

对未改变的 11 个孩子，本轮明确继承已有证据，并比较其整个容器与旧 a3d 耳候选一致。8 个孩子保留 ledger005 记录；左后发沿用此前明确的资源名前缀等价证明；右耳坠沿用 `/root/group_head_motion_recovery` 在 r1 的真实 motion 产物和检查；右耳旁 group 沿用此前 e2d 校准证据，并在本轮实际重看耳弧局部。其他旧孩子未声称重新逐件审查；其出处及严格比较在 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/继承证据.json`。本轮 crown 采用新图复查，旧 ledger crown pass 不用来覆盖此前发现的冠梁和双缝问题。

备份仅逐个复制本轮替换的 9 个标准文件到 `/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/tmp/history/head-crown-child-sync-20261006-01`；没有递归复制旧 history。独立 SOL 的既有空 patch 和 12 实体结构沿用总控 retention 记录，原作者仍为 `/root/group_split_head`，本轮没有执行结构节点。当前任务内没有未处理的已知三处同步问题；冠饰子序列自身新增隐藏连接及其下级返修仍由 r2s5 负责，本轮未代做或宣布其完成。新候选整体是否通过由独立 head 审查决定。

标准范围报告：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/轮廓检查.json`。本轮保护：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/返修-02-crown-sync/保护证明.json`。输出及作者 manifest：`/Users/wutian/Desktop/coding/AstraLayering/outputs/jianma2d_full/tmp/dispatch-groups.dispatch/r2/r2s10/refinement/groups/head/2.直属拆分与色块/2.2.直属轮廓色块/output-sha256.json`。未执行运动、13 节点、formal、cursor、状态变更或新 agent。
