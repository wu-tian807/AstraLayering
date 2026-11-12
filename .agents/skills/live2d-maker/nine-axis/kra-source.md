# 九轴工程引用与预览

画稿来源是保存的 KRA；作者 JSON 保存图层绑定、层级、裁切与累计变形。PNG 是固定面部制作素材、渲染缓存或导出交付，不能代替画稿来源。KRA 保持可编辑的静止素材，不烘入某个转头姿态。

## 各阶段的上下文

| 阶段 | KRA | edit_nine_axis | view_nine_axis |
| --- | --- | --- | --- |
| step01_preparation | 直接引用已完成 shadow，否则 assembly | 程序整理 UUID、原始范围和固定 neutral，无编辑 agent | 发布未制作角度的 neutral |
| step02_video、step03_frames、step05_frames | 沿用来源，不复制工程 | 使用视频／选帧工具 | 不提供九轴工具 |
| step04_angles/model/left | 同一来源 KRA | face-left.json；固定素材，制作左形，镜像右形 | 当前左右及中间值，不引入兄弟作者 |
| step04_angles/model/up、down | 同一来源 KRA | 独立 face-up.json／face-down.json，各从 neutral 开始 | 对应方向及中间值，不混入兄弟作者 |
| step04_angles/model | 同一来源 KRA | 程序合并，不加 maker | 保留独立作者函数的单轴模型 |
| step06_angle-xy | 继承合并模型的 KRA | face-xy.json；补左上／左下，镜像右侧，保护单轴 | 全部单轴、四角和中间值 |
| step07_jaw-line | 建立本步可编辑 KRA | Krita 保存画稿；jaw.json 绑定 UUID、设置蒙版和变形 | 当前 KRA + 全部继承形变 + 本步处理 |

调度绑定作者文件、上游模型、KRA 来源、输出位置和权限，agent 不根据文件时间寻找工程。面部阶段禁止换图层绑定，保持固定静止素材与导出；下颌线阶段才开放 Krita 修改。

## 来源链

shadow KRA → neutral → 三个独立轴 → merged → face-xy.json → 本步新 KRA + jaw.json。

source.document 是当前阶段实际读取的 KRA，路径以任务根目录为基准。切换画稿后，source.geometryDocument 保留原始单轴几何来源，axisSources 的独立作者快照继续保留。不能为了换画稿而重写历史几何，也不能依次重复应用历史 JSON。

准备不生成 character-nine-axis.kra／character-nine-axis.png。source-composite.png 从 KRA 的 mergedimage 取得，用于视频输入；layers/ 是固定 neutral 素材。下颌线交付包含本步 KRA、对应合成图、绑定记录和完整模型。

旧交付保留兼容：旧下颌线的本步 KRA 优先于遗留的准备来源，export-record 的 UUID 映射可恢复到模型。不会自动删除旧工程。新增绑定写进 JSON。

## 图层绑定与渲染

部件 uuid 指向原生图层；textureBounds=[x,y,width,height] 是整数像素导出范围。已有绑定优先，兼容缺失绑定时沿用上游部件／阴影 UUID 关系，最后才尝试唯一名称匹配。不存在或有歧义时报错，不读取旧 PNG 顶替。

下颌线通过 bindings:[{id,uuid}] 重绑；add_part.part 也可携带 uuid。无画面内容的构造部件显式标记 material="transparent"。Krita 修改像素，edit 工具处理绑定、网格和累计 JSON，并导出 layers/。

KraMaterials 由正式 agent 工具和工作台共用。缓存键包含 KRA 内容哈希、绑定、裁框与导出规则；保存或绑定变化后重新导出，同内容复用缓存，不反复启动 Krita。导出过程中 KRA 变化则拒绝混用版本。工作台的刷新版本同时包含 JSON 和 KRA 保存状态，单独保存 KRA 也会刷新。

预览加入未变形的头发和头饰，依据原生图层顺序插入，保留 JSON 部件的相对绘制顺序。已绑定发片沿用累计形变，不再补静态副本。静态参考 id 为 __kra__/<uuid>，不写回作者 JSON，也不作为可编辑关键形。

## 多帧与验证基线

frames:[{x:0,y:0},{x:-15,y:0},{x:-30,y:0}] 一次解析 KRA 和累计模型，共用浏览器会话，输出单帧路径、各帧网格和拼图。每帧可指定 reference；edge／blend、only／hidden、grid、crop 继续可用。

读取正确与造型正确分别验证。某阶段尚未含头发变形时，静态头发只代表该阶段，不能代替后续已完成头发版本验收。对照已确认版本时，同时沿用该版本的累计模型与实际画稿，检查眼睛等已有部件的几何、可见像素和遮挡关系没有退化。
