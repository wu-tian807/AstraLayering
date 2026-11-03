为当前阶段定位同一画布上的可见差异候选。reference 为本步实际参考 PNG，current 为当前 KRA 导出的 PNG。尽量传绝对路径，相对路径以任务根目录为基准。工具只写诊断图和 JSON，不修改输入、KRA、图层或上游资料，不自动对齐、给修复建议或判断通过。

输出 missing（参考内容缺失）、extra（当前多出内容）、color（颜色差异）候选的原画布坐标 [x,y,width,height]、像素数、编号标记图、热图及左参考/右当前的原尺寸对照图。完整区域清单在 differences.json，max_regions 只限制返回及标记数量。

整图可直接对比；单层比较时可提供独立 visible_mask：白色为本部件在参考中实际可见的区域，黑色/透明不比较。不要把遮挡补全区按遮挡物的参考像素判错，也不要用当前 alpha 与参考交集制作可见范围，否则会漏掉当前缺口。crop 可聚焦局部，坐标仍为原画布位置。尺寸不同会报错，不能缩放或移动参考来掩盖偏差。

parts 可按部件路径选择范围，例如 ["camisole/bodice", "pleated_skirt"]；父分组包含所有后代，多个深度分片一起检查。选择 parts 时先保存 KRA，再用 krita 工具把它导出为 .ora（doc.exportImage(路径.ora, krita.InfoObject())），把路径作为 layers 传入；.ora 保留每个图层缩放、位移和遮罩后的实际像素，不使用上游 SVG 的旧坐标。工具本身不启动 Krita；layers 早于 current_kra（不填时为 current 同名的 .kra）会报错，需重新导出。同名部件可加 character: 或 clothing: 前缀。路径不存在、归属不明确或部件完全隐藏时明确报错，不退回全图。parts 不填或 [] 保持原有全图检测，不需要 layers。

部件范围按图层实际覆盖的并集生成，包含内部缺口和 part_padding 指定的周边（默认 8 像素），用于发现接缝缺口、局部错位和漏肤。多选的重叠范围只计一次；visible_mask 和 crop 仍可进一步限制。额外输出 scope.png（白色检查、黑色跳过）及 scope-preview.png（绿色检查范围，其他区域暗化），JSON 记录匹配图层与原画布边界。范围基于当前部件及其周边，大面积错位或整片缺失仍需目视核对整体。范围内覆盖的其他部件不自动判定为所选部件的错误。

保留单像素强差异，并用仅供诊断的平滑比较补充较连贯的区域差异，再合并邻近碎片；平滑不作用于原画。color_threshold 默认 80，coarse_color_threshold 默认 32，region_gap_pixels 默认 1，alpha_threshold 默认 96，min_region_pixels 默认 64。可在 schema.json 修改默认值或本次覆盖。框是差异候选范围，不等于整个部件的缺陷轮廓；数量也不是验收标准。

step02 用候选框补查逐件独显和组装对照中的遗漏，依据本步参考修正所属部件的轮廓、笔触和衔接。assemble 按衣物部件与穿戴接缝选择范围，检查配准、穿插、遮挡和贴合。候选范围和像素数量用于定位，质量结论由当前工程的视觉对照决定。
