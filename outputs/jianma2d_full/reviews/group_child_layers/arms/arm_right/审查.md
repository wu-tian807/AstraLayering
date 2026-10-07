# arms/arm_right 直属轮廓独立审查

审查身份：`group_child_layers:arms/arm_right:review`，执行 worker `/root/workflow_runner/review_arm_right`；当前节点 n17。范围为三个直属组件。

候选 `block-layers/groups.svg`、冻结 candidate.svg 与范围报告所指 tmp 候选 SHA-256 均为 `b8a53f8741fbe4037020992a414be5aae253433dce163ffa891eb256479ebd08`。canonical 输入与报告所指 tmp 输入均为 `8a2dabee68366ef3325f0f9e21c7edc43ad471137fc5e32f1ccf51e1380246f6`；结构哈希与 input-proof 一致。复用已绑定的原生默认 scale=4、alpha=128 范围检查，三者 outside_samples=0；未重复运行。

已先用本轮预览工具生成并实际查看 [whole.png](whole.png)（完整候选、参考及 50% 混合；原尺寸 whole-native.png）：右肩至右侧指尖的整体位置、比例与参考对应。以下参考贴合判断独立于范围 PASS。

## arms/arm_right/upper_arm — PASS

色块 id：`part-arms-arm_right-upper_arm`。实际查看 [upper-arm.png](upper-arm.png)：crop=(502,366,114,307)、3×，含参考、独显、50% 混合及 edge-overlay。

完整圆肩根保留，发丝与躯干遮挡下有连续皮肤面；右肩圆弧到上臂外缘与参考对应，内侧由被发丝遮挡的连续面过渡至可见肘内缘。未把发丝边缘刻成皮肤缺口。肘下端为向下圆弧闭合，独显形体无横切平底、断块或尖刺；接合是否连续随后结合仅孩子组合图判定。

## arms/arm_right/forearm — PASS

色块 id：`part-arms-arm_right-forearm`。实际查看 [forearm.png](forearm.png)：crop=(540,544,121,315)、3×，含参考、独显、50% 混合及 edge-overlay。

前臂向右下的倾斜、肘下增宽再收至腕部的宽度变化与参考对应；内外缘连续，腕内侧小弯折保留，没有把相邻头发或腕部阴影并入外轮廓。上端为完整凸圆肘根，下端为圆弧腕端，均提供实体搭接面积；无机械横切端、漏条或局部扭曲。

## arms/arm_right/hand — PASS

色块 id：`group-arms-arm_right-hand`。实际查看 [hand.png](hand.png)：crop=(606,796,68,152)、5×，含参考、独显、50% 混合及 edge-overlay。

从补全圆弧腕根经掌部外鼓、内弯拇指至向左下伸出的全部可见指尖逐段核对，指尖位置、主要转向与指间开口对应本侧参考；未采用另一侧手的形状。约 x632–640、y875–904 的真实手内孔保持透明且顺应原孔形，拇指弯曲暗线没有被误抠成孔；掌指连接无断裂，最低指尖完整。根部在腕下遮挡区向上延续，为腕部活动保留搭接。

## 连接及整体结论 — PASS

实际查看 [connections.png](connections.png)：crop=(500,366,174,582)、2×，仅独显上述三个孩子，不显示父色块或祖先；含参考、孩子组合、50% 混合及 edge-overlay。肘部与腕部都有连续的面状重叠，组合外缘无缺口、白缝、台阶或突起。独显中见到的圆弧收口被相邻组件覆盖，色块分界没有形成机械横切形体。完整肩根、上臂、前臂、掌指与手内孔在无父底稿承托时仍成立。

三个直属组件逐项视觉 PASS，父范围检查 PASS。可见外轮廓与主要形状对应参考，隐藏面保持连续，允许进入后续流程。本结论只覆盖本轮直属轮廓色块；内部绘制与最终显影顺序不在本轮范围。

审查仅新增本目录的诊断图与报告，未修改输入、候选、结构、状态或技能，未执行 checkpoint／complete／publish。
