#!/bin/bash
# 打包 universal DMG（Apple Silicon + Intel）：
#   1. 安装两个 Rust target；
#   2. 根目录安装 workspace 依赖；
#   3. Tauri release 构建 + bundler 生成带 Applications 拖拽快捷方式的 DMG。
#
# 产物：apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/
#
# 本地只想打当前架构：pnpm package:arm64（更快）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "需要 pnpm：https://pnpm.io/installation" >&2
  exit 1
fi

echo "==> 安装 Rust targets"
rustup target add aarch64-apple-darwin x86_64-apple-darwin

echo "==> 安装 workspace 依赖"
pnpm install --frozen-lockfile

echo "==> 构建 universal DMG"
pnpm --dir apps/desktop exec tauri build \
  --target universal-apple-darwin \
  --bundles dmg

DMG_DIR="apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg"
echo "==> 完成：$DMG_DIR"
ls -lh "$DMG_DIR"/*.dmg 2>/dev/null || true
