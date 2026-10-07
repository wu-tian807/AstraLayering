# n29 2.2 直属轮廓独立审查

结论：**PASS**。两个直属 part 的可见轮廓、连续性及无父底稿搭接通过本轮 2.2 独立审查。

- 真实 reviewer：`/root/review_n29`；逻辑身份：`group_child_layers:head/rear_hair_left/inner_back_curtain:review`。
- 模型：`gpt-6-astra`，reasoning `xhigh`；遵循选定 review 的同名 model marker。
- Maker：`/root/jianma_runner_recovery/maker_n29`。
- 冻结候选：`refinement/groups/head/rear_hair_left/inner_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块/candidate-groups.svg`。
- 候选 SHA256：`5ef71923ba49f927c35822b518b8bc650998d1c4603c5dde2def75adc15ed5bb`。
- 树中全部直属组件：`nape_back_sheet`、`inner_side_lock`，无直属 group。
- 读取 handoff、SKILL、根配置、2.2 节点/review 提示词与 model marker、当前树、拆分说明、父稿/候选及原生范围报告。
- 默认 bounds 为 4×、alpha 128，两个 part 的 outside_samples 均为 0。该项与参考贴合分开判定。
- 下列预览由审查者调用原生 svg_preview.py 生成；局部图 --crop 与 --reference-crop 完全相同，不将整张参考拉伸进局部。

## 00 整图与父形体定位

已实际打开 `evidence/00-full-blend.png`（整图 50% 混合）与 `evidence/01-parent-overview.png`（仅父容器独显、参考、混合与边缘四栏），均使用 original 细节。整图确认本组处于耳后至左侧小腿的后发范围，身体与外层发幕遮住大部分宽底面，最低内侧自由尖在小腿外侧回卷。父形体总览显示耳侧负空间、肩后外鼓、腰部回折、腿后宽面和最低尖端是连续范围；总览仅定位，不凭此判定两个孩子。

## 01 nape_back_sheet：PASS（完成独显后即时记录）

- 完整路径：`head/rear_hair_left/inner_back_curtain/nape_back_sheet`。
- SVG 容器：`part-head-rear-hair-left-inner-back-curtain-nape-back-sheet`。
- 实际查看图：`evidence/02-nape-root-ear.png`、`evidence/03-nape-shoulder-waist.png`、`evidence/04-nape-waist-knee.png`、`evidence/05-nape-lower-end.png`，均为该容器单独显示、4×、original，四栏含参考/独显/50% 混合/轮廓叠加。
- 耳根约 x343–358、y284–340：狭长负空间仍贯通其可见长度，孔内没有填成金色；邻接的窄发面连续，没有成为悬空小块。颈后肩线上缘与参考的后发落点相接。向父内 1px 的上帽在脸与固定前发之后；不是对耳槽或颈后可见宽面作缩削。
- 肩腰约 y390–710：上段外鼓随后回收，至腰部再次转向；宽底面完整连接在它的右侧，未按高度截断。参考的白色前置卷发、灰蓝暗带并未被当成孔或独立碎片。此处不少轮廓是被前置发束/皮肤遮住的延续，只验证连续和走向合理，不把它当成最终可见线。
- 髋腿后方约 y700–1010：宽面沿大腿后方保持一整块，外边平缓回收，没有中间缺洞、额外窄缝或独立岛。
- 下段约 y980–1280：左边沿膝侧缓弯，底部在约 y1200–1264 形成内凹收束，低左接端与右接端均连接同一面；该收束位于腿后，是保留的隐藏边界，参考不能显示其最终曲线。没有继续向最低侧尖或腿间中央独立尾束扩张。
- 本件在 2.2 的可见轮廓与连续隐藏底面要求下 PASS；与 side 的搭接将另行仅合显两个孩子检查。

## 02 inner_side_lock：PASS（完成独显后即时记录）

