#!/bin/bash
# 打包 universal DMG（Apple Silicon + Intel）：
#   1. 安装两个 Rust target；
#   2. 前端 pnpm build + Tauri release 构建；
#   3. Tauri bundler 生成带 Applications 拖拽快捷方式的 DMG。
# 产物：src-tauri/target/universal-apple-darwin/release/bundle/dmg/
#
# 本地只想要当前架构的 .app，用 `make build` 更快。
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "需要 pnpm：https://pnpm.io/installation" >&2
  exit 1
fi

echo "==> 安装 Rust targets"
rustup target add aarch64-apple-darwin x86_64-apple-darwin

echo "==> 安装前端依赖"
pnpm install --frozen-lockfile

echo "==> 构建 universal DMG"
pnpm tauri build --target universal-apple-darwin --bundles dmg

DMG_DIR="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
echo "==> 完成：$DMG_DIR"
ls -lh "$DMG_DIR"/*.dmg 2>/dev/null || true
