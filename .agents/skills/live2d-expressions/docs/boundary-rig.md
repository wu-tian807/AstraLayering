# SVG 参数边界形变契约 0.3

模型设计有限的参数边界关键形，程序一次编译同拓扑数值关键形，预览器只计算连续插值。本版不包含情绪预设、五官替换或附件。角色原 SVG 字节和节点层级始终保留，最大张口与眼睑闭合由作者校准，用户只操作已经可用的参数。

[expressions 工作流](../SKILL.md) 使用两个独立文档：

| 文件 | document_type | 职责 |
| --- | --- | --- |
| [boundary-recipe.schema.json](../contracts/boundary-recipe.schema.json) | `boundary_recipe` | 模型创作的边界曲线、参数轴、原稿区域和随动绑定 |
| [boundary-rig.schema.json](../contracts/boundary-rig.schema.json) | `boundary_rig` | 程序编译的固定数值关键形，供运行时直接插值 |

标准工作流额外要求 [basic-face-v1](basic-face-v1.md)：双眼开合/弧形、双眉高度/角度/弧形、嘴开合/形状共12轴，恰有每眼二维、每眉三维和嘴二维联合region，每轴包含min/default/max。标准recipe/rig顶层声明 `capability_profile:"basic-face-v1"`。通用0.3文档可省略profile以继续读取历史局部试验，但不能算标准工作流完成。

两者都使用 `schema_version: "0.3.0"`，未知字段报错。调度工作流和run-state仍为各自的0.2协议。作者配方中没有脚本、可执行表达式或每帧模型调用。

## 命令与证据

```sh
node 1.inspect/tools/inspect-svg.cjs --svg character.svg --out source/inspection/inventory.json
node 5.build-rig/tools/build-rig.cjs --svg character.svg --recipe boundary.recipe.json --out-dir compiled/rig
node 6.scan-boundaries/tools/scan-boundaries.cjs check --svg compiled/rig/character.svg --rig compiled/rig/controls.json --out-dir evidence/boundaries
```

工具需要Node、Playwright、Chrome/Chromium，以及工作流已有的Python jsonschema依赖；已有浏览器可用 `ASTRA_BROWSER` 指定，Python可用 `ASTRA_PYTHON` 指定。CLI在build时严格校验输入recipe和输出rig，在check时严格校验输入rig。`inspect` 输出真实节点、变换、边界和baseline.png。`build` 核对源哈希，输出原字节 character.svg、controls.json和build-report.json，不写回输入。

`check` 用同一个运行时渲染实际PNG、full-neutral.png、contact-sheet.png和report.json。每个 `visual_cases` 条目包含id、完整parameters、kind以及相对report目录的image路径。扫描包含实际各region全部作者格点、每轴极值与四分位中间点、二维区域组合和全轴极值；三轴眉毛网格按实际keys展开，增添纠形key也随之纳入；mouth的闭口/半开/全开 × 负/中/正九宫格包含其中。实际审查依据报告的清单，不把固定样本数写成艺术质量指标。

profile扫描还会保存capabilities：每个基础轴min/max的最大实际d/transform坐标差，以及双眼curve在同侧open=0时的额外变化。仅渐变变化不算；坐标差大于1e-6只是排除无效轴。

总览按20张分页，生成contact-sheet.png及后续contact-sheet-2.png等；这些仅供导航，原始逐case PNG仍是审查依据。扫描完成帧后保存scan-state.json及输入/图像SHA。若仅总览/报告组装中断，可执行以下恢复，不重拍未变化帧：

```sh
node 6.scan-boundaries/tools/scan-boundaries.cjs finalize --svg compiled/rig/character.svg --rig compiled/rig/controls.json --out-dir evidence/boundaries
```

finalize必须核对输入和全部帧哈希，且实际成功退出后才能记录scan成功。输入或帧变化则重新扫描；缺少持久扫描状态不能伪造成功、计时或审查记录。程序恢复报告应保留实际中断和恢复来源。

工具通过仅为 `ready_for_visual_review`。独立review必须逐case看图，并连续拖动每个公开参数；工作流记录器核对图像、参数和审查覆盖。扫描不证明全参数空间没有交叉，也不证明美术合格或60fps。可选的SVG帧快照只是证据，不成为新的作者源。

## 作者配方

