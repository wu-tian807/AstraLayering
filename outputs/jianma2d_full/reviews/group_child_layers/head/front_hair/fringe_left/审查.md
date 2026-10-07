# head/front_hair/fringe_left 直属部件独立审查

逻辑身份 `group_child_layers:head/front_hair/fringe_left:review`，实际 reviewer `/root`，未参与本组 part 制作或独立拆分。当前 YAML、review 提示词、Astra xhigh 标记、直属树及默认范围报告已读。

冻结候选 `refinement/groups/head/front_hair/fringe_left/2.直属拆分与色块/2.2.直属轮廓色块/revision-02/candidate.svg` 与标准 guide SHA-256：`57d287ca92f5c2604317c4f9328f19cc629a7f988a96de880f6508e847ccb206`。默认 4×/alpha128 两个孩子越界均为 0；父包含与参考贴合分别判断。祖先 n8 的 PASS 不替代这次两个 part 的实际审查。

首先实际查看本 reviewer 原生重渲染的 `evidence/full.png`（完整参考、候选及 50% 混合），左刘海整体位置与参考相合。随后按树对两个孩子分别使用精确 ID 独显、参考与边缘叠加，并生成仅两个孩子的无父连接图。原生 4×图按原尺寸无重采样拼成 `evidence/component-review-board.png`，依次检查并逐项立即记录。

## head/front_hair/fringe_left/broad_lock — PASS

色块 ID `part-head-front-hair-fringe-left-broad-lock`。实际查看合板第一行、对应原生 `evidence/broad_lock.png`：宽主束从完整上根弧向左额角下垂，外侧长弧和约 (370,282) 的颊侧长尖连续闭合，没有被细束拆分削短。眼侧边界使用刚校准的内收曲线，参考中的窄肤色带位于它外侧，主束未再填住细束旁的眉外侧分离。冠饰后短收口保持根部搭接，不把内部灰暗发面当作缺口。未见独立漏片、断裂或可见外缘的新偏移；默认父包含 0 越界。

## head/front_hair/fringe_left/fine_lock — PASS

色块 ID `part-head-front-hair-fringe-left-fine-lock`。实际查看合板第二行、对应原生 `evidence/fine_lock.png`：这是独立的连续窄束，根部在额前主束后承接，经过眉外侧向眼角逐步收细，约 (393,253) 的自由尖保留。其实际外缘沿参考细发丝下行，未把主束的长尖归给此 part，也未将中段压回宽片来满足父范围。独显没有断成孤片；根部厚度作为遮挡下延续保留，细束内部线色仍属于后续绘制。默认父包含 0 越界。


## 两孩子无父连接与最终结论 — PASS

实际查看合板第三行、对应 `evidence/connections.png`：只选两个 part，不含父或相邻组。根部有连续搭接，主束及细束各自收尖，约 y205–253 的窄分离连续露出；未出现父色块代填的断口，也未重新填回已修复的肤色带。

独立解析候选确认：两个 part 的完整 `d` 分别与获准父组内相应宽片/细束子形逐字相同，证据见 `independent-path-check.json`。因此当前实际 4×单层/组合图对应 n8 已实看 8×校准后的几何，不重复运行同一曲线的额外图检。匹配默认范围结果为 `[0,0]`，候选与标准 guide 在审查结束时仍为冻结 SHA。

**整体 PASS。** 两个实际部件都已独显审查并检查无父连接。本结论只覆盖直属轮廓与分离，后续运动余量、线条、材质、阴影和最终头部遮挡仍按节点执行；最终须保持该窄肤缝可见。
