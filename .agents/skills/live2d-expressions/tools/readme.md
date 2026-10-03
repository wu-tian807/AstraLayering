# 表情技能共享工具

工具按使用者归属，所有声明路径从技能根目录解析，不能依赖其他技能。根 `tools/` 只承载跨步骤共用能力；单步骤工具和测试跟随对应编号步骤。编号只用于定位；实际调度仍由 [workflow.yaml](../workflow.yaml) 的显式 DAG 决定。

| 位置 | 所有者与用途 |
| --- | --- |
| [workflow_plan.py](workflow_plan.py)、[workflow.schema.json](workflow.schema.json) | 总控：解析整个 DAG、绑定输入、记录/恢复节点与有限返修 |
| [svg-source.cjs](svg-source.cjs)、[svg-geometry.js](svg-geometry.js) | 盘点、编译、扫描共用的浏览器、静态 SVG 读取和几何方法 |
| [tool-common.cjs](tool-common.cjs) | 三个工具入口共用的 JSON、schema 和命令行处理 |
| [preview/svg-boundary-runtime.js](preview/svg-boundary-runtime.js) | 编译能力校验、扫描、独立审查与最终交付共用的连续插值运行时 |
| [preview/boundary-preview.html](preview/boundary-preview.html) | 独立审查与交付共用的参数预览，及游戏工作台导入源 |
| [1.inspect/tools/inspect-svg.cjs](../1.inspect/tools/inspect-svg.cjs) | 仅盘点步骤：节点清单和原稿渲染 |
| [5.build-rig/tools/build-rig.cjs](../5.build-rig/tools/build-rig.cjs) | 仅编译步骤：调用本目录 boundary-compiler.js，生成固定拓扑关键形 |
| [6.scan-boundaries/tools/scan-boundaries.cjs](../6.scan-boundaries/tools/scan-boundaries.cjs) | 仅扫描步骤：真实帧、接触表分页与 finalize 恢复 |

共同的 JSON 契约在 `contracts/`，说明在 `docs/`；模型提示词在各自步骤目录。作者配方示例在 `4.author-boundaries/examples/`，不充当正式角色输出。

从技能根目录安装与检查：

```sh
npm ci --prefix tools
python3 -m pip install -r tools/requirements.txt
python3 tools/workflow_plan.py validate
python3 -m unittest discover -s tools/tests -p 'test_*.py'
npm test --prefix tools
```

工具需要 Chrome/Chromium，可以设置 `ASTRA_BROWSER` 或运行 `npx --prefix tools playwright install chromium`。`ASTRA_PYTHON` 选择安装了 jsonschema 的 Python。具体 CLI 和恢复命令见 [形变契约](../docs/boundary-rig.md)。所有产物写入本轮输出根，不写回源 SVG 或技能目录。
