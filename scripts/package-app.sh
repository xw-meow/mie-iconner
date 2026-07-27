#!/bin/bash
# 打包 小羊贴纸铺.app:
#   1. swift build 出 universal(arm64 + x86_64)release 二进制
#   2. 组装 .app bundle(资源包放 Contents/Resources,codesign 才认)
#   3. ad-hoc 签名(无开发者证书,用户首次打开需右键→打开)
#   4. 出 DMG(带 Applications 软链,拖拽安装,供 GitHub Release 分发)
#
# 用法: scripts/package-app.sh [输出目录,默认 dist]
set -euo pipefail

APP_NAME="小羊贴纸铺"
BINARY_NAME="mie-iconner"
RESOURCE_BUNDLE="mie-iconner_mie-iconner.bundle"
OUT_DIR="${1:-dist}"

cd "$(dirname "$0")/.."

echo "==> swift build -c release (arm64 + x86_64)"
swift build -c release --arch arm64 --arch x86_64

PRODUCTS_DIR=".build/apple/Products/Release"
BINARY="$PRODUCTS_DIR/$BINARY_NAME"
RESOURCES="$PRODUCTS_DIR/$RESOURCE_BUNDLE"
[[ -f "$BINARY" ]] || { echo "找不到二进制: $BINARY" >&2; exit 1; }
[[ -d "$RESOURCES" ]] || { echo "找不到资源包: $RESOURCES" >&2; exit 1; }

APP_DIR="$OUT_DIR/$APP_NAME.app"
echo "==> 组装 $APP_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$BINARY" "$APP_DIR/Contents/MacOS/$BINARY_NAME"
cp "Sources/mie-iconner/Info.plist" "$APP_DIR/Contents/Info.plist"
# 资源包放标准 Resources 目录;放 .app 根会被 codesign
# 视为 unsealed contents 而签名失败(查找逻辑见 ContentView.bundledIconsURL)
cp -R "$RESOURCES" "$APP_DIR/Contents/Resources/$RESOURCE_BUNDLE"

echo "==> ad-hoc 签名"
codesign --force --sign - "$APP_DIR/Contents/Resources/$RESOURCE_BUNDLE"
codesign --force --sign - "$APP_DIR"

echo "==> 生成 DMG"
mkdir -p "$OUT_DIR"
DMG="$OUT_DIR/$APP_NAME-macOS.dmg"
STAGING="$OUT_DIR/dmg-staging"
rm -f "$DMG"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP_DIR" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" \
    -ov -format UDZO -imagekey zlib-level=9 "$DMG" >/dev/null
rm -rf "$STAGING"

echo "==> 完成: $DMG"
