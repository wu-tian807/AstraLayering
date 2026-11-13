# 右腕手环后段补全依据

本件 arms/arm_right/bracelet_back，仅保留原有后缘并新增一条闭合后壁路径。正面画布仍为 1115×1410。

辅助图使用内置 image_gen，属于转面结构参考。输入是原图裁片 [245,700,210,295]，放大 3 倍，包含前臂、手腕、完整手和邻接腕环；裁片坐标原点为 [245,700]。首张试图仍主要展示前段，未作为后壁补形依据；本报告所附第二张露出素面后壁，作为最终依据。



最终提示词：

```text
Generate a structural reference of the SAME anime forearm, wrist cuff, and entire hand in the input image, but change the VIEWPOINT to a strong SIDE / three-quarter view from the plain rear side of the cuff. The critical change: the currently hidden plain navy BACK HALF of the broad cuff MUST be clearly exposed as a wide curved surface, taking most of the visible cuff area. Rotate the forearm and hand together around the arm's long axis approximately 100 degrees so the decorated front panel recedes around the far side. Only a tiny sliver of the existing cyan decorated front may remain around one edge. Show how the smooth plain rear wall joins both upper and lower rims and wraps around the wrist; do NOT merely redraw the original front with its two cyan pieces still visible. This is a continuous single broad closed cuff encircling the wrist, not two narrow rings. Keep original width along the wrist and original close fit. Keep arm diagonal from top-right to bottom-left, whole hand naturally attached with relaxed fingers seen side-on, same skin tone, chibi proportions, navy material, anime linework, white background. No new ornament or clasp on back, no invented holes or dangling parts, no text. A natural assembled side-view of hand and wrist, not a detached cuff, not an exploded diagram.
```

补全职责：原稿仅在 (310,805) 至 (332,806) 及 (299.2,822.2) 附近露出入环后缘。以此为上沿回绕锚点，补前臂腕端、手腕根及前段之后的连续宽后壁。上下沿属于同一带面的两条边界，并非两件独立细环。图中极少量远侧青蓝装饰属于前段，不据此新增后侧装饰。

本件后段承担伸入侧：左接合约 (300,838)、右接合约 (368,856)，两端以圆弧继续进入前段覆盖区，原后缘与新增壁面保有搭接。前段及皮肤均由其他组覆盖，未新增其实体。后半壁本身没有封闭腕孔，其完整带面在正面投影中可与腕部重叠；未向腕环上、下方延伸，未填职责外空隙。

自查：修改后使用生成图后壁范围 [255,463,460,434] 的 edge 对照，仅读取后壁宽度、连续带面和包裹关系，未强求转面图边缘重合；用默认原图 blend 全图及局部 6 倍检查位置、两侧接口和余量，再用 svg 独显 6 倍确认后缘与壁面无裂口。父范围四倍采样检查通过，越界 0；所有原路径与画布保留。
