# 小羊贴纸铺 · 官网

营销落地页，使用 Vite + React + TypeScript。作为 pnpm workspace 的一部分，
依赖与锁文件都由仓库根目录统一管理。

## 本地开发

在仓库根目录：

```bash
pnpm install
pnpm dev:site       # 启动官网 Vite 开发服务器
```

只构建官网：

```bash
pnpm build:site     # 输出 apps/site/dist
```

`apps/site` 内的 `dev / build / preview / typecheck / lint` 脚本也可以直接
通过 `pnpm --dir apps/site <script>` 调用。

## 部署

推送到 `master` 且 `apps/site/**` 或根 workspace 配置有改动时，
`.github/workflows/site.yml` 会自动构建并部署到 GitHub Pages。

## 素材

界面截图、贴纸和图标说明见 [ASSETS.md](./ASSETS.md)。
