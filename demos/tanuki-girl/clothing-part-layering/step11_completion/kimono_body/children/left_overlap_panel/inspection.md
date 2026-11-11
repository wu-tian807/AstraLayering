本片补全检查完成：新增闭合路径为 0。源稿已是一幅连续完整的角色左侧外襟；本次保留所有源路径。

实体范围为画面右上低位斜领缘和连属胸片，经 y612–861 的隐藏腰段，连到前中央及画面右侧的大幅短下摆。现有轮廓包含系绳和两支垂饰遮住的衣面，偏左襟边止于约 (526,1212)，弧形底边止于约 (1009,1115)。固定领缘、襟边、褶皱及金色花纹归本体，SVG 仅表达纯色衣料范围。

前幅位于胸腹、左髋、前侧大腿之前，并位于角色右侧内襟之前；深色环腰层、金色腰带、前系绳和垂饰位于本片之前，后结翼及长后垂片位于本片之后。画面右侧弧形袖根与角色左袖相接，袖料、袖口及腰带旁小折角仍属袖子。左腰侧沿衣身侧缘及腰带遮住的侧腰连接区域转向躯干后，作为同动 part 的侧后返回区域，后续应落实多个深度区域，不把整片统一安排在人体前，也不另外绘制背视衣片。胸腰随左侧躯干、共同腰髋固定区变形；下摆可相对右内襟独立摆动，固定领缘、襟边和花纹随本体。

不新增的依据：独显首先确认了外襟的主要形体、宽度和归属；胸片到下摆不是窄桥连接，而是完整渐变收腰衣料。腰带遮挡区的现有左边由 (609,612) 经 (535,757) 过渡至 (500,850)，右边由 (895,621) 收至约 (849,750)，再展开至 (880,837)。它已经覆盖本片在此姿态下所需的隐藏腰段。系绳、垂饰下方本来就是无孔衣面。与内襟的有限交叠保持现稿范围，约 (510,1107) 附近两片真实终边留下的开叉仍开放，未填入内襟或人体。低位敞领未填料，袖根维持衣身拼接锚点，未扩张到袖口、袖料或其他相邻层。本片没有需要另造薄纱的结构。没有发现源稿实体归属错误。

辅助图使用内置 image_gen，输入完整纯衣服参考，保持同一正面姿态与整套上下文，仅去掉遮住腰段和下摆的前腰带、系绳、垂饰。生成图支持连续收腰外襟及两幅分开的终边；整体 edge 对照中弧形底边及斜领走向相符，但生成图把胸腰比例和襟边转折略作改动，因此不可据此改写可靠的原图端点、放宽袖根或扩张腰侧。

生成图对应外襟的选区为 [357,124,464,801]，edge 对照等比倍率 1.0049937578，referenceOffset 为默认 [0,0]。随后省略全部 reference 参数完成原纯衣服图 blend 定位、完整衣片独显、腰段独显放大及左下开叉 blend 放大。当前草稿父范围检查为 pass，四倍采样越界为 0；画布仍为 1376×2048。提交空新增列表，保留源稿既有隐藏结构，不把相邻内襟接成同一跨身体衣片。

辅助图及自查图：













生成提示词（内置工具模式，原文）：

```text
Use case: precise-object-edit. Create a structural visibility reference from the supplied COMPLETE outfit, preserving the same front view, pose, framing, relative dimensions, original anime illustration style, white fabric, dark navy edging with pink lines, and all reliable visible silhouettes. Clothing only, no body or mannequin. Target is the wearer's LEFT OUTER OVERLAP panel: the chest lapel running from IMAGE UPPER RIGHT diagonally down toward IMAGE LEFT, continuous through the waist to the broad white short skirt panel occupying center and IMAGE RIGHT, with dark navy/pink long edging along its image-left side and the gold flower near the lower right. This is one continuous outer fabric panel. Only remove the FRONT dark wrap waistband, gold obi, pink front bow, cord and hanging tassels that conceal its waist and skirt surface. Reveal naturally the previously compressed white cloth waist beneath them, keeping the original cinched waist contour and original positions of chest and skirt; continue the descending outer lapel edging smoothly into the existing left skirt edging. Keep the inner overlap panel distinct behind it on image left; retain the open notch between their separate hems. Preserve open low neckline, sleeves and their true openings, rear bow wings and long rear hanging panels as surrounding outfit context. Do not invent a new wide rectangular torso, bridge the neckline, fuse inner and outer lap panels, elongate the skirt, change the gold motif, rotate the garment, add skin or create an isolated detached panel. Single complete outfit image with transparent background, no text, no inset.
```
