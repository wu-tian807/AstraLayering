# 契约示例

> 历史格式，已停止用于主工作流；仅供理解早期示例。现行流程使用 SVG 原生分组与绘制顺序，见 [workflows](../workflows/readme.md)。

对照 `layer-contract.md` 看的最小示例。3 层：背景、躯干、左臂。
路径数据是简化过的几何图形，不是真实角色画法，只用来演示结构骨架。

```xml
<svg xmlns="http://www.w3.org/2000/svg" id="character-svg"
     width="400" height="600" viewBox="0 0 400 600" role="img">

  <!-- 共享资源，不属于任何单个部件私有（对应第 3 节） -->
  <defs>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#ffe0c2"/>
      <stop offset="1" stop-color="#e8b98f"/>
    </linearGradient>
  </defs>

  <!-- 唯一一份 manifest，顺序 = 从底到顶叠放顺序（对应第 1、2 节） -->
  <metadata id="layer-manifest">
  {
    "version": "0.1",
    "layers": [
      { "id": "background",  "name": "背景",     "category": "background", "rank": 0 },
      { "id": "torso_base",  "name": "躯干底体", "category": "body",       "rank": 1 },
      { "id": "arm_L",       "name": "左臂",     "category": "body",       "rank": 2 }
    ]
  }
  </metadata>

  <!-- 图层 0：background -->
  <g id="background" data-name="背景" data-category="background" data-rank="0">
    <g data-owner="background">
      <rect x="0" y="0" width="400" height="600" fill="#dfe7ef"/>
    </g>
  </g>

  <!-- 图层 1：torso_base -->
  <g id="torso_base" data-name="躯干底体" data-category="body" data-rank="1">
    <title>躯干底体</title>
    <desc>肩部区域已按遮挡补全画完整，独立显示时是完整躯干，不依赖左臂的裁切。</desc>
    <g data-owner="torso_base">
      <!-- 躯干左肩延伸到 x=140，已经画进了左臂将会覆盖的区域（对应第 3 节遮挡补全） -->
      <path d="M140 180 L260 180 L270 400 L130 400 Z" fill="url(#skin)"/>
    </g>
  </g>

  <!-- 图层 2：arm_L -->
  <g id="arm_L" data-name="左臂" data-category="body" data-rank="2">
    <title>左臂</title>
    <defs>
      <!-- 局部裁剪，命名带自身 id 前缀，只给自己用（对应第 3 节资源隔离） -->
      <clipPath id="boundary-arm_L" clipPathUnits="userSpaceOnUse">
        <path d="M100 170 L150 170 L150 420 L100 420 Z"/>
      </clipPath>
    </defs>
    <g data-owner="arm_L">
      <!-- 左臂内侧到 x=150，跟躯干在 x=140–150 这一小段故意重叠（对应第 4 节允许的重叠） -->
      <path d="M100 170 L150 170 L150 420 L100 420 Z" fill="url(#skin)" stroke="#b98"/>
      <g clip-path="url(#boundary-arm_L)">
        <path d="M110 200 L140 200 L140 210 L110 210 Z" fill="#00000010"/>
      </g>
    </g>
  </g>

</svg>
```

## 对应关系

| 示例里的东西 | 契约条文 |
|---|---|
| `<metadata id="layer-manifest">` 里的 4 个字段 | 第 2 节 |
| 三个 `<g>` 平铺、各自镜像 `data-name`/`data-category`/`data-rank` | 第 3 节 |
| `boundary-arm_L` 只在 `arm_L` 内部被引用 | 第 3 节，资源隔离 |
| `torso_base` 的 `<desc>` 说明肩部已补全 | 第 3 节，遮挡补全 |
| `torso_base` 画到 x=140，`arm_L` 画到 x=150 的重叠 | 第 4 节，允许的重叠 |

早期产出（如 [miku公式服.svg](../demos/wu-tian807/miku公式服.svg)）是同一套骨架，每层内部换成几十到几百条真实的贝塞尔路径。
