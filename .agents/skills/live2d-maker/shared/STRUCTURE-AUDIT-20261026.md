# 结构写回审计（2026-10-26）

记录日期：2026-10-26。以下权限表及 M1–M6 记录受控编辑改造前的核查结果；改造进展见文末。核对本机执行副本中的人物、衣服、组装、阴影及物理管线的提示词、工具回调、恢复与交付检查；物理 agent 工作流仅在执行副本中，当前主线没有 `physics/steps.ts`。审计未修改运行中的模型会话、KRA 或结构文件。

### 谁能修改结构文件

两套 part 共用实现；两套 raster 共用实现。这里区分任务授权、受控工具写入与程序落盘，不把提示词中的“只读”当作操作系统写保护。

| agent | groups.json | occlusion.json | 实际入口与边界 |
| --- | --- | --- | --- |
| part 首次分组 | 创建初始分组，随后由调度器更新根树 | 无 | `write_groups` 校验并写 `step08_initial/groups.json`；调度器通过 GroupStore 写根文件。见 [initial-groups.ts](part/initial-groups.ts)、[layering.ts](part/layering.ts) |
| part 轮廓绘制／返修 | 仅修改当前组 note | 无 | `update_group_note` 精确替换当前 note 中唯一匹配的文本，走 GroupStore 写入队列；不改父组、其他组或树结构。见 [outline-agent.ts](part/outline-agent.ts) |
| part 细分组 | 改变直属子节点，程序保存分组树 | 无 | `submit_children` 返回并校验结构，调度器写对应 `children.json`，再更新根树；agent 不直接编辑事实文件。见 [children-agent.ts](part/children-agent.ts)、[layering.ts](part/layering.ts) |
| part 最终遮挡层级规划 | 无；要求规划期间输入不变 | 生成深度表 | `propose_occlusion`、`check_occlusion_part`、`submit_occlusion` 校验，调度器原子写入最终文件。见 [occlusion-agent.ts](part/occlusion-agent.ts)、[occlusion-plan.ts](part/occlusion-plan.ts) |
| raster step01 绘制及两轮返修 | 允许直接编辑并同步 SVG／记录 | 允许直接编辑深度与区域 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md) 在 step01 绘制中注入；repair 沿用绘制 thread，新建 thread 时前置完整绘制提示词，不再重复注入；结构修改由当前绘制 agent 执行 |
| raster step01 独立 reviewer | 只读检查与反馈 | 只读检查与反馈 | 不注入结构写回职责；框选工具只输出审查证据。见 [review.ts](raster/review.ts)、[part-section.ts](raster/part-section.ts) |
| raster step02、人物 step03 | 当前任务没有授予新的结构编辑职责 | 同左 | 新提示词要求沿用结构；`buildPrompt` 仅在 step01 注入写回职责。与 step01 共用绘制会话，旧指令仍在历史中；文档还有与此冲突的措辞，见 M4 |
| part 独立 reviewer、同层去重、遮挡补全 | 不编辑这两个结构文件；各自仅提交审查或 SVG 产物 | 同左 | 工具绑定对应产物；同层去重与补全不接管分组树或最终深度表 |
| character-assembly、shadow | 上游结构作为输入，无修改授权 | 同左 | 各自修改本管线的工程／配置；不继承 raster step01 的结构写回提示词。见 [组装提示词](../knowledge/character-assembly/step01/prompts/01-人物与衣服组装.md)、[阴影提示词](../knowledge/shadow/step01_mask/prompts/mask.md) |
| physics 的分析／制作／复核（本机执行副本） | 上游结构只读，无修改授权 | 同左 | 执行副本 `physics/steps.ts` 明确要求不改上游、另一管线、run.json 或完成标记；各角色只修改规定的本阶段配置与证据 |

技术边界：raster agent 使用 `danger-full-access`；Claude／AGV 请求使用各 CLI 的执行能力。当前并没有对这两个文件统一设置阶段写保护。未授权角色在提示词上只读，不等于程序已经检测并阻止其越权写入。参见 [raster/agent.ts](raster/agent.ts)、[agents/cli.ts](agents/cli.ts)。

### 当前案例的确定证据

`black-white-doll/clothing-part-layering/occlusion.json` 经 raster step01 回写后，在 15 个多深度区域和 4 个单深度记录中加入了 `layer` 图层名字段，共 19 处。原 schema 只接受单行规定字段以及 `levels: [{ level, region }]`；图层名可记录在绘画报告中，现有 schema 不接受新增的 `layer` 属性。

直接调用 `validateOcclusionDocument` 会报 `pleated_skirt/skirt_body 深度值重复、非法或缺少区域描述`。只在内存副本中移除这 19 处额外字段后，同一校验器通过，覆盖 10 个逻辑 part、19 个深度区域；未修改真实文件。因此本次已证实是额外字段违反协议，未发现深度值重复。此检查不代替视觉 review。

本次观察时，step01 已完成两轮 review／必要返修，step02 在运行。错误来自 [web/part-stages.ts](../../../../web/part-stages.ts) 读取现有表时的校验；它会展示错误，未向当前绘制会话发送修正反馈。

### 已确认的误导文案及程序缺口

