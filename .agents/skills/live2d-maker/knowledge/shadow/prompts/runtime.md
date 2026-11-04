---
本次运行（以下均为绝对路径）：
- 管线目录："{uri:shadow}"。
- 已组装、分层的角色 KRA（只读）："{uri:character-assembly/step01/character-assembled.kra}"。
- 对应原尺寸合成 PNG（几何配准基准，只读）："{uri:character-assembly/step01/character-assembled.png}"。
- simplified 参考（分析画法与投影范围，只读）："{uri:part-layering/references/simplified-subject.png}"。
- part 分组与遮挡顺序：["{uri:part-layering/groups.json}","{uri:part-layering/occlusion.json}","{uri:clothing-part-layering/groups.json}","{uri:clothing-part-layering/occlusion.json}"]；未穿衣、没有衣服 part 时只有前两项。人物 ID 记为 character:<原 part ID>，衣服 ID 记为 clothing:<原 part ID>。
