分析全部源 part，明确固定处、连接、自由段、前后层和共享运动。
bind 必须能在当前装配安全启用。若运动会拉开仍暂缓的下游接口，且运行时无法携带该接口，就将该部件及确受影响的祖先明确 defer，写出具体连接和 unsupportedTopology；候选配方可保留为参考，不能列 bind 后再禁用。姿态随动的上游固定挂点可支撑可验证的独立下游分支，避免整类首饰一起暂缓。
看源层优先使用 physics_source_image 的 uuids（每批 8–16 层，原尺寸编号拼图）。不要逐层累计几十张独立图片；按编号和原 bounds 检查连接。完整长说明通过 physics_catalog 的 partIds 按部位读取。
逐区检查前发/刘海、侧发、后发、布料、耳坠/冠饰/衣饰，不能只做后长发和下摆；这不是要求所有头发运动。发盖、梳紧的发髻和贴头区保持固定，只有有依据的自由尾端/外侧/游离束进入物理；同一层的根部固定，连续过渡到自由段。小挂件可以比大布片重要，不能仅按像素面积把全部硬坠归为 secondary。
先看整体与实际原尺寸源层。长发/飘带用连续曲线，宽袖/裙片用布片，硬吊坠保持形状。固定的头皮、腰口、袖口不随整张图粗摆。颜色、印花与所属表面共用场；分裂到不同层的同一布片归同一组件。投影素材跟随 caster，并由 receiver 的动态 alpha 裁切。
覆盖每个 part：bind/defer/excluded 和原因。primary 是显著自由段；all 再包含有可靠连接依据的短自由边和挂件。身体、眼口、胸部果冻、刚性服装排除；看不清连接的部件保留 defer，不猜绑骨。闭环装配或同层多活动区当前求解器不支持时明确 defer，不伪装成单根绳。
短链+硬坠可以共用一个保形悬摆；多张前后穿接的硬环片共用刚性变换不等于动态闭环。先检查现有 supports.componentId 是否可表达有向装配，真正的双端耦合/同层独立区域才暂缓，不能把所有首饰一律说成求解器不支持。
使用 physics_catalog、physics_source_image、physics_save_plan，交付 version:2 的 analysis.json、coverage.json、report.md。每 part 记录 motion:{family(hair|fabric|accessory|other),region(实际部位),freedom(free|fixed|follow|uncertain)}。无自由段的 fixed 排除；仅随所属组件的层用 follow；deferCode 限 profile-secondary、uncertain-connection、unsupported-topology，后者另说明 unsupportedTopology。all 不允许 profile-secondary。方法依据附带的 physics/guide.md 和实际源层，不按名称直接套整层摇摆。
先读取 physics_reference。显式参考中 UUID／像素匹配的活动部件是本轮覆盖目标；检查其真实支撑，不得把已支持的前发、飘带或中间挂件重新整类暂缓。同源参考可保留组件划分与固定／自由段，避免把“固定头皮”误扩大成“固定整撮前发”。来源不匹配时根据当前图重建，不能按名字套绑定。
区分动态反馈闭环与同姿态双锚。两个上端均固定在同一姿态、下方共同悬挂，可采用参考已验证的统一场及单向下游，记录为视觉等效绑定；不因为画面有两个挂点就判 unsupported-topology。只有求解确实要求两个活动父体互相反馈或一个源层分成独立场，才按具体连接暂缓。参考中已验证的统一场不能被重新假设为完整双向耦合而拒绝。
双端拉紧、贴胸或贴布的珠链没有独立悬垂自由段时，按所属表面的 follow/excluded 处理；不能把小接环独立振荡，再用单向场拉着两条绷紧链。链有真实松弛自由段且两端可能相互牵制时，具体记录需要的双端反馈及当前支持范围。不要为了 all 覆盖制造原画没有的运动；已认可的自由挂坠照常保留。
