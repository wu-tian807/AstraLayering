`fit_nine_axis` 用 SVG 曲线和对应点拟合已有节点的目标关键形，沿用当前网格和父级坐标。传 `action=fit`、`trace` 和节点 `id`。可用 `features` 选取描线或对应点的 id，`revision` 核对作者版本，`smoothness` 调整平滑程度。

整头步骤可传目标角度 `x`、`y`。头发与头饰可用 `side=left|right`，默认 left。抬头与低头默认取本方向端点。完整斜角可用 `corner=left-up|left-down|right-up|right-down`。显式角度优先，始终受本步权限和姿态范围约束。

描线 JSON 使用 `version:1`、`space:"view"|"canvas"`、`curves:[{id,part,source,target,visibility?,weight?}]` 或 `landmarks:[{id,part,source:[x,y],target:[x,y],visibility?,weight?}]`。source/target 曲线为开放或闭合 SVG path d，起终点和方向相互对应。view 使用当前视框，canvas 使用原画布坐标。part 是选定节点承载的原画部件，遮挡段可标为 `occluded`。

`inspect` 返回描线叠图及 revision。整头步骤的 `completion` 可选。叠图使用显式 `reference` PNG 或当前方向已绑定的参考帧。缺对应帧时，请准备好目标姿态的 PNG 并显式传 `reference`。`fit` 可直接用描线求解，显式传 `reference` 时附带叠图。

脸部步骤沿用本步参考帧。涉及 `face/face_base` 的描线，或拟合脸底及其承载 Warp 时，提供闭合 `completion:{part,source,target}` 核对脸缘。单独拟合五官与耳朵可直接提供曲线或对应点。脸部斜角指定 `left-up` 或 `left-down`，revision 绑定所选帧和描线。修改后重新 inspect。

fit 校验网格后保存目标关键形及误差报告，路径见 `reportPath`。五官与耳朵有独立报告。
