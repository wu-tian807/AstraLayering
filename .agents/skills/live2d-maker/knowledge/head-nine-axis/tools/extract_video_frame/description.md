从本步骤的原视频提取一帧。video 是方向名：单轴步骤使用 left、up、down；斜角步骤使用 left-up、left-down。

提供从 0 起的 frameIndex，或非负 timeSeconds，两者只选一个。output 是本选帧步骤内的 PNG 路径，使用绝对路径或相对任务根的路径。比较候选帧时可保存到 candidates/ 下，再用 view_bitmap 查看；选定后以同一位置输出 <方向>.png。

工具自动使用本次管线启动传入的 FFmpeg，保存原帧到本步骤 frames/ 下的同名文件，并将 output 等比规范化为本步骤裁框尺寸的正方形 PNG。无需查找软件路径或直接运行 ffmpeg。返回 video、path、rawFrame 和实际请求的 frameIndex 或 timeSeconds，可据此填写 selected-frames.json，并自行补充视觉选择依据 reason。
