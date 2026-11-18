# Live2D 投影蒙版交付

已保存 1086 × 1448、透明背景的 `character-shadowed.kra` 与一致导出的 `character-shadowed.png`；`shadows.json` 为 v2，共 15 张独立绘画影层。所有新增投影用 Krita 的 Basic-5 Size 与 Airbrush Soft 画笔逐笔绘制，未用参考贴图、滤镜或程序生成阴影像素。硬边使用实笔，柔边使用软笔；全部为 multiply，保留底层线稿、材质与高光。



上排是原组装、关闭全部新增投影、最终结果；每格取原图 x340–739、y0–339，400 × 340 像素，不缩放。下排展示同一 bangs part 内细发尖端随影层的相对偏移：[-4,0]、[4,0]、[0,5]；接收面及原发层保持复位。

## 参考观察与处理

先并排查看组装图及 simplified 全图，再查看头脸、颈部、裙下、白色马尾交叉与胸结局部。以 simplified 的投影为依据，组装 PNG 只作几何配准。参考的皮肤投影偏暖红灰，眼内投影偏冷灰，裙下投影偏红褐，白发及衣服的接触影偏灰紫。色值是绘画颜料色，透明度是影层不透明度；最终像素还经过接收面颜色与 multiply 合成，不能把颜料色直接当作最终受影色。

| 影层 ID | 投影部件 → 接收面 | 颜料色 / 不透明度 | 形状、边缘和依据；运动检查余量 |
|---|---|---|---|
| chin-to-neck | character:face/face_base → character:neck | #b36564 / 62% | 对应参考下巴下的暖红 V 形暗面；隐藏上缘铺宽，下缘轻微软化，填平笔触间隙；横向 ±5、向下 6px。 |
| skirt-to-legs | clothing:pleated_skirt/skirt_body → character:legs/leg_left/leg、character:legs/leg_right/leg | #673d3e / 48% | 参考裙下红褐色横向弧带；完整连续笔触跨过两腿间隙并伸出腿缘，裙下中心较低，边缘较实、末端轻软；横向 ±10、向下 10px。 |
| upper-lid-left | character:face/eyes/eye_left/upper_eyelid → 同眼 sclera、iris、highlight | #55515d / 55% | 上眼缘后整片冷灰暗带，同时覆盖眼白与虹膜上部，软刷向下渐淡；上方隐藏区完整，横向 ±4、向下 4px。 |
| upper-lid-right | character:face/eyes/eye_right/upper_eyelid → 同眼 sclera、iris、highlight | #55515d / 55% | 与另一眼同色，按本眼上缘弧度分别画；跟上眼睑而非 iris；横向 ±4、向下 4px。 |
| bangs-to-face | character:hair/bangs → character:face/face_base | #bd8d86 / 38% | 参考刘海尖端下的窄暖灰边；按额前主发尖及细条发束逐笔延伸，发下保留根部；横向 ±4、向下 5px。 |
| side-hair-right-to-face | character:hair/side_hair/side_hair_right → character:face/face_base | #ac7972 / 38% | 画面左侧颊缘窄暖影，顺侧发弧线，由实笔及软笔叠接；横向 ±4、向下 4px。 |
| side-hair-left-to-face | character:hair/side_hair/side_hair_left → character:face/face_base | #ac7972 / 38% | 画面右侧白发内缘到脸颊的淡窄影，不覆盖颊部高光为实色；横向 ±4、向下 4px。 |
| clip-upper-to-bangs | character:head_accessories/hair_clips/hair_clip_upper → character:hair/bangs | #6d6379 / 30% | 黑色交叉夹下的短软接触影，隐藏于夹片下继续延伸；[-2,0]、[2,2]。 |
| clip-lower-to-bangs | character:head_accessories/hair_clips/hair_clip_lower → character:hair/bangs | #6d6379 / 30% | 心形夹下缘的折弧接触影，保持白发线条可见；[-2,0]、[2,2]。 |
| bow-left-to-tail | character:head_accessories/hair_bows/hair_bow_left/bow_body → character:hair/ponytail/ponytail_left/ponytail_back | #777082 / 34% | 白色马尾扎点、发结下缘的短宽灰紫软影，结体后有完整搭接笔触；横向 ±5、向下 6px。 |
| bow-right-to-tail | character:head_accessories/hair_bows/hair_bow_right/bow_body → character:hair/ponytail/ponytail_right/ponytail_back | #777082 / 34% | 黑色马尾根部同类投影，避免重复压暗整束黑发；横向 ±5、向下 6px。 |
| chest-right_loop | clothing:chest_bow/right_loop → clothing:camisole/bodice | #777080 / 22.75% | 画面左结翼下的短软弧影，参考黑附件邻接白衣的灰边；[-3,0]、[3,2]。 |
| chest-left_loop | clothing:chest_bow/left_loop → clothing:camisole/bodice | #777080 / 22.75% | 画面右结翼下同类接触影，分别保留来源；[-3,0]、[3,2]。 |
| chest-right_tail | clothing:chest_bow/right_tail → clothing:camisole/bodice | #777080 / 22.75% | 画面左下垂带后的细长软影，隐藏根部连续延伸；[-3,0]、[3,2]。 |
| chest-left_tail | clothing:chest_bow/left_tail → clothing:camisole/bodice | #777080 / 22.75% | 画面右下垂带后的细长软影；[-3,0]、[3,2]。 |

