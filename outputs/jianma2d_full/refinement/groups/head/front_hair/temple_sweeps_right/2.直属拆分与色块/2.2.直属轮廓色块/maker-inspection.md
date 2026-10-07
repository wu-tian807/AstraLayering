# n28 2.2 制作者实际检查

Actor `/root/workflow_runner`。已实际查看full.png整图混合；五个逐件原生参考/独显/混合/轮廓图；无父底稿components.png组合；ear-root-8x.png与crown-root-8x.png。未发布/未checkpoint，等待独立审查。

- crown_sweeps：保持右冠翼下完整根冠与短扫扇范围，右外弧比左紧。首稿内根超出已批准父弧，改用父原始完整内根后无越界；内侧两段相接的小角位于宽刘海后，后续不得显影为根截口。内部短片继续在n51拆分。
- upper_temple_lock：上段完整独立根至(518,220)附近较紧回卷片端，右可见前缘按本片内侧边走，没有拿父整体包络替代；上下根搭叠有余量。
- middle_temple_lock：下一条长回卷发片保持连续根与宽弧底，右缘位于父外弧以内/原弧上，内部亮暗不会成为子实体。上部斜根边受上片与刘海覆盖。
- lower_temple_lock：下宽片末端约(513,258)向内收回，与中片和耳片连续交叠，没有左侧两个孔；可见边顺本侧参考，不机械镜像左侧。
- ear_lock：原最低点(499,279)和完整内根贝塞尔保留；隐藏上根沿原外弧延到(522,212)，8倍图确认外侧连续无突起，新增根在中/下片之后，未改变下耳可见弧。耳片内缘连续，无开孔。

无父组合覆盖右头侧冠根到耳前，各片隐藏根在刘海背后伸出作尖边不代表最终显影。没有白色断缝，当前结构未吞入耳坠/刘海。默认4x/128五项outside_samples均0；首稿196/1的真实失败与诊断保留在trial-01，修正依据见corrections.md。未改容差、未使用裁父或epsilon收缩。移除唯一n28 marker新增片段后，与输入guide逐字一致。

- `crown_sweeps.png` SHA-256 `56ce6a7504d7f55385171c37d209d16eeed844b60960766a59b07985844e5bf6`
- `upper_temple_lock.png` SHA-256 `282c8f3c38f481aabdb8b45d0ddac3c6b4ba415d256b7c4bc13627ba442cf28e`
- `middle_temple_lock.png` SHA-256 `4db9c3795240a161911c9319f9b5889fae9abf1d7f232b61437cb390a2ae7a8f`
- `lower_temple_lock.png` SHA-256 `3b79904af1f282591466e0f5c3206ff2d172398f2a6f93479f7ebdb265f458a7`
- `ear_lock.png` SHA-256 `3d4d5af35a3eaa40713ca9d8022cd5b07dbf42840b3abc313a17ce6d8d63d131`
- `full.png` SHA-256 `f87e61fa096561965c4f36020cbda885a56dc3a3607a8e2257b3f7fca282ee30`
- `components.png` SHA-256 `d07c1cae4b8646f5f8de90ba6ff673d5fe0609b63f78179de9f850b997f0008b`
- `ear-root-8x.png` SHA-256 `2b571d949516ea1b3f79326ec95b67c41f883610e8fdb211aad0da8877ffbf9d`
- `crown-root-8x.png` SHA-256 `11946687abef969a361e5f6d752a7c81081f19d32b26e5f6a388036e94bde433`
