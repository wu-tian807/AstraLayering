# ParamAngleX=-30 候选交付

本轮为待用户确认的候选。只制作 X=-30，右侧由真实管线镜像生成；Y、四角与 step07 尚未制作。固定视框为原画布 `[431,35,394,394]`，canvas 为 1254×1254，axis=627.5；所有比较均保持原坐标，没有按眼睛或下巴重新对齐。

## 来源与作者状态

- 原 KRA：`character-assembly/step01/character-assembled.kra`；SHA256 `56b11c5fd7a3db20e512de642bb1a5922d2f312b2c96557d0c8d3da022587ad4`。
- 同画布原合成 PNG：`character-assembly/step01/character-assembled.png`；SHA256 `52359407596567a2874c9714b1e4ea336f1268916e3de784737deeb8de8f173c`。
- 最终作者：`nine-axis/step02_angle-x/face-left.json`；SHA256 `494882041541657aa9555d18739b0b8b06d851c34c00863e4bd34d5b96bd9088`。
- 本次 trace SHA256：`9d3099adcf7f33b3adba3b7b1fe28c3d69d9e8c6d3c85746a69fc48dfee9047e`；left 参考 SHA256：`d6832b155687216cc5b161b4dd9ed3c3eee6c1d1fa344822501337c29cd2e155`。
- 原 KRA 保持只读。24 个部件均来自本次 Krita projectionPixelData 导出，含可见图层附属蒙版效果，按原 bounds 裁透明 PNG；导出顺序、原名称、UUID、原 bounds 与各 PNG 哈希见 [export-record.json](export-record.json)。[source.json](source.json) 与这些来源一致。本次从静止网格制作，没有导入 continuity 的网格、参数、描线或贴图。

## 分组和五官

`face_shape` 仅控制同层脸色、腮红和颊颌笔触的 `face/face_base`；8×10 平滑网格用于对应眼窝、陡颊、颌角、小尖颏的分段轮廓。原 KRA 没有独立的脸线/腮红/耳层，未伪造耳朵。

近侧 `eye_left_pose` 与远侧 `eye_right_pose` 分别将上睑、褶线、下睑、睫毛、虹膜、高光、眼白七层一起液化，均为独立 3×3 Warp，并显式镜像配对；没有把两眼挂到脸底。`mouth_pose` 的 2×3 网格联合五层唇、舌、齿和口腔；眉、鼻独立调整。脖子为最下方独立部件，parent=null。

一次 operations 批次完成眉眼、鼻嘴的整体位移、远侧眼宽压缩和口部透视斜度；随后整体双眼宽度再微收、虹膜与高光同步移动，鼻部纵向回展并上移 1px。近侧眼整体约左移37.5px，远侧约左移20px并压宽；嘴整体左移35.6px并略收宽，鼻嘴未钉在正面。腮红随原脸底变形。最终检查中眼角、眼睑峰值、虹膜/高光、嘴角与口腔没有分离。

## 描线、补全与实际拟合

source 由本次完整 face_base alpha 独立提取并分段贴合，预览底图按原 textureBounds 放回画布，再按固定 box 裁切。source/target SVG 的填色闭合轮廓与 trace completion、curves 使用同一组 path 段；整图 blend、重叠局部 blend/edge 均实际查看。远侧眼窝、上颊、近竖直颊线、颌角、下颌到下巴分开处理，发束切入皮肤的凹口没有捏进脸肉。最终 source/target 边缘检查见 [source-trace-edge.png](source-trace-edge.png)、[target-trace-edge.png](target-trace-edge.png)。

角色原脸为饱满颊部、下颌渐收、小尖颏，采用圆润鹅蛋脸的隐藏结构知识；实际查看 Hiyori 单模型、分类板、圆脸视频3.25/6.7/7.7/8.7秒及关键帧板、教程03:38/03:47/04:03和完整 left 脸底。只借太阳穴至额顶的连续体量，保留本角色体积及 left 可见笔锋，没有平均圆脸与长脸，也没有拿模型原角度作为本角色标尺。

隐藏补全包括额顶中心、双额角、太阳穴、近侧眼窝/完整颊部、远侧被发束盖住的短连接段。真实显露的远侧眼窝与陡颊段标 visible，发束遮挡的小段另标 occluded。实际调用 fit_nine_axis inspect、查看无遮挡完整 source/target 素脸后再 fit；最终再次 inspect，completionMismatch=[]。共16条曲线，visible 权重1，occluded 权重0.03，`occludedWeightScale=1`。自动 fit 的99个控制点、smoothness=0.004；[fit-report.json](fit-report.json) 给出每段误差，不能将其当成描线贴视频的证明。

