按 `part_id` 准备同一部件的灰底颜色参考和三色控制图。灰底图只保留本件的可见笔触。控制图红色是可见部分，黄色是待补全部分，绿色是生成时应透明的区域。

用 `output_dir` 指定绝对目录。两张图保存为 `reference.png` 和 `control.png`。

调用生图时选择透明背景，先传 `referencePath`，再传 `controlPath`。两张图使用同一个裁框。`crop` 是裁框在整图上的 `[x, y, width, height]`，可用于配准。
