校验并保存本次运行的初始分组到 groups.json。只提交一层组；已有组时拒绝覆盖。路径与进度由程序维护，无需手工编辑 JSON 文件。

只提交一层初始组。顶层为 subject 和 groups；每组包含 snake_case name、空 groups 数组和 note（无说明时为 null）。note 简述实体职责、可见范围、裁切及必要遮挡依据；外观只记录参考中可确认的事实，未知外观设计留给后续补全与绘制。字段与允许值见 schema。一次成功保存后结束；校验失败时按错误修正参数。不要通过终端编辑分组或进度文件。最终回复只需简述完成情况。

例如：

{
  "subject": "character",
  "groups": [
    {"name": "face", "groups": [], "note": "脸部、五官和耳朵；后续只补脸型、耳朵，不补头顶与后脑。"},
    {"name": "hair", "groups": [], "note": null},
    {"name": "head_accessories", "groups": [], "note": null},
    {"name": "neck", "groups": [], "note": null},
    {"name": "body", "groups": [], "note": null},
    {"name": "arms", "groups": [], "note": null},
    {"name": "pelvis", "groups": [], "note": null},
    {"name": "legs", "groups": [], "note": null}
  ]
}

示例按实际角色取舍。
