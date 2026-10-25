## 制作与判断依据

使用 skill 内的 `shared/physics-core`、`shared/physics-evidence` 和 `shared/character-render`。它们拥有格式、求解、固定步输入及颜色／表面渲染；不需要工作台服务或 `web/`。真实移植源码及适配边界见 `shared/physics-core/vendor/README.md`。

先确定材料、连接和自由段，再选方法：游离发束／窄软带使用 psd2live/Cubism 短摆链，规则布片使用 psd2live XPBD，硬坠使用 Inochi2D 非线性摆。配方由 `physics_recipes` 提供，只作初值。当前成功案例的数值不是所有角色的模板。

- 头发：逐区分析前发、刘海、侧发和后发；贴头根部与发盖固定，有明确自由段才活动。宽发束保持截面，弯曲集中在中后段，避免全头果冻化。
- 布料：腰口、缝边或袖口固定；新宽片可从 `controlGrid:[4,8]` 起步，控制格和显示剪影分离。同源认可参考先保留其控制格并测试，不统一加密；点数增加可能改变自由控制点位置和约束传递，必须用实际响应判断。横向允许剪切／压缩，纵向保持长度，避免刚板摆或局部抽搐。窄飘带用 strand。
- 饰物：冠饰、耳坠、领口／胸前坠、腰饰等逐件判断。硬坠保形；父片—下游坠使用真实 `supports.componentId`，按完整装配组模拟。实际双端耦合、闭环或一层内多个独立活动区暂缓。
- 贴胸／贴布的双端拉紧珠链按所属表面跟随；没有松弛自由段时不单独摆动。小接环被两侧链牵制时也不能假设为自由硬坠。下垂且有自由段的链、流苏与挂坠仍进入物理，不能整类跳过。

作者坐标始终为原画布像素。根、固定多边形、连续过渡与轮廓必须来自原尺寸源层；`freeLength` 为真实自由长度。strand 中心线的每个点有对应横截面宽度；cloth 的 contour／holes 保留完整源像素；pendant 的 pivot 为实际挂点。多源层可共用一个场，保留 UUID、内容指纹、层序与原 UV。

使用 `physics_catalog` 读取 schema 默认值，再保存完整 `kind:'astra-component-physics', version:1, solver:'astra-component-physics-1', source:{canvas:{width,height}}, components`。每组件有 `id,name,kind,priority,enabled,sourcePartIds,layerRefs:[{uuid,contentHash}],supports:[{id,at,componentId?}],authoring,response,material,limits`；详细类型位于 skill 的 `shared/physics-core/component-physics-schema.js`。六项最大约束为 maxTravel（自由长度比例）、maxAngle、maxStretch、maxCompression、maxShear、minAreaRatio。它们是边界，不是可无限放宽的调参手段。

保存后用 `physics_assemblies` 确认全部有向支撑。对每个启用装配组调用 `physics_calibrate`，保留 baseline 与有限 response/material 候选：微风、轻扫、支撑释放使用相同的 120 Hz 输入尺度；比较根残差、末端／中段曲线、速度、曲率、回落、顶限和 fallback。明确选择候选并记录依据。每组最多三轮；新来源或求解器规则形成新代，旧记录归档。候选建议分数仅帮助比较，不能自动证明视觉自然。

九组完整复核保持整数 120 Hz 步和无损轨迹。查看均匀颜色序列、光照对比、normal/depth，再补峰值、反向、fallback 的密集窗口及原尺寸接口。根部应稳定，中后段有相位差；持续 wind 期间保留可见响应。所有非静止输入（包括 extreme）在原 960 步结束后追加无输入回落，按完整装配和内部速度证明连续 60 步近静止，并查看最后两张颜色帧。原输入、自由段及限幅保持不变，尾段不稀释原片段的顶限／回退计数。长期顶限、重复回退、突然跳变、硬坠拉伸、贴头处位移及接缝错位都需要返修。

C 只读取、模拟和复核。六项结论 attachment/shape/response/limits/layers/surfaces 必须引用当前实际查看的图片；数值正常不等于动画自然。否决或缺证据用 `physics_request_repair` 记录 component、criterion、verdict、reason、test、steps、images，随后返回 blocked；调度器恢复 B 的原会话，最多三轮制作／复核，再以新 C 会话复查。人工结论保持 unreviewed。

法线、深度和颜色应用同一部件形变，深度大体保持原部件内部关系。投影素材跟随 caster，再按当前 receiver alpha 裁切；不宣称重新计算了三维投影或验证了大深度变化。保留原贴图精度，不以降画质换动画证据。
## 认可参考与程序初始化

`physics_reference` 返回显式参考的匹配来源和完整绑定。同 UUID／像素／实际支撑匹配时，用 `physics_initialize_reference` 初始化，不重猜已经验证的自由段；不匹配则从当前源图建立几何，用 `physics_initialize_parameters` 取得类型／长度相关参数。参考初始化必须记录来源，不能写成无参考从零制作。

`physics_autotune` 是程序有界搜索，模型修正具体失败组并检查连续帧。认可参考的运动峰值与活动 RMS 是目标，通常保留 80%–130%；自由段严重缩水直接修几何。弱响应或持续回退候选不能被选择；不能为了“平滑”压掉全部运动。详情见 formal 14，几何、限幅、原图精度及独立复核照常保留。
