# 展示图维护

README 使用的图片与 GIF 放在仓库根目录 `showcase/`。

分层展示图由工程图层生成。在仓库根目录执行：

```sh
node scripts/export-showcase-layers.ts --krita /path/to/krita
node scripts/build-demo-showcase.mjs
```

第一步将图层导出到 `.web/showcase-layers/`，第二步生成原图、合成图与分层展开图。Jianma 使用组装工程图层与阴影合成图，其他案例使用各自组装工程与合成图。

头部九轴 GIF 使用已保存的模型和共享渲染器。更新时保留循环播放，并压缩尺寸和帧率，便于 GitHub 页面加载。
