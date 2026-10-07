# n8 head/front_hair 局部返修独立复验

逻辑身份 `group_child_layers:head/front_hair:review`；本次实际 reviewer `/root`，未参与本次候选制作。原报告和原冻结记录保留。本报告针对 n25 细束暴露的祖先范围缺口；n25 尚未通过或完成。

冻结候选 `refinement/groups/head/front_hair/local-repair-20261006/2.2/candidate.svg`，与标准 guide SHA-256 均为 `afa048e315e4621589d3dcee0190c5ff34334c1a375293e4d83557fe4e90ffde`。已读当前 2.2 YAML、review 提示词、Astra xhigh 模型标记、当前直属树、默认 4×/alpha128 范围报告和制作保护记录。五直属组件默认越界均为 0；父包含与参考准确性分别判断。

先实际查看原生 `evidence/full.png` 的完整参考、候选和 50% 混合：头部与全身参考位置一致，局部修订未表现为整体位移。父子色块的临时叠色不能代替单层核对。接下来逐直属组件独显，并在每项检查后立即写入记录。

## head/front_hair/fringe_left — PASS

色块 ID `group-head-front-hair-fringe-left`。实际查看原生 `evidence/fringe_left.png`（4×独显、参考、50%混合与边缘叠加）：宽片根弧、额侧下行弧和约 (370,282) 的长尖保留。新增眼侧细束从约 x413/y194 沿眉外缘下垂至 x393/y253，位置、方向和逐渐收细的自由尖与参考细发线对应；下端与宽片之间能看到狭窄背景缝，没有被补成一片。上段在宽发面后承接，未出现脱开的漂浮细线。当前组范围终于包含这条实际可见细束；旧报告对原包络完整性的判断不能继续用于否认本次发现的遗漏。默认父包含为 0 越界；n25 的两个 part 仍需单独制作和审查，本项不替代它。

## head/front_hair/fringe_right — PASS

色块 ID `group-head-front-hair-fringe-right`。实际查看 `evidence/fringe_right.png`：右侧较高的根弧、冠饰后中分接口及向右颊收束的完整组包络连续，与左侧走势不同，本次没有镜像替换。下端约 (499,279) 闭合，和外侧鬓片的搭接面仍完整。眼侧及耳前的范围含完整底面余量，不能把整个绿色包络直接当作最终可见白发；后续右刘海直属宽片/细束须依据参考分别保留其窄边及遮挡。该兄弟字节未改，未发现本次修订导致的新位移、断点或缺口。默认父包含为 0 越界。

## head/front_hair/temple_sweeps_left — PASS

色块 ID `group-head-front-hair-temple-sweeps-left`。实际查看 `evidence/temple_sweeps_left.png`：冠翼下至耳上的外弧及下部收尖连续，叠发片内部层次仍留给子组。耳旁两处小负形在独显中保持真实空白，并对准参考的两处露肤楔区；新增细束未改动它们。向内与宽刘海叠接的隐藏弧仍完整，未见外缘折断或孔洞被填。默认父包含为 0 越界。

## head/front_hair/temple_sweeps_right — PASS

色块 ID `group-head-front-hair-temple-sweeps-right`。实际查看 `evidence/temple_sweeps_right.png`：右冠翼后的根部、头侧宽弧及耳上渐收的外包络对应参考，向内留有与右刘海相叠的连续面。右侧没有复制左侧的两处露肤孔；下端曲线转向和尖端完整。该兄弟未改，局部新增细束没有改变它的外缘或内部空隙。默认父包含为 0 越界。

## head/front_hair/scalp_cap — PASS

色块 ID `part-head-front-hair-scalp-cap`。实际查看 `evidence/scalp_cap.png`：冠饰下的顶部弧面连成一片，两侧头部边缘与参考相接；额前中央凹弧和向两侧伸展的隐藏底面保持原轮廓。下缘是刘海/鬓片后方的搭接，不是需要暴露的横向发际线。未见新孔洞、断面或被细束补丁改变的顶缘。默认父包含为 0 越界；其正式绘制内容是否可原样复用由总控另核对字节和原成功路由。

