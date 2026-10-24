# Jianma 手动摆动物理预览

这是一版手工绑定和调参的预览。正式衣料配置保留在原来的 `physics.json`，手动版本保存为 `physics.draft.json`，不标记为工作流通过或用户确认。

前发只固定发根，开放中段和发梢。短摆链驱动逐级弯曲，保留原画的曲线长度；截面平行设置避免宽发片像板子旋转。冠带使用适合窄软带的截面旋转，两侧的周期略有差异。风力响应和形变输出分别标定，位移、摆角、伸缩与面积约束仍生效。

腰挂补全了双悬绳、连接结与短珠链、雪花、两段银链、水滴与莲花连接件。原有双环、扣件和白流苏按真实挂点连接在后面。金属片保持刚性，各段有不同的时间响应；白流苏保留受约束的弯曲。

`cloth.json` 单独记录本次下方衣料的 8 组调参：两侧长前襟、内裙、三块长垂袖和两条腰带长布。降低原来 3 Hz 的快速回弹，放松抗压、剪切与弯曲；两侧前襟采用一致的纵向控制密度，固定区过渡保持连续。最大位移、摆角、伸长、压缩、剪切和面积上限均未放宽。其余 38 个组件与上版一致，保留已认可的头发、冠带和腰挂设置。

布料运行时保留 psd2live 最后子步的速度，避免展示前再次按外层步长取平均。安全投影仅移除被阻挡方向的速度，不把位置修正变成额外反跳。绑定编辑器直接设置父级姿态时仍正确继承父级速度。原始 `physics.json` 没有修改。

实现参考用户提供的《头发物理制作（上）》视频中的父子弯曲变形器，以及 [psd2live SwingDeformer](https://github.com/tsunehimatoi/psd2live/blob/master/src/main/kotlin/io/github/psd2live/core/SwingDeformer.kt) 的分段弯曲与截面平行处理。[摇摆生成说明](https://github.com/tsunehimatoi/psd2live/blob/master/docs/zh/guide/SWING.md) 区分了曲线弯曲和横截面旋转的用途。

`overrides.json` 记录头发和挂饰的手动修改与新增组件，`cloth.json` 在此基础上调整下方布料。保留原图层 UUID、像素指纹、顺序和 UV。安装时核对原配置的 SHA-256，避免覆盖不同源工程：

```sh
node rigging/jianma/manual-physics-20261024/apply.mjs <项目>/physics/physics.json <项目>/physics/physics.draft.json
```

运行逻辑验证固定区、形变限制、布料速度和挂点旋转；`cloth-validation.json` 记录本次连续预览与回放结果。微风、轻扫和停风回落在同一画布检查；效果仍需用户复核。这里不代替物理制作工作流的验收。