每项实际 caster/receiver UUID、影层 UUID、base UUID 及偏移均记录在 shadows.json。眼白、虹膜、高光使用保留原节点及子蒙版的接收 base 子组；双腿使用联合 base 子组。单接收面的 base 为该原部件。base 下方不混入其他实色层，外层隔离组内用 Krita 原生透明度继承裁切。follow 只记录运动来源，未制作 deformer 或光向关键形。

## 保留与未另建项

- 保留马尾内部原有的灰紫褶面、白发交叉处细灰边及黑发条带明暗；与参考并排查看后，这些位置已有对应暗面，未再叠加一层大面积阴影，避免把原发束自身明暗重复压黑。没有把同一 part 的细束另造 part。
- 领口荷叶边、腰头压褶、结翼自身折返及鞋面折面属于现有 part 自身明暗，原样保留。胸结结心到黑色翼根的暗区被结心覆盖，参考没有可稳定分离的额外可见影带，本步未单建该项。
- 本角色是无袖吊带装，参考没有袖口到手臂投影；肩带边缘主要是原线稿，未添加臆测的宽影。侧发到耳内的区域在当前姿势中基本遮住，未另造无可见轮廓依据的耳内投影。
- 组装与 simplified 的固有画法、衣褶、脸部及眼形有差异；没有改原部件去追齐这些差异。仅新增投影。

## 检查结果

最终 `inspect_shadow_mask`：passed=true，problems=[]。已查看每处完整影层、接收覆盖、静帧及全部声明偏移；复核图见 [检查总览](inspection/overview.png)，各项 `inspection/relation-000-review.png` 至 `relation-014-review.png`。原尺寸检查输出位置以 inspection.json 中的实际绝对路径解析记录为准。

四条 warnings 均是胸结影层“没有裁切外像素”。这四件附件完全位于宽阔衣身内部；软笔影子是完整自由笔触，没有按衣身预裁。附件下已有隐藏根部与软边，声明的 3px 微动仍位于接收面内，因此保留该提示，无需把影子无依据地延伸到衣服外缘。

修复记录：修正首轮取色接口；调整接收节点层级，恢复并保留原眼部子蒙版；为联合接收面增加独立 base；填平裙影中部漏画亮缝后重新保存、导出及检查。

保存后重新读取 KRA 结构核对：原 UUID 无缺失，11 个原蒙版的 UUID、父部件、visible、x/y、opacity 状态一致，未重建蒙版。关闭全部新影层后的投影与原组装仅 19 个眼部边缘像素有最大 1/255 的通道差，来自新增隔离组合成的舍入；没有改动原画层内容。检查明细保存于工作区 preservation-check.json。

正式输出：character-shadowed.kra、character-shadowed.png、shadows.json、face-review.png、report.md、inspection.json 与 inspection/。上游输入和另一阴影分支均未修改。