## 接界 8× 复验：修正 fringe_left 结论为 REVISE

实际查看 `evidence/connections.png`：五个直属孩子去父组合整体连续，中央发根和左右鬓片无新裂缝，左耳两处负形保留。随后为本次细束缺口专门生成并实际查看 `evidence/fine-tip-connections-8x.png`（crop 380,188,40,72；只选 fringe_left、temple_sweeps_left、scalp_cap，无父填缝）。

8× 局部显示，新增细束的外侧线和自由尖已得到承载，但宽片与细束之间的参考窄肤色带在上中段仍被原宽片色块填住。参考中约 x397–409、y205–236 可辨认的窄分离延伸至眉外侧；候选仅在约 y237 以后打开一小段三角缝。4× 总览不足以判定这条很窄的分离，因此本项先前的 PASS 在本次更高倍率实际复验后改为 REVISE，不沿用旧包络已完整的结论。

返修范围：`head/front_hair/fringe_left` / `group-head-front-hair-fringe-left` 的宽片眼侧边界及其与细束之间的窄负空间。保留新增细束实际外缘和自由尖，按参考把宽片眼侧可见边缘及分离起点校准，不将两束的肤色窄缝作为隐藏余量填实。当前 n8 父已能容纳新增细束；若修订只在其内缩减宽片可见范围，不需要扩大父。其他四个直属兄弟无本轮新增问题，保留几何和原报告。本轮不修改候选、树或游标。

**当前整体结论：REVISE。** n25 未开始正式绘制，不能用未来显影替代当前已明确的窄负空间修复。返修后复看细束独显、无父接界与涉及的范围结果即可。

## revision-02：fringe_left 窄缝复验 — PASS

新冻结候选 `refinement/groups/head/front_hair/local-repair-20261006/2.2/revision-02/candidate.svg` 与标准 guide SHA-256：`e2fe15ff4a4bc308bff092c679503651f9e0f345b4ce7d1d284e5cf3ae024083`。原 REVISE 及其冻结候选保留。

实际查看本 reviewer 从新稿重渲染的 `evidence/revision-02-fringe-left-8x.png`。路径 `head/front_hair/fringe_left`、ID `group-head-front-hair-fringe-left`：宽片眼侧边界已沿参考内收，窄背景带从约 y205 渐开，经过眉外侧一直延续至眼角，不再只剩下末端三角缝。边缘叠加显示宽片与细束的两条可见边分开，缝内能看到参考肤色，新增细束的外侧方向、宽度及原自由尖仍保留。上段渐合，未形成断开的碎束。上次明确的上中段负空间问题已修复。


实际查看 `evidence/revision-02-connections-8x.png`：组合只包含左刘海、左鬓片和头皮，不含父色块，细束根部保持承接，参考窄缝在相邻组件加入后仍连续露出。未出现由邻组填住的缝或新增断点。

独立字节复核：将新稿中唯一修改的 `head-front-hair-fringe-left-shape` 的 `d` 恢复为上一稿值，可逐字节还原整个上一稿 SVG。故父、细束完整路径、其余四个已实看兄弟、耳旁孔洞及所有其他 SVG 内容均未变化，复用本报告前段对应 PASS；证据见 `revision-02-independent-byte-check.json`。新稿默认 4×/alpha128 五孩子越界均为 0，复用其匹配报告，不追加无关倍率检查。旧三处 8× 共边阈值失败仍保留为历史事实，本次不改写。

**revision-02 最终结论：PASS。** 本次发现的窄肤缝已修复，实际复验和无父接界通过，其他组件原图检仍适用。该结论仅绑定新 SHA `e2fe15ff4a4bc308bff092c679503651f9e0f345b4ce7d1d284e5cf3ae024083`；原 REVISE 候选和报告历史保留。n25 仍须从获准父轮廓继续其独立 part 制作/审查及后续流程。
