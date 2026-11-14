# 版本发布

根 `package.json`、`CHANGELOG.md` 和 Git 标签使用同一版本号。新增功能或配置迁移使用次版本；已有行为的修复使用补丁版本。配置迁移在对应版本的更新记录中说明。

## 准备与合入

1. 从最新 main 整理发布 PR，更新根版本号与对应更新记录。
2. 核对升级操作、README 演示和工作台截图；发布 PR 的 CI 会运行管线、Web、类型和打包检查。
3. 合入 main 后，现有发布工作流自动为该提交创建 `vX.Y.Z` 标签、打包 ZIP 并发布同名 GitHub Release。相同版本已发布时跳过。

版本 PR 合入即进入自动发布流程，准备阶段只提交 PR。

## 本地打包

已有标签可直接打包：

```sh
pnpm release:pack vX.Y.Z
```

输出 `.release/AstraLayering-vX.Y.Z.zip`。打包器读取标签中的 Git tree 和 `.gitattributes`，包含工作台、完整 skill、展示图、许可证，以及映射到 `.run/pink-doll` 的默认案例。其他案例、教程和历史资料保留在仓库。

解压后核对版本、默认案例和启动入口。升级安装保留原目录的 `.run/`、`.web/settings.json` 与 skill `.env`。

## 同版本重建

确需替换已发布安装包时，更新 `.github/release-rebuild.json` 的版本、预期标签提交及 Release／资产 ID，通过发布工作流的重建入口处理。普通版本升级不改此文件。
