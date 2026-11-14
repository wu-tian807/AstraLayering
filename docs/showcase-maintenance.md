# 展示图维护

README 使用的图片与 GIF 放在仓库根目录 `showcase/`。

分层展示图由工程图层生成。在仓库根目录执行：

```sh
node scripts/export-showcase-layers.ts --krita /path/to/krita
node scripts/build-demo-showcase.mjs
```

第一步将图层导出到 `.web/showcase-layers/`，第二步生成原图、合成图与分层展开图。Jianma 使用组装工程图层与阴影合成图，其他案例使用各自组装工程与合成图。

头部九轴 GIF 使用已保存的模型和共享渲染器。更新时保留循环播放，并压缩尺寸和帧率，便于 GitHub 页面加载。

## 头部九轴与界面

- `showcase/tanuki-face-nine-axis.gif`：仅脸部与五官，展示左右、俯仰和斜向。
- `showcase/tanuki-whole-head-left-right.gif`：脸部、五官、全部头发与头饰，仅展示左右。
- `web/demo-screenshots/`：当前流程、九轴工作台、模型服务配置与头部先验截图。

从现有 KRA 和累计模型读取素材，用工作台共享渲染器导出；保持实际制作方向，不混入手动姿态覆盖。更新后检查循环、端点、连接遮挡和页面尺寸，清理临时逐帧图。
