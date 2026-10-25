读取 step01 分析和源图片，配置各已选择组件的真实形状与连续活动范围。
原尺寸源图按部位用 uuids 批量查看；分析与绑定为独立上下文，依据已保存的分析/coverage 和实际源像素，不能依赖另一会话的临时变量。
前发和侧发先固定贴头根部，仅开放有依据的外侧/尾端；不可让整片头部起伏。硬坠始终保形，短颈和前后片可同场；串联只用真实的单向父支撑。逐个核对 sourcePartIds 和 layerRefs 与分析一致，不能用同名组件却换成另一张层。没有缓存时仍须完整从源层建出配置；本次效果必须由 physics_save_binding 保存。
全部坐标为源画布像素。supports 指实际缝接/头皮/腰口；fixedRegions 为固定多边形，transitionPixels 连续过渡。strand 用中心线和每节横截面宽度，至少 3 节，根部在固定区内；cloth 用完整 contour/holes 与 subdivisions；pendant 用 pivot 和轮廓。freeLength 用实际自由段长度。轮廓须覆盖整张源层，不能裁掉发梢或装饰。
layerRefs 每项 uuid/contentHash 来自 catalog。共享表面所有层同场，但保留源层序和 UV。supports.componentId 仅用于明确的单向连接；闭环 defer。默认参数只是起点：调频率、阻尼和柔顺性，限幅按自由长度；禁止凭空降低验收输入。每项必须明确 maxTravel、maxAngle、maxStretch、maxCompression、maxShear、minAreaRatio。
配置结构参照 skill 内 shared/physics-core/component-physics-schema.js；可由 physics_catalog 取得默认参数。调用 physics_save_binding 验证并保存 physics.draft.json，再写 report.md，解释每个固定区/活动段和复用原因。不要声称尚未运行的动画已经自然。

新布片可从 controlGrid:[4,8]（列、行，各 2–16）起步，以规则控制格模拟，再映射完整 contour/holes；复杂剪影不可直接充当稀碎求解网格。同源参考保留已有控制格，先测基线；只有具体的采样或形状证据才调整密度，不统一加密。增加点数不保证自由控制点的位置或约束传递更好，失败时对照原参考网格。固定边界切入显示网格，固定像素权重为 0。保留 subdivisions 用于显示精度，无需增加到控制网格。狭长连续带子优先 strand。

运行时采用 psd2live/Cubism 短摆链、psd2live 布片 XPBD、Inochi2D 刚性摆。原画中心线点数不是物理节数；显示网格与控制格边界对齐。布片保持纵向拉伸约束，允许横向剪切与压缩；不要用独立位置弹簧或无限增益替代材质。

保存后查看 physics_assemblies。逐个完整装配组执行 physics_calibrate，保留基线并比较曲线，最多三个候选；不能改几何或放宽限幅。用 physics_select_candidate 明确选择，每组当前版本都选定后才能完成。若 physics_repair_request 有当前返修，先看其失败窗口，再修正该装配并重新标定；不能只回应文字。标定分数不代替实际图像判断。
先读取 physics_reference。有完整同源参考时用 physics_initialize_reference 初始化已验证的几何与参数，再检查分析及原像素；不要重新猜一套保守固定区。无同源参考时自行建立真实几何，再用 physics_initialize_parameters 的类型／长度配方取得参数起点。两种初始化都只产生草稿，不能继承通过结论。

保存后先用 physics_autotune 程序执行完整装配的有界搜索，模型只修正返回的具体失败组。参考目标同时约束幅度和活动量；自由段明显缩短应修固定区／中心线，不能降输出倍率来消掉失败。真正的回退或接缝问题应修网格／支撑，不能靠所有部件不动通过。逐次保留失败证据，达到数值和连续视觉目标前保持内部候选。

若 referenceValidation 显示参考装配未通过规范测试，它仍是初始化及视觉参考，不能把已测出的异常强制作为数值幅度目标。对这类组使用 physics_reference_view 与当前帧比较自然感；其余已通过的组保持参考幅度与活动量。刚性挂件可用 response.parentGain 单独调整父挂点移动引入的惯性（默认沿用 inputGain），不影响直接受力；response.outputGain 可调整局部相对摆动，默认 1，不削弱父级随动。小内坠若几乎被所在硬环限制，可缩小自身残差，保留所属硬环的完整运动。不要一刀切削弱整条挂饰。
串联挂件优先通过 parentVelocityLimit 设置继承惯性的速度预算（0.1–20 个自由长度/秒，省略不启用），缓和过快父支点引入的惯性，保留轻微摆动原增益；挂点绘图仍完整随动。先保留认可参数再尝试 2 L/s 起点，避免降低所有 inputGain/outputGain 导致整个挂饰无力。完整装配和压力输入仍照常验证。
