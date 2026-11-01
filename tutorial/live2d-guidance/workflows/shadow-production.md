# 人物投影阴影制作工作流

人物与衣服已分件、补全和组装后，运行 `live2d-maker` 的 `shadow` 管线。一次选择一个分支，默认 `mask`；同项目重复运行不同分支可以保留两套成果。

```sh
# 从 skill 根目录执行；读取同名任务的固定上游
pnpm shadow --name jianma --krita /path/to/krita --shadow-mode mask --knowledge /path/to/knowledge
pnpm shadow --name jianma --krita /path/to/krita --shadow-mode normal-depth --knowledge /path/to/knowledge
# 总流程透传
pnpm start --name jianma --from shadow --to shadow --shadow-mode normal-depth
```

完整流程的顺序是人物 part → 人物 raster → 衣服 part → 衣服 raster → 组装 → 阴影。前端运行面板选择“阴影方式”，其余输入仍按任务固定位置加载。续跑省略模式时，总入口沿用已保存值；独立 `shadow` 入口省略时默认蒙版。

## 蒙版分支

用 simplified 分析角色实际的部件投影范围，用组装 KRA／PNG 的坐标、精度和现有遮挡关系制作。衣服褶皱、身体固有明暗保持现有画法。分件生图通常已自然去掉投影，优先复用干净底色，仅在残留旧影会叠黑的区域局部补画新工程。

直接在 Krita 用画笔、路径／选区绘制并修整阴影，不调用生图模型。阴影完整面积一般远大于静帧可见投影，包含充分延伸与运动余量。按投影物的运动设计阴影形变，再由受影面的当前轮廓裁切。后续允许共用运动域或独立阴影 deformer 修正，不强制复制投影物的变换。例如完整裙摆阴影跟随裙摆，以大腿轮廓裁切；不是将静帧露出的一条暗色预先裁死。动作形变由后续 deformer 处理，这一步不制作动作关键形。

交付 `shadow/mask/step01/character-shadowed.kra`、同名 PNG、`shadows.json` 和报告。Krita 中有真实隔离组与透明度继承；关系表使用真实 part ID 和最终图层 UUID，记录投影物、接收面、完整阴影、裁切底层与跟随目标。重叠发束优先正常阴影颜色层，其他适用关系可用正片叠底，逐处检查重复压暗与五官可读性。

完整形状、联合裁切、混合与运动关系的方法与真实模型证据见[09 蒙版投影](../formal/09-clipped-cast-shadows.md)。关系表允许 receiverPartIds 列出多个受影部件，follow="caster" 表示投影运动来源，不表示已经绑定同一 deformer。

## 法线／深度分支

从组装合成图生成两张原尺寸、逐像素配准的整图 PNG：法线为 RGB 方向，X 向右、Y 向上、Z 朝镜头；深度为白近黑远的相对灰度。数据贴图走不透明 RGB 生图传输，避免自动背景抠图污染法线或深度，交付时恢复原画 alpha。不强制重新平涂原角色。

交付位于 `shadow/normal-depth/step01/`，检查完成后发布 `lighting/normal.png`、`lighting/depth.png`。生成两张图不意味着已经完成动画绑定；后续工作台沿用[按部件分配、隐藏表面补全与形变](../formal/08-part-surface-completion.md)的方法。坐标、光照和方向修正依据[正式光照指导](../formal/01-lighting-and-depth.md)。

## 配置、恢复与预览

沿用既有模型配置规则：

| 设置 | 含义 |
| --- | --- |
| `shadow_agent_model` | 阴影制作 LLM 职责，默认 `gpt-6.1-sol-xhigh` |
| `shadow_maps_image_model` | 法线／深度使用的生图模型 |

蒙版分支只使用 LLM 操作 Krita，不启用生图工具。法线／深度生图键留空继承 `default_image_model`，复用现有 provider、凭据与协议。模型／harness 配对和补丁入口预检与其他步骤一致，不新增凭据配置系统。

每个分支独立保存 `run.json`、thread、`.running` 和 `.completed`。完成判定只检查本次分支的必需交付，不能因为另一分支已有成果就跳过。原尺寸、原生裁切、真实引用及地图 alpha／灰度由程序校验；轮廓配准、运动余量和美感由绘制者逐图检查，记录到报告。自动校验不替代视觉验收。

源 KRA、PNG、simplified、该分支需要的结构或提示词变化时，旧分支完整保留到 `.previous-*` 后重新制作；另一分支不被删除。最后成功路线更新 `shadow/selection.json`：项目预览自动载入蒙版工程，或原组装工程加法线／深度。源工程改变后暂停旧结果，避免错误绑定与两套阴影叠加。

依据：下半身教程的裙摆投影，以及透明／阴影教程的完整面积、裁切和重叠合成规则。当前工程验证覆盖分支配置、恢复、产物共存、输入变化、原生 Krita 透明度继承与页面接入；具体角色阴影美感需要实际运行该角色后验收。
