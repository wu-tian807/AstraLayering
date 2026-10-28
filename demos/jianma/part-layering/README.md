# Jianma 人物分件成果

原任务名为 `test`，现统一为 `jianma`。保留原有 **115 个节点、90 个末端 part**，包括恢复后的完整 hair 分支：10 个节点、8 个末端 part。四层节点数分别为 8、27、51、29。

[完整阶段预览](previews/index.html) 可选择部位、层级和阶段；[groups.json](groups.json) 保留完整树和阶段状态，[parts/](parts/) 保存所有节点的完成 SVG，[occlusion.json](occlusion.json) 保存深度信息。

步骤目录保留正式轮廓与 review 结论（`groups/<id>/step01/`）、补全检查（`step02/`）、子组拆分（`step03/`）及同层去重（`layers/depthNN/`）；移除了提示词副本和逐次工具观察记录。`previews/` 保留代表性过程图，`references/` 保留本任务准备的参考图。SVG 和图片保留原始字节，未重画。

[part-preview](../../../svg-previewer/part-preview.html) 可加载 `preview.svg`、`references/base-subject.png` 和 `groups.json` 对照查看。返回[四条管线成果](../README.md)。
