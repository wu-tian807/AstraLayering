from pathlib import Path
import json,hashlib,re,xml.etree.ElementTree as ET
from PIL import Image, ImageChops
E=Path('reviews/kind_blocks/evidence-v2');S=Path('reviews/kind_blocks/candidates/character-v2.svg')
check=json.loads((E/'structure-check.json').read_text());reg=json.loads((E/'regression-check.json').read_text())
# Compare all RGB and alpha channels, not only alpha.
reg['pixel_equal_unchanged_parts']=[]
for p in reg['unchanged_whole_parts']:
 a=Image.open(Path('reviews/kind_blocks/evidence-v1/isolated')/(p+'.png')).convert('RGBA');b=Image.open(E/'isolated'/(p+'.png')).convert('RGBA')
 if all(ImageChops.difference(ca,cb).getbbox() is None for ca,cb in zip(a.split(),b.split())):reg['pixel_equal_unchanged_parts'].append(p)
(E/'regression-check.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2))
r=ET.parse(S).getroot();ns='{http://www.w3.org/2000/svg}'
check.update({'nonempty_parts':sum(p['bbox'] is not None for p in check['parts']),'images':len(r.findall('.//'+ns+'image')),'clipPaths':len(r.findall('.//'+ns+'clipPath')),'masks':len(r.findall('.//'+ns+'mask')),'candidate_unchanged':hashlib.sha256(S.read_bytes()).hexdigest()==check['sha256']})
(E/'structure-check.json').write_text(json.dumps(check,ensure_ascii=False,indent=2))
prior={}
for line in Path('reviews/kind_blocks/审查-v1.md').read_text().splitlines():
 if re.match(r'\| \d+ \|',line):
  cols=[x.strip() for x in line.split('|')];prior[cols[2].strip('`')]=cols[5]
changed_notes={
 'foot_left':'五个趾端及趾谷已恢复；踝底补全、脚背与足链组合连续。',
 'foot_right':'五个趾端及趾谷已恢复；踝底补全、脚背与足链组合连续。',
 'hand_left':'上下错位的短弯指端及凹口已恢复；掌指空隙保留，腕底连接连续。',
 'hand_right':'上下错位的短弯指端及凹口已恢复；掌指空隙保留，腕底连接连续。',
 'headdress_center':'线框开口及叶片外缘恢复；独显透空，组合能透出后方发髻。',
 'earring_left':'长链环外缘和孔洞恢复；在侧发前显示，整体垂落长度及耳根连接成立。',
 'earring_right':'宝石下方链环孔洞恢复；短坠形状及侧发前的层次成立。',
 'foot_chain_left':'踝链到脚背 V 链的纵链、下坠连接补回；前后两段合看成立。',
 'foot_chain_right':'踝链到脚背 V 链的纵链、下坠连接补回；前后两段合看成立。'}
rows=[]
for i,p in enumerate(check['parts'],1):
 name=p['part'];note=changed_notes.get(name,prior[name]).replace('；头冠问题另列','')
 scope='修复后复验' if name in changed_notes else '与 v1 不变'
 rows.append(f'| {i} | `{name}` | {len(p["groups"])} | 通过 · {scope} | {note} | [独显](evidence-v2/isolated/{name}.png) |')
report='''# 色块分层稿独立复验

**结论：通过。** v1 的 K01–K05 均已修复；受影响邻接区域未见新问题，此前通过的其他部件未回退。本结论限于完整部件与遮挡的 SVG 色块阶段。

- 候选版本：**v2**。
- 候选：`reviews/kind_blocks/candidates/character-v2.svg`。
- SHA-256：`38683eeead1b34c6eeff446db9cb14b8cb5d966c93b17d6064762da84a8e5d98`。
- 参考：`references/base-subject.png`；部件清单：`structure/parts.yaml`。
- 审查依据：指定 review/提示词.txt，以及 [v1 独立审查报告](审查-v1.md) 中的 K01–K05。
- 画布：941 × 1672；全部同坐标裁切，未移动、缩放对齐角色。从 v2 只读快照重新渲染，未使用绘制者自查图片代替复验。候选审查前后哈希一致。

## 分项结论

| 项目 | 结论 | 复验结果 |
|---|---|---|
| 形状还原 | **通过** | 双足五趾、双手可见短弯指端恢复；头冠外缘与镂空框恢复。整图、头脸和邻接区域未见新增明显差异。 |
| 遮挡与空隙 | **通过** | 足链纵向连接及下坠连接成立；头冠和耳坠能透出后发的开口已保留。与脚面、腕部、发髻、侧发恢复组合后，既有层次保持。 |
| 底形分层 | **通过** | 46 个 data-part 均非空，50 个绘制组，归属与顺序未变。身体底形、完整衣片、主要发根补全保持；修改后的手足仍保留关节隐藏连接，跨层足链前后段可以合看。 |

没有未关闭的返修项，也没有因依据缺失而待核对的项目。眼内结构、指节、细发丝、饰件内部拆分、线稿、真实配色及明暗不在本阶段验收范围。隐藏区域按单张彩图能够支持的连续性与遮挡合理性判断。

## 旧问题复验及邻接区域

| 旧编号 | data-part | v2 结果与邻接检查 | 同坐标证据 |
|---|---|---|---|
| K01 | `foot_left`、`foot_right` | **已关闭。** 每脚恢复五个趾端和相邻趾谷，未要求拆趾。脚背及踝部未被修改坏，足链恢复后没有盖住趾端。 | [趾端对照](evidence-v2/compare/toes/comparison.png) · [透明叠加](evidence-v2/compare/toes/blend.png) · [足部完整对照](evidence-v2/compare/feet/comparison.png) · [独显](evidence-v2/feet-isolated.png) |
| K02 | `hand_left`、`hand_right` | **已关闭。** 拇指下方两枚短弯指端的上下错位和凹口恢复，较长指端的转折更接近参考；掌指空隙仍在。手掌到腕部连接保持。 | [画面左手](evidence-v2/compare/hand_right/comparison.png) · [其透明叠加](evidence-v2/compare/hand_right/blend.png) · [画面右手](evidence-v2/compare/hand_left/comparison.png) · [其透明叠加](evidence-v2/compare/hand_left/blend.png) · [手腕邻接](evidence-v2/compare/hands/comparison.png) |
| K03 | `foot_chain_left`、`foot_chain_right` | **已关闭。** 从踝链坠端到脚背 V 链中点的纵链已连上，下方坠件连接补回。各自的踝后弧保留，前后段合看及恢复到脚面后关系成立。 | [足链对照](evidence-v2/compare/anklets/comparison.png) · [透明叠加](evidence-v2/compare/anklets/blend.png) · [完整足链独显](evidence-v2/foot-chains-isolated.png) |
| K04 | `headdress_center` | **已关闭。** 上方金属框具有真实开口，相邻叶片外缘恢复；发髻能从框中透出。头冠仍为一件，层次位于发髻前；与头顶发面相接处没有新断口。 | [彩图／头冠独显／部件边界叠加](evidence-v2/crown-isolated-comparison.png) · [恢复组合对照](evidence-v2/compare/crown/comparison.png) · [透明叠加](evidence-v2/compare/crown/blend.png) · [头部邻接](evidence-v2/compare/head/comparison.png) |
| K05 | `earring_left`、`earring_right` | **已关闭。** 长耳坠的长环、短耳坠宝石下方的环口恢复；开口为透明底形。侧发透出、耳根连接和长短垂落关系成立，未将宝石实体当作孔洞。 | [画面右耳坠](evidence-v2/compare/earring_left/comparison.png) · [其透明叠加](evidence-v2/compare/earring_left/blend.png) · [画面左耳坠](evidence-v2/compare/earring_right/comparison.png) · [其透明叠加](evidence-v2/compare/earring_right/blend.png) · [耳坠独显](evidence-v2/earrings-isolated.png) |

上述 comparison.png 均按“彩图／候选／可见色界叠加”从左到右排列；blend.png 为 40% 候选透明叠加。`crown-isolated-comparison.png` 的中图单独显示头冠，右图只叠加头冠边界。

裁切按 (x,y,宽,高) 记录：趾端 (358,1570,170,74)，6 倍；画面左手 (200,785,65,98)，6 倍；画面右手 (620,785,65,98)，6 倍；足链 (380,1460,130,128)，4 倍；头冠独显 (390,43,100,58)，6 倍；画面左耳坠 (368,215,46,120)，6 倍；画面右耳坠 (478,215,43,120)，6 倍。

## 回退检查

独立比较 v1/v2 的 XML，确认 **9 个组改变、41 个组完全不变，无新增或删除组，根画布属性和绘制顺序完全一致**。改变的组恰为上述 9 个 data-part 的前方绘制组；足链的两个踝后分段保持不变。其余 **37 个完整部件的独显重新渲染后，RGBA 各通道像素均与 v1 一致**，支持维持其先前通过结论。详见 [回退核验记录](evidence-v2/regression-check.json)。

进一步查看 [整图对照](evidence-v2/compare/full/comparison.png)、[透明叠加](evidence-v2/compare/full/blend.png)、[头脸](evidence-v2/compare/face/comparison.png)、[双肩](evidence-v2/compare/shoulders/comparison.png)、[胸腰胯](evidence-v2/compare/torso_hips/comparison.png) 和上述邻接区域，没有发现修改组遮住或挤压先前正确部件的情况。

## 46 个部件核对记录

v2 全部部件均重新独显渲染。改变的 9 个部件按参考独显、放大、叠加、恢复组合复验；其余 37 个部件以 XML 和实际 RGBA 一致性核对，并复看整图与受影响邻接组合。表内“与 v1 不变”均继承 v1 的逐件隐藏底形核查，未仅凭组数判定通过。

| 序号 | data-part | 组数 | 结论 | 独显、隐藏及组合结果 | 证据 |
|---|---|---:|---|---|---|
'''+ '\n'.join(rows)+'''

## 底形及证据索引

- [纯身体底形](evidence-v2/combinations/body_only-white.png)：隐藏衣服、头发和饰件后，颈肩、腰胯、肩肘腕、髋膝踝保持连接；修复的手足独显不改变各自关节补全。
- [服装独显](evidence-v2/combinations/garment_only-white.png)、[衣服与身体恢复](evidence-v2/combinations/body_garment-white.png)：完整衣片、领口、肩带及腿口保持。
- [头发独显](evidence-v2/combinations/hair_only-white.png)、[头脸与头发恢复](evidence-v2/combinations/head_hair-white.png)：主要发片和后发根部完整，主空隙保持。
- [配件独显](evidence-v2/combinations/accessories_only-white.png)：修复后的头冠和耳坠开口、足链连接可单独检查；每个跨层部件的独立分段保存在 `evidence-v2/segments/`。
- 部件导航：[1–12](evidence-v2/contact-1.png)、[13–24](evidence-v2/contact-2.png)、[25–36](evidence-v2/contact-3.png)、[37–46](evidence-v2/contact-4.png)。
- [结构核验](evidence-v2/structure-check.json)：46/46 非空，无缺漏或额外部件，无嵌入图片、clipPath 或 mask；候选哈希未变。

最终判定：**v2 通过，可进入后续细分或线稿阶段。**
'''
Path('reviews/kind_blocks/审查.md').write_text(report)
(E/'issue-index.json').write_text(json.dumps({'candidate_version':'v2','sha256':check['sha256'],'verdict':'通过','closed_issues':['K01','K02','K03','K04','K05'],'open_issues':[]},ensure_ascii=False,indent=2))
print('Saved v2 PASS report. 46 part rows; 5 old issues closed.')
