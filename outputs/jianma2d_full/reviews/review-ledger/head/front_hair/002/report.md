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
