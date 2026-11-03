本次是用户已赞许的真实 run4 管线产物的局部续修，尚未获准称“流程稳定”。反馈针对画面左侧远侧脸缘，眼尾外侧到颊部，不是眼睛/虹膜：参考的某个区间更近竖线，希望边界的立体感和笔锋更贴视频。

先核对 source.json 与原 KRA/PNG，再保留当前整体脸型、近侧饱满连续轮廓、下巴与五官成果续修，不重新导出、重新导入成静止网格。这些 seed 是真实管线输出，没有外层手调参数。脖子固定，延长留 step07，只制作 X。

复用 preview_svg 的闭合色块做同坐标局部 blend/edge 检查，source 对原 face_base PNG，target 对指定 left.png。先独立判定可见区间与形体归属，再重描。上一轮 far-temple/orbit/cheek 全部为 occluded，这只是待复查的旧判断，不能因此忽略实际显露脸缘，也不能反过来把整个发缘标 visible。可回看原视频相邻帧辅助辨认，最终目标仍是指定 left.png。

原 source 描线在远侧相对 PNG alpha 外缘平均约0.4 px，局部约1–1.5 px 偏差；之前 Warp 已很贴这份描线，但这不能说明真实边缘贴视频。请放大纠正 source 的真实外缘，以及 target 的陡边、切线、转折；再从同一 SVG 路径生成 trace，inspect 后实际 fit。不能只改 visibility 名字或用手填大量网格替代描边。

保留已确认正确的其它部位；拟合若使近侧/下巴漂移，修复局部约束和层级。记录实际 visible/occluded 区间及依据，保存 source/target SVG、局部 edge/blend、实际脸底与全脸同坐标叠加，并说明仍有偏差的位置。本轮只交付待用户确认的候选。
