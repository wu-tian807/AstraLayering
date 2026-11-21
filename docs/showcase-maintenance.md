# 展示图维护

README 的角色展示图与 GIF 放在 `showcase/`，界面截图放在 `web/demo-screenshots/`。

分层展示图由工程图层生成。在仓库根目录执行：

```sh
node scripts/export-showcase-layers.ts --krita /path/to/krita
node scripts/build-demo-showcase.mjs
```

第一步将图层导出到 `.web/showcase-layers/`，第二步生成原图、合成图与分层展开图。Jianma 使用组装工程图层与阴影合成图，其他案例使用各自组装工程与合成图。Pink Doll 展开时会暂时隐藏裙腰的躯干遮罩，好让分开的裙片旁边显示完整腰腹。

## 头部九轴与界面

- `showcase/tanuki-head-nine-axis.gif` 包含狸娘表演的完整 38 秒和片尾署名。更新时从成片转出循环 GIF，保留片尾并核对回放时长。
- `web/demo-screenshots/` 包含制作流程、九轴流程预览、角色工作台、环境与模型和先验知识的截图。使用当前界面与 `demos/` 中的项目录入；拍摄配置页时使用示例配置。