顶层必须有 `character_id`、原字节 `source_sha256`、`parameters` 和 `regions`。可选 `subdivisions` 为1至16整数，默认4，用于一次性路径规范化/细分；它不是用户控制项。可选 `resources` 仅调整既有mask/filter及其rect的工作区。

每个parameter只有 `type: "number"`、label、min、max、default。min必须小于max，default必须有界；参数id例如 `eye.left.open`、`mouth.open`、`mouth.form`。嘴巴通常以open=[0,1]、form=[-1,1]组成二维区域，不能只给两个彼此无关的一维位移。

每个region定义：

| 字段 | 含义 |
| --- | --- |
| `id` | 该运动区域的稳定标识 |
| `space` | 原SVG内真实坐标空间节点的id，所有作者点均在此局部坐标系 |
| `axes` | 1至3个 `{parameter, keys}`；keys严格递增，首尾等于该参数min/max |
| `source` | 实际源轮廓的kind、path和x范围，见下文 |
| `bounds` | `[left,top,right,bottom]`，局部影响范围与周边固定边界 |
| `keyforms` | axes笛卡尔积上的有限作者关键形 |
| `bindings` | 原稿中受该区域驱动的实际路径/元素选择器及职责 |
| `paints` | 可选，实际渐变的id、职责与局部采样anchor |

`source.kind="aperture"` 用原path垂直截面的真实上/下边界作为基准，适合已有眼白开口。`source.kind="seam"` 用原path截面中线作为原闭口缝，并要求 `aperture` 引用已经存在的口腔path。两者都要求递增的 `x:[left,right]`。不从语义名称猜测边界，也不自动生成原稿没有的内部器官。

`source.kind="curve"` 使用原眉等单线/带状轮廓中心，只有path和递增x，不使用aperture字段。对应关键形使用四点 `curve`，可选 `curve_mode:"absolute"`（默认，目标中心线）或 `"offset"`（Y为相对原轮廓的位移场）。offset保留原眉细节，适合纯高度/倾斜，不因cubic拟合差异改变原形。curve源只能使用curve或identity，aperture/seam源只能使用upper/lower或identity。

关键形有三种形态：

```json
{"at":[0,0],"identity":true}
```

```json
{"at":[1,0],"upper":[[0,0],[3,-5],[7,-5],[10,0]],"lower":[[0,0],[3,8],[7,8],[10,0]]}
```

```json
{"at":[1,0,0],"curve":[[0,-3],[3,-3],[7,-3],[10,-3]],"curve_mode":"offset"}
```

这是结构示例，坐标必须由作者结合实际SVG设计。upper/lower各为4个二维控制点，构成三次贝塞尔接触边；上下端点相同，X控制点不倒退，曲线不得交叉。每个at的维度和顺序对应axes，完整网格每个组合恰好一个形。

嘴部默认创作open=[0,1] × form=[-1,0,1]的六个边界形，闭口且form=0保持原中性。程序插值open=.5，不要求模型手绘每个中间帧。若真实中间图像暴露缺陷，才增加有明确理由的轴key及相应完整关键形组合。

## 整个邻域一起运动

每个binding有 `selector` 和 `role`。selector只选择原SVG现有元素；空匹配和重复属性写入者会报错。默认选择path，程序由同一原path生成所有关键形；path绑定可用 `subdivisions:1..16` 覆盖全局细分，仅对出现棱角的口腔/clip提高精度，不把所有眼部坐标无谓翻倍。translate模式不使用该字段。非path只能使用 `mode:"translate"`，可选 `anchor:[x,y]` 指定区域局部参考点，缺省取其真实包围盒中心。translate绑定可选 `key_offsets:[{at:[...],offset:[x,y]}]`，在每个边界增加作者手调的区域局部位移，例如控制牙齿显露量。若声明，必须覆盖该region整个关键形网格；不能遗漏组合、在运行时重画牙齿或修改原路径。

| role | 处理 |
| --- | --- |
| `aperture` | 将原开口上下边界映射到作者边界，供眼白、口腔和既有裁剪同步使用 |
| `upper` / `lower` | 随上/下接触边位移，保留细节到该边的偏移；不按导向切线旋转睫毛尖 |
| `curve` | 按作者眉中心曲线/位移场联动原轮廓，保持到原中心线的细节偏移 |
| `surface` | 按位置选择上/下侧，运动向bounds外边界平滑衰减 |
| `surface_upper` / `surface_lower` | 明确指定归属侧，避免重叠皮肤/阴影因Y位置被误分到另一侧 |
| `rigid_upper` / `rigid_lower` | 对牙齿等选择上/下侧的参考位移，配合translate保留其自身形状 |

