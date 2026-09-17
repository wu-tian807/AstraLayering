# svg-layering 调度入口

使用 [svg-layering SKILL.md](../../.agents/skills/svg-layering/SKILL.md)。通用模型文件名解析、提示词读取、子agent调用与返修规则统一保存在skill；[流程表](../../.agents/skills/svg-layering/references/流程.md)列出前置0—5、主阶段1—5及review的实际顺序和输入输出。

各执行目录的 `.model` 文件名指定模型；前置语言任务使用Sol-xhigh，主流程及review使用Astra-xhigh，前置0—4的生图使用image2.5。调度者按文件名填写调用参数。

## 工具与证据

工具随对应review目录提供：

- [阶段2](../2.建立完整部件与遮挡/review/readme.md)
- [阶段3 step2](../3.建立可用线稿/step2/review/readme.md)
- [阶段4](../4.完整底形与基础填色/review/readme.md)
- [阶段5 step1](../5.大明暗与材质/step1/review/readme.md)

当前完成的是skill与资料组织，尚未用新调度流程重跑角色。
