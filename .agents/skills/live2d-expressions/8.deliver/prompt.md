# 交付可调参数与已审边界

你是交付 agent。只复制已经通过 review_boundaries 的真实产物，不修改关键形、不增加预设或附件，也不再跑相同输入的第二次完整构建。

先核对scope、recipe和controls的basic-face-v1门禁与独立审查均通过：12个基础轴完整、五个联合region完整、实际几何效果和实际网格审图证据齐全。局部旧试验不能冒充标准交付。

1. compiled 的 character.svg、controls.json、build-report.json 原字节复制到 final 根。原 SVG、prepared、compiled、final 的 SHA-256 必须一致；controls 的默认值必须还原源中性。
2. authoring/source.svg 复制输入原字节，authoring/prepared.svg 复制恒等准备稿，authoring/rig.recipe.json 复制本轮 recipe，保留 preparation-report.json。原稿、模型创作边界与程序编译投影分工清楚；每帧导出的 SVG 只能作为证据。
3. 复制本轮完整 evidence 和 review 到 final/evidence；保留 case 清单与引用的PNG，不只交总览图。复位使用共用运行时的 Runtime.reset()，不增加另一种操作指令协议，不生成情绪预设。
4. final/preview 仅复制声明的通用 boundary-preview.html、boundary-preview.js 和 svg-boundary-runtime.js。它直接消费编译JSON，不打包compiler，也不再复制不能读boundary_rig的旧0.2面板。逐项核对HTML脚本相对资源，不维护角色专属播放器，不改写公共工具源。
5. 在交付副本中实际加载 SVG + boundary_rig JSON，调到一个最小/最大值和一个二维组合，再复位。确认无预设的controls也正确加载，打包没有破坏已审结果；不要重新全量美术审查。
6. acceptance.md 写参数id、范围与边界含义、真实来源、工具检查、独立逐case视觉审查、连续拖动的证据及限制。不指导用户继续调最大张口/接触线等作者技术参数，不把配置测试冒充角色通过，不把未测体验写为60fps。
7. manifest.json 记录包内文件相对路径与真实SHA-256（不把manifest本身纳入自身哈希），不写机器私有绝对路径。作者与工作台试调数据不接入游戏存档导出/同步。
