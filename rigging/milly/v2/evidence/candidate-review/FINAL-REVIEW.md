# v2 独立视觉复验最终结论

**通过本轮动画扩展的定向视觉复验。** 已确认的三项问题均关闭：手臂前后交接闪跳及中间态横截口、极限组合肩部后衣片尖角、手机跟随按钮激活对比度。没有尚未关闭的已确认交付阻碍。

最终候选：`/Users/wutian/Desktop/coding/AstraLayering/rigging/milly/v2/index.html`。

| 文件 | SHA-256 |
|---|---|
| index.html | 613e7201c087f6761336c2651f3fcdb55978ebf58b1443ca0cf01309f1f5cbe4 |
| rig.js | e21cd472b08aa87fbd746a25d516726c6e5707805fb234aaf8484d7fa1052ade |
| build.py | 8a1369403f8150f49e10a7a458b828671967d8770685bc3b42b1c0312ee97c4a |
| milly-animation.svg | 36a08ef98d1550041ab04ddc86e170f3a358b47fa02cd6c7523591f03b7c0a6f |

最终快照在 `revision-3/reviewed-*`，完整哈希见 `revision-3/versions.json`。完成报告时工作目录HTML哈希与冻结版相同。

按 svg-layering 独立review方法，实际独立渲染候选、目视整图/邻接/遮挡，并以同画布同裁切图像比较；数值仅辅助定位。范围是用户要求的v2动画修正，不把阶段3全部绘制重新验收。

| 范围 | 结论及证据 |
|---|---|
| 手臂与衣服前后关系 | 最终通过。外展、单侧前伸、双侧收背、混合收背与转身；0附近换层、7→7.1、10–25区间和连续收背均无大片跳变、横截口、黑手。见 `revision-3/REVIEW.md`、`tuck-contact.jpg`、`elbow-switch-contact.jpg`、`continuous-tuck-contact.jpg`。 |
| 头型、五官、脸部渐变 | headX±30、bodyX±10、正负俯仰及XYZ组合未见五官挤成细条或渐变脱离；单眼/双眼闭合正确。见首轮 `faces-contact.jpg`、大图与 `REVIEW.md`。后续返修未改变已验的核心脸部变形。 |
| 普通嘴型 | 1s/3s/6s/12s及最大开口已目视，普通开口显著小于v1，不再占脸过大。原视频开闭反向标尺转换保留正确语义。 |
| 正向低头、头身迟滞 | 正headY/bodyY低头；真实鼠标移动时头先、身后。见首轮 `checks.json` 和俯仰图。 |
| 参考动作、发束惯性 | 连续播放2.6–3.5、4.6–5.6及15.2–15.7；转向/低头事件顺序与参考对应，发束和呆毛在头部停下后回弹。低头另做0.1秒实时DOM快照，见 `continuous-nod-contact.jpg`；无风平滑转向见 `smooth-contact.jpg`。没有用逐帧seek代替动态检查。 |
| 肩缝/服装后片 | revision-2修复确认，原极限组合的白色后片尖角消失。见 `revision-2/combo-shoulder.png`。 |
| 手机、物理入口 | 320/390无横向溢出；物理仅刚度/阻尼/风力/强度，无手动发束方向。激活按钮深底浅字。见手机大图及 `revision-2/mobile-follow.png`。 |
| 基本性能 | revision-2 1440×1000短段约60fps、2.2秒实际播放推进2.2167秒；最终复验无pageerror。不是跨设备性能保证。 |

首轮和第二轮的“需返修”报告为历史版本记录；本文件和 `revision-3/REVIEW.md` 是最终状态。未重复主流程完成的全部参数实效、JSON导入导出和文件打开检查。

这是既有基础服角色、有限角度二维动作扩展的通过结论，不代表完整3D旋转、Cubism工程或对原视频逐像素复制。
