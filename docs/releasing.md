# 版本发布

版本号、Git 标签和 ZIP 使用同一个 `vX.Y.Z`。更新根 `package.json` 与 `CHANGELOG.md`，检查通过并合入 main 后，再创建标签和发布包。

## 打包

获取合入后的 main，在该提交创建标签：

```sh
git fetch upstream main --tags
git tag vX.Y.Z upstream/main
git push upstream vX.Y.Z
pnpm release:pack vX.Y.Z
```

生成文件为 `.release/AstraLayering-vX.Y.Z.zip`。打包器读取标签中的 Git tree，并应用 `.gitattributes`：

- 包含工作台、完整 skill、展示图片、许可证与 Pink Doll 示例。
- 标签中的 `demos/pink-doll` 放入 ZIP 的 `.run/pink-doll`。
- 其他案例、教程、历史研究资料保留在仓库。

本机 `.env`、真实 `.run` 任务与 `.web` 设置保留在原安装目录。

## 检查与上传

```sh
node --test scripts/tests/release-pack.test.mjs
sha256sum .release/AstraLayering-vX.Y.Z.zip
```

解压最终 ZIP 到独立目录，检查版本号、默认 Pink Doll 示例和工作台启动。将该 ZIP 上传到同名 GitHub Release，说明相对上一版本的变化与升级操作。

更新已有工作台时保留制作任务、`.web/settings.json` 和 skill `.env`，复用现有服务入口。
