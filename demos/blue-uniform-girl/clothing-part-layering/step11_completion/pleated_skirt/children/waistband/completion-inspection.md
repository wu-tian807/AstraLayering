本次腰头补全检查：无需新增路径。

源 SVG 与中断草稿一致，均已包含中央可见带面及两侧藏于外套前衣摆下的连续延伸。完整包围范围为 x380–808、y666–748；上缘复用父稿腰侧轮廓，中央下缘吻合纯衣服参考的腰头与裙身接缝。独显为一片连续带状衣料，未见缺口。四倍采样父范围检查通过，越界面积为零；既有路径保持只读。

本片只含裙腰带衣料。中央带面在腰腹与衬衫下端之前，两侧段在外套前衣摆之后；贴腰回转区域相对腰胯在后，仍属于同一运动单元。下缘与 skirt_body 为相邻接缝，裙身应在腰头覆盖侧下保留保守缝合搭接。本片随腰胯统一定位、变形，并与裙身根部共同随动。贴合腰部不另画敞口、身体或封口面，也不归入衬衫、外套或裙身衣料。

使用内置 image_gen，以完整纯衣装参考生成同正面姿态结构图。第一张仅拨开衣摆，两端仍有遮挡，未用于确定完整边界；第二张抬起两片前衣摆，露出腰头整体，保留所属裙装和邻接上装上下文，作为采用的辅助参考。



第二张生成图的腰头选区为 [398,618,389,98]。preview_svg 的 edge 检查采用默认居中等比对齐，无 referenceOffset。中央上下弧线与源稿基本吻合；源稿左右侧尖楔段比生成图更宽，生成图改变了整套衣装的比例，不能宣称全部侧端精确重合。原图中这些侧段处于外套遮挡区，组说明又明确以父完成稿上部腰侧轮廓为限，因此本次保留源稿，未依据生成差异扩带、移动边界或侵入裙身。没有可由纯衣服图确认的源稿归属错误。



随后省略 reference 参数，用原纯衣服图 blend 检查实际位置与邻接；中央带面与原图接缝相合，两侧隐藏延伸保持外套之后的职责。最后完成整图独显和局部三倍独显，确认中央至两侧衣料连续，未新增相邻衣层连接。





采用辅助图的最终生图提示词（内置工具；编辑目标为本次完整 clothing.png，transparent_background=true）：

> Edit this full outfit reference into a SAME FRONT POSE clothing construction illustration. The target is the dark navy PLEATED SKIRT WAISTBAND, currently only visible in the small gap between jacket tails. Reveal the ENTIRE waistband including both left and right OUTER SIDE EDGES. To achieve this, visibly LIFT BOTH white jacket lower front panels UPWARD and fold them out of the way above the waistband, with their lowest hems well above the entire waistband top edge. Neither jacket panel may overlap any part of the skirt waistband. Keep jacket shoulders, collar, sleeves and chest present for outfit context. Leave the tucked dark shirt above/behind the skirt waist, do not add shirt tails. Show the navy continuous fitted waistband with its curved top edge, curved lower seam joining pleated skirt, and exposed left and right shaped ends. No extra belt, buckle, loops, ribbons, or ornaments. Keep the skirt and triangle emblem, cyan hem, complete full outfit scale, composition, viewpoint, front pose and art style consistent with the input. Preserve the original visible center band's height and proportions. Adjust only the jacket obstruction necessary to reveal waistband; do not crop to an isolated band. No mannequin, human skin, body, annotations, diagrams or text. Transparent background.
