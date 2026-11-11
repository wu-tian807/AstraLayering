结论：已修复

# review-02 修复记录

当前正式工程 clothing-raster-layering/step01/clothing-depth.kra 的 R1–R9 均已处理并通过逐项看图自检。延续前次七项实际修改，本次重画完整后返绳解决左右接头；当前结论替代旧暂存的“仍有问题”结论。

## 逐项结果与证据

| 编号 | 结果 | part／区域 | 实际处理与看图结果 | 最终证据 |
|---|---|---|---|---|
| R1 | 已修复 | d13 / kimono_body/right_underlap_panel；双粉线续接 | 自身邻接深领料局部取样清理旧接点，Krita连续笔触接顺双粉线，宽度与浓淡平缓延续。保留外襟覆盖，无凸台或新白缝。 | [三视图／局部](repair-evidence/repair-02/inspection/R1-three-views.png) |
| R2 | 已修复 | d02 / rear_drape_screen_right；y1180–1365 | 本件参考配准外轮廓与翻面内缘，局部融色和alpha接顺；复查发现的起点小台阶也已修顺。两花、草叶、腰后根及底框保留。 | [三视图／局部](repair-evidence/repair-02/inspection/R2-three-views.png) |
| R3 | 已修复 | d12＋d23 / front_waist_cord_knot；左腰转入 | 将错误外伸后返翼改画为沿腰侧向内回绕的完整后绳。d12整圈深线、粉白料面和隐藏中段完整；d23原画保留，左前转线落在真正投影外缘，同片off不再横截布面。 | [三视图／局部](repair-evidence/repair-02/cord-continuation/R3-turns.png) |
| R4 | 已修复 | d12＋d23 / front_waist_cord_knot；右腰转入 | 按右腰转折检查同一完整后绳的右端，后绳进入前向投影内侧；右前转线成为真实外缘，off/on无内部封口弧线。双环、结芯和真实开口保留。 | [三视图／局部](repair-evidence/repair-02/cord-continuation/R4-turns.png) |
| R5 | 已修复 | d03 / rear_waist_bow/right_bow_wing；画面左下翼 | 本侧三色控制局部生成，等比配准并羽化接回宽缓灰紫折面及褶脊，消除错误尖亮紫分区。完整隐藏根、翼尖、外线和留空保留，不带袖带投影。 | [三视图／局部](repair-evidence/repair-02/inspection/R5-three-views.png) |
| R6 | 已修复 | d04 / rear_waist_bow/left_bow_wing；画面右下翼 | 按右侧独立三色生成，未镜像R5；恢复本侧宽缓折面和褶脊，接顺外缘窄亮条及细锯齿。隐藏根与真实翼尖保留。 | [三视图／局部](repair-evidence/repair-02/inspection/R6-three-views.png) |
| R7 | 已修复 | d08＋d15 / sleeve_screen_left；白折角及原生蒙版 | 沿原画真实白折角与左斜黑折线调整显露区，用Krita原生笔触补强原有淡底边。off保留完整内壁，on不再呈白剪口，没有沿旧蒙版边新增内部截线。 | [三视图／局部](repair-evidence/repair-02/inspection/R7-off-on-joins.png) |
| R8 | 已修复 | d09＋d16 / sleeve_screen_right；白折角及原生蒙版 | 独立沿本侧原有折角显露真实右斜边和自然底角，去掉平剪端及残尖点。off完整内壁保留，没有镜像覆盖或新增截线。 | [三视图／局部](repair-evidence/repair-02/inspection/R8-off-on-joins.png) |
| R9 | 已修复 | d14 / kimono_body/left_overlap_panel；x565–625,y1075–1213 | 本外襟参考窄界面配准取样、融色，清除细亮拼接带和断续灰点，只保留真实深色襟边。粉线、金花、上褶及原生底缘保持。 | [三视图／局部](repair-evidence/repair-02/inspection/R9-three-views.png) |

## R3/R4 的连续绳路修复