- 完整路径：`head/rear_hair_left/inner_back_curtain/inner_side_lock`。
- SVG 容器：`part-head-rear-hair-left-inner-back-curtain-inner-side-lock`。
- 实际查看图：`evidence/06-side-root.png`、`evidence/07-side-shoulder.png`、`evidence/08-side-waist.png`、`evidence/09-side-knee.png`、`evidence/10-side-tip.png`，均为仅该容器的 4× original 四栏图。五块局部有重叠，覆盖耳后根至最低自由尖，未仅看整图。
- 根部约 x371–385、y264–305：一段尖圆收根接入向下的窄带，随后平顺加宽；根没有断开或横切，耳侧开放区未被这件补满。其在耳饰/贴脸前发之后的部分属于隐藏接根，不把前发本身重新认作本件。
- 肩胸约 y410–615：长带完成向外鼓、向腰侧回收的连续 S 形，宽度没有突然变成细线或鼓包。参考的亮白前发和皮肤穿在这段前面，色块独显的外弧并不全是最终可见边；其隐藏外伸保留在父范围里。
- 腰髋约 y600–935：窄腰转向接着较宽的髋侧下垂，转向位置与参考后发走势对应；内边向身体/底幕后搭接，未被当成新的外露轮廓。完整连续长面未沿灰蓝暗纹分裂。
- 膝旁约 y915–1255：上段向内弯、膝后略回收再向外侧下垂，新增内侧搭接到 y1154 回到原边界的变化平缓；没有新台阶、孤岛或折断。
- 自由端约 y1220–1440：两边先收窄再向右回卷成一枚尖，弧度、最低位置与参考的小腿旁尾尖基本相合；尖梢约 (360,1423) 未截平、未分叉。原首轮失败位置 x358–359.25/y1251.5–1262.5 附近处于平顺尾根，现没有新增向腿侧凸出的赘边。
- 本件在 2.2 的完整可见长束与隐藏根段要求下 PASS；与宽底幕的无父底稿搭接继续单独检查。

## 03 两件无父底稿合显连接：PASS

已实际打开 `evidence/11-join-root.png`、`evidence/12-join-waist.png`、`evidence/13-join-lower.png`（均 4× original）及 `evidence/14-children-overview.png`（1× original 总览）。每张只选上述两个 part 的确切 id，未显示父容器、身体或相邻后发色块。

- 耳根到颈后：侧长束从宽幕内相叠接出，连接不是点接触；独显金蓝两色相接处没有白缝。耳侧窄孔仍是白色负空间，没有被第二件封掉。
- 腰髋：S 形带的内缘与宽面持续相叠，转折处没有断口或额外孔洞。两件合起来保留父形体的外鼓、内收走向。
- 膝后至 y1264 附近：底幕内凹下缘与长束内侧顺接，搭接缩回后没有分离出小岛、三角缺口或横切白缝；宽幕终止后，长束继续延伸到完整自由尖。
- 总览覆盖耳后、颈后宽面、肩腰 S 形、隐藏背腿面及最低单尖；未纳入旁组外回环与中央腿间独立尾束。此结论不依赖父色块填缝。

## 04 范围、输入保护与审查边界

- 使用已交付的原生 `轮廓检查.json`，与候选清单中的 SHA256 一致：`abe1a018b2c591d3d8c13e51c61f1c7f287c844074867b28885f76e78cdfa747`。设置仍为 4×、alpha 128；两件各为 0 outside_samples。没有修改阈值或重写该报告。
- 审查结束重新计算 candidate、input parent、当前 guide、tree、两张参考的 SHA256，均与本审查开始记录一致；正式 character SVG 与 rendering JSON 也匹配 maker 冻结清单。候选仍为 `5ef71923ba49f927c35822b518b8bc650998d1c4603c5dde2def75adc15ed5bb`。
- 当前审查实际查看 15 张原生预览图，全部由本 reviewer 在本目录重新生成并实际打开，无沿用 maker 的视觉结论。每张图的命令、输入 SHA 与输出 SHA 见 `evidence/render-manifest.json`；实际视图清单及 SHA 见 `evidence/actual-views.json`。没有图像容量失败或被拒图片，也未把未看的图片标成已看。
- 首轮 self-fix-01 的失败候选/3 与 60 样本报告保留原样；本 reviewer 没有修改它们。当前通过的是冻结后的新候选，不抹去首轮失败。
- 本结论只覆盖 n29 两个直属轮廓色块的 2.2。参考遮住的背腿底面与根部只能检查合理延续、父内包含和静态连接，不能从静态图保证所有动作露出；运动补齐、内部线条、材质、最终显影层序与复合成品验收属于后续节点。
- n30 `outer_back_curtain` 既有 3 样本越界是旁组交接事项，未并入本次结论，未修改或消除原失败。
- 本 reviewer 仅写入本审查目录的报告/证据/记录；未修改任何 SVG、tree、ledger、cursor、checkpoint 或工作流资源。由总控冻结本报告并推进后续节点。

最终判定：**PASS**。