| 可见段 | 拟合后平均/最大误差（原画布px） |
| --- | --- |
| 远侧显露眼窝 | 0.082 / 0.179 |
| 远侧上颊 | 0.142 / 0.362 |
| 远侧陡颊 | 0.191 / 0.535 |
| 远侧颌角 | 0.334 / 0.735 |
| 远侧颌至下巴 | 0.164 / 0.735 |
| 近侧下巴至颌 | 0.024 / 0.079 |

该 fit 后的脸底没有再局部编辑；后续修改只影响五官。最终作者 SHA 因五官编辑而改变，fit 报告仍对应当前脸底，而本次验收用的是最后编辑后的新渲染。实际无遮挡脸底在 [face-base-left-check.png](face-base-left-check.png)，与完整预测同坐标对照在 [face-base-completion-overlay.png](face-base-completion-overlay.png)，预测素脸在 [face-completion-check.png](face-completion-check.png)，三者职责分开。

## 额顶、额角与静态覆盖

最终真实 alpha 与完整预测吻合；額顶连续圆弧经双额角连到太阳穴，放大没有缺顶、凹坑、压薄、波纹或断续。原 alpha 的细小像素起伏和额顶短平保留，未重绘。[forehead-temple-check.png](forehead-temple-check.png) 显示实际脸底及网格，而非只放 SVG 预测。

覆盖依据来自原 KRA 的真实刘海/前鬓投影与指定 left 帧。中央额底延续在刘海下沿后，近侧额角至上颊保持完整体量，远侧太阳穴在竖向发束背后继续连接；没有沿发尖闭合皮肤窗口。最终 [hair-coverage-check.png](hair-coverage-check.png) 的三栏为参考帧、当前脸部和50%同坐标叠加，检查静态发缘后的搭接。原头发导出到 workspace/context 仅作诊断，本作者工程只有脸、五官和固定脖子，未制作头发 Warp 或动画；未知发摆范围，不能据此宣称未来头发动也不露底。脸底原贴图足以覆盖本次预测，鼻部与眼睑的原绘画细节仍构成素材差异。

## 最终可见差异及 step07 接续

最终完整同坐标检查见 [left-check.png](left-check.png)、[left-fit-check.png](left-fit-check.png)；远侧眼窝、眼尾、颧颊及脸缘放大见 [far-side-check.png](far-side-check.png)，颌角和下巴见 [jaw-chin-check.png](jaw-chin-check.png)。轮廓位置与陡直走势贴合；颌角邻接发束处仍有不足1px的曲线拟合残差。眼尾尖端、睑线粗细和原颊颌细笔与视频有约1–2px的目视细节差异，此值是目视估计，不是残差量测。鼻的原白点比视频显亮，短鼻笔形状略不同；没有用视频像素或重绘替换这些原贴图。

固定脖子的作者和编译工程所有关键形完全一致，未移动、拉长或倾斜。left 下巴在原画布约 `(596,316)`，至近侧颌约 `(650,299)` 覆盖固定脖子顶部；最终没有明显背景断缝，但下巴下缘至脖子上缘的接触线、颈侧顶端的覆盖余量和投影阴影尚待 step07。视频中颈侧线的倾斜与原固定脖子不同，本步保持脖子不动。接触区域详见 [neck-contact-check.png](neck-contact-check.png)，右端接触/阴影收尾区域约 `[641,292,23,31]`，下巴左端约 `[587,310,21,21]`。

## 端点与连续参考

最终实际查看 X=-30、-22.5、-15、-7.5、0、7.5、15、22.5、30，Y均为0，采用线性参数轨迹；观察到脸底、双眼、口层逐步变化，没有明显突然收缩、融化或分离，额頂/额角体量连续，脖子固定。排板 [intermediate-check.png](intermediate-check.png) 与额部同坐标局部 [forehead-transition-check.png](forehead-transition-check.png) 均来自最后一次编辑后的工程，未按各角重新居中；[front-check.png](front-check.png) 确认最终0度仍与原KRA合成重合。单轴离散视觉检查不等于Y/XY集成验收。

实际读取 continuity-reference/README.md，查看 face-base-sequence.png、face-sequence.png（X=-30、Y25→0→-25）、up-current.png、down-current.png；另从 left-up-left-left-down.mp4 查看1.8/2.1/2.4秒零点邻近帧，诊断图在 workspace/continuity-video-diagnostic.png。参考中零点附近额顶比上下端更扁/略斜，角间脸底有小起伏；本轮隐藏圆顶与它存在体量差异，后续Y/XY应在固定left可见边缘前提下重新检查衔接。目录没有独立带头发的左上/左下完整角色图，仅有序列端点的脸底及脸＋五官；未把缺图当作已验证。当前工程未纳入这些Y/XY方向，也未复制其旧数据或拟合其它方向。

全部正式检查图的绝对路径、原工具输出路径与哈希见 [image-provenance.json](image-provenance.json)；来源、固定脖子和制作范围核对见 [verification.json](verification.json)。