先前取样擦掉 d23 端线的尝试不满足默认转入外边，已回退且未采用。此次按参考穿着及原 groups 的连续回绕职责纠正 d12 几何：旧外伸翼转为绕入腰后、前向投影收于前绳内侧的完整后带。全部隐藏布料用黄色、外部绿色、输入抹灰，以本绳粉白料面为材质参考进行 imagegen；含完整包边的结果等比缩小配准，直接替换 d12 自有绘画缓冲，原生蒙版不烘焙。

单层 off 显示完整后绳的中段、两端、斜纹和整圈描线；隐藏 d23 及上层时能检查完整底纹。同片 off/on 合看，左右前转边落在外轮廓，内部不再出现横截粉白布面的弧线；默认可见短转入、双环、结芯及真实环孔保持。d23 的原画与 d12 原生蒙版选区、UUID均未改。独立 d12、d23 深度保留，后绳可恢复，不依靠删底纹、合层或新蒙版隐藏修复。





- [左转入的前片、后片、同片 off/on 和默认](repair-evidence/repair-02/cord-continuation/R3-turns.png)
- [右转入的独立检查](repair-evidence/repair-02/cord-continuation/R4-turns.png)
- [三色控制与等比配准记录](repair-evidence/repair-02/cord-continuation/generation-plan.json)
- [原生蒙版及前绳画面保留](repair-evidence/repair-02/cord-continuation/application-verification.json)

## 七项保留修复与额外发现

R1 连续粉线、R2 外缘和翻面内线、R5/R6 两侧宽缓折面、R7/R8 小白折角及显隐、R9 白料界面均重新看过本次最终导出，修复保持。此前修画中另发现的 R2 起点 alpha 小台阶、R6 外缘窄亮条与细锯齿也已接顺。当前全片复查未另发现确定问题。

[R1 接点放大](repair-evidence/repair-02/inspection/R1-junctions.png)；[R2 正确alpha深底](repair-evidence/repair-02/inspection/R2-deep-background.png)；[R9界面放大](repair-evidence/repair-02/inspection/R9-interface.png)。

每项均已看单层、隐藏更高深度和整图；蒙版相关项另看同 part off/on。25 个深度独显与 18 个同 part 的 off/on 已导出复查。画质判断没有用数值相似度替代。



## 结构、归属与原生控制

18 逻辑 part、25 普通深度片、4 原生蒙版保留，无新增身体层、投影层或临时补片。先保存 front_waist_cord_knot.svg 的向内后返补全，再用 edit_occlusion 同步 d12/d23 区域、前后关系与分界。groups.json 原有绳路职责正确，ID和归属不变，不需要拆出新控制节点。后返约 x522–865、y704–741，与旧外伸色块的差异已修正到有效上游 SVG。

全部实际 part ID、图层名称、UUID、深度、区域、复用来源、蒙版所属层及控制区域见 [report.md](report.md)。[原尺寸检查清单](repair-evidence/repair-02/final-inspection-manifest.json)；[各次生成来源](repair-evidence/repair-02/generation-provenance.json)。

## 保存重开检查

最终 KRA 已保存，工作文档实际关闭后重新打开指定路径，等待图层树和投影完成。核验通过：25 绘画层的名称、UUID、类型、层序、显隐、透明度和绘画缓冲完全一致；4 原生透明度蒙版名称、UUID、选区缓冲及启用状态一致；画布、色彩属性和合成投影一致。默认 PNG 与重开 PNG 的 RGBA 一致。重开核验只是保存完整性证据，九项修复结论另由看图确认。

[重开结构、绘画和蒙版核验](repair-evidence/repair-02/reopen-integrity.json)；[最终交付核验](repair-evidence/repair-02/delivery-verification.json)；[重开默认 PNG](repair-evidence/repair-02/reopened.png)。

已更新 clothing-depth.kra、clothing-depth.png、全部验收 PNG 和 report.md。本报告仅写入 repair-02.md.tmp，未自行发布正式 repair／review 或修改调度状态文件。全部九项自检通过，首行写“结论：已修复”。
