# head/face/eye_right 直属轮廓独立审查

逻辑身份 `group_child_layers:head/face/eye_right:review`，实际 actor `/root`，未参与本组候选绘制或拆分。候选、输入、技能、树和游标只读。

候选 SHA-256：`ca13c0de8f336f7063f199ab86764886fa33e5927caa6e63341767e092f23aaa`。已读取当前节点 YAML / review 提示词、当前树和范围报告；四个孩子默认 4× / alpha 128 均为 0 越界。补全父底面用于遮挡余量，可见参考贴合另判，不把隐藏范围当作最终眼裂。

先由原生 preview 工具生成并实际查看 `evidence/full.png` 的整图参考、候选和 50% 混合，右眼整体位置对应参考。四个直属组件与无父连接图均由同一冻结候选作原生 8× 输出，再原尺寸无重采样排版为 `evidence/component-review-board.png`，按树顺序逐行检查并记录。

整体结论：PASS。

## head/face/eye_right/upper_eyelid — PASS

色块 ID `group-head-face-eye-right-upper-eyelid`。实际查看合板第一行、对应原生 `evidence/upper-eyelid.png`：连续上睑下缘沿参考上眼裂弧线，内眼角收尖、外侧睫毛突尖与折向均保留；上方窄睑褶也在本组范围中。上侧更宽的皮肤余量属于父级补全区，不按睫毛外缘显影；外眼角穿过的白发保留给原发组，不在眼睑轮廓中挖断。未见明显可见边缘移位或漏掉尖端。父范围 PASS，越界 0。睫毛与皮肤/褶皱内部细分由该子组后续流程完成。

## head/face/eye_right/iris — PASS

色块 ID `group-head-face-eye-right-iris`。实际查看合板第二行、原生 `evidence/iris.png`：虹膜左右可见弧与参考蓝色虹膜及暗缘位置对应，宽度和重心合理；上睑后方补为连续圆弧，底部完整保留并由下睑衔接遮挡。未把瞳孔或角膜亮斑挖成透明孔，未截成当前可见的半片虹膜。父范围 PASS，越界 0。内部瞳孔、虹膜表面与独立反光由后续本组及 Rendering 节点处理。

## head/face/eye_right/sclera — PASS

色块 ID `part-head-face-eye-right-sclera`。实际查看合板第三行、原生 `evidence/sclera.png`：保留横跨虹膜后方的完整眼球底面，两侧可见眼白楔区位置正确，没有因虹膜遮挡拆开或形成缺口。上下扩出的轮廓与批准的 ocular-bed 对应，属于眼睑后的底面，不能作为最终白眼外缘直接显露。内眼角及外眼角收束仍在上/下睑衔接范围内。父范围 PASS，越界 0。

## head/face/eye_right/lower_eyelid — PASS

色块 ID `part-head-face-eye-right-lower-eyelid`。实际查看合板第四行、原生 `evidence/lower-eyelid.png`：上侧睑缘沿参考细下眼线，从内眼角至外眼角形成连续浅弧，两端逐渐收细；下侧约 2–3 px 是皮肤搭接余量，未新增第二条可见眼裂。与眼白底面同向延续，未见可见细缝、断口或把反光切成孔洞。父范围 PASS，越界 0。

## 连接与整体结论 — PASS

最后查看合板第五行、原生 `evidence/connections.png`：四孩子同时独显，未用父形体填缝。上下眼睑与眼白在眼角连续，眼白与下睑接界未见透底细缝；虹膜由上睑覆盖上端、由下睑承接下部，当前可见眼白楔区保留。整组补全轮廓比参考眼裂大是隐藏皮肤/眼球底面的正常范围，后续上睑子组与最终材质/组合须继续恢复参考眼裂，不能把绿色眼球底面全部显白。

四个直属组件均通过本节点审查。结束时冻结候选、标准 guide 与范围报告所指候选 SHA 一致，复用默认包含结果 `[0,0,0,0]`。候选、作者源、树、游标及技能未改。范围与可见贴合分别判断；本次不宣称虹膜细节、上睑内部、角膜独立高光或最终组合已经完成。
