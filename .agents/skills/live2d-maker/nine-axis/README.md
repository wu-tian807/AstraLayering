# 头部九轴

独立入口：`pnpm nine-axis --name <任务名> --dir <绝对运行根目录> --knowledge <先验知识目录> --krita <Krita 可执行文件>`。总入口支持 `--from nine-axis --to nine-axis`。原 KRA 与 PNG 使用角色组装／阴影来源，原文件只读。

| 步骤 | 输入与处理 | 主要产物 |
| --- | --- | --- |
| `step01_video` | 正面裁框；left/up/down 视频和取帧在同一步完成 | upper-body.png、crop.json、三个 mp4/png、frames/、videos.json、views.json |
| `step02_angles` | 一次原 KRA 导出；left/up/down 从同一 neutral 独立并行 | neutral/、left/、up/、down/；完成后联合 deformers.json、axis-sources.json、layers/ |
| `step03_angle-xy` | 依赖三个单轴联合工程；以原 up/down 参考帧生成斜角视频，agent 自选两帧 | left-up/down 视频与 PNG、selected-frames.json、两个 trace、face-xy.json、deformers.json |
| `step04_jaw-line` | 沿用斜角工程，处理固定脖子的顶部覆盖与下颌接触 | 完整 jaw.json、deformers.json、全部模型贴图、私有 KRA 与完整画布 PNG、制作说明与姿态对照 |

## 制作职责与最终导出

本路线交付可在工作台查看的完整头部九轴模型。单轴阶段完成左右、抬头和低头；斜角阶段完成四个斜角；下颌阶段在这些姿态上完成下颌接触与固定脖子的连接。各方向的脸底、五官、已有独立耳朵，以及头发遮挡下的脸缘补全都由对应方向的 agent 完成。中间组合使用同一渲染器插值；agent 根据实际过渡效果添加局部修正，不要求穷举辅助键的所有组合。具体制作边界见 [制作范围](../knowledge/shared/prompts/nine-axis-delivery-scope.md)。

这是制作与展示约定。部件命名、Warp 分组、父子结构及投影的组织方式根据实际工程决定；不要求某种阴影必须有特定字段或部件名，也不为本约定新增交付校验、哈希要求或自动返修门槛。

最终步骤交付以下内容，工作台读取同一份产物：

| 交付内容 | 工作台展示 |
| --- | --- |
| 完整九轴模型及其变形、层序、裁切配置（`deformers.json`） | 按模型配置绘制各部件，展示九个主姿态与连续过渡 |
| 模型实际引用的全部贴图（`layers/`，含继承与本步制作的素材） | 使用这些贴图；原色、独显、合成和蒙版查看都来自实际模型 |
| 本步可编辑 KRA 与完整画布合成 PNG | jaw 阶段打开本步工程和合成；切回前面阶段使用相应继承工程 |
| 作者文件、制作说明与已有姿态对照 | 随成果保留，说明制作范围、处理方式和剩余偏差 |

投影属于谁、受谁裁切、是否需要随动作独立控制，以工程中的实际关系为准。独立投影保持可独立控制的素材与关系；导出底色时不把其他部件的投影误合成进去。需要合并的静态绘画效果按实际设计处理，并在制作说明中说明。工作台呈现交付模型声明的内容，不按名称猜测或临时增加阴影。

步骤目录保存正式产物，workspace 保存草稿。最终模型引用的全部贴图随模型交付，避免预览依赖中间草稿。全流程「导出成果」包含已完成九轴的模型、工程、贴图和已有说明／对照，排除 workspace 与 agent 会话。

`step02_angles` 的 neutral、left、up、down 各有自己的 `.running`／`.completed`。单轴没有彼此的依赖；三路共用一个默认三名额的 agent 运行池。失败后保留已完成兄弟组，续跑只恢复未完成组。父步骤在三路全部完成且联合工程发布后才完成。斜角保留对三个单轴的依赖，用于初始形、选帧参照和连续过渡检查；可见轮廓仍拟合自己的视频帧。

只跑一组可使用 `--step step02_angles/left`（或 up/down）。只跑完整单轴阶段用 `--step step02_angles`。这两种均沿用 step01 的原视频与参考帧，不调用生视频接口。`--dry-run` 只检查并展示提示词。重试子组删除自己的作者和会话，保留其他单轴与共同 neutral；重新组合后再按需要重做受影响斜角。

三个方向的 thread 分别保存在 `nine-axis/agents/steps/step02_angles/<方向>/session.json`，CLI workspace 分别位于 `step02_angles/<方向>/workspace/`。会话启动时立即落盘，中途出错也保留已取得的 thread；下次进程从磁盘读取本方向记录。共享 agent.json 只共享配置。

