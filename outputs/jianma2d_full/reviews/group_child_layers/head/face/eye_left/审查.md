# head/face/eye_left 直属轮廓独立审查

逻辑身份 `group_child_layers:head/face/eye_left:review`，实际 actor `/root`，未参与本组绘制与拆分。候选、树、参考、技能和游标只读。

冻结候选 SHA-256：`70b30798fc82215007f77b8e9b9c3d2ad04db8d386abccf772187a47b061ffee`。已读本节点 YAML、review 提示词、当前树和默认 4× / alpha 128 范围报告；四孩子越界均为 0。父级包含与可见参考贴合分别判定。

首先实际查看原生 `evidence/full.png` 中完整参考、完整候选与 50% 混合；眼部位置对应参考。随后用冻结候选生成四个直属孩子的独显 / 参考 / 混合 / 边缘图和无父连接图（8×），原尺寸无重采样排为 `evidence/component-review-board.png`；依次查看各行并立即记录。

## head/face/eye_left/upper_eyelid — PASS

色块 ID `group-head-face-eye-left-upper-eyelid`。实际查看合板第一行，对应原生 `evidence/upper-eyelid.png`：下缘贴合本侧较低的上眼裂，画面左侧外睫毛尖及向外的折角保留，右内眼角逐渐收尖。上方睑褶范围完整，发丝交叉处维持连续睫毛根而未切断；父补全的上睑皮肤余量不作为最终黑睫毛外缘。未见可见尖端漏描、主要弧线移位或断裂。父范围 PASS，越界 0；内部睫毛/皮肤/褶皱细分由该子组后续完成。

## head/face/eye_left/iris — PASS

色块 ID `group-head-face-eye-left-iris`。实际查看合板第二行，对应原生 `evidence/iris.png`：左右可见弧贴合蓝虹膜暗缘，重心、宽度和略圆的下缘与本侧参考一致；上方延续到上睑后，形成完整虹膜而非仅保留眼裂内片段。底边由下睑承接，外侧发丝遮挡后仍连续。没有把瞳孔或白色角膜反光挖成孔，未机械复制右眼。父范围 PASS，越界 0；瞳孔内部拆分和角膜独立高光不在本节点假定完成。

## head/face/eye_left/sclera — PASS

色块 ID `part-head-face-eye-left-sclera`。实际查看合板第三行，对应原生 `evidence/sclera.png`：完整眼球底面连续覆盖虹膜后方，两侧可见眼白楔区与参考相接，左外角发丝后的窄区没有被抠掉。上下扩展属于已批准的遮挡底面，不能直接暴露成更大的白眼；两端收束与上下睑搭接位置对应。未见把反光当孔洞、把眼白拆成碎片或接角断裂。父范围 PASS，越界 0。

## head/face/eye_left/lower_eyelid — PASS

色块 ID `part-head-face-eye-left-lower-eyelid`。实际查看合板第四行，对应原生 `evidence/lower-eyelid.png`：上侧睑缘沿参考较低、较圆的下弧连续接到右内眼角，左外侧较深的短睑缘及发丝后的承接保留。下方薄皮肤带为约 2–3 px 遮挡搭接，不能另画成第二条可见眼线；两端有序收细，没有细缝、孤片或透明缺口。父范围 PASS，越界 0。

## 连接与整体结论 — PASS

实际查看合板第五行、原生 `evidence/connections.png`：四个孩子同时独显，未用父形体填缝。上下睑在眼角有连续搭接，眼白两侧楔区和虹膜下缘相接，虹膜上部被上睑覆盖；未见相邻组件断开或透底细缝。本侧较低、更圆的眼裂和外角发丝后的连续形体均保留。

整体 PASS。此结论只覆盖直属轮廓与相接，不宣称上睑内部、虹膜细节、反光或最终眼裂显影完成；最终仍须用眼睑皮肤及受影关系遮住完整眼球底面的余量。候选和标准 guide 在审查结束时 SHA 一致且未改，复用对应默认父包含结果 `[0,0,0,0]`。
