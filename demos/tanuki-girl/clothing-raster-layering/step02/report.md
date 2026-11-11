# 衣服第二步：整图精修与独显检查

## 结果

完成本轮看图发现的 P1–P7 问题。默认组装、局部原尺寸与 2 倍放大、25 个深度层的底层独显及蒙版独显、18 个逻辑衣片均已检查；本轮检查未发现尚未解决的验收问题。正式工程为 [clothing-soft-edges.kra](clothing-soft-edges.kra)，保持 1376 × 2048 原画布。

以纯衣服参考为画风标准，以原穿衣角色确认领口、袖口和环绕穿插。输入 `clothing-raster-layering/step01/clothing-depth.kra` 只读打开；续跑工作工程保存在 `clothing-raster-layering/step02/workspace/working.kra`。正文中的任务路径以任务根目录为基准。

整图排列：纯衣服参考／修前默认组装／修后默认组装／原穿衣角色。袖口默认穿着范围沿用第一步原生蒙版，因此与纯衣服参考展开的袖口不同；底层远侧壁和实际内侧衣料仍完整保留。



## 整图问题清单与处理结果

先检查整幅合成，再放大领袖、腰部、下摆、两后垂片及饰件，随后检查所属衣片。下表范围为原画布坐标，d 编号为原有深度层次序。

|编号|发现的问题|所属深度层与范围|实际修改及结果|
|---|---|---|---|
|P1|领口、袖边、前襟粉色包边偏鲜亮，线内浓淡不足，视觉边缘偏硬。|d08、09、13、14、15、16；领口、袖边及襟边。|用 Basic-5 Size Opacity 沿已有包边中心逐段低压叠画柔和粉色，主要笔宽 4.5 px，保留原有宽度、边缘和走向。同一袖子的多个深度分片分别处理。回到组装确认线条连续，无新增接缝线。|
|P2|外襟左上斜领缘有小台阶、碎边。|d14；x595–665，y560–645。|用小尺寸原生橡皮笔触清理外伸碎边，重点接顺 y619–625 的局部轮廓。独显和合成均无新白缝、双线或突起。|
|P3|右长垂片浅紫翻面有横向拼接色痕，打断纵向衣料体积。|d02；x930–970，y1145–1310，接痕重点在 y1185–1220。|沿纵向用 Airbrush 逐笔叠画浅紫过渡，笔宽 12–34 px；接顺本片窄暗轮廓。横向接痕已融入纵向渐变，原外形与花草纹样保留。|
|P4|内腰布露出的下缘折面过尖、碎，明暗转折比参考急。|d17；x490–885，y792–871。|按布料走向用 24–64 px Airbrush 局部紫色笔触修缓亮暗，形成较宽的下部折面，与原有上部布料衔接。没有添加其他衣片投下的阴影。|
|P5|前襟金花偏亮黄，花瓣内部颜色较平，与衣料笔触不协调。|d14；x775–1005，y970–1165。|五个花瓣分别低压叠画柔和金色，笔宽 14–24 px，保留花心、白色分瓣、缺口及外形。花瓣内部有轻微浓淡变化，与原衣料协调。|
|P6|两颗红珠颜色过鲜，转色偏硬。|d24、25；x609–767，y909–951。|各珠分别用 10–13 px 玫红 Airbrush 局部叠画，避开白色高光。柔化红色转折，保留自身球体明暗、白环和穿绳关系。|
|P7|两流苏及珠缘外线偏细、偏锐，与参考线条重量不一致。|d21、22、24、25；x602–778，y909–1032。|沿本片实际外轮廓逐段补线：流苏 4 px 柔和底笔与 3.2 px 实线；珠缘约 3.1 px 原生笔刷轮廓。线宽和浓淡更接近参考，白环仍完整，无额外投影。|

### 修复前后局部证据

每张局部图从左到右为：参考／修前合成／修后合成／修前本衣片底层独显／修后本衣片底层独显。透明区域以灰色显示；底层独显不通过原生显隐蒙版裁掉隐藏衣料。每处均提供原尺寸及 2 倍放大，修画后在同一位置核对独显和合成。

**P1 包边**：领口主对照如下；其余两袖、前后深度和襟边对照列在后方。



[领口放大](evidence/comparisons/P1-collar-200.png)；[外襟领口原尺寸](evidence/comparisons/P1-collar-overlap-100.png)、[放大](evidence/comparisons/P1-collar-overlap-200.png)。

