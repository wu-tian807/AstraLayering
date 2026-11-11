# outer_waist_band 补全核查

结论：新增路径为零。源稿已经完整覆盖前方横系绳、中央结芯、左右绳环及垂绳起始段下的金色衣料，独显为连续宽带。原 SVG 与当前草稿逐字节一致，保留 1376×2048 画布及原归属。

实体范围为腰中央金色宽带，约 x=491–888、y=643–806；上界邻接深色环腰层上缘，下界邻接深色环腰层下露带，左右为向腰侧收窄的转折。前带面处于腹部、交叠衣身和深色内包裹层前，前系绳、绳结、垂饰之后；侧后转折随同一腰带绕至躯干后，后结仍独立归属。整带随腰躯干变形，与深色内层及后结共享腰部锚点，但不跨实体合并。当前源形已包括遮挡下的连续带面，不增造背视展开、外伸侧片或跨身体连接。后续按左右腰侧连续转折规划同一 part 的多个深度区域。

本衣片带面没有真实孔洞或薄纱；系绳环孔属于系绳组，应透见其后的本带。领口、袖口和下摆外空隙均在本片以外。上下深色露带、后结翼和人体不属于本片。未发现源稿实体归属错误。

辅助图由内置 image_gen 生成（非 CLI），输入完整纯衣服参考，仅移除前系绳与垂饰，保持正面姿态、整套上下文。已先查看整体，再用 referenceRegion=[365,480,295,124] 对完整腰带做 edge 对照，referenceOffset 使用默认零。生成图的上、下边缘及收腰走向支持现有形体，侧缘有轻微生图宽度漂移，原图可见侧边仍为定位依据。随后以默认参考 blend 在原坐标检查，并以 SVG 独显 3 倍检查完整衣料和边界；三项检查均针对提交的当前草稿。









## 生图输入及完整提示词

参考：clothing-part-layering/references/clothing.png

保存：clothing-part-layering/step11_completion/outer_waist_band/structure-reference.png

transparent_background=true

Use case: precise-object-edit. Asset type: same-front-pose clothing structure reference for a gold outer waist band. Input image is the complete outfit edit target and reliable shape/style reference. Make a minimally edited full-outfit image showing exactly this same floating clothing, same frontal orientation, same overall proportions, layout, fabric materials, anime linework, shadows, and all neighboring clothing. ONLY REMOVE the pink-and-white horizontal front waist cord, its central bow/loops/knot, and the two hanging cords with red beads and tassels. Naturally reconstruct the GOLD WIDE OUTER WAIST BAND underneath those removed accessories as a single uninterrupted gold fabric panel. Preserve the existing band's exact upper curved edge below the dark inner wrap, rounded lower curved edge above the dark lower wrap, and the concave narrowing at the left and right waist sides. Keep the gold band the original width and height and preserve all reliably visible edges. The dark upper and lower inner waist wrap, white crossed kimono body and sleeves, dark rear bow wings, white short hem and its gold flower, and two long rear drapes must stay in the original positions. Do not extend the gold band into dark inner layers or rear bow wings. Do not add seams, holes, new flaps or decoration. Keep the entire original outfit context visible, no crop, no zoom, no side or back view, no body, no mannequin, no skin, no text. Retain genuinely transparent background and all actual clothing openings. This is a structural reveal of this exact existing gold waist panel, not a redesigned outfit.
