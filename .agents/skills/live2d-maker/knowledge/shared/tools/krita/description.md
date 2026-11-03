管理并使用本 section 专属的 Krita。每个 section 最多一个，由框架在 section 结束时关闭；进入 section 时不会自动启动，需要时先 start。Krita 只通过 Python 脚本操作，没有鼠标和可见界面。不要另起其他 Krita 进程，不修改用户的 Krita 配置。

- status：返回 state（stopped / starting / running / crashed）、pid、版本、桥接目录、启动次数；crashed 时附上次退出码和日志末尾。
- start：启动并等到桥接就绪（通常 20–60 秒），已运行时直接返回。
- restart：关闭当前 Krita（包括卡死的）后重新启动。崩溃或被脚本卡死时使用；未保存的文档和 session 变量会丢失，从已保存的 .kra/PNG 重新打开。
- run：在 Krita 界面线程执行 script，返回 {ok, result, stdout, stderr, error, hints, dialogs, seconds}。Krita 未启动时先自动 start。

脚本中可直接使用 Krita、krita、BRIDGE（桥接目录）、持续到本 Krita 关闭的 session 字典；把要返回的 JSON 值赋给 result。脚本按提交顺序一个个执行。

对话框会让无人操作的 Krita 卡住：桥接让新建、打开的文档以及 exportImage / saveAs / save 始终处于批处理模式，其他仍弹出的对话框会被自动取消，该次 ok 为 false，dialogs 列出标题。导出参数用 InfoObject 传入，导出后核对文件。关闭文档后丢弃它的文档、图层和视图引用；重新打开后先 doc.waitForDone()，确认 doc.rootNode() 不是 None 再继续，视图另行 addView。绘制前用 Krita.instance().activeWindow().addView(doc) 打开视图，笔刷、颜色、尺寸从 activeView() 设置；Krita 5.3 的 paintLine 等接受整数 QPoint，paintLine 第 3、4 个参数是两端压感。需要看结果时导出 PNG 再查看。失败时先读 hints。

局部恢复原始笔触可用 Krita 原生选区复制与粘贴，在同画布坐标将本件的指定局部取样到目标绘画层：

```python
from krita import Selection
patch = Selection()
patch.select(x, y, width, height, 255)
patch.copy(source_node)
patch.paste(target_node, x, y)
```

来源和选区由当前修画问题确定；选区涵盖本件自身的笔触，边缘与周围绘画接顺。copy/paste 使用系统剪贴板，脚本保留并恢复原有剪贴板内容。每次局部操作后导出并查看对应位置的独显与合成，确认效果后继续。

也可在 shell 中提交同样的脚本：node <status 返回的 submit> <script.py> --bridge <status 返回的 bridge>。
