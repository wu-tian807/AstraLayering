从本步骤的原视频提取一帧。video 是方向名：单轴步骤使用 left、up、down；斜角步骤使用 left-up、left-down。

提供从 0 起的 frameIndex，或非负 timeSeconds，两者只选一个。output 是本选帧步骤内的 PNG 路径，使用绝对路径或相对任务根的路径。比较候选帧时可保存到 candidates/ 下，再用 view_bitmap 查看；选定后以同一位置输出 <方向>.png。

工具用管线传入的 FFmpeg 将原帧保存在本步骤 frames/ 的同名文件。output 等比规范化为裁框大小后，按可选的 offsetX、offsetY 做整数像素平移，右、下为正，默认 0，露边补灰。原帧保持原样。可传本步骤内另一个 PNG 路径 overlay，将平移后的候选与正面各按一半混合，并画出正面的固定中轴。用 view_bitmap 查看叠图，核对肩领、颈根与俯仰时的头颈支点。

返回 video、path、rawFrame、frameIndex 或 timeSeconds、size、offsetX、offsetY 和已请求的 overlay 路径。据此填写 selected-frames.json 并记录选择依据 reason。
