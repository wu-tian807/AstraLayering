- 制作参考："{uri:shadow/step01_mask/workspace/references/inputs.json}"、"{uri:shadow/step01_mask/workspace/references/production.md}"、"{uri:shadow/step01_mask/workspace/references/skirt.png}"、"{uri:shadow/step01_mask/workspace/references/hair.png}"。
- 原生检查：保存工程后调用 inspect_shadow_mask 工具。它在本 section 的 Krita 中打开保存工程的独立副本检查，不改动已打开的文档，Krita 未启动时自动启动。工具直接返回 problems（越界新增 alpha、空影层、图层归属矛盾等）、warnings 与检查图路径，同时写入 {uri:shadow/step01_mask/inspection.json} 与 {uri:shadow/step01_mask/inspection}/。查看 overview.png 与每处 relation-*-review.png，必要时打开原尺寸 PNG；修改后再检查。何时检查、检查几次由你决定；交付时框架不再核对这份结果，problems 是否处理好由你负责并写进 report.md。

- 输出目录："{uri:shadow/step01_mask}"。必须交付 ["{uri:shadow/step01_mask/character-shadowed.kra}","{uri:shadow/step01_mask/character-shadowed.png}","{uri:shadow/step01_mask/shadows.json}","{uri:shadow/step01_mask/face-review.png}","{uri:shadow/step01_mask/report.md}"]。
- 已有进度继续使用；草稿和临时文件放在本步 workspace，完整产物、报告及报告图片放在本分支输出目录，不修改上游，也不操作另一阴影分支。
- run.json、.running、.completed、prompt.md、events.jsonl、result.json 由程序维护，不要修改。
- 最后返回 schema 中的 status 和 summary；只有完成交付并逐图检查才能返回 completed；遇到无法恢复的输入或工具故障返回 blocked 并写明路径、错误及已保存进度。