眼皮、睫毛、眼眶阴影、唇体、唇周阴影和相关clip都应列入绑定，或在规格中说明固定理由。只移动一条眼线或嘴线不构成完整的rig。虹膜/牙舌可以保留自身形状，但动态开口必须正确控制其显露。

paints是 `{svg_id,role,anchor}`。目标必须是既有的linearGradient/radialGradient，且明确使用userSpaceOnUse。编译器在anchor附近采样局部仿射近似并生成gradientTransform关键形；已由整个消费者平移携带的渐变避免重复位移。此近似不保证任意大幅形变都准确，必须看实际图。

resources是 `{svg_id, attributes:{x,y,width,height}}`，attributes至少一个合法数字，宽高为正。需要定位匿名rect时另加 `element_index` 和 `tag:"rect"`，索引为该ID所有者下同标签后代的零基序号。它只能扩展既有mask/filter/rect的工作区，不新增mask或图形。源文件不变，运行时实例在dispose时恢复原属性。

## 编译投影与运行时

compiled顶层 `focus:[x,y,width,height]` 为各region影响范围转换到SVG根坐标后的联合范围，供工作台定位，不改变源SVG。

编译器先在既有path节点内规范化原路径并固定细分，然后对所有作者关键形生成同一命令序列和坐标维数。规范化可以把原语法展开为M/L/C/Q/Z，不能新增器官、改变节点层级或让不同关键形拥有不同拓扑。源SVG文件仍原字节复制。

compiled region仅保留id、space、bounds和axes。每个binding包含：

- `region`、`role`、`target`、`property`。
- `rest` 数值数组与完整 `keyforms` 数值数组。
- `source_value` 原属性文本/空值，以及 `default_source_passthrough`。
- property为d时的 `commands`；transform/gradientTransform则固定使用六元SVG矩阵 `[a,b,c,d,e,f]`。

`target`三选一：`{svg_id}`、`{svg_id,path_index}` 或 `{svg_id,element_index,tag}`。不向原稿追加ID。所有关键形按axes笛卡尔积排列，**最后一轴变化最快**；运行时以分段线性/多线性权重插值坐标和矩阵，不执行作者曲线求解、路径解析或模型调用。

运行controls的source包含svg_sha256、recipe_sha256、generator=`boundary-keyforms-v1`，svg固定为character.svg。来源校验、轴覆盖、网格数量、commands坐标消耗数量和同维数由编译器/运行时验证；JSON Schema负责严格字段和类型，不能替代这些跨字段关系或视觉验收。

默认值要保持原中性的可见外观。可直接回到原属性的binding使用default_source_passthrough；原闭口稿的隐藏口腔/牙舌可能需要派生压合，不能把隐藏节点的d文本还原与原SVG文件字节保护混为一谈。reset回到参数default，dispose恢复所有被改动的实例属性。

[svg-boundary-runtime.js](../tools/preview/svg-boundary-runtime.js) 暴露 `AstraBoundaryRig.Runtime(svgElement, rig)`：`setParameters(partial)`、`reset()`、`dispose()`。未变化的区域不更新DOM；越界/非数值参数明确报错。文件、存档或网络同步不属于该运行时。

## 便携预览

打开 [boundary-preview.html](../tools/preview/boundary-preview.html)，选择原SVG和controls.json。预览器验证SVG哈希，动态创建min/default/max滑杆，支持面部/全身定位与原值复位；没有预设区。输入在requestAnimationFrame中合并，避免一次滑动反复重算同一帧。

自动审查可调用 `await window.boundaryPreview.load(svgText, rig)`，随后 `setParameters(values)`、`reset()`、`snapshot()`。此入口只消费已编译的controls，不包含编译器。它是便携验稿界面；60fps性能目标应在正式工作台与实际角色路径上测量，不能由这里的脚本执行耗时推断。

## Reproducible Jianma trial

[Jianma 局部试验配方](../4.author-boundaries/examples/jianma-boundary.recipe.json) targets the unchanged `outputs/jianma_clothing/final/character.svg`. Compile it with `node 5.build-rig/tools/build-rig.cjs`, then scan with `node 6.scan-boundaries/tools/scan-boundaries.cjs check`. This is a four-axis eye/mouth trial, without expression presets. The browser interpolates the authored endpoints; it does not call a model.