| 编号 | 文件与具体文案／行为 | 误导点及实际边界 |
| --- | --- | --- |
| M1 | [occlusion-plan.ts](part/occlusion-plan.ts)：`深度值重复、非法或缺少区域描述` | 同一条件同时检查区域是否为对象、额外字段、数值类型／范围、深度重复及 region 非空；额外 `layer` 字段也触发此句。应分别定位字段路径和失败原因，不能让 agent 按重复深度去改正确层序 |
| M2 | 同文件：`层级表包含重复 ID 或不支持的字段` | 缺失／空 ID、重复 ID、行不是对象及额外字段被合并。此次多深度的 `layer` 移除后，单深度的 `layer` 会触发此句；不能据此认为 ID 重复 |
| M3 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md)：`检查相关文件能够解析、引用完整且图像一致`；[workflow.ts](raster/workflow.ts) 的 `checkFiles` 与 `交付检查通过，写入 .completed` | 能解析 JSON 不证明符合 schema；当前 part raster 没有挂接结构交付校验，完成门槛主要检查要求的输出文件存在、非空且位于目录内。`.completed` 或视觉 review 通过不证明回写的结构文件合法 |
| M4 | [workflow-details.md](README.md#多深度与上游修正)“多深度与上游修正”：`step01 绘画者…step02 沿用已确认结构精修柔边，使用现有文件工具直接修改 groups.json、occlusion.json 和对应 SVG。可以调整层序、归属或拆出…` | 同段将 step01 与 step02 连写，容易把结构编辑权限扩展到 step02；人物／衣服 step02 提示词实际要求沿用层序、归属，不新增拆层。step03 也要求保持结构。参见 [steps.ts](raster/steps.ts) 中仅为 step01 注入写回职责的条件 |
| M5 | [raster-drawing-responsibilities.md](../knowledge/shared/prompts/raster-drawing-responsibilities.md)：`直接编辑上游 groups.json…`、`上游分层文件保存后即作为后续工作的有效输入`；[workflow-details.md](README.md#多深度与上游修正)：`上游结构修改在中断与主动重跑后继续使用` | 这不是所有恢复入口都成立的保证。`GroupStore.open` 从首次分组与各已完成的 `children.json` 重建树；根 groups.json 仅保留已有 ID 的 name／note／metadata。只改根树增加、删除或重排节点，独立 part 恢复时可能被旧步骤事实覆盖。总控在 raster 已启动时跳过 part 恢复只是保护一条入口。见 [groups.ts](part/groups.ts)、[part-steps.ts](part/part-steps.ts) |
| M6 | [workflow-details.md](README.md#多深度与上游修正)“编辑工具说明与 schema”：`raster 各阶段按下文约定提供深度工具`、`实际执行与文件写入校验仍在 TS 中` | 观察时 part raster 只注册 reviewer 框选及 step02 像素差异工具，没有深度修改／校验工具（像素差异工具现已删除，step01 绘制／返修已注册 `edit_groups`、`edit_occlusion`）。工具回调中的 schema 校验不会覆盖 agent 用脚本直接改写上游 JSON 的路径，不能让 agent 误以为保存后已有同等保护 |

### 后续修复边界

- 将层级校验错误拆成准确的字段路径与原因；人物、衣服和前端使用同一校验器。
- 让直接编辑结构的 agent 获得可执行的 schema／引用检查入口，在完成前收到具体错误并在原绘制会话修正；交付端也校验，不只由前端发现。技术校验返修不额外消费视觉 review 轮次。
- 明确 step01 绘制／返修与后续步骤的写入范围，处理共享会话里的旧指令和相互冲突的说明。
- 先统一根 groups.json 与步骤分组事实的写回／恢复机制，再声称结构编辑能够在所有恢复入口保留；不能靠修改提示词替代真实持久化。

这些是待修复项。本次只记录职责、证据和误导点，不向运行中的 agent 注入新任务，也不清理产物或重跑管线。

### 受控编辑改造进展

- 人物／衣服 raster step01 绘制及返修改用 `edit_groups`、`edit_occlusion`；说明在 [edit_groups](../knowledge/shared/tools/edit_groups/description.md) 和 [edit_occlusion](../knowledge/shared/tools/edit_occlusion/description.md)，schema 在 `tools/` 同名目录，执行共用 [structure-tools.ts](raster/structure-tools.ts)。读取仍使用内置文件工具。reviewer、step02、step03 与组装不注册结构编辑工具。
- 工具先校验结构、全部终止节点的深度覆盖和 SVG 引用，再保存。终止 ID 改变时同时提交分组树与深度表。M1、M2 的报错已区分具体字段路径与原因；图层名映射写在报告中。
- 按用户确认，step01 结束时的额外诊断只记日志提示，不阻断完成或后续步骤，也不回交 agent 返修。工具调用失败仍直接返回当前 agent，非法参数不落盘。M3 不采用强制退出的交付门禁。
- M4、M6 涉及的职责与工具说明已改为现行边界，见 [workflow-details.md](README.md#多深度与上游修正)。文件系统硬性写保护与 M5 的独立 part 恢复问题保持现状；文档已明确只保证 raster 续跑保留根结构修改。
