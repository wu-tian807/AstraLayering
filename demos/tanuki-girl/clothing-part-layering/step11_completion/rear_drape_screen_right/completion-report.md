# rear_drape_screen_right 补全

已通过 `submit_completion` 提交当前 [可编辑 SVG](workspace/completion.draft.svg)。新增 1 条下置闭合路径；原组路径和 1376×2048 画布经 XML 核对保持一致。

## 衣片职责

本片为画面右侧独立长后垂片，由右后腰/髋窄根部延伸至双折角底边。浅色内翻折面属于本片，颜色、边框、纹样及质感留给后续栅格绘制。

补齐腰后圆滑根部与白色前短下摆遮住的上段，沿原图可见点 `(891,840)`、`(923,1155)` 及既有内外缘延续，原形内部保留窄搭接至 y1280。根部在腰带、衣身及右后结覆盖区域之后；长身位于前短下摆和腿之后。根部与后腰结固定点共同随动，长身和片尖独立弯曲、摆动及显隐，与左长片分别控制。

右短结翼、白色短下摆、腰带及左长片保留各自归属。本片无真实孔洞或薄纱；源稿上段凹缺来自短下摆遮挡。两长片之间的腿部空间保留，不补人体，不跨身体连接左右衣片。本节点无父组，未发现源稿归属错误。

## 依据与检查

使用内置 imagegen 生成同正面姿态的显露辅助图，保留完整衣装上下文，收起短白下摆并略抬右结翼，观察右长片从窄根部渐展宽的结构。

生成图 edge 对照选区为 `[631,548,347,784]`，未使用偏移。外侧走向和折角结构相符；生成图的下段长度及内折面宽度有漂移，底边在居中等比对齐后有纵向差异。最终可见边缘和端点仍严格保留纯衣服参考及源稿，辅助图用于隐藏上段的结构判断。

已完成全幅独显、上段 2 倍独显、生成图整片 edge 对照，以及默认纯衣服参考全幅和上段 2 倍 blend。衣料连续，根部搭接圆滑，未连接相邻衣片，未改动已登记可见边缘。











## 生图记录

工具：内置 `image_gen.imagegen`；透明背景。保存的辅助图：[front-reveal.png](checks/front-reveal.png)。

完整提示词：

```text
Use case: precise-object-edit. Asset type: structural reference for completing one hidden garment panel, not a final design. Edit the supplied full outfit image, keeping the exact frontal orientation, silhouette scale, composition, anime illustration style, navy fabric, patterns, and all reliable visible contours. The target is ONLY the long navy rear drape on the VIEWER'S RIGHT, running from behind the right waist/hip down diagonally to the right, ending in the existing two angled hem edges with lavender flowers and crescent decorations. It is a separate long fabric panel, not the short angular bow wing and not the white front skirt, and NOT connected across the leg gap to the left long panel. Naturally reveal its entire upper fabric from the right back waist attachment to the already visible lower length. For this inspection image only, fold the white short front skirt to the viewer's left enough to expose the upper section of the right long panel. Slightly lift the right short angular back-bow wing outward/up so the right drape root is visible; keep that wing distinguishable and keep the golden belt, front cord bow, left drape, shoulder pieces, and complete overall garment context. The long right drape must form one continuous broad tapering/fanning textile ribbon with a modest gathered waist attachment, widening smoothly toward its original lower section. Its pale inner folded face belongs to the same fabric. Preserve the right drape's existing visible outer edge, lower width, length, flowers, and angular bottom hem as closely as possible. Keep its original diagonal trajectory; do not turn the garment, do not spread the two drapes into a whole skirt, do not join them, do not add a body or skin, do not fill the central empty leg gap with cloth. Transparent background. No annotations or labels.
```
