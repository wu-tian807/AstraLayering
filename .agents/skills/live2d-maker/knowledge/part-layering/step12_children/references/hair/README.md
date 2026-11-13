# 头发拆分参考图

本目录保存头发拆分参考板，供 `../../prompts/groups/hair/` 下各拆分正文按当前发型和疑问选择。全部参考板已纳入版本管理，新签出即可使用；配置本身不会下载或生成图片。

下列三张参考板与恢复来源 `tutorial/live2d-guidance/hair-reference-templates/` 中的同名文件字节一致，已放在本目录，供现有清单直接读取：

| 文件 | 参考价值 |
| --- | --- |
| `01-发区组织与前侧发拆分-Milly.png` | 区分完整刘海、前侧发、侧发与后发底形，观察隐藏发根；发区名称由同一角色 PSD 辅助核对。 |
| `02-长发主束与细束的粒度对照-莉尔.png` | 比较完整长发片与细发片，避免只取小碎发代替完整侧发。 |
| `03-长卷发整束与多尖发面-樱桃蛋糕天使.png` | 长卷曲、多尖末端与丰富发纹仍可属于一件完整 part，避免按弯折或发尖机械细分。 |

以下两张由 Live2D 官方示例模型渲染，每格左 0°、右 ParamAngleX 30°，浅色为脸的剪影并保持原层序；制作脚本、裁片和来源哈希在 `tutorial/live2d-guidance/hair-reference-templates/live2d-depth/`：

| 文件 | 参考价值 |
| --- | --- |
| `04-侧发与后发按脸前后深度区分-Hiyori-Mao.png` | 按相对脸的深度区分侧发、鬓发与后发：Mao 宽横髪为侧发，Hiyori 细横髪为鬓发，脸框长发画在脸后属后发。 |
| `05-前发覆盖额角-后发外壳与呆毛-Ren-Haru-Tsumiki.png` | Ren 前发与额角的归属；Haru / Tsumiki 后发完整外壳及脸后覆盖范围；Tsumiki 呆毛单独成件。 |

hair 与 back_hair 的拆分正文列出全部五张板，bangs 列 Milly 与 05，均以 `{reference:step12_children/references/hair/<文件>}` 写在 `additionalReferences` 中。如果使用自己的图片，需要同时调整正文中的路径和用途。

模型从 `additionalReferences` 读到图片路径和用途，再按需调用 `view_bitmap`。PNG 图集只提供发片形体先验，不能据其排布推断原 PSD 分组、独立运动或遮挡顺序；当前角色、父完成 SVG 和控制需求优先。

本阶段使用这些图片判断完整形体、发区归属和控制粒度。后发的具体着色、生图提示词及明暗检查由 raster step01 的独立上色先验负责。
