使用 skill 共享求解器和渲染器，执行 physics_simulate，保留 9 个规范输入与所有 120 Hz 网格轨迹。
先检查 metrics.motionReview 和 events：弱响应、连续回退、持续顶限、跳变或停止后不衰减必须交回 B 修复，不能用数值合法放行。再检查固定残差、翻折、限幅、fallback、停止后稳定。fallback 必须查看对应密集窗，不能以最终合法为由忽略顿挫。查看均匀序列的颜色和光照（physics_evidence_index、physics_view），再用 physics_frames 按峰值/反转/限幅前后 12 步补充 60 Hz 或 120 Hz 窗，检查原尺寸接缝、自由段弯曲、层序、法线和深度。人观看连续运动，不能只拿两张好看的峰值图过审。
findings 结构：evidenceVersion/configHash/components；每项 id/criteria；criteria 为 attachment、shape、response、limits、layers、surfaces；每项 verdict(supported|rejected|needs-evidence|unreviewed)/reason/images。图片必须来自当前索引并实际查看；attachment、shape 至少引用该组件的原尺寸 crop；shape、response、limits 引用不同时间。每组件各测试查看运动 lit，另查看运动 normal/depth；首个 fallback 补前后 1 步，最大峰值补前后 2 步颜色。时间依据整数步，不造插值帧。
新复核的看图记录按 review-session.json 的 id 隔离；颜色、表面与参考图都必须属于本人当前 reviewSession，不能把 B 或另一个 C 的记录算作本人覆盖。同一会话中断恢复后，已实际查看的同指纹图片继续有效。共享整帧可以覆盖多个组件，先去重请求；已有规定窗口通过且没有具体新疑点时，不为每个微小反转机械追加完整矩阵。说明实际选择的异常与反转窗口，具体疑点继续补证据，数值合法不能代替视觉判断。
每组件至少通过 physics_view 或 physics_strip 查看各测试的 0、60、96、180、360、960 步颜色帧；整体原像素序列可共同覆盖组件，局部密集窗用于详细判断，再查看光照对比和各异常窗。支持的结论只覆盖实际证据；人工复核保持 unreviewed，不替用户签字。发现失败调用 physics_request_repair，记录明确组件／准则、原因、test、steps、images，并返回 blocked；不得改写 step02 草稿。调度器会交回 B，再开启独立 C；旧版证据不可混用。physics_submit_review 校验后产出 physics.json、findings.json；最后写 report.md，列出数值、渲染、AI 选帧与人工覆盖范围。

布片若反复回退或不稳定，先检查控制网格形状；可用 authoring.controlGrid:[4,8] 将轮廓与求解格分离，保留完整轮廓及所有固定区。规则格控制位移经过固定区过渡再应用到原网格，仍须逐步检查显示网格约束。不要通过降低输入或放宽限幅回避问题。证据索引按 test 返回事件窗口摘要，physics_trace 默认返回可读指标；全步全网格数据仍保留在文件中。

运行时现已修复父层测试姿态：规范输入 v3 同步移动整角色父层与所有支撑，位移幅度按最长自由段确定，不降低测试；固定残差相对当前父姿态测量。sourcePose 与全网格一起记录并核对。仍保留单端口输入接口，但局部头／手九轴父层姿态绑定尚未制作，不在本轮验证。新 PNG 在原像素比例外增加固定运动余量，所有帧同一取景，source origin 位于 framePadding，避免剪裁外飘衣片。旧 v1 只移动数学端口、父层静止的图片是已知失败，不能用于当前结论；重新模拟与渲染后继续，不需要外部提供父层映射。
读取 physics_reference（若有），在相同微风、轻扫、父支撑输入下对照活动范围、幅度、滞后与余摆。静态漂亮或仅数值合法不算复现；头发、衣料、挂件任何一类明显退化，调用 physics_request_repair 交回 B。未完成／明显退化候选保留为内部证据，不要求用户代做验收。
规范施力仍是原来的 8 秒片段；长串联在原片段末端仍有余摆时，会额外无输入推进，记录 durationSteps 和 recovery 的连续近静止证明。查看最后两张回落帧，不把有证据的缓慢衰减逼成快速静止；持续顶限、真正跳变和无法回落仍拒收。参考幅度／活动量用去除整角色刚性姿态后的可见运动，保留物理父级带动，不能只比较每个小坠自己的角度残差。
显式参考存在时，必须用 physics_reference_view 实际查看参考版微风 0/180/360/540 步，并在 findings.referenceComparison 保存 verdict:'supported' 和具体 reason，比较当前版的发束自由范围、衣料飘动、挂件传动与余摆。未达到自然感交回 B；数值合法不能代替对比。参考自身失败的装配不强制复制异常幅度，但仍需达到可看的自然运动。
