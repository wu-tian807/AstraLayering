# 阶段3 step2独立审查：需返修

候选：`/Users/wutian/Desktop/coding/AstraLayering/working/step03-base-character/03-2_面部与表情.svg`  
版本：v1  
SHA-256：`904427adaa5b7cbf19f22451d9bbe7765f5525f042b1cbc7e6b3917a11e3bc28`

总判定：**需返修**。面部五官、实际眼部开口和头脸底形可接受；画面右侧卷发有一处来自step1的明确墨线穿插错误，应由原step2 worker在前两步范围内联动修正，再复验。

## 实际检查范围与方法

- 已核对候选SHA-256，与交接值相同；候选与参考均为1024×1536原画布。
- 自行重新渲染候选并检查全图头身关系；以基础彩图为造型依据，前置4线稿仅辅助观察。
- 头部同坐标裁切为`(340,20,330,320)`、3倍；检查正常渲染、左右并排及整图正常合成后的50%透明叠加。
- 已将同属`head-face`的底形、五官和前层眉线合看，独显头脸、耳朵、后发、左右侧发、刘海、环状翘发和双发夹，并恢复头部组合与全图。
- 对眼白、虹膜和眼睑作仅改填色的诊断副本，保留所有几何、顺序和描线；检查实际遮挡后的眼部开口，也独显了眼睑下完整眼白与虹膜。
- 与step1做结构差分和整图渲染差分：已有几何未修改，无重复ID、失效引用、外链、嵌图或脚本。整图差异仅位于`x=434–574,y=176–277`的新增五官区域，身体姿态与接触关系未发生回归。
- 身体其余线稿、配色、材质及全局线质精修不属本节点验收。

## 分项结论

| 项目 | 结论 | 依据 |
| --- | --- | --- |
| 头型发型与神态 | 通过 | 头身关系、脸颊至下巴弧度、发型包脸范围、双眼位置和视线、鼻及微笑开口与原彩图基本一致；新增五官未改坏step1头脸轮廓。 |
| 头部构造与线条 | 需返修 | 右侧卷发的后方内线穿过前景分界，见H01；双发夹的实心底形、间隔和厚度线可接受。 |
| 完整性与组合遮挡 | 底形通过，局部墨线遮挡需修正 | 头脸与主要发束闭合底形完整，隐藏延续存在，环状翘发真实负空间及发夹间隙成立；眼睑对眼白与虹膜的覆盖正常。右侧卷发墨线仍存在H01的穿透关系。 |

## 返修问题

### H01 · P2 · 右侧卷发内部墨线穿过前景分界

- **位置：** 原画布约`x=580–594,y=237–260`，`hair-right-inner-locks`中的`M583 237 C582 246 585 255 592 259`短弧，以及与它相交的`hair-right-front-lock`和`M598 220 C598 236 591 251 580 258`分段。
- **可见差异：** 候选短弧先穿过斜向的前景发束分界，又与相邻内弧形成第二个X交点，读成几条无前后关系的交叉线。原彩图中此处是发束向内回卷后的分层边界，后方弧线在前景发束处收束／被遮挡，没有候选这两个露出的X交点。正常头部3倍图即可看见，6倍局部证据用于准确定位；这属于发束构造及可见线段的遮挡错误，而非统一粗细等全局线质问题。
- **来源：** step1既有问题。step2未修改这些路径，也未新增此处误差；本节点提示词明确要求联动审查前两步并可由step2 worker修正。
- **可操作修正：** 依据前景发束边界整理上述短弧和相邻内弧的可见段，使后方线在前方发束下终止或被遮挡，消除双X和越过边界的线头；保留完整闭合发束底形、脸缘、外轮廓和五官坐标。修正后同时核对右侧卷发整体弧度、邻接发梢和整图，防止把卷发简化成缺失内层的空白块。
- **证据：** `hair-curl-right-side.png`（左原彩图、右候选），`hair-curl-right-overlay.png`（同坐标叠加），`parts-hair-right.png`（独显），`head-reference-side.png`（正常头部组合）；各比较参数及输入哈希见同名前缀的`.json`。

## 其余主要证据

- `reference-side.png`、`reference-overlay.png`、`full.png`：全图与头身关系。
- `head-reference-side.png`、`head-reference-overlay.png`：彩图与候选头脸组合。
- `head-line-art-side.png`：生成线稿辅助对照。
- `head-neutral.png`、`face-neutral.png`、`parts-hair-back.png`、`parts-hair-left.png`、`parts-hair-right.png`、`parts-hair-bangs.png`、`parts-clips-cowlick.png`：中性底独显与组合。
- `eyes-reference-side.png`、`eye-occlusion-diagnostic.png`、`eyes-complete-under-lids.png`：实际眼部开口和隐藏底形；诊断副本不是交付稿，颜色只用于区分区域。
- `structure-changes.json`、`full-step1-diff.png`、`full-step1.json`：归属、结构和对step1的回归检查。

证据目录：`/Users/wutian/Desktop/coding/AstraLayering/working/step03-base-character/review-step2-evidence-v1/`。所有结论仅对应本报告所列v1候选及SHA-256。完成H01后需复验，不宜直接进入下一绘制节点。
