# 本轮选项工具

负责判断的 agent 使用 `options.rb` 更新工作根目录的 `options.yaml`，总控只读取选项并调度。工具从上层的 `流程.yaml` 读取字段定义和类型；工作根目录或选项文件不存在时，`set` 会创建。编辑不同选项时保留已有值。

```sh
ruby /absolute/path/to/workflows/tools/options.rb set --work-root /absolute/work/root simplify true
ruby /absolute/path/to/workflows/tools/options.rb get --work-root /absolute/work/root simplify
```

目前支持布尔值、字符串、整数和枚举。`--work-root` 使用本轮实际的绝对工作路径；节点的提示词可以按自身位置找到这个脚本。
