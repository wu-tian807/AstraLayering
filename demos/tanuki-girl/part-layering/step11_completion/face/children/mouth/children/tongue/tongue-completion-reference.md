# 舌头结构辅助与补全记录

本组 face/mouth/tongue 标记 hiddenInReference=true；原 SVG 为空底稿。正面闭嘴使整个舌头被上下嘴与牙列遮挡。本轮新增一条闭合贝塞尔填色路径，舌根、舌身与舌尖保持同一连续部件。

原图裁片 [510,250,420,330]，放大 2 倍，以完整脸部及相邻头发、耳朵和耳机作为所属整体。图像坐标换算：原图 x=510+裁片 x/2，y=250+裁片 y/2。辅助图由内置 image_gen 工具生成，为同姿态正面自然张嘴图，不是侧面图。



辅助图给出上缘轻微中央凹陷、两侧顺滑转向、宽圆舌尖和圆弧下缘。新增色块在原画布口部中心 x=708.4 附近，完整下缘延续到 y=518.65，保留被下嘴遮挡的圆弧区域。舌身外接尺寸约 20×17 像素，置于父嘴组约 26×26 像素的完整范围内。未将上牙、下牙、口腔底色或上下嘴并入本组。

舌根与舌尖登记为一个 part，没有需要分别移动的接缝。牙列、上下嘴与舌头为前后遮挡关系，不能把它们视作舌头的伸入/覆盖连接；本次不额外构造跨组胶水区，也不填满周围口腔空间。

自查已完成：生成图 edge，referenceRegion=[630,831,81,67]，不加 referenceOffset，等比对照整体舌头轮廓；默认原图 blend 完整脸部及 8 倍口部局部，确认位置与尺度；svg 独显 8 倍，确认单一连续色块、圆滑转向及完整下缘。父范围固定 4 倍采样校验通过，outsidePixels=0。源 SVG 原样保留，父 SVG 只读。

## 生图完整提示词

```text
Use case: identity-preserve. Asset type: structural reference for a hidden tongue in a layered anime character. Edit the provided full-face crop of this same pink-haired tanuki girl. Preserve her frontal head pose, face shape, eye shape and positions, nose, chin, hairstyle, ears, bell, headphones, proportions, framing, and illustration style. Only change her currently tiny closed mouth into a naturally fully opened small rounded mouth at the same mouth center, showing the normal oral interior, an unobtrusive upper tooth band and a pink tongue resting inside the lower oral cavity. Keep the mouth small: opening width about one eighth of the visible face width, height about equal to width (around 52 pixels in the 840px input crop). The tongue should be clearly readable as one continuous soft body from a narrower rear/root portion inside the cavity to the broader smoothly rounded front/tip, with a slightly domed upper contour and a rounded lower contour, normal natural scale. Show the tongue itself clearly enough to read its whole outline and connection into the rear mouth; leave dark cavity around it. The tongue is inside the mouth, not sticking out, not curled out, not licking. Keep the reference as a normal complete face, not an isolated mouth, not an anatomical diagram. No added accessories, no labels, no new details elsewhere. Preserve transparency around the character.
```
