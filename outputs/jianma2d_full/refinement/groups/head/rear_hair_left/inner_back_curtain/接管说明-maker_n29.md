# maker_n29 成功检查点接管

本 actor `/root/jianma_runner_recovery/maker_n29` 已停在 **4.1 `part_base_colors`**，原生 active 为 `{"target":"n29","route":"generic","pointer":"part_base_colors"}`。累计实际加载 **39 张图**；没有未验收候选，不继续4.2，不调用 complete/next。父控安排新 actor 从4.2继续。

工作根为 `source/outputs/jianma2d_full`，资源根 `../../workflow-next/live2d-layering` 只读。全部脚本从工作根用 `.runtime/svg-preview/python/bin/python` 执行。下述路径除明确资源路径外均相对本组目录 `refinement/groups/head/rear_hair_left/inner_back_curtain/`。

## 已完成与当前外观

- 1、2.2、2.3、3.1至3.5、4.1已有原生成功checkpoint；2.1由独立splitter，2.2由独立reviewer正式PASS后父控保存。
- 两part：`nape_back_sheet` 是耳后/颈背至下返的完整承接面，含4px运动补面；`inner_side_lock` 是耳后根至 `(360,1423)` 的完整S形单卷尾。
- 3.1至3.4保存轮廓、内部发流、明暗范围和疏细丝。所有源曲线保留在隐藏geometry，带唯一ID、用途及起止/软硬/显影说明。
- 3.5将19条可显影源曲线重绘为20笔（耳槽含两条独立子路），使用安装的 `perfect-freehand==1.2.0`。每点显式压力，`simulate_pressure=False`、`streamline=0`，密集M/L/C采样；闭合填色笔触、首尾透明渐变和小半径软化分离。
- 4.1仅铺完整基色：后幕 `#C7CBDF`，侧长束 `#E5E5EF`。参考实际偏冷灰紫，后幕较暗、侧束银白芯较亮。未把外来投影烘入基色。参考中深转面、亮带与最终融合尚未做，不能把基色检查当成最终渲染PASS。
- 4.1已实际看两张原尺寸独显sheet及一张组合sheet（3张原生4×板逐像素拼接，无缩图）。观察立即记在节点 `实际观察.md`。组合未见新增填色裂口或错材质；中下段仍平，必须继续4.2以后。

## 输入输出与保护

完整文件SHA和状态见 `work/handoff-state.json`；新增实际视图路径、序号、尺寸、SHA见 `work/actual-views-geometry-base.json`。

| 对象 | 当前SHA256 |
|---|---|
| `refinement/character.svg` | `d56fe37072cc5ace322749dcdfa97b73ea340762d89126fe3e6c3b89085707be` |
| guide `block-layers/groups.svg` | `758c973ead98160c59a09bf83b236a4ecd970ff53189fb7388f6ea1efcb6009a` |
| tree `structure/groups.json` | `ad31de8f389efab4028d7153ca37045b7a3c1c079523b3f8b7e723156ac2ce04` |
| rendering，仍33层 | `d897cf000f79799c4a02f3835456af1b9f40e900c308fef50979fb26c3e6b65d` |
| `work/art-state.json` | `e38a749d666b47d8ae2050df6030f5bec41a0a328289813f9e2474e99910453b` |
| `work/artwork-before.svg` | `8d6cd65eae22919af940111560c8de0041bf76a0689499014c01f252e94568e6` |

当前character减去 `<!-- n29-inner-back-curtain-artwork-start -->` 至 `<!-- n29-inner-back-curtain-artwork-end -->` 的片段，逐字节等于 `work/artwork-before.svg`。guide/tree/rendering均与3.1前保护哈希相同。参考未改，其他组和既有33层独立效果未改。

`refinement/preview.png` 是3.5要求从同SVG渲染的白底图，SHA `78bdc1399e080a93b5b9ec31e1b215d296d4ff3d1c5c47e8fdd4e19da2942b5e`；**它不含后续4.1基色**。4.1权威是character及该节点candidate/实际查看的sheet，本节点无preview输出要求。没有为了交接另渲染/加载截图。

## helper与续接方法

