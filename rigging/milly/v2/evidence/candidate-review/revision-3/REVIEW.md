# v2 返修复验 3

结论：**通过本轮 R1 定向复验**。未发现新的交付阻碍。

冻结于2026-09-20 13:51:34；候选 `/Users/wutian/Desktop/coding/AstraLayering/rigging/milly/v2/index.html`。

- index.html SHA-256：`613e7201c087f6761336c2651f3fcdb55978ebf58b1443ca0cf01309f1f5cbe4`
- rig.js SHA-256：`e21cd472b08aa87fbd746a25d516726c6e5707805fb234aaf8484d7fa1052ade`
- build.py SHA-256：`8a1369403f8150f49e10a7a458b828671967d8770685bc3b42b1c0312ee97c4a`
- milly-animation.svg SHA-256：`36a08ef98d1550041ab04ddc86e170f3a358b47fa02cd6c7523591f03b7c0a6f`

检查固定快照，未修改实现。全套元数据见 `versions.json`。

R1旧复现 arm7→7.1不再造成遮挡闪跳；arm14、16及10–25中间收背不再产生横向切口。肩部与衣服接缝连续，皮肤和衣服边界沿实际轮廓相交。证据 `tuck-contact.jpg` 与 `tuck-14.png`、`tuck-16.png`。

连续平滑收背实际播放并逐帧捕获当前已渲染 SVG，见 `continuous-tuck-contact.jpg`、`checks.json`，没有移动裁切边、整段肢体突然消失或重影。此项不是逐帧 seek。

中性换层额外检查：elbow0→0.01、arm取-30/-7/0、bodyX取-10/0/10，共九组全身图。目视无遮挡跳变；差分仅68–79个边沿像素（单张733078像素，色差阈值16），用于支持目视结论，不能代替目视。见 `elbow-switch-contact.jpg` 和原图。两侧上臂固定在肩缝后，前臂进入后层时仍在身体外侧，后续内收不会在可见皮肤中央划出裁切边。

外展、弯臂、一侧收背/另一侧外展及bodyX10邻接检查无黑手、填充丢失或断臂；无pageerror。

本轮只复验R1及相邻关系，R2肩角和R3按钮在revision-2中已确认修复，对应修复逻辑本轮未变；此前已通过的脸部/开口、正向低头、鼠标迟滞、连续发束物理与手机布局不重复。