| 操作 | 本方向会话 | 本方向产物 | 其他方向 |
| --- | --- | --- | --- |
| 继续／`--continue` | 续接原 thread | 保留并继续 | 各自继续或沿用完成结果 |
| 恢复／`--resume` | 新建 thread | 保留并继续 | 保留 |
| 重试／`--retry` | 新建 thread，清理本方向尝试记录 | 从 neutral 重做；重新合并 | 保留 |

例如 `pnpm nine-axis --name <任务名> --dir <运行根目录> --knowledge <知识目录> --krita <可执行文件> --step step02_angles/up --resume` 只恢复 up。不指定 step 的恢复／重试作用于当前中断或失败的九轴步骤；父步骤含未完成子组时逐组处理，保留共同 neutral 和已完成兄弟组。

## 公共配置与方向覆盖

三个单轴只读取 [step02_angles/agent.json](../knowledge/nine-axis/step02_angles/agent.json)。`prompts/groups/left/方向任务.md`、`up/方向任务.md`、`down/方向任务.md` 各自是该方向的完整制作提示词，覆盖 `prompts/方向任务.md`，完全复用 Part 的同名优先规则；缺少组文件时回退公共文件。各方向的先验同样放在 `prompts/groups/<方向>/补全先验.md`（left 远侧笔直陡线；up/down 透视变化、不压扁），斜角读 [step03_angle-xy/prompts/斜向先验.md](../knowledge/nine-axis/step03_angle-xy/prompts/斜向先验.md)；所有方向共用 [nine-axis-face-contour.md](../knowledge/shared/prompts/nine-axis-face-contour.md)，用来分辨真实脸缘与头发切出的边，并要求边缘干净。先验全部是文字，不再附教程截图或模型对照图。工具列表仍从公共 agent.json 读取。每组独立保存作者、会话、workspace、观察图和报告。

五个方向的提示词各自写全同一方法：原画完整 source → 整张 target 起稿与可见脸缘 （含刘海间露出的额头） → 遮挡补全 → 自动拟合 → 实际脸底检查 → 五官、连续帧 → 最后编辑后重检。视频决定可见轮廓、五官和笔锋；被头发盖住的部分不追求特定脸型：只要与可见线连续顺滑，并在每条头发边下面留足余量，头发运动时不露空。

工具复用 `preview_svg` 看 source/target 叠加，`fit_nine_axis` 从描线自动求 agent 选择的 Warp，`edit_nine_axis` 定义组级／父子 Warp 并批量或局部液化，`view_nine_axis` 查看实际贴图和 alpha。完整闭合脸型预测必须与可见分段同源；不能沿发间皮肤窗口闭成小块脸。Warp 分组、密度和父子关系由 agent 决定。

刘海间露出的额头属于整张 target 描边的可见证据，agent 独显实际脸底对照预测检查，不另设 mask 或程序覆盖门禁。技术检查与完成标记不能替代用户视觉验收，用户说通过才称流程稳定。

## 共享原图与单轴组合

neutral 通过现有私有 Krita 桥接导出完整原脸底、五官、脖子与头发参考，保留原 bbox、textureBounds、层序、UUID 和贴图 SHA。原图层仅有 identity 网格，`deformers=[]`，不预设解剖 Warp。独立 agent 使用相同原部件与静止形，自由定义自己的 Warp；更密或更局部的控制通过 Warp 添加。

原图层的 `level`、`role` 与 `clip` 是共同的静态配置，也须保持 neutral 原值；单轴拟合使用各自的 Warp 与局部关键形。编辑工具在保存前验证共享图层与贴图，单轴完成前再次验证，避免一条方向修改裁剪后被标记完成、直到合并才发现不一致。斜角与 jaw 的裁剪创作仍使用各自阶段的工具。

联合工程的 `axisSources` 保存三份完整独立作者的层级和插值。贴图只绘制一次，采样各单轴的完整变形，再由斜角作者添加当前修正。程序验证原图与来源一致，并检查联合工程在单轴关键形及中间角度与原单轴采样一致；不把一个方向的分组强加给另一个方向。斜角不能改写已完成的 axisSources。

脖子从初次完整预览参与下巴与遮挡参考，所有形保持原形原位置、parent 为空。单轴和斜角修完整额顶／额角／太阳穴；脖子顶部补足与下颌接触收尾在 step04 处理。

## 视频与坐标

视频接口独立配置 `video_base_url`／`video_api_key`、`nine_axis_view_video_model`，需要 ffmpeg。视频约 5 秒，从正面绕轴转到 90°；当前取帧目标默认 X±30、Y±25，以 [angles.json](../knowledge/nine-axis/step01_video/references/angles.json) 为唯一数值来源。参数是制作关键形标签，不表示已精确测出视频物理角度。斜角由 agent 依据实际画面选帧，记录帧号／时间、依据与原片／参考 SHA。

参考、SVG、trace 与实际渲染保持同一裁框与位置；特写 `(u,v)` 对应原画布 `(box.x+u,box.y+v)`。生成视频、取帧、SVG、网格和检查图均是任务产物，保存在运行目录，不写入 knowledge。
