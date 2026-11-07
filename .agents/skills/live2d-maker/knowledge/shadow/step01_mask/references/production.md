# 投影素材与检查

先看同目录的 [skirt.png](skirt.png) 与 [hair.png](hair.png)：完整素材、受影联合裁切、重叠和相对偏移。图里的色块只说明图层结构，影子本身用画笔画出。图为原创结构示意；依据真实 Milly PSD 1220／832–834、moc3 ArtMesh119／47–51、faceM 与腿部 mask。真实资料与测量见仓库 `tutorial/live2d-guidance/formal/09-clipped-cast-shadows.md`；独立安装不依赖该目录。

`inputs.json` 列出本次真实 part、深度、原 KRA 图层 UUID 和识别到的归属。未识别归属的图层需对照像素确认，不能猜名称。多受影部件使用一个 `receiverPartIds` 数组；裁切 base 可是保留原子层的受影子组。Krita 透明度继承使用同组下方合成 alpha，base 下方不要混入其他实色层。

`inputs.json` 的图层深度序号仅表示叠放关系，不是几何距离，不能据此推出投影偏移。同一 part 中有投影依据的细轮廓补进原影层，不为细条捏造 part。

`face-review.png` 先展示原组装、所有新投影关闭、最终脸部的原尺寸裁切，再展示细发的声明偏移；无脸角色改用主要识别区域并注明。裁切不缩小，不能只靠全身缩略图判断脸部是否完成。

Krita 私有脚本的配置、运行和临时目录使用系统短临时路径，权限设为 `0700`，产物仍保存到任务输出。不要把 `TMPDIR` 放在长任务路径下：Krita 的本地套接字也使用此目录，Linux 路径长度有限。保存、导出和关闭文档后，通过 `Krita.instance().action('file_quit').trigger()` 请求正常退出，宜用 `QTimer.singleShot` 等待回调返回；Krita 5.3.4.1 没有 `Krita.instance().quit()`。检查产物与进程退出分别判断，启动告警不等于插件未执行。移动带蒙版的接收节点时保留原子节点；不要先移除原节点再重建蒙版，保存后必须核对原 UUID、归属和状态。

`shadows.json` v2 示例（均替换为真实值）：

```json
{
  "version": 2,
  "shadows": [{
    "id": "skirt-to-legs",
    "casterPartId": "clothing:inner_dress/skirt",
    "receiverPartIds": ["character:legs/left", "character:legs/right"],
    "casterLayerUuids": ["<caster>"],
    "receiverLayerUuids": ["<left>", "<right>"],
    "shadowLayerUuid": "<new paint layer>",
    "clipBaseLayerUuid": "<receiver group>",
    "follow": "caster",
    "blendMode": "multiply",
    "testOffsets": [[0, 0], [-12, 0], [12, 0], [0, 16]],
    "notes": "按本角色裙摆轮廓补全，偏移范围依据裙下搭接；后续独立修正投影响应"
  }],
  "excluded": []
}
```

偏移是原画像素，由当前形状和预期余量选择，不照抄示例；至少一个复位点和一个非零点。`follow` 是运动来源，非已完成 deformer 绑定。不要新加尺寸倍率门槛。

检查使用 `inspect_shadow_mask` 工具，保存工程后调用。它在本 section 的 Krita 中只打开保存工程的独立副本，输出 `inspection.json` 和 `inspection/`：去影底图、原尺寸相对偏移、完整影层、受影覆盖与检查拼图。原始检查 PNG 保持原分辨率；拼图仅用于并排查看，不替代原图。查看每处静帧与偏移图，修好后再调用；工程与 shadows.json 未变时直接返回上次结果。空影层、错裁切、图层归属矛盾、越界新增 alpha 作为 problems 返回，交付前必须修好并写进 report.md（框架不再核对检查结果）；裁切外余量不足只作 warnings 提示复核，不能由面积数值决定画法。

此检查验证素材覆盖和原生裁切，不是物理或九轴验收。
