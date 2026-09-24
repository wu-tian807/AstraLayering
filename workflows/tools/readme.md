# 本轮选项工具

负责判断的 agent 使用统一入口 `options.py`，更新工作根目录的 `options.json`；总控读取选项并调度。工具只用 Python 3.8+ 标准库，无需 Ruby、PyYAML 或其他第三方依赖。

agent 先确认实际可用的 Python 3 解释器，例如运行 `python3 --version`、`python --version` 或 Windows 的 `py -3 --version`。在提供工作区依赖的 Codex 桌面环境中，也可调用 `load_workspace_dependencies` 获取随应用提供的 Python 绝对路径，再执行它。不能仅凭命令存在就认定可用；Windows 商店占位命令可能无法运行。使用已确认解释器，勿把某台机器的运行时路径写死到流程中。

```sh
python3 /absolute/path/to/workflows/tools/options.py set --work-root /absolute/work/root simplify true
python3 /absolute/path/to/workflows/tools/options.py get --work-root /absolute/work/root simplify
```

```powershell
& 'C:\path\to\python.exe' 'D:\project\workflows\tools\options.py' set --work-root 'D:\work\case' simplify true
& 'C:\path\to\python.exe' 'D:\project\workflows\tools\options.py' get --work-root 'D:\work\case' simplify
```

`set` 在工作目录或选项文件不存在时创建它们，更新单个选项时保留其他值。`set` 和 `get` 均输出仅含所选字段的 JSON 对象，例如 `{"simplify": true}`；缺失选项或参数错误时返回非零退出码。写入使用锁与临时文件替换，避免并发更新丢失其他选项；无效文件或写入失败不覆盖原文件。

## 文件格式与职责

`options.json` 为 UTF-8 平级 JSON 对象：

```json
{
  "simplify": true
}
```

- 名称区分大小写，使用英文字母、数字及下划线，不能以数字开头；同名选项不得重复。
- 当前选项为布尔值，`set` 默认按布尔类型处理，只接受 `true`/`false`。扩展时可传 `--type integer` 或 `--type string`；枚举按字符串保存，允许值由 agent 按流程声明核对。字符串不需要手工编码为 JSON，工具会处理引号、中文等内容。
- 文件只允许布尔值、整数和字符串，不支持嵌套对象、列表、浮点数或空值。`false` 保存为真正的布尔值，不是字符串。
- **负责判断的 agent** 读取根目录 `流程.yaml`，核对选项名、声明类型及枚举范围，再按对应类型调用工具。脚本校验名称格式、值类型和配置结构，不解析流程 YAML。**总控** 读取 JSON 值，并按根流程声明核对后用于条件判断。

旧运行仅有 `options.yaml` 时，agent 先按根流程声明核对已有值，再逐项用 `set` 写入 `options.json`；已有 `options.json` 时以它为准。旧文件保留作历史记录。

写入锁为工作根目录的 `.options.json.lock`。正常结束或失败会释放锁；若进程被强制终止而留下锁，确认没有写入任务后再删除该锁文件。