- `work/n29_art.py`：scoped组合、单节点候选/独显原生渲染、人工观察门控验收。`prepare(node,s,note,line=False,regions=None)` 不自动验收，`accept(node,view_count,previous_pointer)` 要求节点实际观察文件、候选哈希和当前输入哈希匹配，并调用native checkpoint。
- **新actor先更新模块的 `ACTOR`** 为自己的真实身份（例如 `import n29_art as art; art.ACTOR = '实际新actor路径'`），不要让记录误署名n29。native target仍由父控决定；当前helper断言target为n29。若父控更换target，应按实际调度修改断言，不能自行选组。
- `work/art-state.json` 是4.1完整当前state：每part含 `d/base/geometry/layers/defs/geometry_hidden/brush`；`layers` 目前为空，后续自身色面放这里，`defs` 已含笔触渐变及软化filter，勿覆盖丢失。`raw` 目前为空，给将来独立外来光影使用。helper不会自动处理rendering关系，新增关系要走原生工具。
- `work/artwork-before.svg` 是不可重写的原始完整稿。`work/protected-inputs.json` 是3.1前guide/tree/rendering/artwork基线。
- `work/draw_contours.py`、`draw_structure.py`、`draw_tones.py`、`draw_details.py`、`draw_brush.py`、`draw_base.py` 是已经执行的逐节点作者脚本，**不要从头重跑**（有些按当前state追加）。续接应 `load()` 当前state，读当前节点配置后单独实现。
- `work/brush_paths.py` 是纯M/L/C密集采样和显式压力工具；不依赖svgpathtools。环境探测报过svgpathtools不存在，已以当前源语法的本组采样器解决，未安装新依赖。原始压力节点在 `work/draw_brush.py`，所有采样坐标/压力/选项在 `3.geometry/3.5.画笔重绘/brush-samples.json`，SHA `1b105b726862c74865d1e84371eaa2fb63f422264df488df4b066a3d292bb9a0`。

下一节点示意（新actor仍需先完整读其YAML/提示词/model并亲自绘制检查）：

```python
import sys
sys.path.insert(0, 'refinement/groups/head/rear_hair_left/inner_back_curtain/work')
import n29_art as art
art.ACTOR = '新actor真实路径'
s = art.load()
# 在当前两件的layers/defs中落实4.2自身大明暗；保留刷线和原geometry。
art.prepare('part_volume', s, '本次制作说明')
# 实际打开本节点独显与提示词要求的组合，立刻写实际观察；失败先修正。
# art.accept('part_volume', 新actor真实累计加载数, 'part_base_colors')
```

## 尚未完成

从4.2开始逐节点读配置并执行：`part_volume`、`part_color_transitions`、`part_local_shading`、`cast_shadow_relations`、`cast_shadow_artwork`、`part_highlights`、`part_rendered`。本actor未读取或执行这些节点，未生成候选。最终仍由父控处理组完成/next和stage5。

- 宽幕：颈后深灰紫、左侧疏银白发脊与凹肩/背部缓转面；4px运动露出带与同面色、纹理连续。
- 侧束：保持宽银白芯，窄冷缘随S弯变化；自由尾内勾和末尖不要变成粗黑边或第二尖。
- 3.3标记的耳后根“头部/颞侧覆发遮光”只是候选，**未确认具体caster**。4.5必须按参考和树核对，不能把猜测记录成确定外投影。
- 新外来投影/反光必须独立raw，使用原生 `tools/rendering.py merge` 与 `check`；保留33旧效果。raw不按receiver预裁，最终receiver遮罩/遮挡顺序属于stage5。自身材料色面仅可裁于自身面/耳孔。
- `outer_back_curtain` 在节点1聚合包含扫描的3个越界采样仍由父控交n30，当前组未修改/解决它。不可声称聚合包含已通过。
- 2.3空children已native check-children；父控native expand曾因空补丁exit2，按YAML空列表透传原树后成功checkpoint。错误保留 `2.直属拆分与色块/2.3.运动露出补齐/native-expand-empty-rejection.json`，不能写成expand成功。今后空补丁按父控已批准方式处理，非空补丁交父控扩树。

本actor在39图成功检查点停止，不再加载图片或推进节点。