|位置|原尺寸|2 倍放大|
|---|---|---|
|左袖远片 d08|[对照](evidence/comparisons/P1-left-cuff-100.png)|[对照](evidence/comparisons/P1-left-cuff-200.png)|
|左袖近片 d15|[对照](evidence/comparisons/P1-left-near-100.png)|[对照](evidence/comparisons/P1-left-near-200.png)|
|右袖远片 d09|[对照](evidence/comparisons/P1-right-cuff-100.png)|[对照](evidence/comparisons/P1-right-cuff-200.png)|
|右袖近片 d16|[对照](evidence/comparisons/P1-right-near-100.png)|[对照](evidence/comparisons/P1-right-near-200.png)|
|外襟边 d14|[对照](evidence/comparisons/P1-hem-100.png)|[对照](evidence/comparisons/P1-hem-200.png)|
|内襟边 d13|[对照](evidence/comparisons/P1-under-hem-100.png)|[对照](evidence/comparisons/P1-under-hem-200.png)|

**P2 斜领缘**：[2 倍放大](evidence/comparisons/P2-collar-edge-200.png)。



**P3 后垂片接痕**：[2 倍放大](evidence/comparisons/P3-drape-join-200.png)。



**P4 腰布折面**：[2 倍放大](evidence/comparisons/P4-wrap-folds-200.png)。



**P5 金花**：[2 倍放大](evidence/comparisons/P5-flower-200.png)。



**P6 红珠**：[左侧放大](evidence/comparisons/P6-left-bead-200.png)；[右侧原尺寸](evidence/comparisons/P6-right-bead-100.png)、[放大](evidence/comparisons/P6-right-bead-200.png)。



**P7 流苏外线**：[左侧放大](evidence/comparisons/P7-left-tassel-200.png)；[右侧原尺寸](evidence/comparisons/P7-right-tassel-100.png)、[放大](evidence/comparisons/P7-right-tassel-200.png)。珠缘同时见 P6 的前后图。



领缘和珠缘修画中曾出现新增细缝、白环变窄的试画问题；发现后恢复对应衣片原局部笔触，再重新修画、核对。试画缺陷没有留在交付中。

## 衣片完整性与结构保护

所有修改均在所属原绘画层使用 Krita 原生笔刷逐笔完成；没有生成整片替换，没有按参考逐像素改色，也没有全层模糊、全局羽化或公式批量修复。局部恢复仅用于撤回试画，取自同一衣片原有笔触。

保持 25 个绘画深度层、18 个逻辑 part 共同归属，未合并环绕前后衣片。4 个原生透明度蒙版仍启用：后结根默认隐藏、左右袖穿着范围、前腰绳结后片默认隐藏。原有显隐、剪贴属性和底层完整纹理沿用。检查了袖口远侧壁、领口前后襟、双绳环及腰部穿插，正常开口和实际内侧衣料保留。未画人体，未制作身体或其他衣片投下的投影。

本套参考与现有衣片中没有另列独立纱料 part；已有白色衣料的透明度、层次和开口按原结构核对，没有扩大或封住开口。完整深度层独显检查中未发现需要另修的缺块、异色残点、其他衣片残片或明显锯齿。整图中参考连续的轮廓、包边和纹样连接处逐区复查，未发现新增断线、台阶或参考没有的接缝线。本轮整图确认无问题的后结翼、其余后垂片纹样、腰带主体和绳环等保持原样。

[底层独显总览 1](evidence/raw-sheet-1.png) · [2](evidence/raw-sheet-2.png) · [3](evidence/raw-sheet-3.png) · [4](evidence/raw-sheet-4.png) · [5](evidence/raw-sheet-5.png)。全部原画布独显位于 `evidence/raw/d01.png` 至 `d25.png`，默认蒙版独显位于 `evidence/masked/d01.png` 至 `d25.png`。



逻辑衣片与深度对应见 [logical-index.json](evidence/logical-index.json)。默认隐藏的后结根在默认独显中为空，完整底层可在 raw/d05.png 查看；后腰绳片同理，并非删除像素。

## 保存后重开核对

正式保存后关闭文档，重新打开 `clothing-soft-edges.kra`，等待渲染完成并重新导出合成。核对结果：

- 原画布 1376 × 2048，颜色模型、位深、色彩配置保留。
- 与输入比较，全部 29 个节点（25 绘画层、4 蒙版）的顺序、名称、UUID、类型、默认显隐、透明度、锁定、Alpha 锁、继承 Alpha、混合模式及颜色标签一致。
- 4 个原生蒙版选区像素与输入完全一致。
- 实际修改的层为 d02、08、09、13、14、15、16、17、21、22、24、25。其余 d01、03、04、05、06、07、10、11、12、18、19、20、23 共 13 层像素与输入完全一致。
- 正式保存前与重新打开后，全部绘画层像素、蒙版选区像素、节点属性及整图合成像素完全一致。

核对记录：[reopen-integrity.json](evidence/reopen-integrity.json)；重开合成：[reopened-composite.png](evidence/reopened-composite.png)。哈希仅用于输入保留与保存完整性核对；美术验收依据上述看图检查。

## 未解决的问题

本轮上述整图、局部及独显检查未发现未解决的验收问题。后续绑定与投影制作不属于本步静态衣片交付。
