# 阴影制作

## 单独运行本 section

先准备同名任务的组装成果及下表所需参考，停止同任务总调度，再从 skill 根目录运行。独立入口只制作所选阴影模式：

```sh
pnpm shadow --name jianma --krita /path/to/krita --knowledge /path/to/knowledge
pnpm shadow --name jianma --shadow-mode normal-depth --krita /path/to/krita --knowledge /path/to/knowledge
# 总入口只运行阴影；首次默认 mask
pnpm start --name jianma --from shadow --to shadow --shadow-mode mask
```

`--dir` 指定运行根目录；输入从 `<dir>/<name>` 的固定产物读取。独立入口省略模式默认 `mask`，总入口续跑省略则沿用保存的模式。独立入口不保存配置，每次启动都需传 `--krita` 与 `--knowledge`；总入口续跑复用任务根 `run.json` 记录的路径。每次启动都做不启动 Krita 的轻量检查。只有 mask 模式占用 Krita 名额并获得 `krita` 与 `inspect_shadow_mask` 工具；normal-depth 声明 `krita: false`，不占名额也没有 krita 工具。私有 Krita 见 [Krita 与显示环境](../references/setup.md#krita-与显示环境)。`--dry-run` 检查输入与提示词，不写任务或调用模型。

| 模式 | 输入 | 交付 |
| --- | --- | --- |
| `mask`（默认） | 组装 KRA / PNG、simplified、人物与衣服分组和遮挡顺序 | `shadow/step01_mask/character-shadowed.kra`、同名 PNG、`shadows.json`、`face-review.png`、`report.md`；agent 调用检查工具时另写 `inspection.json` 与 `inspection/` 检查图，不作为交付门槛 |
| `normal-depth` | 组装 KRA / PNG、simplified | 生成 `shadow/step01_normal-depth/normal.png`、`depth.png`、`report.md`；验收后发布贴图至 `lighting/` |

只制作随部件运动的投影，褶皱等固有明暗保留。用 simplified 判断实际投影范围，以组装图的位置和尺寸制作。优先复用分件绘制已经去掉投影的底色；残留旧影时仅局部补画新工程。蒙版直接在 Krita 绘制，完整面积一般远大于静帧可见投影，并包含充分运动延伸，按投影物运动设计形变、由受影面裁切；后续可独立修正阴影形状与相位，不强制同一 deformer；本工作流不制作动作关键形。

Krita 阴影采用隔离组和透明度继承，JSON 保存真实 part ID 与最终图层 UUID、跟随／裁切关系。重叠发束优先正常阴影色层，避免叠底重复压暗。KRA 是可编辑素材，`shadows.json` 是供后续绑定消费的关系；它们不是 cmo3/moc3，也不代表已经绑定 deformer。

复用现有 raster runner 的模型调用、日志、thread 与完成标记。两种模式是同一 section 的两个 step01，启动时选其一：各自在 `shadow/step01_<模式>/` 保存 `.running` / `.completed` 与会话；切换模式只检查所选步骤，另一模式的产物保留。上游 character-assembly 须已完成；它重做后已完成的阴影步骤沿用，不自动重做。需要重做时对所选 step01 重试。

仅文件存在不代表检查通过：检查原尺寸、KRA 合成与 PNG 一致、真实图层与 part 引用、原生裁切和模式；地图检查原尺寸、深度灰度、原画 alpha。原生检查由 agent 通过 `inspect_shadow_mask` 工具在本 section 的 Krita 中运行；交付不核对检查结果。绘制 agent 仍需逐图评估画法和余量，不能用像素计数替代艺术验收。

只有完整交付后更新 `shadow/selection.json`，角色工作台默认载入最近完成的路线。两套产物共存时，可显式选择混合预览：蒙版 KRA 加原组装生成的法线／深度。工作台分别核对两种模式的 `step01_<模式>/source.json` 与当前源工程，不把不匹配的旧结果混合；预览选择不改变制作参数。源输入变化时暂停旧结果，等待对应模式续跑生成。

已生成但未完成验收的贴图也在同一个角色工作台查看。前端自动核对原尺寸、灰度深度和单位法线；选择法线／混合预览时显示“待视觉复核”。此操作只读，不写完成标记、正式交付或改变路线选择，不需要额外预览命令。正式交付优先。

光照调试在统一角色工作台完成，不属于生图管线。工作台提供动画、柔和、右侧柔光、左侧柔光、顶部柔光、戏剧侧光、暖色夕照、冷色月光和蒙版柔光等内置预设。原组装默认右侧柔光，含投影蒙版默认蒙版柔光；首次进入即启用光照，随后切换工作区保留用户参数。可继续手调、重置或导出／导入光照配置。管线不执行光照调校步骤。

角色原素材精度保持不变，PNG 无损输出。模型配置使用 `shadow_agent_model`；蒙版不启用生图工具。法线／深度生图设置 `shadow_maps_image_model`，省略复用既有默认生图服务。

正式蒙版方法：`tutorial/live2d-guidance/formal/09-clipped-cast-shadows.md`，依据真实 Milly 裙影／发影、PSD 与 moc3、官方裁切实现；一个来源允许联合裁切到多个受影 part。

教程依据：仓库 `tutorial/live2d-tutorial-text/8.下半身的拆分与制作.txt`、`14.透明，阴影，高光的拆分方式.txt`，正式方法 `tutorial/live2d-guidance/formal/01-lighting-and-depth.md` 和 `08-part-surface-completion.md`。制作要求由短提示词和随任务复制的参考文件共同提供，独立安装不依赖外部教程目录。

## 制作参考与原生检查

开工前在 `step01_mask/workspace/references/` 生成 `inputs.json`：真实 part、单深度／多深度区域、KRA UUID 和明确的名称归属。未匹配的层仍需查看像素确认。随后把 [制作格式](../knowledge/shadow/step01_mask/references/production.md)、[裙影示意](../knowledge/shadow/step01_mask/references/skirt.png) 与 [发影示意](../knowledge/shadow/step01_mask/references/hair.png) 复制到同一目录。两图是依据原模型结构绘制的原创示意，不再分发模型原画。

保存后，agent 调用本 section 专属的 `inspect_shadow_mask` 工具检查，检查时机和次数由 agent 决定。工具使用本 section 的 Krita，未启动时自动启动，并把问题、提示和检查图路径直接返回给 agent。

`shadows.json` v2 必须为每处影层声明 `testOffsets`（原画像素，含复位与非零偏移）与依据。完整影层没有裁切外像素只提示复核，不按固定面积倍率拒绝；空影层、错误归属与越界新增 alpha 作为 problems 返回给 agent 处理；原生结构错误由交付结构检查拒绝。

检查作为桥接任务在该 Krita 中打开保存工程的副本，不保存修改，结束后关闭副本；导出去影对照、完整影层、联合接收面和全部相对偏移。不转换工程色深，目前原始像素检查支持 RGBA U8。其他色深明确报错，不压缩素材以绕过检查。

Jianma 从头测试及环境问题见仓库 `tutorial/live2d-guidance/formal/sources/jianma-shadow-fresh-run.md`。

工作台阴影栏目提供参考图、去影对照、逐处余量拼图和检查记录；拼图只供比较，记录中的完整 PNG 保持原分辨率。此检查覆盖素材与原生裁切，尚不验证实际 deformer／物理动画或 Cubism 导出。
